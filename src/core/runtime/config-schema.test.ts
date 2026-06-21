import { describe, it, expect } from 'vitest';
import { parseYAMLConfig } from './config-schema';

describe('YAML Config Parser & Schema Validation', () => {
  it('successfully parses a valid basic agent configuration', () => {
    const yamlContent = `
agent:
  maxIterations: 12
  provider:
    type: ollama
    model: llama3.1
    host: http://localhost:11434
io:
  input: stdio
  output: stdio
`;

    const config = parseYAMLConfig(yamlContent);
    expect(config.agent.maxIterations).toBe(12);
    expect(config.agent.provider.type).toBe('ollama');
    expect(config.agent.provider.model).toBe('llama3.1');
    expect(config.io?.input).toBe('stdio');
    expect(config.tools).toEqual([]);
    expect(config.middlewares).toEqual([]);
  });

  it('successfully parses a config with MCP tools and sqlite storage', () => {
    const yamlContent = `
agent:
  provider:
    type: ollama
    model: deepseek-r1
storage:
  type: sqlite
  dbPath: ./history.db
tools:
  - name: my-mcp-tool
    mcp:
      name: postgres-server
      command: npx
      args:
        - -y
        - "@modelcontextprotocol/server-postgres"
      env:
        DATABASE_URL: postgres://localhost:5432
  - name: local-tool
    modulePath: ./tools/math.ts
`;

    const config = parseYAMLConfig(yamlContent);
    expect(config.agent.maxIterations).toBe(10); // check default value
    expect(config.storage?.type).toBe('sqlite');
    expect(config.storage?.dbPath).toBe('./history.db');
    expect(config.tools).toHaveLength(2);
    expect(config.tools[0].mcp?.name).toBe('postgres-server');
    expect(config.tools[0].mcp?.args).toContain('@modelcontextprotocol/server-postgres');
    expect(config.tools[1].modulePath).toBe('./tools/math.ts');
  });

  it('successfully parses custom providers and middlewares', () => {
    const yamlContent = `
agent:
  provider:
    type: custom
    modulePath: ./providers/openai.ts
    className: OpenAIProvider
    options:
      apiKey: sk-12345
middlewares:
  - modulePath: ./middlewares/logger.ts
    className: LoggerMiddleware
    options:
      verbose: true
`;

    const config = parseYAMLConfig(yamlContent);
    expect(config.agent.provider.type).toBe('custom');
    expect(config.agent.provider.modulePath).toBe('./providers/openai.ts');
    expect(config.agent.provider.className).toBe('OpenAIProvider');
    expect(config.agent.provider.options?.apiKey).toBe('sk-12345');
    expect(config.middlewares).toHaveLength(1);
    expect(config.middlewares[0].modulePath).toBe('./middlewares/logger.ts');
    expect(config.middlewares[0].options?.verbose).toBe(true);
  });

  it('throws a syntax error on invalid YAML syntax', () => {
    const yamlContent = `
agent:
  maxIterations: : 10 (invalid syntax)
`;

    expect(() => parseYAMLConfig(yamlContent)).toThrow('Failed to parse YAML syntax');
  });

  it('throws validation error when required fields are missing', () => {
    const yamlContent = `
# missing agent and provider block
io:
  input: stdio
`;

    expect(() => parseYAMLConfig(yamlContent)).toThrow('Validation failed for YAML configuration');
    expect(() => parseYAMLConfig(yamlContent)).toThrow('[agent]: Required');
  });

  it('throws validation error when tool doesn\'t have mcp or modulePath', () => {
    const yamlContent = `
agent:
  provider:
    type: ollama
tools:
  - name: invalid-tool-with-neither
`;

    expect(() => parseYAMLConfig(yamlContent)).toThrow('Validation failed for YAML configuration');
    expect(() => parseYAMLConfig(yamlContent)).toThrow('Either modulePath or mcp must be defined for each tool');
  });
});
