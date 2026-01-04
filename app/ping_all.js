import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = "AIzaSyCzmqGw-TVq-n3Lrwe_1YQxwkWvUTzziPY";
const genAI = new GoogleGenerativeAI(API_KEY);

const CANDIDATES = [
    "gemini-1.5-flash",
    "gemini-1.5-flash-001",
    "gemini-1.5-flash-002",
    "gemini-1.5-flash-8b",
    "gemini-2.0-flash-exp",
    "gemini-1.5-pro",
    "gemini-1.5-pro-001",
    "gemini-1.5-pro-002",
    "gemini-pro"
];

async function pingAll() {
    console.log("🚀 Pinging Models with Key: " + API_KEY.substring(0, 10) + "...");

    for (const modelName of CANDIDATES) {
        process.stdout.write(`Testing ${modelName.padEnd(25)}: `);
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent("Hello");
            const response = await result.response;
            const text = response.text();
            if (text) {
                console.log(`✅ WORKING!`);
            }
        } catch (e) {
            let msg = e.message || "Unknown Error";
            if (msg.includes("404")) msg = "404 Not Found";
            if (msg.includes("403")) msg = "403 Forbidden (API Not Enabled?)";
            if (msg.includes("429")) msg = "429 Quota Exceeded";
            console.log(`❌ ${msg.split('[')[0].substring(0, 40)}`);
        }
    }
}

pingAll();
