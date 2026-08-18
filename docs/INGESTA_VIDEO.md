# Ingesta de video — dónde está realmente el valor

> Luka, 18/08/2026: *"lo que me interesa de Instagram es la repo que está mostrando en ese
> frame de la pantalla. El video explica burdamente lo que hay; la repo es lo que hay que
> analizar a fondo."*

---

## El insight que define el colector

En un Reel técnico, **la carga útil no está en el caption ni en los comentarios: está en el
frame.** El creador hace screen recording y en pantalla se ve la URL del repo, el nombre de
la skill o el comando de instalación.

Y hay una razón estructural por la que el caption **nunca** lo trae: el patrón de
monetización es *"comentá REPO y te paso el link"*. El link se retiene a propósito para
generar interacción. **Entonces leer el frame no es una alternativa: es el único camino.**

Consecuencia de diseño: el colector de Instagram **no es un scraper de captions**. Es un
lector de fotogramas.

---

## Las dos señales, y para qué sirve cada una

| Señal | De dónde sale | Qué aporta |
|---|---|---|
| **La URL / el nombre** | **frames del video → OCR** | El dato duro. Es lo que se investiga. |
| **La explicación** | audio → transcripción | El *claim*: qué dice que hace y qué problema promete resolver. |

El audio **no** decide nada: se guarda en `research_reports.claims` como lo que el creador
promete. Lo que el repo hace de verdad va en `findings`, y sale de la fuente primaria.

**El video detecta. El repo decide.** Es el principio de fuente primaria, y Luka llegó a él
por su cuenta: *"el video explica burdamente; hay que meterse en la repo y analizarla a fondo"*.

---

## Lo que ya tenemos y sirve tal cual

**El músculo de OCR ya existe y está validado en este ecosistema.** En `magna-pyme-os/ocr.js`
se procesan facturas de proveedores: backtest del 05/08 sobre 27 facturas de julio, **97% de
acierto en cantidades y totales al centavo, por USD 0,79**. Con candado aritmético que caza
los errores.

Es la misma capacidad apuntada a otro objetivo. Y acá es **más fácil**, no más difícil:

- Una factura es papel arrugado, fotografiado torcido, con tipografías de impresora fiscal.
- Un screen recording es **texto digital, alto contraste, fuente de pantalla**.

Con una ventaja extra: una URL de GitHub tiene forma conocida (`github.com/owner/repo`), así
que se puede **validar sintácticamente y después verificar contra la API** que el repo exista.
Ese es el mismo tipo de candado que hizo confiable el OCR de facturas: no creerle al OCR,
verificar el resultado contra algo externo.

---

## La secuencia que esto habilita (cambia el roadmap)

El problema de Instagram se parte en dos, y **son independientes**:

1. **Conseguir el video** — acceso. Difícil en Instagram, sin API de terceros.
2. **Entender el video** — frames + OCR + transcripción. **Igual en toda plataforma.**

**YouTube da el mismo tipo de contenido con acceso resuelto.** Entonces la pieza difícil (2)
se construye y se valida **hoy, sobre YouTube**, donde ya hay 4 feeds andando.

Cuando se destrabe el acceso a Instagram, solo se cambia el paso 1: el cerebro ya está hecho
y probado. Y si no se destraba nunca, la ingesta manual (pegar el link del Reel) usa
exactamente el mismo motor.

**Instagram deja de ser un bloqueante y pasa a ser un adaptador.**

---

## El circuito completo

```
VIDEO (YouTube hoy · Instagram después · manual siempre)
   │
   ├── frames  → OCR  → URLs / nombres  ─┐
   └── audio   → transcripción → claims  │
                                         ▼
                              FUENTE PRIMARIA
                     (README · código · releases · issues
                      · licencia · dependencias · mantenimiento)
                                         │
                                         ▼
                        ¿esto le pega a algún problema nuestro?
                              (los 10 DIST-* y los que vengan)
                                         │
                                         ▼
                          VEREDICTO → EXPERIMENTO → MEMORIA
```

---

## Estado

| Pieza | Estado |
|---|---|
| Feeds de YouTube | ✅ 4 verificados |
| Descarga de video + extracción de frames | ⏳ |
| OCR de frames → URLs | ⏳ reusa el patrón de `magna-pyme-os/ocr.js` |
| Transcripción de audio → claims | ⏳ |
| Verificación contra la API de GitHub | ⏳ el candado |
| Acceso a Instagram | ⏳ Fase 4 — **ya no bloquea nada** |
