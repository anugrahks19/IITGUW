# How to Host Your App on Vercel

Follow these steps exactly to deploy your application without errors.

## 1. Prepare Your Code
We have already verified that your code builds successfully locally.
1.  **Commit and Push** all your changes to GitHub.
    *   If you are using VS Code, go to the Source Control tab, type a message (e.g., "Ready for deploy"), Commit, and Sync/Push.
    *   Ensure your GitHub repository has the latest code.

## 2. Connect Vercel to GitHub
1.  Go to [vercel.com](https://vercel.com) and Log In / Sign Up.
2.  On your **Dashboard**, click **"Add New..."** > **"Project"**.
3.  **Import Git Repository**:
    *   Find your repo (`IITGUW` or similar) in the list.
    *   Click **Import**.

## 3. Configure the Project (CRITICAL STEP)
You will see a "Configure Project" screen. **Do not click Deploy yet.** You must configure these settings:

### A. Framework Preset
*   It should automatically detect **Vite**. If not, select **Vite** from the dropdown.

### B. Root Directory
*   Click **Edit** next to Root Directory.
*   Select the `app` folder.
*   *Why?* Your standard `package.json` and code are inside the `app` folder, not the root of the repo.

### C. Environment Variables
*   Expand the **Environment Variables** section.
*   Copy and paste these values EXACTLY from your `.env` file (I have listed them below for convenience):

| Key | Value |
| :--- | :--- |
| `VITE_GOOGLE_API_KEY` | `AIzaSyAhp9uhLGDwpXT5fpoSiBlACB5tj8BOpy4` |
| `VITE_OCR_SPACE_KEY` | `helloworld` |
| `VITE_USE_LOCAL_LLM` | `false` |

*   **Add** each one individually.

## 4. Deploy
1.  Click **Deploy**.
2.  Wait for the build steps to complete.
3.  Vercel will show a success screen with a screenshot of your app.
4.  Click the domain link to view your live site!

## Troubleshooting "Black Screen"
If you see a black screen:
1.  Go to the Vercel Dashboard for your project.
2.  Click on the **Deployments** tab.
3.  Click the latest deployment.
4.  Look at the **Logs** tab. Any red errors here will tell us exactly what failed.
5.  Check the **Console** in your browser (F12 > Console) on the live site.
