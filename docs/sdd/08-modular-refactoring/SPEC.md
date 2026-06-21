# 08.1 — Refactorización Modular y Proveedores Personalizados — Specification

## Objective
Refactorizar la arquitectura del framework para potenciar la modularidad, permitiendo la creación sencilla de proveedores de LLM personalizados (custom providers) y mejorando la extensibilidad de los middlewares mediante hooks adicionales (como interceptores de llamadas al LLM). El objetivo es que el Core quede completamente desacoplado de los adaptadores y se facilite la integración de extensiones de terceros.

## Effort
- Complexity: L
- Rationale: Definición de una especificación detallada de refactorización modular. La implementación posterior reorganizará los puertos, adaptadores y hooks de middleware para hacer el sistema completamente extensible.

## Delivery Criteria
1. **Plan de Estructura de Módulos (Separación de Capas)**:
   - Definir la reestructuración de directorios para independizar el `/core` de los adaptadores externos (como `/storage` y `/adapters`).
   - Establecer guías de importaciones limpias de modo que el core no dependa de implementaciones específicas (ej. SQLiteMemoryAdapter u OllamaProvider).

2. **Extensión del Sistema de Middlewares (Middlewares de LLM)**:
   - Planificar la adición de nuevos hooks al ciclo del agente en `src/core/agent.ts`:
     - `beforeLLMCall`: Ejecutado antes de llamar al LLM (permite mutar mensajes o inyectar prompts de sistema).
     - `afterLLMCall`: Ejecutado inmediatamente después de recibir la respuesta del LLM (permite registrar latencia, contar tokens o auditar).
     - `onStreamToken`: Hook para interceptar cada token del stream en tiempo real.

3. **Puerto de LLMProvider & Custom Providers**:
   - Refinar la especificación del puerto `LLMProvider` para asegurar que sea trivial implementar cualquier API externa (OpenAI, Anthropic, Gemini, o proveedores locales propios).
   - Incluir ejemplos teóricos y plantillas de diseño para la implementación de un proveedor personalizado.

4. **Verificación de Compatibilidad**:
   - Asegurar que los cambios no rompan la compatibilidad hacia atrás (backward compatibility) del API pública exportada en `src/index.ts`.

## Commands
```bash
npx tsc --noEmit
npx vitest run
```
