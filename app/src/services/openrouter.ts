import { GoogleGenerativeAI, type Part } from "@google/generative-ai";
import { formatProductSummary, type OFFProduct } from './openfoodfacts';

// ============================================================================
// 🔑 CONFIG & KEYS
// ============================================================================
const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;

if (!GOOGLE_API_KEY) console.warn("⚠️ Missing VITE_GOOGLE_API_KEY");
if (!OPENROUTER_API_KEY) console.warn("⚠️ Missing VITE_OPENROUTER_API_KEY");
if (!GROQ_API_KEY) console.warn("⚠️ Missing VITE_GROQ_API_KEY");

// 🧠 STATE & MEMORY
let lastAnalysis: { product: string, verdict: string } | null = null;

// ============================================================================
// 🧠 MODEL LISTS & PROVIDERS
// ============================================================================

// --- 1. GOOGLE GEMINI MODELS ---
const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY || "invalid_key");
const GEMINI_MODELS = [
    "gemini-2.0-flash-exp",           // 1. Experimental (Smartest/Newest)
    "gemini-2.0-flash-lite-preview-02-05", // 2. Lite Preview (Fastest)
    "gemini-1.5-flash",               // 3. Stable Flash
    "gemini-1.5-flash-8b",            // 4. Efficiency
    "gemini-1.5-pro"                  // 5. High Capability
];

// --- 2. OPENROUTER MODELS (10 Free + 10 Paid) ---
// Docs: https://openrouter.ai/docs/models
const OPENROUTER_MODELS = [
    // --- FREE TIER (Primary) ---
    "google/gemini-2.0-flash-exp:free",
    "google/gemini-2.0-flash-lite-preview-02-05:free",
    "google/gemini-2.0-pro-exp-02-05:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "deepseek/deepseek-r1:free",
    "deepseek/deepseek-v3:free",
    "qwen/qwen-2.5-vl-72b-instruct:free", // Vision capable
    "qwen/qwen-2.5-72b-instruct:free",
    "microsoft/phi-3-medium-128k-instruct:free",
    "mistralai/mistral-large-2411:free", // "mistral-nemo:free" was deprecated or less capable? Using robust free ones.

    // --- PAID / FALLBACK TIER (Reliable High Performance) ---
    "google/gemini-2.0-flash-001",
    "anthropic/claude-3.5-sonnet",
    "anthropic/claude-3-haiku",
    "openai/gpt-4o-mini",
    "openai/gpt-4o",
    "meta-llama/llama-3.2-90b-vision-instruct", // Vision
    "qwen/qwen-2.5-72b-instruct",
    "mistralai/mistral-large-latest",
    "cohere/command-r-plus-08-2024",
    "x-ai/grok-2-vision-1212"
];

// --- 3. GROQ MODELS (Fastest Fallback) ---
const GROQ_MODELS = [
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
    "mixtral-8x7b-32768",
    "gemma2-9b-it"
];

// ============================================================================
// 🛠️ UTILITIES
// ============================================================================

// 📉 Payload Optimizer
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
            resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.onerror = () => resolve(base64Str);
    });
};

function fileToGenerativePart(base64Data: string, mimeType: string = "image/jpeg"): Part {
    return {
        inlineData: {
            data: base64Data.split(',')[1],
            mimeType
        },
    };
}

// ============================================================================
// 🔄 PROVIDER FUNCTIONS
// ============================================================================

// 1. CALL GEMINI (GOOGLE AI STUDIO)
async function callGemini(
    promptParts: (string | Part)[],
    jsonMode: boolean,
    systemInstruction?: string
): Promise<{ content: string; model: string }> {
    if (!GOOGLE_API_KEY) throw new Error("No Google API Key");

    let lastError = "";
    for (const modelName of GEMINI_MODELS) {
        try {
            console.log(`🤖 [Gemini] Trying ${modelName}...`);
            const model = genAI.getGenerativeModel({
                model: modelName,
                systemInstruction,
                generationConfig: {
                    responseMimeType: jsonMode ? "application/json" : "text/plain",
                    temperature: 0.3,
                }
            });

            // 15s Timeout
            const resultPromise = model.generateContent(promptParts);
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 15000));

            const result: any = await Promise.race([resultPromise, timeoutPromise]);
            const response = await result.response;
            const text = response.text();

            if (!text) throw new Error("Empty Response");

            console.log(`✅ [Gemini] Success: ${modelName}`);
            return { content: text, model: `Gemini (${modelName})` };

        } catch (e: any) {
            console.warn(`❌ [Gemini] ${modelName} Failed:`, e.message);
            lastError = e.message;
            continue;
        }
    }
    throw new Error(`All Gemini Models Failed: ${lastError}`);
}

