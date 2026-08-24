# V1.8 — El Lab tiene ojos

> Objetivo del sprint: que el Lab entienda **lo que el creador MUESTRA**, no solo lo que dice.

---

## El principio

No es "OCR de videos". El OCR es **una herramienta** de esta capa, no la capa.

```
              CONTENT ITEM
                   │
      ┌────────────┼────────────┐
    AUDIO        VISUAL      METADATA
      │            │            │
 TRANSCRIPT     FRAMES     TITLE/CAPTION
      │        ┌───┴───┐         │
      │       OCR   (visual      │
      │             understanding)│
      └────────────┬─────────────┘
                   ▼
             SIGNAL FUSION
                   ▼
           ENTITY EXTRACTION
```

---

## Parámetros: todos medidos, ninguno supuesto

| Decisión | Por qué |
|---|---|
| Bajar a **720x1280** | El default de yt-dlp es 360x640 — 4× menos píxeles, y el texto chico se pierde. ~5 MB, ~5 s. |
| **1 frame cada 2 s** | Los videos son Shorts de 25–71 s. Da ~30 candidatos. |
| **Upscale ×3 + gris** antes del OCR | **Es lo que define todo.** Ver abajo. |
| Sin ajuste de contraste | Se probó y **empeoró** el resultado. |
| Dedup por hash perceptual, umbral 6/64 | Un Short deja la misma pantalla varios segundos. |
| Tope de 24 frames | Acota costo. |

### El hallazgo del preprocesado

Sobre **el mismo frame**, tesseract devolvió:

```
sin preprocesar :  "€) sltrapp/nen x"
upscale ×3 + gris: "lob/main/add-login/SKILL.md"
```

La ruta del archivo estaba ahí todo el tiempo. Sin ese paso, la señal visual es ruido.

### Lo que NO funcionó

La **detección de escenas de ffmpeg** (`select='gt(scene,0.30)'`) devolvió **0 frames** sobre
este material. Los Shorts tienen corte continuo y el umbral no discrimina nada. Se descartó a
favor de intervalo + dedup perceptual, que da lo mismo y es predecible.

---

## Signal fusion

No hay tres detectores creando entidades duplicadas. Hay **un** detector que corre sobre cada
señal, y las menciones se fusionan por **clave canónica**.

La clave usa el **registro curado**, no parecido de strings — que sería volver al bug
`Polar → GRUPOLAR`. El transcript dice *"skills de Claude"*, el OCR lee `anthropics/skills`:
como texto no se parecen en nada, pero el registro sabe que son lo mismo y los une.

**Lo que gana la fusión no es la mejor señal: es la convergencia.** Dos caminos independientes
que llegan al mismo lugar valen más que cualquiera de los dos.

| Confianza | Cuándo |
|---|---|
| `LOW` | inferencia débil, una sola señal |
| `MEDIUM` | nombre claro en una señal |
| `HIGH` | URL exacta, o dos señales |
| `VERY_HIGH` | **convergencia** — visto en pantalla *y* dicho en audio |

---

## Provenance

Nunca alcanza con *"el Lab detectó X"*. Hay que poder preguntar **por qué** y obtener evidencia:

```
VERY_HIGH  [company] Stripe
   <- frame_ocr @38s: "Sistema de facturacion con Stripe" "CRUD complet"
   <- transcript:     "Para el método de pago puedes utilizar Stripe o..."
```

Cada evidencia guarda el fragmento exacto y, si es visual, el **timestamp del frame**.

---

## Tolerancia a fallas

La visión es **enriquecimiento, nunca un punto único de falla**:

- Si faltan herramientas → `VISUAL_SIGNAL_UNAVAILABLE: falta ffmpeg, tesseract`
- Si no se puede bajar el video → se dice y sigue
- Si un frame es ilegible → se registra y sigue
- El análisis continúa con `transcript + metadata`

`vision.extraer()` **nunca lanza**. Devuelve `{ok:false, motivo}`.

---

## Lo reservado, y vacío a propósito

`frames.observations` y `frames.visual_entities` existen en el contrato para observaciones de
un modelo visual ("GitHub repository page visible", "terminal showing installation command").

**Hoy quedan vacías.** No tenemos ese modelo y no se inventan observaciones.

---

## Uso

```bash
node scripts/analizar.js <videoId>                # multimodal completo
node scripts/analizar.js <videoId> --sin-vision   # solo audio + metadata
node test/vision.test.js                          # 17 tests
```

---

## Lo que sigue manual

- **Observaciones visuales** — requiere un modelo de visión. El contrato está listo.
- **El registro curado** de fuentes oficiales, que es lo que permite fusionar alias.
- **OCR en español** — hoy solo `eng`. Para URLs y comandos alcanza (son ASCII), pero el
  texto en castellano de las diapositivas se lee peor.
