import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

export function zodToJson(schema: z.ZodTypeAny): Record<string, any> {
  return zodToJsonSchema(schema) as Record<string, any>;
}
