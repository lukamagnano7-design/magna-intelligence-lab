# El Matching Engine — cómo se decide si algo nos sirve

> Corrección de Luka (24/08/2026): *"NO quiero technology → keyword similarity → problem.
> Eso sería conceptualmente equivalente al bug `Polar → GRUPOLAR`."*

---

## La capa semántica

```
TECNOLOGÍA  →  CAPACIDADES  →  REQUISITOS DEL PROBLEMA  →  PROBLEMA
```

No se comparan palabras. Se comparan **capacidades**: lo que la tecnología *da* contra lo
que el problema *pide*. Es la única forma de que "Polar" no matchee con "GRUPOLAR".

La taxonomía (`seed/capabilities.json`) **salió de leer los problemas reales**, no al revés.
Cada capacidad existe porque un problema documentado la pide. Una capacidad sin demanda es
ontología prematura y no entra.

**Regla dura:** nunca agregar una capacidad para que una tecnología matchee. Eso es forzar
el match al revés.

---

## Los cuatro resultados posibles

| Resultado | Qué significa |
|---|---|
| **MATCH** | Cubre lo que el problema requiere. Viene con capacidades, argumento y confianza. |
| **NO_MATCH** | No resuelve nada nuestro. **Conclusión de negocio, no juicio técnico.** |
| **INSUFFICIENT_PROBLEM_DATA** | El problema no está lo bastante documentado. Se excluye. |
| **sin_base** | No sabemos qué hace la tecnología. **Distinto de NO_MATCH.** |

Los dos últimos son los que más se suelen confundir, y son los que más importan:

- *"No sé qué hace"* → no se puede opinar.
- *"Lo miré y no cubre nada nuestro"* → sí es una conclusión, y es valiosa.

---

## Las reglas que evitan matches falsos

Cada una tiene su test en `test/matcher.test.js`.

1. **Cubrir solo capacidades "útiles" NO alcanza.** Si el problema requiere `cap_b` y la
   tecnología aporta `cap_a` (útil), **no hay match**: el problema seguiría sin resolverse.
   Se registra la relación parcial, pero no se declara match.
2. **Una capacidad inferida no sostiene confianza HIGH.** Lo que salió de leer un README es
   una pista, no una verificación. Solo lo curado a mano puede sostener confianza alta.
3. **Un problema sin capacidades declaradas no matchea nunca.** `DIST-LOG-004` es un hueco de
   modelo de datos, no de tecnología: ninguna herramienta externa lo resuelve.
4. **Un problema mal documentado se excluye, no se puntúa.** Mejor un hueco declarado que un
   score fabricado. Además queda como la lista concreta de qué preguntarle al cliente.
5. **Cubrir parcialmente da relevancia < 10** y declara qué falta.

---

## Calidad técnica ≠ relevancia de negocio

Son dos ejes independientes y se informan por separado.

`anthropics/skills` tiene 171.000 estrellas y está activo — **calidad técnica alta**. Pero eso
no dice nada sobre si nos sirve. La relevancia se decide contra nuestros problemas, no contra
su popularidad.

Y al revés: un `NO_MATCH` **no desmerece** la herramienta. Stripe es excelente y no resuelve
ninguno de nuestros problemas documentados, porque nuestra taxonomía salió de distribución
mayorista y de workflow, no de cobros.

**Si de 100 tecnologías 70 no sirven, el Lab está funcionando bien.** El objetivo es filtrar,
no producir recomendaciones.

---

## Riesgo según el uso pretendido

`SIN LICENCIA → WATCH` era demasiado general. La ausencia de licencia pesa **muy distinto**
según qué se quiera hacer, y el Risk Agent no puede confundir cuatro cosas distintas:
estudiar una idea ≠ usar una herramienta internamente ≠ copiar código ≠ vendérselo a alguien.

Para un repo **sin licencia**, el mismo análisis da:

| Uso pretendido | Riesgo |
|---|---|
| Inspiración arquitectónica | BAJO |
| Referencia de aprendizaje | BAJO |
| Solo experimento (sandbox) | BAJO |
| Herramienta interna | MEDIO — zona gris |
| Reuso de código | MUY ALTO |
| Modificación de código | MUY ALTO |
| Integración al producto | MUY ALTO |
| Redistribución | MUY ALTO |

El uso pretendido **se deduce de dónde matcheó**: si pega contra problemas de nuestro workflow
es herramienta interna; si pega contra un producto que se le cobra a un cliente, es integración
al producto — y ahí el mismo repo pasa de MEDIO a MUY ALTO.

> ⚠️ **Esto no es asesoramiento legal.** Es un semáforo para saber cuándo conviene consultar a
> alguien que sepa. Cuando hay incertidumbre jurídica, el Lab lo dice; no la resuelve.

---

## Uso

```bash
node scripts/analizar.js <videoId>     # el pipeline completo sobre un contenido
node scripts/match.js "Stripe"         # cruzar una tecnología sola
node scripts/match.js --listar         # qué tecnologías hay en la base
node test/matcher.test.js              # los 16 tests anti-match-falso
```

---

## Lo que sigue dependiendo de juicio humano

- **Declarar las capacidades de una tecnología nueva.** El registro curado se escribe a mano.
  La inferencia por README existe pero vale menos, y así se informa.
- **Valorar severidad e impacto económico** de cada problema. Se hace con el cliente delante.
- **Cuatro de los ocho criterios de curaduría** (originalidad, corrección pública, skin in the
  game, aval del nicho): necesitan historial de la fuente, no se miden con un solo item.
- **La decisión final.** El Lab llega hasta el veredicto argumentado. Entre eso y producción
  hay siempre una persona.
