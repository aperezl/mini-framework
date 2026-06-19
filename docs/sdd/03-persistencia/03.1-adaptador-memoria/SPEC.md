# 03.1 — Adaptador de Memoria — Specification

## Objective
Definir una interfaz abstracta para almacenamiento de historial (`MemoryAdapter`) y crear una implementación concreta usando el módulo nativo `node:sqlite` disponible en Node.js (v24), lo cual mantiene el framework libre de dependencias pesadas.

## Effort
- Complexity: M
- Rationale: Requiere estructurar tablas de almacenamiento de mensajes, realizar consultas SQL de inserción y lectura, y configurar la base de datos de manera embebida.

## Dependencies
- Estructura de mensajes e historial (02.2).

## Delivery Criteria
- Crear la interfaz `MemoryAdapter` y la clase `SQLiteMemoryAdapter` en `/src/storage/sqlite.ts`.
- Usar el módulo nativo `node:sqlite` de Node.js.
- Métodos requeridos: `getHistory(sessionId: string): Promise<Message[]>`, `saveMessage(sessionId: string, message: Message): Promise<void>`.
- Test unitario que cree una base de datos en memoria (`:memory:`), guarde un conjunto de mensajes de prueba y los recupere validando que coinciden perfectamente.

## Risks
- Concurrencia de escrituras en SQLite. Mitigación: Usar WAL mode o transacciones simples si se requiere atomicidad, aunque para un hilo de conversación de agente la concurrencia suele ser baja por sesión.

## Commands
```bash
Check: npx tsc --noEmit
Test: npx vitest run
Lint: npx eslint .
```
