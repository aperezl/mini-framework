# 02.3 — Contexto & State — Specification

## Objective
Permitir que el agente inyecte un objeto compartido `context` (que contenga instancias de bases de datos, loggers, credenciales o configuraciones globales) a cada herramienta cuando es ejecutada.

## Effort
- Complexity: S
- Rationale: Añadir un argumento opcional a la firma del método `execute` de las herramientas y al ciclo de ejecución en el agente.

## Dependencies
- Agente Orquestador (02.1) y Definición de Contrato (01.1).

## Delivery Criteria
- Modificar la interfaz `Tool` para recibir un parámetro opcional `context` en su método `execute`.
- Modificar el método `Agent.run()` para que acepte un objeto `context` y lo pase a la ejecución de las herramientas.
- Test unitario que pase un mock de logger en el context y verifique que la herramienta puede escribir logs en él.

## Risks
- Fugas de estado o datos compartidos entre diferentes ejecuciones de agentes. Mitigación: Forzar a que el objeto `context` sea instanciado de forma independiente por cada ejecución o agente.

## Commands
```bash
Check: npx tsc --noEmit
Test: npx vitest run
Lint: npx eslint .
```
