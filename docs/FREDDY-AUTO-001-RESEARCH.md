# FREDDY-AUTO-001 — Research dirigido por el problema

> Primera investigación externa del Lab disparada por un dolor empresarial real.
> **No se implementó nada. No se tocó Freddy OS.**

---

## A. PROBLEM RECORD ACTUALIZADO

La auditoría del 24/08 concluyó: *"Freddy OS resolvió el procesamiento, no la ingesta."*
Seguía siendo cierto, pero **incompleto**. La nueva evidencia del dueño mueve el problema
un paso más atrás:

**No es que Claude lea documentos a mano. Es que la información nace desestructurada.**

Freddy manda una factura y a veces escribe proveedor, blanco/negro, forma de pago y estado.
Y a veces manda solo la foto. O escribe el nombre distinto. O saca una foto mala.

Eso **no se arregla pidiéndole que sea más ordenado.** El sistema tiene que asumir que la
persona es inconsistente y convertir eso en datos confiables igual.

```
FREDDY-AUTO-001

A. CAPTURE / INTAKE     ← la capa nueva. Casi inexistente.
   La información nace manual y desestructurada, en WhatsApp.

B. PROCESSING           ← lo auditado. Mayormente construido.
   Cálculo, escritura, validación: completos y probados.
```

**Lo que NO cambió:** el mapa de la auditoría sigue vigente y se preserva.

```
CAPTURA       ░░░░░░░░░░   LECTURA      ███████░░░   CONCILIACIÓN ░░░░░░░░░░
CÁLCULO       ██████████   ESCRITURA    ██████████   VALIDACIÓN   ██████████
```

**Lo que cambió:** "captura" ya no es solo *bajar archivos de WhatsApp*. Es **estructurar la
información en el momento en que nace**.

---

## B. CAPABILITIES MAP

| Capacidad | Estado |
|---|---|
| `document_extraction` | **Existe y validada** (`ocr.js`, 97%, USD 0,79). Desconectada. |
| `structured_conversational_intake` | **Nueva. Es el corazón del problema.** |
| `confidence_based_confirmation` | **Nueva.** Preguntar solo lo que no se sabe. |
| `messaging_integration` | **Nueva.** Recibir y responder en WhatsApp. |
| `stateful_conversation` | **Nueva.** Una compra se completa en varios mensajes. |
| `incomplete_state_management` | **Nueva.** Un registro incompleto no entra al cierre. |
| `idempotent_ingestion` | **Nueva.** La misma factura dos veces = una compra. |
| `handwritten_document_understanding` | Parcial: `ocr.js` ya detecta `manuscrito`, nunca se probó sobre el parte. |
| `transaction_reconciliation` | Nueva. Fuera de este slice. |
| `bank_data_ingestion` | Fuera de este slice **a propósito** (credenciales). |

---

## C. EXISTING ASSETS — lo que se reutiliza tal cual

- **`ocr.js`** — Claude vision, structured outputs, **candado aritmético**, detecta
  `manuscrito` y `legible`, desglose fiscal. Ya devuelve un `confidence` implícito por campo.
  **Es la pieza central del intake, no un accesorio.**
- **`proveedor_recall.js` + `memoria_lookup.js` + `supplier_identities`** — resuelven
  proveedor por nombre, alias y CUIT. **Esto es literalmente "no preguntar lo que ya sabemos".**
- **`carga.js`** — escritura transaccional con backup verificado.
- **Los 14 arneses + `validate_db`** — los candados.
- **`arqueo_caja.js`** — el conteo físico que Luka quiere conservar.
- **73 known errors** — incluido #28 ("Lope de Vega" en un remito es la dirección de Freddy,
  no el proveedor). Un intake nuevo que no lea esto va a repetir errores ya resueltos.

**El intake no reemplaza nada de esto. Lo alimenta.**

---

## D. LAB SEARCH — qué encontró en nuestro propio contenido

**13 de los 60 items capturados son directamente relevantes.** El Lab había juntado material
sobre este problema **antes de que supiéramos que lo teníamos**:

- *Cómo Convertirte en Meta Tech Provider* → vía oficial
- *CRM con Claude Code + WhatsApp e Instagram (SIN verificación de Meta)* → Zernio
- *Crea un AGENTE IA de WHATSAPP con Claude Code + YCloud* → YCloud (BSP)
- *Agente de IA para WhatsApp en tu servidor (Claude Code + Coolify)*
- *El stack que uso para vender agentes de IA de whatsapp*

