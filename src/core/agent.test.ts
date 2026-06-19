import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { Agent, ChatMessage, LLMProvider } from './agent.js';
import { ToolRegistry } from './registry.js';
import { Tool } from '../schemas/tool.js';

describe('Agent Orchestrator', () => {
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

  it('stops immediately if the provider finish_reason is "stop"', async () => {
    const registry = new ToolRegistry();
    const provider: LLMProvider = {
      chat: vi.fn().mockResolvedValue({
        message: {
          role: 'assistant',
          content: 'Hello! How can I help you today?',
        },
        finish_reason: 'stop',
      }),
    };

    const agent = new Agent(registry, provider);
    const initialMessages: ChatMessage[] = [
      { role: 'user', content: 'Hi' },
    ];

    const result = await agent.run(initialMessages);

    expect(result).toHaveLength(2);
    expect(result[1]).toEqual({
      role: 'assistant',
      content: 'Hello! How can I help you today?',
    });
    expect(provider.chat).toHaveBeenCalledTimes(1);
  });

  it('executes a tool call, feeds it back, and finishes', async () => {
    const registry = new ToolRegistry();
    registry.register(addTool);

    const chatMock = vi.fn();
    // Iteration 1: LLM requests tool execution
    chatMock.mockResolvedValueOnce({
      message: {
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: 'call_123',
            type: 'function',
            function: {
              name: 'add',
              arguments: JSON.stringify({ a: 5, b: 10 }),
            },
          },
        ],
      },
      finish_reason: 'tool_calls',
    });
    // Iteration 2: LLM responds to the tool result and stops
    chatMock.mockResolvedValueOnce({
      message: {
        role: 'assistant',
        content: 'The result is 15.',
      },
      finish_reason: 'stop',
    });

    const provider: LLMProvider = { chat: chatMock };
    const agent = new Agent(registry, provider);
    const result = await agent.run([{ role: 'user', content: 'What is 5 + 10?' }]);

    expect(chatMock).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(4); // User, Assistant (call), Tool (result), Assistant (stop)
    
    // Check Tool response message structure
    expect(result[2]).toEqual({
      role: 'tool',
      tool_call_id: 'call_123',
      name: 'add',
      content: '15',
    });
    expect(result[3].content).toBe('The result is 15.');
  });

  it('throws an error if a tool is not found', async () => {
    const registry = new ToolRegistry(); // empty registry
    const provider: LLMProvider = {
      chat: vi.fn().mockResolvedValue({
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: 'call_123',
              type: 'function',
              function: {
                name: 'unknown_tool',
                arguments: '{}',
              },
            },
          ],
        },
        finish_reason: 'tool_calls',
      }),
    };

    const agent = new Agent(registry, provider);
    await expect(agent.run([{ role: 'user', content: 'run tool' }])).rejects.toThrow(
      'Tool not found in registry: "unknown_tool"'
    );
  });

  it('throws an error if tool arguments are not valid JSON', async () => {
    const registry = new ToolRegistry();
    registry.register(addTool);

    const provider: LLMProvider = {
      chat: vi.fn().mockResolvedValue({
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: 'call_123',
              type: 'function',
              function: {
                name: 'add',
                arguments: '{a: 5, b: 10', // invalid JSON
              },
            },
          ],
        },
        finish_reason: 'tool_calls',
      }),
    };

    const agent = new Agent(registry, provider);
    await expect(agent.run([{ role: 'user', content: 'run tool' }])).rejects.toThrow(
      'Failed to parse arguments for tool "add"'
    );
  });

  it('stops and throws an error if maxIterations limit is exceeded', async () => {
    const registry = new ToolRegistry();
    registry.register(addTool);

    const provider: LLMProvider = {
      chat: vi.fn().mockResolvedValue({
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: 'call_123',
              type: 'function',
              function: {
                name: 'add',
                arguments: JSON.stringify({ a: 1, b: 1 }),
              },
            },
          ],
        },
        finish_reason: 'tool_calls',
      }),
    };

    // Set maxIterations to 3
    const agent = new Agent(registry, provider, { maxIterations: 3 });
    
    await expect(agent.run([{ role: 'user', content: 'loop forever' }])).rejects.toThrow(
      'Agent run exceeded maxIterations of 3'
    );
    expect(provider.chat).toHaveBeenCalledTimes(3);
  });
});
