# MAGNA-AUTOS-001 · Discovery del departamento Autos

> Entender el funcionamiento **real** de la agencia y cruzarlo contra lo que Magna OS ya
> tiene, **antes** de decidir qué es determinista, qué es automatización, qué es integración
> y qué necesita razonamiento.
>
> **No se implementa nada.** Ni código, ni agentes, ni Paperclip, ni WhatsApp.

**Fecha de apertura:** 25/08/2026
**Base:** auditoría read-only de `MagnaOS-Familiar/magna-app` (`MAGNA-ORG-002` §C) +
`Department Contract V1` + tareas descriptas por Luka

---

## LA REGLA DEL CUESTIONARIO

**No preguntar lo que el código ya responde.**

Es la misma disciplina que en Freddy costó `KE#70` y `KE#73`: *"ALEJANDRO BEBIDAS → NUEVO"*
cuando estaba escrito en la línea 121 de un archivo. Preguntar algo que ya está cargado
quema el tiempo de Luka y le enseña al sistema que la memoria no sirve.

Por eso **cada pregunta de este documento viene con un bloque `YA SÉ`**: lo que la auditoría
ya estableció. Luka solo completa el hueco.

Y su inversa, igual de importante: **si algo no se puede responder leyendo código, no se
infiere.** Se pregunta o se declara desconocido.

---

## MAPA DE BLOQUES

Cortos y secuenciales, para iterar. **No se manda el cuestionario entero.**

| Bloque | Tema | Cubre del encargo | Estado |
|---|---|---|---|
| **B1** | **Compra de una unidad** — origen, decisión, precio, forma de pago | 1, 12 (parcial), 16 (parcial) | 🔵 **ABIERTO** |
| B2 | Preparación y puesta a punto — qué se arregla, qué se recupera | 2 | ⚪ |
| B3 | Publicación y pricing — dónde se publica, cómo se fija el precio | 2, 10 | ⚪ |
| B4 | Leads — WhatsApp y ML, qué se responde y cuándo escala | 3, 13 | ⚪ |
| B5 | Venta y negociación — de la consulta a la seña | 4 | ⚪ |
| B6 | Crédito y financiación — cuándo, con quién, cómo se deriva | 5 | ⚪ |
| B7 | Documentación y transferencia | 6, 7 | ⚪ |
| B8 | Cobro, pago y saldos pendientes | 8, 13 | ⚪ |
| B9 | Stock, rotación y capital inmovilizado | 10, 16 | ⚪ |
| B10 | Reventas, red y compartir stock | 11, 12 | ⚪ |
| B11 | Administración repetitiva y errores frecuentes | 13, 15 | ⚪ |
| B12 | Decisiones que hoy solo puede tomar Luka o su padre | 14 | ⚪ |
| B13 | Postventa | 9 | ⚪ |

**Un bloque por vez.** Cada uno cierra con lo que se aprendió y qué se corrige del mapa.

---

## LO QUE LA AUDITORÍA YA ESTABLECIÓ

Para no repetirlo en cada bloque.

**Datos que existen en `vehiculos`:**
`marca` · `modelo` · `anio` · `tipo`(usado/0km) · `patente` · `nro_chasis` · `nro_motor` ·
`registro` · `color` · `descripcion` · `segmento` · `estado` · `moneda` · `costo_compra` ·
`precio_venta` · `margen_esperado` · **`fecha_ingreso`** · `deuda_patente` ·
`deuda_infracciones` · `tramites`(jsonb) · `deudas` · `verif_policial_estado` ·
`verif_policial_fecha` · `pct_ganancia_consignacion` · `ml_permalink` · `ml_atributos` ·
`links_publicaciones` · `notas` · `negocio_id`

**Estados:** `en_stock` · `proximo_ingresar` · `consignacion` · `senado` · `vendido`
**PROPIO** = `en_stock` + `proximo_ingresar` + `senado`

**Operaciones:** `tipo`(compra/permuta) · `naturaleza` · `modalidad` · `tipo_cambio` ·
`tasa_interes` + `operacion_items` + `operacion_detalles` ("detalles del usado")

**Reglas ya codificadas** (viven en comentarios, no en un corpus — gap C3):
- *Costo neto = Σ ítems **positivos** + Σ costos de detalles del usado.*
- *La seña y las cancelaciones se cargan en negativo pero son **cómo lo pagué**: **no bajan el
  costo**.* (auto de 10, seña 5 + cancelo 4 + cancelo 1 → el costo sigue siendo 10)
