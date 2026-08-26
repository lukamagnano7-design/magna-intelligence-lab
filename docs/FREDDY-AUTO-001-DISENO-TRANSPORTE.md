# FREDDY-AUTO-001 · Diseño mínimo del transporte WhatsApp

> **No implementado.** Diseño para revisión Luka + ChatGPT.
> AgentKit se usó **solo como implementación de referencia**. Nada de Python, FastAPI,
> SQLAlchemy, Docker, Zernio, `brain.py` ni `/build-agent`.

**Fecha:** 26/08/2026 · **Referencia:** `C:\dev\_diag_reel\agentkit_CLAUDE.md` (líneas 805–1195)
**Ubicación de este doc:** Lab. **Al aprobarse, su lugar es `freddy-agent-os/specs/active/`.**

---

## 0 · LO QUE LA REFERENCIA AGREGÓ A TU LISTA DE CINCO

Tus 5 puntos estaban bien. Leyendo el código encontré **cuatro más**, y uno es un bug feo:

| # | Hallazgo | Por qué importa |
|---|---|---|
| **6** | **Liberar el evento si el envío falla.** El evento se marca *procesado* **antes** de trabajar (para que dos entregas simultáneas no dupliquen). Si después falla el envío y **no se libera**, el reintento de Meta se descarta por duplicado y **Freddy nunca recibe respuesta**. | **Es un deadlock por deduplicación.** Los puntos 2 y 3 solos lo *crean* |
| **7** | **403 —no 200— si el `verify_token` no coincide.** *"Devolverle 200 le hace creer que la URL quedó verificada cuando no es cierto."* | Un alta de webhook falsamente exitosa |
| **8** | **Health check responde 200 aunque las credenciales estén mal**, con el diagnóstico en el cuerpo, y chequea el proveedor **al arrancar**: *"que el servidor conteste no significa que el agente pueda responder"* | **Es el arnés A1 de Freddy**, descubierto por otro camino |
| **9** | **Leer el historial ANTES de guardar el mensaje actual**, y **no guardar los avisos técnicos** ("estoy teniendo problemas") en el historial: contaminan el contexto de todo lo que sigue | Aplica a nuestro estado de sesión |

---

## 1 · ARQUITECTURA FINAL MÍNIMA

```
   Freddy (WhatsApp)
        │
        ▼  POST /webhook
┌─────────────────────────────────────────────────────────────────┐
│  wa_webhook.js          TRANSPORTE — lo único nuevo             │
│   1. verificar firma HMAC-SHA256  (compare_digest)              │
│   2. allowlist: ¿el número es el de Freddy? si no → ignorar     │
│   3. dedup por message.id                                        │
│   4. responder 200 YA  →  encolar                                │
└───────────────────────────┬─────────────────────────────────────┘
                            │  (fuera del ciclo del webhook)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  wa_sesion.js           ESTADO — candado por número              │
│   · una sesión por teléfono, persistida                          │
│   · serializa: dos mensajes seguidos NO se procesan en paralelo  │
└───────────────────────────┬─────────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  wa_adapter.js          TRADUCTOR — canal ⇄ lógica               │
│   sol.faltantes[0]  →  botones / lista de WhatsApp               │
│   respuesta de Freddy  →  core.responder(sol, campo, valor)      │
└───────────────────────────┬─────────────────────────────────────┘
                            ▼
╔═════════════════════════════════════════════════════════════════╗
║  intake/core.js         INTACTO — NO SE TOCA                     ║
║   abrir() · responder() · evaluar() · metricas() · CAMPOS        ║
║   PROPOSAL MODE: solo lee. No escribe magna.db.                  ║
╚═══════════════════════════┬═════════════════════════════════════╝
                            ▼
                    ┌───────────────────┐
                    │   HUMAN GATE      │
                    │  muestra la       │
                    │  propuesta y      │
                    │  FRENA            │
                    └───────────────────┘
                            │
                            ✋  NO ESCRIBE NADA
```

