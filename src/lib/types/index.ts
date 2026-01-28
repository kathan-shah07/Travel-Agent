export type City = 'Jaipur' | 'Bengaluru' | 'Goa';
export type Pace = 'relaxed' | 'balanced' | 'packed';

export interface TripPreferences {
  city?: City;
  trip_days?: number;
  pace?: Pace;
  interests: string[];
  constraints: {
    avoid_long_travel: boolean;
    indoor_preferred: boolean;
  };
}

export interface ConversationState {
  status: 'collecting_preferences' | 'confirmed' | 'generating' | 'idle';
  clarification_count: number;
  preferences: TripPreferences;
  itinerary_version: number;
  history: { role: 'user' | 'assistant'; content: string }[];
}

export interface ItineraryBlock {
  time: 'morning' | 'afternoon' | 'evening';
  poi_id: string;
  name: string;
  duration_min: number;
  description?: string;
}

export interface DayItinerary {
  day: number;
  blocks: ItineraryBlock[];
  estimated_travel_time_min: number;
}

export interface FullItinerary {
  days: DayItinerary[];
}
