# MAGNA-ORG-002 · Department Contract V1

> Convertir la evidencia de Freddy OS en un contrato mínimo reutilizable para cualquier
> departamento inteligente de Magna.
>
> **READ ONLY.** No se implementó, instaló ni modificó nada.

**Fecha:** 25/08/2026 · **Fuente principal:** `MAGNA-ORG-001-FREDDY-PATTERN.md`
**Evidencia secundaria:** `REFERENCE-ORG-001.md`

---

## NOTA DE ALCANCE — una corrección necesaria

El pedido decía *"usá el código/contexto real de Magna OS que ya auditamos"*.
**Magna OS Familiar no había sido auditado.** En las sesiones previas se auditaron Freddy OS
(`magna-pyme-os`) y el Lab; Magna OS Familiar solo figuraba como una fila en `projects` del
Lab, **con 0 problemas cargados**.

**Lo audité ahora, read-only**, en `C:\Users\lukam\MagnaOS-Familiar\magna-app`
(Next.js + TypeScript + Supabase). La sección C sale de esa auditoría, no de contexto previo.

---

# A · MAGNA DEPARTMENT CONTRACT V1

**Principio de derivación:** una capacidad entra al contrato si Freddy la tiene y funciona
(🟢), o si Freddy **no** la tiene y el daño es observable (🔴). Lo que viene de Bennett,
Metallurgia o Paperclip **no entra** — va a la sección F como hipótesis.

**Riesgo** = qué pasa si la capacidad falla o falta.

---

## Capacidades OBLIGATORIAS

### C1 · `record` — fuente de verdad

| | |
|---|---|
| **Propósito** | Un único lugar donde vive el hecho. Derivable y versionado. |
| **Obligatoria** | ✅ |
| **Evidencia** | `magna.db` + `create_schema.js` + `seed/` + `magna.dump.sql` en git + backups rotados. El arnés **M4** verifica que el plano coincida con la tabla real. **Y el daño de no cumplirlo**: `data/*.json` conviviendo con la base (riesgo R1). |
| **Interfaz mínima** | `esquema()` declarado · `reconstruir()` desde semilla · `dump()` versionable · `backup()` verificado abriéndolo |
| **Riesgo** | **CRÍTICO** — sin esto no hay departamento, hay archivos |
| **Human gate** | ✅ para escribir |

### C2 · `rules-as-code` — las fórmulas en código

| | |
|---|---|
| **Propósito** | Que dos sesiones distintas den el mismo número. |
| **Obligatoria** | ✅ |
| **Evidencia** | `precios.js` (markup por rubro, ÷1,21, ×2 ÷0,955), `motor_alertas.js` (última compra comparable, mismo régimen), `carga.js` (saldoCaja). Las fórmulas **no están en el prompt**. |
| **Interfaz mínima** | funciones puras, testeables, con la regla de negocio citada en el encabezado |
| **Riesgo** | **ALTO** — una fórmula en prompt deriva sin que nadie lo note |
| **Human gate** | ❌ para calcular · ✅ para cambiar la fórmula |

### C3 · `knowledge` — el conocimiento fuera del modelo

| | |
|---|---|
| **Propósito** | Que la inteligencia no se vaya con la sesión ni con el modelo. |
| **Obligatoria** | ✅ |
| **Evidencia** | 21 reglas + 9 workflows en Markdown versionado. El modelo es intercambiable. |
| **Interfaz mínima** | Markdown versionado, una regla por archivo, con fecha y motivo |
| **Riesgo** | **ALTO** — conocimiento en la cabeza del modelo se pierde en cada release |
| **Human gate** | ✅ para promover a canónico |

### C4 · `recall` — buscar antes de afirmar

| | |
|---|---|
| **Propósito** | Que el conocimiento escrito se **encuentre**. Tenerlo no alcanza. |
| **Obligatoria** | ✅ |
| **Evidencia** | **KE#70**: la regla existía, estaba vigente y en contexto, y no se encontró porque se buscó por apellido y estaba redactada por concepto. Luka: *"que busques mejor no depende de una regla, tendríamos que hacerlo regla"* → `regla.js`. **KE#73**: "GONZALES"≠"GONZALEZ" → `fuzzy.js`. **18/08**: "ALEJANDRO BEBIDAS → NUEVO" con la regla en `proveedores_canonicos.md` **línea 121** → `memoria_lookup.js`. |
| **Interfaz mínima** | `buscar(concepto)` → `{archivo, linea, parrafo}`. Por **concepto**, con sinónimos, tolerante a acentos/plurales/escritura. **Devuelve la cita, no un sí/no** |
| **Riesgo** | **ALTO** — es la capacidad que más veces evitó un error en Freddy |
| **Human gate** | ❌ read-only |

