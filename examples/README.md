# Mini-Framework Code Examples

Este directorio contiene ejemplos prácticos de uso de cada uno de los módulos de la librería.

Todos los ejemplos se ejecutan de forma **100% offline** utilizando un proveedor LLM local simulado (`MockLLMProvider`), por lo que no es necesario configurar claves de API para probarlos.

## Lista de Ejemplos

1. **`basic-agent.ts`**: Registro de herramientas local en Zod, inyección de contexto (logger) en la ejecución de la herramienta y bucle conversacional del agente.
2. **`persistent-agent.ts`**: Persistencia y recuperación del historial de chat utilizando la base de datos local SQLite (`SQLiteMemoryAdapter`).
3. **`middleware-agent.ts`**: Registro de middlewares pre-ejecución (`beforeExecute`) y post-ejecución (`afterExecute`) para registro de rendimiento (duración) y protección selectiva de herramientas mediante validación de permisos.
4. **`streaming-agent.ts`**: Consumo parcial en tiempo real de respuestas textuales y eventos estructurados de llamadas a herramientas mediante `agent.runStream()`.
5. **`mcp-agent.ts`**: Integración con herramientas externas usando el cliente de Server Context Protocol (`MCPClient`) comunicándose por comandos CLI stdio.

## Cómo Ejecutar los Ejemplos

Puedes ejecutar cualquiera de los ejemplos utilizando los comandos npm agregados en `package.json`:

```bash
# Ejemplo Básico
npm run example:basic

# Ejemplo con Persistencia SQLite
npm run example:persist

# Ejemplo con Middlewares
npm run example:middleware

# Ejemplo con Streaming
npm run example:stream

# Ejemplo con Cliente MCP
npm run example:mcp
```
