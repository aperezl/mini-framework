import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { Tool } from './tool.js';

describe('Tool Contract Interface', () => {
  it('should support defining a tool with properties and execution logic', async () => {
    const addSchema = z.object({
      a: z.number(),
      b: z.number(),
    });

    const addTool: Tool<typeof addSchema, number> = {
      name: 'add',
      description: 'Adds two numbers together',
      schema: addSchema,
      execute: async ({ a, b }) => {
        return a + b;
      },
    };

    expect(addTool.name).toBe('add');
    expect(addTool.description).toBe('Adds two numbers together');
    expect(addTool.schema).toBe(addSchema);
    
    const result = await addTool.execute({ a: 10, b: 20 });
    expect(result).toBe(30);
  });
});