> **Este slot no estaba en la lista tentativa de MAGNA-ORG-001 y es de los más valiosos.**
> *Buscar antes de afirmar* es una capacidad, no un buen hábito.

### C5 · `known_errors` — el catálogo que alimenta candados

| | |
|---|---|
| **Propósito** | Que un error ya cometido no vuelva sin que nadie lo note. |
| **Obligatoria** | ✅ |
| **Evidencia** | 74 entradas con **síntoma / causa / solución / prevención / estado**. Alimenta las 21 reglas y los 13 arneses. |
| **Interfaz mínima** | los 5 campos. **`prevención` y `estado` no son opcionales**: sin prevención es una anécdota, sin estado no se sabe si sigue vigente |
| **Riesgo** | **ALTO** — sin esto el departamento repite errores |
| **Human gate** | ❌ para escribir un error · ✅ para declararlo resuelto |

> **Slot propio, separado de `knowledge`:** otro formato, otro ciclo de vida, y es la entrada
> del harness.

### C6 · `harness` — los candados, con score como gate

| | |
|---|---|
| **Propósito** | Que el sistema se pregunte solo si un bug conocido volvió. |
| **Obligatoria** | ✅ |
| **Evidencia** | 13 arneses, cada uno nacido de un bug real y fechado. **`_pruebas.js` verifica que los arneses sepan fallar.** *"La autoevaluación del agente es leer ese número, no opinar."* Y el `NONE 0% 0/0` del Lab que impidió reportar datos viejos como hallazgo nuevo. |
| **Interfaz mínima** | `correr()` → score · comparar contra la corrida anterior · **el score es el gate de entrega** · `_pruebas` que verifiquen que los candados fallan · excepciones **declaradas** (`_salvedades.json`), nunca silenciosas |
| **Riesgo** | **CRÍTICO** — es la única defensa real contra un agente que se declara exitoso |
| **Human gate** | ❌ corre solo · ✅ para agregar una salvedad |

### C7 · `identity` — quién es quién

| | |
|---|---|
| **Propósito** | Que la misma entidad escrita de diez formas sea una sola. |
| **Obligatoria** | ✅ |
| **Evidencia** | `supplier_identities` (56) + `supplier_aliases` (30) + `supplier_product_codes` (114) + `clase_contraparte`. El motor de alertas agrupaba por texto y daba Karina/Matiz falsos hasta que se agrupó por `supplier_id`. |
| **Interfaz mínima** | canónico + alias + **código externo** + clase. `resolver(texto)` → identidad o **NUEVO explícito** |
| **Riesgo** | **ALTO** — identidad rota contamina todo lo que agrupa |
| **Human gate** | ✅ para el alta |

### C8 · `human_gates` — nada se escribe sin OK

| | |
|---|---|
| **Propósito** | Que ninguna escritura en fuente de verdad ocurra sin una decisión humana. |
| **Obligatoria** | ✅ |
| **Evidencia** | Preflight + backup + OK explícito, ley del proyecto (`AGENTS.md`). Y el patrón de `intake/core.js`: **proposal mode** (lee todo, no escribe nada) + *"si no sabe, PREGUNTA; nunca adivina"*. |
| **Interfaz mínima** | `proponer()` separado de `escribir()` · backup **verificado** antes · el gate debe poder quedar registrado como dato, no solo como conversación |
| **Riesgo** | **CRÍTICO** — con dinero, un dato inventado es peor que un hueco declarado |
| **Human gate** | ✅ es el gate |

### C9 · `inputs` — por dónde entra el trabajo

| | |
|---|---|
| **Propósito** | Que el departamento reciba trabajo sin que una persona sea el canal. |
| **Obligatoria** | ✅ |
| **Evidencia** | 🔴 **por ausencia.** Freddy no tiene canal: Luka **es** el input. Es el gap #1 de MAGNA-ORG-001. La pieza que sí existe es la **separación canal/lógica** de `intake/core.js`: *"este archivo NO sabe que existe una consola"* — la lógica no se muda cuando cambia el canal. |
| **Interfaz mínima** | `recibir(evento)` con la **lógica separada del canal**. Las preguntas se devuelven como **datos** (`{campo, texto, opciones}`), no como texto renderizado |
| **Riesgo** | **ALTO** — sin canal es una herramienta, no un departamento |
| **Human gate** | ❌ para recibir |

