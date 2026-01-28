import { POI } from './overpass-client';

export class GooglePlacesClient {
    private static API_KEY = process.env.GOOGLE_MAPS_API_KEY;

    static async getNearbyPlaces(lat: number, lon: number, radius: number = 500): Promise<Partial<POI>[]> {
        if (!this.API_KEY) return [];

        const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lon}&radius=${radius}&key=${this.API_KEY}`;

        try {
            const response = await fetch(url);
            const data = await response.json();

            return (data.results || []).map((place: any) => ({
                name: place.name,
                lat: place.geometry.location.lat,
                lon: place.geometry.location.lng,
                rating: place.rating,
                user_ratings_total: place.user_ratings_total,
                address: place.vicinity,
            }));
        } catch (error) {
            console.error('Google Places API error:', error);
            return [];
        }
    }

    /**
     * Enriches OSM POIs with Google Places data (Ratings/Reviews) via fuzzy name matching
     */
    static async enrichPOIs(pois: POI[]): Promise<POI[]> {
        if (!this.API_KEY) return pois;

        // To save API credits/time, we only enrich the top 10 POIs or those used in the itinerary
        const enriched = await Promise.all(
            pois.slice(0, 10).map(async (poi) => {
                const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(poi.name)}&inputtype=textquery&fields=rating,user_ratings_total,formatted_address&locationbias=circle:1000@${poi.lat},${poi.lon}&key=${this.API_KEY}`;

                try {
                    const res = await fetch(url);
                    const data = await res.json();
                    if (data.candidates && data.candidates[0]) {
                        const cand = data.candidates[0];
                        return {
                            ...poi,
                            rating: cand.rating,
                            user_ratings_total: cand.user_ratings_total,
                            address: cand.formatted_address,
                        };
                    }
                } catch (e) {
                    console.error(`Error enriching ${poi.name}:`, e);
                }
                return poi;
            })
        );

        return [...enriched, ...pois.slice(10)];
    }
}
