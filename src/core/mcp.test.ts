import { describe, it, expect } from 'vitest';
import { MCPClient, jsonSchemaToZod } from './mcp';
import { ToolRegistry } from './registry';
import { z } from 'zod';
import { zodToJson } from '../utils/json-schema';

describe('jsonSchemaToZod', () => {
  it('converts basic json schema to a matching Zod schema shape', () => {
    const jsonSchema = {
      type: 'object',
      properties: {
        x: { type: 'number', description: 'the first parameter' },
        y: { type: 'string' },
        active: { type: 'boolean' },
        tags: { type: 'array' },
      },
      required: ['x', 'y'],
    };

    const zodSchema = jsonSchemaToZod(jsonSchema);
    const convertedJson = zodToJson(zodSchema);

    expect(convertedJson.type).toBe('object');
    expect(convertedJson.properties.x.type).toBe('number');
    expect(convertedJson.properties.x.description).toBe('the first parameter');
    expect(convertedJson.properties.y.type).toBe('string');
    expect(convertedJson.properties.active.type).toBe('boolean');
    expect(convertedJson.properties.tags.type).toBe('array');
    expect(convertedJson.required).toContain('x');
    expect(convertedJson.required).toContain('y');
    expect(convertedJson.required).not.toContain('active');
  });
});

describe('MCPClient', () => {
  it('performs handshake, lists tools, executes calls, and closes cleanly', async () => {
    // Spawns node running a mock stdio JSON-RPC MCP server
    const serverScript = `
      process.stdin.on('data', (data) => {
        const lines = data.toString().split('\\n');
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const req = JSON.parse(line);
            if (req.method === 'initialize') {
              console.log(JSON.stringify({
                jsonrpc: '2.0',
                id: req.id,
                result: {
                  protocolVersion: '2024-11-05',
                  capabilities: {},
                  serverInfo: { name: 'mock-server', version: '0.1.0' }
                }
              }));
            } else if (req.method === 'tools/list') {
              console.log(JSON.stringify({
                jsonrpc: '2.0',
                id: req.id,
                result: {
                  tools: [
                    {
                      name: 'add',
                      description: 'Add two numbers together',
                      inputSchema: {
                        type: 'object',
                        properties: {
                          a: { type: 'number', description: 'First number' },
                          b: { type: 'number', description: 'Second number' }
                        },
                        required: ['a', 'b']
                      }
                    }
                  ]
                }
              }));
            } else if (req.method === 'tools/call') {
              const { a, b } = req.params.arguments;
              console.log(JSON.stringify({
                jsonrpc: '2.0',
                id: req.id,
                result: {
                  content: [{ type: 'text', text: String(a + b) }]
                }
              }));
            }
          } catch (e) {
            // ignore malformed queries
          }
        }
      });
    `;

    const client = new MCPClient('node', ['-e', serverScript]);
    await client.connect();

    const tools = await client.listTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('add');
    expect(tools[0].description).toBe('Add two numbers together');

    // Register and execute local tool wrapper
    const registry = new ToolRegistry();
    registry.register(tools[0]);

    const result = await tools[0].execute({ a: 12, b: 8 });
    expect(result).toBe('20');

    client.close();
  });
});
