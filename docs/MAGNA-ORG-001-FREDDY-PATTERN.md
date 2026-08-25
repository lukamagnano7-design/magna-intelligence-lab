# MAGNA-ORG-001 · El patrón organizacional de Freddy OS

> Auditoría **READ ONLY** del Freddy OS real, para extraer un patrón reutilizable antes de
> diseñar ningún departamento nuevo.
>
> **Nada fue modificado. Nada fue instalado. Nada fue optimizado.**

**Fecha:** 25/08/2026 · **Auditado:** `C:\dev\magna-pyme-os` + `freddy-agent-os/`
**Evidencia previa:** `REFERENCE-ORG-001.md`

---

## EL HALLAZGO PRINCIPAL

Antes de las 14 capas, tres cosas que cambian cómo hay que leer todo lo demás:

### 1 · Los "agentes" de Freddy no son agentes

`freddy-agent-os/agents/` tiene **7 carpetas y 9 archivos**. Los 9 son **Markdown**. Entre
1,8 KB y 3,9 KB. **Ninguno es código ejecutable.** No hay proceso, ni runtime, ni loop.

```
agents/jarvis/          jarvis.md · JARVIS_ORCHESTRATOR_PROTOCOL.md · jarvis_system_prompt.md
agents/cierre_agent/    cierre_agent.md
agents/pricing_agent/   pricing_agent.md
agents/audit_agent/     audit_agent.md
agents/dashboard_agent/ dashboard_agent.md
agents/memory_agent/    memory_agent.md
agents/red_team_agent/  red_team_agent.md
```

Son **definiciones de rol** que Claude lee en sesión. El trabajo lo hace Claude leyendo
reglas y ejecutando scripts. **Llamarlos agentes sobreestima la autonomía del sistema por
un orden de magnitud.**

Y varios están **desactualizados**: `audit_agent.md` y `dashboard_agent.md` hablan de *"nunca
escribe en Excel"* y del *"Maestro"* — un sistema que dejó de usarse cuando se migró a
`magna.db`.

### 2 · El contrato de departamento ya está escrito en el schema, y está vacío

`magna.db` tiene **36 tablas. 12 están en cero** — y no son cualquier doce:

| Tabla | Qué declara | Filas |
|---|---|---|
| `agent_jobs` | `type · status · **risk_level**(low/medium/high/critical) · **approval_required**` | **0** |
| `agent_runs` | `agent_name · model · input_tokens · output_tokens · **cost_estimate**` | **0** |
| `agent_tool_calls` | `run_id · tool_name · input_json · output_json · status` | **0** |
| `approval_requests` | `action · proposed_json · risk_level · status(pendiente/aprobada/rechazada) · **approved_by**` | **0** |
| `audit_log` | `**actor_type** · actor_name · before_json · after_json · reason · source` | **0** |
| `closure_runs` | `status: draft→validating→**ready_for_approval**→approved→written` | **0** |
| `validation_runs` · `snapshots` · `movimientos_banco` · `conciliaciones_banco` · `product_match_queue` | | **0** |

**Alguien ya diseñó la organización de agentes.** Niveles de riesgo, aprobación requerida,
costo por corrida, quién aprobó, actor humano vs agente, máquina de estados con gate de
aprobación. Está todo declarado y **nunca se cableó**.

Luka pidió *"no asumir que la lista del contrato es correcta, derivarla de la evidencia"*.
**Buena parte de la evidencia está en su propio schema.**

### 3 · El patrón que explica todo lo demás

Dos citas de Luka, encontradas dentro del código:

> **KE#70, en `regla.js`:** *"que busques mejor no depende de una regla, tendríamos que
> hacerlo regla."* — y el comentario del archivo remata: **"buscar mejor es un deseo, no un
> procedimiento. Esto lo vuelve un comando."**

> **11/08, en `cerrar_sesion.js`:** *"el server se tendría que actualizar solo cada sesión que
> termina."* — y el comentario: **"si el que lo tiene que reiniciar es el agente, algún día se
> olvida. Esto lo hace SIEMPRE."**

# EL PATRÓN DE FREDDY

> **Una regla que depende de que el agente se acuerde no es una regla: es un deseo.
> Freddy maduró convirtiendo deseos en comandos.**

Cada vez que el sistema falló porque *"el agente tendría que haber…"*, la respuesta **no fue
escribir una regla mejor**: fue mover esa regla al código, donde se ejecuta siempre.

Los 13 arneses, `regla.js`, `memoria_lookup.js`, `fuzzy.js`, `proveedor_recall.js`,
`cerrar_sesion.js` y los 74 errores conocidos **son todos instancias del mismo movimiento.**

---

## LAS 14 CAPAS

### 1 · SYSTEM OF RECORD

**Fuente de verdad: `magna.db`** (SQLite local). 36 tablas, 24 con datos.

| Dominio | Tablas | Volumen |
|---|---|---|
| Operación diaria | `dias` · `dia_movimientos` | 84 · 13 |
| Compras | `compras` · `compras_items` · `compras_historico` | 226 · 737 · 384 |
| Catálogo | `productos` · `product_aliases` · `costos_y_precios` · `precios_vigentes` | 529 · 13 · 353 · 372 |
| Proveedores | `supplier_identities` · `supplier_aliases` · `supplier_product_codes` · `raw_suppliers` | 56 · 30 · 114 · 50 |
| Stock | `inventario` | 546 |
| Dinero | `gastos` · `pagos` · `capital` · `capital_cuotas` · `costos_fijos` | 29 · 31 · 1 · 3 · 38 |
| Ciclo | `periodos` · `meta` · `schema_migrations` | 3 · 4 · 1 |
| Alertas | `cost_alerts` | 96 |

