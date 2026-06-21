import fs from 'node:fs';
import path from 'node:path';
import { parseYAMLConfig } from './core/runtime/config-schema';
import { AgentRuntime } from './core/runtime/runtime';

async function main() {
  const args = process.argv.slice(2);
  let configPath = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--config' || args[i] === '-c') {
      configPath = args[i + 1];
      break;
    }
  }

  if (!configPath) {
    console.error('Error: Please specify a configuration file using --config or -c.');
    console.log('Usage: npm run run-agent -- --config <path-to-yaml-file>');
    process.exit(1);
  }

  const absolutePath = path.resolve(process.cwd(), configPath);
  if (!fs.existsSync(absolutePath)) {
    console.error(`Error: Configuration file not found at ${absolutePath}`);
    process.exit(1);
  }

  let yamlContent: string;
  try {
    yamlContent = fs.readFileSync(absolutePath, 'utf8');
  } catch (err: any) {
    console.error(`Error reading config file: ${err.message}`);
    process.exit(1);
  }

  let runtime: AgentRuntime | null = null;
  try {
    const config = parseYAMLConfig(yamlContent);
    runtime = new AgentRuntime(config);
    await runtime.start();
  } catch (err: any) {
    console.error(`Runtime Error: ${err.message}`);
    if (runtime) {
      await runtime.close();
    }
    process.exit(1);
  } finally {
    if (runtime) {
      await runtime.close();
    }
  }
}

main().catch((err) => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