- *Se consolida a la moneda del auto con el TC de la operación; **si falta un TC sano, no
  inventa**.*
- *El stock se valúa **siempre a precio de venta**; el costo solo como respaldo.*

**KPIs que ya muestra:** Stock total · Propio · Señados · Consignación · Vendidos ·
Costo del stock · Precio de venta del stock · Margen esperado · En consignación ·
**Ganancia realizada**

**Integraciones vivas:** MercadoLibre (`/api/ml/import`, `/ml/refresh`, `/ml/exchange`) ·
dólar · clima

**Lo que NO existe** (verificado): ningún KPI de **tiempo** — `AutosDashboard.tsx` tiene 672
líneas y no menciona días ni antigüedad. Tampoco existe campo de **procedencia/origen** de la
unidad, ni tests, ni corpus de reglas, ni `known_errors`.

---

## PRINCIPIOS DE DOMINIO YA DECIDIDOS

No se re-discuten en Discovery; se usan como marco.

1. **`dias_en_stock` no tiene umbral todavía.** No se fija 30/60/90 arbitrariamente. La
   política se deriva combinando: días · capital invertido · margen esperado · consultas ·
   vistas/conversión (cuando ML lo permita) · precio · tipo de vehículo · propio vs
   consignación · costos de tenencia.

2. **PROPIO y CONSIGNACIÓN no tienen el mismo riesgo.**

   | | Envejecimiento comercial | Capital inmovilizado |
   |---|---|---|
   | **Propio** | ✅ | ✅ |
   | **Consignación** | ✅ | ❌ |

   Una unidad en consignación que no rota cuesta **reputación, espacio y atención**; no cuesta
   plata de Luka o su padre. **Son dos alertas distintas, no una con un filtro.**

3. **El KPI principal de Autos no está fijado.** *Ganancia realizada* y *rotación* miden cosas
   distintas. Se define con datos y reglas reales.

4. **No se asume que cada tarea necesita un agente.** La clasificación D / A / I / AI / S / H
   y el nivel L0–L3 se hacen **después** del Discovery, no antes.

---

# 🔵 BLOQUE 1 — LA COMPRA DE UNA UNIDAD

**Por qué este bloque primero:** todo lo de abajo depende de acá. El costo, el margen
esperado, el capital inmovilizado y la fecha que dispara la rotación **nacen en la compra**.
Y es el bloque donde el código ya me dio más para no preguntar de más.

**Formato:** respondé como te salga — texto corrido, audio, o salteando lo que no aplique.
Si algo varía según el caso, decí *"depende"* y de qué depende: eso también es la respuesta.

---

### 1.1 · ¿De dónde salen las unidades?

> **YA SÉ:** hay un estado `proximo_ingresar`, y `consignacion` es un estado propio. **No hay
> ningún campo de procedencia u origen** en `vehiculos`. Vos mencionaste *"procedencia de
> unidades"* como una tarea real, así que el dato importa y hoy no tiene dónde vivir.

**Preguntas:**
- ¿Cuáles son las vías por las que entra una unidad? (particular, otra agencia, remate,
  permuta de un cliente, consignación, red de contactos…)
- ¿Cuántas de cada tipo, más o menos, en un mes normal?
- ¿Cambia algo del proceso según de dónde viene? ¿Qué?

---

### 1.2 · ¿Cómo se decide comprar?

> **YA SÉ:** existe `margen_esperado` como campo, así que hay una expectativa de margen desde
> el momento de la compra.

**Preguntas:**
- Cuando aparece una unidad, ¿qué mirás para decidir si conviene?
- ¿Hay un número mínimo (margen, porcentaje, plata) por debajo del cual no comprás?
- ¿Cuánto tarda esa decisión? ¿Es en el momento o se piensa?
- ¿La tomás vos, tu padre, o los dos?

---

### 1.3 · El precio de compra

> **YA SÉ:** el costo se arma con los ítems positivos de la operación más los "detalles del
> usado", **y la seña o las cancelaciones no lo bajan** — eso ya está resuelto en código.

**Preguntas:**
- ¿Contra qué comparás para saber si el precio pedido está bien? (ML, guía oficial, lo que
  pagaste por uno igual, el olfato…)
- ¿Existe una lista o referencia que consultás? ¿Dónde vive?
- ¿Qué pasa cuando es un modelo que nunca tuviste?

---

### 1.4 · Cómo se paga

> **YA SÉ:** hay `tipo_cambio` en la operación y `moneda` en el vehículo — un auto se puede
> **vender en una moneda y pagar en otra**, y el sistema ya lo contempla.

