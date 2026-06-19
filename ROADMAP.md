Para crear un framework ligero de orquestación de LLMs en TypeScript, la clave es evitar la "sobre-ingeniería" (demasiada abstracción) y centrarse en la **componibilidad**.

Aquí tienes un roadmap técnico dividido en bloques lógicos, diseñado para que puedas iterar con rapidez (DX) y rendimiento (performance).

---

### Fase 1: Core - La abstracción del "Tooling"

Antes de pensar en "agentes", necesitas un sistema robusto para convertir código TypeScript en algo que un LLM pueda ejecutar.

1. **Definición de contrato:** Define una interfaz para tus herramientas que fuerce el uso de un validador (Zod es el estándar aquí).
2. **Generador de Schema:** Crea una función que transforme el `ZodSchema` a un `JSON Schema` (usando `zod-to-json-schema`). El LLM *solo* entiende JSON, no tipos de TS.
3. **Registry Pattern:** Implementa un `ToolRegistry` que actúe como un `Map<string, ToolDefinition>`. Esto permitirá que tu orquestador busque la función por su nombre rápidamente cuando el LLM la solicite.
4. **Ejecutor de tipos:** Crea un envoltorio que aplique `zod.parse()` antes de llamar a tu función real. Si el LLM alucina un parámetro, tu framework debe lanzar un error de validación antes de que el código falle.

### Fase 2: El Loop - Orquestación y Estados

Un framework no es nada sin un bucle que gestione el diálogo entre el modelo y tus herramientas.

1. **El Agente (Orquestador):** Implementa una clase `Agent`. Su método principal `run()` debe ser un bucle `while`.
2. **Manejo de estados:** El `run()` debe recibir un historial de mensajes. En cada iteración:
* Envía el historial al LLM.
* Si el LLM responde con `tool_calls`, busca en el `Registry` y ejecuta las funciones.
* Añade los resultados al historial.
* Repite hasta que el modelo devuelva un `finish_reason: "stop"`.


3. **Contexto (State Management):** Permite que el agente tenga un objeto `context` (ej. una instancia de base de datos, un logger, configuraciones) que se inyecte en cada herramienta al ejecutarse.

### Fase 3: Persistencia y "Local-First"

Un framework serio debe permitir que las tareas se pausen y reanuden.

1. **Adaptador de Memoria:** No guardes el historial solo en RAM. Define una interfaz simple (`getHistory`, `saveMessage`) y crea una implementación para SQLite (muy fácil de integrar con Bun).
2. **Serialización:** Asegúrate de que el historial sea serializable. Los resultados de las herramientas deben guardarse con un `tool_call_id` asociado para mantener la integridad del hilo de conversación.

### Fase 4: DX (Developer Experience) y Extensibilidad

Aquí es donde conviertes una "librería" en un "framework".

1. **Middleware:** Crea un sistema donde puedas ejecutar funciones antes/después de que se ejecute una herramienta (ej. logging, métricas, validación de permisos).
2. **Streaming:** Implementa el soporte para `ReadableStream`. La latencia en LLMs es alta; si el usuario no ve el texto fluir, la experiencia es pobre.
3. **MCP Integration:** Crea un cliente que pueda "leer" servidores MCP. Esto dará a tu framework la capacidad de conectarse a herramientas existentes en el ecosistema (Postgres, GitHub, Slack, etc.) sin que tengas que escribirlas tú.

### Fase 5: Ejemplos Prácticos e Integrados

1. **Ejemplos Integrados:** Crea una carpeta `/examples` con scripts funcionales que consuman el mini-framework para demostrar cómo orquestar agentes con herramientas, persistencia SQLite, middleware, streaming y el cliente MCP.

### Fase 6: Documentación del Proyecto

1. **Guías Paso a Paso:** Documentar detalladamente en el directorio `/docs` el diseño del core, el ciclo de ejecución, middlewares, base de datos local y conectividad MCP externa para guiar a los desarrolladores.

---

### Arquitectura de directorios recomendada

Para mantenerlo ligero, busca una estructura plana:

```text
/src
  /core
    agent.ts       // El bucle de ejecución
    registry.ts    // Gestión de herramientas
  /schemas
    tool.ts        // Definición de tipos y validación
  /storage
    sqlite.ts      // Persistencia
  /utils
    json-schema.ts // Conversión Zod -> JSON
index.ts           // Punto de entrada (public API)

```

### ¿Qué evitar para mantenerlo ligero?

* **No inventes tu propio validador:** Quédate con `Zod` o `TypeBox`. Son robustos y cubren el 99% de los casos.
* **Evita la herencia profunda:** Usa composición. Prefiere interfaces pequeñas y funciones puras antes que clases gigantes con estados ocultos.
* **No acoples el framework al LLM:** Define una interfaz `LLMProvider` (que tenga un método `chat`). Así, si mañana quieres cambiar de OpenAI a Anthropic o a un modelo local (Llama via Ollama), el usuario solo necesita cambiar el adaptador.

¿Qué parte de este roadmap te parece más crítica de resolver ahora mismo para que tu idea sea viable? ¿La integración de herramientas o la persistencia de estado?