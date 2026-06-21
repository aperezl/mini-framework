# 09.4 — CLI Runner & Integration Examples — Specification

## Objective
Desarrollar un binario ejecutable CLI (`src/cli.ts` o configurado en `package.json` para ejecutarse mediante `npm run run-agent`) que cargue archivos YAML pasados por argumentos, inicialice el runtime y ejecute el agente conversacional, y proveer ejemplos prácticos integrados.

## Effort
- Complexity: S
- Rationale: Creación del CLI y script de orquestación final, junto con la adición de ejemplos reales con YAML.

## Dependencies
- Debe realizarse tras **09.3 — Dynamic Loading of Tools, MCP, & Middlewares**.

## Delivery Criteria
1. **CLI Script**:
   - Crear `src/cli.ts` que lea el argumento `--config` (o `-c`), cargue el archivo YAML y ejecute `AgentRuntime`.
   - Registrar el script en `package.json` como `"run-agent": "tsx src/cli.ts"`.
2. **YAML Integration Examples**:
   - Crear un ejemplo `examples/yaml-configs/basic-agent.yaml` configurado con Stdio, almacenamiento SQLite y un agente sencillo.
3. **End-to-End Verification**:
   - Validar que el agente responde y funciona interactivamente en consola mediante `npm run run-agent -- --config examples/yaml-configs/basic-agent.yaml`.

## Commands
```bash
npx tsc --noEmit
npx vitest run
```
