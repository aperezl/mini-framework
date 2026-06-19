# 02.1 — Agente Orquestador — Specification

## Objective
Implementar una clase `Agent` cuyo método principal `run()` controle el bucle de ejecución `while` para la comunicación recursiva con el LLM.

## Effort
- Complexity: M
- Rationale: Requiere integrar la llamada a la API de un LLM (usando un adaptador abstracto de proveedor) y procesar respuestas con múltiples llamadas de herramientas secuenciales o paralelas.

## Dependencies
- Registro de herramientas (01.3) y ejecutor de tipos (01.4).

## Delivery Criteria
- Crear la clase `Agent` en `/src/core/agent.ts`.
- Método `run()` que envíe el historial de mensajes al LLM.
- Detectar llamadas a herramientas (`tool_calls`) y resolverlas llamando al `ToolRegistry`.
- Continuar llamando al LLM de forma recurrente hasta que el modelo retorne `finish_reason: "stop"`.
- Tests unitarios utilizando un mock o proveedor dummy de LLM.

## Risks
- Bucle infinito si el LLM se queda atascado haciendo llamadas a herramientas sin avanzar. Mitigación: Implementar un parámetro de seguridad `maxIterations` (ej. 10) que interrumpa el loop y lance un error si se excede.

## Commands
```bash
Check: npx tsc --noEmit
Test: npx vitest run
Lint: npx eslint .
```
