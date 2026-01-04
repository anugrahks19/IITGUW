import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = "AIzaSyAhp9uhLGDwpXT5fpoSiBlACB5tj8BOpy4";

async function list() {
    try {
        console.log("Fetching models via REST...");
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
        const data = await response.json();

        if (data.models) {
            console.log("✅ API Connectivity Check:");
            const geminiModels = data.models.filter(m => m.name.includes("gemini"));
            if (geminiModels.length > 0) {
                console.log("🎉 SUCCESS: Gemini Models Found!");
                console.log(geminiModels.map(m => m.name.replace('models/', '')).join('\n'));
            } else {
                console.log("❌ FAILURE: No Gemini models found. Only:", data.models.map(m => m.name).join(', '));
            }
        } else {
            console.error("No models found. Response:", JSON.stringify(data, null, 2));
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

list();
