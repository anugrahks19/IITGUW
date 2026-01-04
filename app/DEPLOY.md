# 🌍 Ultimate Guide: Hosting on Vercel (via GitHub)

This guide shows you how to host your app for free using the industry-standard method: **GitHub + Vercel**.

## ✅ Phase 1: Push Code to GitHub

Since `git` command line wasn't working, we will use **VS Code directly**, which has built-in Git support.

1.  **Open Source Control in VS Code**:
    *   Look at the Left Sidebar of VS Code.
    *   Click the icon that looks like a **Branch/Tree** (Source Control) or press `Ctrl + Shift + G`.

2.  **Initialize Repository**:
    *   You should see a button **"Initialize Repository"** or **"Publish to GitHub"**.
    *   Click **"Publish to GitHub"**.
    *   *If asked to allow VS Code to access GitHub, say Yes/Authorize.*

3.  **Select Privacy**:
    *   A dropdown will appear at the top.
    *   Select **"Publish to GitHub private repository"** (Recommended for safety) OR "public" (if you want to share code).
    *   Select all files if asked.

4.  **Wait for Upload**:
    *   VS Code will upload your code.
    *   Once done, a popup will say "Successfully published...". **Click "Open on GitHub"** to verify your code is there.

---

## 🚀 Phase 2: Connect Vercel to GitHub

Now that your code is online, we tell Vercel to watch it.

1.  **Go to [Vercel.com](https://vercel.com/signup)**.
    *   **Sign Up / Login** using **"Continue with GitHub"**.

2.  **Import Project**:
    *   On your Dashboard, click the **"Add New..."** button (usually white/black button on right).
    *   Select **"Project"**.
    *   You will see a list of your GitHub repos.
    *   Find your repo (e.g., `shelf-sense` or `app`) and click **"Import"**.

3.  **Configure Settings (Crucial Step!)**:
    You will see a "Configure Project" screen.
    *   **Framework Preset**: It should auto-detect **"Vite"**. If not, select it.
    *   **Root Directory**:
        *   If your code is inside an `app` folder, click "Edit" and select `app`.
        *   If `package.json` is in the root, leave as `./`.
        *   *(Based on your structure, ensure it points to where `package.json` is).*

4.  **Add Environment Variables (The Magic Key)**:
    *   Click to expand **"Environment Variables"**.
    *   Copy your API Key from your local `.env` file.
    *   **Name**: `VITE_GOOGLE_API_KEY`
    *   **Value**: `AIzaSy...` (Your full Google Key)
    *   Click **"Add"**.

5.  **Deploy**:
    *   Click the big **"Deploy"** button.

---

## 🎉 Phase 3: You're Live!

1.  Wait about 1–2 minutes. You'll see building logs.
2.  Once screens explode with confetti, click **"Visit"**.
3.  **Copy that URL** (e.g., `shelf-sense.vercel.app`) and send it to your phone.
4.  **Test**: Open it on your mobile browser (Chrome/Safari). Tap the Mic. It should work!

## 🔄 How to Update?
Just change code in VS Code, go to "Source Control" tab, type a message (e.g., "Fixed color"), and click **"Sync Changes"** or **"Push"**. Vercel detects it and updates your live site automatically!
