# Slice 1b — revisión del plan tras la evidencia del dueño

> Luka: *"ya existe conocimiento capaz de reconocer muchos tipos de documentos y contrapartes.
> Edesur ya es reconocida como servicio. El contador ya está identificado."*

**Tenía razón. El conocimiento existe.** Y encontrarlo cambió el plan por completo:
**no hay que construir un clasificador.**

---

## KNOWLEDGE TRAPPED IN SESSION — CONFIRMADO

El conocimiento existe, pero **en tres capas distintas, ninguna consultable por código**.

### Capa 1 — Atrapado en prosa

`memory/rules/proveedores_canonicos.md` dice, textual:

> *"(No-proveedores: **Edesur=servicio**, Fredy/Gustavo=socios; "Lope de Vega"=dirección.)"*

**La regla existe.** Pero vive **entre paréntesis, dentro de un párrafo de markdown**, al final
de una sección sobre otra cosa. Un agente que lee el archivo la usa. **Ninguna función puede
consultarla.**

### Capa 2 — Contradicho por la base

`supplier_identities` **tiene una columna `tipo`**. Es exactamente el lugar correcto.

```
supplier_identities.tipo:   mercaderia → 56 filas
                            (no hay ningún otro valor)

EDESUR  →  tipo = 'mercaderia'
```

**Las 56 identidades dicen lo mismo, así que la columna no distingue nada.** Y peor: **la base
afirma que Edesur es mercadería**, que es lo contrario de lo que dice la memoria canónica.

Si el Intake Core hubiera consultado `supplier_identities.tipo` —que era lo correcto—
habría clasificado Edesur como mercadería **con toda la confianza del mundo**.

### Capa 3 — Atrapado en la auto-memory de Claude

El contador (**Besutti**) **no aparece** en `memory/rules/`, ni en `workflows/`, ni en
`known_errors.md`, ni en `magna.db`.

Aparece **solo** en `reference_entidades_besutti_valeriano_coproalsa.md`, dentro de la
auto-memory privada de Claude — que el propio `CLAUDE.md` define como *"apoyo / espejo / cache,
**NO** fuente canónica"*.

**Ese conocimiento se pierde con la sesión y ningún código puede leerlo.**

---

## Y un cuarto hallazgo: las categorías son texto libre

```
29 gastos  ·  15 categorías distintas  ·  ninguna tabla de categorías
```

Casi una categoría por gasto. Y hay duplicados semánticos:

| | |
|---|---|
| `Papelería / Embalaje` | vs `Papeleria y embalaje` |
| `Insumos / Papeleria` | vs `Papelería / Embalaje` |
| `Servicios / WiFi` | vs `Servicios / Internet-Telefonia` |

**Es el mismo bug que ya resolvieron para proveedores** (`normProvKey`, tras partir la deuda de
"CRISTIAN" y "CRISTIAN ") — pero nunca se aplicó a las categorías de gasto. Claude inventa la
categoría cada sesión desde el contexto, y aterriza como texto libre.

La forma **sí** es consistente (`FAMILIA / detalle`): Servicios · Insumos · Limpieza ·
Honorarios · Papelería · Impuestos · Seguros. **El vocabulario ya está: falta declararlo.**

---

## EL PLAN CAMBIA

**Antes (lo que iba a hacer):**
```
construir un clasificador compra/gasto para el Intake
```

**Ahora:**
```
PONER EN UN LUGAR CONSULTABLE el conocimiento que Claude ya usa bien,
y que el Intake lo LEA — igual que lee supplier_identities para el proveedor.
```

Ninguna inferencia nueva. **Es liberar conocimiento, no crear conocimiento.**

### Los cuatro pasos, por orden de reutilización

**1. ~~Poblar `supplier_identities.tipo`~~ → NO. Ver la corrección de abajo.**
Era el paso obvio y **está mal**. Hay que agregar una columna nueva y dedicada
(`clase_contraparte`), porque `tipo` ya tiene dueño. El razonamiento está en la sección
"Corrección" al final: es el hallazgo más importante de esta revisión.