**Derivadas versionadas:** `magna.dump.sql` (reconstrucción fiel, en git) + `_backups_db/`
rotados + ~30 carpetas `_backups_pre_*` nominadas por evento.

**Lo que hace fuerte a esta capa:** la base es *derivable* — `create_schema.js` + `seed/` la
reconstruyen. Y el arnés **M4** verifica que el plano declarado coincida con la tabla real.

> `data/` todavía tiene los JSON viejos (`compras.json`, `gastos.json`…). Conviven con la
> base. No verifiqué cuál gana en cada lectura; **es una ambigüedad de fuente de verdad**.

### 2 · KNOWLEDGE

**21 reglas · 9 workflows · 74 errores conocidos · 76 handoffs · 153 logs.**

```
memory/rules/         21 .md   pricing_blanco_negro · cierre_diario · caja_banco_tesoreria
                               proveedores_canonicos · inventario_stock · recuento_stock_unidades
                               banco_getnet_sircreb · circuito_lagene · acuerdo_lagene
                               operacion_lab_vs_cliente · busqueda_tolerante · graphify_recall …
memory/workflows/      9 .md   cierre_diario_rapido · circuito_cierre_dos_fases
                               product_pricing_integrity · validation_checklist · sdd_lite_freddy …
memory/known_errors.md 74      sintoma / causa / solucion / prevencion / estado
memory/glossary.md             vocabulario del negocio
project/               4 .md   decision_log · project_brief · project_state · roadmap
specs/active/          5       SPEC_JULIO_SQLITE · SPEC_RESOLVER_CODIGO_PROVEEDOR …
templates/             3       execution_contract · proposal · verify_report
```

**Formato de `known_errors`, y es lo que lo hace útil:** cada entrada trae **síntoma / causa
/ solución / prevención / estado**. No es una bitácora — es un catálogo de prevenciones con
estado de vigencia.

### 3 · DETERMINISTIC SOFTWARE

**51 scripts `.js`.** Los que sostienen el negocio:

| Script | Qué calcula, sin IA |
|---|---|
| `carga.js` | computa y escribe el día · concilia caja · deuda por proveedor normalizada |
| `cierre.js` | cierre de período |
| `precios.js` | markup por rubro · blanco ÷1,21 · cash ÷1,21 ×2 ÷0,955 ×1,21 |
| `motor_alertas.js` · `alertas.js` | variación vs **última compra comparable, mismo régimen y código** |
| `costo_vigente.js` · `naturaleza_producto.js` | costo vigente · qué entra al stock y con qué unidad |
| `inventario.js` · `arqueo_caja.js` | valuación de recuento · arqueo |
| `resolve_supplier.js` · `fuzzy.js` | identidad de proveedor por SKU en capas · búsqueda tolerante |
| `motor_simulador.js` · `metricas_gate.js` | simulación · gate de métricas incompletas |
| `validate_db.js` | validación integral de la base |
| `dump_db.js` · `backup_db.js` | dump versionable · backup |
| `build_app.js` | regenera la app desde la base |

**Las fórmulas del negocio están en código, no en prompt.** Ese es el motivo por el que dos
sesiones distintas dan el mismo número.

### 4 · AUTOMATIONS

**Casi ninguna. Es el hallazgo más incómodo de esta auditoría.**

- **No hay scheduler.** Verificado: sin `node-cron`, sin `setInterval`, sin `schtasks`, sin
  tarea de Windows. `package.json` tiene 4 scripts, ninguno agendado.
- **Todo arranca con un humano.** `Reiniciar Magna.bat` — doble clic.
- **Lo más cercano a una automatización es `cerrar_sesion.js`**: backup → dump → rebuild →
  reiniciar server → verificar huella → correr arneses → score. **Encadena 6 pasos que antes
  se olvidaban.** Pero lo dispara una persona.
- El backup automático se enganchó a `carga.js` — o sea, **se dispara cuando un humano carga**.

> **Freddy no tiene procesos que corran solos. Tiene procesos que, cuando alguien los
> dispara, no se saltean ningún paso.** No es lo mismo, y la diferencia es exactamente lo
> que separa "departamento" de "herramienta".

### 5 · AI / AGENTS — con el rigor que pediste

| Qué es | Cuántos | Qué es **realmente** |
|---|---|---|
| **Agente real** (proceso autónomo con loop y herramientas) | **0** | no existe ninguno |
| **Prompt / rol en Markdown** | **9** | `jarvis`, `cierre_agent`, `pricing_agent`, `audit_agent`, `dashboard_agent`, `memory_agent`, `red_team_agent` |
| **Skills** (procedimiento invocable) | **7** | `cierre_diario_rapido`, `get_kpis`, `memory_update`, `product_pricing_integrity`, `red_team_review`, `external_repo_research` |
| **Workflows** (secuencia documentada) | **9** | `.md` en `memory/workflows/` |
| **Scripts** (código ejecutable) | **51** | los de arriba |
| **Planes de ejecución** (artefacto por día/alta) | **42** | `planes/dia_*.js`, `planes/alta_*.json` |
| **Uso real de IA en runtime** | **1** | `ocr.js` + `backtest_ocr.js` — **validado y en pausa por decisión de negocio** |

**La única IA que corre dentro de Freddy OS es el OCR de facturas, y está parkeada.**
Todo el resto del "razonamiento" lo aporta **Claude en sesión**, leyendo estos archivos.

