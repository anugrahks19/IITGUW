import { chatWithNexus } from './src/services/openrouter.ts';

async function testNexus() {
    try {
        console.log("Testing Voice Chat (Text Mode)...");
        const response = await chatWithNexus("Hello, are you there?");
        console.log("✅ Voice Response:", response);
    } catch (e) {
        console.error("❌ Voice Error:", e);
    }
}

testNexus();
