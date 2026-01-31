# 🚀 Deployment Guide (Render.com)

This guide provides the exact configuration to deploy the Travel Agent using **Docker** on Render. This is the recommended method as it ensures all system dependencies are correctly installed.

## 📋 Step-by-Step Configuration

1.  **Dashboard**: Log in to [dashboard.render.com](https://dashboard.render.com/).
2.  **New Service**: Click **New +** -> **Web Service**.
3.  **Connect Repo**: Select your GitHub repository (`Travel-Agent`).

### **⚙️ Service Settings (Copy Exactly)**

| Setting | Value | Note |
| :--- | :--- | :--- |
| **Name** | `atlas-travel-agent` | Or any name you like |
| **Region** | `Singapore` (or nearest) | Choose closest to you |
| **Branch** | `main` | |
| **Root Directory** | **LEAVE BLANK** | ⚠️ **Critical**: Do not type `src` or `.` |
| **Runtime** | **Docker** | Select "Docker" (not Node) |
| **Instance Type** | **Free** | |

---

### **🐳 Docker Details**

If asked for specific Docker settings (usually auto-detected):
*   **Dockerfile Path**: `Dockerfile` (or `./Dockerfile`)
*   **Context Directory**: `.` (Current directory)

---

### **🔑 Environment Variables**

You **MUST** add your API keys for the app to work.
Scroll down to the **Environment Variables** section and add:

| Key | Value |
| :--- | :--- |
| `GROQ_API_KEY` | `gsk_...` (Your actual key) |
| `PORT` | `3000` (Optional, Render usually detects EXPOSE) |

---

### **🚀 Deploy**
1.  Click **Create Web Service**.
2.  Render will start building.
    *   It will pull the Node image.
    *   Install dependencies.
    *   Build the project.
3.  Wait ~3-5 minutes.
4.  Once you see `Server running on port 3000` in the logs, click the URL at the top!

### **Troubleshooting**
*   **"Dockerfile not found"**: Ensure **Root Directory** setting is **BLANK**. If you typed `./` in Root Directory, remove it.
*   **"Build Failed"**: Check the logs. If it says "out of memory", the Free tier might be struggling. Usually, this app is light enough.
