import { describe, it, expect, vi } from 'vitest';
import { AgentRuntime } from './runtime';
import { YAMLConfig } from './config-schema';
import { InputSource, OutputSink } from './io';
import { LLMProvider, ChatMessage } from '../ports/llm-provider';

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

    expect(runtime.provider).toBeDefined();
    expect(runtime.storage).toBeDefined();
    expect(runtime.agent).toBeDefined();
    
    await runtime.close();
    expect(inputSource.close).toHaveBeenCalled();
    expect(outputSink.close).toHaveBeenCalled();
  });

  it('fails if custom provider is chosen but no instance is supplied', () => {
    const customConfig: YAMLConfig = {
      ...mockConfig,
      agent: {
        ...mockConfig.agent,
        provider: { type: 'custom' },
      },
    };
    const { inputSource, outputSink } = getMockIO([]);
    expect(() => new AgentRuntime(customConfig, undefined, inputSource, outputSink)).toThrow(
      'Custom provider type specified'
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
});
