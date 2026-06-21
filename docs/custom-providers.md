# Custom LLM Providers Guide

The mini-framework is designed with clean architecture principles. The core agent loop is entirely decoupled from specific LLM providers and interacts with them solely via the `LLMProvider` port (interface).

This guide shows you how to create and register a custom LLM provider in the framework.

---

## The LLMProvider Interface

To build a custom provider, you must implement the `LLMProvider` interface exported from the framework. Here is its definition:

```typescript
import type { ChatMessage, LLMResponse, LLMStreamChunk } from 'mini-framework';

export interface LLMProvider {
  /**
   * Send a list of messages to the LLM and return the response.
   */
  chat(messages: ChatMessage[], options?: { tools?: any[] }): Promise<LLMResponse>;

  /**
   * Send a list of messages to the LLM and yield streaming chunks. (Optional)
   */
  chatStream?(
    messages: ChatMessage[],
    options?: { tools?: any[] }
  ): Promise<AsyncIterable<LLMStreamChunk>> | AsyncIterable<LLMStreamChunk>;
}
```

---

## Implementing a Custom Provider

Here is a complete example of a custom LLM provider that simulates responses. It can be easily adapted to use any third-party SDK (like OpenAI, Anthropic, Gemini, etc.) or a custom internal API.

### 1. Define the Provider Class

```typescript
import type { 
  LLMProvider, 
  ChatMessage, 
  LLMResponse, 
  LLMStreamChunk 
} from 'mini-framework';

export interface MyCustomProviderOptions {
  apiKey: string;
  temperature?: number;
}

export class MyCustomProvider implements LLMProvider {
  private apiKey: string;
  private temperature: number;

  constructor(options: MyCustomProviderOptions) {
    this.apiKey = options.apiKey;
    this.temperature = options.temperature ?? 0.7;
  }

  /**
   * Basic chat execution.
   */
  async chat(
    messages: ChatMessage[], 
    options?: { tools?: any[] }
  ): Promise<LLMResponse> {
    // 1. Format the conversation history to matches your LLM API format.
    // 2. Format the tools to JSON schemas if the LLM supports function calling.
    // 3. Make HTTP request or call SDK.
    
    // Simulating response:
    return {
      message: {
        role: 'assistant',
        content: 'This is a response from my custom provider!',
      },
      finish_reason: 'stop',
    };
  }

  /**
   * Optional: Streaming chat execution.
   */
  async *chatStream(
    messages: ChatMessage[],
    options?: { tools?: any[] }
  ): AsyncIterable<LLMStreamChunk> {
    // Yield tokens chunk by chunk
    const tokens = ['Hello', ' from', ' custom', ' stream!'];
    
    for (const token of tokens) {
      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 100));
      
      yield {
        content: token,
      };
    }

    yield {
      finish_reason: 'stop',
    };
  }
}
```

### 2. Using the Custom Provider in the Agent

Simply pass your custom provider instance to the `Agent` constructor:

```typescript
import { Agent, ToolRegistry } from 'mini-framework';
import { MyCustomProvider } from './my-custom-provider';

const registry = new ToolRegistry();
const provider = new MyCustomProvider({ apiKey: 'my-secret-key' });

const agent = new Agent(registry, provider);

const response = await agent.run([
  { role: 'user', content: 'Hello!' }
]);

console.log(response);
```
