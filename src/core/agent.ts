import { ToolRegistry } from './registry';
import { executeTool } from '../schemas/tool';
import { Middleware } from './middleware';
import {
  ToolCall,
  UserMessage,
  AssistantMessage,
  SystemMessage,
  ToolMessage,
  ChatMessage,
  LLMResponse,
  LLMStreamChunk,
  LLMProvider,
} from './ports/llm-provider';

export type {
  ToolCall,
  UserMessage,
  AssistantMessage,
  SystemMessage,
  ToolMessage,
  ChatMessage,
  LLMResponse,
  LLMStreamChunk,
  LLMProvider,
};

export type AgentStreamChunk =
  | { type: 'token'; content: string }
  | { type: 'thinking'; content: string }
  | { type: 'tool_call_start'; toolCallId: string; name: string }
  | { type: 'tool_call_end'; toolCallId: string; name: string; result: any }
  | { type: 'error'; message: string };

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
      
      // Run beforeLLMCall middlewares
      let currentMessages = [...history];
      for (const mw of this.middlewares) {
        if (mw.beforeLLMCall) {
          const res = await mw.beforeLLMCall(currentMessages, context);
          if (res !== undefined) {
            currentMessages = res;
          }
        }
      }

      const tools = this.registry.getDefinitions();
      let response = await this.provider.chat(currentMessages, tools.length > 0 ? { tools } : undefined);
      
      // Run afterLLMCall middlewares
      for (const mw of this.middlewares) {
        if (mw.afterLLMCall) {
          const res = await mw.afterLLMCall(response, context);
          if (res !== undefined) {
            response = res;
          }
        }
      }

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

            // Run beforeLLMCall middlewares
            let currentMessages = [...history];
            for (const mw of self.middlewares) {
              if (mw.beforeLLMCall) {
                const res = await mw.beforeLLMCall(currentMessages, context);
                if (res !== undefined) {
                  currentMessages = res;
                }
              }
            }

            const tools = self.registry.getDefinitions();
            const stream = await self.provider.chatStream!(
              currentMessages,
              tools.length > 0 ? { tools } : undefined
            );

            let accumulatedContent = '';
            let accumulatedThinking = '';
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
                // Run onStreamToken middlewares
                for (const mw of self.middlewares) {
                  if (mw.onStreamToken) {
                    await mw.onStreamToken(chunk.content, 'token', context);
                  }
                }
                controller.enqueue({ type: 'token', content: chunk.content });
              }

              if (chunk.thinking) {
                accumulatedThinking += chunk.thinking;
                // Run onStreamToken middlewares
                for (const mw of self.middlewares) {
                  if (mw.onStreamToken) {
                    await mw.onStreamToken(chunk.thinking, 'thinking', context);
                  }
                }
                controller.enqueue({ type: 'thinking', content: chunk.thinking });
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
            if (accumulatedThinking) {
              assistantMsg.thinking = accumulatedThinking;
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

            let responseObj: LLMResponse = {
              message: assistantMsg,
              finish_reason: assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0 ? 'tool_calls' : (finalFinishReason || 'stop'),
            };

            // Run afterLLMCall middlewares
            for (const mw of self.middlewares) {
              if (mw.afterLLMCall) {
                const res = await mw.afterLLMCall(responseObj, context);
                if (res !== undefined) {
                  responseObj = res;
                }
              }
            }

            history.push(responseObj.message);

            // Determine if we should exit
            if (
              responseObj.message.role !== 'assistant' ||
              !responseObj.message.tool_calls ||
              responseObj.message.tool_calls.length === 0
            ) {
              controller.close();
              return;
            }

            // Process tool calls
            for (const toolCall of responseObj.message.tool_calls) {
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
