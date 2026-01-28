import { POI } from './overpass-client';
import { FullItinerary, DayItinerary, ItineraryBlock, Pace } from '../types';

export class ItineraryBuilder {
    private static PACE_LIMITS: Record<Pace, number> = {
        'relaxed': 3,
        'balanced': 4,
        'packed': 5,
    };

    /**
     * Builds a day-wise itinerary from a list of POIs using a greedy geographic grouping.
     */
    static build(pois: POI[], tripDays: number, pace: Pace): FullItinerary {
        const limitPerDay = this.PACE_LIMITS[pace];
        const totalNeeded = tripDays * limitPerDay;

        // Sort POIs by a heuristic (e.g., rating if available, or just take the first N)
        const candidates = pois
            .sort((a, b) => (b.user_ratings_total || 0) - (a.user_ratings_total || 0))
            .slice(0, totalNeeded);

        const days: DayItinerary[] = [];
        let remaining = [...candidates];

        for (let d = 1; d <= tripDays; d++) {
            if (remaining.length === 0) break;

            const dayBlocks: ItineraryBlock[] = [];

            // Start with the first remaining POI as the seed for the day
            let currentPOI = remaining.shift()!;
            dayBlocks.push(this.poiToBlock(currentPOI, 'morning'));

            // Find the next closest POIs for the same day
            for (let i = 1; i < limitPerDay; i++) {
                if (remaining.length === 0) break;

                // Find nearest neighbor
                let nearestIdx = 0;
                let minDist = Infinity;

                for (let j = 0; j < remaining.length; j++) {
                    const d = this.calculateDistance(currentPOI.lat, currentPOI.lon, remaining[j].lat, remaining[j].lon);
                    if (d < minDist) {
                        minDist = d;
                        nearestIdx = j;
                    }
                }

                currentPOI = remaining.splice(nearestIdx, 1)[0];
                const time: 'afternoon' | 'evening' = dayBlocks.length === 1 ? 'afternoon' : 'evening';
                dayBlocks.push(this.poiToBlock(currentPOI, time));
            }

            days.push({
                day: d,
                blocks: dayBlocks,
                estimated_travel_time_min: dayBlocks.length * 20, // Heuristic: 20 mins between stops
            });
        }

        return { days };
    }

    private static poiToBlock(poi: POI, time: 'morning' | 'afternoon' | 'evening'): ItineraryBlock {
        return {
            time,
            poi_id: poi.poi_id,
            name: poi.name,
            duration_min: poi.estimated_visit_duration_min,
            description: poi.category,
        };
    }

    private static calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371; // km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
}
