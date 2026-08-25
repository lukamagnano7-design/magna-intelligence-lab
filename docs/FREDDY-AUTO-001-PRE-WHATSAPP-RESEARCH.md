# FREDDY-AUTO-001 — Research pre-WhatsApp

> Sprint disparado por evidencia nueva antes de implementar. **Research only: no se instaló
> Make, no se creó cuenta, no se tocó Freddy OS.**

---

## 1. RESUMEN EJECUTIVO

**El plan no cambia: seguimos con WhatsApp + adaptador propio.** Pero el sprint encontró tres
cosas que sí valen, y una de ellas es un agujero en el propio Lab.

| Hallazgo | Veredicto |
|---|---|
| **Make como orquestador de Freddy OS** | `LATER` — no resuelve nuestro problema y choca con el local-first |
| **Reel A — "bennett-os"** (conductor + workers) | `ALREADY_HAVE` — es tu propia visión, y ya la tenés escrita |
| **Reel B — "Metallurgia AI"** | `WATCH` — **valida la arquitectura que íbamos a construir** |
| **Reel C** | `NO_APLICA` |
| **El Lab no ingiere podcasts** | `TEST_NOW` — **el arreglo cuesta una llamada HTTP** |

**Lo más importante del sprint no fue Make. Fue descubrir por qué vos encontraste el episodio
antes que el Lab.**

---

## 2. MAKE — qué es realmente

Plataforma **cloud** de automatización visual: conecta aplicaciones mediante escenarios
(triggers → módulos → acciones). El equivalente comercial de n8n, que el Lab ya había
evaluado y descartado para el V1 (D-004).

**Lo que pude verificar en fuente primaria:**

| | |
|---|---|
| `developers.make.com` | HTTP 200 — hub de desarrolladores real |
| `developers.make.com/mcp-server` | HTTP 200 — **título: "Make MCP Server \| Make Developer Hub"** |
| `apps.make.com` | HTTP 200 — directorio de apps |

**Lo que NO pude verificar, y lo digo:**

`make.com` **devuelve 403 a cualquier lectura automatizada** — pricing, docs de agentes, custom
apps, todo bloqueado. Su documentación técnica es GitBook renderizado en JavaScript y no
entrega contenido a un cliente HTTP.

**Por lo tanto NO puedo confirmar de fuente primaria:** el número real de integraciones, el
pricing actual, las capacidades exactas de sus agentes, ni los límites. **No los voy a
estimar.**

**Sobre MCP:** la doc oficial existe (el título lo prueba), pero:
- La organización **`MakeHQ` en GitHub tiene 0 repos públicos**
- El único `make-mcp-server` en npm es de un tercero y se describe a sí mismo como
  **"Unofficial MCP server for Make.com"**

O sea: hay soporte documentado, pero **no hay artefacto oficial verificable** que se pueda
auditar antes de adoptarlo.

---

## 3. REEL A — `bennett.spooner` · "bennett-os"

**Qué muestra.** Un sistema operativo personal de agentes. Lo que se leyó **en pantalla**:

> `CONDUCTOR / SUPER AGENT` corriendo en `claude-fable-5` — *"the real CEO, on the company
> board, delegates, creates tasks"*. Departamentos: **Core · Finances · Communications ·
> Operations · Clients · Knowledge · Personal Brand**. Workers: **Payments Agent · Comms Agent ·
> Content Creation · Stock Monitor · Processor Monitor**. Un **BOARD** (hilo permanente) donde
> el conductor reporta. Watchdog con "persisted issue monitor" y "daily checks". Herramientas
> MCP: `patch`, `read_file`, `search`. Integraciones: Stripe, Zernio.

**Señales:** metadata (110 chars, sin links) + **24 frames de OCR**. **Cero transcripción** —
Instagram no dio audio. **Todo lo de arriba salió exclusivamente de la señal visual.** Sin el
pipeline de visión, este Reel era invisible.

**Fuente primaria: NO EXISTE.** El caption dice *"Comment BUILD and I'll send you the open
source repo"*. Busqué: **el usuario `bennettspooner` no existe en GitHub**, y ningún repo
`bennett-os` coincide. El "open source" no es verificable — es el patrón de captación que el
Lab ya tiene catalogado.

