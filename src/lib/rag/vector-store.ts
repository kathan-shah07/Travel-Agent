import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { Document } from "@langchain/core/documents";
import knowledgeBase from "../../../data/knowledge-base.json";

export class TravelVectorStore {
    private static instance: MemoryVectorStore | null = null;

    static async getInstance(): Promise<MemoryVectorStore> {
        if (this.instance) return this.instance;

        const embeddings = new GoogleGenerativeAIEmbeddings({
            apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
            modelName: "embedding-001",
        });

        const docs = knowledgeBase.map(
            (item) =>
                new Document({
                    pageContent: `${item.city} - ${item.section}: ${item.text}`,
                    metadata: { city: item.city, section: item.section, source: "Wikivoyage" },
                })
        );

        this.instance = await MemoryVectorStore.fromDocuments(docs, embeddings);
        return this.instance;
    }

    static async search(query: string, city: string, k: number = 3): Promise<Document[]> {
        const store = await this.getInstance();
        // Filter to ensure we only get results for the specific city
        return await store.similaritySearch(query, k, {
            city: city,
        });
    }
}
