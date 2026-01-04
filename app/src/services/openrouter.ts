import { recognizeTextCloud } from './ocr-space';
import { formatProductSummary, type OFFProduct } from './openfoodfacts';

const API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;

// 🚀 OPENROUTER CONFIG
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const SITE_URL = window.location.origin;
const SITE_TITLE = "ShelfSense";

// 🧠 MODEL LIST (Vision Capable Mixed List)
const MODELS = [
    // 1. USER-REQUESTED FREE VISION MODELS (Gemma 3)
    "google/gemma-3-12b-it:free",
    "google/gemma-3-4b-it:free",
    "google/gemma-3n-4b-it:free",

    // 2. RELIABLE BACKUPS (Vision-Capable & Free)
    "google/gemini-2.0-flash-exp:free",
    "google/gemini-flash-1.5",

    // 3. FALLBACKS
    "meta-llama/llama-3.2-90b-vision-instruct:free",
    "qwen/qwen-2-vl-72b-instruct:free",
];

// ============================================================================
// 🧠 CACHE & UTILS
// ============================================================================

// Simple content hash for caching
const getCacheKey = (prompt: string): string => {
    let hash = 0, i, chr;
    if (prompt.length === 0) return hash.toString();
    for (i = 0; i < prompt.length; i++) {
        chr = prompt.charCodeAt(i);
        hash = ((hash << 5) - hash) + chr;
        hash |= 0; // Convert to 32bit integer
    }
    return `shelfSense_cache_${hash}`;
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 📉 Payload Optimizer (Resizes massive phone photos to avoid Timeouts)
const compressImage = async (base64Str: string, maxWidth = 800): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        // Ensure prefix
        img.src = base64Str.startsWith('data:') ? base64Str : `data:image/jpeg;base64,${base64Str}`;
        img.onload = () => {
            // Calculate new dimensions
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

            // Compression (0.7 quality is good compromise)
            resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        // If fail, return original
        img.onerror = () => resolve(base64Str);
    });
};