### C10 · `outputs / actions` — qué puede ejecutar, enumerado

| | |
|---|---|
| **Propósito** | Que la superficie de acción sea explícita y acotada. |
| **Obligatoria** | ✅ |
| **Evidencia** | 🔴 **por ausencia parcial.** Freddy tiene 5 endpoints, 2 escriben, y **nada sale hacia afuera**: el texto de WhatsApp se genera y Luka lo copia a mano. El System of Action es Luka. |
| **Interfaz mínima** | lista **enumerada** de acciones ejecutables, cada una con su nivel de riesgo (L0–L3) |
| **Riesgo** | **MEDIO** — hoy la superficie chica es virtud de seguridad y límite de autonomía a la vez |
| **Human gate** | ✅ para todo lo que sale hacia afuera o mueve plata |

### C11 · `health` — está vivo, al día y sirviendo lo del disco

| | |
|---|---|
| **Propósito** | Saber si el departamento está funcionando antes de necesitarlo. |
| **Obligatoria** | ✅ |
| **Evidencia** | `salud.js` + `/api/health` con **huella del código servido** — nació del arnés A1: *4 días sirviendo código viejo, Luka veía roto lo ya arreglado*. |
| **Interfaz mínima** | `salud()` → `{vivo, al_dia, huella, pendientes}`. **La huella importa**: "está vivo" no es lo mismo que "está sirviendo lo que creés" |
| **Riesgo** | **MEDIO** |
| **Human gate** | ❌ |

---

## Capacidades RECOMENDADAS

### C12 · `plans` — el plan como artefacto

| | |
|---|---|
| **Propósito** | Poder auditar qué se pensó hacer contra qué se hizo. |
| **Obligatoria** | ⭕ recomendada |
| **Evidencia** | 42 planes versionados (`planes/dia_*.js`, `alta_*.json`) + `logs/dryruns/` + `logs/contracts/` + `templates/execution_contract.md` |
| **Interfaz mínima** | plan versionado antes de ejecutar · dry-run antes de escribir |
| **Riesgo** | **MEDIO** |
| **Human gate** | ✅ el plan se aprueba |

### C13 · `handoff` — estado transportable entre sesiones

| | |
|---|---|
| **Propósito** | Que el razonamiento no se pierda cuando termina la sesión. |
| **Obligatoria** | ⭕ recomendada |
| **Evidencia** | 76 handoffs. Es lo que hace que una sesión nueva no arranque de cero. **Y su límite**: el razonamiento intermedio —qué se descartó y por qué— sobrevive solo si alguien lo escribe. |
| **Interfaz mínima** | dónde quedamos · qué falta · qué no cierra |
| **Riesgo** | **MEDIO** |
| **Human gate** | ❌ |

### C14 · `improvement` — el buzón donde el límite se vuelve trabajo

| | |
|---|---|
| **Propósito** | Que cada cosa que el sistema no pudo hacer quede registrada como trabajo pendiente. |
| **Obligatoria** | ⭕ recomendada |
| **Evidencia** | 🔴 **por ausencia en Freddy** (el ciclo `error→regla→arnés` existe pero se cierra a mano) + 🟢 **por presencia en Metallurgia**: mejora **#404**, registrando **por qué canal se pidió**. |
| **Interfaz mínima** | `registrar(limite, origen, canal)` → ticket. **El canal de origen es parte del dato** |
| **Riesgo** | **MEDIO** — sin esto los gaps se pierden en conversación |
| **Human gate** | ❌ para registrar · ✅ para priorizar |

### C15 · `kpis` — qué mide el departamento

| | |
|---|---|
| **Propósito** | Que exista una definición declarada de "va bien". |
| **Obligatoria** | ⭕ recomendada |
| **Evidencia** | Freddy los tiene (ventas, margen, CMV, posición real) pero **no declarados como interfaz**: viven dentro de la app. |
| **Interfaz mínima** | lista declarada, con su fórmula y su fuente |
| **Riesgo** | **BAJO** |
| **Human gate** | ✅ para definirlos |

---

## Capacidades PRE-DISEÑADAS — la tabla existe, vacía

