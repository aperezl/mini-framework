import { spawn, ChildProcess } from 'child_process';
import { z } from 'zod';
import { Tool } from '../schemas/tool.js';

export function jsonSchemaToZod(jsonSchema: any): z.ZodTypeAny {
  if (!jsonSchema) return z.any();
  if (jsonSchema.type === 'object') {
    const shape: Record<string, z.ZodTypeAny> = {};
    const properties = jsonSchema.properties || {};
    const required = jsonSchema.required || [];

    for (const [key, prop] of Object.entries<any>(properties)) {
      let field: z.ZodTypeAny;
      if (prop.type === 'string') {
        field = z.string();
      } else if (prop.type === 'number' || prop.type === 'integer') {
        field = z.number();
      } else if (prop.type === 'boolean') {
        field = z.boolean();
      } else if (prop.type === 'array') {
        field = z.array(z.any());
      } else {
        field = z.any();
      }

      if (prop.description) {
        field = field.describe(prop.description);
      }

      if (!required.includes(key)) {
        field = field.optional();
      }
      shape[key] = field;
    }
    return z.object(shape);
  }
  return z.any();
}

export class MCPClient {
  private process: ChildProcess | null = null;
  private nextId = 1;
  private pendingRequests = new Map<
    number,
    { resolve: (val: any) => void; reject: (err: Error) => void }
  >();
  private stdoutBuffer = '';

  constructor(
    private command: string,
    private args: string[] = []
  ) {}

  async connect(): Promise<void> {
    this.process = spawn(this.command, this.args);

    this.process.on('error', (err) => {
      for (const req of this.pendingRequests.values()) {
        req.reject(err);
      }
      this.pendingRequests.clear();
    });

    if (this.process.stdout) {
      this.process.stdout.on('data', (data) => {
        this.stdoutBuffer += data.toString();
        const lines = this.stdoutBuffer.split('\n');
        this.stdoutBuffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const message = JSON.parse(line);
            if (message.id !== undefined) {
              const pending = this.pendingRequests.get(message.id);
              if (pending) {
                this.pendingRequests.delete(message.id);
                if (message.error) {
                  pending.reject(new Error(message.error.message || 'JSON-RPC Error'));
                } else {
                  pending.resolve(message.result);
                }
              }
            }
          } catch (e) {
            // Ignore non-JSON lines (e.g. debug statements or stderr redirects)
          }
        }
      });
    }

    // Handshake
    await this.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'mini-framework-client',
        version: '0.1.0',
      },
    });

    this.notify('notifications/initialized');
  }

  private request(method: string, params: any = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.process || !this.process.stdin) {
        return reject(new Error('Process not connected'));
      }
      const id = this.nextId++;
      this.pendingRequests.set(id, { resolve, reject });
      const req = {
        jsonrpc: '2.0',
        id,
        method,
        params,
      };
      this.process.stdin.write(JSON.stringify(req) + '\n');
    });
  }

  private notify(method: string, params: any = {}): void {
    if (!this.process || !this.process.stdin) {
      return;
    }
    const notif = {
      jsonrpc: '2.0',
      method,
      params,
    };
    this.process.stdin.write(JSON.stringify(notif) + '\n');
  }

  async listTools(): Promise<Tool[]> {
    const result = await this.request('tools/list');
    const mcpTools = result.tools || [];

    return mcpTools.map((mcpTool: any): Tool => {
      const name = mcpTool.name;
      const description = mcpTool.description || '';
      const schema = jsonSchemaToZod(mcpTool.inputSchema);

      return {
        name,
        description,
        schema,
        execute: async (params: any) => {
          const callResult = await this.request('tools/call', {
            name,
            arguments: params,
          });

          if (callResult.isError) {
            const errorMsg =
              callResult.content
                ?.filter((c: any) => c.type === 'text')
                .map((c: any) => c.text)
                .join('\n') || 'MCP Tool execution error';
            throw new Error(errorMsg);
          }

          const textContent = callResult.content
            ?.filter((c: any) => c.type === 'text')
            .map((c: any) => c.text)
            .join('\n');
          return textContent || '';
        },
      };
    });
  }

  close(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    for (const req of this.pendingRequests.values()) {
      req.reject(new Error('Connection closed'));
    }
    this.pendingRequests.clear();
  }
}
