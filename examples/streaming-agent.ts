import { z } from 'zod';
import { Agent, ToolRegistry, Tool } from '../src/index';
import { MockLLMProvider } from './mock-provider';

// 1. Setup a tool
const addSchema = z.object({
  a: z.number(),
  b: z.number(),
});

const addTool: Tool<typeof addSchema, number> = {
  name: 'add',
  description: 'Add two numbers together',
  schema: addSchema,
  execute: async ({ a, b }) => a + b,
};

const registry = new ToolRegistry();
registry.register(addTool);

const provider = new MockLLMProvider();
const agent = new Agent(registry, provider);

async function main() {
  console.log('--- Running Streaming Agent Example ---');
  
  const messages = [{ role: 'user', content: 'Calcular la suma de 50 y 100' } as const];
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
        console.log(`\n\n[Stream Event] 🛠️  Executing tool '${value.name}' (id: ${value.toolCallId})...`);
      } else if (value.type === 'tool_call_end') {
        console.log(`[Stream Event] ✅ Tool '${value.name}' returned: ${JSON.stringify(value.result)}\n`);
      } else if (value.type === 'error') {
        console.log(`\n[Stream Event] ❌ Error occurred: ${value.message}`);
      }
    }
  }
  
  console.log('\n\n--- Stream Completed ---');
}

main().catch(console.error);