**Esto no es una crítica: es la explicación de por qué funciona.** El conocimiento está en
reglas y código; el modelo es intercambiable.

### 6 · TOOLS

Lo que un agente/Claude puede realmente ejecutar hoy:

| Herramienta | Tipo | Escribe |
|---|---|---|
| `node regla.js "<concepto>"` | consulta de conocimiento | no |
| `node memoria_lookup.js` / `proveedor_recall.js` / `producto_recall.js` | recall | no |
| `node salud.js` | estado del sistema | no |
| `node arneses.js` | los 13 arneses + score | no |
| `node validate_db.js` | validación integral | no |
| `node carga.js` / `cierre.js` / `alta.js` / `itemizar.js` | operación | **sí** |
| `node backup_db.js` / `dump_db.js` | protección | sí (a backup) |
| `node cerrar_sesion.js` | cierre de sesión completo | sí |
| `GET /api/data` · `/api/health` · `/api/validate` | lectura HTTP | no |
| `POST /api/config` · `/api/inventario` | escritura HTTP | **sí** |

**Solo 5 endpoints HTTP, de los cuales 2 escriben.** La superficie de acción del sistema es
muy chica — y eso, hoy, es una virtud de seguridad y una limitación de autonomía a la vez.

### 7 · ROUTING

**Acá está lo mejor de Freddy, y es lo que menos se parece a los Reels.**

No hay un router de eventos (no hay n8n, no hay Hermes). Lo que hay es **ruteo del
conocimiento hacia el código**:

```
pregunta / nombre / concepto
        ↓
regla.js            → busca por CONCEPTO en toda la memoria, con sinónimos del dominio,
                      sin acentos ni plurales, puntuando por cercanía. Devuelve
                      ARCHIVO + LÍNEA + PÁRRAFO, para poder citar la fuente.
        ↓
memoria_lookup.js   → busca en la memoria canónica (no solo en la base)
proveedor_recall.js → busca en compras + supplier_identities
fuzzy.js            → tolerante a la escritura: "GONZALES"≈"GONZALEZ", "REGIANITO"≈"REGGIANITO"
        ↓
resolve_supplier.js → identidad por código de proveedor, en capas, con 2 guardas
```

**Cada uno de estos nació de un fallo concreto y está fechado en su propio encabezado.**
`memoria_lookup.js` existe porque el 18/08 el sistema dijo *"ALEJANDRO BEBIDAS → NUEVO"*
cuando estaba escrito en `proveedores_canonicos.md` **línea 121**.

### 8 · MEMORY

| Dónde vive | Qué guarda | Persiste | Estado |
|---|---|---|---|
| `freddy-agent-os/memory/` | reglas, errores, glosario, workflows | ✅ git | **canónica** |
| `magna.db` | hechos del negocio | ✅ + dump | **canónica** |
| `logs/HANDOFF_*` (76) | estado entre sesiones | ✅ | funciona |
| `project/decision_log.md` | por qué se decidió | ✅ | funciona |
| Graphify | grafo de la memoria (125 nodos) | ✅ | consultable |
| **auto-memory de Claude** | ~70 archivos de contexto | ⚠️ | **apoyo, NO canónica** |
| **sesión de Claude** | razonamiento del día | ❌ | **se pierde** |

**Lo que sigue atrapado en la sesión:** el razonamiento intermedio — por qué se descartó una
alternativa, qué se probó y falló, el criterio aplicado a un caso raro. Sobrevive solo si
alguien lo escribe en un handoff.

`ENGRAM_LITE_PROTOCOL.md` describe el mecanismo de promoción de auto-memory a canónica.
**Es manual.**

### 9 · VALIDATION / HARNESS

**Los 13 arneses son el activo más maduro de Freddy, y no tienen equivalente en ninguno de
los tres Reels.**

> *"Un arnés es una pregunta de sí o no que el sistema se hace solo, todos los días, sobre un
> error que ya pasó de verdad."* — `arneses/README.md`

| | Qué garantiza | De qué bug nació |
|---|---|---|
| **A1** | El server sirve el código del disco | 4 días sirviendo código viejo |
| **A2** | Los números de la app coinciden con la base | la app decía 508 productos con 484 en la base |
| **A3** | Ninguna métrica sobre datos incompletos | margen de seguridad 99% con 17 de 19 categorías en cero |
| **A4** | El respaldo del día sirve de verdad | una semana de backups vacíos, creados sin errores |
| **B1** | Ninguna etiqueta con fecha escrita a mano | |
| **B2** | La pantalla retirada no vuelve y el motor sigue entero | |
| **M1** | Ningún estado que los consumidores no entiendan | `status='fusionado'` con filtros que preguntan `!='inactivo'` |
| **M2** | El estado llega a todas las capas | "PARA MANDAR AHORA" con las 35 alertas ya mandadas |
| **M3** | Qué entra al stock y con qué cantidades | dispenser de huevos: cantidad 0,4 valuado en $34.560 |
| **M4** | El esquema documentado coincide con el real | se creía que faltaba un CHECK; faltaba una tabla entera |
| **M5** | Calendario correcto en las tres pantallas | |
| **M6** | Buscar no depende de cómo esté escrito | |
| **M7** | Lo comprado este mes está itemizado y con costo al día | |

**Y hay un arnés de los arneses:** `arneses/_pruebas.js` verifica que los arneses **sepan
fallar**. Un candado que no puede fallar no es un candado.

**El score es el gate de entrega.** Si bajó respecto de la corrida anterior, no se entrega.
*"La autoevaluación del agente es leer ese número, no opinar."*

