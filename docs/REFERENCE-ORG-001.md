# REFERENCE-ORG-001 · Organizaciones construidas con IA

> **La pregunta no es "cómo copiamos estas empresas".** Es qué principios demostrados
> pueden ayudarnos a pasar de *Luka hace todo con IA* a *Luka dirige una organización
> construida con IA*.

**Fecha:** 25/08/2026 · **Cobertura:** 3/3 Reels al 100% · **Costo:** USD 0,00 (todo local)

---

## 1 · RESUMEN EJECUTIVO

Tres Reels, dos organizaciones reales, dos formas muy distintas de construir lo mismo.

| | **Reel 1 — Bennett OS** | **Reel 2 — Metallurgia AI** | **Reel 3 — Build session** |
|---|---|---|---|
| Autor | `@bennett.spooner` | `@pablo.gonzalez.virgili` | `@pablo.gonzalez.virgili` |
| Duración | 1:12 | 6:16 | 0:57 |
| Qué muestra | **La organización** | **La operación** | **La construcción** |
| Escala declarada | 37 agentes, 2 empresas | 1 metalúrgica | 35 agentes, 738 mejoras/2 meses |
| Base | Paperclip (OSS) + Claude Code + Hermes | n8n + Claude Code | agente de código + VPS |

**El hallazgo central:** Bennett **no construyó su orquestador** — usa
[Paperclip](https://github.com/paperclipai/paperclip), un proyecto MIT de 79,3k estrellas
que da org chart, roles, presupuestos, heartbeats, tickets y gates de aprobación. Pablo
**sí construyó el suyo** sobre n8n. Son las dos rutas posibles para Magna, y tienen costos
distintos.

**Los tres principios que más nos sirven:**

1. **El presupuesto es una primitiva del sistema, no un reporte.** En Bennett OS cada
   departamento tiene un monto asignado visible en el org chart. Eso es exactamente
   "Luka asigna capital" hecho software.
2. **El límite del sistema se convierte en la próxima funcionalidad.** En Metallurgia, cuando
   el agente no puede verificar algo, lo dice, y el usuario convierte esa carencia en un
   ticket de mejora (#404) que entra a la cola de producción.
3. **El dinero siempre pasa por un humano.** `Stripe: 5 recent charges available for
   confirmation` — el sistema prepara, la persona confirma.

**Lo que NO copiaríamos:** la escala (37 agentes sin necesidad demostrada), el LLM local
para tareas críticas, y el marketing de "zero-human companies".

**Evaluación del Lab: `YES`.** El pipeline comprendió los tres Reels al 100%. Pero requirió
arreglar cuatro bugs de ingesta en el camino, todos de la misma familia.

---

## 2 · COBERTURA REAL DE CADA REEL

Medición previa con `ffprobe`; muestreo repartido sobre todo el timeline (`lib/cobertura.js`).

### Reel 1 — `DbsKYpFgQ4l` · Bennett

```
DURACIÓN TOTAL   1:12  (72,19 s)   ·   SEGMENTOS 4
AUDIO            COMPLETE  100%   4/4   35 tramos · 298 palabras
VISIÓN/OCR       COMPLETE  100%   4/4   30 frames de 36 candidatos (6 dup, 0 bajo techo)
CONSOLIDADO      COMPLETE  100%
0:00 ████████████████████████████████ 1:12
```

### Reel 2 — `DbgwN-0p7sf` · Metallurgia AI

```
DURACIÓN TOTAL   6:16  (376,4 s)   ·   SEGMENTOS 8
AUDIO            COMPLETE  100%   8/8   89 tramos · 1.193 palabras
VISIÓN/OCR       COMPLETE  100%   8/8   120 frames de 188 (36 dup, 32 bajo techo)
CONSOLIDADO      COMPLETE  100%
0:00 ████████████████████████████████ 6:16
```

### Reel 3 — `DcaCXzdNCg2` · Sesión de construcción

```
DURACIÓN TOTAL   0:57  (57,36 s)   ·   SEGMENTOS 3
AUDIO            COMPLETE  100%   3/3   9 tramos · 167 palabras
VISIÓN/OCR       COMPLETE  100%   3/3   27 frames de 29 candidatos
CONSOLIDADO      COMPLETE  100%
0:00 ████████████████████████████████ 0:57
```

### Señales usadas y segmentos NO analizables

| Señal | Reel 1 | Reel 2 | Reel 3 |
|---|---|---|---|
| Audio / transcript (whisper.cpp `base`, local) | ✅ | ✅ | ✅ |
| Frames + OCR (`spa+eng`, psm 6, local) | ✅ | ✅ | ✅ |
| Metadata | ⚠️ vacía | ⚠️ vacía | ⚠️ vacía |
| Comprensión visual (modelo) | ❌ no existe | ❌ no existe | ❌ no existe |

**Ningún segmento quedó sin analizar.** Las limitaciones son de *profundidad*, no de cobertura:

- **Instagram no da título ni descripción** para estos ítems (`title = "Video by ..."`). La
  metadata no aporta nada; toda la señal es audio + pantalla.
- **32 frames únicos de Reel 2 quedaron bajo el techo de 120.** La cobertura es completa a
  nivel segmento, no exhaustiva a nivel frame. Declarado en `metricas.recortados_por_techo`.
- **El OCR corrobora, no lee.** Sirve para confirmar `CONDUCTOR`, `G-BRAIN`, `$168k budget`;
  no para leer el contenido íntegro de tarjetas y tablas.

> **Sobre el límite de 24 frames:** ya no existe. Era un `break` posicional documentado y
> corregido en `LAB-DEEP-UNDERSTANDING-001` antes de este sprint. No se cambió nada en
> silencio: el cambio está versionado, con arneses (`test/cobertura.test.js`) y su doc.

---

## 3 · TIMELINE DE HALLAZGOS

### Reel 1 — Bennett OS

| t | Señal | Hallazgo |
|---|---|---|
| 0:00 | audio | *"how I run my **37 AI agent team** to handle my business"* |
| 0:03 | audio | *"Everything starts with this **conductor agent**… Claude Code Headless on my mini"* |
| 0:12 | audio | *"delegating tasks to the other agents through something called **paperclip**… open source repo"* |
| 0:17 | audio | *"my conductor commanding all of the other **department heads**"* |
| 0:22 | audio+OCR | Fable 5 como agente del Conductor · OCR: `claude-fable-5` |
| 0:28 | audio+OCR | *"connect to **Hermes**, running **GLM 5.2**"* · OCR: `Hermes Gateway`, `glm 5.2` |
| 0:32 | audio | *"Hermes es la **capa de acción** entre lo que quiero y las tareas que se hacen"* |
| 0:37 | audio | *"Claude Code… quería usar mi suscripción y no la API, tengo que usar Headless"* |
| 0:45 | audio | *"lo más importante es **el cerebro del que todos los agentes toman**"* |
| 0:47 | audio | *"dos empresas, varios socios y varios empleados… **así ningún agente alucina**"* |
| 0:48 | OCR | `COMPANY BOARD - LIVE` · `G-BRAIN` · `KNOWLEDGE CORE` |
| 0:48 | OCR | `BEN-37 $168k budget: first move — Forge` · `BEN-39 $206k budget` · `$10k budget` |
| 0:50 | OCR | `the real CEO — claude-fable-5 on the company board - delegates, creates tasks, reads your data` |
| 0:52 | OCR | `ROSTER | HERMES | WORKERS` · `Gmail Worker` · `WhatsApp Worker` · `Comms Agent` |
| 0:52 | OCR | `Comms Agent: Gmail LIVE · WhatsApp DOWN · Slack LIVE` ← **observabilidad de canales** |
| 0:54 | OCR | `Payments Pulse Stripe: $229.23` · `5 recent charges available for confirmation` |
| 0:55 | OCR | `Client Roster · Attio Live: 108 deals on the roster + funnel backup holds 7 clients` |
| 0:56 | OCR | `Heartbeat — what it does: Runs on a schedule without anyone prompting` |
| 0:56 | audio | *"corriendo todo esto en mi **Mac Mini completamente local**"* |
| 1:01 | audio | *"conectado a **TailScale**, corriendo como web app en mi MacBook… desde cualquier lugar"* |
| 1:08 | audio | *"si querés el **repo gratis**… te lo mando"* |

### Reel 2 — Metallurgia AI

| t | Señal | Hallazgo |
|---|---|---|
| 0:00 | audio | *"cuatro agentes en paralelo programando una IA que maneja toda la información de esta empresa"* |
| 0:13 | audio | *"todos los canales: **Slack, WhatsApp, Asana, incluso reuniones**"* |
| 0:19 | audio | *"procesarla a través de **n8n**, tomar una IA con **diferentes modelos según la necesidad**"* |
| 0:20 | OCR | `CANALES  RUTEO  CEREBRO` |
| 0:34 | OCR | **`Las claves se guardan en esta PC y nunca s[alen]`** |
| 0:36 | OCR | `CONECTORES` — conexiones a proveedores de IA |
| 0:40 | OCR | `DIRECTORIO DE PERSONAS — Una fila por persona: Asana y Slack se unen solos por email` |
| 0:42 | audio | Agenda: recordatorios entregados **por el canal que el usuario ya usa** |
| 1:36 | audio | **Memoria semántica**: máquinas, turnos, rutas, procedimientos. Cargada desde entrevistas con gerentes |
| 1:52 | audio | **Memoria episódica individual**: por usuario, *"nadie tiene acceso más que ese mismo usuario"* |
| 1:59 | audio | **Memoria colectiva**: de grupos de Slack y comentarios de Asana |
| 2:24 | audio | **Consolidación nocturna**: *"guardan durante la noche… tomar los hechos, consolidarlos y [distribuirlos] en cada módulo"* |
| 2:30 | OCR | `LA MENTE DEL AGENTE` · `FASES DE LA MEMORIA` · *"la arquitectura de la mente humana trasladada a … sistema de memoria"* |
| 2:47 | audio | **Cola de mejoras**: los usuarios piden, se encola, *"tres agentes desarrollando tres funcionalidades"* |
| 3:20 | audio | **Testing**: *"agentes más pequeños pero expertos… estresando con casos ficticios"*; una funcionalidad **estresada 24 veces** |
| 3:40 | audio | **Escalado**: *"un agente superior en capacidad de modelo analiza si es error real o falsa alarma"* |
| 4:00 | audio | Ejemplo Slack → PDF → WhatsApp |
| 4:33 | audio | **Human gate**: *"no puedo verificar si el archivo llegó a tu WhatsApp — revisá el chat y confirmame"* |
| 4:41 | audio | El usuario pide una herramienta nueva → **mejora #404**, registrando **por qué canal se pidió** |
| 5:08 | audio+OCR | OT 331 en riesgo, límite 07/08, 9 días sin movimiento · OCR: `OT 4832`, `ALARMA` |
| 5:40 | audio | Recomienda destrabar y que **Bruno** cierre la definición técnica; sugiere preguntar a **Marcelo** |
| 5:00 | OCR | `192.168.88.250` ← IP privada, corrobora el local-first |

### Reel 3 — Sesión de construcción

| t | Señal | Hallazgo |
|---|---|---|
| 0:00 | audio | Sesión de agente de código corriendo **9 h 23 min** |
| 0:08 | audio | **+3.600 líneas agregadas, −368 eliminadas** |
| 0:17 | audio | *"disparó **35 agentes**, la mayoría en paralelo"* |
| 0:23 | audio | *"otros son **convocados en el momento** para revisar, auditar, integrar"* |
| 0:30 | OCR | `Preintegración live` · `Auditar paquete deploy` · `Review tests terminado` · `Revisión final deploy` |
| 0:36 | audio | Objetivo: *"terminadas, integradas, desplegadas y **verificadas** antes del lunes"* |
| 0:46 | OCR | `recovery instalado tiene SHA256 idéntico en PC y VPS` ← **verificación de integridad cruzada** |
| 0:46 | OCR | `la primera instalación se detuvo por una comilla de PowerShell al verificar el token` |
| 0:48 | OCR | `el journal de systemd para identificar qué precondición exacta falló. No relanzo hasta…` |
| 0:50 | OCR | `pedir a Martín un share` ← tarea derivada a humano |
| 0:52 | audio | **738 mejoras implementadas en dos meses** |

---

## 4 · ARQUITECTURA RECONSTRUIDA

### 4.1 · Bennett OS

```
PERSONAS      Bennett + socios + empleados (2 empresas)
    ↓
CANALES       Gmail · WhatsApp · Slack · web app vía TailScale
    ↓
ROUTING       Hermes Gateway (GLM 5.2) — "la capa de acción"
    ↓
CEREBRO       CONDUCTOR = "Conductor CEO", Claude Code Headless (Fable 5) en Mac Mini
    ↓
BOARD         COMPANY BOARD - LIVE (kanban); los agentes mueven sus propias tarjetas
    ↓
WORKERS       37 agentes · department heads con lead (ej. "CFO - Finances Lead")
              Hermes Workers: Gmail Worker · WhatsApp Worker · Comms Agent · Data Agent
    ↓
TOOLS         Stripe · Attio (CRM) · Notion · Gmail · Slack · WhatsApp
    ↓
MEMORIA       G-BRAIN / KNOWLEDGE CORE — "brain-store y la bóveda de Obsidian"
    ↓
CONTROLES     presupuesto por departamento · estado de canal LIVE/DOWN · heartbeats
    ↓
HUMAN GATE    "5 recent charges available for confirmation" (Stripe)
    ↓
ACCIONES      responder · crear tareas · mover tarjetas · confirmar pagos
```

**Componente por componente:**

| # | Componente | Qué hace | Evidencia exacta | Tecnología | Recibe | Produce | Determinista | Agentic | Solo | Humano |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | **Conductor** | CEO: delega, crea tareas, lee datos | OCR `the real CEO — claude-fable-5 on the company board - delegates, creates tasks, reads your data` | Claude Code Headless + `claude-fable-5` ✅ | instrucción libre | tareas para los demás | — | ✅ | ✅ | inicia el pedido |
| 2 | **Paperclip** | Orquestación: org chart, presupuestos, heartbeats, tickets | audio `through something called paperclip… open source repo` | [paperclipai/paperclip](https://github.com/paperclipai/paperclip) MIT ✅ | agentes vía adapter | agenda + contabilidad | ✅ | — | ✅ | aprobaciones |
| 3 | **Hermes** | Capa de acción / gateway a canales | audio + OCR `Hermes Gateway`, `glm 5.2` | [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent) + GLM ✅ | intención | ejecución en canales | parcial | ✅ | ✅ | — |
| 4 | **Company Board** | Kanban vivo del trabajo | OCR `Drag a card across the board as work moves. Agents advance their own cards` | no determinable | tareas | estado visible | ✅ | — | ✅ | observa |
| 5 | **Department heads** | Un lead por área | OCR `Finances CFO - Finances Lead`, `Workflows`, `Social`, `Content`, `Comms`, `Agents` | modelo por rol | tarea del Conductor | trabajo del área | — | ✅ | ✅ | — |
| 6 | **Workers** | Ejecutores por canal/herramienta | OCR `Gmail Worker`, `WhatsApp Worker`, `Comms Agent`, `Data Agent` | Hermes workers | tarea | acción concreta | parcial | parcial | ✅ | — |
| 7 | **G-BRAIN** | Conocimiento compartido | OCR `G-BRAIN`, `KNOWLEDGE CORE`, `query the whole brain`, `dump into the brain. or drop documents`, `brain-store and the Obsidian vault` | Obsidian + store ✅ parcial | texto/voz/archivos | contexto para todos | ✅ | — | ✅ | alimenta |
| 8 | **Presupuestos** | Tope por departamento | OCR `BEN-37 $168k budget: first move — Forge` (+5 más) | Paperclip budgets ✅ | asignación | tope duro | ✅ | — | ✅ | **asigna** |
| 9 | **Heartbeat** | Despertador programado | OCR `Heartbeat — what it does: Runs on a schedule without anyone prompting` | Paperclip ✅ | cron | ciclo de trabajo | ✅ | — | ✅ | — |
| 10 | **Salud de canales** | Estado LIVE/DOWN | OCR `Gmail LIVE · WhatsApp DOWN · Slack LIVE` | no determinable | pings | estado | ✅ | — | ✅ | interviene si cae |
| 11 | **Gate de pagos** | Confirmación humana de dinero | OCR `Stripe: 5 recent charges available for confirmation`, `Payments Pulse Stripe: $229.23` | Stripe ✅ | cargos | pagos confirmados | ✅ | — | ❌ | **confirma** |
| 12 | **Acceso remoto** | Llegar al sistema local desde afuera | audio `connected to TailScale… web app on my MacBook` | Tailscale ✅ | — | acceso | ✅ | — | ✅ | — |

**Modelos por rol (verificado en OCR):** `claude-fable-5` (Conductor/CEO) · `claude-opus-4-8` ·
`claude-sonnet-4-6` · `claude-haiku-4-5` · `glm 5.2` (Hermes). **No usa un modelo: usa una escalera.**

---

### 4.2 · Metallurgia AI

```
PERSONAS      empleados de la metalúrgica (Carla, Bruno, Marcelo, Franco…)
    ↓
CANALES       Slack · WhatsApp · Asana · reuniones
    ↓
ROUTING       n8n
    ↓
CEREBRO       selección de modelo según la necesidad + herramientas
    ↓
MEMORIA       semántica · episódica individual · colectiva  + consolidación nocturna
    ↓
WORKFLOWS     cola de mejoras → Claude Code → cola de testing → juez → producción
    ↓
CONTROLES     panel de producción · OT con estado y alarma
    ↓
HUMAN GATE    confirmación de entrega · OK a recordatorios
    ↓
ACCIONES      responder por el canal de origen · recordar · escalar · crear mejoras
```

| # | Componente | Qué hace | Evidencia | Tecnología | Determinista | Agentic | Solo | Humano |
|---|---|---|---|---|---|---|---|---|
| 1 | **Canales** | Entrada multi-canal | audio `Slack, WhatsApp, Asana, incluso reuniones` + OCR `CANALES` | Slack/WhatsApp/Asana ✅ | ✅ | — | ✅ | escribe |
| 2 | **Ruteo** | Distribuye el evento | audio `procesarla a través de n8n` + OCR `RUTEO` | n8n ✅ | ✅ | — | ✅ | — |
| 3 | **Cerebro** | Elige modelo y herramienta | audio `diferentes modelos, de acuerdo a la necesidad` + OCR `CEREBRO` | no determinable | parcial | ✅ | ✅ | — |
| 4 | **Conectores** | Credenciales de proveedores | OCR `CONECTORES`, `Las claves se guardan en esta PC y nunca s[alen]` | no determinable | ✅ | — | ✅ | configura |
| 5 | **Directorio de personas** | Identidad y rol por persona | OCR `DIRECTORIO DE PERSONAS — Una fila por persona: Asana y Slack se unen solos por email` | no determinable | ✅ | — | ✅ | alta |
| 6 | **Memoria semántica** | Máquinas, turnos, rutas, procedimientos | audio 1:41 · carga desde entrevistas con gerentes | no determinable | ✅ | — | ✅ | entrevista |
| 7 | **Memoria episódica** | Por usuario, **privada** | audio `nadie tiene acceso más que este mismo usuario` | no determinable | ✅ | — | ✅ | — |
| 8 | **Memoria colectiva** | De grupos y comentarios | audio 1:59 | no determinable | ✅ | — | ✅ | — |
| 9 | **Consolidación nocturna** | Compacta hechos en módulos | audio 2:24 | no determinable | parcial | ✅ | ✅ | — |
| 10 | **Buzón de mejora** | Pedido → ticket, con canal de origen | audio 4:41 (#404) + OCR `Buzón de Mejora` | no determinable | ✅ | — | ✅ | **pide** |
| 11 | **Cola de producción** | Implementación por agentes | audio `tres agentes desarrollando tres funcionalidades` | Claude Code ⚠️ inferido | ✅ | ✅ | ✅ | — |
| 12 | **Testers** | Estresan con casos ficticios | audio `estresó una funcionalidad 24 veces` | no determinable | parcial | ✅ | ✅ | — |
| 13 | **Juez** | Modelo superior decide real/falsa alarma | audio 3:40 | no determinable | — | ✅ | ✅ | — |
| 14 | **Panel de producción** | OT con estado, límite, días sin movimiento | audio OT 331 + OCR `OT 4832`, `ALARMA` | no determinable | ✅ | — | ✅ | lee |
| 15 | **Human gate** | El agente admite lo que no puede verificar | audio 4:33 | — | — | — | ❌ | **confirma** |

---

### 4.3 · Sesión de construcción (Reel 3)

Es el **motor de la cola de mejoras del Reel 2, visto por dentro**.

```
1 sesión larga (9h23m)  →  35 agentes  →  la mayoría en PARALELO
                                       →  otros CONVOCADOS bajo demanda:
                                            revisar · auditar · integrar
   ↓
Preintegración live → Auditar paquete deploy → Review tests → Revisión final deploy
   ↓
Verificación de integridad: SHA256 idéntico en PC y VPS
   ↓
Deadline duro declarado por el humano: "antes de las 7 de la mañana"
```

**Lo más interesante:** los agentes de revisión **no están siempre encendidos**. Se convocan
cuando hacen falta. Y hay un `Audit guard` con `Review tests terminado` como estado explícito.

También muestra un **fallo real manejado**: *"la primera instalación se detuvo por una comilla
de PowerShell al verificar el token"* y *"[reviso] el journal de systemd para identificar qué
precondición exacta falló. **No relanzo hasta** [entenderlo]"*. Es exactamente la disciplina
de no reintentar a ciegas.

---

## 5 · VERIFICADO vs INFERIDO vs NO DETERMINABLE

### ✅ VERIFICADO — fuente primaria alcanzada

| Claim | Fuente primaria | Qué confirma |
|---|---|---|
| **Paperclip existe y es OSS** | [github.com/paperclipai/paperclip](https://github.com/paperclipai/paperclip) | MIT · 79,3k ★ · 14,6k forks · Node.js 24.11+ / PostgreSQL / React. Org charts, heartbeats, tickets, **budgets con hard-stop**, governance/approvals, goal alignment. Adapters: Claude Code, Codex, Cursor, bash CLI, HTTP/webhook. **Soporta modo Tailscale** — coincide con el Reel. |
| **Hermes existe y corre GLM** | [github.com/NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent) | Agente OSS con memoria persistente y gateway a Telegram/Discord/Slack. Soporta proveedor **z.ai/GLM**. Coincide con `Hermes Gateway` + `glm 5.2`. |
| **Attio es un CRM con API** | [attio.com/platform/developers](https://attio.com/platform/developers) | REST + webhooks, objetos y atributos personalizables. Coincide con `Attio Live: 108 deals`. |
| **Tailscale, Stripe, Notion, Obsidian, n8n, Slack, WhatsApp, Asana** | productos conocidos | nombres legibles en pantalla y/o audio |
| **Modelos usados** | OCR directo | `claude-fable-5`, `claude-opus-4-8`, `claude-sonnet-4-6`, `claude-haiku-4-5`, `glm 5.2` |

> **Ojo, y es importante:** Paperclip se describe a sí mismo como *"orquestación open-source
> para empresas de cero humanos"*. **Existe y funciona; el encuadre es marketing.** El propio
> repo dice que hay gates de aprobación y firmas del board — o sea, humanos.

### ⚠️ INFERIDO — coherente pero sin confirmar

| Inferencia | Base | Por qué no es verificado |
|---|---|---|
| El Reel 2 usa Claude Code para implementar mejoras | audio: *"los agentes de Cloud Code"* | transcripción del modelo `base`; no aparece escrito |
| Los montos por departamento de Bennett | OCR `$168k`, `$206k`, `$120k`, `$10k` | **el OCR da cifras distintas para el mismo ID entre frames**. Que hay presupuestos es verificado; **los montos no** |
| "37 agentes" y "35 agentes" | audio | declarado por los autores, no contado en pantalla |
| Reel 3 usa el mismo sistema que Reel 2 | mismo autor · `MEJORA.md` · 738 mejoras | ningún frame los liga explícitamente |
| Metallurgia corre local | OCR `las claves… nunca salen` + `192.168.88.250` | evidencia fuerte pero indirecta |
| El Reel 3 despliega a un **VPS** | OCR `SHA256 idéntico en PC y VPS` | contradice parcialmente "todo local" |

### ❌ NO DETERMINABLE

- Qué agente de código usa el Reel 3 (la transcripción dice *"chat GPT code"*, probablemente error).
- Con qué está construido el stack de Metallurgia más allá de n8n (base, framework, UI).
- Cómo se implementan realmente las tres memorias.
- Si los 37/35 agentes son procesos distintos o roles del mismo runtime.
- Costo real de operación de cualquiera de los dos.
- Si Bennett usa Paperclip tal cual o modificado.

---

## 6 · MATRIZ COMPARATIVA

`ALREADY_HAVE` = existe y funciona · `PARTIAL` = existe a medias · `GAP` = falta y podría aportar

| CAPA | BENNETT | METALLURGIA | REEL 3 | MAGNA HOY | MAGNA OBJETIVO | GAP |
|---|---|---|---|---|---|---|
| **Conductor / orquestador** | Conductor CEO (Fable 5) | cerebro multi-modelo | 1 sesión madre | Claude en sesión, dirigido por Luka | un punto de entrada que delega | **GAP** |
| **Workers / agentes** | 37, department heads | 4 en paralelo | 35, algunos bajo demanda | subagentes de Claude Code | roles estables por área | **PARTIAL** |
| **Board / tablero** | COMPANY BOARD LIVE | cola de producción | pipeline de deploy | Bandeja de Decisiones (Freddy) | tablero de trabajo en curso | **PARTIAL** |
| **Channels** | Gmail/WhatsApp/Slack/web | Slack/WhatsApp/Asana | — | terminal + app web | WhatsApp primero | **GAP** |
| **Routing** | Hermes Gateway | n8n | — | ninguno | ruteo por tipo de evento | **GAP** |
| **Memory** | G-BRAIN | 3 memorias + consolidación | — | `freddy-agent-os/memory` + Graphify | memoria consultable por código | **PARTIAL** |
| **Shared knowledge** | Obsidian + brain-store | memoria colectiva | — | memoria canónica versionada | igual, ya está bien | **ALREADY_HAVE** |
| **Tools / connectors** | Stripe·Attio·Notion·Gmail | conectores de IA | systemd·SSH·VPS | SQLite·Excel COM·git | + WhatsApp, banco | **PARTIAL** |
| **Identity / directorio** | roster de agentes | DIRECTORIO DE PERSONAS | — | `supplier_identities` + `clase_contraparte` | personas y contrapartes | **PARTIAL** |
| **Workflows deterministas** | heartbeats, tickets | n8n | pipeline de deploy | `carga.js`, `gen_const_d.ps1`, cierres | igual, ya está bien | **ALREADY_HAVE** |
| **Workflows agentic** | agentes deciden | testers + juez | convocados bajo demanda | Claude en sesión | agentes con alcance acotado | **PARTIAL** |
| **Human gates** | confirmación Stripe | "confirmame que llegó" | deadline humano | Preflight + backup + OK de Luka | igual + gate de dinero | **ALREADY_HAVE** |
| **Observability** | canal LIVE/DOWN, presupuesto | panel de OT | tests + SHA256 | arneses 13/13, `validate_db`, brief | + salud de agentes | **PARTIAL** |
| **Continuous improvement** | tickets | **buzón de mejora #404** | 738 mejoras/2 meses | known_errors, decision_log | buzón que cierra el círculo | **PARTIAL** |
| **Research** | — | — | — | **Magna Intelligence Lab** | igual | **ALREADY_HAVE** |
| **System of Record** | Attio + Stripe | Asana + panel OT | git | **magna.db + Magna OS Familiar** | igual | **ALREADY_HAVE** |
| **System of Intelligence** | G-BRAIN + Conductor | memorias + cerebro | — | alertas, márgenes, MEG | igual, ya está fuerte | **ALREADY_HAVE** |
| **System of Action** | Hermes | n8n + canales | deploy | ninguno (Claude ejecuta a mano) | actuar sin Luka en el medio | **GAP** |
| **Presupuesto por área** | `$168k budget` por depto | — | — | ninguno | **asignación de capital** | **GAP** |
| **Heartbeat / scheduler** | Paperclip cron | consolidación nocturna | — | ninguno (verificado 25/8) | corrida nocturna | **GAP** |

---

## 7 · QUÉ YA TENEMOS

**Más de lo que estos Reels muestran, en las capas de abajo.**

1. **System of Record real y auditado.** `magna.db` con dump SQL versionable, backups
   rotados, `validate_db` con 92 checks. Ninguno de los dos Reels muestra algo comparable en
   integridad de datos.
2. **Human gates ya son ley.** Preflight + backup + OK explícito antes de tocar una fuente de
   verdad. Bennett tiene un gate (pagos); nosotros lo tenemos en toda escritura.
3. **Workflows deterministas donde corresponde.** Los cierres, la carga, el `const D`. No los
   estamos haciendo con agentes — y eso está bien.
4. **Memoria canónica versionada + Graphify.** El G-BRAIN de Bennett es un Obsidian vault;
   nosotros tenemos eso más un grafo consultable.
5. **Arneses.** Los 10 arneses de Freddy y los 43 tests del Lab. Ninguno de los Reels muestra
   nada equivalente — el Reel 3 muestra tests, pero de la app, no del sistema de agentes.
6. **El Lab.** Ninguna de las dos organizaciones tiene una capa de investigación.

---

## 8 · QUÉ NOS FALTA

Ordenado por lo que más cambiaría el día a día:

| # | Falta | Qué destraba | Evidencia de que sirve |
|---|---|---|---|
| 1 | **Canal de entrada que no sea la terminal** | Que el sistema reciba pedidos sin Luka abriendo una consola | Los dos Reels entran por WhatsApp/Slack. Es la diferencia entre herramienta y organización |
| 2 | **System of Action** | Que algo se ejecute sin Luka en el medio | Hermes en Bennett, n8n en Metallurgia. Nosotros hoy: Claude ejecuta a mano |
| 3 | **Heartbeat / scheduler real** | Trabajo nocturno | `Heartbeat: runs on a schedule without anyone prompting` |
| 4 | **Buzón de mejora** | Que cada límite encontrado se convierta en trabajo | #404 de Metallurgia. **Es lo más barato de la lista y lo más alto en rendimiento** |
| 5 | **Presupuesto por área** | Que "Luka asigna capital" sea software | `BEN-37 $168k budget` |
| 6 | **Roles estables con alcance acotado** | Dejar de re-explicar el contexto en cada sesión | department heads con lead |
| 7 | **Salud de agentes/canales** | Enterarse de que algo se cayó antes de necesitarlo | `WhatsApp DOWN` visible en el tablero |

---

## 9 · IDEAS QUE VALE LA PENA INVESTIGAR

1. **Paperclip como orquestador, en vez de construir uno.** MIT, Node 24 + PostgreSQL —
   nuestro stack. Da org chart, presupuestos, heartbeats, tickets y gates *de entrada*. La
   pregunta honesta: ¿queremos su modelo de "empresa" o solo su scheduler + budget?
   **Investigar en sandbox, no adoptar.**
2. **El buzón de mejora.** El patrón más valioso de todo el corpus y el más barato: cuando el
   sistema no puede hacer algo, lo dice y lo convierte en ticket **registrando por qué canal se
   pidió**. Sobre `magna.db` es una tabla y un endpoint.
3. **La escalera de modelos por rol.** Bennett corre Fable 5 de Conductor, Opus/Sonnet/Haiku
   abajo. Nosotros usamos el mismo modelo para todo.
4. **Consolidación nocturna de memoria.** Compactar la memoria episódica de la jornada en las
   memorias estables. Se conecta con Graphify.
5. **Memoria episódica privada por persona.** Relevante para La Gene: Guille no debería ver la
   memoria de sus empleados, ni al revés.
6. **Agentes convocados bajo demanda** (Reel 3) en vez de siempre encendidos. Más barato y más
   simple que 37 procesos vivos.
7. **Entregar por el canal donde se pidió.** Metallurgia contesta por WhatsApp si preguntaste
   por WhatsApp. Encaja con `feedback_inteligencia_segundo_orden`.
8. **Verificación de integridad cruzada** (SHA256 PC vs VPS). Aplicable a nuestros backups.

---

## 10 · QUÉ **NO** COPIARÍAMOS

| No | Por qué |
|---|---|
| **37 agentes** | Es la conclusión, no el punto de partida. Bennett tiene dos empresas con socios y empleados. Empezar por la cantidad es empezar por el final — y es lo que Luka ya dijo que no quiere. |
| **"Zero-human companies"** | Es el marketing de Paperclip. El propio repo tiene gates de aprobación y firmas del board. Nuestro diferencial es lo contrario: **el criterio de Luka sobre los números**. |
| **GLM 5.2 / LLM local para lo crítico** | Bennett lo usa como capa de acción. Para decisiones de plata, el modelo más barato es el lugar equivocado para ahorrar. |
| **Local-first absoluto** | Metallurgia dice "las claves nunca salen de esta PC" pero el Reel 3 despliega a un VPS. La postura pura no sobrevive al contacto con la operación. Nosotros ya elegimos local para datos y nube para razonar. |
| **Que los agentes muevan sus propias tarjetas** | Un agente que declara su trabajo terminado sin verificación externa es exactamente el `NONE 100%` que el Lab acaba de aprender a no hacer. |
| **Todo por agentes** | El Reel 2 usa n8n para rutear — determinista. Lo correcto es que la mayoría del sistema sea software común, y los agentes queden donde hace falta juicio. |
| **Construir el orquestador desde cero** | Pablo lo hizo y le llevó 738 mejoras en dos meses. Con diciembre a 14 semanas, no. |

---

## 11 · EVALUACIÓN DEL PIPELINE DEL LAB

# YES — con reservas

**Comprendió los tres Reels al 100% de cobertura**, en las dos pistas, con herramientas
locales y gratuitas. La reconstrucción arquitectónica de este documento salió del pipeline.

**Pero llegó ahí tras arreglar cuatro bugs, todos de la misma familia** — y **dos de ellos
aparecieron hoy, en este mismo sprint**:

| # | Bug | Detectado |
|---|---|---|
| 1 | Tope de frames posicional (`break` en barrido secuencial) | sprint anterior |
| 2 | `bestvideo` excluye el audio por definición | sprint anterior |
| 3 | **yt-dlp no encontraba ffmpeg** → bajaba las dos pistas, no podía multiplexarlas, y la capa visual reportaba *"no se pudo bajar el video"* con los dos archivos ahí al lado | **hoy** |
| 4 | **Mi propia regex de archivo** rompió la detección al arreglar el bug 3 | **hoy** |

**La forma es siempre la misma:** *la capa de ingesta trae menos de lo que hay, y la capa de
análisis reporta sobre lo que le llegó como si fuera todo.*

### El incidente que más importa de este sprint

Cuando el Reel 1 falló al bajar el video, **consulté el OCR de la base y encontré datos ricos
— que eran del 24/08, del run viejo de 24 frames.** Estuve a punto de reportar datos viejos
como hallazgo nuevo. Lo que lo impidió fue que la cobertura decía `NONE 0% 0/0`: el número
contradecía a los datos, y el número tenía razón.

**`CAPTURA != COBERTURA` se ganó el sueldo tres veces hoy.**

### Qué capacidad falta

| Falta | Impacto |
|---|---|
| **Comprensión visual** (modelo) | El OCR corrobora, no lee. Los diagramas los entendimos por el audio |
| **Frescura de la señal** | Nada distingue OCR de hoy de OCR de hace dos días. **Debería ser el próximo arnés** |
| **Modelo whisper `small`** | `base` confunde nombres: "club"=Claude, "chat GPT code"=? |
| **Cruce automático a fuente primaria** | Paperclip, Hermes y Attio los busqué yo a mano; `fuente_primaria.js` no se disparó |
| **Metadata de Instagram** | Ítems sin título real |

---

## 12 · RECOMENDACIÓN DE SIGUIENTE PASO

**No diseñar agentes todavía.** Antes hay que responder una pregunta que la evidencia de este
sprint deja plantear bien:

> **¿Qué funciones de Magna deberían ser software determinista, cuáles automatización,
> cuáles integración, cuáles agente, cuáles supervisor y cuáles human-in-the-loop?**

Lo que la evidencia sugiere para esa clasificación:

```
SOFTWARE DETERMINISTA   cierres · carga · cálculo de márgenes · validaciones · reportes
                        (ya lo tenemos y funciona — NO tocar)

AUTOMATIZACIÓN          heartbeat nocturno · backups · recolección del Lab
                        (falta scheduler real — Windows Task Scheduler, ya diagnosticado)

INTEGRACIÓN             WhatsApp · banco · POS
                        (la capa que más falta)

AGENTE                  itemización · alertas de precio · análisis de decisiones
                        (donde hace falta juicio, no cálculo)

SUPERVISOR              juez de errores real/falsa alarma · validación pre-entrega
                        (Metallurgia lo tiene; nosotros lo hacemos con arneses)

HUMAN-IN-THE-LOOP       dinero · escritura en fuente de verdad · alta de proveedor ·
                        cambio de precio público
                        (ya es ley — mantenerlo)
```

**Los tres candidatos concretos, en orden de rendimiento sobre esfuerzo:**

1. **Buzón de mejora sobre `magna.db`.** Una tabla, un endpoint, un renglón en el brief. Cierra
   el círculo entre "el sistema no pudo" y "esto es lo próximo que se construye". Barato hoy,
   compuesto en el tiempo.
2. **Cerrar el loop autónomo del Lab** (el gap que ya estaba identificado). Con `comprender.js`
   funcionando, la cola de 235 ítems ahora sí tiene con qué procesarse.
3. **WhatsApp como canal de entrada.** Es el paso 1 de las dos organizaciones que estudiamos, y
   sigue siendo el problema más caro de Guille (`DIST-PED-002`, 90-110 pedidos/día).

**Antes de cualquiera de las tres: la revisión conjunta.** Este documento es evidencia, no un
plan.

---

## FUENTES PRIMARIAS

- [github.com/paperclipai/paperclip](https://github.com/paperclipai/paperclip) — orquestación de agentes, MIT
- [github.com/NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent) — agente con memoria persistente y gateway
- [attio.com/platform/developers](https://attio.com/platform/developers) — CRM con API REST
- [github.com/agencyenterprise/paperclip-ai](https://github.com/agencyenterprise/paperclip-ai) — proyecto relacionado, no confirmado como el del Reel

## REPRODUCIR

```bash
cd C:\dev\magna-intelligence-lab
node scripts/comprender.js DbsKYpFgQ4l    # Bennett      1:12
node scripts/comprender.js DbgwN-0p7sf    # Metallurgia  6:16
node scripts/comprender.js DcaCXzdNCg2    # Build        0:57
node test/cobertura.test.js               # 10 arneses
```

**Ninguna API paga. Nada de Freddy OS ni Magna OS Familiar fue tocado.**
