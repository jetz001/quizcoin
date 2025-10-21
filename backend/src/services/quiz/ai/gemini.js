// backend/services/geminiService.js
import fetch from 'node-fetch';
import { CONFIG, GEMINI_API_URL } from '../../../config/constants.js';

export const callGemini = async (promptText, maxRetries = 5) => {
  if (!CONFIG.GEMINI_API_KEY) {
    throw new Error("Gemini API key not configured");
  }
  
  const payload = { contents: [{ parts: [{ text: promptText }] }] };
  let attempt = 0;
  
  while (attempt < maxRetries) {
    attempt++;
    try {
      console.log(`🔹 Gemini call attempt ${attempt} ...`);
      const res = await fetch(GEMINI_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`HTTP ${res.status} ${res.statusText} - ${errorText}`);
      }

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!text) {
        throw new Error("Invalid response format from Gemini API");
      }
      
      console.log("✅ Gemini responded successfully.");
      return text;
    } catch (error) {
      console.error(`❌ Gemini attempt ${attempt} failed:`, error.message);
      
      // Handle quota exceeded (429) or service unavailable (503)
      if (error.message.includes('429') || error.message.includes('quota') || error.message.includes('RESOURCE_EXHAUSTED')) {
        console.log(`⚠️ Quota exceeded. Waiting 65 seconds before retry...`);
        await new Promise(resolve => setTimeout(resolve, 65000)); // Wait 65 seconds
        continue;
      }
      
      if (error.message.includes('503') || error.message.includes('overloaded')) {
        console.log(`⚠️ Service overloaded. Waiting 10 seconds before retry...`);
        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
        continue;
      }
      
      if (attempt === maxRetries) {
        throw new Error(`Gemini failed after ${maxRetries} attempts: ${error.message}`);
      }
      
      // Exponential backoff: 2^attempt seconds
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`⏳ Waiting ${delay/1000}s before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error("Gemini: exceeded retries");
};

export const generateQuizQuestion = async () => {
  const prompt = `
Generate a single quiz question suitable for a mobile game.
The question must have four options, and only one correct answer.
Include a difficulty level (1-99) and a category.

Output JSON:
{
  "question": "text",
  "options": ["A","B","C","D"],
  "answer": "the correct option text",
  "difficultyLevel": "1-99",
  "category": "science|Math"
}
`;
  
  try {
    console.log("⚡ Requesting new quiz question from Gemini...");
    const raw = await callGemini(prompt);
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    console.log("✅ Quiz question generated.");
    return parsed;
  } catch (e) {
    console.error("generateQuizQuestion error:", e.message || e);
    return null;
  }
};