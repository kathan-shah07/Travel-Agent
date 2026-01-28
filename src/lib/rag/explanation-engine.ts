import { GoogleGenerativeAI } from "@google/generative-ai";
import { TravelVectorStore } from "./vector-store";
import { FullItinerary } from "../types";

export class ExplanationEngine {
    private static genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || "");

    static async explainItinerary(itinerary: FullItinerary, city: string): Promise<{ explanation: string; citations: { source: string; text: string }[] }> {
        const model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        // 1. Get relevant context from RAG
        const query = `Tourist attractions and transport in ${city}`;
        const docs = await TravelVectorStore.search(query, city, 5);
        const context = docs.map(d => d.pageContent).join("\n\n");

        // 2. Format the prompt
        const prompt = `
      You are a local travel expert for ${city}. 
      Below is a planned itinerary for a user:
      ${JSON.stringify(itinerary, null, 2)}

      Use the following factual context to explain why this itinerary is good and give some practical tips:
      ${context}

      Guidelines:
      - Be concise and helpful.
      - Mention specific places from the itinerary.
      - Include practical tips about transport or timing based on the context.
      - Provide a JSON response with 'explanation' (string) and 'citations' (array of {source, text}).
    `;

        try {
            const result = await model.generateContent(prompt);
            const response = result.response;
            const text = response.text();

            // Attempt to parse JSON from the response
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }

            return {
                explanation: text,
                citations: docs.map(d => ({ source: d.metadata.source, text: d.pageContent }))
            };
        } catch (error) {
            console.error("Gemini Error:", error);
            return {
                explanation: "I've generated this itinerary based on popular and geographically close locations in " + city + ". Enjoy your trip!",
                citations: []
            };
        }
    }
}
