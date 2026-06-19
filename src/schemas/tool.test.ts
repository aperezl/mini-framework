import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { Tool, executeTool } from './tool';

describe('Tool Contract Interface', () => {
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

  it('should support defining a tool with properties and execution logic', async () => {
    expect(addTool.name).toBe('add');
    expect(addTool.description).toBe('Adds two numbers together');
    expect(addTool.schema).toBe(addSchema);
    
    const result = await addTool.execute({ a: 10, b: 20 });
    expect(result).toBe(30);
  });

  it('should successfully execute a tool with valid params using executeTool wrapper', async () => {
    const result = await executeTool(addTool, { a: 100, b: 200 });
    expect(result).toBe(300);
  });

  it('should throw validation error when executing with invalid params using executeTool wrapper', async () => {
    await expect(executeTool(addTool, { a: 'invalid', b: 200 })).rejects.toThrow(
      /Tool validation error/
    );
  });
});
