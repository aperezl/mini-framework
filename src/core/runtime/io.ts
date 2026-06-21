import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

/**
 * Interface representing a source of user input.
 */
export interface InputSource {
  /**
   * Prompts the user or waits for input, returning the input string.
   */
  read(prompt?: string): Promise<string>;
  
  /**
   * Cleans up the input source resources.
   */
  close(): Promise<void>;
}

/**
 * Interface representing a sink for writing agent output.
 */
export interface OutputSink {
  /**
   * Writes a stream token/thinking chunk in real-time.
   */
  writeToken(token: string, type: 'token' | 'thinking'): Promise<void>;
  
  /**
   * Writes a complete formatted message.
   */
  writeMessage(message: string, sender: 'system' | 'user' | 'assistant' | 'error' | 'info'): Promise<void>;
  
  /**
   * Cleans up the output sink resources.
   */
  close(): Promise<void>;
}

/**
 * Standard console/stdio input source implementation.
 */
export class StdioInputSource implements InputSource {
  private rl: readline.Interface;

  constructor() {
    this.rl = readline.createInterface({ input, output });
  }

  async read(prompt = '\nYou: '): Promise<string> {
    return this.rl.question(prompt);
  }

  async close(): Promise<void> {
    this.rl.close();
  }
}

/**
 * Standard console/stdio output sink implementation using ANSI colors.
 */
export class StdioOutputSink implements OutputSink {
  private inThinkingMode = false;
  private hasPrintedAssistantHeader = false;

  async writeToken(token: string, type: 'token' | 'thinking'): Promise<void> {
    if (type === 'thinking') {
      if (!this.inThinkingMode) {
        process.stdout.write('\x1b[90mThinking:\n');
        this.inThinkingMode = true;
      }
      process.stdout.write(token);
    } else if (type === 'token') {
      if (this.inThinkingMode) {
        // Exit thinking mode
        process.stdout.write('\x1b[0m\n\n');
        this.inThinkingMode = false;
      }
      if (!this.hasPrintedAssistantHeader) {
        process.stdout.write('Assistant: ');
        this.hasPrintedAssistantHeader = true;
      }
      process.stdout.write(token);
    }
  }

  async writeMessage(message: string, sender: 'system' | 'user' | 'assistant' | 'error' | 'info'): Promise<void> {
    // Reset state flags before printing whole messages
    if (this.inThinkingMode) {
      process.stdout.write('\x1b[0m\n');
      this.inThinkingMode = false;
    }
    this.hasPrintedAssistantHeader = false;

    const colors = {
      system: '\x1b[36m',    // Cyan
      user: '\x1b[32m',      // Green
      assistant: '\x1b[0m',  // Default
      error: '\x1b[31m',     // Red
      info: '\x1b[33m',      // Yellow
    };

    const prefix = {
      system: '[System] ',
      user: 'You: ',
      assistant: 'Assistant: ',
      error: '[Error] ',
      info: '[Info] ',
    };

    const color = colors[sender] || '\x1b[0m';
    const pref = prefix[sender] || '';

    process.stdout.write(`${color}${pref}${message}\x1b[0m\n`);
  }

  async close(): Promise<void> {
    // Ensure terminal color is reset
    process.stdout.write('\x1b[0m\n');
  }
}
