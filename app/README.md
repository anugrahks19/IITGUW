# BiteVue (Powered by Nexus) 🧠🍎

**The AI-Native Food & Health Co-Pilot.**

BiteVue is not just a barcode scanner; it is a **reasoning engine** that overlays intelligence onto the physical world. It transforms static product data into actionable, voice-first health insights, acting as a personal nutritionist.

---

## 🔬 The Physics Behind It (How It Works)

BiteVue operates on a **Multimodal AI Pipeline** that fuses Computer Vision, Optical Character Recognition (OCR), and Large Language Models (LLMs) into a seamless "See-Think-Speak" loop.

### 1. The See-Think-Speak Loop
1.  **Sensory Input (The Eye):**
    *   **Barcode Scanning:** Uses `html5-qrcode` to capture EAN/UPC codes.
    *   **OpenFoodFacts API:** Fetches raw nutritional data (ingredients, nutriscore, additives).
    *   **Computer Vision (Nexus Eye):** If no barcode matches, the AI analyzes the live camera feed directly to identify packaging types (e.g., "Supplement Tub" vs. "Medicine Bottle").

2.  **Cognitive Processing (The Brain):**
    *   **Magic Intents (Pattern Matching):** Before even calling the LLM, the system runs heuristic regex checks.
        *   *Detected "Whey"?* -> Switches context to **Muscle Building**.
        *   *Detected "Syrup"?* -> Switches context to **Pharma Safety**.
    *   **LLM Analysis (OpenRouter/Groq):** The raw data + user context (e.g., "I am diabetic") is sent to a high-speed LLM (Gemini Flash or Llama 3).
    *   **Stateful Memory:** The system maintains a `lastAnalysis` state. It compares the current scan's vector against the previous one to generate comparative insights (e.g., *"This is better than the soda you just scanned"*).

3.  **Interaction (The Voice):**
    *   **Nexus Persona:** The AI response is synthesized into speech using the Web Speech API.
    *   **Visual Feedback:** The "Orb" changes color (Green=Healthy, Red=Avoid) based on sentiment analysis of the generated text, providing instant "lizard brain" feedback.

---

## 🚀 Key Features

### 1. 🧠 Magic Intents (Context Awareness)
BiteVue doesn't wait for you to ask. It infers your intent from the object itself.
*   **Gym Mode:** Scan a protein powder, and it instantly talks about amino acids and recovery.
*   **Safety Mode:** Scan a medicine, and it warns about dosage and allergies.

### 2. 💭 Comparative Memory
Most apps are "stateless" (they forget immediately). Nexus has **Object Permanence**.
*   It remembers your previous scan.
*   It actively compares products: *"This yogurt has less sugar than the bar you looked at earlier."*

### 3. 🗣️ AI-Native Voice Interaction
*   **Hands-Free:** Designed for the kitchen or grocery store.
*   **Silence Detection:** Smart listening that knows when you've finished speaking.
*   **Natural Conversation:** Ask follow-ups like *"Is it keto?"* or *"Any side effects?"* naturally.

---

## 🛠️ Technology Stack

*   **Frontend:** React 18, TypeScript, Vite
*   **AI Orchestration:** OpenRouter (Gemini / Llama 3), Groq (Fast Inference)
*   **Computer Vision:** `react-webcam`, Canvas API
*   **State Management:** React Hooks + Ref-based Memory
*   **Styling:** TailwindCSS, Framer Motion (Animations)
*   **Deployment:** Vercel (Edge Network)

---

> *"The goal is to move from 'Data Retrieval' to 'Cognitive Offloading'. We don't just show you the sugar content; we decide if it's worth eating."*
