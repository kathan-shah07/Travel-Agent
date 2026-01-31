
import { Tool } from '../../tool-manager/ToolManager';
import { TravelTimeInputSchema, TravelTimeOutputSchema } from '../schemas';

export const TravelTimeTool: Tool = {
    name: 'travel-time',
    description: 'Estimates travel time and distance between two geographic coordinates.',
    inputSchema: TravelTimeInputSchema,
    outputSchema: TravelTimeOutputSchema,
    execute: async (input) => {
        const { origin, destination, mode = 'driving' } = input;

        // Haversine distance formula
        const R = 6371; // Earth radius in km
        const dLat = (destination.lat - origin.lat) * Math.PI / 180;
        const dLon = (destination.lng - origin.lng) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(origin.lat * Math.PI / 180) * Math.cos(destination.lat * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;

        // Average speeds in km/h
        const speeds = {
            driving: 30, // City traffic average
            walking: 4.5,
            transit: 15
        };

        const speed = speeds[mode as keyof typeof speeds] || speeds.driving;
        const timeHours = distance / speed;
        // Add a "buffer" for traffic/stops (extra 10 mins)
        const timeMins = Math.round(timeHours * 60) + 10;

        return {
            distance_km: parseFloat(distance.toFixed(2)),
            travel_time_min: timeMins
        };
    }
};