Además: `validate_db.js` (92 checks) · `metricas_gate.js` · `_salvedades.json` (excepciones
declaradas, no silenciosas).

### 10 · HUMAN-IN-THE-LOOP

Luka sigue haciendo, y **por qué**:

| Qué | Por qué sigue siendo humano |
|---|---|
| **Dictar el parte diario** | No hay canal de entrada. La información existe solo en su cabeza y en papeles |
| **Aprobar toda escritura en fuente de verdad** | Preflight + backup + OK. Es ley (`AGENTS.md`) |
| **Valorar precios al público** | Un descuento puntual no baja el precio; eso es criterio comercial |
| **Clasificar movimientos ambiguos** | Transferencia sin match POS: 5 clasificaciones posibles, ninguna inferible |
| **Decidir alta de proveedor/producto** | Un alta mal hecha contamina el catálogo y el motor de alertas |
| **Disparar el cierre** | No hay scheduler |
| **Leer el resultado** | No hay canal de salida |

**Los cuatro primeros son gates correctos** — dinero y criterio de negocio.
**Los tres últimos son ausencia de infraestructura, no decisiones de diseño.**

### 11 · INPUTS

| Cómo entra | Mecanismo | Automático |
|---|---|---|
| Parte diario de Luka | dictado en sesión de Claude | ❌ |
| Extracto bancario | `import_extracto.ps1` / `parse_extracto_v2.ps1` | parcial |
| Facturas y remitos | `data/facturas/` + `ocr.js` (en pausa) | ❌ |
| Ticketeadora / POS | `facturadores/overpos` — journal del controlador fiscal EPSON | parcial |
| Recuento de stock | pantalla en la app (localStorage + confirmar) | ✅ in-app |
| Costos fijos | `POST /api/config` | ✅ in-app |

**No hay canal conversacional.** No hay WhatsApp, ni mail, ni webhook. **Es el gap #1.**

### 12 · OUTPUTS / ACTIONS

**Produce:**
dashboard/app en `localhost:4600` · KPIs y estado de resultado · alertas de costo (96 en la
tabla) · texto de WhatsApp para avisos de precio (**generado, copiado a mano**) · reportes
PDF mensuales · `magna.dump.sql` versionado · score de arneses.

**Puede ejecutar realmente:**
escribir el día · escribir costos fijos · escribir snapshot de inventario · dar de alta
producto/proveedor (vía script, con plan) · itemizar compras · backup/dump.

**No puede ejecutar:** mandar un mensaje · mover plata · pedirle algo a un proveedor ·
consultar el banco · nada hacia afuera. **El System of Action es Luka.**

### 13 · OBSERVABILITY

| Instrumento | Qué muestra |
|---|---|
| `node arneses.js` | 13/13 + score, con el delta vs la corrida anterior |
| `node salud.js` | día cargado, snapshot, período, pendientes de mapeo |
| `/api/health` | pid, arranque y **huella del código servido** (nació de A1) |
| `/api/validate` | 92 checks |
| `arneses/_ultimo.json` | score anterior, para comparar |
| `_salvedades.json` | excepciones **declaradas** |
| `logs/dryruns/` · `logs/contracts/` | qué se planeó y qué se ejecutó |

**Lo que NO se observa:** nada sobre agentes — `agent_runs`, `agent_tool_calls` y `audit_log`
están vacías. No hay costo por corrida, ni tiempo, ni tasa de error por tarea. **No se puede
saber si un agente está tomando decisiones incorrectas, porque no queda registro de que haya
tomado ninguna.**

### 14 · CONTINUOUS IMPROVEMENT

**Es real y funciona:**

```
un error ocurre
   → se documenta en known_errors.md (síntoma/causa/solución/prevención/estado)   [74]
   → si es estructural, se convierte en REGLA en memory/rules/                    [21]
   → si puede volver sin que nadie lo note, se convierte en ARNÉS                 [13]
   → si cambia el rumbo, entra en decision_log.md
   → el handoff de la sesión lo transporta                                        [76]
```

**Lo que falta:** un **buzón de mejora**. Los gaps aparecen en conversación con Luka y a
veces se pierden. No hay tabla, ni cola, ni ticket. Cerrar el círculo es manual.

---

## CLASIFICACIÓN

`D` determinista · `A` automatización · `I` integración · `AI` agente/razonamiento · `S` supervisor · `H` humano
`L0` automático · `L1` automático + excepción · `L2` requiere aprobación · `L3` decisión humana

