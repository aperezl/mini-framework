import { z } from 'zod';
import yaml from 'yaml';

export const ProviderSchema = z.object({
  type: z.enum(['ollama', 'custom']),
  model: z.string().optional(),
  host: z.string().optional(),
  modulePath: z.string().optional(),
  className: z.string().optional(),
  options: z.record(z.any()).optional(),
});

export const StorageSchema = z.object({
  type: z.enum(['sqlite', 'memory']),
  dbPath: z.string().optional(),
});

export const IOSchema = z.object({
  input: z.enum(['stdio', 'stream']).default('stdio'),
  output: z.enum(['stdio', 'stream']).default('stdio'),
});

export const ToolConfigSchema = z.object({
  name: z.string().optional(),
  modulePath: z.string().optional(),
  mcp: z.object({
    name: z.string(),
    command: z.string(),
    args: z.array(z.string()).optional(),
    env: z.record(z.string()).optional(),
  }).optional(),
}).refine(
  (data) => data.modulePath || data.mcp,
  {
    message: 'Either modulePath or mcp must be defined for each tool',
    path: ['modulePath'],
  }
);

export const MiddlewareConfigSchema = z.object({
  modulePath: z.string(),
  className: z.string().optional(),
  options: z.record(z.any()).optional(),
});

export const YAMLConfigSchema = z.object({
  agent: z.object({
    maxIterations: z.number().default(10),
    provider: ProviderSchema,
  }),
  storage: StorageSchema.optional(),
  io: IOSchema.default({ input: 'stdio', output: 'stdio' }),
  tools: z.array(ToolConfigSchema).default([]),
  middlewares: z.array(MiddlewareConfigSchema).default([]),
});

export type YAMLConfig = z.infer<typeof YAMLConfigSchema>;

/**
 * Parses and validates a YAML configuration string.
 * 
 * @param yamlContent The YAML string to parse and validate.
 * @throws Error if the YAML is invalid or validation fails.
 */
export function parseYAMLConfig(yamlContent: string): YAMLConfig {
  let parsedJson: any;
  try {
    parsedJson = yaml.parse(yamlContent);
  } catch (err: any) {
    throw new Error(`Failed to parse YAML syntax: ${err.message}`);
  }

  try {
    return YAMLConfigSchema.parse(parsedJson);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      const issues = err.issues
        .map((issue) => `[${issue.path.join('.') || 'root'}]: ${issue.message}`)
        .join('\n');
      throw new Error(`Validation failed for YAML configuration:\n${issues}`);
    }
    throw err;
  }
}
