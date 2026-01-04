import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = "AIzaSyCG5cOtv3uw9bYqgekvMP_qusCFkS1H1Rc";

async function list() {
    try {
        console.log("Fetching models via REST...");
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`);
        const data = await response.json();

        if (data.models) {
            console.log("✅ Available Models (Full List):");
            const names = data.models.map(m => m.name.replace('models/', ''));
            console.log(JSON.stringify(names, null, 2));
        } else {
            console.error("No models found. Response:", JSON.stringify(data, null, 2));
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

list();
