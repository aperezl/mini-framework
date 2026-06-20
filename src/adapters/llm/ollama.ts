import {
  LLMProvider,
  ChatMessage,
  LLMResponse,
  LLMStreamChunk,
} from '../../core/ports/llm-provider';

export interface OllamaProviderOptions {
  model?: string;
  host?: string;
}

export class OllamaProvider implements LLMProvider {
  private model: string;
  private host: string;

  constructor(options: OllamaProviderOptions = {}) {
    this.model = options.model ?? 'llama3.1';
    this.host = options.host ?? 'http://localhost:11434';
  }

  private formatMessages(messages: ChatMessage[]): any[] {
    return messages.map((msg) => {
      if (msg.role === 'assistant') {
        const formatted: any = {
          role: 'assistant',
        };
        if (msg.content) {
          formatted.content = msg.content;
        }
        if (msg.tool_calls && msg.tool_calls.length > 0) {
          formatted.tool_calls = msg.tool_calls.map((tc) => {
            let parsedArgs = tc.function.arguments;
            if (typeof parsedArgs === 'string') {
              try {
                parsedArgs = JSON.parse(parsedArgs);
              } catch {
                // Keep string if not parseable JSON
              }
            }
            return {
              id: tc.id,
              type: 'function',
              function: {
                name: tc.function.name,
                arguments: parsedArgs,
              },
            };
          });
        }
        return formatted;
      }

      if (msg.role === 'tool') {
        return {
          role: 'tool',
          content: msg.content,
          name: msg.name,
        };
      }

      return {
        role: msg.role,
        content: msg.content,
      };
    });
  }

  private formatTools(tools?: any[]): any[] | undefined {
    if (!tools || tools.length === 0) return undefined;
    return tools.map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
  }

  async chat(messages: ChatMessage[], options?: { tools?: any[] }): Promise<LLMResponse> {
    const formattedMessages = this.formatMessages(messages);
    const formattedTools = this.formatTools(options?.tools);

    const payload = {
      model: this.model,
      messages: formattedMessages,
      tools: formattedTools,
      stream: false,
    };

    const response = await fetch(`${this.host}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`Ollama API error (${response.status}): ${errorText}`);
    }

    const result = (await response.json()) as {
      message: {
        role: string;
        content?: string | null;
        tool_calls?: Array<{
          id?: string;
          function: { name: string; arguments: any };
        }>;
      };
      done_reason?: string;
    };

    const ollamaMsg = result.message;
    const toolCalls = ollamaMsg.tool_calls?.map((tc) => {
      const args = tc.function.arguments;
      return {
        id: tc.id || `call_${Math.random().toString(36).slice(2, 11)}`,
        type: 'function' as const,
        function: {
          name: tc.function.name,
          arguments: typeof args === 'string' ? args : JSON.stringify(args),
        },
      };
    });

    const finishReason = result.done_reason === 'load' ? 'stop' : (result.done_reason || 'stop');

    return {
      message: {
        role: 'assistant',
        content: ollamaMsg.content ?? null,
        ...(toolCalls && toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
      },
      finish_reason: toolCalls && toolCalls.length > 0 ? 'tool_calls' : finishReason,
    };
  }

  async *chatStream(
    messages: ChatMessage[],
    options?: { tools?: any[] }
  ): AsyncIterable<LLMStreamChunk> {
    const formattedMessages = this.formatMessages(messages);
    const formattedTools = this.formatTools(options?.tools);

    const payload = {
      model: this.model,
      messages: formattedMessages,
      tools: formattedTools,
      stream: true,
    };

    const response = await fetch(`${this.host}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`Ollama API error (${response.status}): ${errorText}`);
    }

    const body = response.body;
    if (!body) {
      throw new Error('No response body from Ollama streaming API');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    // Consume the stream
    for await (const chunkBytes of body as any) {
      buffer += decoder.decode(chunkBytes, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        let data: any;
        try {
          data = JSON.parse(line);
        } catch {
          continue;
        }

        const msgChunk = data.message;
        const delta: LLMStreamChunk = {};

        if (msgChunk?.content) {
          delta.content = msgChunk.content;
        }

        if (msgChunk?.tool_calls && msgChunk.tool_calls.length > 0) {
          delta.tool_calls_delta = msgChunk.tool_calls.map((tc: any, index: number) => {
            const args = tc.function.arguments;
            return {
              index,
              id: tc.id || `call_${Math.random().toString(36).slice(2, 11)}`,
              type: 'function' as const,
              function: {
                name: tc.function.name,
                arguments: typeof args === 'string' ? args : JSON.stringify(args),
              },
            };
          });
        }

        if (data.done) {
          const finalReason = data.done_reason === 'load' ? 'stop' : (data.done_reason || 'stop');
          delta.finish_reason = msgChunk?.tool_calls && msgChunk.tool_calls.length > 0 ? 'tool_calls' : finalReason;
        }

        yield delta;
      }
    }

    // Process leftover buffer if any
    if (buffer.trim()) {
      try {
        const data = JSON.parse(buffer);
        const msgChunk = data.message;
        const delta: LLMStreamChunk = {};

        if (msgChunk?.content) {
          delta.content = msgChunk.content;
        }

        if (msgChunk?.tool_calls && msgChunk.tool_calls.length > 0) {
          delta.tool_calls_delta = msgChunk.tool_calls.map((tc: any, index: number) => {
            const args = tc.function.arguments;
            return {
              index,
              id: tc.id || `call_${Math.random().toString(36).slice(2, 11)}`,
              type: 'function' as const,
              function: {
                name: tc.function.name,
                arguments: typeof args === 'string' ? args : JSON.stringify(args),
              },
            };
          });
        }

        if (data.done) {
          const finalReason = data.done_reason === 'load' ? 'stop' : (data.done_reason || 'stop');
          delta.finish_reason = msgChunk?.tool_calls && msgChunk.tool_calls.length > 0 ? 'tool_calls' : finalReason;
        }

        yield delta;
      } catch {
        // Ignored
      }
    }
  }
}