| Función | Clase | Nivel | Nota |
|---|---|---|---|
| Cálculo de saldo de caja | **D** | L0 | fórmula en `carga.js` |
| Cálculo de precio (markup por rubro) | **D** | L0→**L2** | calcula solo; **el precio público lo aprueba Luka** |
| Detección de variación de costo | **D** | L1 | motor determinista; la excepción sube a alerta |
| Conciliación de caja | **D** | L1 | descalce frena el cierre |
| Conciliación de banco | **D** | L1 | informativa, **no bloquea** (27/7) |
| Valuación de inventario | **D** | L0 | |
| Resolución de identidad de proveedor | **D** | L1 | 2 guardas + human-in-the-loop |
| Búsqueda tolerante | **D** | L0 | `fuzzy.js` |
| Búsqueda de reglas por concepto | **D** | L0 | `regla.js` |
| Validación de base (92 checks) | **S** | L0 | |
| Los 13 arneses + score | **S** | L0 | **gate de entrega** |
| Prueba de que los arneses fallan | **S** | L0 | `_pruebas.js` |
| Backup + dump | **A** | L0 | enganchado a `carga.js` |
| Cierre de sesión (6 pasos) | **A** | L0 | **lo dispara un humano** |
| Regenerar la app desde la base | **A** | L0 | dentro de `cerrar_sesion` |
| Import de extracto bancario | **I** | L2 | semi-manual |
| Lectura del journal del POS | **I** | L2 | parseado, no en vivo |
| OCR de facturas | **AI** | L2 | validado, **en pausa** |
| Itemización de compras | **AI** | L2 | Claude + `itemizar.js` |
| Clasificación compra vs gasto | **D** | L1 | **lee** `clase_contraparte`, no infiere |
| Redacción de alertas de WhatsApp | **AI** | **L3** | genera texto; **Luka copia y manda** |
| Análisis de decisiones (MEG) | **AI** | L2 | |
| Alta de proveedor/producto | **AI** | **L2** | protocolo de 5 pasos |
| Escritura en fuente de verdad | **H** | **L2** | Preflight + backup + OK |
| Dictar el parte diario | **H** | **L3** | no hay canal |
| Valorar precio al público | **H** | **L3** | criterio comercial |
| Clasificar movimiento ambiguo | **H** | **L3** | 5 opciones, ninguna inferible |
| Decidir corte de mes | **H** | **L3** | |

**Distribución:** D 10 · S 3 · A 3 · I 2 · AI 6 · H 5.
**Por nivel:** L0 12 · L1 5 · L2 8 · L3 5.

> **La mitad del sistema es software determinista corriendo en L0.** Eso es lo correcto y hay
> que decirlo fuerte: **Freddy no es maduro por tener IA. Es maduro por tener poca IA en los
> lugares correctos.**

---

## A · ARQUITECTURA ACTUAL REAL

```
┌─ INPUTS ──────────────────────────────────────────────────────────┐
│  parte dictado por Luka ·  extracto (.ps1) ·  facturas (papel)    │
│  journal del POS ·  recuento in-app                               │
│  ❌ SIN CANAL CONVERSACIONAL                                      │
└────────────────────────┬──────────────────────────────────────────┘
                         ▼
┌─ RAZONAMIENTO ────────────────────────────────────────────────────┐
│  CLAUDE EN SESIÓN  (no hay agentes corriendo)                     │
│  lee: 9 roles .md · 21 reglas · 9 workflows · 74 known_errors     │
│  rutea con: regla.js · memoria_lookup.js · fuzzy.js · recalls     │
└────────────────────────┬──────────────────────────────────────────┘
                         ▼
┌─ DETERMINISTA ────────────────────────────────────────────────────┐
│  51 scripts: carga · cierre · precios · motor_alertas · inventario│
│  costo_vigente · resolve_supplier · validate_db · build_app       │
└────────────────────────┬──────────────────────────────────────────┘
                         ▼
┌─ SYSTEM OF RECORD ────────────────────────────────────────────────┐
│  magna.db  36 tablas (24 con datos · 12 vacías = scaffolding      │
│  de agentes nunca cableado) + dump versionado + backups rotados   │
└────────────────────────┬──────────────────────────────────────────┘
                         ▼
┌─ SUPERVISIÓN ─────────────────────────────────────────────────────┐
│  13 arneses (score = gate) · _pruebas.js · validate_db (92)       │
│  salud.js · huella del server · _salvedades.json                  │
└────────────────────────┬──────────────────────────────────────────┘
                         ▼
┌─ HUMAN GATE ──────────────────────────────────────────────────────┐
│  Preflight + backup + OK explícito de Luka                        │
└────────────────────────┬──────────────────────────────────────────┘
                         ▼
┌─ OUTPUTS ─────────────────────────────────────────────────────────┐
│  app localhost:4600 · KPIs · alertas · texto de WhatsApp          │
│  reportes PDF · score                                             │
│  ❌ SIN ACCIÓN HACIA AFUERA — el System of Action es Luka         │
└───────────────────────────────────────────────────────────────────┘

    APRENDIZAJE (transversal):
    error → known_errors(74) → regla(21) → arnés(13) → handoff(76)
```

---

## B · QUÉ EXPLICA QUE FREDDY SEA EL MÁS MADURO

En orden de peso:

1. **El patrón deseo→comando.** Cada fallo por "el agente tendría que haberse acordado"
   terminó en código que se ejecuta siempre. Ese movimiento, repetido ~74 veces, es la
   madurez.
2. **Los arneses, y el score como gate de entrega.** *"La autoevaluación del agente es leer
   ese número, no opinar."* Es la única defensa real contra un agente que se declara exitoso.
3. **Y el arnés de los arneses.** `_pruebas.js` verifica que sepan fallar. Nadie más en el
   corpus estudiado hace esto.
4. **El conocimiento está fuera del modelo.** 21 reglas + 74 errores en Markdown versionado.
   El modelo es intercambiable; la inteligencia no se va con la sesión.
5. **Las fórmulas están en código, no en prompt.** Por eso dos sesiones dan el mismo número.
6. **Los errores conocidos tienen prevención, no solo descripción.**
7. **Preflight + backup + OK como ley, no como costumbre.**
8. **El plan es un artefacto.** 42 planes versionados: se puede auditar qué se pensó hacer
   contra qué se hizo.
9. **Poca IA, bien puesta.** 12 funciones en L0 determinista. La IA está donde hace falta
   juicio, no donde hace falta cálculo.

---

## C · QUÉ ES ESPECÍFICO DE UNA FIAMBRERÍA — NO GENERALIZAR

