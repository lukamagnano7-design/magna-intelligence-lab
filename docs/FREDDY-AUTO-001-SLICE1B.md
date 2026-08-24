# FREDDY-AUTO-001 · Slice 1b — Liberar el conocimiento atrapado

> No se construyó un clasificador. Se puso en un lugar consultable el conocimiento que
> Claude ya usaba bien en el cierre manual.

**Preflight ejecutado · backup verificado · las 9 condiciones respetadas.**

---

## LA PRUEBA — el caso que originó el slice

```
EDESUR (factura de luz)
  ✓ proveedor   EDESUR    identidad:canonical_name        HIGH
  ✓ destino     GASTO     clase_contraparte:servicio      HIGH

LA PAULINA (factura de mercadería)
  ✓ proveedor   LA PAULINA   identidad:cuit               HIGH
  ✓ destino     COMPRA       clase_contraparte:mercaderia HIGH
```

**Sin clasificador y sin hardcodear `EDESUR = GASTO`.** El intake *leyó* el conocimiento que
ya existía. La misma fuente que va a usar el cierre y, mañana, WhatsApp.

---

## QUÉ SE HIZO

**1 · `clase_contraparte`** — columna nueva en `supplier_identities`. **`tipo` no se tocó.**

**2 · Poblada solo con evidencia:**

| Clase | n | De dónde salió |
|---|---|---|
| `mercaderia` | 29 | tienen compras reales |
| `socio` | 2 | prosa canónica: *"Fredy/Gustavo=socios"* |
| `servicio` | 1 | prosa canónica: *"Edesur=servicio"* |
| `facturadora` | 1 | `rules/proveedores.md`: Master Meat factura por Cristian |
| `insumos` | 1 | Valeriano = papelería (promovido de auto-memory) |
| **`NULL`** | **22** | **no hay evidencia. Es honesto, no es deuda** |

**3 · Conocimiento promovido a memoria canónica** — `rules/proveedores_canonicos.md`:
Besutti (contador → `honorarios`) y Valeriano (papelería → `insumos`) estaban **solo** en la
auto-memory privada de Claude. Ahora son canónicos.

⚠️ **Besutti no tiene identidad en `supplier_identities` y no se la creé.** Crear una identidad
es un alta, no una promoción de conocimiento. Queda anotado como pendiente.

**4 · Vocabulario de categorías de gasto** (`intake/categorias_gasto.json`), derivado de las 15
que ya se usaron. **Los 29 gastos históricos NO se reescribieron** — hay un mapa de alias para
leer las variantes viejas sin perder el valor original.

**5 · El Intake Core lo consulta.** Una query, no un clasificador.

---

## LOS ARNESES HICIERON SU TRABAJO — dos veces

**Primera:** agregué la columna y **M4 falló** — *"columnas que existen y el plano NO declara"*.
Actualicé `create_schema.js`.

**Segunda, y mejor:** al declararla puse un `CHECK` con el vocabulario. **M4 volvió a fallar:**

> *"CANDADO QUE NO EXISTE — el plano declara check(...) y la tabla real no lo tiene.
> Un valor inválido entra sin que nada avise."*

Tenía razón: **SQLite no permite agregar un `CHECK` con `ALTER TABLE ADD COLUMN`.** Yo estaba
declarando una protección que no existía — que es **literalmente el bug del que M4 nació.**

Saqué el CHECK del plano (mejor no tener el candado que fingirlo), el vocabulario se valida en
código, y quedó anotado que para tenerlo de verdad hay que reconstruir la tabla, lo que pide su
propio backup y OK.

**SCORE: 13/13 restaurado.**

---

## HALLAZGO IMPORTANTE — `tipo` fue diseñada para esto

Al actualizar el plano encontré, en `create_schema.js:151`:

```sql
tipo TEXT CHECK(tipo IN ('mercaderia','servicio','socio','facturadora','cobradora','fiscal'))
```

**`tipo` fue diseñada exactamente para lo que construí `clase_contraparte`.** Mismo
vocabulario, mismo propósito. El diseñador original lo tenía bien.

Lo que se desvió fue **`server.js:74`**, que la lee y la expone en la app como `iva`. Y como
`alta.js` la escribe siempre con el default `"mercaderia"`, la columna quedó inservible y nadie
lo notó.

**No la toqué porque me lo indicaste explícitamente, y la instrucción sigue siendo correcta
para hoy** — tocarla rompe la app. Pero el diagnóstico cambia: no son "dos columnas para lo
mismo", es **una columna secuestrada y una de reemplazo**.

**Queda como deuda declarada** en el plano: o `tipo` vuelve a su propósito y `clase_contraparte`
se elimina, o al revés. **Es tu decisión, no mía**, y no es urgente.

---

## INVARIANTES — todo intacto

```
compras           226  ✓        dias               84  ✓
gastos             29  ✓        compras_items     737  ✓
tipo    [{"mercaderia": 56}]  INTACTO
arneses 13/13  ·  validate_db PASS (92 checks, 0 warns)  ·  tests 18/18
```

**Backup:** `magna.db.bak_pre_slice1b_20260824` (1,7 MB) — verificado abriéndolo y contando
adentro antes de escribir. **Cierres históricos sin tocar. Banco sin tocar. Proposal mode.**

---

## Un test que se arregló solo por el camino

Dos tests fallaron al agregar `destino`, porque decían `6` hardcodeado. **Lo que probaban
seguía siendo correcto.** Los cambié para que deriven de `CAMPOS`:

> Un test que se rompe al agregar un campo válido no protege nada: solo hace ruido y entrena
> a ignorarlo.

---

## VEREDICTO

# VALIDATED

La hipótesis era: *¿podemos hacer reutilizable y determinista el conocimiento que Claude ya
usa bien en el cierre manual?*

**Sí.** Edesur → GASTO y La Paulina → COMPRA, ambas con `HIGH`, leyendo una fuente única, sin
inferencia nueva y sin una sola regla hardcodeada.

**Con dos salvedades honestas:**

- **22 de 56 identidades siguen sin clasificar.** Se pueblan cuando aparezca evidencia o
  cuando alguien las responda. El sistema **pregunta** en vez de suponer.
- **La cobertura del intake bajó de 83% a 71%** en el caso La Paulina — porque agregué un campo
  requerido. **Bajó el porcentaje y subió la utilidad**: ahora el registro dice si es compra o
  gasto, que antes ni se preguntaba. Es un buen recordatorio de que el `auto-resolution rate`
  no puede leerse solo.

---

## ¿LISTOS PARA WHATSAPP?

# SÍ, con una condición chica.

El bloqueante que levanté en el Slice 1 —*"Freddy podría cargar la factura de la luz como
mercadería"*— **está resuelto**: el intake ahora lo distingue solo.

**La condición:** hoy, cuando la contraparte es `socio` o `facturadora`, el intake registra una
incidencia (*"esto va a tesorería, no a gasto"*) pero **no tiene un camino para eso**. Con la
consola no importa, porque yo estoy leyendo. **Por WhatsApp, Freddy va a mandar una factura de
Master Meat y el sistema le va a decir algo que él no sabe qué hacer con eso.**

No hace falta resolverlo antes de empezar WhatsApp — pero sí antes de que Freddy lo use solo.

**Lo demás está listo.** La separación canal/lógica se probó: `core.js` no cambió su interfaz al
agregar `destino`, y el adaptador de WhatsApp va a renderizar `["COMPRA","GASTO"]` como botones
sin tocar una línea del core.