**Match contra nuestra fábrica:** es **literalmente tu diagrama del primer prompt**
(1 director → orquestador → departamentos → agentes). Es una validación de que la visión es
construible y que otros la están construyendo.

**Pero no aporta capacidad nueva:** `freddy-agent-os/agents/` ya define Jarvis (orquestador) +
6 agentes con matriz de permisos. **El patrón ya es nuestro; lo que falta es ejecutarlo, no
descubrirlo.**

**VEREDICTO: `ALREADY_HAVE` / `WATCH`.** Si el repo aparece públicamente, se revisa.

---

## 4. REEL B — `pablo.gonzalez.virgili` · "Metallurgia AI"

**El más relevante de los tres.** Implementación real en una metalúrgica argentina
(`@metallurgiarosario`).

Lo leído en pantalla:

> **`CANALES → RUTEO → CEREBRO`**
> **Conectores:** *"Credenciales e integraciones. **Las claves se guardan en esta PC y nunca
> salen**"*
> **Modelos:** Anthropic Claude · OpenAI GPT · ElevenLabs
> **Integraciones:** Asana · Slack · **WhatsApp** · Google Cloud
> **Directorio de personas:** *"Asana y Slack se unen solos por email; **WhatsApp habilita a la
> persona a hablar con Metallurgia AI**"*. Roles: Gerencia / Operarios
> **Herramientas:** cotización automática · producción en vivo · **búsqueda semántica del NAS**
> **Documentación:** BPMN por proceso + arquitectura C4

**Por qué importa:** es **la misma arquitectura que íbamos a construir**, ya funcionando en una
empresa real:

| Ellos | Nosotros |
|---|---|
| `CANALES → RUTEO → CEREBRO` | adaptador → Intake Core → reglas |
| WhatsApp como canal humano | el WhatsApp adapter que sigue |
| Claves locales, "nunca salen de esta PC" | `.env` local, `magna.db` local |
| Directorio de personas con roles | *(no lo tenemos)* |

**VEREDICTO: `WATCH`.** No hay fuente primaria que auditar (es un producto de servicios, no un
repo), pero **valida la dirección y aporta una idea concreta que no teníamos: el directorio de
personas con roles.** Cuando Freddy tenga más de un empleado cargando, eso va a hacer falta.

---

## 5. REEL C — mismo autor

Tablero de tareas agénticas en curso: *"Auditar paquete deploy", "Preintegración live",
"Review store", "merge conflict"*, con duraciones y estado `Procesando`.

**Es una demo de volumen, no de arquitectura.** No aporta capacidad ni tecnología identificable.

**VEREDICTO: `NO_APLICA`.**

---

## 6. FUENTES PRIMARIAS VERIFICADAS

| Qué | Resultado |
|---|---|
| `developers.make.com` + `/mcp-server` | ✅ 200. MCP documentado oficialmente |
| `make.com` (pricing, docs, agentes) | ❌ **403 a scrapers.** No verificable |
| GitHub org `MakeHQ` | ✅ existe, **0 repos públicos** |
| npm `make-mcp-server` | ✅ existe, **se declara NO oficial** |
| Repo de "bennett-os" | ❌ **no existe públicamente** |
| RSS del podcast | ✅ `anchor.fm/s/e0699a70/podcast/rss` — **178 episodios** |

---

## 7. CRUCE CON FREDDY OS REAL

| Capacidad vista | Clasificación | Dónde |
|---|---|---|
| Orquestador + agentes especializados | **YA_EXISTE** | `freddy-agent-os/agents/` (7 roles) |
| Credenciales locales que no salen de la PC | **YA_EXISTE** | `env.js` + `.env` (fuera de git) |
| Canal → ruteo → cerebro | **YA_EXISTE** | `intake/core.js` + `consola.js` (Slice 1) |
| Human-in-the-loop | **YA_EXISTE** | Preflight + `--apply` + Proposal Mode |
| Observabilidad / auditoría | **YA_EXISTE** | `agent_runs`, `audit_log`, 13 arneses, `validate_db` |
| WhatsApp como canal de personas | **GAP_REAL** | es el próximo paso, ya planificado |
| **Directorio de personas con roles** | **GAP_REAL** | no existe. Hoy Freddy es una sola persona |
| Búsqueda semántica de documentos | **MEJORA_EXISTENTE** | Graphify cubre memoria, no facturas |
| Conectar 3.000 apps SaaS | **NO_APLICA** | Freddy no usa Asana ni Slack. Usa papel y WhatsApp |

