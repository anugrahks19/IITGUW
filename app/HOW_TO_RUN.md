# How to Run BiteVue (Nexus) 🏃‍♂️📱

BiteVue is built with React, Vite, and Modern AI APIs. Follow these steps to run it locally and test the "AI-Native" experience on your phone.

---

## 1. Prerequisites 📋
Ensure you have the following installed:
*   **Node.js** (v18 or higher)
*   **npm** (comes with Node.js)

---

## 2. Installation 💿
Open your terminal in the project folder and run:

```bash
npm install
```
This installs all dependencies (React, Framer Motion, GenAI SDK, etc.).

---

## 3. Environment Setup 🔑
You need API keys for the AI brains.
1.  Create a file named `.env` in the root folder.
2.  Add your keys:

```env
VITE_GOOGLE_API_KEY=your_gemini_key_here
VITE_OPENROUTER_API_KEY=your_openrouter_key_here
VITE_GROQ_API_KEY=your_groq_key_here
```

---

## 4. Running the App (Crucial Step!) 🚀
To test the **Camera** and **Voice** features on your phone, you must expose the app to your local network.

Run this command:
```bash
npm run dev -- --host
```

You will see output like this:
```
  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.1.5:5173/  <-- USE THIS ONE!
```

---

## 5. Testing on Mobile 📲
**IMPORTANT:** Modern browsers block Camera/Microphone access on insecure (HTTP) connections *unless* it's `localhost`. Since you are accessing via Network IP (e.g., `192.168.x.x`), you might face issues.

**Workarounds:**
1.  **Android (Chrome):** Go to `chrome://flags/#unsafely-treat-insecure-origin-as-secure`, add your `http://192.168.x.x:5173`, enable it, and relaunch Chrome.
2.  **Best Option:** Use a tunneling tool like **ngrok** for a real HTTPS link:
    ```bash
    npx ngrok http 5173
    ```
    Then open the `https://...` link on your phone.

**Why Mobile?**
*   The scanner is optimized for phone cameras.
*   Voice interaction feels natural on a handheld device.

Enjoy the AI-Native experience! 🍎🤖
