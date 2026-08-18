# Decision Log — Magna Intelligence Lab

Una fila por decisión. No se borra: si una se revierte, se agrega otra que la anula.
Mismo formato que `freddy-agent-os/project/decision_log.md`, que ya lleva meses funcionando.

**Lo que más vale dentro de seis meses es el "por qué", no el "qué".**

---

## D-001 · La base del Lab arranca en SQLite, no en Postgres/Supabase
**Fecha:** 17/08/2026 · **Estado:** ✅ Vigente · **Decidido por:** Luka

- **Contexto.** ChatGPT diseñó el schema sobre Postgres + Supabase + pgvector. Es un buen
  diseño y es la respuesta correcta a doce meses.
- **Alternativas.** (a) Supabase desde el día uno. (b) SQLite ahora, migrar después. (c) Solo markdown.
- **Elección: (b).** El schema se porta casi tal cual.
- **Motivo.** Node 24 trae `node:sqlite` nativo: cero dependencias, cero servicio, cero claves
  que gestionar. Ya se opera SQLite en `magna-pyme-os/magna.db` y ya existe un `dump_db.js`
  que lo vuelca a SQL versionable en git. Con diciembre encima, tres semanas de infra para
  empatar con lo que ya funciona es tiempo que no tenemos.
- **Tradeoff.** Un solo escritor y sin acceso remoto. Irrelevante mientras el Lab corra en
  la PC de Luka; deja de serlo el día que haya tablero web multiusuario.
- **Cuándo se revisa.** Cuando se quiera el tablero accesible desde el celular o desde afuera.
  Ese día el schema ya está probado y migrar es directo.

## D-002 · El Lab vive en un repo propio, separado de `freddy-agent-os`
**Fecha:** 17/08/2026 · **Estado:** ✅ Vigente · **Decidido por:** Luka

- **Contexto.** `freddy-agent-os/` ya cubre seis de las siete piezas que ChatGPT proponía en
  `/intelligence` (decisiones, reglas, agentes, experimentos, research skill, memoria).
  La única que faltaba era el registro de problemas.
- **Alternativas.** (a) Todo dentro de `freddy-agent-os`. (b) Repo nuevo que lo referencia.
- **Elección: (b).**
- **Motivo.** No es arquitectura, es **el puente con ChatGPT**. Un repo limpio y publicable en
  GitHub es algo que ChatGPT puede leer entero sin que se le exponga la contabilidad de Freddy.
- **Consecuencia.** `freddy-agent-os` sigue siendo la memoria canónica del negocio y no se
  toca. El Lab la referencia por path; no la duplica. Si algo se contradice, **gana
  `freddy-agent-os`**.

## D-003 · Sin pgvector: la capa semántica ya existe y se llama Graphify
**Fecha:** 17/08/2026 · **Estado:** ✅ Vigente

- **Contexto.** El schema original traía `knowledge_chunks` con `embedding vector`.
- **Elección:** no se porta esa tabla.
- **Motivo.** Graphify está adoptado desde el 04/08 y ya tiene un grafo de 160 nodos y 44
  comunidades sobre la memoria, con god nodes y consultas BFS. pgvector es la respuesta
  correcta con 100.000 documentos; hoy hay 47 archivos de memoria y 152 logs.
- **Cuándo se revisa.** Si el corpus del Lab crece a un volumen donde Graphify deje de
  responder bien. Se mide, no se supone.

## D-004 · n8n no entra en el V1
**Fecha:** 17/08/2026 · **Estado:** ✅ Vigente

- **Contexto.** El diseño de ChatGPT ponía a n8n como "sistema nervioso" de la automatización.
- **Verificado:** n8n **no está instalado** (no está en PATH ni existe `~/.n8n`).
- **Motivo.** Claude Code ya tiene agendado nativo, subagentes en background y orquestación en
  abanico. Lo que n8n aportaría en el V1 ya está disponible sin instalar ni mantener un
  servicio más con su propia base.
- **Cuándo se revisa.** Cuando haya que orquestar procesos que **no** sean agentes de Claude
  Code (webhooks de terceros, integraciones externas, colas con workers).

## D-005 · Ningún agente del Lab toca producción
**Fecha:** 17/08/2026 · **Estado:** ✅ Vigente · **Heredada**

- **Origen.** `freddy-agent-os/AGENTS.md` §12 y `skills/external_repo_research/SKILL.md`.
  No es nueva: ya es ley del proyecto y funcionó con Gentle-AI/Engram.
- **Regla.** Los agentes pueden leer, clonar, investigar, instalar **en sandbox**, medir y
  recomendar. Freddy, La Gene y Magna OS Familiar **no se modifican** porque un agente vio
  algo interesante. Entre el veredicto y producción hay siempre una decisión humana.

## D-006 · Un problema sin evidencia no entra al radar
**Fecha:** 17/08/2026 · **Estado:** ✅ Vigente

- **Origen.** Línea de `FIRST_DATA_TO_LOAD.md` de ChatGPT: *"Cargar problemas concretos
  únicamente desde evidencia real del cliente. No inventar necesidades."*
- **Implementación.** `problems.evidence` es `NOT NULL` y `init_db.js` aborta si falta.
  Y los scores `severity` / `economic_impact` arrancan en `NULL`: **se valoran con el cliente,
  no por nuestra cuenta.** Un radar lleno de dolores inventados es peor que un radar vacío,
  porque el Matching Engine después le cree.
