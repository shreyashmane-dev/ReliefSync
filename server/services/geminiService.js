import dotenv from 'dotenv';

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
// Using v1beta as it is more stable for newer models like 1.5 Flash
const BASE_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// Settings
const THROTTLE_DELAY = 1500; // ms between requests
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const MAX_RETRIES = 3;

/**
 * ─── IN-MEMORY CACHE WITH TTL ──────────────────────────────────────────────
 */
const cache = new Map();
const getCached = (key) => {
  const normalizedKey = key.trim().toLowerCase();
  const cached = cache.get(normalizedKey);
  if (cached && Date.now() < cached.expiry) return cached.data;
  cache.delete(normalizedKey);
  return null;
};
const setCached = (key, data) => {
  cache.set(key.trim().toLowerCase(), {
    data,
    expiry: Date.now() + CACHE_TTL
  });
};

/**
 * ─── REQUEST QUEUE SYSTEM ──────────────────────────────────────────────────
 */
const queue = [];
let isProcessing = false;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const processQueue = async () => {
  if (isProcessing || queue.length === 0) return;
  
  isProcessing = true;
  const { prompt, resolve, reject, retries } = queue.shift();

  try {
    const result = await performGeminiRequest(prompt, retries);
    resolve(result);
  } catch (error) {
    reject(error);
  } finally {
    // Wait for throttle delay before allowing next request
    await delay(THROTTLE_DELAY);
    isProcessing = false;
    processQueue();
  }
};

/**
 * ─── CORE REQUEST LOGIC WITH EXPONENTIAL BACKOFF ─────────────────────────────
 */
const performGeminiRequest = async (prompt, attemptsRemaining = MAX_RETRIES) => {
  const requestBody = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
    }
  };

  try {
    console.log(`Gemini Service: Transmitting to ${GEMINI_MODEL}...`);
    const response = await fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    // Handle 429 Rate Limit
    if (response.status === 429) {
      if (attemptsRemaining > 0) {
        const backoff = Math.pow(2, MAX_RETRIES - attemptsRemaining + 1) * 1000;
        console.warn(`Gemini 429: Rate limited. backing off for ${backoff}ms...`);
        await delay(backoff);
        return performGeminiRequest(prompt, attemptsRemaining - 1);
      }
      throw new Error('QUOTA_EXCEEDED');
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Gemini API Error Status: ${response.status} - ${response.statusText}`);
      console.error(`Gemini API Error Body: ${errorText}`);
      throw new Error(`API_ERROR: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('EMPTY_RESPONSE');

    return JSON.parse(text);
  } catch (error) {
    if (error.message === 'QUOTA_EXCEEDED' || attemptsRemaining === 0) {
      throw error;
    }
    // Retry for other transient errors
    console.warn(`Gemini Request Failed: ${error.message}. Retrying...`);
    return performGeminiRequest(prompt, attemptsRemaining - 1);
  }
};

/**
 * ─── PUBLIC SERVICE API ────────────────────────────────────────────────────
 */
export const geminiService = {
  /**
   * General purpose queued Gemini request
   * @param {string} prompt 
   * @param {string} cacheKey 
   */
  execute: (prompt, cacheKey) => {
    return new Promise((resolve, reject) => {
      // 1. Check Cache
      if (cacheKey) {
        const cached = getCached(cacheKey);
        if (cached) return resolve(cached);
      }

      // 2. Add to Queue
      queue.push({
        prompt,
        resolve: (data) => {
          if (cacheKey) setCached(cacheKey, data);
          resolve(data);
        },
        reject,
        retries: MAX_RETRIES
      });

      // 3. Kickoff processing
      processQueue();
    });
  },

  /**
   * Specialized method for chat (Requirement #8)
   */
  chat: async (message) => {
    const systemPrompt = `You are a helpful disaster response assistant. Provide clear, empathetic, and tactical advice. Return ONLY a JSON object: {"reply": "your response"}`;
    const fullPrompt = `${systemPrompt}\n\nUser: ${message}`;
    
    try {
      const response = await geminiService.execute(fullPrompt, message);
      return {
        ok: true,
        reply: response.reply || response.text || JSON.stringify(response)
      };
    } catch (error) {
      console.error('Gemini Chat Service Error:', error);
      return {
        ok: false,
        reply: "System busy, please try again in a few seconds.",
        error: error.message,
        code: error.message === 'QUOTA_EXCEEDED' ? 'QUOTA_EXCEEDED' : 'GEMINI_REQUEST_FAILED'
      };
    }
  },

  /**
   * Specialized method for analysis
   */
  analyze: async (text) => {
    const systemPrompt = `Classify this disaster report into categories: flood, fire, earthquake, medical, accident, other. Assign priority: low, medium, high. Return JSON: {"category": "...", "priority": "..."}`;
    const fullPrompt = `${systemPrompt}\n\nReport: ${text}`;
    
    try {
      return await geminiService.execute(fullPrompt, text);
    } catch (error) {
      return { category: 'other', priority: 'medium', error: true };
    }
  }
};
