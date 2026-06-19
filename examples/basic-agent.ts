import { z } from 'zod';
import { Agent, ToolRegistry, Tool } from '../src/index';
import { MockLLMProvider } from './mock-provider';

// 1. Define a tool schema and implementation
const addSchema = z.object({
  a: z.number().describe('First number'),
  b: z.number().describe('Second number'),
});

const addTool: Tool<typeof addSchema, number> = {
  name: 'add',
  description: 'Add two numbers together',
  schema: addSchema,
  execute: async ({ a, b }, context) => {
    if (context?.logger) {
      context.logger.info(`Tool 'add' called with parameters a=${a}, b=${b}`);
    }
    return a + b;
  },
};

// 2. Setup Tool Registry and register the tool
const registry = new ToolRegistry();
registry.register(addTool);

// 3. Initialize Agent with Mock LLM Provider
const provider = new MockLLMProvider();
const agent = new Agent(registry, provider);

// 4. Set up an execution context containing a custom logger
const context = {
  logger: {
    info: (msg: string) => console.log(`[Context Logger] ${msg}`),
  },
};

// 5. Run the agent execution loop
async function main() {
  console.log('--- Running Basic Agent Example ---');
  const messages = [{ role: 'user', content: 'Calcular la suma de 45 y 15' } as const];
  
  console.log(`User query: "${messages[0].content}"`);
  
  const history = await agent.run(messages, context);
  
  console.log('\n--- Final Conversation History ---');
  history.forEach((msg) => {
    console.log(`[${msg.role.toUpperCase()}]:`, msg.content ?? `[Tool Calls: ${JSON.stringify(msg.tool_calls)}]`);
  });
}

main().catch(console.error);
