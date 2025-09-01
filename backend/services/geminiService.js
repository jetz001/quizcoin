// backend/services/geminiService.js
import fetch from 'node-fetch';
import { CONFIG, GEMINI_API_URL } from '../config/constants.js';

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
        const txt = await res.text().catch(()=>"");
        throw new Error(`HTTP ${res.status} ${res.statusText} - ${txt}`);
      }
      
      const json = await res.json();
      const generatedText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!generatedText) throw new Error("Empty generation result");
      
      console.log("✅ Gemini responded successfully.");
      return generatedText;
    } catch (err) {
      console.error(`❌ Gemini attempt ${attempt} failed:`, err.message || err);
      if (attempt >= maxRetries) throw err;
      
      const backoff = Math.min(30000, 2 ** attempt * 1000);
      console.log(`⏳ Waiting ${backoff / 1000}s before retry...`);
      await new Promise(r => setTimeout(r, backoff));
    }
  }
  throw new Error("Gemini: exceeded retries");
};

export const generateQuizQuestion = async () => {
  const prompt = `
Generate a single quiz question suitable for a mobile game.
The question must have four options, and only one correct answer.
Output JSON:
{
  "question": "text",
  "options": ["A","B","C","D"],
  "answer": "the correct option text"
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