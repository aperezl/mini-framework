import { Agent, ToolRegistry, MCPClient } from '../src/index';
import { MockLLMProvider } from './mock-provider';

// 1. A mock stdio JSON-RPC MCP Server script
const mockServerCode = `
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
              serverInfo: { name: 'external-math-server', version: '1.0.0' }
            }
          }));
        } else if (req.method === 'tools/list') {
          console.log(JSON.stringify({
            jsonrpc: '2.0',
            id: req.id,
            result: {
              tools: [
                {
                  name: 'calculate',
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
        // ignore errors
      }
    }
  });
`;

async function main() {
  console.log('--- Running MCP Agent Example ---');

  // 2. Initialize the MCP Client pointing to the mock server process
  console.log('[MCP] Connecting to external stdio server...');
  const mcpClient = new MCPClient('node', ['-e', mockServerCode]);
  await mcpClient.connect();

  // 3. Discover tools
  console.log('[MCP] Discovering tools...');
  const externalTools = await mcpClient.listTools();
  console.log(`[MCP] Found ${externalTools.length} external tools.`);
  externalTools.forEach((t) => {
    console.log(`  - Tool name: "${t.name}" (Description: "${t.description}")`);
  });

  // 4. Register discovered tools locally
  const registry = new ToolRegistry();
  externalTools.forEach((tool) => registry.register(tool));
  console.log('[MCP] Registered external tools to locally-managed ToolRegistry.');

  // 5. Run the agent execution loop calling this tool
  const provider = new MockLLMProvider();
  const agent = new Agent(registry, provider);

  const messages = [{ role: 'user', content: 'Calcular la suma de 30 y 45' } as const];
  console.log(`User query: "${messages[0].content}"`);

  const history = await agent.run(messages);

  console.log('\n--- Final Conversation History ---');
  history.forEach((msg) => {
    console.log(`[${msg.role.toUpperCase()}]:`, msg.content ?? `[Tool Calls: ${JSON.stringify(msg.tool_calls)}]`);
  });

  // 6. Clean up process
  console.log('\n[MCP] Closing connection and terminating server process...');
  mcpClient.close();
  console.log('Example finished.');
}

main().catch(console.error);
