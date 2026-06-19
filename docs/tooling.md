# Tooling & Registry

Tools are the core building blocks of agent capability. They allow the agent to interface with the outside world (APIs, databases, file systems, etc.) by declaring their input schema and behavior.

---

## Key Interfaces and Helper Functions

The mini-framework exposes three main tooling primitives:
1. **`Tool` interface:** Defines the contract for all tools.
2. **`ToolRegistry` class:** Houses active tools, prevents naming collisions, and exports JSON schema definitions for LLMs.
3. **`executeTool()` function:** Validates input parameters at runtime using Zod before triggering the tool's execution handler.

---

## 1. Defining a Tool with Zod

Every tool implements the `Tool` interface:
```typescript
import { z } from 'zod';
import type { Tool } from 'mini-framework';

// 1. Define the input parameters using Zod
export const AddSchema = z.object({
  a: z.number().describe('The first operand'),
  b: z.number().describe('The second operand'),
});

// 2. Build the Tool instance matching the interface
export const addTool: Tool<typeof AddSchema, number> = {
  name: 'add',
  description: 'Adds two numbers together.',
  schema: AddSchema,
  async execute({ a, b }, context) {
    // 'context' can be optionally injected by the Agent/Caller
    return a + b;
  },
};
```

---

## 2. Using the ToolRegistry

The `ToolRegistry` handles registration, naming collision prevention, and exporting LLM-compatible tool schemas.

```typescript
import { ToolRegistry } from 'mini-framework';
import { addTool } from './add-tool';

const registry = new ToolRegistry();

// Register the tool
registry.register(addTool);

// Registering a tool with the same name throws a collision error:
// Error: Tool duplicate collision error: Tool with name "add" is already registered.
try {
  registry.register(addTool);
} catch (error) {
  console.log(error.message);
}
```

### Retrieving JSON Schemas for LLMs

To feed tools to an LLM provider, get the JSON Schema representations:
```typescript
const toolDefinitions = registry.getDefinitions();
console.log(JSON.stringify(toolDefinitions, null, 2));
```

**Output format:**
```json
[
  {
    "name": "add",
    "description": "Adds two numbers together.",
    "parameters": {
      "type": "object",
      "properties": {
        "a": { "type": "number", "description": "The first operand" },
        "b": { "type": "number", "description": "The second operand" }
      },
      "required": ["a", "b"]
    }
  }
]
```

---

## 3. Runtime Validation with `executeTool`

When an LLM requests a tool execution, its arguments are passed as a JSON string. To safely execute the tool, use the `executeTool` utility. It verifies parameters against the Zod schema before calling the tool's `execute` method:

```typescript
import { executeTool } from 'mini-framework';
import { addTool } from './add-tool';

const rawArguments = { a: 5, b: 10 };

const result = await executeTool(addTool, rawArguments);
console.log(result); // 15

// If invalid arguments are passed, it throws a validation error:
try {
  await executeTool(addTool, { a: "five", b: 10 });
} catch (error) {
  // Error: Tool validation error for "add": {"a": {"_errors": ["Expected number, received string"]}}
  console.error(error.message);
}
```

---

## Next Steps

To see how registered tools are automatically queried and executed inside the agent loop, check out [2. Agent Loop, Message Types & Context](./agent-loop.md).