// 2. CALL OPENROUTER
async function callOpenRouter(
    promptText: string,
    imageBase64: string | null,
    jsonMode: boolean,
    systemInstruction?: string
): Promise<{ content: string; model: string }> {
    if (!OPENROUTER_API_KEY) throw new Error("No OpenRouter Key");

    // Prepare Messages
    const messages: any[] = [];
    if (systemInstruction) messages.push({ role: "system", content: systemInstruction });

    const userContent: any[] = [{ type: "text", text: promptText }];
    if (imageBase64) {
        userContent.push({
            type: "image_url",
            image_url: { url: imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}` }
        });
    }
    messages.push({ role: "user", content: userContent });

    let lastError = "";
    for (const modelName of OPENROUTER_MODELS) {
        try {
            // Skip vision models if using image, but trying to be smart about compatibility
            // For now, we just try them all. OpenRouter handles compatibility errors gracefully usually.

            console.log(`🦄 [OpenRouter] Trying ${modelName}...`);

            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://bitevue.app",
                    "X-Title": "BiteVue"
                },
                body: JSON.stringify({
                    model: modelName,
                    messages: messages,
                    response_format: jsonMode ? { type: "json_object" } : undefined,
                    temperature: 0.3
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errText}`);
            }

            const data = await response.json();
            const text = data.choices?.[0]?.message?.content;
            if (!text) throw new Error("Empty Response from OpenRouter");

            console.log(`✅ [OpenRouter] Success: ${modelName}`);
            return { content: text, model: `OpenRouter (${modelName})` };

        } catch (e: any) {
            console.warn(`❌ [OpenRouter] ${modelName} Failed:`, e.message);
            lastError = e.message;
            continue; // seamless switch
        }
    }
    throw new Error(`All OpenRouter Models Failed. Last: ${lastError}`);
}

// 3. CALL GROQ
async function callGroq(
    promptText: string,
    jsonMode: boolean,
    systemInstruction?: string
): Promise<{ content: string; model: string }> {
    if (!GROQ_API_KEY) throw new Error("No Groq Key");

    // Groq doesn't support images well yet via standard endpoint in this loop easily
    // We will assume Text-Only fallback for Groq for now or use Llama vision if supported
    // For safety, we only send text to Groq in this implementation to ensure success.

    const messages = [
        ...(systemInstruction ? [{ role: "system", content: systemInstruction }] : []),
        { role: "user", content: promptText }
    ];

    let lastError = "";
    for (const modelName of GROQ_MODELS) {
        try {
            console.log(`⚡ [Groq] Trying ${modelName}...`);
            const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${GROQ_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: modelName,
                    messages: messages,
                    response_format: jsonMode ? { type: "json_object" } : undefined,
                    temperature: 0.3
                })
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            const text = data.choices?.[0]?.message?.content;

            if (!text) throw new Error("Empty Response");

            console.log(`✅ [Groq] Success: ${modelName}`);
            return { content: text, model: `Groq (${modelName})` };
        } catch (e: any) {
            console.warn(`❌ [Groq] ${modelName} Failed:`, e.message);
            lastError = e.message;
            continue;
        }
    }
    throw new Error(`All Groq Models Failed: ${lastError}`);
}


// ============================================================================
// 🚀 ORCHESTRATOR: CALL AI WITH FALLBACK
// ============================================================================
async function callAIWithFallback(
    textPrompt: string,
    imageBase64: string | null = null,
    jsonMode: boolean = false,
    systemInstruction?: string
): Promise<{ content: string; model: string }> {

    let promptParts: (string | Part)[] = [textPrompt];

    // 1️⃣ TRY GEMINI (Google AI Studio)
    try {
        let geminiPrompt = [...promptParts];
        if (imageBase64) {
            const compressed = await compressImage(imageBase64);
            geminiPrompt.push(fileToGenerativePart(compressed));
        }
        return await callGemini(geminiPrompt, jsonMode, systemInstruction);
    } catch (e) {
        console.error("⚠️ Gemini Failed, Switching to OpenRouter...", e);
    }

    // 2️⃣ TRY OPENROUTER
    try {
        let imgForOr = imageBase64;
        if (imgForOr) {
            imgForOr = await compressImage(imgForOr);
        }
        return await callOpenRouter(textPrompt, imgForOr, jsonMode, systemInstruction);
    } catch (e) {
        console.error("⚠️ OpenRouter Failed, Switching to Groq...", e);
    }

    // 3️⃣ TRY GROQ (Text Only Fallback usually)
    try {
        // If we had an image, we append a note that image analysis failed
        let groqPrompt = textPrompt;
        if (imageBase64) {
            groqPrompt += "\n\n[Note: Image upload failed, please analyze based on text context only if possible.]";
        }
        return await callGroq(groqPrompt, jsonMode, systemInstruction);
    } catch (e) {
        console.error("❌ Groq Failed. All Providers Exhausted.");
        throw new Error("All AI Services Failed. Please try again later.");
    }
}


