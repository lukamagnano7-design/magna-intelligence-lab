# FREDDY-AUTO-001 · Slice 1 — Structured Intake (sin WhatsApp)

> **Hipótesis:** antes de resolver el transporte, Freddy OS necesita poder recibir un
> documento, aprovechar lo que ya sabe, detectar qué falta, preguntar **solo eso**, y
> producir un registro `COMPLETA | INCOMPLETA` confiable.

**Proposal mode: no se escribió una sola fila en `magna.db`.**

---

## 1. QUÉ CONSTRUÍ

```
                    ┌── intake/consola.js   ← el primer adaptador
intake/core.js ─────┤
  (toda la lógica)  └── [WhatsApp adapter]  ← futuro, mismo core
```

**`core.js` no sabe que existe una consola.** Devuelve las preguntas como **datos**
(`{campo, texto, opciones, sugerencia, motivo}`). Hoy la consola las imprime como lista;
mañana WhatsApp las manda como botones. **La lógica no se muda.**

---

## 2. QUÉ REUTILICÉ (sin tocar una línea)

| Pieza | Qué aportó |
|---|---|
| **`ocr.js`** | Lectura del documento + **candado aritmético** + `manuscrito` / `legible` |
| **`resolve_supplier.js`** | Proveedor por CUIT → nombre → razón social → alias, con su propia confianza |
| Guarda **DESTINATARIO** | "Freddy Gutiérrez" es a quien le entregan, no el emisor |
| **`magna.db`** (solo lectura) | El historial de 226 compras, que resulta ser el mejor predictor |
| **`natural_key`** | La forma de identidad que ya usan 226/226 compras |
| Vocabulario real | `BLANCO/NEGRO`, `EFECTIVO/TRANSFERENCIA`, `PAGADO/PENDIENTE` |

**No dupliqué ninguna capacidad existente.**

---

## 3. QUÉ AGREGUÉ

Tres archivos nuevos en `magna-pyme-os/intake/`. **Cero modificaciones a archivos existentes.**

- `core.js` — resolución, detección de faltantes, provenance, estado, métricas
- `consola.js` — adaptador (muestra, pregunta, devuelve). Sin lógica adentro
- `core.test.js` — 18 tests

---

## 4. CASOS REALES

Documentos históricos de `FACTURAS AGOSTO 2026`. Ninguno fabricado.

| | Documento | Auto | Preguntas | Estado |
|---|---|---|---|---|
| **A** | `2026_08_21_..._receipt.pdf` (Edesur) | 3/6 · **50%** | 4 | INCOMPLETA |
| **B** | `005982_20260803_FA4-00172192.PDF` (La Paulina) | 5/6 · **83%** | 1 | **COMPLETA** |
| **C** | `WhatsApp Image 2026-08-12 at 11.08.59 AM.jpeg` | 1/6 · **17%** | 5 | INCOMPLETA |
| **D** | `WhatsApp Image 2026-08-01 at 8.33.19 PM.jpeg` (32 KB) | 2/6 · **33%** | 4 | INCOMPLETA |

Costo OCR: **USD 0,019 – 0,032** por documento. Tiempo: **4,7 – 10,3 s**.

---

## 5. COMPLETA — caso B, real

```
✓ fecha          2026-08-03        ocr             HIGH
✓ proveedor      LA PAULINA        identidad:cuit  HIGH
✓ total          137151.18         ocr             HIGH
✓ blanco_negro   BLANCO            historial:8/8   MEDIUM
✓ metodo_pago    TRANSFERENCIA     historial:8/8   MEDIUM
✎ estado_pago    PAGADO            human_answer    CONFIRMED

STATUS: COMPLETA
IDENTIDAD: 2026-08-03|LA PAULINA|13715118|-
5 automáticos · 1 humano · 83%
```

**Necesitaba 6 datos y preguntó 1.** Exactamente la hipótesis.

---

## 6. INCOMPLETA — caso C, real

```
✗ fecha · ✗ proveedor · ✓ total 765363.26 · ✗ blanco_negro · ✗ metodo_pago · ✗ estado_pago

STATUS: INCOMPLETA
MISSING: fecha, proveedor, blanco_negro, metodo_pago, estado_pago
```

La foto no mostraba encabezado. **No inventó proveedor ni fecha para que el registro pasara.**

---

## 7. INTERVENCIÓN HUMANA — qué preguntó y por qué

**Lo que nunca puede saber solo:** `metodo_pago` y `estado_pago` **no figuran en ninguna
factura**. Son hechos posteriores al documento.

**Pero no siempre los pregunta.** En el caso B dedujo `metodo_pago` del historial (8/8
transferencias) y preguntó **solo `estado_pago`** — porque ahí el historial **está dividido**:
La Paulina a veces paga y a veces queda pendiente. Ese es el único dato que varía factura a
factura, y es exactamente el que preguntó.

**Cada pregunta viaja con su motivo:** `"no se pudo determinar"` o
`"confianza LOW: hay que confirmarlo"`.

---

## 8. AUTO-RESOLUTION

| Caso | Rate |
|---|---|
| B — factura formal, proveedor conocido | **83%** |
| A — comprobante formal, proveedor nuevo | 50% |
| D — foto chica | 33% |
| C — foto parcial | 17% |

