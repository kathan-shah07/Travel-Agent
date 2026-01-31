
import * as lancedb from "@lancedb/lancedb";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "@langchain/core/documents";
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

export class RAGManager {
    private dbDir: string;
    private tableName = "travel_context";
    private extractor: any = null;

    constructor() {
        this.dbDir = process.env.LANCEDB_DIR || path.join(process.cwd(), 'src/data/lancedb');
        if (!fs.existsSync(this.dbDir)) {
            fs.mkdirSync(this.dbDir, { recursive: true });
        }
    }

    private async getExtractor() {
        if (!this.extractor) {
            const { pipeline } = await import('@xenova/transformers');
            this.extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
        }
        return this.extractor;
    }

    private async embed(text: string): Promise<number[]> {
        const extractor = await this.getExtractor();
        const output = await extractor(text, { pooling: 'mean', normalize: true });
        return Array.from(output.data);
    }

    async ingestCityData(city: string) {
        const normalizedPath = path.join(process.cwd(), 'src/data', `${city.toLowerCase()}_normalized_poi.json`);
        const contextPath = path.join(process.cwd(), 'src/data', `${city.toLowerCase()}_context.txt`);

        const chunks: Document[] = [];
        const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 600, chunkOverlap: 60 });

        // 1. Ingest POIs
        if (fs.existsSync(normalizedPath)) {
            const pois = JSON.parse(fs.readFileSync(normalizedPath, 'utf-8'));
            for (const poi of pois) {
                chunks.push(new Document({
                    pageContent: `POI: ${poi.name}. Type: ${poi.types?.join(', ')}. Description: ${poi.description}`,
                    metadata: { source: 'Wikipedia', poi_id: poi.poi_id, city }
                }));
            }
        }

        // 2. Ingest City Context
        if (fs.existsSync(contextPath)) {
            const contextText = fs.readFileSync(contextPath, 'utf-8');
            const cityChunks = await splitter.createDocuments([contextText], [{ source: 'Wikipedia/Wikivoyage', city }]);
            chunks.push(...cityChunks);
        }

        console.log(`[RAG] Ingesting ${chunks.length} total chunks for ${city}...`);

        try {
            const db = await lancedb.connect(this.dbDir);
            const dataToInsert = [];
            for (const chunk of chunks) {
                const vector = await this.embed(chunk.pageContent);
                dataToInsert.push({
                    vector: vector,
                    text: chunk.pageContent,
                    source: chunk.metadata.source,
                    city: chunk.metadata.city,
                    poi_id: chunk.metadata.poi_id || 'general'
                });
            }

            let table;
            const tableNames = await db.tableNames();
            if (tableNames.includes(this.tableName)) {
                table = await db.openTable(this.tableName);
                await table.add(dataToInsert);
            } else {
                table = await db.createTable(this.tableName, dataToInsert);
            }
        } catch (e) {
            console.error("[RAG] Ingestion failed:", e);
        }
    }

    async retrieveContext(query: string): Promise<{ text: string, source: string }[]> {
        try {
            const db = await lancedb.connect(this.dbDir);
            const table = await db.openTable(this.tableName);
            const queryVector = await this.embed(query);

            const results = await table
                .vectorSearch(queryVector)
                .limit(4)
                .toArray();

            return results.map((r: any) => ({
                text: r.text,
                source: r.source
            }));
        } catch (err) {
            console.error("[RAG] Retrieval failed:", err);
            return [];
        }
    }
}
