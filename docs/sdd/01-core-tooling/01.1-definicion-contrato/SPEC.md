# 01.1 — Definición de Contrato — Specification

## Objective
Definir una interfaz de herramienta en TypeScript que fuerce el uso de un validador (Zod). Esto permite establecer un contrato claro entre el código de la herramienta y lo que el LLM entiende.

## Effort
- Complexity: S
- Rationale: Estructura de tipos sencilla en TypeScript usando la librería `zod`.

## Dependencies
- Ninguna.

## Delivery Criteria
- Creación de una interfaz `Tool` en `/src/schemas/tool.ts` que contenga:
  - `name`: string descriptivo para el LLM.
  - `description`: string descriptivo de lo que hace para el LLM.
  - `schema`: una instancia de `zod.ZodType`.
  - `execute`: función asíncrona que tome los parámetros tipados y retorne una promesa.
- Verificable a través de test unitario (`npx vitest run`).

## Risks
- Que el usuario quiera soportar otros validadores además de Zod. Mitigación: Empezar con Zod como base según se indica en el roadmap.

## Commands
```bash
Check: npx tsc --noEmit
Test: npx vitest run
Lint: npx eslint .
```
