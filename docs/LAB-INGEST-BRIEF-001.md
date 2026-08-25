# LAB-INGEST-001 + LAB-BRIEF-001

> De **information collection** a **intelligence delivery**.
> El Lab dejó de entregar items. Ahora entrega decisiones.

---

## LAB-INGEST-001 — el Lab escucha

**El bug:** la fuente del podcast estaba cargada y activa desde el 18/08 con **0 items** y
error `sin feed conocido`. Luka encontró el episodio #175 a mano — **y era el más reciente
del feed.**

**La causa:** un link de `open.spotify.com` no dice dónde está el RSS. `parseRss()` ya existía
y funcionaba. **No falló el criterio: falló la ingesta.**

**El arreglo:** `resolverRssPodcast()` en `lib/feeds.js` — el buscador público de Apple
resuelve el RSS por nombre. **Una llamada HTTP, sin autenticación, sin dependencias nuevas.**
Exige coincidencia de nombre: traer el feed de OTRO podcast sería peor que no traer ninguno.

**Resultado:**

```
✓ spotify:show:7kyKbKwr...   178 nuevos de 178      (0,8 s)
```

**Los dos episodios que Luka encontró a mano ya están adentro:**
- `#175 MAKE: cómo conectar IA, datos y herramientas SIN PROGRAMAR`
- `#173 HARNESS de IA: el código que POTENCIA a los AGENTES`

### Salud por fuente

`sources` ahora guarda `last_attempt` · `last_success` · `last_error` · `fallas_seguidas` ·
`items_ultima_corrida`. **El podcast no puede volver a fallar 7 días en silencio:** queda
registrado y sube al brief solo.

### Cobertura honesta

`items.coverage` (`COMPLETE` / `PARTIAL` / `NONE`) + `coverage_pct` + `coverage_nota`.

Nace del Reel B: **188 frames candidatos, 24 procesados ≈ 13%**. Decir "analizado" sobre el
13% de una fuente es mentir por omisión. El brief marca `⚠ COBERTURA PARCIAL` cuando el
veredicto se apoya en parte del material.

⚠️ **Las columnas existen pero `lib/vision.js` todavía no las escribe.** Deuda declarada.

---

## LAB-BRIEF-001 — el Lab entrega

**Separación obligatoria, igual que el Intake Core:**

```
lib/brief.js      → la inteligencia. NO imprime nada. Devuelve un objeto.
scripts/brief.js  → adaptador consola/markdown. NO tiene lógica.
```

Cuando exista WhatsApp o email, consume **el mismo objeto**.

**Cuatro bloques:** qué hice · lo que necesita tu atención · cola de análisis · salud ·
qué descarté.

**Prioridad:** manda la **confianza** del match, no el puntaje solo. Un 10/10 con confianza
`LOW` no es una recomendación, es una corazonada.

**Deduplicación:** `items.briefed_at`. Lo ya mostrado no vuelve como nuevo.

**Triage ≠ hallazgo.** La cola marca contenido sin analizar cuyo título menciona algo del
vocabulario. **Está etiquetado como candidato a propósito:** analizar 178 episodios cuesta
tiempo y API; el título ordena la cola, no decide.

---

## El primer Morning Brief real

```
5 de 16 fuentes activas · 241 piezas capturadas
6 analizadas a fondo · 235 en cola
2 match(es) contra 13 problemas abiertos · 16 descartados

PRIORIDAD 1
anthropics/skills → WF-REG-002 — "La regla ya existía y no se buscó"
CONFIANZA: HIGH · relevancia 10/10

SALUD
instagram  INACTIVA   0/10   podcast  OK  1/1 · 178 items   youtube  OK  4/5
```

**Luka lee 2 decisiones, no 241 items.**

---

## ¿Habría encontrado el Lab el #175 solo?

**Hoy: parcialmente.** Con honestidad:

| | |
|---|---|
| ¿Lo habría **capturado**? | ✅ **Sí.** Ahora entra solo, y es el más reciente |
| ¿Lo habría **puesto en la cola**? | ✅ Sí — el triage ya levanta episodios por vocabulario |
| ¿Lo habría **analizado y emitido veredicto**? | ❌ **No automáticamente.** El análisis se dispara a mano |

**El Lab pasó de sordo a "lo escucha y lo pone en la cola".** Falta que la cola se procese
sola.

---

## Qué sigue manual

1. **Disparar el análisis.** `analizar.js` se corre a mano, item por item
2. **Nadie corre el brief solo** — no hay scheduler
3. **Instagram** sigue con ingesta manual (funciona: los 3 Reels entraron)
4. **`vision.js` no escribe la cobertura** que el schema ya soporta
5. **Los podcasts no se transcriben** — hoy solo entran título y descripción

## Qué falta para que corra solo de noche

1. **Scheduler** — Claude Code tiene agendado nativo. Es la pieza que falta, no infra nueva
2. **Cola con presupuesto** — analizar 235 items cuesta plata. Necesita tope diario
3. **Un adaptador de entrega que llegue a Luka sin abrir la terminal**

## Primer Delivery Adapter recomendado

**Un archivo Markdown en el repo, versionado.** Antes que WhatsApp o email.

Porque: cuesta cero, ya está escrito (`--md`), queda **versionado en git** — así se puede ver
cómo evolucionó el criterio del Lab — y ChatGPT lo lee sin conectores. WhatsApp recién cuando
el brief valga la pena leerlo todos los días.

---

## Bugs encontrados

1. **`return` en vez de `continue`** dentro del cálculo de salud: abortaba la función entera
   y devolvía `undefined`. Lo cazó la primera corrida
2. Los template literals se rompieron al escribirlos vía bash — se corrigieron con edición directa

## Deuda declarada

- `vision.js` no escribe `coverage`
- No hay tope de presupuesto para el análisis en lote
- El triage usa coincidencia de título: **es una cola, no un criterio**
