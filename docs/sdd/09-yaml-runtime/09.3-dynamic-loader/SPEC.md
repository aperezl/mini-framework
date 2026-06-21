# 09.3 — Dynamic Loading of Tools, MCP, & Middlewares — Specification

## Objective
Implementar la carga dinámica de plugins (herramientas locales y middlewares de terceros) utilizando importaciones dinámicas de ESM (`import()`) a partir de rutas especificadas en el archivo de configuración YAML, así como la inicialización automatizada de servidores de Model Context Protocol (MCP) declarados en el archivo.

## Effort
- Complexity: M
- Rationale: Carga de módulos de manera dinámica en NodeJS en formato ESM y la gestión del ciclo de vida del cliente/procesos MCP a partir de variables y configuraciones de entorno dinámicas.

## Dependencies
- Debe realizarse tras **09.2 — Runtime Engine Core & I/O Adapters**.

## Delivery Criteria
1. **Dynamic Tool & Middleware Imports**:
   - Programar en `AgentRuntime` el soporte para cargar herramientas que exporten una instancia de `Tool` por defecto o por nombre a partir de `modulePath`.
   - Cargar middlewares dinámicamente desde `modulePath` y añadirlos al agente mediante `agent.use()`.
2. **MCP Server Auto-connection**:
   - Parsear la configuración `mcp` dentro del bloque de herramientas de YAML.
   - Instanciar `MCPClient` para cada servidor configurado, conectar con el servidor levantando su subproceso, obtener sus herramientas registradas y agregarlas dinámicamente a la instancia de `ToolRegistry` del agente.
3. **Clean Up / Disconnect**:
   - Asegurar que `AgentRuntime.close()` cierre de manera ordenada todas las conexiones y subprocesos MCP levantados.
4. **Tests**:
   - Añadir tests que validen la importación correcta de herramientas locales y simulen el arranque de MCPClients.

## Commands
```bash
npx tsc --noEmit
npx vitest run
```
