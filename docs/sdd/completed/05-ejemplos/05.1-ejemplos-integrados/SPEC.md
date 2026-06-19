# 05.1 — Ejemplos Integrados — Specification

## Objective
Crear una carpeta `examples/` en la raíz del proyecto que contenga guías y scripts ejecutables que demuestren de forma práctica cómo utilizar todas las funcionalidades del framework.

## Effort
- Complexity: M
- Rationale: Requiere estructurar ejemplos claros y concisos que usen la librería importándola directamente (por ejemplo, simulando el consumo de un paquete externo) y cubran todas las características (registro de herramientas, base de datos SQLite, middlewares, streams y clientes MCP).

## Dependencies
- Todas las tareas del core y DX (Fases 1 a 4).

## Delivery Criteria
- Crear el directorio `/examples` en la raíz del proyecto.
- Implementar un ejemplo de chat interactivo que integre:
  - Definición de herramientas usando Zod.
  - Registro de herramientas en el `ToolRegistry`.
  - Instanciación de un `Agent` con un proveedor LLM simulado.
  - Inyección de contexto (logger/database) en la ejecución de las herramientas.
  - Persistencia de estados a través de la base de datos de `SQLiteMemoryAdapter`.
  - Middleware para logs de ejecución y verificación de permisos.
  - Consumo de streaming parcial a través del método `runStream()`.
  - Conexión dinámica a herramientas a través de `MCPClient`.
- Proveer un script npm en `package.json` para ejecutar los ejemplos fácilmente.
- Instrucciones de uso claras en un `examples/README.md`.

## Risks
- Dificultades al simular la API del LLM sin claves de API reales en entornos locales. Mitigación: Implementar un proveedor local simulado (dummy/mock provider) bien documentado para que el ejemplo pueda ejecutarse offline de forma inmediata.

## Commands
```bash
Check: npx tsc --noEmit
Test: npx vitest run
```