🟡 Las tres ya están declaradas en `magna.db` y **nunca se cablearon**. No las promuevo a
obligatorias: **no hay evidencia de uso, solo de intención.**

| | Slot | Tabla | Qué habilitaría |
|---|---|---|---|
| C16 | `approvals` | `approval_requests` (`risk_level`, `status`, `approved_by`) | el gate humano como **dato**, no como conversación |
| C17 | `audit` | `audit_log` (`actor_type`, `before_json`, `after_json`, `reason`) | quién hizo qué, humano o agente |
| C18 | `runs` | `agent_runs` (`model`, `tokens`, `cost_estimate`) | saber qué cuesta operar y si un agente decide mal |

---

## El contrato en una frase

> **Un departamento Magna es: una fuente de verdad derivable, reglas en código, un cuerpo de
> conocimiento consultable por concepto, un catálogo de errores que alimenta candados, un
> gate humano antes de escribir, y un canal por el que entra y sale trabajo.**
>
> **Los agentes son opcionales. Freddy lo demuestra: llegó a ser el departamento más maduro
> sin un solo agente ejecutable.**

---

# B · FREDDY vs CONTRACT

| | Capacidad | Estado | Nota |
|---|---|---|---|
| C1 | `record` | 🟡 **PARTIAL** | `magna.db` es excelente, **pero `data/*.json` conviven** (R1) |
| C2 | `rules-as-code` | ✅ **ALREADY_HAVE** | de referencia |
| C3 | `knowledge` | ✅ **ALREADY_HAVE** | 21 reglas + 9 workflows |
| C4 | `recall` | ✅ **ALREADY_HAVE** | `regla.js` + `fuzzy.js` + `memoria_lookup.js` |
| C5 | `known_errors` | ✅ **ALREADY_HAVE** | 74, con prevención y estado |
| C6 | `harness` | ✅ **ALREADY_HAVE** | 13 + `_pruebas` + score como gate |
| C7 | `identity` | ✅ **ALREADY_HAVE** | canónico + alias + código + clase |
| C8 | `human_gates` | 🟡 **PARTIAL** | es ley y funciona, pero **conversacional** — `approval_requests` vacía |
| C9 | `inputs` | ❌ **MISSING** | Luka es el canal |
| C10 | `outputs/actions` | 🟡 **PARTIAL** | 5 endpoints, nada hacia afuera |
| C11 | `health` | ✅ **ALREADY_HAVE** | con huella |
| C12 | `plans` | ✅ **ALREADY_HAVE** | 42 |
| C13 | `handoff` | ✅ **ALREADY_HAVE** | 76 |
| C14 | `improvement` | 🟡 **PARTIAL** | el ciclo existe, se cierra a mano |
| C15 | `kpis` | 🟡 **PARTIAL** | existen, no declarados |
| C16–C18 | `approvals`/`audit`/`runs` | 🟡 **PRE-DISEÑADO** | tablas vacías |

**Freddy cumple 9 de 15 completo, 5 parcial, 1 faltante.** Es el benchmark del contrato
porque el contrato salió de él — pero **no lo cumple entero**, y eso es información útil.

---

# C · AUTOS ACTUAL vs CONTRACT

**Auditado read-only:** `C:\Users\lukam\MagnaOS-Familiar\magna-app` — Next.js + TypeScript +
Supabase + Vercel. Módulo Autos: 8 páginas, 2 dashboards, `costoAuto.ts`, 5 migraciones SQL.

**Contexto que no se toca:** Magna OS Familiar es la app central existente y **está en uso
real**. No se reemplaza ni se crea un Autos OS 2. Lo que sigue es solo un diagnóstico de qué
capa de inteligencia falta **encima** de lo que ya hay.