**Discovery obtenido sin salir a Internet:** las cuatro familias de arquitectura
(oficial · BSP · workaround sin verificación · self-hosted) salieron de contenido que ya
teníamos. Eso es exactamente para lo que se construyó el Tech Radar.

⚠️ **Y ninguno de esos videos es evidencia suficiente.** Son detectores. La evidencia vino
de las fuentes primarias, abajo — y una de ellas contradice frontalmente lo que promete uno
de los videos.

---

## E–F. EXTERNAL RESEARCH + VERIFICACIÓN DE FUENTE PRIMARIA

Todo verificado con petición real el 24/08/2026.

| Candidato | Fuente primaria | Verificado |
|---|---|---|
| **Meta WhatsApp Cloud API** | `developers.facebook.com/docs/whatsapp/cloud-api` | HTTP 200 |
| **Twilio WhatsApp** | `twilio.com/docs/whatsapp` | HTTP 200 |
| **YCloud (BSP)** | `ycloud.com` | HTTP 200 |
| **Baileys** (no oficial) | `github.com/WhiskeySockets/Baileys` | **10.833 stars · MIT · activo (push 23/08) · 338 issues** |
| **whatsapp-web.js** (no oficial) | `github.com/pedroslopez/whatsapp-web.js` | 200 (stats no obtenidas: redirect) |

### El hallazgo que cambia la decisión

Textual del **README de whatsapp-web.js**, su propia documentación:

> *"it is not guaranteed you will not be blocked by using this method. **WhatsApp does not
> allow bots or unofficial clients on their platform**, so this shouldn't be considered
> totally safe."*

La librería más popular para esto **dice en su propia doc que viola los términos de WhatsApp
y que te pueden bloquear**. Ningún Reel menciona eso.

Y el número de WhatsApp de Freddy **es el del negocio**. Un bloqueo no rompe un experimento:
rompe el canal por donde el negocio habla con proveedores y clientes.

### Y el hallazgo que la habilita

Verificado en la doc oficial de Meta: la Cloud API soporta de forma **nativa**
`interactive reply buttons` y `interactive list messages`.

**Eso es exactamente el `[BLANCO] [NEGRO]` que dibujó Luka.** No hay que construirlo: la
plataforma oficial ya lo da.

---

## G. OPCIONES (cuatro, no cuarenta)

**1 · Meta WhatsApp Cloud API (oficial, directa)**
Webhooks entrantes, botones y listas nativos, sin intermediario. Requiere verificación de
negocio y número dedicado.

**2 · BSP (Twilio / YCloud / 360dialog)**
La misma API, con onboarding más fácil y soporte. Se paga por mensaje y se depende de un
tercero.

**3 · No oficial (Baileys / whatsapp-web.js)**
Gratis, sin verificación, funciona con el número actual. **Contra los términos, con riesgo de
bloqueo declarado por la propia librería.**

**4 · Sin WhatsApp: una pantalla propia (PWA)**
Cero riesgo de términos, control total de la UX. Pero Freddy tiene que cambiar de hábito, y
el principio del proyecto es que el software se adapte a la persona.

---

## H. TRADEOFFS

| | Oficial | BSP | No oficial | PWA |
|---|---|---|---|---|
| Riesgo de bloqueo | ninguno | ninguno | **alto, declarado** | ninguno |
| Botones interactivos | nativo | nativo | frágil | total |
| Costo | por conversación | + margen del BSP | $0 | $0 |
| Setup | verificación de negocio | fácil | inmediato | medio |
| Número actual de Freddy | no | no | **sí** | n/a |
| Cambio de hábito | ninguno | ninguno | ninguno | **sí** |
| Sirve para clientes después | **sí** | sí | no | parcial |

---

## I. RECOMENDACIÓN DEL LAB

**El Lab NO recomienda elegir la arquitectura de WhatsApp todavía.** Y esa es la conclusión
más útil que puede dar hoy.

| Opción | Veredicto | Por qué |
|---|---|---|
| **No oficial (Baileys / wwebjs)** | **REJECT** | Su propia doc dice que viola los términos y que pueden bloquear. El número es el del negocio. El ahorro no paga ese riesgo. |
| **Meta Cloud API** | **TEST_NOW** *(pero después del slice 1)* | Es la única con botones nativos, sin riesgo de términos, y transfiere a clientes. |
| **BSP** | **WATCH** | Alternativa si la verificación de Meta se traba. Mismo modelo, con peaje. |
| **PWA propia** | **LATER** | Válida, pero contradice "el software se adapta a la persona". |

### Lo más importante que encontró esta investigación

