# HANDOFF · FREDDY-AUTO-001 · Capa de transporte WhatsApp

> **Checkpoint anti-compactación.** Todo lo necesario para continuar sin reconstruir contexto.
> Si la sesión se compactó: **leer esto y seguir. No re-auditar nada.**

**Fecha:** 26/08/2026 · **Estado:** implementación local APROBADA, en curso

---

## OBJETIVO ACTUAL

Construir **solo la capa de transporte** alrededor del Intake Core existente, y dejar a Luka
un **simulador interactivo** donde pueda usar el bot como si fuera Freddy.

**Gate previo a Meta.** No se configura Meta real en esta etapa.

---

## ARQUITECTURA APROBADA

```
Freddy (WhatsApp o simulador)
   │
   ▼
wa/server.js    firma HMAC · allowlist · dedup · responde 200 YA · encola
   ▼
wa/sesion.js    sesiones.db · candado por teléfono · liberar evento si falla
   ▼
wa/adapter.js   faltantes[0] ⇄ botones / lista de WhatsApp
   ▼
╔═══════════════════════════════════════════════════════╗
║  intake/core.js  ── INTACTO, NO SE TOCA ──            ║
╚═══════════════════════════════════════════════════════╝
   ▼
HUMAN GATE → muestra propuesta → ✋ FRENA. No escribe.
```

---

## EL CONTRATO DE `intake/core.js` — CITADO, no referenciado

**Esto es lo que más se degrada al compactar. Queda literal:**

```js
module.exports = { abrir, responder, evaluar, metricas, CAMPOS, naturalKey, isoFecha, MIN_HISTORIAL };

// abrir(docPath, {model}) -> Promise<sol>     abre magna.db con readOnly:true
// responder(sol, campoId, valor) -> sol       marca source:"human_answer", confidence:"CONFIRMED"
// evaluar(sol) -> sol                         calcula sol.faltantes / sol.status / sol.missing
// metricas(sol) -> {requeridos, auto, humano, sin_resolver, auto_resolution_rate}
```

**Forma de `sol`:**
```js
{ documento, ruta, campos:{ [id]:{value,source,confidence} }, ocr, candado,
  incidencias:[{tipo,detalle}], faltantes:[...], status:"COMPLETA"|"INCOMPLETA",
  missing:[ids], natural_key, ms }
```

**Forma de cada `faltante`** — ya es lo que necesita un botón:
```js
{ campo, texto, opciones /* array | undefined */, sugerencia, motivo }
```

**`CAMPOS`** (8; los `req:true` son 7):
```
fecha(req) · proveedor(req) · destino(req)[COMPRA,GASTO] · total(req)
blanco_negro(req)[BLANCO,NEGRO] · metodo_pago(req)[EFECTIVO,TRANSFERENCIA]
estado_pago(req)[PAGADO,PENDIENTE] · comprobante(no req)
```

**`confidence`:** `HIGH` `MEDIUM` `CONFIRMED` cuentan como suficiente. `LOW` y `UNKNOWN` no.

**Degradación verificada:** si el OCR falla, `abrir()` empuja `{tipo:"OCR_FALLO"}` y devuelve
`evaluar(sol)` — **pregunta los 7 campos y no rompe.** Por eso el transporte se prueba
**sin OCR pago**.

---

## DECISIONES TOMADAS (aprobadas por Luka)

| # | Decisión |
|---|---|
| 1 | Estado en **`wa/sesiones.db` separado**. `magna.db` **intacto** |
| 2 | Lista de proveedores: **OCR/matcher primero → historial/frecuencia → top 8 + OTRO** |
| 3 | **Allowlist: solo Freddy.** Otro número → ignorado en silencio |
| 4 | `socio`/`facturadora` → **`ROUTING_UNSUPPORTED`** + revisión de Luka |
| 5 | Firma **HMAC-SHA256** con comparación de tiempo constante |
| 6 | `hub.challenge` implementado · **403 si el verify_token no coincide** (no 200) |
| 7 | **200 ANTES** del procesamiento pesado |
| 8 | **Dedup** por `message.id` |
| 9 | **Liberar el evento** si falla procesamiento o envío (evita deadlock por dedup) |
| 10 | **Candado por teléfono** (serialización) |
| 11 | **Health check real**: chequea credenciales al arrancar, no solo que el proceso viva |
| 12 | Historial **antes** de guardar el mensaje actual |
| 13 | **Paridad consola vs WhatsApp** como test |
| 14 | **Proposal Mode** · **cero escritura productiva** |
| 15 | Node 22 + `node:sqlite`. **Cero dependencias nuevas** |

---

## ARCHIVOS

