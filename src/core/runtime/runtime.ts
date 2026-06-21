import path from 'node:path';
import { Agent } from '../agent';
import { ToolRegistry } from '../registry';
import { OllamaProvider } from '../../adapters/llm/ollama';
import { SQLiteMemoryAdapter } from '../../storage/sqlite';
import { ChatMessage, LLMProvider } from '../ports/llm-provider';
import { YAMLConfig } from './config-schema';
import { InputSource, OutputSink, StdioInputSource, StdioOutputSink } from './io';
import { MCPClient } from '../mcp';

export class AgentRuntime {
  public agent!: Agent;
  public provider!: LLMProvider;
  public registry: ToolRegistry;
  public storage?: SQLiteMemoryAdapter;
  public inputSource: InputSource;
  public outputSink: OutputSink;

  private config: YAMLConfig;
  private customProviderPassed?: LLMProvider;
  private mcpClients: MCPClient[] = [];
  private isInitialized = false;

  constructor(
    config: YAMLConfig,
    customProvider?: LLMProvider,
    inputSource?: InputSource,
    outputSink?: OutputSink
  ) {
    this.config = config;
    this.customProviderPassed = customProvider;
    this.inputSource = inputSource ?? new StdioInputSource();
    this.outputSink = outputSink ?? new StdioOutputSink();
    this.registry = new ToolRegistry();
  }

  /**
   * Asynchronously initializes the runtime components, loading dynamic providers,
   * tools, middlewares, and establishing MCP connections.
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    const config = this.config;

    // 1. Configure LLM Provider
    if (config.agent.provider.type === 'ollama') {
      this.provider = new OllamaProvider({
        model: config.agent.provider.model,
        host: config.agent.provider.host,
      });
    } else if (config.agent.provider.type === 'custom') {
      if (this.customProviderPassed) {
        this.provider = this.customProviderPassed;
      } else {
        if (!config.agent.provider.modulePath) {
          throw new Error('Custom provider specified without modulePath');
        }
        const absolutePath = path.isAbsolute(config.agent.provider.modulePath)
          ? config.agent.provider.modulePath
          : path.resolve(process.cwd(), config.agent.provider.modulePath);

        const mod = await import(absolutePath);
        const ClassRef = config.agent.provider.className
          ? mod[config.agent.provider.className]
          : mod.default;

        if (!ClassRef) {
          throw new Error(
            `Could not find class reference in module: ${config.agent.provider.modulePath}`
          );
        }
        this.provider = new ClassRef(config.agent.provider.options ?? {});
      }
    } else {
      throw new Error(`Unsupported provider type: ${config.agent.provider.type}`);
    }

    // 2. Instantiate Agent
    this.agent = new Agent(this.registry, this.provider, {
      maxIterations: config.agent.maxIterations,
    });

    // 3. Configure Storage
    if (config.storage) {
      if (config.storage.type === 'sqlite') {
        const dbPath = config.storage.dbPath ?? ':memory:';
        this.storage = new SQLiteMemoryAdapter(dbPath);
      } else {
        throw new Error(`Unsupported storage type: ${config.storage.type}`);
      }
    }

    // 4. Configure Dynamic Tools & MCP Servers
    for (const toolConf of config.tools) {
      if (toolConf.modulePath) {
        const absolutePath = path.isAbsolute(toolConf.modulePath)
          ? toolConf.modulePath
          : path.resolve(process.cwd(), toolConf.modulePath);

        const mod = await import(absolutePath);
        // Look for default export or name
        const toolInstance = toolConf.name ? mod[toolConf.name] : mod.default;
        if (!toolInstance || typeof toolInstance.execute !== 'function') {
          throw new Error(`Invalid tool exported from module: ${toolConf.modulePath}`);
        }
        this.registry.register(toolInstance);
      } else if (toolConf.mcp) {
        const mcpClient = new MCPClient(
          toolConf.mcp.command,
          toolConf.mcp.args ?? []
        );
        await mcpClient.connect();
        this.mcpClients.push(mcpClient);

        // Fetch remote tools and register them
        const remoteTools = await mcpClient.listTools();
        for (const remoteTool of remoteTools) {
          this.registry.register(remoteTool);
        }
      }
    }

    // 5. Configure Dynamic Middlewares
    for (const mwConf of config.middlewares) {
      const absolutePath = path.isAbsolute(mwConf.modulePath)
        ? mwConf.modulePath
        : path.resolve(process.cwd(), mwConf.modulePath);

      const mod = await import(absolutePath);
      const ClassRef = mwConf.className ? mod[mwConf.className] : mod.default;
      if (!ClassRef) {
        throw new Error(`Could not find middleware in module: ${mwConf.modulePath}`);
      }

      // Check if it's a class or direct object
      const mwInstance =
        typeof ClassRef === 'function' && ClassRef.prototype
          ? new ClassRef(mwConf.options ?? {})
          : ClassRef;

      this.agent.use(mwInstance);
    }

    this.isInitialized = true;
  }

  /**
   * Starts the runtime session. It polls for user input, feeds it to the agent,
   * handles outputs (real-time stream) and records history.
   * 
   * @param sessionId The session identifier for recording chat history.
   */
  async start(sessionId = 'default'): Promise<void> {
    await this.initialize();

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
   * Orderly shutdown of any spawned services and MCP Clients.
   */
  async close(): Promise<void> {
    await this.inputSource.close();
    await this.outputSink.close();

    // Close all MCP connections
    for (const mcpClient of this.mcpClients) {
      try {
        mcpClient.close();
      } catch {
        // Ignored
      }
    }
    this.mcpClients = [];
  }
}
