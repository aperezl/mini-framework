import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { zodToJson } from './json-schema';

describe('JSON Schema Generator', () => {
  it('should transform a ZodSchema to a valid JSON Schema with key fields', () => {
    const testSchema = z.object({
      name: z.string(),
      age: z.number().optional(),
      tags: z.array(z.string()),
    });

    const jsonSchema = zodToJson(testSchema);

    expect(jsonSchema).toBeDefined();
    expect(jsonSchema.type).toBe('object');
    expect(jsonSchema.properties).toBeDefined();
    expect(jsonSchema.properties.name).toBeDefined();
    expect(jsonSchema.properties.name.type).toBe('string');
    expect(jsonSchema.properties.age).toBeDefined();
    expect(jsonSchema.properties.age.type).toBe('number');
    expect(jsonSchema.properties.tags).toBeDefined();
    expect(jsonSchema.properties.tags.type).toBe('array');
    expect(jsonSchema.required).toContain('name');
    expect(jsonSchema.required).toContain('tags');
    expect(jsonSchema.required).not.toContain('age');
  });
});
