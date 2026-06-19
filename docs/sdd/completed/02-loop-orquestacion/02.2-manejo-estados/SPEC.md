# 02.2 — Manejo de Estados — Specification

## Objective
Garantizar que el historial de conversación (mensajes de usuario, asistente, llamadas y respuestas de herramientas) se mantenga estructurado y actualizado en cada iteración del bucle `run()`.

## Effort
- Complexity: S
- Rationale: Estructura de array en memoria con tipado estricto que sigue los formatos estándar de mensajes de chat.

## Dependencies
- Agente Orquestador (02.1).

## Delivery Criteria
- Definir tipos de mensajes (`Message`, `UserMessage`, `AssistantMessage`, `ToolMessage`) en `/src/schemas/tool.ts` o `/src/core/agent.ts`.
- Asegurar que al ejecutar una herramienta, se añada un `ToolMessage` con el `tool_call_id` correspondiente al historial para mantener la validez semántica en el LLM.
- Test unitario simulando una conversación de 2 turnos y verificando que el array final de mensajes es correcto.

## Risks
- Formatos incompatibles entre las diferentes APIs de LLMs. Mitigación: Definir un formato unificado interno y hacer que los adaptadores de proveedor traduzcan a su respectivo formato.

## Commands
```bash
Check: npx tsc --noEmit
Test: npx vitest run
Lint: npx eslint .
```
