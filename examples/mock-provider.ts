import { LLMProvider, ChatMessage, LLMResponse, LLMStreamChunk } from '../src/index';

export class MockLLMProvider implements LLMProvider {
  constructor(
    private responses: Array<{
      trigger?: string;
      message: ChatMessage;
      finish_reason: string;
      streamChunks?: LLMStreamChunk[];
    }> = []
  ) {}

  async chat(messages: ChatMessage[], options?: { tools?: any[] }): Promise<LLMResponse> {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    const lastUserText = lastUserMsg ? lastUserMsg.content : '';

    // Find custom response trigger
    for (const item of this.responses) {
      if (item.trigger && lastUserText?.includes(item.trigger)) {
        return {
          message: item.message,
          finish_reason: item.finish_reason,
        };
      }
    }

    // Default response logic:
    // If last message is a tool response, finalize the query
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role === 'tool') {
      return {
        message: {
          role: 'assistant',
          content: `El resultado final es: ${lastMsg.content}.`,
        },
        finish_reason: 'stop',
      };
    }

    // If tools are registered, request a tool call
    if (options?.tools && options.tools.length > 0) {
      const tool = options.tools[0];
      // Try to parse numbers from user text
      let a = 10, b = 20;
      const match = lastUserText?.match(/(\d+)\s*[\+\-\*\/s\w]+\s*(\d+)/);
      if (match) {
        a = Number(match[1]);
        b = Number(match[2]);
      }

      return {
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: 'call_mock_1',
              type: 'function',
              function: {
                name: tool.name,
                arguments: JSON.stringify({
                  a,
                  b,
                  x: a,
                  y: b,
                  text: lastUserText,
                }),
              },
            },
          ],
        },
        finish_reason: 'tool_calls',
      };
    }

    // Return default response
    return {
      message: {
        role: 'assistant',
        content: '¡Hola! Soy el Agente Orquestador del mini-framework en modo offline.',
      },
      finish_reason: 'stop',
    };
  }

  async *chatStream(
    messages: ChatMessage[],
    options?: { tools?: any[] }
  ): AsyncIterable<LLMStreamChunk> {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    const lastUserText = lastUserMsg ? lastUserMsg.content : '';

    // Find custom response trigger
    for (const item of this.responses) {
      if (item.trigger && lastUserText?.includes(item.trigger) && item.streamChunks) {
        for (const chunk of item.streamChunks) {
          yield chunk;
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        return;
      }
    }

    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role === 'tool') {
      yield { content: 'El resultado ', finish_reason: null };
      yield { content: `final obtenido es ${lastMsg.content}.`, finish_reason: 'stop' };
      return;
    }

    if (options?.tools && options.tools.length > 0) {
      const tool = options.tools[0];
      let a = 10, b = 5;
      const match = lastUserText?.match(/(\d+)\s*[\+\-\*\/s\w]+\s*(\d+)/);
      if (match) {
        a = Number(match[1]);
        b = Number(match[2]);
      }

      yield {
        tool_calls_delta: [
          {
            index: 0,
            id: 'call_mock_stream_1',
            type: 'function',
            function: {
              name: tool.name,
              arguments: '{"a":',
            },
          },
        ],
        finish_reason: null,
      };
      await new Promise((resolve) => setTimeout(resolve, 50));

      yield {
        tool_calls_delta: [
          {
            index: 0,
            function: {
              arguments: ` ${a}, "b": ${b}}`,
            },
          },
        ],
        finish_reason: 'tool_calls',
      };
      return;
    }

    yield { content: '¡Hola! ', finish_reason: null };
    yield { content: 'Soy el Agente en modo ', finish_reason: null };
    yield { content: 'Streaming Mock interactivo.', finish_reason: 'stop' };
  }
}
