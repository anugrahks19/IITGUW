import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = "AIzaSyCwUNAStgUm4Fu9mRqTWgROVw1FceXJ61Y";
const genAI = new GoogleGenerativeAI(API_KEY);

const MODELS_TO_TEST = [
    "gemini-1.5-flash",
    "gemini-1.5-flash-001",
    "gemini-1.5-flash-002",
    "gemini-2.0-flash-exp",
    "gemini-pro"
];

async function test() {
    console.log("🔍 Diagnosing Gemini API Key & Models...\n");

    for (const modelName of MODELS_TO_TEST) {
        process.stdout.write(`Testing ${modelName.padEnd(25)}: `);
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent("Ping");
            const response = await result.response;
            console.log(`✅ SUCCESS!`);
        } catch (e) {
            if (e.message.includes("404")) {
                console.log(`❌ 404 (Not Found)`);
            } else if (e.message.includes("429") || e.message.includes("Quota")) {
                console.log(`❌ QUOTA EXCEEDED`);
            } else {
                console.log(`❌ ERROR: ${e.message.split('[')[1]?.split(']')[0] || e.message.substring(0, 50)}`);
            }
        }
    }
}

test();
