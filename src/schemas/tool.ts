import { z } from 'zod';

export interface Tool<P extends z.ZodTypeAny = z.ZodTypeAny, R = any> {
  name: string;
  description: string;
  schema: P;
  execute(params: z.infer<P>, context?: any): Promise<R>;
}