| Específico | Por qué no se traslada |
|---|---|
| **Blanco/negro y las fórmulas ÷1,21 ×2 ÷0,955** | Régimen fiscal de una PyME argentina de reventa. Autos y Real Estate tienen otro |
| **Markup por rubro (fiambrería 90,6% · almacén 51,3%)** | Números de este negocio |
| **Granel / fracción / packs / unidades** | Naturaleza del producto perecedero |
| **Cierre DIARIO** | Tiene sentido con 65-70 clientes/día. Autos vende unidades por mes |
| **Ticket promedio y clientes/día como KPI** | Retail. Real Estate mide operaciones y plazos |
| **Alertas de costo por compra** | Alta frecuencia de compra. Un auto no tiene "última compra comparable" |
| **IIBB, SIRCREB, facturadoras interpuestas** | Contexto fiscal muy local |
| **Conciliación de caja física al peso** | Negocio con efectivo. Autos casi no lo tiene |
| **Reglas de proveedor específicas** (Karina, Cristian, La Gene) | Identidades reales |

**Regla de corte:** si la regla nombra un producto, un proveedor, un impuesto o un rubro
concreto → **específica**. Si nombra un *mecanismo* → **reutilizable**.

---

## D · PATRONES REUTILIZABLES

| # | Patrón | Evidencia en Freddy | Sirve a cualquier departamento |
|---|---|---|---|
| 1 | **Deseo → comando** | `regla.js`, `cerrar_sesion.js` | ✅ el más importante |
| 2 | **Arnés = pregunta sí/no sobre un bug que ya pasó** | 13 arneses | ✅ |
| 3 | **Score como gate de entrega** | `arneses.js` | ✅ |
| 4 | **Probar que los candados sepan fallar** | `_pruebas.js` | ✅ |
| 5 | **known_errors con prevención y estado** | 74 entradas | ✅ |
| 6 | **Conocimiento en Markdown versionado, fuera del modelo** | `memory/rules/` | ✅ |
| 7 | **Búsqueda por concepto antes de afirmar** | `regla.js`, KE#70 | ✅ |
| 8 | **Búsqueda tolerante a la escritura** | `fuzzy.js`, KE#73 | ✅ |
| 9 | **Identidad canónica + alias + código externo** | `supplier_identities` | ✅ contrapartes de cualquier negocio |
| 10 | **Preflight + backup + OK antes de escribir** | ley del proyecto | ✅ |
| 11 | **Proposal mode: leer todo, no escribir nada** | `intake/core.js` | ✅ |
| 12 | **Si no sabe, pregunta — nunca adivina** | `intake/core.js` | ✅ con dinero, innegociable |
| 13 | **Separación canal/lógica** | `core.js` no sabe que existe la consola | ✅ habilita WhatsApp sin reescribir |
| 14 | **Plan como artefacto versionado** | 42 planes | ✅ |
| 15 | **Handoff entre sesiones** | 76 handoffs | ✅ |
| 16 | **Base derivable + dump versionado** | `create_schema` + `seed/` + dump | ✅ |
| 17 | **Excepciones declaradas, no silenciosas** | `_salvedades.json` | ✅ |
| 18 | **El plano debe coincidir con la tabla real** | arnés M4 | ✅ |
| 19 | **Cobertura ≠ captura** | Lab, `CAPTURA != COBERTURA` | ✅ |
| 20 | **Gate informativo vs bloqueante, decidido a propósito** | banco informa, caja bloquea | ✅ |

---

## E · QUÉ LE FALTA PARA SER SEMI-AUTÓNOMO

| # | Falta | Evidencia | Impacto |
|---|---|---|---|
| 1 | **Canal de entrada** | no hay WhatsApp/mail/webhook | Luka **es** el input |
| 2 | **Scheduler** | verificado: no existe | nada corre de noche |
| 3 | **System of Action** | 5 endpoints, 2 escriben, nada sale afuera | no puede actuar |
| 4 | **Observabilidad de agentes** | `agent_runs`/`audit_log` vacías | no se sabe si decide mal |
| 5 | **Buzón de mejora** | no hay tabla ni cola | los gaps se pierden |
| 6 | **Promoción automática de memoria** | `ENGRAM_LITE` es manual | el razonamiento se queda en la sesión |
| 7 | **Cola de aprobaciones** | `approval_requests` vacía | el gate es conversacional, no un artefacto |
| 8 | **Presupuesto / costo por tarea** | `cost_estimate` vacío | no se sabe qué cuesta operar |
| 9 | **Roles con alcance acotado ejecutables** | los 9 roles son prosa | hay que re-explicar cada sesión |
| 10 | **Limpieza de roles obsoletos** | `audit_agent.md` habla del Maestro/Excel | conocimiento que contradice al vigente |
| 11 | **Fuente de verdad única** | `data/*.json` conviven con `magna.db` | ambigüedad |

**Los ítems 4, 7 y 8 ya tienen tabla en el schema.** Falta cablearlos, no diseñarlos.

---

## F · COMPARACIÓN CONCEPTUAL

Contra la evidencia de `REFERENCE-ORG-001`:

