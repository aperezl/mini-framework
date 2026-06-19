# 04.3 — MCP Integration — Specification

## Objective
Crear un cliente del protocolo MCP (Model Context Protocol) para conectar dinámicamente servidores MCP externos (por ejemplo, Postgres, GitHub) como herramientas registrables en el `ToolRegistry` sin necesidad de reimplementarlas localmente.

## Effort
- Complexity: L
- Rationale: Requiere conectividad mediante standard input/output (stdio) o Server-Sent Events (SSE) con el servidor MCP externo y mapear su contrato de herramientas a nuestro `ToolRegistry`.

## Dependencies
- Registro de herramientas (01.3) y Definición de Contrato (01.1).

## Delivery Criteria
- Crear una clase o adaptador `MCPClient` en `/src/core/mcp.ts` o similar.
- Métodos para conectarse a un servidor MCP por comando CLI (stdio) y listar sus herramientas.
- Mapear las herramientas devueltas por el servidor MCP en objetos compatibles con nuestra interfaz `Tool` y registrarlas en el `ToolRegistry`.
- Test unitario simulando la conexión a un servidor dummy MCP y verificando el registro exitoso de sus herramientas.

## Risks
- Conexiones caídas o bloqueos de procesos hijo stdio. Mitigación: Implementar tiempos de espera (timeouts) en las peticiones al servidor y un ciclo de vida limpio para matar los procesos hijo del servidor al destruir el cliente.

## Commands
```bash
Check: npx tsc --noEmit
Test: npx vitest run
Lint: npx eslint .
```
