
// @ts-ignore
import express from 'express';
// @ts-ignore
import multer from 'multer';
import Groq from 'groq-sdk';
import fs from 'fs';
import path from 'path';
// @ts-ignore
import cors from 'cors';
import { CONFIG } from '../config/env';

// Initialize separate Voice UI Server on Port 3001
const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configure Multer for Audio Uploads
const upload = multer({ dest: 'uploads/' });

// Groq Client for STT
const groq = new Groq({ apiKey: CONFIG.GROQ_API_KEY });

// Endpoint: Transcribe Audio (Voice -> Text)
app.post('/api/transcribe', upload.single('audio'), async (req: any, res: any) => {
    try {
        if (!req.file) {
            res.status(400).json({ error: "No audio file provided" });
            return;
        }

        console.log(`[VoiceServer] Transcribing file: ${req.file.path} (${req.file.size} bytes)`);

        // Groq/OpenAI API requires a valid extension to detect file type.
        // Rename the temp file to include .wav extension.
        const tempPath = req.file.path;
        const targetPath = tempPath + '.wav';
        fs.renameSync(tempPath, targetPath);

        try {
            const transcription = await groq.audio.transcriptions.create({
                file: fs.createReadStream(targetPath),
                model: "whisper-large-v3", // Updated from decommissioned distil model
                response_format: "json",
                language: "en",
                temperature: 0.0,
            });

            console.log(`[VoiceServer] Transcript: "${transcription.text}"`);
            res.json({ text: transcription.text });
        } finally {
            // Cleanup temp file
            if (fs.existsSync(targetPath)) {
                fs.unlinkSync(targetPath);
            }
        }

    } catch (error) {
        console.error("[VoiceServer] STT Error:", error);
        res.status(500).json({ error: "Transcription failed" });
    }
});

// Endpoint: Proxy Chat to Main Agent (Port 3000)
app.post('/api/chat', async (req, res) => {
    try {
        const response = await fetch('http://localhost:3000/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error("[VoiceServer] Chat Proxy Error:", error);
        res.status(502).json({ error: "Failed to connect to Travel Agent" });
    }
});

// Serve the Voice UI
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🎙️ Voice UI Server running on http://localhost:${PORT}`);
});
