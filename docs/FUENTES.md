# Fuentes — qué se puede ingerir y a qué costo

La cantidad de fuentes no es el problema: 10 o 200 cuesta lo mismo. **Lo que varía es cómo
nos deja entrar cada plataforma.** Este documento es la respuesta honesta a "¿puedo agregar
Spotify, YouTube, Instagram?".

---

## El descubrimiento que ordena todo

**GitHub, YouTube, podcasts, blogs y newsletters se resuelven todos con el mismo mecanismo:
polling de un feed público.** No son cinco integraciones distintas — es un colector con cinco
adaptadores finos.

- YouTube publica un **RSS por canal**, sin API key:
  `https://www.youtube.com/feeds/videos.xml?channel_id=<ID>`
- Los podcasts se distribuyen por **RSS abierto**. Aunque vos lo escuches en Spotify, el
  podcast casi siempre tiene un feed público — Spotify es el reproductor, no el dueño.
- GitHub tiene **API oficial** y además RSS de releases y commits.
- Los blogs y newsletters serios tienen RSS.

Eso cubre el grueso de lo que consumís con **una sola pieza de código**.

Instagram es el verdadero outlier, y por eso va último.

---

## Tabla de realidad

| Plataforma | Cómo se entra | Dificultad | Cuándo |
|---|---|---|---|
| **GitHub** | API oficial (repos, releases, commits, README) | Baja | **Fase 1** |
| **YouTube** | RSS por canal + transcripción de subtítulos | Baja | **Fase 1** |
| **Podcasts** | RSS del podcast + transcripción del audio | Media | **Fase 2** |
| **Blogs / newsletters** | RSS | Baja | Fase 2 |
| **Papers / docs** | URL directa | Baja | Fase 2 |
| **Spotify exclusivos** | Sin RSS no hay ingesta. La API de Spotify **no entrega audio** | Alta | Caso por caso |
| **Instagram** | Sin API para contenido de terceros | **Alta** | **Fase 4** |
| **X / LinkedIn** | Acceso restringido | Alta | Sin fecha |

---

## Las dos aclaraciones que importan

**Spotify.** Si el podcast existe fuera de Spotify (la mayoría), entramos por su RSS y Spotify
es irrelevante. Si es **exclusivo de Spotify**, no hay camino automático limpio: su API expone
metadatos, no el audio. Ahí la ingesta es manual — pegás el link y el Lab procesa desde ahí.

**Instagram.** Es lo que más valor tiene para Luka y lo más difícil técnicamente. Meta no
ofrece una API que permita leer el contenido público de cuentas ajenas como si fuera un feed.
Las opciones son un colector sobre el navegador con su propia sesión autenticada, o ingesta
manual pegando el link del Reel.

**Por eso Instagram va último, y no por importancia:** primero se construye el cerebro que
evalúa, después se le dan los ojos. Al revés queda un excelente capturador de Reels sin nada
que los procese. En esto coincidieron los dos diseños, el de ChatGPT y el de Claude Code.

---

## Mientras tanto: la ingesta manual funciona desde el día uno

Cualquier fuente, de cualquier plataforma, se puede meter pegando la URL. El circuito de
investigación es el mismo — cambia solo cómo llegó el link. Así que **ninguna fuente queda
afuera**; lo único que varía es si el link lo trae un agente o lo pegás vos.

---

## Cómo cargar fuentes

Se editan en [`seed/sources.json`](../seed/sources.json) y se corre `node scripts/init_db.js`.

Campos:

| Campo | Qué es |
|---|---|
| `platform` | `github` · `youtube` · `podcast` · `blog` · `instagram` · `x` |
| `source_type` | `creator` · `repo` · `channel` · `show` · `feed` |
| `handle` | el usuario/identificador (`@fulano`, `owner/repo`) |
| `url` | el link. **Con esto solo alcanza** — el resto se resuelve |
| `priority` | 1-10. Ordena a quién mirar primero cuando hay cola |
| `active` | `true`/`false` para silenciar sin borrar el historial |

**Alcanza con pegar el link.** El handle, el ID de canal y el feed RSS los resuelvo yo.
