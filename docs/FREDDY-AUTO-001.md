# FREDDY-AUTO-001 — Auditoría y Gap Analysis

> **Objetivo del dueño:** que la carga diaria ocurra prácticamente sola. La única intervención
> normal debería ser **contar el efectivo y confirmar que coincide**. Todo lo demás capturado,
> leído, conciliado y cargado automáticamente. Intervenir solo ante excepción real.
>
> `OWNER_REPORTED_BASELINE`: 10–30 min por cierre · ~50 min para 4 días juntos.
> **No es medición formal.** Es lo que reporta el dueño.

Auditoría read-only del 24/08/2026 sobre `C:\dev\magna-pyme-os`. **No se modificó nada.**

---

## A. QUÉ ENCONTRÉ

`magna-pyme-os` tiene **84 días cargados** (01/06 → 23/08/2026), SQLite nativo, cero dependencias.

| Pieza | Qué hace |
|---|---|
| `cierre.js` | Gate de 2 pasos: checklist seco primero, fuentes después |
| `carga.js` | `computeDia()` / `writeDia()` — transaccional, con backup |
| `ocr.js` | OCR de facturas vía Claude vision, **con candado aritmético** |
| `backtest_ocr.js` | Mide el OCR contra la itemización hecha a mano |
| `itemizar.js` · `precios.js` · `alertas.js` · `alta.js` | Fase 2: catálogo y precios |
| `arqueo_caja.js` | Registra el **conteo físico** de caja |
| `validate_db.js` + **14 arneses** | Los candados |
| `planes/dia_YYYY-MM-DD.js` | **El input del día, escrito a mano** |
| `import_extracto.ps1` | Lee extractos Santander — **pero está huérfano, ver D** |

Más la capa de gobierno: 73 known errors, 19 reglas, 9 workflows, 7 agentes.

---

## B. CÓMO FUNCIONA HOY (reconstruido del código, no del relato)

```
1. node cierre.js --dia X          → checklist seco + arrastre (caja/banco/deuda)
2. LUKA pega el parte              ← MANUAL · humano
3. node cierre.js --dia X --fuentes → LISTA las facturas y verifica que el extracto exista
                                      ⚠ NO las lee: solo dice qué archivos hay
4. CLAUDE abre facturas y extracto ← MANUAL · Claude, a ojo
5. CLAUDE escribe planes/dia_X.js  ← MANUAL · Claude, a mano, todos los días
6. preview → --apply               → backup + transacción + validación por re-lectura
7. node validate_db.js             → PASS
8. 🚦 GATE de conciliación al peso
9. Fase 2: itemizar → precios → alertas
```

**El hallazgo central:** los pasos 6 a 9 son excelentes y están automatizados. Los pasos 2 a 5
son donde se van los minutos de Luka — y ahí **Claude es literalmente una pieza del pipeline**.

---

## C. QUÉ YA ESTÁ RESUELTO (y no hay que reconstruir)

