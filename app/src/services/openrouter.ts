import { GoogleGenerativeAI, type Part } from "@google/generative-ai";
import { formatProductSummary, type OFFProduct } from './openfoodfacts';
// import { recognizeTextCloud } from './ocr-space'; // Keep as backup if needed - REMOVED for Build

// 🔑 GOOGLE CONFIG
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;

if (!API_KEY) {
    console.error("❌ Missing Google API Key in .env");
}

const genAI = new GoogleGenerativeAI(API_KEY);
// const MODEL_NAME = "gemini-2.0-flash-exp"; // Trying latest experimental version

// 🧠 MODEL FALLBACK LIST
// Prioritize Free/Experimental -> Lite -> Validated Flash -> Pro Backup
const CANDIDATE_MODELS = [
    "gemini-2.5-flash", // User Requested (Likely placeholder, but trying first)
    "gemini-2.0-flash-exp", // Experimental (Smartest Free)
    "gemini-2.0-flash-lite-preview-02-05", // Lite Preview (Fastest Free)
    "gemini-1.5-flash", // Standard Alias
    "gemini-1.5-flash-001", // Pinned Standard
    "gemini-1.5-flash-8b", // High Efficiency
    "gemini-1.5-pro" // Backup (Might be paid/limited)
];

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
// ⚡ MAIN AI CALLER (GOOGLE GEMINI - WITH FALLBACK)
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

    let lastError = "";

    // 🔄 FALLBACK LOOP
    for (const modelName of CANDIDATE_MODELS) {
        try {
            console.log(`🚀 Trying Model: ${modelName}...`);

            const model = genAI.getGenerativeModel({
                model: modelName,
                systemInstruction: systemInstruction ? systemInstruction : undefined,
                generationConfig: {
                    responseMimeType: jsonMode ? "application/json" : "text/plain",
                    temperature: 0.3,
                }
            });

            // ⏱️ Timeout Race (20s)
            const resultPromise = model.generateContent(promptParts);
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 20000));

            const result: any = await Promise.race([resultPromise, timeoutPromise]);
            const response = await result.response;
            const text = response.text();

            if (!text) throw new Error("Empty response");

            console.log(`✅ Success with ${modelName}!`);

            const finalResult = { content: text, model: modelName };

            // Cache text responses
            if (isTextOnly) {
                const cacheKey = getCacheKey(JSON.stringify(promptParts));
                try { localStorage.setItem(cacheKey, JSON.stringify(finalResult)); } catch (e) { }
            }

            return finalResult;

        } catch (e: any) {
            console.warn(`❌ ${modelName} Failed:`, e.message);
            lastError = e.message;

            // If it's a "Safety" block, it might block all models, but we continue anyway.
            // If it's "404 Not Found" or "429 Quota", we definitely want to try the next one.
            continue;
        }
    }

    console.error("☠️ All Gemini Models Failed.");
    throw new Error(`All Models Failed. Last Error: ${lastError}`);
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
You are ShelfSense, an expert health analyzer.
User Intent: "${userIntent}".
Context: Product="${productName || 'Unknown'}", Ingredients="${webIngredients || 'Not found'}".

Analyze health impact for this intent.
CRITICAL: You MUST return a valid JSON object.
STRICT JSON STRUCTURE:
{
  "verdict": "HEALTHY" | "MODERATE" | "UNHEALTHY" | "AVOID",
  "verdict_short": "Short summary (5 words max)",
  "score": 0-100,
  "explanation": "Detailed explanation (2 sentences)",
  "tradeoffs": { "pros": ["pro1", "pro2"], "cons": ["con1", "con2"] },
  "uncertainty": { "score": 10-90, "reason": "Why uncertain?" },
  "swap_suggestion": { "product_name": "Better Alternative", "reason_why": "Why better?" },
  "sources_cited": ["Generic Knowledge"]
}
DO NOT RETURN MARKDOWN. DO NOT USE \`\`\`json. JUST RETURN RAW JSON.
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
        const cleanJson = result.content.replace(/```json\n?|\n?```/g, "").trim();
        const parsed = JSON.parse(cleanJson);

        // Validation Schema Check
        if (!parsed.verdict || !parsed.explanation) {
            throw new Error("Missing verdict schema.");
        }

        return parsed;
    } catch (e) {
        console.error("JSON Parse Error", result.content);
        throw new Error("Failed to parse Gemini JSON. Raw: " + result.content.substring(0, 50));
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
