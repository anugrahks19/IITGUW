import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = "AIzaSyCwUNAStgUm4Fu9mRqTWgROVw1FceXJ61Y";
const genAI = new GoogleGenerativeAI(API_KEY);

async function testFallback() {
    console.log("Testing Fallback Model: gemini-pro...");
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const result = await model.generateContent("Ping");
        const response = await result.response;
        console.log("✅ GEMINI-PRO WORKS!", response.text());
    } catch (e) {
        console.error("❌ gemini-pro failed:", e.message);
    }
}

testFallback();
