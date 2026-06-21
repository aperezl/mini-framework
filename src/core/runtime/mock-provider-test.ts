import { LLMProvider, LLMResponse, LLMStreamChunk } from '../ports/llm-provider';

export default class MockProvider implements LLMProvider {
  async chat(): Promise<LLMResponse> {
    return {
      message: { role: 'assistant', content: 'custom-loaded-response' },
      finish_reason: 'stop',
    };
  }

  async *chatStream(): AsyncIterable<LLMStreamChunk> {
    yield { content: 'custom-loaded-response-token' };
    yield { finish_reason: 'stop' };
  }
}
