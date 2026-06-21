# 10.2 — Adapter Role Formatter Refactoring — Specification

## Objective
Refactorizar el método privado `formatMessages` en la clase `OllamaProvider` en [ollama.ts](file:///Users/aperezl/ai/mini-framework/src/adapters/llm/ollama.ts) para eliminar las sentencias condicionales anidadas (`if (msg.role === 'assistant')`, `if (msg.role === 'tool')`, etc.), implementando una estrategia de formateo por cada rol utilizando un mapa de estrategias.

## Effort
- Complexity: S
- Rationale: Se creará un mapa de estrategias de formateo (`Record<string, MessageFormatterStrategy>`) para aislar la transformación de mensajes del usuario, del asistente, del sistema y de herramientas, mejorando la extensibilidad para nuevos roles o adaptadores en el futuro.

## Delivery Criteria
1. **Formatter Strategy Map**:
   - Crear una interfaz interna `MessageFormatterStrategy` en `src/adapters/llm/ollama.ts`.
   - Definir estrategias para cada rol (`user`, `assistant`, `system`, `tool`).
2. **Refactor formatMessages**:
   - Reemplazar la cascada de condicionales con una llamada dinámica `formatterMap[msg.role](msg)`.
3. **Tests**:
   - Validar que las pruebas unitarias del proveedor Ollama (`src/adapters/llm/ollama.test.ts`) y la suite general del agente sigan pasando satisfactoriamente.

## Commands
```bash
npx tsc --noEmit
npx vitest run
```
