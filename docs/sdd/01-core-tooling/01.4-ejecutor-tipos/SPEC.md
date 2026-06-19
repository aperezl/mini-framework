# 01.4 — Ejecutor de Tipos — Specification

## Objective
Crear un wrapper o envoltorio de ejecución que aplique `zod.parse()` a los argumentos proporcionados por el LLM antes de llamar a la función real. Esto evita errores de runtime inesperados en el código de la herramienta si el LLM comete alucinaciones de formato de parámetros.

## Effort
- Complexity: S
- Rationale: Envoltorio que atrapa excepciones de Zod y las formatea de forma amigable para reportar de vuelta al LLM.

## Dependencies
- Definición de contrato (01.1).

## Delivery Criteria
- Implementar la función de envoltura en `/src/schemas/tool.ts` o como parte de la clase `ToolRegistry`.
- Si los argumentos no pasan la validación del esquema de Zod, la ejecución debe fallar con un error descriptivo conteniendo el Validation Error.
- Test unitarios que validen:
  - Ejecución exitosa con datos correctos.
  - Lanzamiento del error controlado de validación al pasar datos corruptos o incompletos.

## Risks
- Que el error de validación sea ilegible para el LLM. Mitigación: Serializar el error de Zod a una cadena JSON o de texto amigable para que el LLM pueda corregirse a sí mismo en el siguiente ciclo.

## Commands
```bash
Check: npx tsc --noEmit
Test: npx vitest run
Lint: npx eslint .
```