**El adapter es un traductor de tres funciones. Toda la inteligencia ya existe.**

---

## 2 · REUTILIZADO — sin tocar una línea

| Pieza | Qué aporta | Estado |
|---|---|---|
| `intake/core.js` | `abrir()` `responder()` `evaluar()` `metricas()` `CAMPOS` | **INTACTO** |
| `CAMPOS[].opciones` | Ya declaradas: `COMPRA/GASTO` · `BLANCO/NEGRO` · `EFECTIVO/TRANSFERENCIA` · `PAGADO/PENDIENTE` | **INTACTO** |
| `evaluar().faltantes` | `{campo, texto, opciones, sugerencia, motivo}` — **ya es la forma exacta que necesita un botón** | **INTACTO** |
| `resolve_supplier.js` | Identidad de proveedor por código, en capas | **INTACTO** |
| `supplier_identities.clase_contraparte` | Compra vs gasto **leído**, no inferido (Slice 1b) | **INTACTO** |
| `ocr.js` | Degrada limpio: si falla → `OCR_FALLO` y pregunta todo | **INTACTO, y apagado por defecto** |
| `intake/consola.js` | Sigue funcionando en paralelo. **Es el control**: si consola y WhatsApp dan distinto, el adapter tiene un bug | **INTACTO** |

> **La separación canal/lógica ya estaba probada.** `consola.js` dice en su encabezado:
> *"cuando exista el adaptador de WhatsApp va a consumir el MISMO core: las preguntas ya
> vienen con `opciones`, que acá se imprimen como lista y allá serían botones."* **Se escribió
> para este día.**

---

## 3 · NUEVO — exactamente 6 archivos

| # | Archivo | Qué hace | Líneas est. |
|---|---|---|---|
| 1 | `wa/firma.js` | HMAC-SHA256 sobre el **cuerpo crudo** + `timingSafeEqual`. Rechaza sin firma | ~40 |
| 2 | `wa/meta.js` | Adaptador Meta: `hub.challenge`, parsear webhook, **bajar media por `media_id`**, enviar texto/botones/lista | ~180 |
| 3 | `wa/sesion.js` | Sesión por teléfono + **candado serializado** + dedup por `message.id` + **liberar en fallo (punto 6)** | ~120 |
| 4 | `wa/adapter.js` | Traduce `faltantes[0]` ⇄ control de WhatsApp. **No sabe de Meta ni de HTTP** | ~150 |
| 5 | `wa/server.js` | `GET /webhook` (403 si el token no coincide) · `POST /webhook` (200 primero) · `/wa/health` | ~120 |
| 6 | `wa/simulador.js` | **Chat local sin Meta.** Inyecta payloads como si vinieran del webhook | ~90 |

**Total: ~700 líneas de transporte.** Node 22 puro + `node:sqlite` + `node:crypto`.
**Cero dependencias nuevas.**

### Modificado

**Ninguno.** `intake/core.js`, `ocr.js`, `resolve_supplier.js`, `carga.js`, `server.js`
(el de la app, puerto 4600) **no se tocan**. `wa/server.js` es un proceso aparte, otro puerto.

### Tres decisiones que necesitan tu OK

**D1 · Dónde vive el estado de la conversación.**
`core.abrir()` devuelve un objeto en memoria, pero WhatsApp es multi-turno. Propongo un
archivo **separado**: `wa/sesiones.db`.
→ **`magna.db` no se toca nunca.** Proposal Mode queda literal, no interpretado.

**D2 · El selector de proveedores.**
Los botones de WhatsApp son **máximo 3**; nuestras opciones binarias entran. Pero el selector
de proveedores necesita **Interactive List** (hasta 10 filas). Propongo: los **8 proveedores
más frecuentes** de `supplier_identities` + *"otro (escribilo)"*.
→ Cumple *"evitar texto libre cuando haya opciones"* sin cerrar la puerta al proveedor nuevo.

