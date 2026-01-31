# Atlas AI Travel Agent 🌍✈️

An intelligent, multi-modal travel planning assistant that generates personalized, hour-by-hour itineraries. Features a premium glassmorphism UI, Voice Interaction (Speech-to-Text & TTS), reasoning capabilities, and PDF export.

---

## 🏗️ Architecture

The system follows a modular, agentic architecture powered by **LangChain** and **Model Context Protocol (MCP)** concepts.

### **Core Components**
1.  **Orchestrator (`TravelAgent.ts`)**:
    *   Manages conversation state and context.
    *   Routes user requests to appropriate tools (Search, Planner, Reasoning, PDF).
    *   Maintains a "Session" for multi-turn interactions.

2.  **API Server (Express - Port 3000)**:
    *   Unified backend handling both Chat (`/chat`) and Voice (`/api/transcribe`) endpoints.
    *   Serves the Frontend (`src/ui`).
    *   Handles file uploads (Audio) and Proxying.

3.  **Frontend (`src/ui`)**:
    *   **Tech**: Vanilla HTML/CSS/JS.
    *   **Design**: Glassmorphism, Responsive Mobile-First.
    *   **Features**:
        *   Text Chat & Voice Mode (Toggle).
        *   Dynamic Itinerary Rendering (Day/Time Cards).
        *   Real-time Preference Tags (City, Duration, Interests).
        *   Browser-based TTS (Text-to-Speech).

4.  **Storage**:
    *   **LanceDB**: Vector database for retrieving relevant context (RAG).
    *   **In-Memory**: Session storage for active chats.

### **MCP Tools (Model Context Protocol)**
The agent uses specialized tools to perform tasks:
*   **`poi-search`**: Retrieves Points of Interest/Attractions based on location and interests. Uses simulated geo-search/Wikipedia data.
*   **`itinerary-builder`**: Uses LLM (Llama 3 via Groq) to logically sequence activities into a feasible schedule (Day/Morning/Afternoon/Evening).
*   **`reasoning-engine`**: improved RAG-based engine that explains *Why* a specific place was chosen (History, Architecture, Relevance).
*   **`pdf-generator`**: Converts the JSON itinerary into a downloadable PDF.

---

## 🛠️ Setup & Installation

**Prerequisites**: Node.js (v18+), Groq API Key.

1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/your-repo/travel-agent.git
    cd travel-agent
    ```

2.  **Install Dependencies**:
    ```bash
    npm install
    # Ensure build tools are ready
    npm run build
    ```

3.  **Configuration**:
    *   Create a `.env` file in the root:
    ```env
    GROQ_API_KEY=gsk_...
    # Optional: Email service credentials
    EMAIL_USER=...
    EMAIL_PASS=...
    ```

4.  **Run the Agent**:
    ```bash
    npm start
    ```
    *   Server starts at `http://localhost:3000`.

---

## 📚 Datasets Referenced

The system uses a combination of Real-time and Static Knowledge:
1.  **Groq/Llama 3 Knowledge Base**: General world knowledge for city descriptions and common attractions.
2.  **Simulated POI Database**: A curated list of attractions (e.g., temples, parks in Bangalore) stored in `src/mcp/poi-search/data`.
3.  **Wikivoyage/Wikipedia**: Accessed via RAG (Retrieval Augmented Generation) to provide historical context and "Grounding" for the reasoning engine.

---

## 🧪 How to Run Evals

The system includes a test suite using **Jest** to validate the feasibility and logic of itineraries.

1.  **Run All Tests**:
    ```bash
    npm test
    ```
    *   **Unit Tests**: Validate POI distance calculations, JSON parsing.
    *   **Integration Tests**: Verify the full `Plan -> Itinerary` flow.

2.  **Manual Evaluation Cards**:
    *   In the UI, every generated itinerary displays two badges:
        *   **Feasibility**: (Pass/Fail) - Checks travel times and opening hours.
        *   **Grounding**: (Pass/Fail) - Checks if POIs exist and descriptions match sources.

---

## 📝 Sample Test Transcripts

### **Scenario 1: Weekend Trip**
**User**: "Plan a trip to Bangalore for 2 days."
**Agent**: "I can help with that! What are your interests? (e.g., Temples, Nature, Food)"
**User**: "Temples and Gardens."
**Agent**: [Generates Itinerary]
> *   **Day 1**: Lal Bagh (Morning), ISKCON Temple (Evening).
> *   **Day 2**: Cubbon Park (Morning), Bull Temple (Afternoon).
> *   **Reasoning**: "Lal Bagh is chosen for its morning serenity..."

### **Scenario 2: Detailed Inquiry**
**User**: "Why visit Kote Venkataramana Temple?"
**Agent**: "Kote Venkataramana Temple is a historically significant Hindu temple built in 1689... [100 words]... It aligns with your interest in architecture."

### **Scenario 3: Voice Mode**
**User**: (Click Mic) "Email this to test@example.com"
**Agent**: "Sending email to test@example.com..."
**User**: (Receives Email with PDF attachment).

---

## 🚀 Future Improvements
*   Real-time Google Maps Places API integration.
*   Uber/Ola deep linking for transport.
*   Multi-language voice support.

