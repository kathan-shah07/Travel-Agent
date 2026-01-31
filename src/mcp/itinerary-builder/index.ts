
import { Tool } from '../../tool-manager/ToolManager';
import { ItineraryBuilderInputSchema, ItineraryBuilderOutputSchema } from '../schemas';
import Groq from "groq-sdk";
import dotenv from 'dotenv';

dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || "" });

export const ItineraryBuilderTool: Tool = {
    name: 'itinerary-builder',
    description: 'Generates a structured, day-wise itinerary based on candidate POIs and user constraints.',
    inputSchema: ItineraryBuilderInputSchema,
    outputSchema: ItineraryBuilderOutputSchema,
    execute: async (input) => {
        const { city, pois, daily_time_window, pace, trip_days, interests } = input;

        console.log(`[Itinerary Builder] Generating ${trip_days}-day interest-aware itinerary for ${city}...`);

        // Helper for Travel Calculation
        const getTravel = (p1: any, p2: any) => {
            if (!p1 || !p2 || !p1.location || !p2.location) {
                return { time: 20, dist: 5 }; // Default fallback
            }
            const R = 6371;
            const dLat = (p2.location.lat - p1.location.lat) * Math.PI / 180;
            const dLon = (p2.location.lng - p1.location.lng) * Math.PI / 180;
            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(p1.location.lat * Math.PI / 180) * Math.cos(p2.location.lat * Math.PI / 180) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            const dist = R * c;
            const time = Math.round((dist / 25) * 60) + 15; // 25km/h avg + 15m buffer
            return { time, dist: parseFloat(dist.toFixed(2)) };
        };

        const poiListStr = pois.map((p: any) =>
            `ID: ${p.poi_id} | Name: ${p.name} | Hours: ${p.opening_hours} | Lat: ${p.location.lat.toFixed(4)}, Lng: ${p.location.lng.toFixed(4)} | Type: ${p.types?.join(', ')}`
        ).join('\n');

        const prompt = `
            You are a Geographic-Aware Travel Expert. Create a ${trip_days}-day itinerary for ${city}.
            
            USER INTERESTS: ${interests.join(', ')}
            USER'S DAILY TIME WINDOW: ${daily_time_window} (This is when they're available for activities)
            
            AVAILABLE POIs (Pre-sorted by relevance):
            ${poiListStr}

            CONSTRAINTS:
            - **MANDATORY THEME**: Since user interests are [${interests.join(', ')}], at least 80% of the selected POIs MUST be directly related to these interests.
              * If interest is "food", prioritize food markets, restaurants, street food areas
              * If interest is "nightlife", prioritize night markets, bars, clubs, evening venues
              * If interest is "temples", prioritize religious sites
            
            - **RESPECT USER'S TIME WINDOW**: ${daily_time_window}
              * Parse this carefully: "09:00-00:00" means 9 AM to midnight (15 hours available!)
              * "09:00-21:00" means 9 AM to 9 PM (12 hours available)
              * If the window extends past 8 PM, you CAN and SHOULD schedule nightlife/evening activities
              * If the window ends at midnight (00:00), schedule late-night venues in the "Night" slot
            
            - **DUPLICATES**: Never repeat a POI. If you use a POI on Day 1, do NOT use it on Day 2.
            
            - **TOTAL DAYS**: You MUST generate exactly ${trip_days} days.
            
            - **GROUPING**: Group nearby POIs (check Lat/Lng) on the same day to minimize travel time.
            
            - **PACING**: ${pace} (${pace === 'relaxed' ? '1-2' : pace === 'moderate' ? '3-4' : '5+'} spots per day).
            
            - **NO FILLER**: Do not pick generic landmarks if interest-specific POIs are available in the candidate list.
            
            - **GRANULARITY**: REJECT any POI that represents an entire state, district, or region (e.g., "Karnataka", "Bangalore Urban District"). Only select specific, visitable places (e.g., "Lal Bagh", "Cubbon Park").
            
            - **HALLUCINATIONS**: Do not invent coordinates or POIs. Use only the provided list.
            
            - **CRITICAL - OPENING HOURS & TIMING**: 
              * Check the "Hours" field for each POI
              * If a POI shows hours like "18:00 - 23:00" (evening), schedule it for "Evening" or "Night", NOT "Morning" or "Afternoon"
              * If a POI shows "10:00 - 18:00", it can be scheduled for "Morning", "Afternoon", or "Evening" (before 18:00)
              * Food streets and night markets typically operate in the evening - schedule them accordingly
              * Temples and museums typically have daytime hours - schedule them in Morning or Afternoon
              * Match the time_of_day to when the POI is actually open AND when the user is available
              * EXAMPLE: If user's window is "09:00-00:00" and they want nightlife, you MUST include Evening/Night activities

            TIME OF DAY OPTIONS: 
            - "Morning" (6am-12pm) - Use for breakfast spots, temples, museums
            - "Afternoon" (12pm-5pm) - Use for lunch spots, gardens, sightseeing
            - "Evening" (5pm-9pm) - Use for sunset spots, early dinner, markets that open in evening
            - "Night" (9pm-12am) - Use for night markets, clubs, late-night food streets (ONLY if user's window allows)

            OUTPUT FORMAT (Respond in JSON format):
            { "days": [ { "day": 1, "blocks": [ { "time_of_day": "Morning", "poi_id": "poi_123", "poi_name": "Lal Bagh", "duration_min": 120 } ] } ] }
            (Do not output travel_time_min or travel_distance_km; they will be calculated separately).
        `;

        try {
            const completion = await groq.chat.completions.create({
                messages: [{ role: 'user', content: prompt }],
                model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
                // response_format: { type: "json_object" } // REMOVED
            });

            const content = completion.choices[0]?.message?.content || "{}";
            let result: any = {};

            try {
                const start = content.indexOf('{');
                const end = content.lastIndexOf('}');
                if (start !== -1 && end !== -1) {
                    result = JSON.parse(content.substring(start, end + 1));
                } else {
                    result = JSON.parse(content); // Try raw
                }
            } catch (e) {
                console.error("[ItineraryBuilder] JSON Parse failed:", e);
                // Fallback or empty
                result = { days: [] };
            }

            // Ensure schema compliance and REMOVE DUPLICATES
            if (result.days) {
                const seenPOIs = new Set<string>();

                for (const day of result.days) {
                    if (day.blocks) {
                        // Filter out duplicates
                        day.blocks = day.blocks.filter((block: any) => {
                            if (seenPOIs.has(block.poi_id)) {
                                console.warn(`[Itinerary Builder] Removed duplicate POI: ${block.poi_id}`);
                                return false;
                            }
                            seenPOIs.add(block.poi_id);
                            return true;
                        });

                        // Initialize travel fields
                        for (const block of day.blocks) {
                            block.travel_time_min = 0;
                            block.travel_distance_km = 0;
                        }
                    }
                }
            }

            return result;
        } catch (e: any) {
            console.error("[Itinerary Builder] Failed:", e.message);
            throw e;
        }
    }
};
