# 🚀 Deployment Guide

This guide explains how to deploy the Travel Agent to **Render.com** (Free Tier).

## Option 1: Render (Recommended)

Render offers a free "Web Service" tier that can run Node.js/Docker apps.

### **Steps:**

1.  **Push to GitHub**:
    *   Make sure this code is pushed to a GitHub repository.

2.  **Sign up for Render**:
    *   Go to [dashboard.render.com](https://dashboard.render.com/) and login with GitHub.

3.  **Create New Web Service**:
    *   Click **"New +"** -> **"Web Service"**.
    *   Select your repository.

4.  **Configure Settings**:
    *   **Name**: `travel-agent`
    *   **Environment**: `Node`
    *   **Build Command**: `npm install && npm run build`
    *   **Start Command**: `npm start`
    *   **Plan**: Free

5.  **Environment Variables (Important)**:
    *   Scroll down to **"Environment Variables"**.
    *   Add Key: `GROQ_API_KEY`
    *   Value: `your_groq_api_key_here` (Copy from your local .env)

6.  **Deploy**:
    *   Click **"Create Web Service"**.
    *   Wait 2-3 minutes. Render will build and start your app.

### **Done!** 🌍
Render will give you a URL (e.g., `https://travel-agent.onrender.com`).
Open it in your browser to start planning trips!

---

## ⚠️ Important Note on Data
*   The free tier of Render has an **Ephemeral Filesystem**.
*   This means **Voice Uploads** and the **LanceDB (Vector DB)** will be reset every time the server restarts (spin-down).
*   For a hackathon demo, this is fine (it will just rebuild the relevant context index on the fly or start fresh).
*   For production, you would need to use a persistent disk (Paid feature) or cloud storage (S3).
