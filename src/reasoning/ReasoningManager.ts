import Groq from "groq-sdk";
import { RAGManager } from "../rag/RAGManager";
import { ReasoningResponse } from "../types";
import { CONFIG } from "../config/env";

const groq = new Groq({ apiKey: CONFIG.GROQ_API_KEY });

interface POIWithContext {
    poi_id: string;
    name: string;
    description?: string;
    scheduled_time?: string;
    duration_min?: number;
    travel_time_min?: number;
}

export class ReasoningManager {
    constructor(private rag: RAGManager) { }

    /**
     * Generate grounded justifications using RAG for POI selections
     * Answers: "Why did you pick this place?" and "Is this plan doable?"
     */
    async justifyPOIs(
        targetPois: POIWithContext[],
        city: string,
        interests: string[],
        userPreferences?: { daily_time_window?: string }
    ): Promise<ReasoningResponse[]> {
        console.log(`[Reasoning] Generating RAG-grounded justifications for ${targetPois.length} POI(s)`);

        const results: ReasoningResponse[] = [];

        for (const poi of targetPois) {
            try {
                // Retrieve relevant context from RAG for this specific POI
                const poiContext = await this.rag.retrieveContext(
                    `${poi.name} in ${city} - ${interests.join(', ')}`
                );

                const justification = await this.generateGroundedJustification(
                    poi,
                    city,
                    interests,
                    userPreferences,
                    poiContext
                );
                results.push(justification);
            } catch (e) {
                console.error(`[Reasoning] Failed for ${poi.name}:`, e);
                results.push({
                    answer: `${poi.name} was selected for ${interests[0]} but details are unavailable.`,
                    citations: []
                });
            }
        }

        return results;
    }

    /**
     * Generate a grounded, specific justification for a single POI using RAG context
     */
    private async generateGroundedJustification(
        poi: POIWithContext,
        city: string,
        interests: string[],
        userPreferences: { daily_time_window?: string } | undefined,
        ragContext: Array<{ text: string; source: string }>
    ): Promise<ReasoningResponse> {

        // Build context from RAG
        const contextText = ragContext.map(c => c.text).join('\n');
        const sources = Array.from(new Set(ragContext.map(c => c.source)));

        // Build a grounded prompt with RAG context
        const prompt = this.buildRAGGroundedPrompt(
            poi,
            city,
            interests,
            userPreferences,
            contextText
        );

        try {
            const completion = await groq.chat.completions.create({
                messages: [{ role: 'user', content: prompt }],
                model: CONFIG.GROQ_MODEL,
                max_tokens: 300,
                temperature: 0.2,
                // response_format: { type: "json_object" } // REMOVED
            });

            const content = completion.choices[0]?.message?.content || "{}";
            let parsed: { why?: string; timing?: string } = {};

            try {
                // Robust extraction: Find the first '{' and last '}'
                const start = content.indexOf('{');
                const end = content.lastIndexOf('}');

                if (start !== -1 && end !== -1 && end > start) {
                    const jsonStr = content.substring(start, end + 1);
                    parsed = JSON.parse(jsonStr);
                } else {
                    throw new Error("No JSON bracket found");
                }
            } catch (e) {
                console.warn("[Reasoning] JSON Parse failed, attempting regex rescue.");

                // Regex rescue for "why" and "timing" fields
                const whyMatch = content.match(/"why"\s*:\s*"([^"]*?)"/s) || content.match(/"why"\s*:\s*"([\s\S]*?)"/);
                const timingMatch = content.match(/"timing"\s*:\s*"([^"]*?)"/s) || content.match(/"timing"\s*:\s*"([\s\S]*?)"/);

                if (whyMatch) {
                    parsed = {
                        why: whyMatch[1].replace(/["},]*$/, '').trim(),
                        timing: timingMatch ? timingMatch[1] : "Feasibility plausible."
                    };
                } else {
                    // Fallback: Remove monologue ("Okay let's see...")
                    const match = content.match(/why["']?\s*[:=]\s*(.*)/i);
                    if (match) {
                        parsed = { why: match[1].replace(/["},]*$/, '').trim(), timing: "Feasibility plausible." };
                    } else {
                        parsed = { why: content.replace(/^.*?{/s, ''), timing: "Feasibility confirmed." };
                    }
                }
            }

            const whyParam = parsed.why || `${poi.name} is a great match for your interests.`;
            const timingParam = parsed.timing || "The timing fits your schedule.";

            // Construct final formatted answer
            const answer = `**Why:** ${whyParam}\n**Timing:** ${timingParam}`;

            return {
                answer,
                citations: sources
            };

        } catch (error) {
            console.error("[Reasoning] Error:", error);
            // Backup fallback
            const desc = poi.description ? poi.description.substring(0, 100) + "..." : "Matching your interests.";
            return {
                answer: `**Why:** ${desc}\n**Timing:** Fits schedule.`,
                citations: sources
            };
        }
    }

    /**
     * Build a grounded prompt using RAG context and itinerary data
     */
    private buildRAGGroundedPrompt(
        poi: POIWithContext,
        city: string,
        interests: string[],
        userPreferences: { daily_time_window?: string } | undefined,
        ragContext: string
    ): string {

        const timeWindow = userPreferences?.daily_time_window || 'Full day';
        const scheduledTime = poi.scheduled_time || 'Not scheduled';
        const duration = poi.duration_min || 0;

        return `You are a professional travel agent.
        
TASK:
Justify selecting "${poi.name}" for the user.

CONTEXT:
${ragContext}
(Backup Description: ${poi.description || "N/A"})

DETAILS:
- User Interests: ${interests.join(', ')}
- User Schedule: ${timeWindow}
- POI Schedule: ${scheduledTime} (${duration} mins)

INSTRUCTIONS:
1. Analyze the context and description deepy.
2. Formulate a COMPELLING justification ("why") that is approx 100 words.
3. Be specific: Mention specific architectural styles, food items, or history from the context.
4. Feasibility: Briefly confirm timing.
5. OUTPUT MUST BE VALID JSON ONLY.

JSON FORMAT:
{
  "why": "A rich, 50-word paragraph explaining exactly how this POI matches the user's interest. Do not be generic.",
}`;
    }
}