| | Capacidad | Autos | Evidencia |
|---|---|---|---|
| C1 | `record` | ✅ **ALREADY_HAVE** | Supabase: `vehiculos`, `operaciones`, `operacion_items`, `operacion_detalles`, `documento_checklist`. Migraciones versionadas (`autos-v5`, `v6`, `consignacion`, `segmento`, `costo-checklist`) |
| C2 | `rules-as-code` | ✅ **ALREADY_HAVE** | `costoAuto.ts`: costo neto = Σ ítems positivos + detalles del usado; seña/pagos **no bajan el costo**; consolidación multi-moneda por TC de la operación; **y si falta un TC sano, no inventa**. `AutosDashboard`: *"el stock se valúa SIEMPRE a precio de venta; costo solo como respaldo"* |
| C3 | `knowledge` | 🟡 **PARTIAL** | **Las reglas existen pero viven en comentarios de código**: *"Regla de Luka (definitiva)"*, *"Regla de Luka: el stock se valúa…"*. No hay corpus consultable. Los 4 `.md` del repo son `AGENTS.md` (reglas de Next.js), `CLAUDE.md` (un `@AGENTS.md`), `README.md` y `ESTADO.md` (estado del rediseño visual) |
| C4 | `recall` | ❌ **MISSING** | no hay nada equivalente a `regla.js` |
| C5 | `known_errors` | ❌ **MISSING** | no existe |
| C6 | `harness` | ❌ **MISSING** | **cero tests.** `package.json` tiene `dev`, `build`, `start`, `lint`. Nada más |
| C7 | `identity` | ✅ **ALREADY_HAVE** | `patente`, `nro_chasis`, `nro_motor`, `registro`. La unidad es única por naturaleza — **más fácil que en Freddy** |
| C8 | `human_gates` | 🟡 **PARTIAL** | el humano está en el loop **porque usa la UI**, no porque haya un gate declarado. No hay proposal mode ni `approval_requests` |
| C9 | `inputs` | 🟡 **PARTIAL** | la app (formularios) + `/autos/importar` + **MercadoLibre** (`/api/ml/import`, `/ml/refresh`, `/ml/exchange`). **Tiene más integración de entrada que Freddy** |
| C10 | `outputs/actions` | 🟡 **PARTIAL** | escribe en Supabase, publica/sincroniza con ML. Sin acciones hacia personas |
| C11 | `health` | ❌ **MISSING** | no hay endpoint de salud ni huella |
| C12 | `plans` | ❌ **MISSING** | |
| C13 | `handoff` | 🟡 **PARTIAL** | `ESTADO.md` cumple ese rol para el rediseño visual, no para la operación |
| C14 | `improvement` | ❌ **MISSING** | |
| C15 | `kpis` | ✅ **ALREADY_HAVE** | Stock total · Propio · Señados · Consignación · Vendidos · Costo del stock · Precio de venta del stock · Margen esperado · En consignación · **Ganancia realizada** |
| C16 | `approvals` | ❌ **MISSING** | |
| C17 | `audit` | ❓ **UNKNOWN** | hay `rls.sql`; **no verifiqué si Supabase tiene audit/triggers activos** |
| C18 | `runs` | 🚫 **NOT_NEEDED** (hoy) | no hay agentes corriendo. Se necesita el día que los haya |

### El hallazgo más importante de Autos

**`vehiculos.fecha_ingreso` existe.** El dato que hace falta para la alerta central del
negocio de autos —**capital inmovilizado**— ya está cargado.

Y **no se usa**: `AutosDashboard.tsx` (672 líneas) no menciona días, antigüedad ni
`fecha_ingreso` en ningún KPI. Todos los KPIs son de **stock y margen**; ninguno de **tiempo**.

> En Freddy la alerta típica es *"este costo subió 8%"*. En Autos debería ser
> *"esta unidad lleva 60 días en stock"*. **El dato está. La regla no.**

### Lo que Autos tiene y Freddy no

- **Integración de entrada real** (MercadoLibre: import, refresh, exchange). Freddy no tiene
  ninguna integración viva hacia afuera.
- **Multi-moneda de primera clase**, con la regla de no inventar el TC.
- **Identidad más simple**: la unidad es única por naturaleza.

---

# D · GAPS MÍNIMOS PARA QUE AUTOS SEA UN DEPARTAMENTO INTELIGENTE

Ordenados por rendimiento sobre esfuerzo. **Ninguno implica reemplazar la app ni crear un
Autos OS 2** — son capas encima de lo que ya funciona.

