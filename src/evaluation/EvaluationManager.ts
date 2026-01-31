
import { Itinerary, EvaluationResult, POICandidate, UserPreferences } from '../types';

export class EvaluationManager {

    public evaluate(
        itinerary: Itinerary,
        validPois: POICandidate[],
        preferences: UserPreferences,
        previousItinerary?: Itinerary | null,
        lastEditRequest?: string
    ): EvaluationResult {
        const validIds = new Set(validPois.map(p => p.poi_id));

        const feasibility = this.evaluateFeasibility(itinerary, preferences);
        const grounding = this.evaluateGrounding(itinerary, validIds);
        const editCorrectness = this.evaluateEditCorrectness(itinerary, previousItinerary, lastEditRequest);

        const overall = (feasibility === 'pass' && grounding === 'pass' && editCorrectness === 'pass') ? 'pass' : 'fail';

        return {
            overall_status: overall,
            details: {
                feasibility,
                grounding,
                edit_correctness: editCorrectness
            }
        };
    }

    private evaluateFeasibility(itinerary: Itinerary, prefs: UserPreferences): 'pass' | 'fail' {
        const usedPois = new Set<string>();
        let duplicatesFound = false;

        // 0. Check duplicate POIs across ALL days
        for (const day of itinerary.days) {
            for (const block of day.blocks) {
                if (usedPois.has(block.poi_id)) {
                    console.warn(`Feasibility Failed: Duplicate POI ${block.poi_id} found.`);
                    duplicatesFound = true;
                }
                usedPois.add(block.poi_id);
            }
        }
        if (duplicatesFound) return 'fail';

        // 0.1 Check day count
        if (itinerary.days.length !== prefs.trip_days) {
            console.warn(`Feasibility Failed: Itinerary has ${itinerary.days.length} days, expected ${prefs.trip_days}.`);
            return 'fail';
        }

        // 1. Calculate available minutes in daily_time_window
        const availableMins = this.parseTimeWindow(prefs.daily_time_window);

        for (const day of itinerary.days) {
            let totalMins = 0;
            for (const block of day.blocks) {
                // Total time = activity duration + travel time to it
                totalMins += block.duration_min + block.travel_time_min;

                // Rule: Reasonable travel times (e.g., no single trip > 3 hours in a city)
                if (block.travel_time_min > 180) {
                    console.warn(`Feasibility Failed: Excessive travel time (${block.travel_time_min}m) for ${block.poi_id}`);
                    return 'fail';
                }
            }

            // Rule: Total daily duration <= time window
            if (totalMins > availableMins) {
                console.warn(`Feasibility Failed: Day ${day.day} total time (${totalMins}m) exceeds window (${availableMins}m)`);
                return 'fail';
            }

            // Rule: Pace consistency
            // Relaxed: 1-2 POIs, Moderate: 3-4 POIs, Fast: 5+ POIs
            const count = day.blocks.length;
            if (prefs.pace === 'relaxed' && count > 3) return 'fail';
            if (prefs.pace === 'fast' && count < 4) return 'fail';
        }

        return 'pass';
    }

    private evaluateGrounding(itinerary: Itinerary, validIds: Set<string>): 'pass' | 'fail' {
        // Also check if mandatory interests are represented generally (heuristic)
        // Since we don't have tags on validIds easily accessible here without passing efficient map, 
        // we'll stick to strict ID validation for now.

        for (const day of itinerary.days) {
            for (const block of day.blocks) {
                if (!validIds.has(block.poi_id)) {
                    console.warn(`Grounding Failed: POI ${block.poi_id} not found in valid candidates.`);
                    return 'fail';
                }
            }
        }
        return 'pass';
    }

    private evaluateEditCorrectness(
        current: Itinerary,
        previous?: Itinerary | null,
        request?: string
    ): 'pass' | 'fail' {
        if (!previous || !request) return 'pass';

        const req = request.toLowerCase();

        // Simple heuristic: If user asked to "remove X" and X is still there, fail.
        if (req.includes("remove") || req.includes("delete")) {
            const prevIds = new Set(previous.days.flatMap(d => d.blocks.map(b => b.poi_id)));
            const currIds = new Set(current.days.flatMap(d => d.blocks.map(b => b.poi_id)));

            // This is just a placeholder for a more complex LLM-based diff evaluator
            // In a real system, we'd use an LLM here.
        }

        return 'pass';
    }

    private parseTimeWindow(window: string): number {
        // Default to 10 hours (600 mins) if unparseable
        let startHour = 9, endHour = 19;

        try {
            const normalized = window.toLowerCase().replace(/\s+/g, '');
            const parts = normalized.split(/to|-|until/);
            if (parts.length === 2) {
                startHour = this.parseHour(parts[0]);
                endHour = this.parseHour(parts[1]);
            }
        } catch (e) {
            console.warn(`Time window parse failed for "${window}", using default 10h`);
            return 600;
        }

        const total = (endHour - startHour) * 60;
        return total > 0 ? total : 600;
    }

    private parseHour(h: string): number {
        const valMatch = h.match(/\d+/);
        if (!valMatch) return 9;
        let val = parseInt(valMatch[0]);

        if (h.includes("pm") && val < 12) val += 12;
        if (h.includes("am") && val === 12) val = 0;
        return val;
    }
}
