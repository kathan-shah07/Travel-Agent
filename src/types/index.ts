
// 4.2 Preference Manager
export interface TripConstraints {
    indoor_preference: boolean;
    mobility: 'normal' | 'limited';
    weather_sensitive: boolean;
    max_travel_time_min?: number;
}

export interface UserPreferences {
    city: string;
    trip_days: number;
    daily_time_window: string; // e.g., "09:00-20:00"
    pace: 'relaxed' | 'moderate' | 'fast';
    interests: string[];
    constraints: TripConstraints;
    confirmed: boolean;
}

// 4.3 Travel Agent State
export enum AgentState {
    COLLECTING_PREFERENCES = 'COLLECTING_PREFERENCES',
    GENERATING = 'GENERATING',
    EVALUATING = 'EVALUATING',
    READY_FOR_UI = 'READY_FOR_UI',
    CONFIRMED = 'CONFIRMED'
}

// 5.1 POI Search MCP Output
export interface POICandidate {
    poi_id: string;
    score: number;
    name?: string; // Likely needed even if not in example
    description?: string; // Likely inferred
    location?: { lat: number; lng: number };
    opening_hours?: string; // Operating hours for scheduling
    types?: string[]; // POI types/categories
}

// 5.2 Itinerary Builder MCP Output
export interface ItineraryBlock {
    time_of_day: string; // "Morning", etc.
    poi_id: string;
    poi_name?: string; // Added for UI display
    duration_min: number;
    travel_time_min: number;
    travel_distance_km?: number;
}

export interface ItineraryDay {
    day: number;
    blocks: ItineraryBlock[];
}

export interface Itinerary {
    days: ItineraryDay[];
}

// 7. Reasoning Manager Output
export interface ReasoningResponse {
    answer: string;
    citations: string[]; // IDs of RAG chunks
}

// 8. Evaluation Manager Output
export interface EvaluationDetails {
    feasibility: 'pass' | 'fail';
    grounding: 'pass' | 'fail';
    edit_correctness: 'pass' | 'fail';
}

export interface EvaluationResult {
    overall_status: 'pass' | 'fail';
    details: EvaluationDetails;
}

// 9. UI-Ready Itinerary Payload
export interface UIReadyPayload {
    state: AgentState;
    itinerary: Itinerary;
    evaluation_summary: EvaluationDetails;
    justifications?: ReasoningResponse[];
    candidates: POICandidate[];
    sources_available: boolean;
    user_preferences?: {
        city: string;
        trip_days: number;
        daily_time_window: string;
        interests: string[];
        pace: string;
    };
}
