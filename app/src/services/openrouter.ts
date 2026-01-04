import { GoogleGenerativeAI, type Part } from "@google/generative-ai";
import { formatProductSummary, type OFFProduct } from './openfoodfacts';
import { recognizeTextCloud } from './ocr-space'; // Keep as backup if needed

// 🔑 GOOGLE CONFIG
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;

if (!API_KEY) {
    console.error("❌ Missing Google API Key in .env");
}

const genAI = new GoogleGenerativeAI(API_KEY);
const MODEL_NAME = "gemini-1.5-flash-001"; // Pinned version for reliability

// ============================================================================
// 🧠 CACHE & UTILS
// ============================================================================

const getCacheKey = (prompt: string): string => {
    let hash = 0, i, chr;
    if (prompt.length === 0) return hash.toString();
    for (i = 0; i < prompt.length; i++) {
        chr = prompt.charCodeAt(i);
        hash = ((hash << 5) - hash) + chr;
        hash |= 0;
    }
    return `shelfSense_gemini_${hash}`;
};

// 📉 Payload Optimizer (Resizes massive phone photos to avoid Bandwidth/Latency issues)
const compressImage = async (base64Str: string, maxWidth = 800): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = base64Str.startsWith('data:') ? base64Str : `data:image/jpeg;base64,${base64Str}`;
        img.onload = () => {
            let width = img.width;
            let height = img.height;
            if (width > maxWidth) {
                height = Math.round(height * (maxWidth / width));
                width = maxWidth;
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.8)); // 0.8 Quality
        };
        img.onerror = () => resolve(base64Str);
    });
};

// Helper: Convert Data URL to InlineDataPart for Gemini
function fileToGenerativePart(base64Data: string, mimeType: string = "image/jpeg"): Part {
    return {
        inlineData: {
            data: base64Data.split(',')[1], // Remove "data:image/jpeg;base64,"
            mimeType
        },
    };
}

// ============================================================================
// ⚡ MAIN AI CALLER (GOOGLE GEMINI)
// ============================================================================
async function callGemini(
    promptParts: (string | Part)[],
    jsonMode: boolean = false,
    systemInstruction?: string
): Promise<{ content: string; model: string } | null> {

    // Cache Check (Only for text-only simple prompts to save speed)
    const isTextOnly = promptParts.every(p => typeof p === 'string');
    if (isTextOnly) {
        const cacheKey = getCacheKey(JSON.stringify(promptParts));
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            console.log("⚡ Gemini Cache Hit!");
            return JSON.parse(cached);
        }
    }

    if (!API_KEY) throw new Error("Missing Google API Key");

    try {
        console.log(`🚀 Calling Gemini 1.5 Flash...`);

        const model = genAI.getGenerativeModel({
            model: MODEL_NAME,
            systemInstruction: systemInstruction ? systemInstruction : undefined,
            generationConfig: {
                responseMimeType: jsonMode ? "application/json" : "text/plain",
                temperature: 0.3,
            }
        });

        const result = await model.generateContent(promptParts);
        const response = await result.response;
        const text = response.text();

        console.log("✅ Gemini Success!");

        const finalResult = { content: text, model: MODEL_NAME };

        // Cache text responses
        if (isTextOnly) {
            const cacheKey = getCacheKey(JSON.stringify(promptParts));
            try { localStorage.setItem(cacheKey, JSON.stringify(finalResult)); } catch (e) { }
        }

        return finalResult;

    } catch (e: any) {
        console.error("❌ Gemini Error:", e);
        throw new Error(`Google AI Error: ${e.message}`);
    }
}


// ============================================================================
// 1. PRIMARY ANALYSIS (VISION)
// ============================================================================
export interface AnalysisResult {
    verdict: 'HEALTHY' | 'MODERATE' | 'UNHEALTHY' | 'AVOID';
    verdict_short: string;
    score: number;
    explanation: string;
    tradeoffs: { pros: string[]; cons: string[]; };
    uncertainty: { score: number; reason?: string; };
    swap_suggestion?: { product_name: string; reason_why: string; savings?: string; };
    sources_cited: string[];
    followUpQuestions: string[];
    model_used?: string;
}

const MASTER_PROMPT_TEXT = (productName: string, webIngredients: string, userIntent: string) => `
You are ShelfSense, a shopping co-pilot. User Intent: "${userIntent}".
Context: Product="${productName || 'Unknown'}", Ingredients="${webIngredients || 'Not found'}".
Analyze health impact based on visible data.
RETURN JSON ONLY matching AnalysisResult schema.
`;

