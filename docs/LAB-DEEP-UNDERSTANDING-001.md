# LAB-DEEP-UNDERSTANDING-001 · Benchmark A — Reel Metallurgia AI

> **Encontrar señales dentro de un video** y **entender el video** son dos problemas
> distintos. El Lab hacía lo primero y presentaba el resultado como si fuera lo segundo.
>
> **Resultado: `COMPLETE` · 100% · audio COMPLETE / visión COMPLETE.** Con herramientas
> locales y gratuitas. Cero API paga.

---

## ESTADO INICIAL

| | |
|---|---|
| Item | `a43adf12af5d25ad72a101bc8d8d09f6` · [reel/DbgwN-0p7sf](https://www.instagram.com/reel/DbgwN-0p7sf/) |
| Autor | Pablo González (`@pablo.gonzalez.virgili`) |
| Duración real | **376,4 s (6:16)** — nadie la había medido |
| Análisis previo | 24 frames · rango 0–58 s · veredicto `RESEARCH_DEEPER` · **claims `[]`** |
| Cobertura previa | **15,4% del timeline** (58 s de 376,4 s) · `coverage` en `NULL` |

El Reel se creía de ~3 minutos. Son 6:16 — el doble. Todo porcentaje calculado sobre el
supuesto estaba inflado.

---

## LOS CUATRO BUGS

### B1 · El tope de frames era POSICIONAL

```js
for (let i = 0; i < archivos.length; i++) {
  ...
  if (elegidos.length >= maxFrames) break;   // rompe el barrido ENTERO
}
```

No era "24 frames repartidos": era **"los primeros 24 distintos y chau"**. Sobre un barrido
secuencial, un tope garantiza sesgo hacia el principio. Subir `MAX_FRAMES` no arreglaba
nada — movía el borde.

Peor: **todo lo valioso del run viejo estaba en los últimos 40 s de lo que miró**
(`CANALES RUTEO CEREBRO` a los 20 s, `DIRECTORIO DE PERSONAS` a los 40 s, el buzón de
mejoras a los 58 s). La densidad subía justo en el corte.

**Arreglo:** `lib/cobertura.js` reparte el presupuesto garantizando ≥1 muestra por segmento
antes de gastar el excedente, y rota entre segmentos para que uno denso no se coma el
presupuesto de los que siguen.

### B2 · El audio existía y lo tirábamos nosotros

El handoff decía *"Instagram no entregó audio"*. **Falso.**

```
dash-1613600046853122a  m4a  audio only  mp4a.40.5  75k  44100 Hz  ← existe, 3,4 MB
```

El selector era `-f bestvideo[height<=1280]/best[...]`, y en yt-dlp **`bestvideo` significa
literalmente "el mejor stream SOLO-VIDEO"**. Nuestro propio selector excluía el audio por
definición, y después concluimos que la plataforma no lo daba.

**Tercera vez con la misma forma** (antes: el RSS del podcast). No falló el criterio: falló
la ingesta, y la capa de análisis reportó sobre lo que le llegó como si fuera todo.

### B3 · Todo estaba calibrado para Shorts de 25–71 s

El comentario del archivo decía *"pesa ~5 MB y tarda ~5 s"*. Medido sobre este Reel:
**74,7 MB y 33 s.** Constantes de otro tipo de material.

### B4 · OCR en inglés sobre pantallas en español

`tesseract --list-langs` → solo `eng`, `osd`. El Reel es íntegramente en español.

---

## QUÉ SE HIZO (pasos 0–4, todo local y gratis)

| Paso | Qué | Dónde |
|---|---|---|
| 0 | **Medir antes de mirar** con `ffprobe` | `lib/medios.js` |
| 1 | Selector `bestvideo+bestaudio` — recupera las dos pistas | `lib/vision.js`, `lib/audio.js` |
| 2 | Transcripción local con timestamps | `lib/audio.js` + whisper.cpp |
| 3 | Cobertura temporal distribuida | `lib/cobertura.js` |
| 4 | OCR `spa+eng` con tessdata propio | `lib/vision.js` |

**Herramientas instaladas** (una sola vez, fuera del repo):

```
C:\dev\tools\whisper\Release\whisper-cli.exe   whisper.cpp b4938 BLAS x64   (20 MB)
C:\dev\tools\whisper\models\ggml-base.bin      modelo base                  (141 MB)
C:\dev\tools\tessdata\{eng,osd,spa}.traineddata                             (31 MB)
```

`ffprobe` ya estaba instalado al lado de `ffmpeg`, en la misma carpeta. Nunca se había usado.

### PSM: la hipótesis era falsa

Asumí que `--psm 11` (texto disperso) le ganaría a `--psm 6` sobre capturas de paneles.
Lo medí sobre 3 frames reales contando palabras legibles de 4+ letras:

| frame | psm 3 | psm 4 | **psm 6** | psm 11 |
|---|---|---|---|---|
| t=18 s | 5 | 5 | **9** | fragmenta |
| t=40 s | 8 | 8 | **18** | fragmenta |
| t=300 s | 4 | 10 | **6** | fragmenta |

**psm 6 gana y el default original estaba bien.** Se dejó psm 6 con el dato anotado en el código.

---

## PRINCIPIO INCORPORADO — `CAPTURA != COBERTURA`

> Un análisis parcial puede producir hallazgos, pero **nunca** puede presentarse como
> comprensión completa.

Vive en `lib/cobertura.js`. Tres estados: `COMPLETE` / `PARTIAL` / `NONE`. Reglas:

1. **El denominador se mide aparte, primero, contra la fuente.** Sin duración medida no hay
   porcentaje — se dice `NONE` y se explica por qué, en vez de inventar uno.
2. **El consolidado es el MÍNIMO, no el promedio.** Tener la transcripción completa no
   autoriza a decir que se entendió el video si no se miró una sola pantalla.
3. **Todo lo que no es `COMPLETE` lleva advertencia explícita** en el informe.

### El principio se cazó a sí mismo

En la primera corrida el parser de whisper devolvió 0 segmentos. El sistema **se negó a
declarar comprensión**:

```
AUDIO            NONE      0%   0/8 segmentos
VISION/OCR       COMPLETE  100% 8/8 segmentos
CONSOLIDADO      NONE
⚠ SIN COBERTURA — no hay base para ningún veredicto sobre el contenido.
```

Ese `NONE` es el arnés funcionando: whisper había corrido bien 66 segundos y la
transcripción se perdía en silencio (ver B5 abajo).

---

## BUGS ENCONTRADOS DURANTE LA IMPLEMENTACIÓN

**B5 · `\r` de Windows rompía el parser de whisper.** La regex `(.*)$` fallaba en **todas**
las líneas porque en JS el `.` no matchea `\r`, y las líneas venían con CRLF. whisper corría
bien, gastaba sus 66 s, y devolvía cero — sin ningún error. Fix: `.trim()` por línea.

**B6 · `CONSOLIDADO NONE 100%`.** El promedio se calculaba solo sobre las pistas con dato,
así que un estado sin cobertura exhibía el 100% de la otra pista. Exactamente el número
halagador que el módulo existe para impedir. Fix: mínimo, no promedio. Arnés `C6`.

**B7 · `-nt` en whisper.** Lo había puesto y significa *no-timestamps*: habría borrado
justo el provenance temporal. Cazado antes de correr.

**B8 · `fmt(0)` devolvía `n/d`.** El informe mostraba `n/d–0:48` en el primer tramo. El
inicio del timeline no es un dato faltante. Arnés `C9`.

---

## RESULTADO DE LA CORRIDA

```
DURACIÓN TOTAL   6:16   (376,4 s)
SEGMENTOS        8
AUDIO            COMPLETE  100%  8/8 segmentos · 89 tramos · 1.193 palabras
VISION/OCR       COMPLETE  100%  8/8 segmentos · 120 frames · idioma spa+eng
─────────────────────────────────────────────────────────────
CONSOLIDADO      COMPLETE  100%

0:00 ████████████████████████████████████████████████████████ 6:16
     █ = audio + visión    ▄ = una sola pista    ░ = sin mirar
```

| | antes | ahora |
|---|---|---|
| Cobertura temporal | 15,4% | **100%** |
| Frames OCReados | 24 / 188 | **120 / 188** (36 dup · 32 bajo techo) |
| Palabras de audio | 0 | **1.193** |
| Segmentos cubiertos | 2 / 8 | **8 / 8** |
| Claims | `[]` | arquitectura completa |

Tiempos: frames 26,5 s · phash 12,6 s · OCR 281,4 s · whisper 71,8 s. **Total ~6,5 min, USD 0.**

---

## LO QUE SE RECONSTRUYÓ

Sistema **"Metallurgia AI"**, operando en una metalúrgica argentina real.

### Capas (reconstruidas de la evidencia, no asumidas)

```
CANALES        Slack · WhatsApp · Asana · reuniones
    ↓
RUTEO          n8n
    ↓
CEREBRO        selección de modelo por necesidad + herramientas
    ↓
MEMORIA        semántica · episódica individual · colectiva
    ↓
ACCIONES       responder · recordar · escalar · crear mejoras
```

`CANALES RUTEO CEREBRO` está literal en pantalla a los 20 s; el resto sale de la narración.

### Los tres módulos de memoria

| Módulo | Contenido | Acceso | Origen |
|---|---|---|---|
| **Semántica** | máquinas, turnos, rutas, procedimientos | compartido | entrevistas con gerentes, carga automática |
| **Episódica individual** | por usuario | **solo ese usuario** | su propia interacción |
| **Colectiva** | de grupos de Slack + comentarios de Asana | todos | conversación grupal |

**Consolidación nocturna:** *"va recordando todos los hechos y los guardan durante la noche
mediante un proceso… tomar todos los hechos recordados, consolidarlos y [distribuirlos] en
cada uno de estos módulos de memoria"*. En pantalla: `LA MENTE DEL AGENTE` ·
`FASES DE LA MEMORIA` · *"la arquitectura de la mente humana trasladada a … sistema de memoria"*.

### El circuito de auto-mejora (lo más interesante)

```
usuario pide algo por su canal habitual
   → se carga como MEJORA en cola de producción, registrando POR QUÉ CANAL se pidió
   → agentes de Claude Code la implementan (3 en paralelo el día de la grabación)
   → pasa a cola de TESTING
   → agentes chicos pero expertos la estresan con casos ficticios
        (ejemplo del video: una funcionalidad estresada 24 veces)
   → si aparece un error, un agente de MODELO SUPERIOR juzga: ¿real o falsa alarma?
   → si es real → vuelve a la cola de mejoras → Claude Code reimplementa
```

*"fíjense la cantidad de funcionalidades que produjo en apenas cuatro o cinco días"*.

### Human-in-the-loop

El agente **admite lo que no puede verificar**: *"no puedo verificar desde acá si el archivo
llegó correctamente a tu WhatsApp — revisá el chat y confirmame"*. El usuario responde
*"creá una herramienta para chequear que haya llegado"* → queda como mejora **#404** en la
cola. **El propio límite del sistema se convierte en la siguiente funcionalidad.**

### Local-first

En pantalla, dos veces: **"Las claves se guardan en esta PC y nunca s[alen]"**. Corroborado
por una IP privada visible a los 300 s: `192.168.88.250`.

### Operación real

OT 331 en riesgo: *"tiene como límite de producción el 07/08 y lleva nueve días sin
movimiento; hay un posible bloqueo de materia prima sin confirmar"* → recomienda destrabar,
confirmar fecha de ingreso del material y que **Bruno** cierre la definición técnica en
paralelo; sugiere preguntarle a **Marcelo** por WhatsApp o Slack. Nombres propios, número de
OT, fecha. **Está operando, no es un demo.**

---

## LO QUE SIGUE SIN COMPRENDERSE

**Cobertura ≠ comprensión.** Vimos el 100% del material; eso no significa que entendamos
todo lo que hay adentro.

1. **El OCR es legible pero sucio.** Sirve para corroborar (`CONECTORES`,
   `DIRECTORIO DE PERSONAS`, `LA MENTE DEL AGENTE`) y **no** para leer el contenido de las
   tarjetas, tablas y formularios. Buena parte de los frames devuelve ruido tipográfico.
2. **La estructura visual no se entiende, solo se lee.** El OCR no sabe que un diagrama es
   un diagrama: no distingue una tarjeta de un encabezado, ni lee la dirección de una flecha.
   Los nombres de las capas los sabemos por el audio, no por el dibujo.
3. **Errores de transcripción del modelo `base`:** "club" = Claude · "DN8N" = n8n ·
   "memoria semana" = semántica · "las rusas" = las rutas. El sentido se recupera por
   contexto, pero un extractor automático de entidades se los pierde.
4. **Faltan valores concretos de pantalla:** qué modelos concretos hay en `CONECTORES`,
   qué columnas tiene el panel de producción, qué dicen las tarjetas de `FASES DE LA MEMORIA`.
5. **Todo es hipótesis del Reel, sin verificar.** n8n, Asana, Slack, Claude Code y WhatsApp
   Business son *claims del autor*. El Reel genera hipótesis; la fuente primaria valida.
   Ese cruce (paso 6) todavía no corrió.

---

## ARCHIVOS

```
lib/medios.js              NUEVO   ffprobe + resolución de whisper/tessdata
lib/cobertura.js           NUEVO   CAPTURA != COBERTURA: segmentar, repartir, evaluar, consolidar
lib/audio.js               NUEVO   pista de audio + whisper.cpp local con timestamps
lib/vision.js              REESCRITO  medición previa, reparto distribuido, OCR español, cobertura
lib/db.js                  +MIGRACIONES  ALTER idempotente (solo columnas sin CHECK)
db/schema.sql              +items.duracion_s
scripts/comprender.js      NUEVO   corrida profunda + informe con provenance temporal
test/cobertura.test.js     NUEVO   10 arneses, uno por bug que ya pasó
```

**Tests: 43/43 en verde** (16 matcher · 17 vision · 10 cobertura).

---

## COSTOS REALES

| Concepto | Costo |
|---|---|
| whisper.cpp + modelo base | USD 0,00 |
| tessdata español | USD 0,00 |
| ffprobe / ffmpeg / yt-dlp | USD 0,00 |
| Corrida completa del Reel | USD 0,00 |
| **TOTAL BENCHMARK A** | **USD 0,00** |

No se usó ninguna API paga. El límite de USD 3,00 sigue intacto y sin tocar.

---

## DEUDA DECLARADA

- El **techo de 120 frames** recortó 32 candidatos únicos. La cobertura es completa a nivel
  segmento, no exhaustiva a nivel frame. Está declarado en `metricas.recortados_por_techo`.
- **`observations` y `visual_entities` siguen vacíos** — a propósito. No hay modelo visual.
- El **modelo `base` de whisper** confunde nombres propios y términos técnicos. `small`
  (~466 MB, gratis) probablemente los arregle; no se probó todavía.
- **`analizar.js` no consume las pistas nuevas** todavía: `comprender.js` corre aparte. Hay
  que unificarlos para que el pipeline principal herede la cobertura.
