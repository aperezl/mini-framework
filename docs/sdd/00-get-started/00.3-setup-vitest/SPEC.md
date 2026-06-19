# 00.3 — Configuración de Vitest — Specification

## Objective
Instalar y configurar `vitest` como entorno principal de pruebas para poder aplicar TDD en todo el ciclo de desarrollo del proyecto.

## Effort
- Complexity: S
- Rationale: Configuración del script `test` en package.json y configuración básica de Vitest.

## Dependencies
- TypeScript configurado (00.2).

## Delivery Criteria
- `vitest` instalado como dependencia de desarrollo en `package.json`.
- Script `"test": "vitest run"` (o similar) definido en `package.json`.
- Archivo `vitest.config.ts` (u opción en tsconfig) configurado de forma básica para resolver rutas si fuese necesario.
- Un test unitario básico dummy (`src/dummy.test.ts`) creado y ejecutado con éxito pasando la suite completa (`npx vitest run`).

## Risks
- Lentitud en la ejecución o problemas con ESM. Mitigación: Vitest tiene soporte de primera clase nativo para ESM y TypeScript, lo cual minimiza los problemas de setup en comparación con Jest.

## Commands
```bash
Check: npx tsc --noEmit
Test: npx vitest run
Lint: npx eslint .
```
