# BiteVue - Run Guide

BiteVue is an AI-powered food analyzer that helps you make healthier choices by scanning products and analyzing their ingredients using advanced AI models.

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js** (v18 or higher) installed.
- **OpenRouter API Key** (for AI analysis).

### 2. Installation
Open your terminal in this directory (`/app`) and run:
```powershell
npm install
```

### 3. Configuration
Create a `.env` file in the root directory if it doesn't exist:
```
VITE_OPENROUTER_API_KEY=your_api_key_here
```
> **Note**: The app uses a "Hybrid" AI approach. Basic commands work offline, but "Healthy?" checks require these keys.
> **Important**: If you see "AI models are busy" or get no response, your API key might be out of credits. Replace `VITE_OPENROUTER_API_KEY`, `VITE_GOOGLE_API_KEY`, or `VITE_GROQ_API_KEY` in `.env` with a new one from your account.

### 4. Running the App
Start the development server:
```powershell
npm run dev
```
Access the app at `http://localhost:5173` (or the URL shown in terminal).

---

## 📱 Features & Usage

### 1. Nexus Voice Assistant (Hands-Free) 🎙️
Nexus is your always-on AI co-pilot.
- **Activation**: Just say **"Hey Nexus"**.
- **Visuals**: A glowing orb appears in the bottom-left when listening.
- **Commands**:
  - *"Scan barcode"* -> Opens scanner.
  - *"Is this healthy?"* -> Analyzes current product with AI.
  - *"Go Home"* -> Resets to start screen.
  - *"Stop"* -> Silences the voice.

### 2. Barcode Scanner
- Point camera at any food barcode.
- App automatically fetches data from OpenFoodFacts.
- **Fallback**: If barcode fails, it asks you to take a photo of the front/ingredients.

### 3. Visual Scanner
- Take a photo of the **Front of Package** or **Ingredients Label**.
- The AI will OCR (read) the text and analyze the nutritional value.

### 4. AI Analysis
- Gives a verdict: **Healthy, Moderate, Unhealthy, or Avoid**.
- Explains *why* (e.g., "Contains High Fructose Corn Syrup").
- Suggests healthier alternatives.

---

## 🛠️ Troubleshooting

- **Microphone issues**: Ensure your browser has permission to access the Microphone. If Nexus isn't responding, look for a small red button in the corner to retry permissions.
- **AI Errors / "Busy"**: Check your network. If persistent, your API key is likely out of credits. Create a fresh key at OpenRouter.ai / Groq console and update `.env`.
- **Camera Black Screen**: Check if another app is using the camera. Refresh the page.