**D3 · Allowlist de un solo número.**
Solo el número de Freddy puede hablarle. Cualquier otro se ignora en silencio.
→ AgentKit no lo necesita (habla con clientes). **Nosotros sí**: es un canal privado.

---

## 4 · TESTS — todo verificable antes de tocar Meta

| # | Test | Qué prueba | Necesita Meta |
|---|---|---|---|
| T1 | **Firma HMAC** | firma válida pasa · inválida rechaza · **sin firma rechaza** · comparación de tiempo constante | ❌ |
| T2 | **`hub.challenge`** | token correcto → devuelve el challenge en texto plano · **token incorrecto → 403, no 200** | ❌ |
| T3 | **200 antes de trabajar** | el POST responde en <100 ms con el procesamiento simulado en 3 s | ❌ |
| T4 | **Dedup** | el mismo `message.id` dos veces → se procesa **una** | ❌ |
| T5 | **Liberar en fallo** | envío falla → el evento se libera → **el reintento SÍ se procesa** | ❌ |
| T6 | **Candado por teléfono** | dos mensajes con 50 ms de diferencia → se atienden **en orden**, el estado no se entrelaza | ❌ |
| T7 | **Allowlist** | número desconocido → ignorado, sin respuesta | ❌ |
| T8 | **Paridad consola/WhatsApp** | el mismo documento por los dos adaptadores → **mismos campos, mismas preguntas, mismas métricas** | ❌ |
| T9 | **Núcleo intacto** | `intake/core.test.js` sigue en verde sin cambios | ❌ |
| T10 | **Proposal Mode** | tras un flujo completo: **`magna.db` con hash idéntico** al del inicio | ❌ |

**Los 10 corren sin Meta**, con `wa/simulador.js` inyectando payloads reales.

**T8 y T10 son los que importan.** T8 prueba que el adapter no cambió la lógica; T10 prueba
que no escribimos nada. Los dos son candidatos a **arnés permanente**.

---

## 5 · PASOS META — lo que tenés que hacer vos

**Todo esto va DESPUÉS de que los 10 tests pasen en local.**

| # | Paso | Dónde | Qué queda |
|---|---|---|---|
| 1 | Crear app **Business** en Meta for Developers | developers.facebook.com | App ID |
| 2 | Agregar el producto **WhatsApp** | panel de la app | **número de prueba** + `PHONE_NUMBER_ID` |
| 3 | Copiar el **token temporal** (24 h) | WhatsApp → API Setup | `META_ACCESS_TOKEN` |
| 4 | Copiar el **App Secret** | Configuración → Básica | `META_APP_SECRET` (verifica firmas) |
| 5 | **Agregar tu número** como destinatario de prueba | API Setup | hasta 5 números |
| 6 | Exponer el webhook con **túnel HTTPS** | `ngrok` / Cloudflare Tunnel | URL pública |
| 7 | Registrar el webhook | Configuración → Webhooks | URL + **Verify Token** que vos inventás |
| 8 | Suscribir el campo **`messages`** | mismo panel | ✔ |

**Lo que hay que evitar:**
- **No usar el número real de Freddy** hasta que el circuito completo esté probado.
- El token de 24 h sirve para probar; para quedarse necesita **token de sistema permanente**.
- Meta exige **HTTPS**: sin túnel, el webhook no se puede registrar.

**Yo no puedo hacer ninguno de estos ocho.** Requieren tu cuenta.

---

## 6 · COSTOS Y RIESGOS

### Costos

| Concepto | Costo |
|---|---|
| Meta Cloud API — **conversaciones de servicio** | **gratis** (desde nov-2024) |
| Número de prueba de Meta | **gratis** |
| Túnel HTTPS (ngrok free) | **gratis** |
| Node + `node:sqlite` | **gratis** |
| **OCR (`ocr.js`)** | **apagado por defecto.** Si se enciende: ~USD 0,03 por factura (backtest de julio: 27 facturas por USD 0,79) |
| **TOTAL del slice** | **USD 0,00** |

