# 09.2 — Runtime Engine Core & I/O Adapters — Specification

## Objective
Desarrollar la clase principal `AgentRuntime` que reciba una configuración validada de tipo `YAMLConfig` y ensamble todos los componentes del agente (ToolRegistry, LLMProvider, persistencia SQLite), y abstraer el flujo de entrada/salida (I/O) a través de interfaces `InputSource` y `OutputSink` para interactuar con la consola (`stdio`) o streams.

## Effort
- Complexity: M
- Rationale: Requiere diseñar interfaces extensibles para la abstracción de entrada/salida y lógica para instanciar e interconectar los diferentes componentes del framework (Agent, SQLite, etc.) basándose en la configuración.

## Dependencies
- Debe completarse después de **09.1 — YAML Config Parser & Schema Validation**.

## Delivery Criteria
1. **I/O Abstraction**:
   - Crear `src/core/runtime/io.ts` definiendo las interfaces `InputSource` y `OutputSink`.
   - Implementar `StdioInputSource` (usando `readline`) y `StdioOutputSink` (consola con colores ANSI).
2. **Runtime Engine Class**:
   - Crear `src/core/runtime/runtime.ts` e implementar `AgentRuntime`.
   - La clase debe instanciar el proveedor de LLM adecuado (ej. OllamaProvider si se especifica `'ollama'`) y el almacenamiento SQLite.
3. **Execution Loop**:
   - `AgentRuntime.run()` debe leer del input stream, alimentar el agente y escribir las respuestas de forma estructurada en el output stream.
4. **Tests**:
   - Crear `src/core/runtime/runtime.test.ts` mockeando el proveedor de LLM e I/O para validar la instanciación y el flujo completo.

## Commands
```bash
npx tsc --noEmit
npx vitest run src/core/runtime/runtime.test.ts
```
