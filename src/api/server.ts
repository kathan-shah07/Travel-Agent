
// @ts-ignore
import express from 'express';
// @ts-ignore
import multer from 'multer';
import { TravelAgent } from '../orchestrator/TravelAgent';
import { CONFIG } from '../config/env';
import Groq from 'groq-sdk';
import fs from 'fs';
import path from 'path';

const app = express();
app.use(express.json());
app.use(express.static('src/ui')); // Serve static files from src/ui
app.use('/outputs', express.static('outputs')); // Serve generated PDFs

// Configure Multer for Audio Uploads
// @ts-ignore
const upload = multer({ dest: 'uploads/' });
const groq = new Groq({ apiKey: CONFIG.GROQ_API_KEY });

// Simple in-memory session store
const sessions: Record<string, TravelAgent> = {};

app.get('/status', (req: any, res: any) => {
    res.json({ status: 'running' });
});

app.post('/chat', async (req: any, res: any) => {
    console.log(`[POST /chat] Session: ${req.body.sessionId}, Message: "${req.body.message}"`);
    const { sessionId, message } = req.body;
    if (!sessionId || !message) {
        return res.status(400).json({ error: 'sessionId and message required' });
    }

    let agent = sessions[sessionId];
    if (!agent) {
        agent = new TravelAgent();
        sessions[sessionId] = agent;
        console.log(`Created new agent for session ${sessionId}`);
    }

    try {
        const response = await agent.handleMessage(message);
        res.json({ response });
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// Endpoint: Transcribe Audio (Voice -> Text)
// @ts-ignore
app.post('/api/transcribe', upload.single('audio'), async (req: any, res: any) => {
    try {
        if (!req.file) {
            res.status(400).json({ error: "No audio file provided" });
            return;
        }

        console.log(`[Server] Transcribing file: ${req.file.path} (${req.file.size} bytes)`);

        // Rename for Groq API (.wav extension)
        const tempPath = req.file.path;
        const targetPath = tempPath + '.wav';
        fs.renameSync(tempPath, targetPath);

        try {
            const transcription = await groq.audio.transcriptions.create({
                file: fs.createReadStream(targetPath),
                model: "whisper-large-v3",
                response_format: "json",
                language: "en",
                temperature: 0.0,
            });

            console.log(`[Server] Transcript: "${transcription.text}"`);
            res.json({ text: transcription.text });
        } finally {
            if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
        }

    } catch (error) {
        console.error("[Server] STT Error:", error);
        res.status(500).json({ error: "Transcription failed" });
    }
});

export const startServer = (port: number) => {
    // Ensure uploads dir exists
    if (!fs.existsSync('uploads')) {
        fs.mkdirSync('uploads');
    }

    // Ensure outputs dir exists
    if (!fs.existsSync('outputs')) {
        fs.mkdirSync('outputs');
    }

    app.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });
};
