import { geminiService } from "../services/geminiService.js";
import { getGeminiModel } from "../config/gemini.js";

/**
 * Controller for general disaster report analysis (Requirement #4)
 * POST /api/analyze-report
 */
export async function analyzeGenericReport(req, res) {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: "Report text is required" });
    }

    const result = await geminiService.analyzeReport(text);
    res.json(result);
  } catch (error) {
    console.error("AI Generic Analysis Error:", error);
    res.status(500).json({ error: "Failed to analyze mission report" });
  }
}

/**
 * Legacy/Specialized Analysis Controller
 */
export async function analyzeReport(req, res) {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const model = getGeminiModel();
    const prompt = `
You are a disaster response AI. 
Analyze the following report and return ONLY a valid JSON object with these keys: 
"urgency" (low | medium | high), 
"emergency_type" (string), 
"volunteers_needed" (number), 
"actions" (string), 
"location_summary" (string).

Report: ${message}
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text().trim();
    
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    try {
      res.json(JSON.parse(text));
    } catch (parseErr) {
      res.json({
         urgency: "medium",
         emergency_type: "incident",
         volunteers_needed: 2,
         actions: "Evaluate situation and maintain safety protocols.",
         location_summary: "Confirmed report location"
      });
    }
  } catch (error) {
    console.error("AI Controller Error:", error);
    res.status(500).json({ error: "AI processing failed" });
  }
}
