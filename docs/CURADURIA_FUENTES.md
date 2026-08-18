# Curaduría de fuentes — cómo se elige a quién escuchar

> Luka, 18/08/2026: *"todo esto que te mando es lo que yo consumo y lo que yo encontré, no
> significa que sea lo mejor ni lo único. Soy un humano y tengo tiempo limitado."*

Las fuentes que hay hoy en `seed/sources.json` son **el punto de partida de Luka**, no una
lista curada. Este documento define cómo el Lab decide **a quién agregar y a quién sacar**.

El criterio madre lo puso él: **que lo que divulgan lo estén aplicando, y que haya constancia
de eso.** Todo lo demás se deriva de ahí.

---

## Por qué esto se puede medir (y no es opinión)

La ventaja de este dominio es que **GitHub es un registro público de quién construye de
verdad**. Un creador puede decir cualquier cosa en un Reel; su historial de commits no miente.

Eso convierte "no vender humo" en algo **medible**, no en una impresión.

---

## Los seis criterios

### 1. Constancia de práctica — el filtro madre
¿Publica código, o solo opiniones sobre código?

- Commits públicos en los últimos 90 días
- Repos **propios**, no forks ni listas de "awesome-…"
- ¿Responde issues? ¿Mantiene lo que publicó, o lo abandona después del video?

Un creador sin rastro de construcción queda afuera, no importa cuántos seguidores tenga.

### 2. Verificabilidad
Cuando recomienda algo, ¿nombra el repo, la fuente, la versión?

*"Esta skill es increíble"* sin link es ruido. **Un creador que obliga a adivinar de qué
habla le cuesta trabajo al Lab en vez de ahorrárselo.**

### 3. Señal sobre ruido
Proporción de contenido que menciona una tecnología **concreta y verificable**, contra
contenido motivacional, de opinión o de marca personal.

No hay umbral moral acá: es economía. Un creador con 10% de señal exige diez veces más
procesamiento por el mismo hallazgo.

### 4. Originalidad contra eco
¿Es de los primeros en cubrir algo, o repite lo que ya circuló hace dos semanas?

Medible: **lag entre el release del repo y su publicación**. Los que replican tarde no
aportan nada que otra fuente no haya dado antes — y son los primeros candidatos a salir
cuando la lista crezca.

### 5. Corrección pública — el indicador más subestimado
¿Alguna vez se retractó, corrigió un video o dijo "esto que recomendé no funcionó"?

**Los vendedores de humo nunca se corrigen.** Es de las señales más limpias que existen y
casi nadie la mira.

### 6. Skin in the game
¿Tiene un producto, un negocio o un sistema real corriendo con lo que enseña?

Es el criterio que más le importa a Luka, porque es el suyo propio: la diferencia entre quien
habla de negocios y quien tiene los números adentro.

---

## Anti-señales (bajan la prioridad automáticamente)

- El producto principal es **un curso**, y la tecnología es el anzuelo
- *"X va a reemplazar a Y"* como fórmula recurrente
- Números de audiencia usados como argumento de autoridad
- **Nunca muestra lo que falló** — solo demos que salen bien a la primera
- Recomienda herramientas de las que es afiliado sin declararlo

---

## Cómo se aplica

Cada fuente se puntúa del 1 al 10 en los seis criterios, **con la evidencia al lado**
(el repo, el commit, el video). Igual que con los problemas: **un número sin su porqué no
entra**.

El puntaje alimenta `sources.priority`, que decide a quién mira primero el colector cuando
hay cola.

**La curaduría se rehace cada tanto**: un creador bueno puede dejar de construir, y uno que
hoy no está puede volverse imprescindible. La lista es viva.

---

## Estado

| | |
|---|---|
| Criterios definidos | ✅ 18/08/2026 |
| Aprobados por Luka | ⏳ pendiente |
| Primera pasada de curaduría | ⏳ pendiente |

**Nota de método.** La primera curaduría la hace Claude a mano. Esa pasada manual **es la
especificación** del agente que después la hace solo: lo que se mire para decidir, y cómo se
pondera, es exactamente lo que va a quedar programado. Por eso conviene hacerla despacio una
vez, y rápido para siempre.
