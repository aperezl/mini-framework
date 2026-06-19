import { z } from 'zod';
import { Agent, ToolRegistry, Tool, Middleware } from '../src/index';
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

// 2. Define Middleware Hooks
// A global logging middleware that prints parameters and measures duration
const performanceLogger: Middleware = {
  beforeExecute: async (params, meta) => {
    console.log(`[Middleware Log] Calling tool '${meta.toolName}' with arguments: ${JSON.stringify(params)}`);
    return params;
  },
  afterExecute: async (result, params, meta) => {
    console.log(`[Middleware Log] Tool '${meta.toolName}' finished. Result: ${result}`);
    return result;
  },
};

// A selective tool-specific middleware that guards execution based on access credentials
const permissionGuard: Middleware = {
  toolName: 'add', // Only run for the 'add' tool
  beforeExecute: async (params, meta) => {
    const hasAccess = meta.context?.apiKey === 'SUPER_SECRET_KEY';
    if (!hasAccess) {
      console.log(`[Middleware Guard] Access Denied for '${meta.toolName}'.`);
      throw new Error(`Unauthorized: Client does not have permission to execute tool '${meta.toolName}'.`);
    }
    console.log(`[Middleware Guard] Access Granted for '${meta.toolName}'.`);
    return params;
  },
};

const provider = new MockLLMProvider();

async function runScenario(context: any, label: string) {
  console.log(`\n--- Running Scenario: ${label} ---`);
  
  const agent = new Agent(registry, provider);
  agent.use(performanceLogger);
  agent.use(permissionGuard);

  try {
    const history = await agent.run([{ role: 'user', content: 'Calcular la suma de 8 y 2' }], context);
    console.log('[Agent Result] Loop finished successfully.');
    console.log('[Agent Result] Final Message:', history[history.length - 1].content);
  } catch (error: any) {
    console.log(`[Agent Result] Loop halted with error: "${error.message}"`);
  }
}

async function main() {
  console.log('--- Running Middleware Agent Example ---');

  // Scenario 1: Run without secret API key (Access Denied)
  await runScenario({}, 'Without API Key');

  // Scenario 2: Run with valid secret API key (Access Granted)
  await runScenario({ apiKey: 'SUPER_SECRET_KEY' }, 'With API Key');
}

main().catch(console.error);