**El promedio no sirve como métrica.** Lo que manda es que **el rate sube con el conocimiento
acumulado**: un proveedor con historial se resuelve casi solo; uno nuevo, no. El sistema
mejora con el uso, sin tocar código.

---

## 9. PROVENANCE

Cada campo sabe de dónde salió: `ocr` · `identidad:cuit` · `historial:8/8` · `human_answer`,
con su confianza (`HIGH` / `MEDIUM` / `LOW` / `UNKNOWN` / `CONFIRMED`).

`historial:8/8` se lee: *"las 8 compras previas de este proveedor fueron así"*. **Se puede
auditar la afirmación**, no solo verla.

---

## 10. CANDADOS

- **Candado aritmético de `ocr.js`** — intacto. Si no cuadra, el total baja a `LOW`, **no se
  da por bueno** y se pregunta. **No lo debilité para que el experimento "funcionara".**
- **`LOW` no cuenta como resuelto.** Tener un dato no es poder confiar en él.
- **Guarda de destinatario** — heredada de `resolve_supplier`.
- **Idempotencia** por `natural_key`, con la forma que ya usa la base.
- **Un fallo de OCR no rompe el circuito**: se registra y se preguntan todos los campos.

---

## 11. BUGS Y HALLAZGOS

**Tres bugs míos, encontrados verificando:**

1. **`resolveSupplier` recibe un OBJETO, no dos strings.** Yo le pasaba el CUIT en la posición
   de `dbPath` y SQLite intentaba **abrir el CUIT como si fuera un archivo de base de datos**.
   Fallaba **solo con facturas que tienen CUIT** — las que más importan. En el caso A no falló
   porque el CUIT venía vacío.
2. **La fecha del OCR viene `dd/mm/yyyy` y la base usa `yyyy-mm-dd`.** La `natural_key` nunca
   habría matcheado contra las 226 compras: **la guarda de duplicados era decorativa.**
3. Formas de retorno asumidas mal (`verificacion.cuadra`, no `candado_ok`).

**Hallazgos sobre el negocio:**

- **El historial del proveedor predice mejor que el CUIT.** El CUIT presente da BLANCO en 61
  casos pero también NEGRO en 7; y hay 36 BLANCO **sin** CUIT. En cambio, **7 de los 8
  proveedores con ≥4 compras facturan siempre igual**. Por eso la regla usa historial, no CUIT.
- **No todo lo que llega es una compra.** El caso A era una **factura de Edesur**: un *gasto*,
  no mercadería. El intake hoy no distingue gasto de compra — y esa distinción ya existe como
  regla del negocio (punto 4 vs punto 6 del checklist).
- **Los archivos se llaman `WhatsApp Image 2026-08-12 at 11.08.59 AM.jpeg`.** El nombre no
  lleva ninguna información. Es la evidencia física del problema de intake.

---

## 12. TESTS

**18 tests, todos en verde.** No llaman al OCR ni gastan API: prueban la lógica.

Los que más importan:
- `un valor con confianza LOW NO cuenta como resuelto`
- `un campo confirmado por el humano NO cuenta como auto-resuelto` — si contara, la métrica se
  auto-felicitaría: cuanto más preguntara, mejor se vería
- `ningun camino completa un campo sin valor para llegar a COMPLETA`
- `la fecha se normaliza a YYYY-MM-DD como la guarda la base`

**Y el estado de Freddy OS después:** arneses **13/13** · `compras` 226 · `dias` 84. Sin cambios.

---

## 13. HIPÓTESIS

# VALIDATED

Un documento real de un proveedor conocido se convirtió en un registro estructurado
**resolviendo 5 de 6 campos con conocimiento que Freddy OS ya tenía**, preguntando **solo el
que genuinamente variaba**, y declarando honestamente `INCOMPLETA` cuando no alcanzaba.

**Con dos salvedades que no maquillo:**

- **Un solo caso llegó a `COMPLETA`** de los cuatro. Los otros tres eran documentos pobres o
  proveedores sin historial. Es un resultado honesto, no un fracaso: el sistema **dijo la
  verdad** sobre lo que no sabía en los cuatro.
- **83% se logró con un proveedor con 8 compras previas.** Con un proveedor nuevo, el intake
  aporta mucho menos. El valor **crece con el histórico**.

---

## 14. SIGUIENTE DECISIÓN

# TODAVÍA NO PASAR A WHATSAPP.

La evidencia dice que el Intake Core funciona, **pero le falta una pieza antes del transporte**:

**Distinguir compra de gasto.** El caso A (Edesur) entró como si fuera una compra de
mercadería. Esa distinción ya es regla del negocio y el intake la ignora. Mandarlo a WhatsApp
así significa que Freddy va a poder cargar la factura de la luz como mercadería, **y va a
contaminar el catálogo y el motor de alertas de precio.**

**Recomendación:** un Slice 1b corto —clasificar compra vs gasto, reusando las categorías que
ya existen— y **recién ahí** WhatsApp, que a esa altura es solo cambiar el adaptador.

**Lo que sí quedó demostrado:** la separación canal/lógica funciona. El adaptador de WhatsApp
no va a tener que reimplementar nada: va a consumir el mismo `core.js` y renderizar las mismas
preguntas como botones.
