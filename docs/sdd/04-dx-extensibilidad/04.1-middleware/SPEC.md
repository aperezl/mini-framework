# 04.1 — Middleware — Specification

## Objective
Crear un sistema de hooks o middleware que permita a los desarrolladores registrar funciones para ejecutarse antes y/o después de la llamada a cualquier herramienta (útil para auditorías, logs, validación de permisos externos y métricas de rendimiento).

## Effort
- Complexity: M
- Rationale: Requiere una cadena de ejecución secuencial ordenada (tipo cebolla o pipeline) que pueda alterar los inputs/outputs de las herramientas o interrumpir la ejecución.

## Dependencies
- Registro de herramientas (01.3) y Ejecutor de tipos (01.4).

## Delivery Criteria
- Crear tipos y handlers para `Middleware` (ej: `beforeExecute`, `afterExecute`) en `/src/core/middleware.ts` u orquestador.
- Proveer soporte en la clase `Agent` para registrar middlewares globales o específicos por herramienta.
- Test unitario que demuestre que un middleware de logging registra correctamente la llamada, y que un middleware de permisos puede denegar la ejecución de una herramienta específica lanzando un error.

## Risks
- Middlewares asíncronos lentos que degraden el rendimiento de ejecución. Mitigación: Añadir medición opcional de duración y recomendar ejecutar procesos secundarios asíncronos no bloqueantes cuando sea aplicable.

## Commands
```bash
Check: npx tsc --noEmit
Test: npx vitest run
Lint: npx eslint .
```
