import { chatWithNivu } from './src/services/openrouter.ts';

async function testVoice() {
    console.log("🎤 Testing Voice Assistant AI...");
    try {
        const response = await chatWithNivu("Hello, are you there?");
        console.log("✅ Voice Response:", response);
    } catch (e) {
        console.error("❌ Voice Error:", e);
    }
}

testVoice();
