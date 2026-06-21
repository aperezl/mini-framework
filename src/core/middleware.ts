import { ChatMessage, LLMResponse } from './ports/llm-provider';

export interface MiddlewareContext {
  toolName: string;
  context?: any;
}

export interface Middleware {
  /**
   * If specified, the tool-specific hooks (beforeExecute/afterExecute) will only
   * run for this tool name. If omitted, they run for all tools.
   */
  toolName?: string;

  /**
   * Hook executed before a tool is executed.
   * Can return modified parameters, or mutate params in place.
   */
  beforeExecute?(params: any, meta: MiddlewareContext): Promise<any> | any;

  /**
   * Hook executed after a tool finishes execution.
   * Can return a modified result.
   */
  afterExecute?(result: any, params: any, meta: MiddlewareContext): Promise<any> | any;

  /**
   * Hook executed before the agent calls the LLM provider.
   * Can return modified messages or return void to use the original messages.
   */
  beforeLLMCall?(messages: ChatMessage[], context?: any): Promise<ChatMessage[] | void> | ChatMessage[] | void;

  /**
   * Hook executed after the LLM provider returns a response, but before the agent processes it.
   * Can return a modified LLMResponse or return void to use the original response.
   */
  afterLLMCall?(response: LLMResponse, context?: any): Promise<LLMResponse | void> | LLMResponse | void;

  /**
   * Hook executed when a token or thinking chunk is streamed back in real-time.
   */
  onStreamToken?(token: string, type: 'token' | 'thinking', context?: any): Promise<void> | void;
}
