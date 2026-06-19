# 07.1 — Arquitectura Limpia y Proveedor Ollama — Specification

## Objective
Aislar el núcleo (core) del framework mediante Arquitectura Limpia (Puertos y Adaptadores / Hexagonal), definiendo la interfaz `LLMProvider` como un puerto en el core y abstrayendo las implementaciones como adaptadores. Implementar el adaptador para Ollama usando llamadas `fetch` nativas a su API de Chat local y verificando la compatibilidad de llamadas a herramientas (normalizando los argumentos en formato string).

## Effort
- Complexity: M
- Rationale: Refactorización del core para separar tipos del loop, creación del nuevo adaptador, normalización de JSON schemas a formato de llamada de Ollama, y conversión de respuestas.

## Delivery Criteria
1. **Ports Isolation**:
   - Crear `src/core/ports/llm-provider.ts` y mover la interfaz `LLMProvider`, `ChatMessage`, `LLMResponse`, `LLMStreamChunk` y tipos relacionados.
   - Modificar `src/core/agent.ts` para importar estas interfaces y tipos desde el puerto.
2. **Ollama Adapter**:
   - Crear `src/adapters/llm/ollama.ts` implementando `LLMProvider`.
   - Permitir configurar `model` (por defecto `llama3.1`) y `host` (por defecto `http://localhost:11434`).
   - Implementar método `chat` haciendo POST a `${host}/api/chat` con `stream: false`.
   - Implementar método `chatStream` haciendo POST a `${host}/api/chat` con `stream: true`, leyendo y procesando la respuesta chunk a chunk por medio de un generador asíncrono.
   - Mapear correctamente los schemas de herramientas que el framework pasa como OpenAPI parameters, y re-formatear la respuesta de Ollama: convertir los argumentos de `tool_calls` (que Ollama devuelve como objeto) a JSON string para que cumplan con el tipo esperado de `ToolCall.arguments`.
3. **Tests**:
   - Crear `src/adapters/llm/ollama.test.ts` mockeando el `fetch` global para validar los casos de chat básico, tool calls (con parseo de argumentos a string), streaming, y errores de conexión.
4. **Example**:
   - Crear `examples/ollama-agent.ts` con herramientas de demostración.
5. **Exports**:
   - Exportar `OllamaProvider` en `src/index.ts`.

## Commands
```bash
npx tsc --noEmit
npx vitest run
```
