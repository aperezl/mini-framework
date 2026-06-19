# Middleware Hook System

Middlewares allow developers to intercept, monitor, modify, or block tool executions inside the agent loop. They are useful for logging, security checks, rate limiting, and output formatting.

---

## 1. The `Middleware` Interface

Middlewares are objects containing optional lifecycle hooks and an optional filter property:

```typescript
export interface MiddlewareContext {
  toolName: string;
  context?: any; // The request context passed to Agent.run()
}

export interface Middleware {
  /**
   * If provided, the middleware will only trigger for this specific tool.
   * If omitted, the middleware acts globally on all tools.
   */
  toolName?: string;

  /**
   * Runs before the tool's execute() method.
   * If this returns a value (other than undefined), it overrides/mutates the input parameters.
   */
  beforeExecute?(params: any, meta: MiddlewareContext): Promise<any> | any;

  /**
   * Runs after the tool's execute() method completes.
   * If this returns a value (other than undefined), it overrides/mutates the tool's result.
   */
  afterExecute?(result: any, params: any, meta: MiddlewareContext): Promise<any> | any;
}
```

---

## 2. Registering Middlewares

You can register middlewares either when instantiating the `Agent` or dynamically using `agent.use()`:

```typescript
import { Agent, ToolRegistry } from 'mini-framework';

const registry = new ToolRegistry();
const provider = new MyProvider();

// Option A: Pass in Agent constructor
const agent = new Agent(registry, provider, {
  middlewares: [myLoggingMiddleware],
});

// Option B: Register dynamically
agent.use(myPermissionMiddleware);
```

---

## 3. Practical Examples

### Example A: Global Timing Logger

This middleware runs globally, measuring execution latency for all tool calls:

```typescript
import type { Middleware } from 'mini-framework';

export const timingLogger: Middleware = {
  // Omit toolName to run globally

  beforeExecute(params, { toolName }) {
    console.log(`[Timer] Starting execution of tool: "${toolName}"`);
    // Store starting time on context or local scope if needed
    (params as any).__startTime = Date.now();
  },

  afterExecute(result, params, { toolName }) {
    const elapsed = Date.now() - (params.__startTime || Date.now());
    console.log(`[Timer] Finished tool "${toolName}" in ${elapsed}ms`);
  }
};
```

### Example B: Security Permission Guard

This middleware runs only for a specific sensitive tool (e.g. `deleteDatabaseRecord`) and checks if the calling user has administrator permissions via the request context:

```typescript
import { z } from 'zod';
import type { Middleware, Tool } from 'mini-framework';

// Sensitive tool definition
export const deleteUserTool: Tool = {
  name: 'deleteUser',
  description: 'Deletes a user account.',
  schema: z.object({ userId: z.string() }),
  async execute({ userId }) {
    return { success: true, deleted: userId };
  }
};

// Middleware to guard the tool
export const adminPermissionGuard: Middleware = {
  toolName: 'deleteUser', // Runs ONLY for deleteUser tool

  beforeExecute(params, { context }) {
    // Access context variables injected in Agent.run(messages, context)
    if (!context || context.role !== 'admin') {
      throw new Error(`Permission Denied: User role "${context?.role || 'guest'}" is unauthorized.`);
    }
    console.log(`[Guard] Authorization approved for user: ${context.userId}`);
  }
};
```

---

## Next Steps

To learn how to stream tokens and capture tool execution events in real time, see [5. Token & Event Streaming](./streaming.md).
