import { z } from 'zod';

export interface Tool<P extends z.ZodTypeAny = z.ZodTypeAny, R = any> {
  name: string;
  description: string;
  schema: P;
  execute(params: z.infer<P>, context?: any): Promise<R>;
}

export async function executeTool<P extends z.ZodTypeAny, R>(
  tool: Tool<P, R>,
  params: unknown,
  context?: any
): Promise<R> {
  const parsed = tool.schema.safeParse(params);
  if (!parsed.success) {
    throw new Error(
      `Tool validation error for "${tool.name}": ${JSON.stringify(parsed.error.format())}`
    );
  }
  return tool.execute(parsed.data, context);
}
