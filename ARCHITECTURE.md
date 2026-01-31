# 1. System Objective (one-liner)

Build a **chat-based AI Travel Agent** that generates **grounded, evaluable, editable itineraries** for a single city (e.g. Bangalore) using **prefetched POI data**, **RAG**, and **MCP tools**, where **only evaluated itineraries are ever shown to users**.

---

# 2. High-level Architecture (mental map)

```
┌──────────────┐
│   Chat UI    │
└──────┬───────┘
       ↓
┌──────────────┐
│ Preference   │
│  Manager     │
└──────┬───────┘
       ↓
┌──────────────┐
│ Travel Agent │  ← Orchestration Brain
│ (Controller) │
└──────┬───────┘
       ↓
┌──────────────┐
│ Tool Manager │  ← MCP Client
└──────┬───────┘
       ↓
┌──────────────────────────┐
│ MCP Tools                │
│  • POI Search MCP        │
│  • Itinerary Builder MCP │
│  • Weather MCP           │
└──────────────┬───────────┘
               ↓
┌──────────────────────────┐
│ RAG Pipeline             │
│  • Vector DB             │
│  • Retriever             │
└──────────────┬───────────┘
               ↓
┌──────────────────────────┐
│ Reasoning Manager        │
└──────────────┬───────────┘
               ↓
┌──────────────────────────┐
│ Evaluation Manager       │
└──────────────┬───────────┘
               ↓
┌──────────────────────────┐
│ UI-Ready Itinerary State │
└──────────────┬───────────┘
               ↓
┌──────────────────────────┐
│ Cache / Storage / Export │
└──────────────────────────┘
```

---

# 3. Core Design Rules (non-negotiable)

1. **No itinerary is rendered unless all evals pass**
2. **All POIs must map to prefetched dataset IDs**
3. **All factual tips must come from RAG**
4. **Edits modify only affected sections**
5. **LLM never calls external APIs directly**
6. **MCP tools are the only execution boundary**

---

# 4. Component-by-Component Breakdown

## 4.1 Chat UI (Frontend)

### Responsibilities

* Conversational interface
* Shows itinerary only when state = `READY_FOR_UI`
* Displays sources & evaluation badge
* Allows chat-based edits
* **Real-time Preference Tags**: Updates user preference tokens immediately.

### UI States

```text
Idle
Collecting Preferences
Generating Itinerary
Evaluating Plan
Ready (Renderable)
Confirmed
```

### UI Must Never

* Show draft itineraries
* Show unevaluated content
* Invent explanations

---

## 4.2 Preference Manager

### Purpose

Collect, validate, and maintain **trip intent state**.

### Responsibilities

* Ask only missing preferences
* Update context incrementally
* Force user confirmation before planning
* Handle modification requests

### Required Preference Fields

```json
{
  "city": "Bangalore",
  "trip_days": 3,
  "daily_time_window": "09:00-20:00",
  "pace": "relaxed | moderate | fast",
  "interests": [],
  "constraints": {
    "indoor_preference": false,
    "mobility": "normal",
    "weather_sensitive": true
  },
  "confirmed": false
}
```

---

## 4.3 Travel Agent (Orchestration Layer)

**This is the brain of the system.**

### Responsibilities

* Owns itinerary lifecycle state
* Controls when tools are called
* Coordinates RAG, MCP, evals, and UI
* Prevents premature rendering

### Itinerary State Machine

```text
COLLECTING_PREFERENCES
GENERATING
EVALUATING
READY_FOR_UI
CONFIRMED
```

Only `READY_FOR_UI` is renderable.

---

## 4.4 Tool Manager (MCP Client)

### Purpose

Strict boundary between AI reasoning and execution.

### Responsibilities

* Validate tool inputs
* Invoke MCP tools
* Normalize tool outputs
* Reject unsafe calls

### MCP Contract Rules

* Deterministic inputs
* JSON-only outputs
* No prose
* No hallucinated fields

---

# 5. MCP Tools (Minimum Two Required)

## 5.1 POI Search MCP

### Data Sources

* **Google Maps**
* **Google Gemini (for city guides only)**
* **Wikipedia/Wikivoyage**

### Responsibilities

* Filter prefetched POIs
* Rank POIs based on preferences
* Return dataset IDs only
* **Geospatial Filter**: REJECTS any POI > 50km from city center to prevent geocoding errors.

### Input Schema

```json
{
  "city": "Bangalore",
  "interests": ["food", "heritage"],
  "constraints": {
    "indoor_preference": false,
    "max_travel_time_min": 45
  }
}
```

### Output Schema

