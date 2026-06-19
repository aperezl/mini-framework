# 03.2 — Serialización — Specification

## Objective
Garantizar que todo el historial de conversación (incluyendo `tool_calls` y sus resultados con `tool_call_id`) sea completamente serializable a formato de texto (JSON) para guardarse de forma íntegra en la base de datos de SQLite, y deserializable de vuelta a los objetos tipados correspondientes.

## Effort
- Complexity: S
- Rationale: Procesamiento JSON simple de estructuración de columnas y tipos en la base de datos.

## Dependencies
- Adaptador de Memoria (03.1).

## Delivery Criteria
- Asegurar que la implementación de `SQLiteMemoryAdapter` serialice el campo `content` y los metadatos de `tool_calls` a cadenas JSON válidas.
- Validar mediante tests unitarios que propiedades complejas no se pierdan al serializar/deserializar (por ejemplo, el campo `tool_calls` en los mensajes del asistente y los objetos de error).

## Risks
- Pérdida de tipos en la deserialización de campos opcionales. Mitigación: Validar la salida recuperada utilizando el esquema o tipado estricto en TypeScript.

## Commands
```bash
Check: npx tsc --noEmit
Test: npx vitest run
Lint: npx eslint .
```
