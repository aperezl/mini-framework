import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { Tool } from '../schemas/tool';
import { ToolRegistry } from './registry';

describe('ToolRegistry', () => {
  const dummySchema = z.object({
    input: z.string(),
  });

  const toolA: Tool<typeof dummySchema, string> = {
    name: 'toolA',
    description: 'First test tool',
    schema: dummySchema,
    execute: async ({ input }) => `A: ${input}`,
  };

  const toolB: Tool<typeof dummySchema, string> = {
    name: 'toolB',
    description: 'Second test tool',
    schema: dummySchema,
    execute: async ({ input }) => `B: ${input}`,
  };

  it('should support registering and retrieving tools', () => {
    const registry = new ToolRegistry();
    registry.register(toolA);
    registry.register(toolB);

    expect(registry.get('toolA')).toBe(toolA);
    expect(registry.get('toolB')).toBe(toolB);
    expect(registry.get('toolC')).toBeUndefined();
  });

  it('should throw an error on duplicate tool registrations', () => {
    const registry = new ToolRegistry();
    registry.register(toolA);

    expect(() => {
      registry.register({
        name: 'toolA',
        description: 'Duplicate name tool',
        schema: dummySchema,
        execute: async () => 'duplicate',
      });
    }).toThrow(/already registered/);
  });

  it('should return correct schema definitions for registered tools', () => {
    const registry = new ToolRegistry();
    registry.register(toolA);
    registry.register(toolB);

    const definitions = registry.getDefinitions();

    expect(definitions).toHaveLength(2);
    expect(definitions[0]).toEqual({
      name: 'toolA',
      description: 'First test tool',
      parameters: expect.objectContaining({
        type: 'object',
        properties: expect.objectContaining({
          input: expect.objectContaining({ type: 'string' }),
        }),
      }),
    });
  });
});
