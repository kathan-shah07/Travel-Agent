
import Groq from "groq-sdk";
import { UserPreferences, TripConstraints } from '../types';
import dotenv from 'dotenv';

dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || "" });

export class PreferenceManager {
    private defaultConstraints: TripConstraints = {
        indoor_preference: false,
        mobility: 'normal',
        weather_sensitive: true,
    };

    public getInitialPreferences(): UserPreferences {
        return {
            city: '',
            trip_days: 0,
            daily_time_window: '',
            pace: 'moderate',
            interests: [],
            constraints: { ...this.defaultConstraints },
            confirmed: false,
        };
    }

    public getMissingFields(prefs: UserPreferences): string[] {
        const missing: string[] = [];
        if (!prefs.city) missing.push('city');
        if (!prefs.trip_days || prefs.trip_days <= 0) missing.push('trip_days');
        if (!prefs.daily_time_window) missing.push('daily_time_window');
        if (!prefs.interests || prefs.interests.length === 0) missing.push('interests');
        return missing;
    }

    /**
     * Use Groq to extract preferences from user message.
     */
    public async updatePreferences(
        current: UserPreferences,
        userMessage: string
    ): Promise<UserPreferences> {
        if (!process.env.GROQ_API_KEY) {
            console.warn("GROQ_API_KEY not found. Falling back to heuristic extraction.");
            return this.heuristicExtraction(current, userMessage);
        }

        const prompt = `
      You are an AI Travel Assistant. Your task is to extract travel preferences from the user's message.
      
      Current Preferences:
      ${JSON.stringify(current, null, 2)}
      
      User Message: "${userMessage}"
      
      Extract and update fields: city, trip_days, daily_time_window, pace, interests, constraints.
      
      CRITICAL INSTRUCTIONS:
      1. **daily_time_window**: Convert to 24-hour format (HH:MM-HH:MM)
         - "9 am to 6 pm" → "09:00-18:00"
         - "9 am to 12 am" → "09:00-00:00" (midnight is 00:00)
         - "9 am to 9 pm" → "09:00-21:00"
         - If user says "12 am", they mean midnight (00:00), NOT noon
      
      2. **interests**: Extract ALL interests mentioned, normalize to lowercase
         - "nightlife and food" → ["nightlife", "food"]
         - "temples, gardens" → ["temples", "gardens"]
         - Append to existing interests, don't replace
      
      3. **trip_days**: Must be a number
         - "1 day" → 1
         - "3 days" → 3
      
      4. **city**: Capitalize properly
         - "ahmedabad" → "Ahmedabad"
         - "bangalore" → "Bangalore"
      
      - Return ONLY a valid JSON object representing the updated preferences.
      - Do not change existing fields unless the user explicitly corrects them.
    `;

        try {
            const chatCompletion = await groq.chat.completions.create({
                messages: [{ role: 'user', content: prompt }],
                model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
                response_format: { type: "json_object" }
            });

            const text = chatCompletion.choices[0]?.message?.content || "{}";
            const extracted = JSON.parse(text);

            return { ...current, ...extracted };
        } catch (e) {
            console.error("Groq Extraction failed:", e);
            return this.heuristicExtraction(current, userMessage);
        }
    }

    private heuristicExtraction(current: UserPreferences, message: string): UserPreferences {
        const updates: Partial<UserPreferences> = {};
        const msg = message.toLowerCase();

        if (msg.includes("bangalore")) updates.city = "Bangalore";
        if (msg.includes("3 days")) updates.trip_days = 3;
        if (msg.includes("9am")) updates.daily_time_window = "09:00-20:00";
        if (msg.includes("food")) updates.interests = [...(current.interests || []), "food"];

        return { ...current, ...updates };
    }

    public getNextQuestion(prefs: UserPreferences): string {
        const missing = this.getMissingFields(prefs);
        if (missing.length === 0) {
            if (!prefs.confirmed) {
                return "I have all the details for your trip to " + prefs.city + ". Shall I proceed to generate the itinerary?";
            }
            return "Generating your itinerary...";
        }

        if (missing.includes('city')) return "Which city are you planning to visit?";
        if (missing.includes('trip_days')) return "How many days is your trip?";
        if (missing.includes('daily_time_window')) return "What are your preferred start and end times each day? (e.g., 9 AM to 6 PM)";
        if (missing.includes('interests')) return "What are your interests? (e.g., temples, gardens, nightlife, shopping)";

        return "Could you provide more details?";
    }
}
