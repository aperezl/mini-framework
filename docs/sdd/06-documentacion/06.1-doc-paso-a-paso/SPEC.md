# 06.1 — Documentación Paso a Paso — Specification

## Objective
Escribir una documentación exhaustiva y estructurada del framework en la carpeta `/docs` que guíe paso a paso al usuario en cada una de las funcionalidades de la librería.

## Effort
- Complexity: S
- Rationale: Redacción técnica estructurada y explicaciones detalladas con fragmentos de código del mini-framework.

## Dependencies
- Ejemplos Integrados (05.1).

## Delivery Criteria
- Crear un índice o README principal de documentación técnica dentro de la carpeta `/docs` (usando enlaces relativos).
- Redactar guías detalladas paso a paso para cada uno de los siguientes módulos:
  - **Tooling:** Creación de herramientas con Zod y registro en `ToolRegistry`.
  - **Agent Loop & State:** Funcionamiento del loop `Agent.run()`, tipado de mensajes y estados.
  - **Context:** Inyección de contexto y variables globales.
  - **Persistence:** Configuración y persistencia en base de datos SQLite local usando `SQLiteMemoryAdapter`.
  - **Middleware:** Creación y configuración de hooks antes y después de ejecuciones.
  - **Streaming:** Consumo en tiempo real del flujo de tokens con `runStream()`.
  - **MCP Integration:** Uso del `MCPClient` para mapear herramientas externas de servidores stdio.
- Cada sección debe contar con ejemplos claros de código y explicaciones teóricas/arquitecturales rápidas.

## Risks
- Desactualización frente a cambios en la API pública. Mitigación: Sincronizar la documentación directamente con las interfaces del mini-framework definidas en `src/index.ts`.

## Commands
```bash
Check: npx tsc --noEmit
```
