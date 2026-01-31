
import dotenv from 'dotenv';

dotenv.config();

export const CONFIG = {
    PORT: process.env.PORT || 3000,
    GROQ_API_KEY: process.env.GROQ_API_KEY || "",
    GROQ_MODEL: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    EMAIL: {
        USER: process.env.EMAIL_USER || "",
        PASS: process.env.EMAIL_PASS || ""
    }
};
