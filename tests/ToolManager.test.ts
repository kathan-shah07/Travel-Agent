
import { ToolManager, Tool } from '../src/tool-manager/ToolManager';
import { z } from 'zod';

describe('ToolManager', () => {
    let toolManager: ToolManager;

    const mockTool: Tool = {
        name: 'test-tool',
        description: 'a test tool',
        inputSchema: z.object({ name: z.string() }),
        outputSchema: z.object({ greeting: z.string() }),
        execute: async (input) => ({ greeting: `Hello ${input.name}` })
    };

    beforeEach(() => {
        toolManager = new ToolManager();
    });

    test('should register and execute a tool', async () => {
        toolManager.registerTool(mockTool);
        const result = await toolManager.executeTool('test-tool', { name: 'World' });
        expect(result.greeting).toBe('Hello World');
    });

    test('should throw error for invalid input', async () => {
        toolManager.registerTool(mockTool);
        await expect(toolManager.executeTool('test-tool', { age: 25 }))
            .rejects.toThrow(/Invalid input/);
    });

    test('should throw error for non-existent tool', async () => {
        await expect(toolManager.executeTool('ghost-tool', {}))
            .rejects.toThrow(/Tool ghost-tool not found/);
    });
});
