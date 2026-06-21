import { Agent } from '../agent';
import { ToolRegistry } from '../registry';
import { OllamaProvider } from '../../adapters/llm/ollama';
import { SQLiteMemoryAdapter } from '../../storage/sqlite';
import { ChatMessage, LLMProvider } from '../ports/llm-provider';
import { YAMLConfig } from './config-schema';
import { InputSource, OutputSink, StdioInputSource, StdioOutputSink } from './io';

export class AgentRuntime {
  public agent: Agent;
  public provider: LLMProvider;
  public registry: ToolRegistry;
  public storage?: SQLiteMemoryAdapter;
  public inputSource: InputSource;
  public outputSink: OutputSink;

  constructor(
    config: YAMLConfig,
    customProvider?: LLMProvider,
    inputSource?: InputSource,
    outputSink?: OutputSink
  ) {
    // 1. Configure I/O Sources
    this.inputSource = inputSource ?? new StdioInputSource();
    this.outputSink = outputSink ?? new StdioOutputSink();

    // 2. Configure LLM Provider
    if (config.agent.provider.type === 'ollama') {
      this.provider = new OllamaProvider({
        model: config.agent.provider.model,
        host: config.agent.provider.host,
      });
    } else if (config.agent.provider.type === 'custom') {
      if (!customProvider) {
        throw new Error(
          'Custom provider type specified but no customProvider instance was provided. Dynamic loading of custom providers will be implemented in sub-milestone 09.3.'
        );
      }
      this.provider = customProvider;
    } else {
      throw new Error(`Unsupported provider type: ${config.agent.provider.type}`);
    }

    // 3. Configure Storage
    if (config.storage) {
      if (config.storage.type === 'sqlite') {
        const dbPath = config.storage.dbPath ?? ':memory:';
        this.storage = new SQLiteMemoryAdapter(dbPath);
      } else {
        throw new Error(`Unsupported storage type: ${config.storage.type}`);
      }
    }

    // 4. Configure Registry and Agent
    this.registry = new ToolRegistry();
    this.agent = new Agent(this.registry, this.provider, {
      maxIterations: config.agent.maxIterations,
    });
  }

  /**
   * Starts the runtime session. It polls for user input, feeds it to the agent,
   * handles outputs (real-time stream) and records history.
   * 
   * @param sessionId The session identifier for recording chat history.
   */
  async start(sessionId = 'default'): Promise<void> {
    const defaultSystemPrompt = 'You are a helpful assistant.';

    // Load history
    let history: ChatMessage[] = [];
    if (this.storage) {
      history = await this.storage.getHistory(sessionId);
    }

    if (history.length === 0) {
      const systemMessage: ChatMessage = {
        role: 'system',
        content: defaultSystemPrompt,
      };
      history.push(systemMessage);
      if (this.storage) {
        await this.storage.saveMessage(sessionId, systemMessage);
      }
    }

    await this.outputSink.writeMessage(
      'Starting Agent Session. Type "exit" or "quit" to stop.',
      'info'
    );

    while (true) {
      const userInput = await this.inputSource.read();
      if (
        userInput.trim().toLowerCase() === 'exit' ||
        userInput.trim().toLowerCase() === 'quit'
      ) {
        await this.outputSink.writeMessage('Goodbye!', 'info');
        break;
      }

      if (!userInput.trim()) {
        continue;
      }

      const userMessage: ChatMessage = {
        role: 'user',
        content: userInput,
      };

      history.push(userMessage);
      if (this.storage) {
        await this.storage.saveMessage(sessionId, userMessage);
      }

      try {
        const stream = this.agent.runStream(history);
        const reader = stream.getReader();
        let assistantContent = '';
        let assistantThinking = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          if (value) {
            if (value.type === 'thinking') {
              await this.outputSink.writeToken(value.content, 'thinking');
              assistantThinking += value.content;
            } else if (value.type === 'token') {
              await this.outputSink.writeToken(value.content, 'token');
              assistantContent += value.content;
            } else if (value.type === 'error') {
              await this.outputSink.writeMessage(value.message, 'error');
            }
          }
        }

        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: assistantContent || null,
          thinking: assistantThinking || null,
        };

        history.push(assistantMessage);
        if (this.storage) {
          await this.storage.saveMessage(sessionId, assistantMessage);
        }
      } catch (err: any) {
        await this.outputSink.writeMessage(`Execution failed: ${err.message}`, 'error');
      }
    }
  }

  /**
   * Orderly shutdown of any spawned services.
   */
  async close(): Promise<void> {
    await this.inputSource.close();
    await this.outputSink.close();
  }
}
