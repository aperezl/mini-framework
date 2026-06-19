# 01.2 — Generador de Schema — Specification

## Objective
Crear una función que transforme el `ZodSchema` del contrato a un `JSON Schema` (usando la librería `zod-to-json-schema`). Esto es crítico porque los LLM no comprenden los tipos nativos de TypeScript, sino schemas en formato JSON.

## Effort
- Complexity: S
- Rationale: Integración de la dependencia `zod-to-json-schema` para exponer la conversión.

## Dependencies
- Debe existir la definición de contrato (01.1).

## Delivery Criteria
- Crear una función helper en `/src/utils/json-schema.ts`.
- La función debe tomar un `ZodSchema` y retornar la definición en formato JSON Schema compatible con las especificaciones de OpenAI/Anthropic para Tool Calling.
- Test unitario que verifique que el esquema de salida tiene los campos clave (`type`, `properties`, `required`).

## Risks
- Incompatibilidades de formatos entre OpenAI (Function Calling) y Anthropic (Tool Calling). Mitigación: Retornar el esquema de forma parametrizable o adaptable al proveedor.

## Commands
```bash
Check: npx tsc --noEmit
Test: npx vitest run
Lint: npx eslint .
```
