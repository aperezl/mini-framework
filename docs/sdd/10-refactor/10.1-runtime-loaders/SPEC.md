# 10.1 — Runtime Component Loaders Refactoring — Specification

## Objective
Refactorizar el método `initialize()` en la clase `AgentRuntime` en [runtime.ts](file:///Users/aperezl/ai/mini-framework/src/core/runtime/runtime.ts) para eliminar las sentencias `if/else` anidadas al instanciar proveedores de LLM, adaptadores de almacenamiento y cargadores de herramientas/middlewares, reemplazándolos con estrategias de carga estructuradas (Loaders).

## Effort
- Complexity: S
- Rationale: Se reorganizará el código de instanciación del runtime en clases/funciones estrategia (`ProviderLoader`, `StorageLoader`, `ToolLoader`), mejorando la DX y legibilidad sin alterar el comportamiento observable del framework.

## Delivery Criteria
1. **Define Load Strategies**:
   - Crear estrategias aisladas o un mapa de resoluciones para la instanciación de recursos:
     - `LLMProviderLoader`: Resuelve Ollama vs Custom.
     - `StorageLoader`: Resuelve SQLite vs memoria.
     - `ToolLoader`: Resuelve herramientas locales (`modulePath`) vs herramientas externas (`mcp`).
2. **Refactor AgentRuntime**:
   - Simplificar `initialize()` en `AgentRuntime` delegando la instanciación de estos componentes a sus respectivas estrategias de carga.
3. **Tests**:
   - Asegurar que todas las pruebas existentes en `src/core/runtime/runtime.test.ts` sigan pasando sin modificaciones.

## Commands
```bash
npx tsc --noEmit
npx vitest run
```
