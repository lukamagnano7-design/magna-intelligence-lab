# MAGNA AI BRIDGE — evaluación antes de construir

> ¿Vale la pena un puente automático Claude ↔ GPT por API, hoy?

**Veredicto: `TEST_CHEAPLY`** — pero no el test que parece. Ver abajo.

---

## Antes que nada: lo que NO pude verificar

**No pude leer los precios oficiales de OpenAI.** Sus páginas de pricing son JavaScript y no
devuelven contenido. No voy a inventar cifras precisas.

Lo que sí puedo hacer es acotar el orden de magnitud, y adelanto la conclusión:
**el precio no es la variable que decide.** La frecuencia sí.

---

## 1. FLUJO ACTUAL (medido, no estimado)

Repasando los 8 días de este proyecto, los intercambios Claude ↔ ChatGPT fueron:

| Cuándo | Qué |
|---|---|
| 17/08 | Luka pega la conversación de diseño |
| 17/08 | El starter zip |
| 23/08 | ChatGPT intenta leer el repo — **falla el conector** |
| 24/08 | Revisión conjunta del research |

**≈ 4 intercambios en 8 días.** Y hay un dato que duele:

> **El puente que ya construimos nunca funcionó de punta a punta.**
> ChatGPT **jamás llegó a leer el repo**. Su único intento falló por el conector, y después
> de que lo hice público **nunca se confirmó que funcionara**.

Estamos evaluando construir un puente caro para reemplazar uno gratis **que nunca probamos.**

---

## 2. TIEMPO HUMANO

| | |
|---|---|
| Intercambios/mes | **12–18** (extrapolando 4 en 8 días) |
| Minutos por intercambio | 2–4 (copiar, pegar, esperar, volver) |
| **Total** | **30–60 min/mes** |

Con una salvedad que juega a favor del puente: **el costo real no son los minutos, son las
consultas que NO ocurren** porque da pereza. La fricción suprime uso, y eso no se mide en el
reloj.

Pero ojo, ese argumento justifica cualquier cosa si uno lo deja suelto.

---

## 3. ARQUITECTURA MÍNIMA

```
node puente.js "<pregunta>"
   ↓  arma el request: pregunta + SOLO los docs relevantes
   ↓  POST a la API
   ↓  guarda request + respuesta en el repo, versionado
   ↓  yo la leo
```

Un archivo. Sin servicio, sin cola, sin orquestador. **~150 líneas.**

---

## 4–5. COSTO (orden de magnitud, no cifra exacta)

Tamaños reales medidos en el repo:

| | tokens aprox. |
|---|---|
| **Todos** los docs | ~16.000 |
| Todo el código | ~17.500 |
| **Contexto selectivo** (pregunta + 2–3 docs) | **2.000–4.000** |

Mandar el repo entero en cada llamada costaría ~4× más y **empeoraría la respuesta**: enterrar
la pregunta en 16k tokens de contexto irrelevante es la forma más común de obtener una
respuesta genérica.

Con contexto selectivo (~4k in / ~2k out) y precios de modelo frontier, una consulta cae en el
orden de **centavos de dólar**.

| Escenario | Consultas/mes | Costo mensual estimado |
|---|---|---|
| Bajo | 10 | **< USD 1** |
| Normal | 20 | **~USD 2–4** |
| Alto | 60 | **~USD 10** |

**El costo es irrelevante para esta decisión.** Ni siquiera hace falta el precio exacto: aunque
me equivoque por 3×, sigue siendo insignificante contra lo que ya se gasta en OCR.

**Y no todo necesita el modelo caro:** una pregunta de routing puede ir a un modelo barato; una
decisión de arquitectura, al bueno. Eso baja más el número — pero el número ya no importa.

---

## 6. VALOR HOY

- Ahorra **30–60 min/mes** y unas 15 interrupciones
- **Trazabilidad real**: cada consulta y su respuesta quedan versionadas. Hoy las opiniones de
  ChatGPT viven en su chat y se pierden. Esto sí es una mejora concreta y permanente
- Elimina el error de transcripción (pegar de menos, pegar viejo)

**Modesto. Real, pero modesto.**

---

## 7. VALOR FUTURO (separado a propósito)

Es el argumento fuerte, y por eso hay que tenerle cuidado:

