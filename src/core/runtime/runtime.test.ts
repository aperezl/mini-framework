import { describe, it, expect, vi } from 'vitest';
import { AgentRuntime } from './runtime';
import { YAMLConfig } from './config-schema';
import { InputSource, OutputSink } from './io';
import { LLMProvider } from '../ports/llm-provider';
import { z } from 'zod';

// Mock MCPClient
vi.mock('../mcp', () => {
  class MockMCPClient {
    connect = vi.fn().mockResolvedValue(undefined);
    listTools = vi.fn().mockResolvedValue([
      {
        name: 'mcp-mock-tool',
        description: 'MCP Mock Tool',
        schema: z.object({ text: z.string() }),
        execute: async ({ text }: any) => `mcp: ${text}`,
      },
    ]);
    close = vi.fn().mockResolvedValue(undefined);
  }
  return {
    MCPClient: MockMCPClient,
    jsonSchemaToZod: vi.fn(),
  };
});

describe('AgentRuntime', () => {
  const mockConfig: YAMLConfig = {
    agent: {
      maxIterations: 5,
      provider: {
        type: 'ollama',
        model: 'llama3.1',
      },
    },
    storage: {
      type: 'sqlite',
      dbPath: ':memory:',
    },
    io: {
      input: 'stream',
      output: 'stream',
    },
    tools: [],
    middlewares: [],
  };

  const getMockIO = (inputs: string[]) => {
    let inputIndex = 0;
    const inputSource: InputSource = {
      read: vi.fn().mockImplementation(async () => {
        if (inputIndex < inputs.length) {
          return inputs[inputIndex++];
        }
        return 'exit';
      }),
      close: vi.fn(),
    };

    const outputSink: OutputSink = {
      writeToken: vi.fn(),
      writeMessage: vi.fn(),
      close: vi.fn(),
    };

    return { inputSource, outputSink };
  };

  it('correctly initializes LLM provider and SQLite storage', async () => {
    const { inputSource, outputSink } = getMockIO([]);
    const runtime = new AgentRuntime(mockConfig, undefined, inputSource, outputSink);

    await runtime.initialize();

    expect(runtime.provider).toBeDefined();
    expect(runtime.storage).toBeDefined();
    expect(runtime.agent).toBeDefined();
    
    await runtime.close();
    expect(inputSource.close).toHaveBeenCalled();
    expect(outputSink.close).toHaveBeenCalled();
  });

  it('fails if custom provider is chosen but no instance or modulePath is supplied', async () => {
    const customConfig: YAMLConfig = {
      ...mockConfig,
      agent: {
        ...mockConfig.agent,
        provider: { type: 'custom' },
      },
    };
    const { inputSource, outputSink } = getMockIO([]);
    const runtime = new AgentRuntime(customConfig, undefined, inputSource, outputSink);
    await expect(runtime.initialize()).rejects.toThrow(
      'Custom provider specified without modulePath'
    );
  });

  it('runs the interactive session and streams agent response', async () => {
    const { inputSource, outputSink } = getMockIO(['Hello there!']);
    const customProvider: LLMProvider = {
      chat: vi.fn(),
      chatStream: vi.fn().mockImplementation(async function* () {
        yield { content: 'Hi' };
        yield { content: '!' };
      }),
    };

    const runtime = new AgentRuntime(
      {
        ...mockConfig,
        agent: {
          ...mockConfig.agent,
          provider: { type: 'custom' },
        },
      },
      customProvider,
      inputSource,
      outputSink
    );

    // Start session
    await runtime.start('test-session');

    // Verify input was read
    expect(inputSource.read).toHaveBeenCalled();

    // Verify outputs were written
    expect(outputSink.writeMessage).toHaveBeenCalledWith(
      expect.stringContaining('Starting Agent Session'),
      'info'
    );
    expect(outputSink.writeToken).toHaveBeenCalledWith('Hi', 'token');
    expect(outputSink.writeToken).toHaveBeenCalledWith('!', 'token');
    expect(outputSink.writeMessage).toHaveBeenCalledWith('Goodbye!', 'info');

    // Verify history was saved to SQLite
    const history = await runtime.storage?.getHistory('test-session');
    expect(history).toBeDefined();
    expect(history).toHaveLength(3); // system, user, assistant
    expect(history![0].role).toBe('system');
    expect(history![1].role).toBe('user');
    expect(history![1].content).toBe('Hello there!');
    expect(history![2].role).toBe('assistant');
    expect(history![2].content).toBe('Hi!');

    await runtime.close();
  });

  it('dynamically loads custom provider, tools, middlewares, and MCP servers', async () => {
    const { inputSource, outputSink } = getMockIO([]);
    
    const config: YAMLConfig = {
      agent: {
        maxIterations: 10,
        provider: {
          type: 'custom',
          modulePath: './src/core/runtime/mock-provider-test.ts',
        },
      },
      tools: [
        {
          modulePath: './src/core/runtime/mock-tool-test.ts',
        },
        {
          mcp: {
            name: 'mock-mcp-server',
            command: 'echo',
          },
        },
      ],
      middlewares: [
        {
          modulePath: './src/core/runtime/mock-middleware-test.ts',
          className: 'MockMiddleware',
        },
      ],
      io: {
        input: 'stream',
        output: 'stream',
      },
    };

    const runtime = new AgentRuntime(config, undefined, inputSource, outputSink);
    await runtime.initialize();

    // Verify custom provider was loaded
    expect(runtime.provider).toBeDefined();
    const chatResult = await runtime.provider.chat([]);
    expect(chatResult.message.content).toBe('custom-loaded-response');

    // Verify tools were loaded (mockTool and MCP mock tool)
    const mockTool = runtime.registry.get('mockTool');
    expect(mockTool).toBeDefined();
    const mcpTool = runtime.registry.get('mcp-mock-tool');
    expect(mcpTool).toBeDefined();

    // Verify middleware was loaded and used
    // The mock middleware appends a message before calling LLM
    const testMessages = [{ role: 'user' as const, content: 'init' }];
    const stream = runtime.agent.runStream(testMessages);
    const reader = stream.getReader();
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }
    
    // Close runtime to test cleanup
    await runtime.close();
  });
});
