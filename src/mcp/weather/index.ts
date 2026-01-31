
import { Tool } from '../../tool-manager/ToolManager';
import { WeatherInputSchema, WeatherOutputSchema } from '../schemas';

export const WeatherTool: Tool = {
    name: 'weather',
    description: 'Fetches weather forecast.',
    inputSchema: WeatherInputSchema,
    outputSchema: WeatherOutputSchema,
    execute: async (input) => {
        return {
            forecast: [
                {
                    date: new Date().toISOString().split('T')[0],
                    summary: 'Partly Cloudy',
                    rain_prob: 10
                }
            ]
        };
    }
};