---

## 8. ARQUITECTURA — ¿dónde entraría Make?

**El problema que lo bloquea es de topología, no de opinión.**

```
MAKE (cloud)  ──✗──>  localhost:4600 / magna.db (tu PC)
```

Make corre en la nube. **No puede alcanzar `localhost` ni un archivo SQLite en tu disco.**
Para conectarlos haría falta una de estas, todas con costo real:

| Opción | Qué implica |
|---|---|
| Exponer una API pública desde tu PC | **abrir tu máquina a internet.** Superficie de ataque nueva |
| Túnel (ngrok/Cloudflare) | dependencia de terceros + endpoint público + mantenerlo vivo |
| Agente local que hace polling | construir eso = tanto trabajo como el adaptador de WhatsApp |
| Migrar `magna.db` a la nube | **contradice todo el diseño local-first** |

**Y la pregunta de fondo:** Make orquesta el **transporte** entre servicios. Nuestro problema
no es de transporte — **es de lógica de intake**: qué sabemos, qué falta, qué preguntar, cuándo
está completa. Eso ya está construido y validado en `intake/core.js`, y no es lo que Make
resuelve.

---

## 9. MAKE VS CÓDIGO PROPIO — para NUESTRO problema

| | Make | Adaptador propio |
|---|---|---|
| ¿Alcanza `magna.db` local? | **no, sin exponer la PC** | sí, directo |
| ¿Reusa el Intake Core? | habría que exponerlo por API | `require('./core')` |
| Costo mensual | por operación, sin verificar | $0 |
| Vendor lock-in | escenarios propietarios | ninguno |
| Auditoría | la suya | los 13 arneses que ya tenemos |
| Tiempo de construcción | conectar + exponer + mantener | el adaptador ya está diseñado |

**Lo que Make sí ahorraría** es la plomería de OAuth con Meta y los reintentos. Real, pero
chico contra lo que agrega.

---

## 10. SEGURIDAD

- **Lo peor: exponer la PC.** Hoy `magna.db` no es alcanzable desde internet. Cualquier
  arquitectura con Make lo cambia. Es el mismo tipo de riesgo que llevó a **no automatizar el
  banco** — y la decisión debería ser la misma.
- **Credenciales en un tercero.** Make guardaría el token de WhatsApp. Reel B muestra la
  postura opuesta y correcta: *"las claves se guardan en esta PC y nunca salen"*.
- **Datos comerciales de Freddy** (proveedores, precios, márgenes) pasando por una plataforma
  externa.

---

## 11. COSTO

**No pude verificar el pricing de Make: `make.com/en/pricing` devuelve 403.** No lo estimo.

Lo que sí se puede afirmar: el adaptador propio cuesta **$0 de plataforma**, porque el Intake
Core y `magna.db` ya existen y corren local.

---

## 12. LOCK-IN

Los escenarios de Make son **formato propietario**. Si la lógica crítica del intake vive en
Make, salir significa reescribirla.

Hoy esa lógica vive en `intake/core.js`, en JavaScript, sin dependencias, en un repo tuyo. **Es
portable por construcción.** No conviene mudarla a un formato del que después hay que rescatarla.

---

## 13. META-ANÁLISIS DEL LAB — el hallazgo más importante

**Pregunta: ¿el Lab ya había detectado el episodio #175?**

# NO. Y encontré exactamente por qué.

```
Fuente registrada         ✅ desde el 18/08, activa, bien identificada
                             "Inteligencia Artificial para los Negocios"
Items capturados          ❌ CERO
Último intento            ❌ 24/08 19:40 — error: "sin feed conocido"
Nota que quedó escrita    "Pendiente: resolver el RSS publico del programa"
```

**El RSS existía todo el tiempo, es público y gratis:**

```
https://anchor.fm/s/e0699a70/podcast/rss     →  178 episodios
```

Y lo probé:

> **`#175 MAKE: cómo conectar IA, datos y herramientas SIN PROGRAMAR` es el episodio MÁS
> RECIENTE del feed.**

**El Lab lo habría traído primero.** No falló el criterio ni el análisis: **falló la ingesta.**
`lib/feeds.js` sabe leer RSS de podcasts — la función `parseRss()` está escrita y funciona. Lo
que falta es **resolver la URL del RSS a partir de un link de Spotify**, que es una sola llamada
a la API pública de iTunes, sin autenticación.

