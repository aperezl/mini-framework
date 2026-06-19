import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { Agent, ChatMessage, LLMProvider } from './agent';
import { ToolRegistry } from './registry';
import { Tool } from '../schemas/tool';

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

  it('handles multi-turn conversation with consecutive tool calls and verifies correct history structure', async () => {
    const registry = new ToolRegistry();
    registry.register(addTool);

    const chatMock = vi.fn();
    // Turn 1: User asks, LLM calls add tool for 5 + 10
    chatMock.mockResolvedValueOnce({
      message: {
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: 'call_1',
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
    // Turn 2: LLM gets result 15, then requests to add 15 + 20
    chatMock.mockResolvedValueOnce({
      message: {
        role: 'assistant',
        content: 'Adding 20 more.',
        tool_calls: [
          {
            id: 'call_2',
            type: 'function',
            function: {
              name: 'add',
              arguments: JSON.stringify({ a: 15, b: 20 }),
            },
          },
        ],
      },
      finish_reason: 'tool_calls',
    });
    // Turn 3: LLM gets result 35, and stops
    chatMock.mockResolvedValueOnce({
      message: {
        role: 'assistant',
        content: 'Final result is 35.',
      },
      finish_reason: 'stop',
    });

    const provider: LLMProvider = { chat: chatMock };
    const agent = new Agent(registry, provider);
    const result = await agent.run([{ role: 'user', content: 'Add 5 and 10, then add 20 to the result' }]);

    expect(chatMock).toHaveBeenCalledTimes(3);
    expect(result).toHaveLength(6); // User, Assistant (call 1), Tool (result 15), Assistant (call 2), Tool (result 35), Assistant (stop)
    
    expect(result[0].role).toBe('user');
    expect(result[1].role).toBe('assistant');
    expect(result[2].role).toBe('tool');
    expect(result[2]).toEqual({
      role: 'tool',
      tool_call_id: 'call_1',
      name: 'add',
      content: '15',
    });
    expect(result[3].role).toBe('assistant');
    expect(result[4].role).toBe('tool');
    expect(result[4]).toEqual({
      role: 'tool',
      tool_call_id: 'call_2',
      name: 'add',
      content: '35',
    });
    expect(result[5].role).toBe('assistant');
    expect(result[5].content).toBe('Final result is 35.');
  });

  it('injects context object into tools during execution', async () => {
    const registry = new ToolRegistry();

    interface LogContext {
      logs: string[];
      log(msg: string): void;
    }

    const logSchema = z.object({
      message: z.string(),
    });

    const loggerTool: Tool<typeof logSchema, void> = {
      name: 'log_info',
      description: 'Log some message',
      schema: logSchema,
      execute: async ({ message }, context: LogContext) => {
        context.log(message);
      },
    };

    registry.register(loggerTool);

    const chatMock = vi.fn();
    chatMock.mockResolvedValueOnce({
      message: {
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: 'call_999',
            type: 'function',
            function: {
              name: 'log_info',
              arguments: JSON.stringify({ message: 'Hello from LLM' }),
            },
          },
        ],
      },
      finish_reason: 'tool_calls',
    });
    chatMock.mockResolvedValueOnce({
      message: {
        role: 'assistant',
        content: 'Logged.',
      },
      finish_reason: 'stop',
    });

    const provider: LLMProvider = { chat: chatMock };

    const agent = new Agent(registry, provider);
    const mockContext: LogContext = {
      logs: [],
      log(msg: string) {
        this.logs.push(msg);
      },
    };

    await agent.run([{ role: 'user', content: 'log something' }], mockContext);

    expect(mockContext.logs).toContain('Hello from LLM');
  });
});

