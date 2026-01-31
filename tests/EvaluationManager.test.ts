
import { EvaluationManager } from '../src/evaluation/EvaluationManager';
import { Itinerary, POICandidate } from '../src/types';

describe('EvaluationManager', () => {
    let evalManager: EvaluationManager;

    beforeEach(() => {
        evalManager = new EvaluationManager();
    });

    test('should fail grounding if POI is not in valid candidates', () => {
        const itinerary: Itinerary = {
            days: [{
                day: 1,
                blocks: [{ time_of_day: 'Morning', poi_id: 'unknown_id', duration_min: 60, travel_time_min: 30 }]
            }]
        };
        const validPois: POICandidate[] = [
            { poi_id: 'known_1', score: 1, name: 'Known Place' }
        ];

        const result = evalManager.evaluate(itinerary, validPois);
        expect(result.overall_status).toBe('fail');
        expect(result.details.grounding).toBe('fail');
    });

    test('should pass grounding if all POIs are valid', () => {
        const itinerary: Itinerary = {
            days: [{
                day: 1,
                blocks: [{ time_of_day: 'Morning', poi_id: 'known_1', duration_min: 60, travel_time_min: 30 }]
            }]
        };
        const validPois: POICandidate[] = [
            { poi_id: 'known_1', score: 1, name: 'Known Place' }
        ];

        const result = evalManager.evaluate(itinerary, validPois);
        expect(result.overall_status).toBe('pass');
        expect(result.details.grounding).toBe('pass');
    });
});