> **La ventana de 24 h de Meta no nos afecta**: Freddy siempre escribe primero. Solo
> restringiría mensajes iniciados por nosotros, que este slice no hace.

### Riesgos

| # | Riesgo | Mitigación |
|---|---|---|
| 1 | **Deadlock por dedup** (punto 6) | T5 lo prueba explícitamente |
| 2 | **Estado perdido si el proceso reinicia** a mitad de un intake | `sesiones.db` persistido; al volver, retoma o reinicia el documento |
| 3 | **Escribir sin querer** en `magna.db` | Archivo de sesiones **separado** + T10 comparando hash |
| 4 | **Un número desconocido escribe** | Allowlist (D3) |
| 5 | **Token de 24 h vence** a mitad de una prueba | Health check lo detecta al arrancar (punto 8) |
| 6 | **Divergencia consola vs WhatsApp** | T8 como arnés permanente |
| 7 | **`socio`/`facturadora` sin camino** — pendiente declarado del Slice 1b | **Sigue abierto.** Con consola no importaba porque leías vos; **por WhatsApp Freddy va a recibir un aviso sin saber qué hacer**. Ver abajo |

### El pendiente que este slice NO resuelve

Cuando llegue una factura de **Master Meat** (facturadora de Cristian) o un movimiento de un
**socio**, el intake registra la incidencia *"esto va a tesorería, no a gasto"* **pero no
tiene camino**. Por consola no molestaba. **Por WhatsApp, Freddy recibe un mensaje que no
sabe qué hacer con él.**

**Propuesta mínima para este slice:** que el adapter, ante `clase_contraparte` en
`socio`/`facturadora`, responda algo simple —*"Esto no es una compra ni un gasto. Lo dejo
anotado para que lo vea Luka."*— y **frene ahí**. No resuelve el circuito, pero **no deja a
Freddy trabado**.

---

## 7 · LO QUE NO CAMBIA — confirmado contra el código

✅ **`intake/core.js` intacto** — el adapter solo llama `abrir` / `responder` / `evaluar`.
✅ **Proposal Mode intacto** — el core abre `magna.db` en `readOnly:true`; el adapter no la abre.
✅ **Human gate intacto** — el flujo **termina** en la propuesta. No hay `--apply`.
✅ **No se escriben compras ni gastos productivos.**
✅ **OCR apagado por defecto** — `abrir()` degrada a `OCR_FALLO` y pregunta todo. Costo cero.
✅ **Meta directo, sin Zernio.**
✅ **Node 22 + `node:sqlite`, cero dependencias nuevas.**
✅ **Quien le habla al bot es Freddy** — un solo usuario conocido, lenguaje simple, opciones
en vez de texto libre.

---

## 8 · PRÓXIMO PASO

**Nada se implementa hasta tu OK.** Cuando lo des, el orden es:

```
1. wa/firma.js + T1                          ← lo más chico y verificable
2. wa/sesion.js + T4 T5 T6                   ← dedup, liberar, candado
3. wa/meta.js (parseo, hub.challenge) + T2   ← sin red todavía
4. wa/adapter.js + T8                        ← la paridad con consola
5. wa/server.js + T3 T7 T10                  ← 200-primero, allowlist, no-escritura
6. wa/simulador.js  →  correr los 10         ← el gate: 10/10 o no se sigue
─────────────────── recién acá ───────────────────
7. Los 8 pasos de Meta (vos) con número de PRUEBA
8. Una factura real por WhatsApp, de punta a punta
9. Recién después: número real de Freddy
```

**El paso 6 es el gate.** Si los 10 tests no pasan, no se toca Meta.

**Dos cosas que necesito de vos antes de escribir la primera línea:**
las tres decisiones D1/D2/D3, y si te sirve la respuesta mínima propuesta para
`socio`/`facturadora`.

---

**No se implementó nada. No se tocó Freddy OS. No se instaló nada. USD 0,00.**
