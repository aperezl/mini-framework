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

export interface LLMProvider {
  chat(messages: ChatMessage[], options?: { tools?: any[] }): Promise<LLMResponse>;
  chatStream?(
    messages: ChatMessage[],
    options?: { tools?: any[] }
  ): Promise<AsyncIterable<LLMStreamChunk>> | AsyncIterable<LLMStreamChunk>;
}
