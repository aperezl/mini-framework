import { z } from 'zod';
import { Tool } from '../../schemas/tool';

const schema = z.object({
  val: z.string(),
});

const mockTool: Tool<typeof schema, string> = {
  name: 'mockTool',
  description: 'Mock Tool for runtime testing',
  schema,
  execute: async ({ val }) => `echo: ${val}`,
};

export default mockTool;
