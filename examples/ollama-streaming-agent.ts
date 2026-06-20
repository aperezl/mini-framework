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
    console.log(`\n[Tool: add] Executing ${a} + ${b}`);
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
    console.log(`\n[Tool: subtract] Executing ${a} - ${b}`);
    return a - b;
  },
};

async function main() {
  console.log('--- Ollama Streaming Agent Example ---');
  console.log('Note: Ensure Ollama is running locally with the gemma4:e2b model (ollama run gemma4:e2b)');

  // 2. Setup Tool Registry
  const registry = new ToolRegistry();
  registry.register(addTool);
  registry.register(subtractTool);

  // 3. Initialize Ollama Provider with streaming support
  const provider = new OllamaProvider({
    model: 'gemma4:e2b',
  });

  // 4. Create Agent
  const agent = new Agent(registry, provider);

  const messages = [
    {
      role: 'user' as const,
      content: 'I have 52 apples. I eat 12, then buy 5 more. How many do I have now? Use tools to calculate.',
    },
  ];

  console.log(`User query: "${messages[0].content}"`);
  console.log('\n--- Real-Time Stream Output ---');

  const stream = agent.runStream(messages);
  const reader = stream.getReader();

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    if (value) {
      if (value.type === 'token') {
        // Print token characters in real-time
        process.stdout.write(value.content);
      } else if (value.type === 'tool_call_start') {
        console.log(`\n[Stream Event] 🛠️  Executing tool '${value.name}' (id: ${value.toolCallId})...`);
      } else if (value.type === 'tool_call_end') {
        console.log(`[Stream Event] ✅ Tool '${value.name}' returned: ${JSON.stringify(value.result)}`);
      } else if (value.type === 'error') {
        console.log(`\n[Stream Event] ❌ Error occurred: ${value.message}`);
      }
    }
  }

  console.log('\n\n--- Stream Completed ---');
}

main().catch(console.error);
