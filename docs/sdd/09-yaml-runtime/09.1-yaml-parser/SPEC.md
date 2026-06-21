# 09.1 — YAML Config Parser & Schema Validation — Specification

## Objective
Definir la estructura de configuración para los agentes del framework utilizando esquemas de `zod` e implementar el parser para decodificar ficheros YAML a objetos tipados en TypeScript, validando de forma estricta todas las opciones de configuración (agente, proveedor de LLM, herramientas, almacenamiento, middlewares e I/O).

## Effort
- Complexity: S
- Rationale: Requiere definir un ZodSchema con validaciones robustas y realizar el parseo de YAML a JSON usando una dependencia como `yaml`.

## Dependencies
- Ninguna dependencia de tareas anteriores. Se requiere añadir la librería `yaml` al proyecto.

## Delivery Criteria
1. **Config Schema Definition**:
   - Crear el archivo `src/core/runtime/config-schema.ts`.
   - Exportar `YAMLConfigSchema` (Zod Schema) y el tipo `YAMLConfig`.
2. **YAML Parsing Helper**:
   - Implementar una función helper `parseYAMLConfig(yamlContent: string): YAMLConfig` que convierta el contenido del string YAML a un objeto TypeScript validado por Zod, arrojando errores descriptivos ante fallos de validación.
3. **Tests**:
   - Crear `src/core/runtime/config-schema.test.ts` con casos de prueba para ficheros válidos de agente básico, agentes con MCP y almacenamiento, e inválidos (configuraciones incompletas o tipos erróneos).

## Boundaries
- **Ask first:** Añadir la dependencia `yaml`.
- **Never do:** Pasar por alto validaciones de Zod o fallos de parseo.

## Commands
```bash
npx tsc --noEmit
npx vitest run src/core/runtime/config-schema.test.ts
```
