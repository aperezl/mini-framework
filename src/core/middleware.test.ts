import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { Agent, ChatMessage, LLMProvider } from './agent.js';
import { ToolRegistry } from './registry.js';
import { Tool } from '../schemas/tool.js';
import { Middleware } from './middleware.js';

describe('Middleware System', () => {
  const echoSchema = z.object({
    text: z.string(),
  });

  const echoTool: Tool<typeof echoSchema, string> = {
    name: 'echo',
    description: 'Echoes back the input text',
    schema: echoSchema,
    execute: async ({ text }) => text,
  };

  const getAgentAndProvider = (registry: ToolRegistry, options?: any) => {
    const chatMock = vi.fn();
    chatMock.mockResolvedValueOnce({
      message: {
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: 'call_1',
            type: 'function',
            function: {
              name: 'echo',
              arguments: JSON.stringify({ text: 'original' }),
            },
          },
        ],
      },
      finish_reason: 'tool_calls',
    });
    chatMock.mockResolvedValueOnce({
      message: {
        role: 'assistant',
        content: 'Done.',
      },
      finish_reason: 'stop',
    });

    const provider: LLMProvider = { chat: chatMock };
    const agent = new Agent(registry, provider, options);
    return { agent, chatMock };
  };

  it('runs global logging middleware before and after execution', async () => {
    const registry = new ToolRegistry();
    registry.register(echoTool);

    const log: string[] = [];
    const logger: Middleware = {
      beforeExecute: async (params, meta) => {
        log.push(`Before ${meta.toolName} with ${JSON.stringify(params)}`);
        return params;
      },
      afterExecute: async (result, params, meta) => {
        log.push(`After ${meta.toolName} resulted in ${JSON.stringify(result)}`);
        return result;
      },
    };

    const { agent } = getAgentAndProvider(registry, { middlewares: [logger] });
    await agent.run([{ role: 'user', content: 'hello' }]);

    expect(log).toHaveLength(2);
    expect(log[0]).toBe('Before echo with {"text":"original"}');
    expect(log[1]).toBe('After echo resulted in "original"');
  });

  it('halts execution if a middleware throws an error (e.g. permission check)', async () => {
    const registry = new ToolRegistry();
    registry.register(echoTool);

    const permissionGuard: Middleware = {
      toolName: 'echo',
      beforeExecute: () => {
        throw new Error('Permission Denied: User cannot access echo tool.');
      },
    };

    const { agent } = getAgentAndProvider(registry);
    agent.use(permissionGuard); // register middleware dynamically

    await expect(agent.run([{ role: 'user', content: 'run' }])).rejects.toThrow(
      'Permission Denied: User cannot access echo tool.'
    );
  });

  it('allows middleware to modify parameters before execution', async () => {
    const registry = new ToolRegistry();
    registry.register(echoTool);

    const uppercaseMiddleware: Middleware = {
      beforeExecute: (params) => {
        return { text: params.text.toUpperCase() };
      },
    };

    const { agent } = getAgentAndProvider(registry, { middlewares: [uppercaseMiddleware] });
    const result = await agent.run([{ role: 'user', content: 'shout' }]);

    // Third message is the tool response
    expect(result[2].role).toBe('tool');
    expect(result[2].content).toBe('ORIGINAL');
  });

  it('allows middleware to modify results after execution', async () => {
    const registry = new ToolRegistry();
    registry.register(echoTool);

    const suffixMiddleware: Middleware = {
      afterExecute: (result) => {
        return `${result} - modified!`;
      },
    };

    const { agent } = getAgentAndProvider(registry, { middlewares: [suffixMiddleware] });
    const result = await agent.run([{ role: 'user', content: 'suffix' }]);

    expect(result[2].role).toBe('tool');
    expect(result[2].content).toBe('original - modified!');
  });
});
