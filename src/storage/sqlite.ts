import { DatabaseSync } from 'node:sqlite';
import { ChatMessage, ToolCall } from '../core/agent';

export interface MemoryAdapter {
  getHistory(sessionId: string): Promise<ChatMessage[]>;
  saveMessage(sessionId: string, message: ChatMessage): Promise<void>;
}

export class SQLiteMemoryAdapter implements MemoryAdapter {
  private db: DatabaseSync;

  constructor(dbOrPath: string | DatabaseSync) {
    if (typeof dbOrPath === 'string') {
      this.db = new DatabaseSync(dbOrPath);
    } else {
      this.db = dbOrPath;
    }
    this.init();
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT,
        tool_calls TEXT,
        tool_call_id TEXT,
        name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id)
    `);
  }

  async getHistory(sessionId: string): Promise<ChatMessage[]> {
    const stmt = this.db.prepare(`
      SELECT role, content, tool_calls, tool_call_id, name
      FROM messages
      WHERE session_id = ?
      ORDER BY id ASC
    `);
    
    const rows = stmt.all(sessionId) as Array<{
      role: string;
      content: string | null;
      tool_calls: string | null;
      tool_call_id: string | null;
      name: string | null;
    }>;

    return rows.map((row): ChatMessage => {
      const role = row.role;
      if (role === 'user') {
        return {
          role: 'user',
          content: row.content || '',
        };
      } else if (role === 'system') {
        return {
          role: 'system',
          content: row.content || '',
        };
      } else if (role === 'tool') {
        return {
          role: 'tool',
          tool_call_id: row.tool_call_id || '',
          name: row.name || '',
          content: row.content || '',
        };
      } else if (role === 'assistant') {
        const msg: ChatMessage = {
          role: 'assistant',
        };
        if (row.content !== null) {
          msg.content = row.content;
        }
        if (row.tool_calls !== null) {
          msg.tool_calls = JSON.parse(row.tool_calls) as ToolCall[];
        }
        return msg;
      }
      throw new Error(`Unknown role: ${role}`);
    });
  }

  async saveMessage(sessionId: string, message: ChatMessage): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO messages (session_id, role, content, tool_calls, tool_call_id, name)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    let content: string | null = null;
    let toolCalls: string | null = null;
    let toolCallId: string | null = null;
    let name: string | null = null;

    if (message.role === 'user' || message.role === 'system') {
      content = message.content;
    } else if (message.role === 'tool') {
      content = message.content;
      toolCallId = message.tool_call_id;
      name = message.name;
    } else if (message.role === 'assistant') {
      content = message.content ?? null;
      if (message.tool_calls) {
        toolCalls = JSON.stringify(message.tool_calls);
      }
    }

    stmt.run(sessionId, message.role, content, toolCalls, toolCallId, name);
  }
}
