import { Tool } from '../schemas/tool.js';
import { zodToJson } from '../utils/json-schema.js';

export class ToolRegistry {
  private tools = new Map<string, Tool>();

  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool duplicate collision error: Tool with name "${tool.name}" is already registered.`);
    }
    this.tools.set(tool.name, tool);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getDefinitions(): Array<{ name: string; description: string; parameters: Record<string, any> }> {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: zodToJson(tool.schema),
    }));
  }
}
