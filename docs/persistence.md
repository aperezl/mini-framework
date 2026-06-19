# SQLite Persistence & History

Maintaining chat history across multiple agent execution sessions is critical for long-running workflows and persistent chats. The framework offers a local-first adapter utilizing the native Node.js SQLite module (`node:sqlite`).

---

## 1. The `MemoryAdapter` Interface

The framework generalizes persistence using the `MemoryAdapter` interface:

```typescript
import type { ChatMessage } from 'mini-framework';

export interface MemoryAdapter {
  /**
   * Retrieves all chat messages associated with a sessionId, sorted chronologically.
   */
  getHistory(sessionId: string): Promise<ChatMessage[]>;

  /**
   * Appends a new message (user, assistant, tool, system) to the history.
   */
  saveMessage(sessionId: string, message: ChatMessage): Promise<void>;
}
```

---

## 2. Using `SQLiteMemoryAdapter`

`SQLiteMemoryAdapter` implements `MemoryAdapter`. It initializes a `messages` table automatically and serializes complex fields like tool calls as JSON strings in the database.

### Table Schema

The adapter creates the following schema:
```sql
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT,
  tool_calls TEXT,     -- Serialized JSON array of ToolCall objects
  tool_call_id TEXT,   -- ID of the matching ToolCall (for 'tool' role)
  name TEXT,           -- Name of the executed tool (for 'tool' role)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
```

### Initializing the Adapter

You can initialize the adapter by passing either a file path or an existing `DatabaseSync` instance (from `node:sqlite`):

```typescript
import { SQLiteMemoryAdapter } from 'mini-framework';
import { DatabaseSync } from 'node:sqlite';

// Option A: Pass a file path
const dbAdapter = new SQLiteMemoryAdapter('./chat_history.db');

// Option B: Pass an in-memory database instance
const memDb = new DatabaseSync(':memory:');
const memoryAdapter = new SQLiteMemoryAdapter(memDb);
```

---

## 3. End-to-End Chat History Integration

Here is a full pattern to load history, append a new user request, execute the agent loop, and save the subsequent assistant and tool messages back to the database.

```typescript
import { Agent, ToolRegistry, SQLiteMemoryAdapter } from 'mini-framework';
import { MyLLMProvider } from './my-provider';

// 1. Initialize core registry and adapter
const registry = new ToolRegistry();
const adapter = new SQLiteMemoryAdapter('./my_chat.db');
const agent = new Agent(registry, new MyLLMProvider());

// 2. Define the session context
const sessionId = 'session_user_456';

// 3. Retrieve prior conversation history
const history = await adapter.getHistory(sessionId);
console.log(`Loaded ${history.length} previous message(s) from database.`);

// 4. Create and save a new user message
const newUserMessage = {
  role: 'user' as const,
  content: 'What is 10 + 20?',
};
await adapter.saveMessage(sessionId, newUserMessage);
history.push(newUserMessage);

// 5. Run the agent execution loop with the historical context
// This will return all messages (including any tool calls & assistant replies)
const finalHistory = await agent.run(history);

// 6. Persist only the newly generated messages to the database
// (The first history.length messages are already stored)
const newMessages = finalHistory.slice(history.length);
for (const msg of newMessages) {
  await adapter.saveMessage(sessionId, msg);
}

console.log('Conversation successfully updated and persisted.');
```

---

## Next Steps

To learn how to intercept and validate tool parameters or format outputs before saving them to the database, read [4. Middleware Hook System](./middleware.md).