// ============================================================================
// 📦 EXPORTED FUNCTIONS (UPDATED TO USE ORCHESTRATOR)
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
You are BiteVue, an expert health analyzer.
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
  "followUpQuestions": ["Question 1?", "Question 2?", "Question 3?"],
  "sources_cited": ["Generic Knowledge"]
}
DO NOT RETURN MARKDOWN. DO NOT USE \`\`\`json. JUST RETURN RAW JSON.
${lastAnalysis ? `\nIMPORTANT: Compare this product to the previous scan "${lastAnalysis.product}" which was rated "${lastAnalysis.verdict}". State clearly if this is better or worse.` : ""}
`;

export const analyzeImageWithAI = async (base64Image: string, productName?: string, webIngredients: string = "", userIntent: string = "General Health"): Promise<AnalysisResult> => {
    const isBlankImage = base64Image.includes('iVBORw0KGgo');
    const hasIngredients = webIngredients && webIngredients.length > 20;

    // 🚀 DYNAMIC INTENT INFERENCE (Move 1 - Magic Trick)
    // If the image strongly suggests a specific category, we override the user's intent.
    let effectiveIntent = userIntent;

    // Quick heuristic: If "Baby" or "Infant" is cleared detected in OCR (webIngredients), switch to Safety.
    const lowerIng = webIngredients.toLowerCase();
    const lowerName = (productName || "").toLowerCase();
    const combinedText = lowerIng + " " + lowerName;

    if (combinedText.includes('baby') || combinedText.includes('infant')) {
        console.log("👶 Magic Trick: Auto-detected Baby Product. Switching Intent to 'Infant Safety'.");
        effectiveIntent = "Infant Safety & Allergens";
    }
    // Phase 1: Gym / Supplement Magic Trick
    else if (/(whey|creatine|protein|pre-workout|bcaa|glutamine|muscle|isolate|gym)/i.test(combinedText)) {
        console.log("💪 Magic Trick: Auto-detected Gym Product. Switching Intent to 'Muscle Building'.");
        effectiveIntent = "Muscle Building, Recovery & Digestibility";
    }
    // Phase 1: Pharma / Medicine Magic Trick
    else if (/(syrup|tablet|capsule|dosage|mg\/ml|relief|cough|cold|ibuprofen|paracetamol)/i.test(combinedText)) {
        console.log("💊 Magic Trick: Auto-detected Medicine. Switching Intent to 'Safety & Contraindications'.");
        effectiveIntent = "Medical Safety, Dosage & Contraindications";
    }

    const promptText = MASTER_PROMPT_TEXT(productName || "Unknown", webIngredients, effectiveIntent);

    // Decide if we send image or text only
    let imageToSend: string | null = base64Image;
    if (isBlankImage || hasIngredients) {
        console.log("ℹ️ Text-Only Mode (Ingredients Found or Blank Image)");
        imageToSend = null;
    } else {
        console.log("📸 Vision Mode");
    }

    const result = await callAIWithFallback(promptText, imageToSend, true);

    try {
        const cleanJson = result.content.replace(/```json\n?|\n?```/g, "").trim();
        const parsed = JSON.parse(cleanJson);

        if (!parsed.verdict) throw new Error("Invalid Schema");
        parsed.model_used = result.model; // Inject model name

        // Update Memory
        lastAnalysis = { product: productName || "Product", verdict: parsed.verdict };

        return parsed;
    } catch (e) {
        console.error("JSON Parse Error", result.content);
        throw new Error("Failed to parse Analysis JSON.");
    }
};

export const analyzeProductData = async (product: OFFProduct, userIntent: string = "General Health"): Promise<AnalysisResult> => {
    const summary = formatProductSummary(product);
    const prompt = `
    You are BiteVue. User Goal: "${userIntent}".
    Precise lab data provided:
    ${summary}
    Analyze thoroughly. Uncertainty MUST be 0.
    RETURN JSON ONLY.
    `;

    const result = await callAIWithFallback(prompt, null, true); // Text only
    const cleanJson = result.content.replace(/```json\n?|\n?```/g, "").trim();
    return { ...JSON.parse(cleanJson), model_used: result.model };
};