1. **Escritura segura del día.** Transacción, backup previo, validación por re-lectura, aborta
   sin escribir si no cuadra. El arnés **A4 abre el backup y cuenta los días adentro** — nació
   de que los `.bak` estaban vacíos por WAL sin checkpoint (#71).
2. **Todo el cálculo financiero.** Caja, banco, deuda por proveedor normalizado, arrastre
   cross-período, SIRCREB, GetNet, retiros de socios.
3. **El conteo físico de caja ya existe** (`arqueo_caja.js`) — y con la regla correcta: no
   netea el descalce para que cierre, lo deja a la vista (#46). **Es exactamente lo que Luka
   quiere conservar, y ya está construido.**
4. **Los candados.** 73 known errors, 14 arneses, `validate_db`, el gate de 2 fases, el gate
   del checklist (que existe porque el orden se saltó una vez y se decidió no depender de la
   memoria del agente).
5. **Catálogo, precios y alertas de aumento** con comparación contra la última compra real.
6. **El OCR está construido y medido.** Claude vision con structured outputs, candado
   aritmético (Σ items = total impreso), detecta `manuscrito` y `legible`, desglose fiscal.
   Backtest: **27 facturas, 97% en cantidades, totales al centavo, USD 0,79**.

---

## D. QUÉ ESTÁ PARCIALMENTE RESUELTO

**El OCR existe, está validado y NO está conectado.** Hoy solo lo llaman `backtest_ocr.js` y
`test_ocr.js`. **Ningún paso del cierre lo usa.** Está a un cable de distancia del flujo real.

**`cierre.js --fuentes` lista, no lee.** Enumera los nombres de archivo de la carpeta de
facturas y verifica que el `.xlsx` del extracto esté subido. Después alguien los abre a mano.

**`import_extracto.ps1` está huérfano.** Lee los extractos Santander y categoriza bien
(SIRCREB, GetNet, transferencias, egresos), pero **valida contra `data/dias.json`** — el
almacenamiento anterior a la migración a SQLite. **No aparece en ningún workflow vigente.**
Es código bueno apuntando a un blanco que ya no existe.

---

## E. QUÉ FALTA (gaps reales)

| Gap | Estado |
|---|---|
| **WhatsApp → carpeta** | 100% manual. Luka descarga y archiva cada foto y PDF. |
| **Descarga del extracto** | 100% manual. |
| **Lectura del parte manuscrito** | El papel se tipea a mano. El OCR nunca lo vio. |
| **Generación del plan del día** | Claude escribe `planes/dia_X.js` a mano, todos los días. |
| **Conciliación automática** | Declaración ↔ factura ↔ banco la hace Claude leyendo. |
| **Motor de excepciones** | No existe el concepto de "esto pasa solo / esto frena". |

---

## F. CAPABILITIES REQUIRED

Contra la taxonomía del Lab (`seed/capabilities.json`):

| Capacidad | ¿La tenemos? |
|---|---|
| `document_extraction` | **SÍ** — construida y validada. Falta conectarla. |
| `messaging_integration` | NO |
| `handwritten_document_understanding` | **Nueva.** Parcial: `ocr.js` ya detecta `manuscrito`, pero nunca se probó sobre el parte. |
| `bank_data_ingestion` | Parcial y huérfana |
| `transaction_reconciliation` | **Nueva.** No existe. |
| `exception_routing` | **Nueva.** No existe. |

---

## G. QUÉ NO DEBEMOS RECONSTRUIR

`carga.js` · los 14 arneses · `validate_db` · `arqueo_caja` · el gate de 2 fases · la regla del
parte · el motor de alertas · **`ocr.js`** · el esquema de `magna.db` · los 73 known errors.

**Nada de esto se reemplaza.** El trabajo es conectar y alimentar, no rehacer.

---

## H. RIESGOS

**Dinero y errores silenciosos**
- El peor escenario no es que falle: es que **cargue mal y nadie lo note**. El candado
  aritmético del OCR existe justamente por eso y no se negocia.
- **Duplicados**: la misma factura entrando por WhatsApp y por carpeta. Hoy lo evita que Luka
  archiva a mano. Automatizar sin huella única lo rompe.

**Banco**
- Automatizar la descarga del extracto implica **credenciales bancarias**. Es el riesgo más
  alto de todo el problema. Un scraper con la clave del banco guardada es una superficie que
  hoy no existe. **Recomendación: no tocar esto primero.**

**El parte manuscrito**
- Si el OCR lee mal el efectivo, **la caja miente** y el descalce aparece días después. El
  conteo físico de Luka es la defensa — por eso él quiere conservarlo, y tiene razón.

**WhatsApp**
- Automatizarlo tiene condiciones de servicio y bloqueos. Requiere fuente primaria antes de
  elegir camino.

**Acciones automáticas**
- Hoy nada escribe sin `--apply`. Cualquier automatización debe mantener el gate humano sobre
  la escritura de dinero.

---

## I. RESEARCH PLAN

Por orden de valor sobre riesgo:

1. **Conectar `ocr.js` al flujo** — cero investigación externa. Es cableado.
2. **Reconciliación** — casi seguro código propio, no herramienta externa. Investigar primero
   si alguien resolvió el matching declaración↔documento↔banco de forma reusable.
3. **Parte manuscrito** — probar `ocr.js` tal cual sobre una foto del parte. Puede que no haga
   falta nada nuevo: ya usa Claude vision y ya detecta manuscrito.
4. **WhatsApp** — fuente primaria sobre la API oficial vs export vs bridge. Evaluar ToS.
5. **Banco** — último. Investigar si hay API antes de siquiera pensar en scraping.

---

## J. PRIMERA HIPÓTESIS DE EXPERIMENTO

**El slice más chico con valor demostrable:**

> Conectar el OCR ya validado al paso de facturas del cierre, en modo **propuesta**:
> que lea las facturas de la carpeta del día y emita el bloque `compras[]` del plan,
> con el candado aritmético puesto. Claude revisa y aprueba. **No escribe nada.**

**Por qué este y no otro:**

- **Ya está construido y medido** (97%, USD 0,79). No requiere tecnología nueva.
- **No toca dinero**: propone, no escribe. El gate humano queda intacto.
- **Riesgo controlado**: si el OCR falla, el candado lo caza y se cae a lo de hoy.
- **Medible directo**: minutos de leer facturas a mano, hoy vs después.
- **No toca banco ni WhatsApp**, que son los dos riesgos altos.

**Baseline a medir antes de tocar nada:** cuántos minutos por cierre se van en leer facturas,
cuántas facturas por día, cuántos errores de lectura aparecen después.

---

## LA PREGUNTA: ¿CUÁNTO YA TENEMOS?

**MUCHO YA EXISTE — pero no la mitad que consume el tiempo de Luka.**

```
CAPTURA        (WhatsApp, extracto, parte)     ░░░░░░░░░░   nada
LECTURA        (OCR de documentos)             ███████░░░   construido, desconectado
CONCILIACIÓN   (declaración ↔ doc ↔ banco)     ░░░░░░░░░░   la hace Claude a ojo
CÁLCULO        (caja, banco, deuda)            ██████████   completo
ESCRITURA      (transacción, backup)           ██████████   completo
VALIDACIÓN     (arneses, candados)             ██████████   completo
```

**Freddy OS resolvió el procesamiento. No resolvió la ingesta.**

Y esa es exactamente la buena noticia: la parte difícil de auditar, la que toca plata y no
puede fallar, está hecha y probada. Lo que falta es alimentarla.
