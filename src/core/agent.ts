import { ToolRegistry } from './registry';
import { executeTool } from '../schemas/tool';
import { Middleware } from './middleware';

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

export interface LLMStreamChunk {
  content?: string;
  tool_calls_delta?: Array<{
    index: number;
    id?: string;
    type?: 'function';
    function?: {
      name?: string;
      arguments?: string;
    };
  }>;
  finish_reason?: 'stop' | 'tool_calls' | string | null;
}

export type AgentStreamChunk =
  | { type: 'token'; content: string }
  | { type: 'tool_call_start'; toolCallId: string; name: string }
  | { type: 'tool_call_end'; toolCallId: string; name: string; result: any }
  | { type: 'error'; message: string };

export interface LLMProvider {
  chat(messages: ChatMessage[], options?: { tools?: any[] }): Promise<LLMResponse>;
  chatStream?(
    messages: ChatMessage[],
    options?: { tools?: any[] }
  ): Promise<AsyncIterable<LLMStreamChunk>> | AsyncIterable<LLMStreamChunk>;
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

  runStream(messages: ChatMessage[], context?: any): ReadableStream<AgentStreamChunk> {
    if (!this.provider.chatStream) {
      throw new Error('Streaming is not supported by the current provider.');
    }

    const self = this;
    const history = [...messages];

    return new ReadableStream<AgentStreamChunk>({
      async start(controller) {
        let iterations = 0;
        try {
          while (iterations < self.maxIterations) {
            iterations++;

            const tools = self.registry.getDefinitions();
            const stream = await self.provider.chatStream!(
              history,
              tools.length > 0 ? { tools } : undefined
            );

            let accumulatedContent = '';
            const accumulatedToolCalls: Array<{
              id?: string;
              type?: 'function';
              function?: {
                name?: string;
                arguments?: string;
              };
            }> = [];

            let finalFinishReason: string | null = null;

            for await (const chunk of stream) {
              if (chunk.content) {
                accumulatedContent += chunk.content;
                controller.enqueue({ type: 'token', content: chunk.content });
              }

              if (chunk.tool_calls_delta) {
                for (const delta of chunk.tool_calls_delta) {
                  const idx = delta.index;
                  if (!accumulatedToolCalls[idx]) {
                    accumulatedToolCalls[idx] = {};
                  }
                  const tc = accumulatedToolCalls[idx];
                  if (delta.id) tc.id = delta.id;
                  if (delta.type) tc.type = delta.type;
                  if (delta.function) {
                    if (!tc.function) tc.function = {};
                    if (delta.function.name) tc.function.name = delta.function.name;
                    if (delta.function.arguments) {
                      tc.function.arguments = (tc.function.arguments || '') + delta.function.arguments;
                    }
                  }
                }
              }

              if (chunk.finish_reason) {
                finalFinishReason = chunk.finish_reason;
              }
            }

            // Build reconstructed AssistantMessage
            const assistantMsg: AssistantMessage = {
              role: 'assistant',
            };
            if (accumulatedContent) {
              assistantMsg.content = accumulatedContent;
            }
            if (accumulatedToolCalls.length > 0) {
              assistantMsg.tool_calls = accumulatedToolCalls.map((tc) => {
                return {
                  id: tc.id || '',
                  type: 'function',
                  function: {
                    name: tc.function?.name || '',
                    arguments: tc.function?.arguments || '',
                  },
                };
              });
            }

            history.push(assistantMsg);

            // Determine if we should exit
            if (
              finalFinishReason === 'stop' ||
              assistantMsg.tool_calls === undefined ||
              assistantMsg.tool_calls.length === 0
            ) {
              controller.close();
              return;
            }

            // Process tool calls
            for (const toolCall of assistantMsg.tool_calls) {
              const toolName = toolCall.function.name;
              const tool = self.registry.get(toolName);

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

              controller.enqueue({
                type: 'tool_call_start',
                toolCallId: toolCall.id,
                name: toolName,
              });

              // Run beforeExecute middlewares
              let currentParams = parsedArgs;
              for (const mw of self.middlewares) {
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
              for (const mw of self.middlewares) {
                if (mw.toolName && mw.toolName !== toolName) continue;
                if (mw.afterExecute) {
                  const res = await mw.afterExecute(result, currentParams, { toolName, context });
                  if (res !== undefined) {
                    result = res;
                  }
                }
              }

              controller.enqueue({
                type: 'tool_call_end',
                toolCallId: toolCall.id,
                name: toolName,
                result,
              });

              history.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                name: toolName,
                content: typeof result === 'string' ? result : JSON.stringify(result),
              });
            }
          }

          throw new Error(`Agent run exceeded maxIterations of ${self.maxIterations}`);
        } catch (error: any) {
          controller.enqueue({
            type: 'error',
            message: error instanceof Error ? error.message : String(error),
          });
          controller.close();
        }
      },
    });
  }
}
