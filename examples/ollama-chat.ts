import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { Agent, ToolRegistry, OllamaProvider } from '../src/index';

async function main() {
  console.log('=== Ollama Interactive Chat Client ===');
  console.log('Type your message and press Enter. Type "exit" or "quit" to end the chat.\n');

  // Initialize Ollama Provider
  const model = process.env.OLLAMA_MODEL || 'gemma4:e2b';
  console.log(`Using Ollama model: ${model}`);

  const provider = new OllamaProvider({
    model: model,
  });

  // Create an empty ToolRegistry since we don't need any tools
  const registry = new ToolRegistry();
  const agent = new Agent(registry, provider);

  // Initialize chat history with system instructions
  const messages: any[] = [
    {
      role: 'system',
      content: 'You are a helpful, friendly assistant. You are chatting in a terminal.',
    },
  ];

  const rl = readline.createInterface({ input, output });

  try {
    while (true) {
      const userInput = await rl.question('\nYou: ');
      if (userInput.trim().toLowerCase() === 'exit' || userInput.trim().toLowerCase() === 'quit') {
        console.log('Goodbye!');
        break;
      }

      if (!userInput.trim()) {
        continue;
      }

      // Add user message to history
      messages.push({
        role: 'user',
        content: userInput,
      });

      // Run stream
      const stream = agent.runStream(messages);
      const reader = stream.getReader();
      let assistantResponse = '';
      let assistantThinking = '';
      let hasPrintedThinkingHeader = false;
      let hasPrintedAssistantHeader = false;
      let inThinkingMode = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        if (value) {
          if (value.type === 'thinking') {
            if (!hasPrintedThinkingHeader) {
              process.stdout.write('\x1b[90mThinking:\n');
              hasPrintedThinkingHeader = true;
              inThinkingMode = true;
            }
            process.stdout.write(value.content);
            assistantThinking += value.content;
          } else if (value.type === 'token') {
            if (inThinkingMode) {
              // End thinking block, reset color and add spacing
              process.stdout.write('\x1b[0m\n\n');
              inThinkingMode = false;
            }
            if (!hasPrintedAssistantHeader) {
              process.stdout.write('Assistant: ');
              hasPrintedAssistantHeader = true;
            }
            process.stdout.write(value.content);
            assistantResponse += value.content;
          } else if (value.type === 'error') {
            if (inThinkingMode) {
              process.stdout.write('\x1b[0m\n');
              inThinkingMode = false;
            }
            console.error(`\n[Error] ${value.message}`);
          }
        }
      }

      if (inThinkingMode) {
        process.stdout.write('\x1b[0m\n');
      }
      console.log(); // New line after completion

      // Add assistant response to history
      if (assistantResponse || assistantThinking) {
        messages.push({
          role: 'assistant',
          content: assistantResponse || null,
          thinking: assistantThinking || null,
        });
      }
    }
  } catch (error) {
    console.error('Chat error:', error);
  } finally {
    rl.close();
  }
}

main().catch(console.error);
