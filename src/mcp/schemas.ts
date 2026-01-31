
import { z } from 'zod';

// 5.1 POI Search MCP
export const PoiSearchInputSchema = z.object({
    city: z.string(),
    interests: z.array(z.string()),
    constraints: z.object({
        indoor_preference: z.boolean().optional(),
        max_travel_time_min: z.number().optional(),
    }).optional(),
});

export const PoiCandidateSchema = z.object({
    poi_id: z.string(),
    score: z.number(),
    name: z.string().optional(),
    description: z.string().optional(),
    location: z.object({ lat: z.number(), lng: z.number() }).optional(),
});

export const PoiSearchOutputSchema = z.object({
    candidates: z.array(PoiCandidateSchema),
});


// 5.2 Itinerary Builder MCP
export const ItineraryBuilderInputSchema = z.object({
    city: z.string(),
    pois: z.array(z.any()), // Full POI objects
    interests: z.array(z.string()),
    daily_time_window: z.string(), // "09:00-20:00"
    pace: z.enum(['relaxed', 'moderate', 'fast']),
    trip_days: z.number(),
});

export const ItineraryBlockSchema = z.object({
    time_of_day: z.string(),
    poi_id: z.string(),
    poi_name: z.string().optional(),
    duration_min: z.number(),
    travel_time_min: z.number(),
    travel_distance_km: z.number().optional(),
});

export const ItineraryDaySchema = z.object({
    day: z.number(),
    blocks: z.array(ItineraryBlockSchema),
});

export const ItineraryBuilderOutputSchema = z.object({
    days: z.array(ItineraryDaySchema),
});


// 5.3 Weather MCP
export const WeatherInputSchema = z.object({
    city: z.string(),
    dates: z.array(z.string()).optional(), // ISO dates
});

export const WeatherOutputSchema = z.object({
    forecast: z.array(z.object({
        date: z.string(),
        summary: z.string(),
        rain_prob: z.number(),
    })),
});

// 5.4 Travel Time Estimator MCP
export const TravelTimeInputSchema = z.object({
    origin: z.object({ lat: z.number(), lng: z.number() }),
    destination: z.object({ lat: z.number(), lng: z.number() }),
    mode: z.enum(['driving', 'walking', 'transit']).optional(),
});

export const TravelTimeOutputSchema = z.object({
    travel_time_min: z.number(),
    distance_km: z.number(),
});