```json
{
  "candidates": [
    {
      "poi_id": "blr_poi_1021",
      "score": 0.92
    }
  ]
}
```

---

## 5.2 Itinerary Builder MCP

### Responsibilities

* Allocate POIs to days
* Respect time windows & pace
* Compute travel time using Google Maps Distance Matrix
* No explanations
* **Deduplication**: Automatically filters out duplicate POIs to prevent feasibility failures.

### Input

```json
{
  "poi_ids": ["blr_poi_1021"],
  "daily_time_window": "09:00-20:00",
  "pace": "relaxed"
}
```

### Output

```json
{
  "days": [
    {
      "day": 1,
      "blocks": [
        {
          "time_of_day": "Morning",
          "poi_id": "blr_poi_1021",
          "duration_min": 120,
          "travel_time_min": 25
        }
      ]
    }
  ]
}
```

---

## 5.3 Weather MCP (Optional but recommended)

* Uses Open-Meteo
* Provides forecast summaries
* Used only for “what if it rains” explanations

---

# 6. RAG Pipeline

## 6.1 Ingested Content (Prefetch Phase)

* Gemini Search travel guides
* Wikipedia / Wikivoyage
* Area safety notes
* POI descriptions

## 6.2 Vector DB

* Stores: Chunked travel tips, area guidance, POI descriptions

## 6.3 Retrieval Usage

Used **only** for:
* Explanations
* Justifications
* Travel tips
* Safety & etiquette

### Rule

> If RAG does not retrieve it, the system must say it does not know.

---

# 7. Reasoning Manager

### Responsibilities

* Answer “Why this place?”
* Answer “Is this doable?”
* Answer “What if it rains?”

### Robustness Logic (Implemented)

* **Regex Rescue**: If LLM output fails JSON parsing (due to conversational monologue), specific fields ("why", "timing") are extracted via regex to ensure valid output.
* **Length Control**: Justifications are targeted at ~100 words for depth.

### Inputs

* Itinerary
* Retrieved RAG chunks

### Outputs

```json
{
  "answer": "Cubbon Park is included because...",
  "citations": ["rag_chunk_18", "rag_chunk_22"]
}
```

No citations → no answer.

---

# 8. Evaluation Manager (Mandatory)

## 8.1 Feasibility Evaluation

Rule-based:
* Total daily duration ≤ time window
* Travel time reasonable
* No overlaps

## 8.2 Edit Correctness Evaluation

* Hash compare unchanged days
* Only targeted sections modified

## 8.3 Grounding & Hallucination Evaluation

* POI IDs exist in dataset
* All tips cite RAG
* Missing data explicitly stated

### Evaluation Output

```json
{
  "overall_status": "pass",
  "details": {
    "feasibility": "pass",
    "grounding": "pass",
    "edit_correctness": "pass"
  }
}
```

Failure → regenerate affected section only.

---

# 9. UI-Ready Itinerary Payload

Frontend receives **only this**:

```json
{
  "state": "READY_FOR_UI",
  "itinerary": { ... },
  "evaluation_summary": {
    "feasibility": "pass",
    "grounding": "pass",
    "edit_correctness": "pass"
  },
  "sources_available": true
}
```

---

# 10. Persistence & Export

### Cache
* Draft itineraries
* Edit iterations

### Storage
* Confirmed itineraries only

### Export
* JSON (machine)
* PDF (human-readable)

Only `CONFIRMED` itineraries are exportable.

---

# 11. Final Directory Structure

```
/src
 ├─ api/                # Express Server
 ├─ ui/                 # Frontend (HTML/CSS/JS)
 ├─ orchestrator/       # TravelAgent.ts (State Machine)
 ├─ preference-manager/ # PreferenceManager.ts
 ├─ tool-manager/       # ToolManager.ts
 ├─ mcp/                # Tools
 │   ├─ poi-search/     # Wiki/Geocoding + Distance Filter
 │   ├─ itinerary-builder/ # Scheduling + Deduplication
 │   └─ weather/        # OpenMeteo
 ├─ rag/                # Vector Store
 ├─ reasoning/          # ReasoningManager (Regex Rescue)
 ├─ evaluation/         # EvaluationManager
 ├─ types/              # TS Interfaces
 └─ utils/              # PDF Generator
```

---

# 12. What This Architecture Gives You

* No hallucinated itineraries
* Deterministic edits
* Trustworthy explanations
* Clear separation of reasoning vs execution
* **Production-Grade robustness** (Deduplication, Geo-Filtering, JSON Rescue).

This is **production-grade AI system design**, not a demo.
