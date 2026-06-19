import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { SQLiteMemoryAdapter } from './sqlite';
import { ChatMessage } from '../core/agent';

describe('SQLiteMemoryAdapter', () => {
  it('saves and retrieves basic messages in order', async () => {
    const db = new DatabaseSync(':memory:');
    const adapter = new SQLiteMemoryAdapter(db);
    const sessionId = 'session_1';

    const m1: ChatMessage = { role: 'user', content: 'Hello there' };
    const m2: ChatMessage = { role: 'assistant', content: 'Hi! How can I help?' };

    await adapter.saveMessage(sessionId, m1);
    await adapter.saveMessage(sessionId, m2);

    const history = await adapter.getHistory(sessionId);
    expect(history).toHaveLength(2);
    expect(history[0]).toEqual(m1);
    expect(history[1]).toEqual(m2);
  });

  it('saves and retrieves assistant messages with tool calls and tool results', async () => {
    const db = new DatabaseSync(':memory:');
    const adapter = new SQLiteMemoryAdapter(db);
    const sessionId = 'session_2';

    const toolCallMsg: ChatMessage = {
      role: 'assistant',
      tool_calls: [
        {
          id: 'call_abc',
          type: 'function',
          function: {
            name: 'calculate',
            arguments: '{"expression":"2+2"}',
          },
        },
      ],
    };

    const toolResultMsg: ChatMessage = {
      role: 'tool',
      tool_call_id: 'call_abc',
      name: 'calculate',
      content: '4',
    };

    await adapter.saveMessage(sessionId, toolCallMsg);
    await adapter.saveMessage(sessionId, toolResultMsg);

    const history = await adapter.getHistory(sessionId);
    expect(history).toHaveLength(2);
    expect(history[0]).toEqual(toolCallMsg);
    expect(history[1]).toEqual(toolResultMsg);
  });

  it('maintains strict isolation between sessions', async () => {
    const db = new DatabaseSync(':memory:');
    const adapter = new SQLiteMemoryAdapter(db);

    const msgA: ChatMessage = { role: 'user', content: 'Session A message' };
    const msgB: ChatMessage = { role: 'user', content: 'Session B message' };

    await adapter.saveMessage('session_A', msgA);
    await adapter.saveMessage('session_B', msgB);

    const historyA = await adapter.getHistory('session_A');
    expect(historyA).toHaveLength(1);
    expect(historyA[0]).toEqual(msgA);

    const historyB = await adapter.getHistory('session_B');
    expect(historyB).toHaveLength(1);
    expect(historyB[0]).toEqual(msgB);
  });

  it('supports initialising with a string path', async () => {
    // ":memory:" path string will spawn an ephemeral db connection inside constructor
    const adapter = new SQLiteMemoryAdapter(':memory:');
    const msg: ChatMessage = { role: 'system', content: 'You are a helpful assistant.' };

    await adapter.saveMessage('session_sys', msg);
    const history = await adapter.getHistory('session_sys');
    expect(history).toHaveLength(1);
    expect(history[0]).toEqual(msg);
  });

  it('correctly handles serialization of edge-case contents, multiple tool calls, and error strings', async () => {
    const db = new DatabaseSync(':memory:');
    const adapter = new SQLiteMemoryAdapter(db);
    const sessionId = 'session_edge';

    // 1. Message with special characters, JSON content inside user text, and emojis
    const specialMsg: ChatMessage = {
      role: 'user',
      content: 'Hello!\nHere is some JSON:\n{"key": "value", "escaped_quotes": "\\"hello\\""}\n🚀🔥',
    };

    // 2. Assistant message with multiple concurrent tool calls
    const multipleToolsMsg: ChatMessage = {
      role: 'assistant',
      tool_calls: [
        {
          id: 'call_1',
          type: 'function',
          function: {
            name: 'first_tool',
            arguments: '{"a": 1}',
          },
        },
        {
          id: 'call_2',
          type: 'function',
          function: {
            name: 'second_tool',
            arguments: '{"b": [true, false]}',
          },
        },
      ],
    };

    // 3. Tool response message containing serialized error or stack trace
    const errorToolMsg: ChatMessage = {
      role: 'tool',
      tool_call_id: 'call_2',
      name: 'second_tool',
      content: JSON.stringify({
        status: 'error',
        message: 'Database query timeout',
        code: 504,
        details: 'at executeQuery (db.ts:45:12)\nat async second_tool.execute (tool.ts:12:9)',
      }),
    };

    await adapter.saveMessage(sessionId, specialMsg);
    await adapter.saveMessage(sessionId, multipleToolsMsg);
    await adapter.saveMessage(sessionId, errorToolMsg);

    const history = await adapter.getHistory(sessionId);
    expect(history).toHaveLength(3);

    expect(history[0]).toEqual(specialMsg);
    expect(history[1]).toEqual(multipleToolsMsg);
    expect(history[2]).toEqual(errorToolMsg);

    // Verify properties of parsed JSON content are fully intact
    const toolMsg = history[2];
    if (toolMsg.role === 'tool') {
      const parsedError = JSON.parse(toolMsg.content);
      expect(parsedError.status).toBe('error');
      expect(parsedError.code).toBe(504);
      expect(parsedError.details).toContain('at executeQuery');
    } else {
      expect.fail('Expected third message to be a ToolMessage');
    }
  });
});
