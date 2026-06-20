import { z } from 'zod';
import { Agent, ToolRegistry, OllamaProvider } from '../src/index';
import type { Tool } from '../src/index';

// 1. Define tools using Zod
const AddSchema = z.object({
  a: z.number().describe('The first number to add'),
  b: z.number().describe('The second number to add'),
});

const addTool: Tool<typeof AddSchema, number> = {
  name: 'add',
  description: 'Adds two numbers together.',
  schema: AddSchema,
  async execute({ a, b }) {
    console.log(`[Tool: add] Executing ${a} + ${b}`);
    return a + b;
  },
};

const SubtractSchema = z.object({
  a: z.number().describe('The number to subtract from'),
  b: z.number().describe('The number to subtract'),
});

const subtractTool: Tool<typeof SubtractSchema, number> = {
  name: 'subtract',
  description: 'Subtracts the second number from the first.',
  schema: SubtractSchema,
  async execute({ a, b }) {
    console.log(`[Tool: subtract] Executing ${a} - ${b}`);
    return a - b;
  },
};

async function main() {
  console.log('--- Ollama Agent Example ---');
  console.log('Note: Ensure Ollama is running locally with the llama3.1 model (ollama run llama3.1)');

  // 2. Setup Tool Registry
  const registry = new ToolRegistry();
  registry.register(addTool);
  registry.register(subtractTool);

  // 3. Initialize Ollama Provider
  // Defaults to http://localhost:11434 and llama3.1 model
  const provider = new OllamaProvider({
    model: 'gemma4:e2b',
  });

  // 4. Create Agent
  const agent = new Agent(registry, provider);

  // 5. Run conversational loop
  const messages = [
    {
      role: 'user' as const,
      content: 'I have 52 apples. I eat 12, then buy 5 more. How many do I have now? Use tools to calculate.',
    },
  ];

  try {
    console.log('Sending message to Ollama...');
    const result = await agent.run(messages);
    console.log('\nFinal Conversation History:');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Agent execution failed:', error);
  }
}

main();
