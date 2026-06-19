import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OllamaProvider } from './ollama';

describe('OllamaProvider', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('performs basic chat correctly', async () => {
    const mockResponse = {
      message: {
        role: 'assistant',
        content: 'Hello, how can I help you today?',
      },
      done_reason: 'stop',
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const provider = new OllamaProvider({ model: 'test-model' });
    const response = await provider.chat([{ role: 'user', content: 'Hi' }]);

    expect(global.fetch).toHaveBeenCalledWith('http://localhost:11434/api/chat', expect.any(Object));
    expect(response.message.content).toBe('Hello, how can I help you today?');
    expect(response.finish_reason).toBe('stop');
  });

  it('normalizes tool call arguments from objects to strings', async () => {
    const mockResponse = {
      message: {
        role: 'assistant',
        tool_calls: [
          {
            id: 'call_1',
            function: {
              name: 'add',
              arguments: { a: 5, b: 10 },
            },
          },
        ],
      },
      done_reason: 'stop',
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const provider = new OllamaProvider();
    const response = await provider.chat([{ role: 'user', content: 'add 5 and 10' }], {
      tools: [
        {
          name: 'add',
          description: 'adds numbers',
          parameters: { type: 'object' },
        },
      ],
    });

    expect(response.finish_reason).toBe('tool_calls');
    const msg = response.message as any;
    expect(msg.tool_calls?.[0].function.arguments).toBe('{"a":5,"b":10}');
    expect(msg.tool_calls?.[0].id).toBe('call_1');
  });

  it('streams content tokens successfully', async () => {
    const streamChunks = [
      JSON.stringify({ message: { content: 'Hello' }, done: false }),
      JSON.stringify({ message: { content: ' world' }, done: false }),
      JSON.stringify({ done: true, done_reason: 'stop' }),
    ];

    const mockReadableStream = {
      [Symbol.asyncIterator]() {
        let index = 0;
        const encoder = new TextEncoder();
        return {
          async next() {
            if (index < streamChunks.length) {
              const chunk = streamChunks[index++];
              return { value: encoder.encode(chunk + '\n'), done: false };
            }
            return { done: true };
          },
        };
      },
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      body: mockReadableStream,
    });

    const provider = new OllamaProvider();
    const chunks: string[] = [];
    for await (const chunk of await provider.chatStream([{ role: 'user', content: 'Hi' }])) {
      if (chunk.content) {
        chunks.push(chunk.content);
      }
    }

    expect(chunks).toEqual(['Hello', ' world']);
  });

  it('throws an error on non-200 responses', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => 'Ollama is overloaded',
    });

    const provider = new OllamaProvider();
    await expect(provider.chat([{ role: 'user', content: 'Hi' }])).rejects.toThrow(
      'Ollama API error (500): Ollama is overloaded'
    );
  });
});
