# EVAL · whatsapp-agentkit — ¿cambia el plan de FREDDY-AUTO-001?

**Reel:** [instagram.com/reel/Da1GEOuE7Sn](https://www.instagram.com/reel/Da1GEOuE7Sn/) ·
`@juanpablo.rosso` · 1:16
**Fecha:** 26/08/2026 · **Costo del análisis:** USD 0,00

---

## COBERTURA — declarada, no maquillada

```
DURACIÓN TOTAL   1:16  (76,35 s)   ·   SEGMENTOS 4
AUDIO            COMPLETE  100%   4/4   22 tramos · 321 palabras
VISIÓN/OCR       PARTIAL    75%   3/4   11 frames de 38 (27 duplicados)
CONSOLIDADO      PARTIAL    75%
```

⚠️ **COBERTURA PARCIAL.** Un segmento de los 4 no tiene ningún frame único: 27 de 38
candidatos eran la misma pantalla (el creador hablando a cámara). **No es un fallo del
pipeline: es un Reel con poca variación visual.** El audio sí está completo, y la pieza
crítica —el link del repo— la sacó el OCR igual.

---

## 1 · QUÉ HACE REALMENTE

**El Reel esconde el link** (*"comentá la palabra agente y te lo paso"*). **El OCR lo leyó de
la pantalla igual**, en el bloque del README:

```
git clone https://github.com/Hainrixz/whatsapp-agentkit.git
```

**No es un bot ni una librería. Es un generador de agentes conversacionales de WhatsApp que
corre dentro de Claude Code.** El flujo declarado:

1. `git clone` + `bash start.sh` (verifica Python 3.11+ y Claude Code)
2. Abrís Claude Code y escribís `/build-agent`
3. **Claude te hace un interrogatorio de 10 preguntas** sobre tu negocio, tono, horarios
4. **Claude escribe el proyecto entero** en tu disco
5. Probás en un simulador de terminal
6. Le decís *"conectalo a WhatsApp"* y te guía

Casos que menciona: clínicas, barberías, inmobiliarias, ecommerce.

---

## 2 · FUENTE PRIMARIA

| | |
|---|---|
| **Repo** | [github.com/Hainrixz/whatsapp-agentkit](https://github.com/Hainrixz/whatsapp-agentkit) |
| **Licencia** | **MIT** |
| **Estrellas / forks** | 464 / 144 |
| **Creado** | 18/03/2026 |
| **Último push** | **19/08/2026** — hace 7 días, **activo** |
| **Issues abiertos** | 10 |
| **Lenguaje** | **Python** |
| **Topics** | `claude-code`, `whatsapp-api`, `meta-cloud-api`, `zernio`, `fastapi` |

### El dato que cambia cómo hay que leerlo

**El repo tiene 13 archivos. No hay ninguna carpeta `agent/`.**

```
    78.9 KB   CLAUDE.md          ← 2.155 líneas
    33.4 KB   scripts/audit.py
    15.2 KB   README.md
     3.2 KB   start.sh
     2.4 KB   .claude/commands/build-agent.md
     + LICENSE · .env.example · .gitignore · settings.local.json
     + docs/ (index.html, hero-card.html, hero.png) · knowledge/.gitkeep
```

**Todo el código del agente vive embebido dentro de `CLAUDE.md`**, como bloques que Claude
Code escribe a disco: `providers/base.py` (línea 474), `providers/zernio.py` (594),
`providers/meta.py` (805), `main.py` (981), `brain.py` (1195).

> **Es auditable —pude leerlo entero— pero no es una dependencia.** No se instala, no se
> versiona, no recibe actualizaciones. Es una **copia por única vez** que aterriza en tu repo.

---

## 3 · ARQUITECTURA

```
WhatsApp
   ↓
Zernio  |  Meta Cloud API            ← adaptadores intercambiables
   ↓ POST /webhook
main.py — verifica la firma (HMAC-SHA256, compare_digest)
   ↓
providers/ — normaliza a MensajeEntrante
   ↓
memory.py — ¿evento ya procesado? → descarta
   ↓
main.py — responde 200 AHORA y encola en segundo plano
   ↓ ──────── fuera del ciclo del webhook ────────
memory.py — historial de esa conversación (SQLite/PostgreSQL)
   ↓
brain.py — Claude con system prompt + historial + mensaje
   ↓
providers/ — envía la respuesta
```

**Stack:** FastAPI + Uvicorn · SQLAlchemy · Docker · Claude API · patrón adapter.

### La calidad está en los detalles, y son detalles ganados con dolor

Los comentarios del código muestran problemas reales ya vividos:

- **Responder 200 antes de trabajar.** *"Los proveedores esperan un 2xx en unos 5 segundos.
  Llamar a Claude tarda más. Si procesás antes de contestar, el proveedor asume que el webhook
  falló y reintenta — **hasta 7 veces** — y el cliente recibe la misma respuesta repetida."*
- **Candado por número de teléfono.** *"En WhatsApp es normal que alguien mande 'hola' y medio
  segundo después la pregunta de verdad: sin esto los dos mensajes se procesarían en paralelo,
  los dos leerían el mismo historial y **las escrituras quedarían intercaladas**."*
- **Firma con `hmac.compare_digest`** (comparación de tiempo constante), rechazo explícito de
  webhooks sin firma, y aviso fuerte si falta el secret: *"los webhooks NO se verifican. Sirve
  para probar, pero no lo dejes así en producción."*
- **`hub.challenge`** de Meta manejado (el handshake GET de alta del webhook).
- **Salud ≠ vivo.** *"que el servidor conteste no significa que el agente pueda responder por
  WhatsApp"* — **es literalmente el arnés A1 de Freddy, descubierto por otro camino.**
- **`or` en vez del default de `os.getenv`**, porque una variable declarada vacía devuelve `""`.

### Y es honesto sobre lo que NO hace

> *"Hoy el agente generado **no llama las tools solo**: son funciones listas para usar, pero
> conectarlas al ciclo de tool use de Claude es un paso aparte. Si el usuario pide que el
> agente agende de verdad y no solo que hable de agendar, **decíselo claro** en vez de dar por
> hecho que ya funciona."*

Un proyecto que documenta su propio límite en vez de venderlo resuelto sube varios puntos.

---

## 4 · QUÉ NOS AHORRA

**Nuestro plan previsto:**

```
WhatsApp → Meta Cloud API → webhook/adapter → Intake Core → preguntas faltantes → Proposal Mode → human gate
                            └──────────────┘
                            LA ÚNICA CAJA QUE NO TENEMOS
```

**AgentKit resuelve exactamente esa caja, y nada más de lo nuestro.**

| Pieza | Clasificación | Por qué |
|---|---|---|
| **`providers/meta.py`** — firma, `hub.challenge`, envío | **TEST_NOW** | Es el adaptador que estábamos por escribir. Meta directo, sin vendor |
| **Responder 200 y encolar** | **GAP_REAL** | No lo teníamos pensado. Sin esto: tormenta de reintentos y respuestas duplicadas |
| **Deduplicación por id de evento** | **GAP_REAL** | Meta entrega *at-least-once*. No estaba en el plan |
| **Candado por número de teléfono** | **GAP_REAL** | Escrituras intercaladas por dos mensajes seguidos. **No se me había ocurrido** |
| **Historial por conversación** | **GAP_REAL parcial** | Nuestro intake es por documento; el Q&A multi-turno sí necesita estado |
| **`CLAUDE.md` como conocimiento** | **MEJORA_EXISTENTE** | 2.155 líneas de "cómo se hace bien esto". Vale como referencia aunque no usemos una línea de código |
| **`brain.py`** (agente conversacional) | **REJECT** | **Reemplazaría nuestro Intake Core**, que está validado (Slice 1 + 1b) y codifica el conocimiento de Freddy |
| **`/build-agent`** (el interrogatorio) | **REJECT** | Genera un agente desde cero. Nosotros ya tenemos uno |
| **`tools.py`** | **ALREADY_HAVE** | Las nuestras son reales y andan; las de él son plantillas sin cablear |
| **Zernio** | **WATCH** | Vendor intermediario. Nuestro plan es Meta directo |
| **`scripts/audit.py`** | **WATCH** | 33 KB de auditoría del resultado generado. No lo leí entero |

**El ahorro concreto: cuatro detalles de transporte que cada uno cuesta una sesión de debug
descubrir** — el 200-primero, el dedup, el candado por teléfono y la verificación de firma
bien hecha.

---

## 5 · QUÉ **NO** NOS RESUELVE

1. **Construye el agente equivocado para nosotros.** AgentKit hace un bot que **le habla a
   clientes desconocidos**. Freddy necesita lo contrario: **un canal para un único usuario
   conocido** que manda un parte o una factura, y el sistema hace intake estructurado con gate
   humano. Mismo transporte, propósito opuesto.
2. **No tiene proposal mode ni human gate.** Su agente responde solo. El nuestro **no puede
   escribir sin OK** — es ley del proyecto.
3. **No sabe nada del negocio.** Ni `clase_contraparte`, ni las 21 reglas, ni los 74
   known_errors, ni la fórmula de precios. Todo eso ya lo tenemos y él no lo tiene.
4. **Las tools no están cableadas.** Lo dice el propio doc.
5. **No resuelve el pendiente del Slice 1b**: qué hacer cuando la contraparte es `socio` o
   `facturadora`. Eso es conocimiento nuestro.

---

## 6 · RIESGOS

| # | Riesgo | Severidad |
|---|---|---|
| **1** | **Segundo runtime.** AgentKit es Python 3.11 + FastAPI + SQLAlchemy + Docker. `magna-pyme-os` es **Node 22 con `node:sqlite` y cero dependencias**. Adoptarlo entero mete un stack paralelo que hay que mantener | **ALTA** |
| **2** | **No es una dependencia: es una copia.** Sin `pip install`, sin versión pinneable. Un arreglo upstream **no te llega**. Lo que copiás es tuyo para siempre | **ALTA** |
| **3** | **El código lo escribe un LLM en tu máquina.** El repo trae la plantilla, pero el resultado final depende de qué haga Claude ese día. **Hay que auditar lo que aterriza**, no confiar en que salió como en el doc | **MEDIA** |
| **4** | **Zernio = dependencia de vendor.** Es el camino recomendado por el repo. Meta directo existe y es el nuestro | **BAJA** si vamos por Meta |
| **5** | **Ventana de 24 h de WhatsApp.** No puede iniciar conversación fuera de ella. **No es limitación del kit, es de Meta** — y aplica a nuestro plan igual | **MEDIA**, y ya la teníamos |
| **6** | **Autor sin trayectoria verificable.** 464 ★ en 5 meses es real pero joven. 10 issues abiertos | **BAJA** — MIT y auditable |

**Costos:** AgentKit gratis (MIT) · Claude API USD 0,02–0,11 por conversación de 8 mensajes ·
Zernio 2 cuentas gratis, después USD 3–21/mes · Railway USD 5/mes.
**Con Meta directo y nuestro propio hosting, el costo marginal es solo la API de Claude.**

---

## 7 · VEREDICTO

# TEST_NOW — pero de la mitad de abajo, no del producto

**No adoptar el kit. Leer el transporte.**

Concretamente: leer `providers/meta.py` y la sección de `main.py` del `CLAUDE.md`
—**ya están descargadas en `/c/dev/_diag_reel/agentkit_CLAUDE.md`**— y portar a Node las
cuatro decisiones de transporte: **verificación de firma con comparación de tiempo constante ·
`hub.challenge` · responder 200 y encolar · dedup por id de evento · candado por número.**

**Rechazar** `brain.py`, `/build-agent` y todo lo que quiera generar un agente: eso
reemplazaría el Intake Core validado por un chatbot genérico.

**Lo más valioso no es el código: es la lista de errores que ya cometió alguien.**

---

## 8 · ¿CAMBIA EL PLAN DE FREDDY-AUTO-001?

# NO. Lo confirma y lo abarata.

```
WhatsApp → Meta Cloud API → webhook/adapter → Intake Core → preguntas → Proposal Mode → human gate
                            └── sigue siendo nuestra, ahora con referencia ──┘
```

**La arquitectura prevista era correcta.** Lo que cambia es que la única caja que no teníamos
construida ahora tiene una implementación de referencia, escrita por alguien que ya se comió
la tormenta de reintentos y el bug de escrituras intercaladas.

**Tres cosas que sí hay que agregar al plan** (las tres son GAP_REAL, ninguna estaba):

1. **Responder 200 antes de procesar** — si no, Meta reintenta hasta 7 veces.
2. **Deduplicar por id de evento** — la entrega es *at-least-once*.
3. **Candado por número de teléfono** — dos mensajes seguidos entrelazan las escrituras.

**Lo que NO cambia:** Meta directo (no Zernio) · el Intake Core se mantiene · proposal mode y
human gate siguen siendo ley · sigue pendiente el camino de `socio`/`facturadora` del Slice 1b.

---

## NOTA DE MÉTODO

El Reel promete el link a cambio de un comentario. **El Lab lo leyó de la pantalla y fue
directo a la fuente.** El README del repo describe una arquitectura de 15 archivos; el repo
tiene 13 y ninguno es esos. **Los dos datos hacían falta para no recomendar mal**, y ninguno
sale de escuchar al divulgador.

**No se tocó Freddy OS. No se instaló nada. No se implementó nada.**
