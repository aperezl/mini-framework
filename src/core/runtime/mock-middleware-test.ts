import { Middleware } from '../middleware';

export class MockMiddleware implements Middleware {
  beforeLLMCall(messages: any[]) {
    // Modify prompt
    return [...messages, { role: 'user', content: 'middleware-injected' }];
  }
}
export default MockMiddleware;