| # | Gap | Capacidad | Por qué primero |
|---|---|---|---|
| **1** | **`dias_en_stock` como KPI y como alerta** | C2 | El dato ya está (`fecha_ingreso`). Es la métrica que define el riesgo del negocio: **capital inmovilizado**. Es la más barata de todas |
| **2** | **Extraer las reglas de los comentarios a un corpus** | C3 | Las reglas de Luka ya están escritas — **dentro de `costoAuto.ts` y `AutosDashboard.tsx`**. Moverlas a Markdown versionado no requiere tocar la app |
| **3** | **Empezar `known_errors` de Autos** | C5 | Vacío hoy. Se llena operando, y es la entrada del harness |
| **4** | **Primeros arneses** | C6 | **Cero tests hoy.** Nacen de los errores del punto 3, no se copian de Freddy |
| **5** | **`health` con huella** | C11 | El bug A1 de Freddy (4 días sirviendo código viejo) es exactamente el riesgo de una app en Vercel |
| **6** | **`recall` sobre el corpus del punto 2** | C4 | El mecanismo (`regla.js`) es reutilizable tal cual; solo cambia el corpus |
| **7** | **Gates declarados para operaciones de dinero** | C8 | Hoy el gate es "el humano usa la UI". El ticket de un auto es mucho mayor que el de una compra de fiambre |

**Los puntos 1 y 2 no requieren código nuevo de negocio**: uno es una fórmula sobre un campo
que ya existe, el otro es mover texto que ya está escrito.

---

# E · LO QUE EL CÓDIGO NO PUEDE RESPONDER — para Luka

Ninguna de estas sale de leer archivos.

### Sobre el negocio de Autos

1. **¿A partir de cuántos días en stock una unidad es un problema?** 30, 60, 90 — el umbral
   es criterio comercial. Sin ese número, `dias_en_stock` es un dato, no una alerta.
2. **¿Cuál es el costo de tenencia mensual de una unidad?** (patente, seguro, espacio,
   capital inmovilizado). Sin esto no se puede calcular el punto en que conviene rematar.
3. **¿Consignación y propio se miden igual?** Un auto en consignación no inmoviliza capital
   propio. Probablemente necesiten alertas distintas y el dashboard hoy los separa, pero no
   sé si el criterio de riesgo es el mismo.
4. **¿Cuál es el KPI que define "el mes fue bueno" en Autos?** En Freddy es margen y posición
   real. Acá hay *"Ganancia realizada"* — ¿es ese, o es rotación?
5. **¿Quién más opera Autos además de vos?** Cambia si los gates son para vos o para terceros.

### Sobre el contrato

6. **¿`plans` y `handoff` deben ser obligatorios o recomendados?** Los dejé recomendados
   porque Freddy los usa para el trabajo *de construcción*, no para la operación diaria. Si
   el criterio es "todo departamento se construye con agentes", pasan a obligatorios.
7. **¿`kpis` es parte del contrato o del negocio?** Lo dejé recomendado. Se puede argumentar
   que un departamento sin KPI declarado no es un departamento.
8. **Los tres slots pre-diseñados (`approvals`, `audit`, `runs`): ¿se cablean en Freddy
   primero o se dejan dormidos?** Están vacíos desde hace meses. Cablearlos es trabajo real;
   dejarlos es deuda declarada.

### Sobre riesgos descubiertos (sección R)

9. **R1 — `data/*.json` vs `magna.db`: ¿los JSON son histórico congelado o alguien todavía
   los lee?** Es la única pregunta de esta lista que podría ser **urgente**.
10. **R2 — Los roles obsoletos: ¿se archivan o se actualizan?** Hoy contradicen al sistema
    vigente.

---

# F · HIPÓTESIS PARA UNA FASE POSTERIOR

**No entran al contrato V1.** Freddy no las justifica. Se guardan con su condición de entrada.

