
import { z } from 'zod';
import {
    PoiSearchInputSchema, PoiSearchOutputSchema,
    ItineraryBuilderInputSchema, ItineraryBuilderOutputSchema,
    WeatherInputSchema, WeatherOutputSchema
} from '../mcp/schemas';

// Define a standardized Tool interface
export interface Tool<TInput = any, TOutput = any> {
    name: string;
    description: string;
    inputSchema: z.ZodSchema<TInput>;
    outputSchema: z.ZodSchema<TOutput>;
    execute(input: TInput): Promise<TOutput>;
}

export class ToolManager {
    private tools: Map<string, Tool> = new Map();

    registerTool(tool: Tool) {
        this.tools.set(tool.name, tool);
    }

    getTool(name: string): Tool | undefined {
        return this.tools.get(name);
    }

    async executeTool(name: string, input: any): Promise<any> {
        const tool = this.tools.get(name);
        if (!tool) {
            throw new Error(`Tool ${name} not found`);
        }

        console.log(`[ToolManager] Executing ${name} with inputs:`, JSON.stringify(input));

        // 1. Validate Input
        const parseResult = tool.inputSchema.safeParse(input);
        if (!parseResult.success) {
            throw new Error(`Invalid input for tool ${name}: ${JSON.stringify(parseResult.error.format())}`);
        }

        // 2. Invoke
        try {
            const result = await tool.execute(parseResult.data);

            // 3. Normalize/Validate Output (Optional but recommended)
            // We parse the output to ensure it adheres to contract, though tools *should* return valid data.
            // This acts as a firewall against bad tool implementations.
            const outputParse = tool.outputSchema.safeParse(result);
            if (!outputParse.success) {
                console.warn(`[ToolManager] Tool ${name} returned invalid output schema:`, outputParse.error);
                // We might choose to return raw result or error out. Architecture says "Normalize tool outputs".
                // Let's error strictly as per 'Engineering-ready'.
                throw new Error(`Tool ${name} output violation`);
            }

            return outputParse.data;
        } catch (e: any) {
            console.error(`[ToolManager] Execution failed for ${name}:`, e);
            throw e;
        }
    }
}