**Autorizados (6) — en `C:\dev\magna-pyme-os\wa\`:**

| Archivo | Qué hace | Estado |
|---|---|---|
| `wa/firma.js` | HMAC-SHA256 sobre cuerpo crudo + `timingSafeEqual` | ⚪ |
| `wa/meta.js` | `hub.challenge` · parsear webhook · bajar media · enviar texto/botones/lista | ⚪ |
| `wa/sesion.js` | `sesiones.db` · dedup · candado · liberar | ⚪ |
| `wa/adapter.js` | traduce `faltantes[0]` ⇄ control; **no sabe de HTTP ni de Meta** | ⚪ |
| `wa/server.js` | `GET/POST /webhook` · `/wa/health` | ⚪ |
| `wa/simulador.js` | **chat interactivo local** — el gate previo a Meta | ⚪ |

**Séptimo, implicado por el DoD "10/10 tests":** `wa/wa.test.js`.

**Modificados: NINGUNO.** `intake/core.js`, `ocr.js`, `resolve_supplier.js`, `carga.js` y el
`server.js` de la app (puerto 4600) **no se tocan**.

---

## TESTS ESPERADOS (10, todos sin Meta)

| | Test |
|---|---|
| T1 | Firma: válida pasa · inválida rechaza · **sin firma rechaza** |
| T2 | `hub.challenge`: token ok → challenge · **token malo → 403** |
| T3 | Responde 200 en <100 ms con procesamiento lento |
| T4 | Dedup: mismo `message.id` dos veces → se procesa una |
| T5 | **Liberar en fallo** → el reintento SÍ se procesa |
| T6 | Candado por teléfono: dos mensajes juntos → en orden |
| T7 | Allowlist: número desconocido → ignorado |
| T8 | **Paridad consola/WhatsApp**: mismos campos y preguntas |
| T9 | Núcleo intacto: `intake/core.test.js` en verde |
| T10 | **Proposal Mode**: hash de `magna.db` idéntico antes/después |

---

## DEFINITION OF DONE

1. 10/10 tests · 2. hash de `magna.db` idéntico · 3. simulación end-to-end con remito real ·
4. **modo interactivo donde Luka use el bot como si fuera Freddy** · 5. propuesta estructurada
final · 6. evidencia de preguntas/routing · 7. este handoff actualizado

---

## ESTADO ACTUAL — CERRADO 26/08/2026

```
Diseño            ✅ aprobado
Handoff           ✅ este archivo
Implementación    ✅ COMPLETA — 10/10 tests · commit fded64e en magna-pyme-os
Simulador         ✅ listo para que lo pruebe Luka
Meta real         ⛔ NO — gate: que Luka lo use primero
```

**Los 7 archivos de `wa/` están escritos y commiteados. Cero archivos modificados fuera de
`wa/`.**

### Tres bugs que encontraron los propios tests

1. **`.finally()` devuelve una promesa NUEVA que también rechaza.** Sin un `.catch()` después
   quedaba una rechazada sin manejar y **Node mataba el proceso**: un solo envío fallido
   tiraba abajo el webhook entero. **No se ve leyendo el código, hay que ejecutarlo.**
2. **El spread pisaba `tipo:"pregunta"`** con el tipo del control. El control quedó anidado.
3. **`compras.proveedor_text`, no `compras.proveedor`.** La query fallaba **en silencio** (el
   `catch` se la comía) y el selector mostraba solo "Otro".

### Una corrección mía

Dije que la corrida sería USD 0,00 y **el OCR sí corrió y sí cobró** (~USD 0,03).
`ocr.js` hace `require("./env")` y toma la clave del `.env` del proyecto: **corre aunque la
variable no esté exportada en la terminal.** Agregado el switch `WA_OCR`, apagado por defecto.

### Ruido conocido

Node en Windows tira `Assertion failed: UV_HANDLE_CLOSING` al cerrar el proceso de tests.
**Cosmético** — exit code 0 y 10/10. No afecta el resultado.

---

## PRÓXIMOS PASOS — orden de construcción

```
1. wa/firma.js      + T1
2. wa/sesion.js     + T4 T5 T6
3. wa/meta.js       + T2
4. wa/adapter.js    + T8
5. wa/server.js     + T3 T7 T10
6. wa/simulador.js  → correr los 10   ← GATE: 10/10 o no se sigue
──────────────────── recién después ────────────────────
7. Luka prueba el simulador como si fuera Freddy
8. Los 8 pasos de Meta (Luka) con número de PRUEBA
```

**Commitear cada archivo apenas pase su test, no al final.** Es la mitigación de compactación:
lo que está en disco y en git no se resume.

---

## SI LA SESIÓN SE COMPACTÓ

1. Leé el contrato de `core.js` de arriba — **está citado, no hay que releerlo**.
2. Mirá `git log --oneline` en `magna-pyme-os` para ver qué archivos ya pasaron su test.
3. Seguí por el primer ⚪ de la tabla de archivos.
4. **No re-auditar Freddy. No re-evaluar AgentKit.** Está todo decidido arriba.

**Referencia de transporte (solo consulta):** `C:\dev\_diag_reel\agentkit_CLAUDE.md`
líneas 805–1195. **No copiar arquitectura: Python/FastAPI/SQLAlchemy/Docker/Zernio quedan
fuera.**