// ============================================================================
// ⚡ MAIN AI CALLER (OpenRouter -> Fail)
// ============================================================================
async function callBackend(
    messages: any[],
    _requireJson: boolean = false
): Promise<{ content: string; model: string } | null> {

    // 1️⃣ CACHE CHECK
    const cacheKey = getCacheKey(JSON.stringify(messages));
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
        console.log("⚡ Cache Hit!");
        return JSON.parse(cached);
    }

    if (!API_KEY) {
        throw new Error("Missing OpenRouter API Key in .env");
    }

    let errorLog: string[] = [];

    // 2️⃣ TRY MODELS IN ORDER
    for (const model of MODELS) {
        try {
            console.log(`🚀 OpenRouter Trying: ${model}...`);
            // DEBUG: Check Key (Masked)
            if (API_KEY) {
                console.log(`🔑 Using Key: ${API_KEY.substring(0, 8)}...`);
            } else {
                console.error("❌ NO API KEY FOUND");
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s Timeout

            const response = await fetch(OPENROUTER_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${API_KEY}`,
                    'HTTP-Referer': SITE_URL,
                    'X-Title': SITE_TITLE
                },
                body: JSON.stringify({
                    model: model,
                    messages: messages,
                    temperature: 0.2, // Low temp for factual analysis
                    top_p: 0.9,
                }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json();
                if (data.choices && data.choices[0] && data.choices[0].message) {
                    const content = data.choices[0].message.content;
                    console.log(`✅ Success with ${model}!`);
                    const result = { content: content, model: model };

                    // Cache success
                    try { localStorage.setItem(cacheKey, JSON.stringify(result)); } catch (e) { }
                    return result;
                }
            } else {
                const errText = await response.text();
                // 🛑 CRITICAL Log for Debugging
                console.error(`❌ ${model} ERROR ${response.status}:`, errText);

                // Specific Check for 401
                if (response.status === 401) {
                    console.error("🚨 401 UNAUTHORIZED: Please check VITE_OPENROUTER_API_KEY in .env. It might be invalid, expired, or have 0 credits.");
                }

                errorLog.push(`${model}: ${response.status} - ${errText.substring(0, 100)}`); // Store brief error

                // If 402 (Payment) stop immediately
                if (response.status === 402) {
                    throw new Error("OpenRouter Credits Exhausted");
                }
            }
        } catch (e: any) {
            console.warn(`${model} Error:`, e);
            errorLog.push(`${model}: ${e.message}`);
        }

        // Short delay between retries
        await delay(500);
    }

    // 3️⃣ FAILURE
    console.error("☠️ ALL AI MODELS FAILED");
    const uniqueErrors = errorLog.join(" | ");
    throw new Error(`All AI Models Failed. Details: ${uniqueErrors}`);
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

// 🔥 OPTIMIZED PROMPT
const MASTER_PROMPT = (productName: string, webIngredients: string, userIntent: string = "General Health") => `
You are ShelfSense, a shopping co-pilot. User Intent: "${userIntent}".
Context: Product="${productName || 'Unknown'}", Ingredients="${webIngredients || 'Not found'}".

TASK: Analyze health impact based on the visible data (Ingredients List or Nutrition Facts).
- If INGREDIENTS found: Focus on Ultra-Processed additives, chemicals, and allergen risks.
- If NUTRITION found: Focus on Sugar, Sodium, Saturated Fats, and Protein levels.
- If BOTH: Combine for a holistic verdict.

1. VERDICT: "HEALTHY", "MODERATE", "UNHEALTHY", or "AVOID".
2. EXPLAIN: 1-sentence "verdict_short" + "explanation".
3. TRADEOFFS: Pros/Cons.
4. UNCERTAINTY: Rate 0-100. *CONFIDENCE RULE: If you have valid ingredients, Uncertainty MUST be < 10%.*
5. SWAP: Suggest alternative if poor.

RETURN JSON ONLY:
{
  "verdict": "HEALTHY"|"MODERATE"|"UNHEALTHY"|"AVOID",
  "verdict_short": "Brief summary.",
  "score": 0-100,
  "explanation": "Friendly details.",
  "tradeoffs": { "pros": [], "cons": [] },
  "uncertainty": { "score": 0-100, "reason": "why" },
  "swap_suggestion": { "product_name": "Name", "reason_why": "Better because...", "savings": "e.g. Less sugar" } | null,
  "sources_cited": ["Generic ref"],
  "followUpQuestions": ["Q1", "Q2"]
}`;

// ============================================================================
export const analyzeImageWithAI = async (base64Image: string, productName?: string, webIngredients: string = "", userIntent: string = "General Health"): Promise<AnalysisResult> => {

    const isBlankImage = base64Image.includes('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=');
    const hasIngredients = webIngredients && webIngredients.length > 20;

    const prompt = MASTER_PROMPT(productName || "", webIngredients, userIntent);

    let result;

    if (isBlankImage || hasIngredients) {
        console.log("ℹ️ Text-Mode Analysis (Ingredients found or Blank Image)...");
        result = await callBackend(
            [{ role: "user", content: prompt }], // Plain text content
            true
        );
    } else {
        // 📸 VISION MODE
        console.log("📸 Vision Mode (Scanning Image)...");

        // 📉 Compress before sending!
        const compressedUrl = await compressImage(base64Image);

        // Try AI Vision
        result = await callBackend(
            [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: compressedUrl } }] }],
            true
        );
    }

    if (!result) {
        // Fallback: If AI returned null (all failed), throw.
        throw new Error("All AI Models failed to analyze the product.");
    }

    try {
        const cleanJson = result.content.replace(/```json\n?|\n?```/g, "").trim();
        const parsed = JSON.parse(cleanJson);
        return { ...parsed, model_used: result.model };
    } catch (e) {
        console.error("JSON Parse Error", result.content);
        throw new Error(`Failed to parse AI response from ${result.model}`);
    }
};


// ============================================================================
// 1.5 JSON ANALYSIS (OPENFOODFACTS -> LLM)
// ============================================================================
export const analyzeProductData = async (product: OFFProduct, userIntent: string = "General Health"): Promise<AnalysisResult> => {
    const summary = formatProductSummary(product);

    // Optimized Prompt for Data Analysis
    const prompt = `
    You are ShelfSense, a strict nutrition co-pilot. User Goal: "${userIntent}".
    I have precise lab data for this product:
    ${summary}

    TASK:
    1. Analyze the Nutritional Profile.
    2. Compare against the User's Goal.
    3. CONFIDENCE RULE: I have provided EXACT data. Uncertainty score MUST be 0. 
    4. Return valid JSON matching the schema (same as Vision analysis).
    5. Be specific: Quote the exact sugar amount or specific additives in your explanation.
    
    RETURN JSON ONLY.
    `;

    const result = await callBackend(
        [{ role: "user", content: prompt }],
        true
    );

    if (!result) throw new Error("AI analysis failed on data.");

    try {
        const cleanJson = result.content.replace(/```json\n?|\n?```/g, "").trim();
        const parsed = JSON.parse(cleanJson);
        return { ...parsed, model_used: `OFF-Data + ${result.model}` };
    } catch (e) {
        throw new Error("Failed to parse AI verdict.");
    }
};

// ============================================================================
// 2. PRODUCT IDENTIFICATION (VISION -> TEXT FALLBACK)
// ============================================================================
export const identifyProduct = async (base64Image: string): Promise<{ brand: string; product: string; link?: string }> => {
    const imageUrl = await compressImage(base64Image); // 📉 Compress here too
    let bestGuess = { brand: "", product: "", link: "" };

    // --- STRATEGY 1: DIRECT VISUAL RECOGNITION ---
    const directResult = await callBackend(
        [{
            role: "user",
            content: [
                { type: "text", text: `Identify Brand & Product Name. Return ONLY: "Brand - Product Name".` },
                { type: "image_url", image_url: { url: imageUrl } }
            ]
        }]
    );

    if (directResult) {
        const clean = directResult.content.replace(/[\*\"]/g, '').trim();
        if (clean.length > 3 && !clean.toLowerCase().includes('unknown')) {
            if (clean.includes('-')) {
                const [b, ...p] = clean.split('-');
                bestGuess = { brand: b.trim(), product: p.join('-').trim(), link: "" };
            } else {
                bestGuess = { brand: "", product: clean, link: "" };
            }
        }
    }

    // --- STRATEGY 2: IF FAILED, TRY OCR + TEXT DEDUCTION ---
    if (!bestGuess.product || bestGuess.product.toLowerCase().includes('unknown')) {
        console.log("🕵️ Switching to Strategy 2 (OCR)...");

        // OCR Request
        const ocrResult = await callBackend(
            [{
                role: "user",
                content: [
                    { type: "text", text: "Read all text on this package. Return raw text only." },
                    { type: "image_url", image_url: { url: imageUrl } }
                ]
            }]
        );

        const rawText = ocrResult?.content || "";

        if (rawText.length > 5) {
            const deductionResult = await callBackend(
                [{
                    role: "user",
                    content: `Text from package: "${rawText.slice(0, 500)}". Identify Brand - Product Name. Return string only.`
                }]
            );

            if (deductionResult) {
                const clean = deductionResult.content.replace(/[\*\"]/g, '').trim();
                if (clean.length > 3 && !clean.toLowerCase().includes('unknown')) {
                    if (clean.includes('-')) {
                        const [b, ...p] = clean.split('-');
                        bestGuess = { brand: b.trim(), product: p.join('-').trim(), link: "" };
                    } else {
                        bestGuess = { brand: "", product: clean, link: "" };
                    }
                } else {
                    bestGuess = { brand: "Scanned", product: rawText.slice(0, 80).replace(/\n/g, " "), link: "" };
                }
            }
        } else {
            // --- STRATEGY 3: CLOUD OCR ---
            try {
                console.log("⚠️ Engaging Cloud OCR...");
                const cloudText = await recognizeTextCloud(base64Image);
                if (cloudText && cloudText.length > 5) {
                    bestGuess = { brand: "", product: cloudText, link: "" };
                }
            } catch (e) { console.error(e); }
        }
    }

    if (bestGuess.product) {
        const query = `${bestGuess.brand} ${bestGuess.product} buy online`.trim();
        bestGuess.link = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        return bestGuess;
    }

    return { brand: "Unknown", product: "", link: "" };
};


// ============================================================================
// 3. INGREDIENT VERIFICATION (TEXT ONLY)
// ============================================================================
export const verifyProductIngredients = async (productName: string): Promise<string> => {
    // Check Cache for this simple query
    const cacheKey = `ing_cache_${productName.replace(/\s/g, '').toLowerCase()}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) return cached;

    const result = await callBackend(
        [{ role: "user", content: `Return official ingredients list for "${productName}". Plain text.` }]
    );

    if (result?.content) {
        localStorage.setItem(cacheKey, result.content);
    }

    return result?.content || "";
};


// ============================================================================
// 4. CHAT CO-PILOT (TEXT ONLY)
// ============================================================================
export const chatWithProduct = async (
    productName: string,
    ingredients: string,
    chatHistory: { role: string; content: string }[],
    question: string
): Promise<string> => {

    const systemContext = `
        You are a nutrition Co-Pilot. Product: "${productName}". Ingredients: "${ingredients}".
        Answer accurately, concisely (under 50 words). Be scientific but friendly.
    `;

    const messages = [
        { role: "system", content: systemContext },
        ...chatHistory,
        { role: "user", content: question }
    ];

    const result = await callBackend(messages);
    return result?.content || "I couldn't analyze that right now. Please try again.";
};

// ============================================================================
// 5. NIVU VOICE ASSISTANT (PERSONA)
// ============================================================================
export const chatWithNivu = async (
    userQuery: string,
    history: { role: string; content: string }[] = []
): Promise<string> => {

    const systemContext = `
        You are Nivu, a calm, human-like food decision co-pilot.
        
        CORE VOICE RULES:
        1. Speak in SHORT, confident sentences.
        2. First give a clear judgment (Good / Okay / Avoid).
        3. Then explain why it matters in this situation.
        4. Always mention uncertainty honestly.
        5. NEVER sound alarmist.
        
        TONE EXAMPLE:
        "This is fine once in a while, but not a daily habit. The concern here isn’t preservatives — it’s how your body processes refined carbs at night."

        CONTEXT:
        The user is speaking to you. No markdown. No lists. Just natural speech.
    `;

    const messages = [
        { role: "system", content: systemContext },
        ...history,
        { role: "user", content: userQuery }
    ];

    const result = await callBackend(messages);
    return result?.content || "I'm having trouble thinking clearly. Please try again.";
};