**2. Declarar el vocabulario de categorías de gasto.**
Derivado de las 15 que ya se usaron, colapsando los duplicados. No inventado.

**3. Promover el conocimiento atrapado en auto-memory a canónico.**
Besutti (contador), Valeriano (papelería) y los demás: de la memoria privada de Claude a
`supplier_identities` + regla canónica. **Ese es el paso que convierte memoria de sesión en
activo de la empresa.**

**4. Que el Intake Core lea `tipo`** — igual que ya lee `canonical_name`. Una línea, no un
clasificador.

### Y solo si queda un hueco

Recién ahí, para una contraparte **verdaderamente nueva**, preguntar — con las mismas opciones
que después serían botones. Como ya hace con `estado_pago`.

---

## Por qué esto importa más que el Slice

El test de Edesur iba a pasar igual de las dos formas. La diferencia es cuál queda después:

| Hardcodear `EDESUR = GASTO` | Poblar `supplier_identities.tipo` |
|---|---|
| Sirve para Edesur | Sirve para las 56 identidades |
| Solo para el Intake | Para el cierre, el Intake y WhatsApp |
| Se desincroniza de la memoria | **Es** la memoria, consultable |
| Otra fuente de verdad más | Una sola fuente |

**El objetivo era: una misma fuente de conocimiento → cierre + Intake Core + futuro WhatsApp.**
Ese lugar ya existe, se llama `supplier_identities.tipo`, y está sin poblar.

---

## CORRECCIÓN — `tipo` ya tiene dueño, y son dos

Escribí el plan de arriba y **después fui a ver quién lee esa columna**. Menos mal.

```js
// alta.js:212  — ESCRIBE
INSERT INTO supplier_identities (..., tipo, ...)
   VALUES (..., a.p.tipo || "mercaderia", ...)      ← categoría de negocio

// server.js:74 — LEE
.map(r => ({ proveedor: r.canonical_name, ..., iva: r.tipo }))   ← ¡condición fiscal!
```

**Dos partes del mismo sistema le dan significados distintos a la misma columna.**
`alta.js` la usa como *"qué me vende"*. `server.js` la expone en la app como **`iva`**, que es
*"cómo factura"*. Son cosas que no tienen nada que ver.

Las 56 filas dicen `mercaderia` solo porque `alta.js` lo pone por default y **nadie la seteó
nunca a propósito**. Por eso no distingue nada.

### Qué habría pasado si seguía mi plan

Poblaba `tipo` con `servicio` / `honorarios` / `impuestos`, y **la app se los mostraba a Luka
en la columna de condición de IVA.** Un bug visible, en producción, introducido por el paso
que parecía más obvio y más barato.

### El plan corregido

- **No tocar `tipo`.** Queda como está hasta que Luka decida qué significa (y probablemente
  haya que separar las dos cosas de todos modos: hoy no guarda bien ninguna).
- **Agregar `clase_contraparte`**, una columna nueva con un solo significado:
  `mercaderia` · `servicio` · `honorarios` · `insumos` · `impuestos` · `socio` · `no_proveedor`.
- Poblarla desde la prosa que **ya es canónica**, empezando por Edesur.

Sigue siendo reutilizar conocimiento existente. Solo que en un campo que no esté ya ocupado.

### La lección, que vale más que el slice

**No alcanza con ver quién escribe un campo: hay que ver quién lo lee.** Un campo con dos
significados es peor que un campo vacío — el vacío se nota, la ambigüedad no.

Y es la misma clase de problema que el resto de esta revisión: **conocimiento sin un lugar
declarado termina en el lugar equivocado.**

---

## Estado

**No implementé nada.** Esto es la revisión del plan que pediste antes de escribir código.

El Slice 1b pasa de *"construir un clasificador"* a *"liberar conocimiento ya existente"* —
que es más barato, más útil y beneficia al cierre manual de hoy, no solo al Intake.

**Falta tu OK**, porque los pasos 1 y 3 escriben en fuentes de verdad
(`supplier_identities` y la memoria canónica), y eso requiere Preflight + backup + tu
aprobación.
