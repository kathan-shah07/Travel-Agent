import { City } from '../types';

export interface POI {
    poi_id: string; // OSM ID or Places ID
    name: string;
    category: string;
    lat: number;
    lon: number;
    rating?: number;
    user_ratings_total?: number;
    address?: string;
    estimated_visit_duration_min: number;
}

export class OverpassClient {
    private static CITY_COORDINATES: Record<City, { lat: number; lon: number; radius: number }> = {
        'Jaipur': { lat: 26.9124, lon: 75.7873, radius: 10000 },
        'Bengaluru': { lat: 12.9716, lon: 77.5946, radius: 15000 },
        'Goa': { lat: 15.2993, lon: 74.1240, radius: 30000 }, // Goa is larger
    };

    private static INTEREST_MAP: Record<string, string> = {
        'culture': 'tourism=museum,historic=monument,historic=castle,amenity=place_of_worship',
        'food': 'amenity=restaurant,amenity=cafe',
        'nature': 'leisure=park,tourism=viewpoint,leisure=nature_reserve',
        'shopping': 'shop=mall,amenity=marketplace',
        'temples': 'amenity=place_of_worship,religion=hindu',
        'beaches': 'natural=beach',
    };

    static async searchPOIs(city: City, interests: string[]): Promise<POI[]> {
        const coords = this.CITY_COORDINATES[city];
        const tags = interests
            .map(i => this.INTEREST_MAP[i.toLowerCase()])
            .filter(Boolean)
            .join(',');

        if (!tags) return [];

        // Simple Overpass query: find nodes/ways with specific tags within a radius of city center
        // We'll split the mapped tags back to individual types for the query
        const individualTags = tags.split(',').map(t => t.split('='));

        let queryParts = '';
        individualTags.forEach(([key, val]) => {
            queryParts += `node["${key}"="${val}"](around:${coords.radius},${coords.lat},${coords.lon});`;
            queryParts += `way["${key}"="${val}"](around:${coords.radius},${coords.lat},${coords.lon});`;
        });

        const query = `[out:json][timeout:25];(${queryParts});out center;`;

        try {
            const response = await fetch('https://overpass-api.de/api/interpreter', {
                method: 'POST',
                body: `data=${encodeURIComponent(query)}`,
            });

            const data = await response.json();

            return (data.elements || []).map((el: any) => ({
                poi_id: `osm:${el.type}:${el.id}`,
                name: el.tags.name || 'Unknown Attraction',
                category: el.tags.tourism || el.tags.amenity || 'attraction',
                lat: el.lat || el.center?.lat,
                lon: el.lon || el.center?.lon,
                estimated_visit_duration_min: 90, // Default heuristic
            })).filter((poi: POI) => poi.name !== 'Unknown Attraction');
        } catch (error) {
            console.error('Overpass API error:', error);
            return [];
        }
    }
}
