# 01.3 — Registry Pattern — Specification

## Objective
Implementar una clase `ToolRegistry` que actúe como un registro centralizado (`Map<string, ToolDefinition>`). Esto permitirá que el orquestador del framework busque y recupere las funciones por su nombre de forma rápida y eficiente cuando el LLM las solicite.

## Effort
- Complexity: S
- Rationale: Estructura de datos simple basada en Map en TypeScript.

## Dependencies
- Debe existir la definición de contrato (01.1).

## Delivery Criteria
- Crear la clase `ToolRegistry` en `/src/core/registry.ts`.
- Métodos soportados: `register(tool)`, `get(name)`, y un helper `getDefinitions()` para obtener la lista de esquemas para pasarle al LLM.
- Test unitario que verifique el registro y recuperación correcta de herramientas.

## Risks
- Colisiones de nombres de herramientas. Mitigación: Lanzar un error explicativo si se intenta registrar una herramienta con un nombre ya existente.

## Commands
```bash
Check: npx tsc --noEmit
Test: npx vitest run
Lint: npx eslint .
```