| Capa | **Paperclip** (OSS) | **Bennett** | **Metallurgia** | **FREDDY OS** |
|---|---|---|---|---|
| Orquestador | control plane con org chart | Conductor CEO (fable-5) | cerebro multi-modelo | **Claude en sesión + Luka** |
| Workers | "bring your own agents" | 37, department heads | 4 en paralelo | **0 reales** (9 roles .md) |
| Board | tickets | COMPANY BOARD LIVE | cola de producción | ❌ |
| Canales | adapters | Gmail/WhatsApp/Slack/Tailscale | Slack/WhatsApp/Asana | ❌ **el canal es Luka** |
| Routing | heartbeats | Hermes Gateway | n8n | **de conocimiento, no de eventos** ⭐ |
| Memoria | tickets con historia | G-BRAIN + Obsidian | 3 memorias + consolidación | **21 reglas + 74 KE + Graphify** ⭐ |
| Tools | adapters | Stripe/Attio/Notion | conectores | 51 scripts, 5 endpoints |
| Presupuesto | **budgets con hard-stop** | `$168k` por depto | ❌ | ❌ (tabla vacía) |
| Human gates | approval gates | confirmar cargos Stripe | "confirmame que llegó" | **Preflight+backup+OK** ⭐ |
| Observabilidad | costo por agente | canal LIVE/DOWN | panel de OT | **13 arneses + score** ⭐ |
| Validación | — | — | testers + juez | **arneses + _pruebas + 92 checks** ⭐⭐ |
| Mejora continua | tickets | tickets | **buzón #404** ⭐ | known_errors → regla → arnés ⭐ |
| Scheduler | **cron heartbeats** | ✅ | consolidación nocturna | ❌ |
| System of Record | PostgreSQL | Attio + Stripe | Asana + panel | **magna.db + dump** ⭐⭐ |

**La lectura honesta:**

- **Freddy gana en las capas de abajo** — record, validación, conocimiento, gates. Ninguna de
  las tres referencias muestra algo comparable a los arneses o a `validate_db`.
- **Freddy pierde en todas las capas de arriba** — canales, ruteo, workers, scheduler, acción.
- **Son complementarios, no competidores.** Bennett tiene una organización sin fundaciones
  visibles; Freddy tiene fundaciones sin organización.
- **Paperclip resuelve exactamente lo que a Freddy le falta** (org chart, presupuesto,
  heartbeat, cola de aprobaciones) y **no resuelve nada de lo que Freddy ya tiene bien**.
  Sigue siendo candidato de investigación, no de adopción.

---

## G · PROPUESTA DE DEPARTMENT CONTRACT

**Derivado de la evidencia, no de la lista tentativa.** Cada slot está marcado con cómo se
probó:

- 🟢 **PROBADO** — Freddy lo tiene y demostradamente funciona
- 🔴 **PROBADO POR AUSENCIA** — Freddy no lo tiene y el daño es observable
- 🟡 **PRE-DISEÑADO** — la tabla ya existe en el schema, vacía
- ⚪ **HIPÓTESIS** — viene de los Reels, **no probado en Magna**

```
DEPARTAMENTO MAGNA — interfaz mínima
```

| # | Slot | Estado | Evidencia |
|---|---|---|---|
| 1 | **`record`** — fuente de verdad única, derivable, versionada | 🟢 | `magna.db` + `create_schema` + `seed/` + dump. Y el daño de no tenerla: `data/*.json` conviviendo |
| 2 | **`knowledge`** — reglas en Markdown versionado, fuera del modelo | 🟢 | 21 reglas · 9 workflows |
| 3 | **`known_errors`** — catálogo con síntoma/causa/solución/**prevención**/estado | 🟢 | 74 entradas. **Slot propio, no parte de `knowledge`**: tiene formato y ciclo distintos |
| 4 | **`recall`** — buscar en el conocimiento **por concepto** antes de afirmar | 🟢 | `regla.js`, `memoria_lookup.js`, `fuzzy.js`. **Es el slot que más sorprendió**: no estaba en la lista tentativa y es de los más valiosos |
| 5 | **`rules-as-code`** — las fórmulas del negocio en código, no en prompt | 🟢 | `precios.js`, `motor_alertas.js`, `carga.js` |
| 6 | **`harness`** — arneses + score como gate + prueba de que sepan fallar | 🟢 | 13 + `_pruebas.js` |
| 7 | **`human_gates`** — Preflight + backup + OK antes de escribir | 🟢 | ley del proyecto |
| 8 | **`identity`** — canónica + alias + código externo + `clase_contraparte` | 🟢 | `supplier_identities` |
| 9 | **`plans`** — el plan como artefacto versionado y auditable | 🟢 | 42 planes |
| 10 | **`handoff`** — estado transportable entre sesiones | 🟢 | 76 handoffs |
| 11 | **`inputs`** — canal de entrada, con la lógica separada del canal | 🔴 | `intake/core.js` ya tiene la separación; **falta el canal** |
| 12 | **`actions`** — qué puede ejecutar realmente, enumerado | 🔴 | 5 endpoints. El System of Action es Luka |
| 13 | **`health`** — está vivo, al día y sirviendo lo del disco | 🟢 | `salud.js` + huella + `/api/health` |
| 14 | **`improvement`** — buzón donde cada límite se vuelve trabajo | 🔴 | falta la cola; el ciclo existe pero se cierra a mano |
| 15 | **`approvals`** — el gate como **dato**, no como conversación | 🟡 | `approval_requests` existe y está vacía |
| 16 | **`audit`** — quién hizo qué, humano o agente, con before/after | 🟡 | `audit_log` existe y está vacía |
| 17 | **`runs`** — corridas con modelo, tokens y **costo** | 🟡 | `agent_runs.cost_estimate` existe y está vacía |
| 18 | **`budget`** — tope de gasto por área | ⚪ | Bennett lo tiene; **Freddy nunca lo necesitó**. No lo daría por bueno todavía |
| 19 | **`workers`** — roles ejecutables con alcance acotado | ⚪ | los 9 roles son prosa. No probado |
| 20 | **`kpis`** — qué mide el departamento | 🟢 parcial | Freddy los tiene; no están declarados como interfaz |