**El cuello de botella real no es WhatsApp.** Es que **`ocr.js` está desconectado** y que
**no existe el concepto de "registro incompleto"**.

Si mañana tuviéramos WhatsApp resuelto y perfecto, la información entraría igual a un sistema
que **no sabe recibir una compra a medias**. Elegir transporte antes de tener destino es
construir el caño antes que el tanque.

---

## J. EXPERIMENT DESIGN — el primer slice real

**Corregido respecto de la hipótesis anterior. No es "conectar `ocr.js`" a secas.**

> **Slice 1 — El intake estructurado, sin WhatsApp.**
>
> Un comando que toma **una factura de la carpeta** y produce una **compra estructurada**:
> corre `ocr.js`, resuelve el proveedor con `proveedor_recall`/`supplier_identities`,
> y para cada campo que no puede resolver con confianza **pregunta en consola** con las
> mismas opciones que tendrían los botones. Emite un registro con
> `status: COMPLETA | INCOMPLETA` y **no escribe la base**.

**Por qué así:**

- **Prueba la hipótesis de negocio** (intake guiado + confidence-based) **sin apostar la
  arquitectura de WhatsApp.** La consola es un stand-in del canal.
- Si funciona, WhatsApp pasa a ser **solo el transporte**: mismas preguntas, mismos estados,
  botones en vez de consola. Si no funciona, nos ahorramos la verificación de Meta entera.
- **No toca dinero, ni banco, ni el número del negocio.**
- **Medible directo** contra el proceso de hoy.

**Segunda pieza del slice, igual de importante:** el estado `INCOMPLETA`. Hoy no existe. Sin
él, todo lo demás es cosmético — porque el sistema seguiría dejando pasar registros a medias.

---

## K. BASELINE

### Lo que SÍ se pudo reconstruir del histórico (datos reales)

| Métrica | Valor |
|---|---|
| Días cargados | **84** (01/06 → 23/08) |
| Compras registradas | **226** |
| Compras por día (promedio) | **3,2** sobre 71 días con compras |
| Ítems itemizados a mano | **737** |
| Documentos en disco | jun **78** · jul **76** · ago **64** ≈ **2,5/día** |

### Lo que NO se puede reconstruir honestamente

**Los minutos.** No hay registro de cuánto tarda cada cierre. Lo único que existe es
`OWNER_REPORTED_BASELINE` (10–30 min, ~50 min por 4 días), que es memoria del dueño, no
medición.

**No lo voy a inventar.**

### Qué medir hacia adelante, desde el próximo cierre

1. Minutos totales del cierre, de punta a punta
2. De esos, cuántos en **leer e interpretar documentos**
3. Cuántas veces hubo que **repreguntarle a Freddy** un dato faltante
4. Cuántos documentos llegaron **incompletos o ilegibles**
5. Cuántas **correcciones posteriores** hubo

Con 3 o 4 cierres medidos alcanza para un "antes" honesto. **Sin eso, el "después" no
significa nada.**

---

## L. RIESGOS

**Errores silenciosos — el peor escenario**
- Que cargue mal y nadie lo note. El **candado aritmético** de `ocr.js` es la defensa y no se
  negocia.
- Un intake que "completa" con lo más probable cuando no sabe **contamina la base con una
  confianza que no tiene**. Preferible `INCOMPLETA` que un dato inventado.

**Duplicados y replay**
- La misma factura por WhatsApp y por carpeta. Hoy lo evita que Luka archiva a mano.
- Mensajes fuera de orden: la foto llega, el contexto llega 10 minutos después — o nunca.
- **Necesita huella única del documento** desde el día uno.

**Seguridad**
- El número de WhatsApp **es el del negocio**. Un bloqueo no es un bug: es perder el canal.
- **Banco fuera del slice**, decisión sostenida: automatizar credenciales bancarias es el
  riesgo más alto del problema entero.
- Los documentos son información comercial: proveedores, precios, márgenes. Cualquier
  tercero en el camino los ve.

**Asociación incorrecta**
- Atribuir una factura al proveedor equivocado desordena deuda, costos y alertas de precio a
  la vez. Por eso `proveedor_recall` va **antes** de preguntar, y ya hay known errors por
  falsos nuevos (GRUPOLAR, BASLOG, "Lucas Bimbo").

---

## Nota de método

La hipótesis del sprint anterior ("conectar `ocr.js` al cierre") **no era incorrecta: era
incompleta**. La evidencia del dueño la corrigió antes de gastar una línea de código.

Eso es el Lab funcionando: **cambiar de hipótesis por evidencia nueva no es retroceder.**
