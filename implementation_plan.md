# Implementation Plan: Travel-Voice-Agent (Revised)

## Phase 1: Environment & Project Setup
- [ ] Initialize Next.js 14 project (App Router, TypeScript, Tailwind).
- [ ] Setup folder structure: `/src/lib/mcp`, `/src/lib/rag`, `/src/lib/orchestrator`.
- [ ] Configure environment variables for:
    - `GROQ_API_KEY` (for fast orchestration/intent detection).
    - `GOOGLE_GENERATIVE_AI_API_KEY` (for RAG/Gemini logic).
    - `GOOGLE_MAPS_API_KEY` (for Places API).
- [ ] Install core dependencies: `langchain`, `chromadb`, `@google/generative-ai`, `groq-sdk`.

## Phase 2: Orchestration & State Management
- [ ] Implement `ConversationOrchestrator` using **Groq** for low-latency intent parsing.
- [ ] Build the `PreferenceManager` to track trip state (city, days, interests).
- [ ] Implement the 6-turn clarification logic and preference validation.

## Phase 3: MCP & External APIs Integration
- [ ] **POI Search Tool**: 
    - Integrate **Overpass API** for OSM-grounded locations.
    - Integrate **Google Maps Places API** for "nearby" search and richer POI metadata (ratings, photos).
- [ ] **Itinerary Builder Tool**: Develop the geographic grouping algorithm (TSP-lite) with pace constraints.

## Phase 4: RAG & Knowledge Base
- [ ] **Data Ingestion**: Scrape/Load Wikivoyage data for Jaipur, Bengaluru, and Goa.
- [ ] **Vector Store**: Setup **ChromaDB** locally to index the travel guides.
- [ ] **Explanation Engine**: Use **Gemini** to generate grounded explanations with citations from ChromaDB.

## Phase 5: Voice UI & Components
- [ ] Build the Chat Interface with voice-mode animations (Framer Motion).
- [ ] Implement Speech-to-Text (Browser Web Speech API or external provider).
- [ ] Build the Itinerary visualization cards and Sources/Citations sidebar.

## Phase 6: Automated Evaluation
- [ ] Implement `eval/feasibility.ts`: Duration and pace validation.
- [ ] Implement `eval/edit-correctness.ts`: Itinerary diffing logic.
- [ ] Implement `eval/grounding.ts`: Cross-referencing POIs with OSM/Places IDs.

## Phase 7: Deployment & Final Demo
- [ ] Deploy to Vercel/Netlify.
- [ ] Conduct final end-to-end testing of "Voice Planning" -> "Voice Edit" works.