### Lo que la evidencia corrige de la lista tentativa

- **`recall` no estaba en la lista y debería estar.** Es el slot que más veces evitó un error
  en Freddy. *Buscar antes de afirmar* es una capacidad, no un buen hábito.
- **`known_errors` merece slot propio**, separado de `knowledge`: distinto formato, distinto
  ciclo de vida, y es lo que alimenta al harness.
- **`plans` y `handoff` no estaban** y son los que hacen auditable el trabajo entre sesiones.
- **`budget` sigue siendo hipótesis.** Viene de Bennett, no de Freddy. Ponerlo en el contrato
  ahora sería copiar, no derivar. **Recomiendo dejarlo fuera de la v1.**
- **`workers` tampoco está probado**: Freddy llegó al nivel actual **sin un solo agente real**.
  Ponerlo como slot obligatorio contradice la evidencia.

### La forma corta

> **Un departamento Magna es: una fuente de verdad derivable, un cuerpo de reglas
> consultable por código, un catálogo de errores que alimenta candados, un gate humano antes
> de escribir, y un canal por el que entra y sale trabajo.**
>
> Los agentes son opcionales. Freddy lo demuestra.

---

## H · MAPEO A AUTOS — **solo el mapeo, no el diseño**

| Slot | Freddy | **Autos** — qué sería | Estado |
|---|---|---|---|
| `record` | `magna.db` | unidades, dueños, costos de preparación, gastos, ventas | ❌ no relevado |
| `knowledge` | 21 reglas | criterios de tasación, qué preparación se recupera, plazos | ❌ |
| `known_errors` | 74 | vacío — se llena operando | ❌ |
| `recall` | `regla.js` | mismo mecanismo, otro corpus | ✅ **reutilizable tal cual** |
| `rules-as-code` | `precios.js` | margen por unidad, costo de tenencia, punto de remate | ❌ |
| `harness` | 13 arneses | nacen de los errores de Autos, no se copian | ⚙️ mecanismo sí, contenido no |
| `human_gates` | Preflight+backup+OK | igual, más fuerte: el ticket es mayor | ✅ **tal cual** |
| `identity` | proveedores | **unidad** (dominio/chasis) + **contraparte** | ✅ mecanismo reutilizable |
| `plans` / `handoff` | 42 / 76 | igual | ✅ **tal cual** |
| `inputs` | ❌ | fotos, papeles, consultas de compradores | ❌ |
| `actions` | 5 endpoints | publicar, responder, agendar visita | ❌ |
| `health` | `salud.js` | igual | ✅ mecanismo |
| `improvement` | ciclo manual | igual | ⚙️ |

**La diferencia estructural que cambia todo:**

| | Freddy | Autos |
|---|---|---|
| Unidad de negocio | **producto fungible** (500 SKU × N unidades) | **unidad única** (cada auto es su propio caso) |
| Ciclo | **diario** | **por operación**, semanas o meses |
| Costo | de reposición, se repite | **de adquisición + preparación + tenencia**, irrepetible |
| Alerta típica | *"este costo subió 8%"* | *"esta unidad lleva 60 días en stock"* |
| Riesgo | margen erosionado | **capital inmovilizado** |

> **`cost_alerts` no se traslada. `dias_en_stock` es su equivalente conceptual.**
> Y ahí sí aparece algo que Freddy nunca necesitó: **el capital por unidad**, que es el
> primer lugar real donde `budget` tendría sentido en Magna.

**No diseño Autos acá.** El siguiente paso para Autos sería relevar problemas con evidencia
—como pide `D-006`— antes de escribir una sola tabla.

---

## LO QUE NO ME CIERRA

1. **`data/*.json` conviven con `magna.db`.** No verifiqué cuál gana en cada lectura. Si algún
   camino lee el JSON viejo, hay dos fuentes de verdad. **Merece un arnés.**
2. **Roles obsoletos que contradicen lo vigente.** `audit_agent.md` y `dashboard_agent.md`
   hablan del Maestro de Excel. Si un agente los lee como vigentes, actúa sobre un sistema que
   ya no existe.
3. **12 tablas vacías son una promesa no cumplida en la fuente de verdad.** Un lector nuevo
   (persona o agente) no puede distinguir *"esto no se usa todavía"* de *"esto está roto"*.
4. **El gate humano es conversacional.** Funciona porque Luka está. `approval_requests` existe
   justamente para que no dependa de eso.
5. **`agents/` se llama `agents/` y no hay agentes.** El nombre le dice a cualquiera —incluido
   Claude en una sesión futura— que hay más autonomía de la que hay. La auditoría entera
   arrancó desconfiando de esa palabra porque vos lo pediste; sin ese pedido, la habría dado
   por buena.

---

## FUENTES

**Auditado read-only:** `C:\dev\magna-pyme-os` (51 scripts · 13 arneses · 42 planes · 36
tablas · 5 endpoints) · `freddy-agent-os/` (9 roles .md · 21 reglas · 9 workflows · 74
known_errors · 76 handoffs · 153 logs · 7 skills · 5 specs · 3 templates)

**Evidencia previa:** `docs/REFERENCE-ORG-001.md` · `docs/LAB-DEEP-UNDERSTANDING-001.md`

**No se modificó, instaló ni optimizó nada. No se creó ningún agente. No se instaló Paperclip.**
