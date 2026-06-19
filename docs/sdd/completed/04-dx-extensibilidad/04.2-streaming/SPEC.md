# 04.2 — Streaming — Specification

## Objective
Implementar soporte para retornar respuestas parciales del LLM mediante `ReadableStream` estándar (nativo de Node.js / Web APIs) para mitigar la percepción de latencia en la UI del usuario.

## Effort
- Complexity: L
- Rationale: Manejo de flujos asíncronos y procesamiento de fragmentos (chunks) provenientes del proveedor del LLM, integrados con el bucle de herramientas.

## Dependencies
- Agente Orquestador (02.1).

## Delivery Criteria
- Crear un método `runStream()` en la clase `Agent` que retorne un objeto `ReadableStream` que emita tokens a medida que se reciben del LLM.
- El stream debe emitir eventos estructurados: tokens de texto, inicio de llamada a herramienta y final de llamada a herramienta.
- Test unitario simulando la llegada de chunks parciales de texto y validando la lectura correcta a través de un lector de stream (`stream.getReader()`).

## Risks
- Interrupción a mitad de la generación de un JSON para tool calls. Mitigación: El stream de tokens de texto debe separarse de la lógica de acumulado de argumentos de herramientas; las llamadas a herramientas solo se ejecutan cuando el chunk de la llamada esté completamente cerrado o acumulado.

## Commands
```bash
Check: npx tsc --noEmit
Test: npx vitest run
Lint: npx eslint .
```