export const analyzeImageWithAI = async (base64Image: string, productName?: string, webIngredients: string = "", userIntent: string = "General Health"): Promise<AnalysisResult> => {

    const isBlankImage = base64Image.includes('iVBORw0KGgo'); // Simple check
    const hasIngredients = webIngredients && webIngredients.length > 20;

    let result;
    const promptText = MASTER_PROMPT_TEXT(productName || "Unknown", webIngredients, userIntent);

    if (isBlankImage || hasIngredients) {
        // Text Mode
        console.log("ℹ️ Gemini Text Mode...");
        result = await callGemini([promptText], true);
    } else {
        // Vision Mode
        console.log("📸 Gemini Vision Mode...");
        const compressed = await compressImage(base64Image);
        const imagePart = fileToGenerativePart(compressed);

        result = await callGemini([promptText, imagePart], true);
    }

    if (!result) throw new Error("Gemini returned empty response.");

    try {
        return JSON.parse(result.content);
    } catch (e) {
        console.error("JSON Parse Error", result.content);
        throw new Error("Failed to parse Gemini JSON.");
    }
};


// ============================================================================
// 1.5 JSON ANALYSIS (OPENFOODFACTS DATA)
// ============================================================================
export const analyzeProductData = async (product: OFFProduct, userIntent: string = "General Health"): Promise<AnalysisResult> => {
    const summary = formatProductSummary(product);
    const prompt = `
    You are ShelfSense. User Goal: "${userIntent}".
    Precise lab data provided:
    ${summary}
    Analyze thoroughly. Uncertainty MUST be 0.
    RETURN JSON ONLY.
    `;

    const result = await callGemini([prompt], true);
    if (!result) throw new Error("Gemini analysis failed.");
    return JSON.parse(result.content);
};


// ============================================================================
// 2. PRODUCT IDENTIFICATION
// ============================================================================
export const identifyProduct = async (base64Image: string): Promise<{ brand: string; product: string; link?: string }> => {
    const compressed = await compressImage(base64Image);
    const imagePart = fileToGenerativePart(compressed);

    // Gemini is smart enough to handle this in one shot usually
    const prompt = `Identify the Brand and Product Name from this image. 
    Return strictly in this format: "Brand - Product Name". 
    If unsure or generic, return "Unknown".`;

    const result = await callGemini([prompt, imagePart]);
    const text = result?.content.trim() || "";

    if (text.length > 3 && !text.toLowerCase().includes('unknown')) {
        if (text.includes('-')) {
            const [b, ...p] = text.split('-');
            const prod = p.join('-').trim();
            return {
                brand: b.trim(),
                product: prod,
                link: `https://www.google.com/search?q=${encodeURIComponent(b.trim() + " " + prod + " buy online")}`
            };
        }
        return { brand: "", product: text, link: "" };
    }

    return { brand: "Unknown", product: "", link: "" };
};


// ============================================================================
// 3. INGREDIENT VERIFICATION
// ============================================================================
export const verifyProductIngredients = async (productName: string): Promise<string> => {
    const result = await callGemini([`Return the official ingredients list for "${productName}". Plain text only.`]);
    return result?.content || "";
};


// ============================================================================
// 4. CHAT CO-PILOT
// ============================================================================
export const chatWithProduct = async (
    productName: string,
    ingredients: string,
    chatHistory: { role: string; content: string }[],
    question: string
): Promise<string> => {

    const context = `Product: "${productName}". Ingredients: "${ingredients}". Answer accurately and concisely (<50 words).`;

    // Construct history for context (simplified for generateContent)
    const historyText = chatHistory.map(m => `${m.role}: ${m.content}`).join('\n');
    const fullPrompt = `${context}\n\nHistory:\n${historyText}\n\nUser: ${question}`;

    const result = await callGemini([fullPrompt]);
    return result?.content || "I couldn't analyze that.";
};

// ============================================================================
// 5. NIVU VOICE ASSISTANT
// ============================================================================
export const chatWithNivu = async (
    userQuery: string,
    history: { role: string; content: string }[] = []
): Promise<string> => {
    const systemInstruction = `You are Nivu, a calm, human-like food decision co-pilot.
    CORE RULES:
    1. Speak in SHORT, confident sentences.
    2. Give clear judgment (Good/Okay/Avoid) first.
    3. Explain why.
    4. NO Markdown. Natural speech only.
    `;

    const historyText = history.map(m => `${m.role}: ${m.content}`).join('\n');
    const fullPrompt = `History:\n${historyText}\n\nUser: ${userQuery}`;

    const result = await callGemini([fullPrompt], false, systemInstruction);
    return result?.content || "I'm having trouble thinking clearly.";
};
