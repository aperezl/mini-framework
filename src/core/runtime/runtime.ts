import path from 'node:path';
import { Agent } from '../agent';
import { ToolRegistry } from '../registry';
import { OllamaProvider } from '../../adapters/llm/ollama';
import { SQLiteMemoryAdapter } from '../../storage/sqlite';
import { ChatMessage, LLMProvider } from '../ports/llm-provider';
import { YAMLConfig } from './config-schema';
import { InputSource, OutputSink, StdioInputSource, StdioOutputSink } from './io';
import { MCPClient } from '../mcp';

// --- Strategy Types ---

type ProviderLoader = (
  provConfig: YAMLConfig['agent']['provider'],
  passed?: LLMProvider
) => Promise<LLMProvider> | LLMProvider;

type StorageLoader = (
  storageConfig: NonNullable<YAMLConfig['storage']>
) => SQLiteMemoryAdapter;

type ToolLoader = (
  toolConf: YAMLConfig['tools'][number],
  registry: ToolRegistry,
  mcpClients: MCPClient[]
) => Promise<void>;

// --- Strategy Map Implementations ---

const providerStrategies: Record<string, ProviderLoader> = {
  ollama: (provConfig) => {
    return new OllamaProvider({
      model: provConfig.model,
      host: provConfig.host,
    });
  },
  custom: async (provConfig, passed) => {
    if (passed) return passed;
    if (!provConfig.modulePath) {
      throw new Error('Custom provider specified without modulePath');
    }
    const absolutePath = path.isAbsolute(provConfig.modulePath)
      ? provConfig.modulePath
      : path.resolve(process.cwd(), provConfig.modulePath);

    const mod = await import(absolutePath);
    const ClassRef = provConfig.className
      ? mod[provConfig.className]
      : mod.default;

    if (!ClassRef) {
      throw new Error(
        `Could not find class reference in module: ${provConfig.modulePath}`
      );
    }
    return new ClassRef(provConfig.options ?? {});
  },
};

const storageStrategies: Record<string, StorageLoader> = {
  sqlite: (storageConfig) => {
    const dbPath = storageConfig.dbPath ?? ':memory:';
    return new SQLiteMemoryAdapter(dbPath);
  },
};

const toolStrategies: Record<'modulePath' | 'mcp', ToolLoader> = {
  modulePath: async (toolConf, registry) => {
    if (!toolConf.modulePath) return;
    const absolutePath = path.isAbsolute(toolConf.modulePath)
      ? toolConf.modulePath
      : path.resolve(process.cwd(), toolConf.modulePath);

    const mod = await import(absolutePath);
    const toolInstance = toolConf.name ? mod[toolConf.name] : mod.default;
    if (!toolInstance || typeof toolInstance.execute !== 'function') {
      throw new Error(`Invalid tool exported from module: ${toolConf.modulePath}`);
    }
    registry.register(toolInstance);
  },
  mcp: async (toolConf, registry, mcpClients) => {
    if (!toolConf.mcp) return;
    const mcpClient = new MCPClient(
      toolConf.mcp.command,
      toolConf.mcp.args ?? []
    );
    await mcpClient.connect();
    mcpClients.push(mcpClient);

    const remoteTools = await mcpClient.listTools();
    for (const remoteTool of remoteTools) {
      registry.register(remoteTool);
    }
  },
};

// --- AgentRuntime Class ---

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
   * tools, middlewares, and establishing MCP connections using Strategy Pattern.
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    const config = this.config;

    // 1. Configure LLM Provider using Provider Strategies
    const providerLoader = providerStrategies[config.agent.provider.type];
    if (!providerLoader) {
      throw new Error(`Unsupported provider type: ${config.agent.provider.type}`);
    }
    this.provider = await providerLoader(config.agent.provider, this.customProviderPassed);

    // 2. Instantiate Agent
    this.agent = new Agent(this.registry, this.provider, {
      maxIterations: config.agent.maxIterations,
    });

    // 3. Configure Storage using Storage Strategies
    if (config.storage) {
      const storageLoader = storageStrategies[config.storage.type];
      if (!storageLoader) {
        throw new Error(`Unsupported storage type: ${config.storage.type}`);
      }
      this.storage = storageLoader(config.storage);
    }

    // 4. Configure Dynamic Tools & MCP Servers using Tool Strategies
    for (const toolConf of config.tools) {
      const toolType = toolConf.mcp ? 'mcp' : 'modulePath';
      await toolStrategies[toolType](toolConf, this.registry, this.mcpClients);
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
