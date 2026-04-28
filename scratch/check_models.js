import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY;
const URL = `https://generativelanguage.googleapis.com/v1/models?key=${API_KEY}`;

async function checkModels() {
    try {
        console.log('Checking available models for your API key...');
        const response = await fetch(URL);
        const data = await response.json();
        
        if (data.error) {
            console.error('Error:', data.error.message);
            return;
        }

        console.log('Available Models:');
        data.models.forEach(m => console.log(`- ${m.name}`));
    } catch (err) {
        console.error('Failed to fetch models:', err.message);
    }
}

checkModels();