- Es **la primera pieza de agente-a-agente sin humano**, que es la visión desde el prompt uno
- Habilita paneles de jueces, verificación adversarial cruzada, segunda opinión automática

**Pero no justifica construirlo hoy por sí solo.** Lo dijiste vos y tenés razón.

---

## 8. RIESGOS

**El que más me preocupa no es técnico.**

**ChatGPT por API ≠ tu ChatGPT.** No tiene la memoria de sus conversaciones con vos. Y buena
parte del valor que aportó en este proyecto vino justamente de ahí: conoce tu visión, tu
negocio, cómo pensás. Por API arranca sabiendo lo que le mandemos.

**El puente no reemplaza a tu ChatGPT: agrega un segundo interlocutor más limpio y con menos
historia.** Si lo construimos creyendo que es lo mismo, vamos a decepcionarnos.

**Seguridad:**
- **API key en disco** — igual que la de Anthropic que ya usa el OCR. Riesgo conocido y aceptado
- **El repo es público.** Todo lo que el puente escriba ahí queda a la vista de cualquiera
- **Política obligatoria si se construye:** el puente manda documentos de `docs/`, **nunca**
  `magna.db`, ni extractos, ni facturas, ni datos de proveedores, ni nada de clientes. Ni
  automáticamente ni a pedido

**Nuevo punto de falla:** si la API se cae o la key vence, hay que poder volver a copiar y
pegar sin drama. El fallback manual no se negocia.

---

## 9. COMPLEJIDAD

Baja: ~150 líneas, sin dependencias, dos o tres horas. **El mantenimiento es el costo real** —
cambios de API, modelos que se deprecan, la key.

---

## 10. RECOMENDACIÓN

# TEST_CHEAPLY

Pero **el test barato NO es una llamada a la API.** Es este:

> **Probar el puente que ya existe y nunca usamos.**
> Decirle a ChatGPT: *"leé https://github.com/lukamagnano7-design/magna-intelligence-lab y
> dame tu veredicto sobre `docs/FREDDY-AUTO-001-SLICE1B-PLAN.md`"*.
> Costo: **USD 0**. Tiempo: **5 minutos**.

**Por qué esto primero:** estaríamos por construir un puente pago para reemplazar un
copy/paste que, en la práctica, **nunca dejamos de hacer porque el puente gratis nunca se
verificó**. Si el repo público funciona, el copy/paste ya baja a una línea por vuelta y el
ahorro del puente pago cae de 45 min/mes a bastante menos.

Y si **no** funciona, ahí sí tenemos evidencia dura de que hace falta la API — en vez de la
sospecha de que haría falta.

### Qué me haría cambiar a `BUILD_NOW`

- Que los intercambios pasen de **~4 por semana a varios por día** (por ejemplo, si adoptamos
  verificación cruzada por default en cada decisión)
- Que el conector de ChatGPT siga sin funcionar después del test
- Que quieras que un agente consulte a GPT **sin vos presente** — ahí el puente deja de ser
  comodidad y pasa a ser requisito

### Si igual querés el test con API

Una sola llamada, real, comparable:

1. Una pregunta que ya hicimos: *"¿coincidís con no tocar `supplier_identities.tipo`?"*
2. Contexto: solo `SLICE1B-PLAN.md` (~1.500 tokens)
3. Medir tokens, costo y latencia reales
4. **Comparar la respuesta contra la que da tu ChatGPT con la misma pregunta**

Ese cuarto punto es el que importa: si la respuesta por API es notoriamente peor por no tener
la historia con vos, el puente resuelve el transporte y **rompe el valor**.

---

## Mi lectura, sin vueltas

**El cuello de botella que describiste es real, pero es el más chico de los que tenés.**

45 minutos al mes de copiar y pegar, contra un sistema que todavía necesita que vos leas cada
factura y armes el plan del día a mano. **Freddy te come más tiempo en un solo cierre que
ChatGPT en todo el mes.**

Construir el puente ahora no sería un error caro — es barato y es la semilla de algo que sí
querés. Pero **no es donde está tu tiempo**, y vos mismo pusiste la regla: *no agregamos una
capacidad porque sea interesante, sino cuando un problema real la exige.*

Este problema todavía no la exige.
