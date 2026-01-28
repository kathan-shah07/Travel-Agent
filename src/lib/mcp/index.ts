import { OverpassClient, POI } from './overpass-client';
import { GooglePlacesClient } from './google-places-client';
import { ItineraryBuilder } from './itinerary-builder';
import { City, Pace, FullItinerary } from '../types';

export class MCPTools {
    /**
     * Main entry point for the "Generate Itinerary" flow.
     * 1. Searches OSM for candidate POIs.
     * 2. Enriches them via Google Places (ratings, etc).
     * 3. Builds the structured itinerary.
     */
    static async generateItinerary(
        city: City,
        interests: string[],
        tripDays: number,
        pace: Pace
    ): Promise<FullItinerary> {
        // Phase 1: Search POIs
        let pois = await OverpassClient.searchPOIs(city, interests);

        // Phase 2: Enrich with Google Places data (optional but recommended)
        if (pois.length > 0) {
            pois = await GooglePlacesClient.enrichPOIs(pois);
        }

        // Phase 3: Build the itinerary
        return ItineraryBuilder.build(pois, tripDays, pace);
    }
}

export * from './overpass-client';
export * from './google-places-client';
export * from './itinerary-builder';