**Y hay un segundo hallazgo que refuerza el punto:** el episodio **#173 se llama "HARNESS de IA:
el código que POTENCIA a los AGENTES"**. Le pega directo a los arneses de Freddy. **El Lab
tampoco lo vio.**

**Diagnóstico honesto:** el Lab tiene ojos (visión), tiene criterio (matching), tiene memoria —
**y una fuente de las tres que sigue muda.** De las 14 fuentes cargadas, el colector solo
alcanza a 4: los YouTube. Instagram requiere ingesta manual (funcionó hoy) y podcasts **no
tiene ingesta**.

**VEREDICTO: `TEST_NOW`.** Es el arreglo más barato con más impacto de todo este informe.

---

## 14. VEREDICTOS

| Tecnología / patrón | Veredicto | Por qué |
|---|---|---|
| **Make como orquestador de Freddy OS** | **`LATER`** | No alcanza `localhost` sin exponer la PC. Nuestro problema es lógica de intake, no transporte |
| **Make MCP Server** | **`WATCH`** | Documentado oficialmente, pero sin artefacto público auditable |
| **Make para SaaS→SaaS futuro** | **`WATCH`** | Si algún día hay que conectar servicios cloud entre sí, vuelve a la mesa |
| **Patrón conductor + workers (Reel A)** | **`ALREADY_HAVE`** | `freddy-agent-os/agents/` ya lo define |
| **Repo "bennett-os"** | **`REJECT`** | No existe públicamente. No verificable |
| **Arquitectura canales→ruteo→cerebro (Reel B)** | **`ALREADY_HAVE`** | Es el Intake Core del Slice 1 |
| **Directorio de personas con roles (Reel B)** | **`LATER`** | Idea buena. Hoy Freddy es una sola persona |
| **Ingesta de podcasts en el Lab** | **`TEST_NOW`** | El RSS existe, el parser existe, falta el puente |

---

## 15. IMPACTO SOBRE EL PLAN ACTUAL

# SEGUIMOS CON META CLOUD API + ADAPTADOR PROPIO.

**La evidencia nueva no justifica cambiar el diseño. Lo refuerza.**

Tres razones:

1. **Make no resuelve nuestro problema.** El nuestro es *"qué sabemos, qué falta, qué preguntar"*
   — construido y validado. Make resuelve transporte entre servicios cloud, que no es donde
   estamos trabados.
2. **Choca de frente con el local-first.** Freddy OS vive en tu PC a propósito. Make obligaría
   a exponerla. Es el mismo riesgo por el que decidimos no automatizar el banco.
3. **Reel B valida el camino.** Una implementación real en una empresa argentina hace
   exactamente lo que íbamos a hacer: WhatsApp como canal, ruteo al cerebro, y **las claves
   guardadas localmente**. Alguien más llegó a la misma arquitectura por su cuenta.

**Lo único que cambia:** anotar el **directorio de personas con roles** como necesidad futura,
para cuando cargue más de una persona.

---

## 16. PRÓXIMO EXPERIMENTO — el único `TEST_NOW`

**No es de WhatsApp. Es del Lab.**

> **Darle oído al Lab.** Resolver el RSS de un podcast desde su link de Spotify vía la API
> pública de iTunes, guardarlo en `sources.metadata.rss`, y dejar que el colector que **ya
> existe** haga el resto.
>
> **Costo:** una llamada HTTP sin autenticación. **Sin dependencias nuevas.**
> **Efecto inmediato:** 178 episodios entran al radar, incluidos el #175 (Make) y el #173
> (harness de IA).
>
> **Medición:** que el Lab hubiera traído el #175 **antes** de que vos lo encontraras a mano.

No lo implementé — este sprint es research only.

---

## Nota de método

Este sprint funcionó como debía: **la evidencia nueva no cambió el rumbo, lo confirmó** — y de
paso encontró un agujero en el propio Lab que ninguna de las cuatro fuentes iba a revelar.

Y una limitación que quedó a la vista: el pipeline de visión **corta en 24 frames**. El Reel B
tenía 188 candidatos, así que **solo se analizaron los primeros ~48 segundos**. Para videos
largos hoy vemos el principio y nada más. No lo toqué, pero está anotado.