| Hipótesis | Origen | Por qué no entra ahora | Cuándo revisarla |
|---|---|---|---|
| **`budget`** — tope de gasto por área | Bennett (`BEN-37 $168k budget`) · Paperclip (budgets con hard-stop) | Freddy nunca lo necesitó. Ponerlo sería copiar, no derivar | **Cuando exista `runs` con `cost_estimate` cargado.** Y ojo: en **Autos** aparece antes que en ningún otro lado — capital inmovilizado por unidad **es** un presupuesto |
| **`workers`** — roles ejecutables | Bennett (37) · Metallurgia (4 en paralelo) | Freddy llegó al nivel actual **sin un solo agente real**. Hacerlo obligatorio contradice la evidencia | Cuando una tarea concreta no se pueda hacer sin autonomía |
| **`conductor`** — orquestador único | Bennett (Conductor CEO) · Paperclip | Hoy el conductor es Luka + Claude en sesión, y funciona | Cuando haya ≥3 departamentos con trabajo simultáneo |
| **`board`** — tablero vivo | Bennett (COMPANY BOARD LIVE) | Sin workers no hay nada que mostrar | Junto con `workers` |
| **`routing` de eventos** | Metallurgia (n8n) · Bennett (Hermes) | Freddy tiene ruteo **de conocimiento**, que es lo que le sirvió. El de eventos no hace falta sin canales | Junto con `inputs` |
| **`heartbeat`/scheduler** | Paperclip (*"runs on a schedule without anyone prompting"*) | Verificado: Freddy no tiene ninguno | **Es la hipótesis más cercana a entrar.** El día que exista trabajo nocturno que valga la pena |
| **`memoria episódica privada por persona`** | Metallurgia | Freddy tiene un solo operador | **Relevante para La Gene**: Guille no debería ver la memoria de sus empleados |
| **`consolidación nocturna de memoria`** | Metallurgia | Requiere scheduler | Junto con `heartbeat` |
| **Paperclip como orquestador** | OSS, MIT, 79,3k ★, Node 24 + PostgreSQL | Resuelve lo que a Freddy le falta (org chart, presupuesto, heartbeat, cola de aprobaciones) y **nada de lo que Freddy ya tiene bien** | **Investigar en sandbox** cuando haya ≥2 departamentos. **No adoptar ahora** |

---

# R · RIESGOS DESCUBIERTOS EN FREDDY — registrados, NO corregidos

> Se registran acá como pide el encargo. **No se tocó ninguno.**

### R1 · Doble source of truth: `data/*.json` vs `magna.db`

`data/` conserva `compras.json`, `gastos.json`, `dias.json`, `precios_vigentes.json`,
`compras_items.json`, `capital.json`, `pagos.json` **conviviendo con la base**.

- **No verifiqué cuál gana en cada camino de lectura.**
- **Riesgo:** si algún código lee el JSON viejo, hay dos verdades y la app puede mostrar una
  y la base tener otra — que es **exactamente el bug del que nació el arnés A2**.
- **Severidad: ALTA.** Es la única de esta lista que podría estar activa hoy.
- **Candidato a arnés**, no a limpieza a mano.

### R2 · Roles en Markdown obsoletos

`agents/audit_agent.md` y `agents/dashboard_agent.md` hablan de *"nunca escribe en Excel"* y
del **Maestro** — un sistema que dejó de usarse al migrar a `magna.db`.

- **Riesgo:** un agente que los lea como vigentes actúa sobre un sistema que ya no existe.
- Contradicen a la memoria canónica, que **manda** según `CLAUDE.md`.
- **Severidad: MEDIA.**

### R3 · 12 tablas diseñadas y no activas

`agent_jobs`, `agent_runs`, `agent_tool_calls`, `approval_requests`, `audit_log`,
`closure_runs`, `closure_validation_results`, `validation_runs`, `snapshots`,
`movimientos_banco`, `conciliaciones_banco`, `product_match_queue` — **todas en cero**.

- **Riesgo:** un lector nuevo (persona o agente) no puede distinguir *"esto no se usa
  todavía"* de *"esto está roto"*. Una promesa no cumplida dentro de la fuente de verdad.
- **Severidad: MEDIA.** Y es **deuda con valor**: la mitad del contrato ya está diseñada ahí.

### R4 · `agents/` declarados vs agentes ejecutables

7 carpetas, 9 archivos Markdown, **0 procesos**.

- **Riesgo:** el nombre de la carpeta le dice a cualquiera —incluido Claude en una sesión
  futura— que hay más autonomía de la que hay. Sobreestima el sistema en un orden de magnitud.
- **Severidad: MEDIA**, y es la que más afecta a las decisiones de arquitectura: si creemos
  que ya tenemos 7 agentes, la conclusión sobre qué construir después cambia por completo.

---

## FUENTES

**Auditado read-only en esta sesión:** `C:\Users\lukam\MagnaOS-Familiar\magna-app`
(Next.js + TypeScript + Supabase · 8 páginas de Autos · 2 dashboards · `costoAuto.ts` ·
5 migraciones de Autos · 68 archivos SQL · 5 endpoints de API · **0 tests**)

**Evidencia previa:** `MAGNA-ORG-001-FREDDY-PATTERN.md` · `REFERENCE-ORG-001.md` ·
`LAB-DEEP-UNDERSTANDING-001.md`

**No se implementó nada. No se instaló Paperclip. No se crearon agentes. No se modificó
Freddy OS ni Magna OS Familiar.**