**Preguntas:**
- ¿Cuáles son las formas de pago habituales? (contado, parte en dólares, permuta, en cuotas
  al que te lo vendió…)
- ¿Se paga todo junto o hay seña y saldo? ¿Cuánto suele tardar entre una cosa y la otra?
- ¿De qué cuenta o caja sale la plata? ¿Se registra en algún lado además de la operación?

---

### 1.5 · Qué se revisa antes de cerrar

> **YA SÉ:** existen `deuda_patente`, `deuda_infracciones`, `verif_policial_estado` /
> `verif_policial_fecha`, `tramites` (jsonb) y una tabla `documento_checklist`. Hay un
> checklist, pero no sé si se completa siempre ni en qué momento.

**Preguntas:**
- ¿Qué chequeás **sí o sí** antes de cerrar una compra?
- ¿Alguna vez compraste algo y apareció un problema después? ¿Qué era?
- ¿Ese checklist lo llenás en la app en el momento, después, o a veces no?

---

### 1.6 · El momento del ingreso

> **YA SÉ:** `fecha_ingreso` existe y está cargada. **No se usa en ningún KPI.** Es el dato
> del que va a colgar toda la rotación.

**Preguntas:**
- ¿Qué significa exactamente esa fecha: cuándo cerraste el trato, cuándo llegó físicamente,
  o cuándo quedó lista para vender?
- Si son momentos distintos, **¿cuál es el que te importa para decir "esta unidad lleva X"?**
- ¿Cuánto suele pasar entre uno y otro?

---

### 1.7 · Qué se carga en el sistema y cuándo

**Preguntas:**
- Cuando comprás, ¿cargás el auto en Magna OS en el momento, al final del día, cuando llega?
- ¿Qué cargás **primero** y qué queda para después?
- ¿Hay algo que sepas pero que hoy **no tenga dónde cargarse**?

---

### 1.8 · Consignación

> **YA SÉ:** `consignacion` es un estado y existe `pct_ganancia_consignacion`. Ya quedó
> decidido que **no inmoviliza capital tuyo pero sí envejece comercialmente**.

**Preguntas:**
- ¿Cómo llega una consignación? ¿Quién la trae?
- ¿Qué le prometés al dueño? (plazo, precio mínimo, algo más)
- ¿Qué pasa si no se vende? ¿Hay una conversación en algún momento? ¿Cuándo?
- ¿La tratás distinto que un auto propio en el día a día? ¿En qué?

---

### 1.9 · Lo que sale mal

> **YA SÉ:** Autos **no tiene `known_errors`** — está vacío. En Freddy ese catálogo (74
> entradas) es lo que alimenta los candados. Acá arrancaría con lo que me cuentes.

**Preguntas:**
- ¿Qué es lo que **más veces** salió mal en una compra?
- ¿Hay algo que ya te pasó dos veces?
- ¿Algo que hoy te obliga a acordarte de memoria y preferirías que el sistema te avise?

---

### 1.10 · Quién más toca esto

**Preguntas:**
- ¿Alguien más además de vos y tu padre participa en una compra?
- ¿Hay algo de la compra que **no delegarías nunca**? ¿Por qué?

---

## AL CERRAR EL BLOQUE 1

Con las respuestas se produce:

1. **Ciclo de compra reconstruido** — pasos, decisiones, quién y en qué momento.
2. **Datos que existen y no tienen dónde vivir** (candidato: `procedencia`).
3. **Reglas de negocio que hoy están solo en tu cabeza** → primeras entradas del corpus de
   `knowledge` de Autos (gap C3).
4. **Primeras entradas de `known_errors`** de Autos (gap C5).
5. **Definición operativa de `fecha_ingreso`** — de qué momento habla, que es lo que habilita
   medir rotación sin inventar el criterio.
6. **Recién ahí:** clasificar cada función de este bloque como D / A / I / AI / S / H con su
   nivel L0–L3.

**Después del B1 se decide si sigue el B2 o si algo que apareció cambia el orden del mapa.**

---

## ESTADO

| | |
|---|---|
| **B1** | 🔵 abierto — esperando respuestas de Luka |
| **B2–B13** | ⚪ sin abrir |
| **Implementación** | ⛔ no corresponde todavía |

**No se implementó nada. No se creó ningún agente. No se instaló Paperclip. No se tocó
WhatsApp. Magna OS Familiar y Freddy OS quedaron sin modificar.**
