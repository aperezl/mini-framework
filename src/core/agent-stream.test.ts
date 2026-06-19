import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { Agent, ChatMessage, LLMProvider, AgentStreamChunk, LLMStreamChunk } from './agent.js';
import { ToolRegistry } from './registry.js';
import { Tool } from '../schemas/tool.js';

describe('Agent Streaming Loop', () => {
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

  const readAllChunks = async (stream: ReadableStream<AgentStreamChunk>): Promise<AgentStreamChunk[]> => {
    const reader = stream.getReader();
    const chunks: AgentStreamChunk[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    return chunks;
  };

  it('streams simple text tokens and closes successfully', async () => {
    const registry = new ToolRegistry();
    const chatStreamMock = vi.fn().mockResolvedValue({
      [Symbol.asyncIterator]: async function* () {
        yield { content: 'Hello ', finish_reason: null };
        yield { content: 'world!', finish_reason: 'stop' };
      },
    });

    const provider: LLMProvider = {
      chat: vi.fn(),
      chatStream: chatStreamMock,
    };

    const agent = new Agent(registry, provider);
    const stream = agent.runStream([{ role: 'user', content: 'Say hi' }]);
    const chunks = await readAllChunks(stream);

    expect(chatStreamMock).toHaveBeenCalledTimes(1);
    expect(chunks).toEqual([
      { type: 'token', content: 'Hello ' },
      { type: 'token', content: 'world!' },
    ]);
  });

  it('streams tool call deltas, executes them, and finishes', async () => {
    const registry = new ToolRegistry();
    registry.register(addTool);

    const chatStreamMock = vi.fn();
    // Turn 1: request tool call
    chatStreamMock.mockResolvedValueOnce({
      [Symbol.asyncIterator]: async function* () {
        yield {
          tool_calls_delta: [
            {
              index: 0,
              id: 'call_1',
              type: 'function',
              function: { name: 'add', arguments: '{"a":' },
            },
          ],
          finish_reason: null,
        };
        yield {
          tool_calls_delta: [
            {
              index: 0,
              function: { arguments: ' 10, "b": 5}' },
            },
          ],
          finish_reason: 'tool_calls',
        };
      },
    });
    // Turn 2: LLM replies with stop
    chatStreamMock.mockResolvedValueOnce({
      [Symbol.asyncIterator]: async function* () {
        yield { content: 'Result is 15.', finish_reason: 'stop' };
      },
    });

    const provider: LLMProvider = {
      chat: vi.fn(),
      chatStream: chatStreamMock,
    };

    const agent = new Agent(registry, provider);
    const stream = agent.runStream([{ role: 'user', content: 'What is 10 + 5?' }]);
    const chunks = await readAllChunks(stream);

    expect(chatStreamMock).toHaveBeenCalledTimes(2);
    expect(chunks).toEqual([
      { type: 'tool_call_start', toolCallId: 'call_1', name: 'add' },
      { type: 'tool_call_end', toolCallId: 'call_1', name: 'add', result: 15 },
      { type: 'token', content: 'Result is 15.' },
    ]);
  });

  it('handles and emits errors gracefully if an unregistered tool is called', async () => {
    const registry = new ToolRegistry(); // empty registry

    const chatStreamMock = vi.fn().mockResolvedValue({
      [Symbol.asyncIterator]: async function* () {
        yield {
          tool_calls_delta: [
            {
              index: 0,
              id: 'call_1',
              type: 'function',
              function: { name: 'unknown', arguments: '{}' },
            },
          ],
          finish_reason: 'tool_calls',
        };
      },
    });

    const provider: LLMProvider = {
      chat: vi.fn(),
      chatStream: chatStreamMock,
    };

    const agent = new Agent(registry, provider);
    const stream = agent.runStream([{ role: 'user', content: 'run tool' }]);
    const chunks = await readAllChunks(stream);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].type).toBe('error');
    expect(chunks[0]).toEqual({
      type: 'error',
      message: 'Tool not found in registry: "unknown"',
    });
  });
});
