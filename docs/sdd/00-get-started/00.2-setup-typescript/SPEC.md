# 00.2 — Configuración de TypeScript — Specification

## Objective
Instalar TypeScript y configurar `tsconfig.json` con opciones de compilación estrictas para el framework, asegurando soporte completo de ESM y Node 24.

## Effort
- Complexity: XS
- Rationale: Instalación de dependencia de desarrollo y edición de archivo de configuración.

## Dependencies
- package.json inicializado (00.1).

## Delivery Criteria
- TypeScript instalado como dependencia de desarrollo en `package.json`.
- Archivo `tsconfig.json` creado en la raíz configurado con:
  - `target: "ES2022"` (o posterior)
  - `module: "NodeNext"`
  - `moduleResolution: "NodeNext"`
  - `strict: true`
- El comando `npx tsc --noEmit` debe ejecutarse correctamente.

## Risks
- Configuración errónea de resolución de módulos ESM. Mitigación: Usar `NodeNext` tanto en `module` como en `moduleResolution`.

## Commands
```bash
Check: npx tsc --noEmit
Test: npx tsc --noEmit
Lint: npx eslint .
```
