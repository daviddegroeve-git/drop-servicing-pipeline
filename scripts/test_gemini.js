require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

async function test() {
    console.log("Starting test...");
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    try {
        console.log("Calling generateContent...");
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: 'Hello!'
        });
        console.log("Success:", response.text);
    } catch (e) {
        console.error("Error:", e);
    }
}
test();