export const identifyProduct = async (base64Image: string): Promise<{ brand: string; product: string; link?: string }> => {
    const prompt = `Identify the Brand and Product Name from this image. 
    Return strictly in this format: "Brand - Product Name". 
    If unsure or generic, return "Unknown".`;

    const result = await callAIWithFallback(prompt, base64Image, false);
    const text = result.content.trim();

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

export const verifyProductIngredients = async (productName: string): Promise<string> => {
    const result = await callAIWithFallback(`Return the official ingredients list for "${productName}". Plain text only.`, null, false);
    return result.content || "";
};

export const chatWithProduct = async (
    productName: string,
    ingredients: string,
    chatHistory: { role: string; content: string }[],
    question: string
): Promise<string> => {

    const context = `Product: "${productName}". Ingredients: "${ingredients}". Answer accurately and concisely (<50 words).`;
    const historyText = chatHistory.map(m => `${m.role}: ${m.content}`).join('\n');
    const fullPrompt = `${context}\n\nHistory:\n${historyText}\n\nUser: ${question}`;

    const result = await callAIWithFallback(fullPrompt, null, false);
    return result.content;
};

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

    const result = await callAIWithFallback(fullPrompt, null, false, systemInstruction);
    return result.content;
};

export const chatWithNova = async (
    userQuery: string,
    history: { role: string; content: string }[] = []
): Promise<string> => {
    const systemInstruction = `You are an AI-native, voice-first food and beverage assistant designed to feel like a natural conversation partner (similar to Google Assistant or Alexa), not a chatbot.

CORE IDENTITY
- You are always-on, conversational, and context-aware.
- You remember the user’s preferences, dislikes, allergies, dietary patterns, past choices, and current mood within the session.
- You respond briefly by default, but can expand naturally when the user asks follow-ups.
- Your tone is friendly, calm, confident, and human-like — never robotic.

DOMAIN FOCUS
You specialize exclusively in:
- Food and beverage choices
- Ingredients and nutrition
- Health implications (non-medical, informational only)
- Taste profiles, cravings, mood-based eating
- Dietary preferences (vegetarian, vegan, Jain, halal, keto, etc.)
- Brand and product comparisons
- Cultural and regional food context (especially Indian foods)
- On-the-spot decision help (store, restaurant, café, home cooking)

Your goal is to help users make quick, informed decisions about what to eat or drink.
    
CRITICAL OUTPUT FORMAT:
1. Answer naturally (spoken).
2. At the very end, append exactly 2-3 short follow-up questions separated by a pipe symbol "|".
3. Format: [Spoken Answer] | [Chip 1] | [Chip 2]

Examples:
- User: "Is Coke healthy?"
- You: "Coke is very high in sugar and has no nutritional value. Regular consumption can lead to insulin spikes. | Is Diet Coke better? | Healthy soda alternatives"

TONE:
- Calm, confident, and slightly opinionated (like a nutritionist friend).
- Be concise. Voice interfaces require brevity.

VOICE-FIRST BEHAVIOR
- Speak as if responding through voice (short sentences, natural pauses implied).
- Avoid long lists unless explicitly requested.
- Ask ONE clarifying question at a time if needed.
- Never overload the user with information.

CONTINUITY & MEMORY
- Track and reuse information like:
  - “User prefers less sugar”
  - “User avoids caffeine at night”
  - “User likes spicy food”
- Reference past context naturally:
  - “Since you said you’re avoiding sugar…”
  - “Earlier you mentioned you prefer cold drinks…”

DECISION INTELLIGENCE
When helping choose food or drinks:
1. Infer intent without asking unnecessary questions.
2. Reduce cognitive effort — give a clear recommendation.
3. Explain the reason briefly and clearly.
4. Offer 1–2 alternatives max.

If uncertain, say so honestly and ask a short follow-up.

HEALTH & SAFETY
- Do NOT give medical advice or diagnoses.
- Frame health info as general guidance.
- Encourage moderation, balance, and awareness.

EXAMPLES OF EXPECTED BEHAVIOR

User: “What should I drink now?”
Assistant: “Since it’s evening and you usually avoid caffeine, a fresh lime soda or buttermilk would be a good choice. Feeling more like something sweet or refreshing?”

User: “Is this good or bad?”
Assistant: “It’s fine occasionally. It’s high in sugar, so I wouldn’t recommend it daily. If you want a lighter option, I can suggest one.”

User: “I feel like eating junk”
Assistant: “That usually means you want something salty or crunchy. A small portion is okay. If you want a healthier swap, roasted peanuts or popcorn works.”

FAIL-SAFE BEHAVIOR
- If the question is outside food and beverages, gently redirect:
  “I’m focused on food and drink decisions. Want help choosing something to eat or drink right now?”

GOAL
Your goal is to act like an intelligent food companion that helps users make better, easier food and beverage choices at the exact moment decisions matter — with zero friction and a seamless, assistant-like experience.
    `;

    const historyText = history.map(m => `${m.role}: ${m.content}`).join('\n');
    const fullPrompt = `History:\n${historyText}\n\nUser: ${userQuery}`;

    const result = await callAIWithFallback(fullPrompt, null, false, systemInstruction);
    return result.content;
};
