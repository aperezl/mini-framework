import { ToolRegistry } from './registry.js';
import { executeTool } from '../schemas/tool.js';
import { Middleware } from './middleware.js';

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface UserMessage {
  role: 'user';
  content: string;
}

export interface AssistantMessage {
  role: 'assistant';
  content?: string | null;
  tool_calls?: ToolCall[];
}

export interface SystemMessage {
  role: 'system';
  content: string;
}

export interface ToolMessage {
  role: 'tool';
  tool_call_id: string;
  name: string;
  content: string;
}

export type ChatMessage = UserMessage | AssistantMessage | SystemMessage | ToolMessage;

export interface LLMResponse {
  message: ChatMessage;
  finish_reason: 'stop' | 'tool_calls' | string;
}

export interface LLMProvider {
  chat(messages: ChatMessage[], options?: { tools?: any[] }): Promise<LLMResponse>;
}

export interface AgentOptions {
  maxIterations?: number;
  middlewares?: Middleware[];
}

export class Agent {
  private registry: ToolRegistry;
  private provider: LLMProvider;
  private maxIterations: number;
  private middlewares: Middleware[] = [];

  constructor(registry: ToolRegistry, provider: LLMProvider, options: AgentOptions = {}) {
    this.registry = registry;
    this.provider = provider;
    this.maxIterations = options.maxIterations ?? 10;
    this.middlewares = options.middlewares ?? [];
  }

  use(middleware: Middleware): void {
    this.middlewares.push(middleware);
  }

  async run(messages: ChatMessage[], context?: any): Promise<ChatMessage[]> {
    const history = [...messages];
    let iterations = 0;

    while (iterations < this.maxIterations) {
      iterations++;
      
      const tools = this.registry.getDefinitions();
      const response = await this.provider.chat(history, tools.length > 0 ? { tools } : undefined);
      
      // Add response message to history
      history.push(response.message);

      // If stopped or not assistant/no tool calls, return history
      if (
        response.finish_reason === 'stop' ||
        response.message.role !== 'assistant' ||
        !response.message.tool_calls ||
        response.message.tool_calls.length === 0
      ) {
        return history;
      }

      // Process tool calls
      for (const toolCall of response.message.tool_calls) {
        const toolName = toolCall.function.name;
        const tool = this.registry.get(toolName);

        if (!tool) {
          throw new Error(`Tool not found in registry: "${toolName}"`);
        }

        let parsedArgs: any;
        try {
          parsedArgs = JSON.parse(toolCall.function.arguments);
        } catch (e) {
          throw new Error(
            `Failed to parse arguments for tool "${toolName}": ${
              e instanceof Error ? e.message : String(e)
            }`
          );
        }

        // Run beforeExecute middlewares
        let currentParams = parsedArgs;
        for (const mw of this.middlewares) {
          if (mw.toolName && mw.toolName !== toolName) continue;
          if (mw.beforeExecute) {
            const res = await mw.beforeExecute(currentParams, { toolName, context });
            if (res !== undefined) {
              currentParams = res;
            }
          }
        }

        // Execute the tool
        let result = await executeTool(tool, currentParams, context);

        // Run afterExecute middlewares
        for (const mw of this.middlewares) {
          if (mw.toolName && mw.toolName !== toolName) continue;
          if (mw.afterExecute) {
            const res = await mw.afterExecute(result, currentParams, { toolName, context });
            if (res !== undefined) {
              result = res;
            }
          }
        }
        
        history.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: toolName,
          content: typeof result === 'string' ? result : JSON.stringify(result),
        });
      }
    }

    throw new Error(`Agent run exceeded maxIterations of ${this.maxIterations}`);
  }
}
