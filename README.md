# Magna Intelligence Lab

Sistema permanente de investigación, experimentación y memoria.

**Misión:** multiplicar la capacidad de una persona para aprender, investigar, probar y aplicar
tecnología útil a problemas empresariales reales.

**No es un agregador de links.** Un Reel o un repo con estrellas es un *detector de
oportunidad*, nunca una conclusión. Toda recomendación se verifica contra su **fuente
primaria** antes de emitir veredicto.

---

## El loop

```
NEGOCIO REAL → PROBLEMA → INVESTIGACIÓN → TECNOLOGÍA → EXPERIMENTO
     ↑                                                      ↓
     └──────── MEMORIA ← DECISIÓN ← RESULTADO ←─────────────┘
```

Los dos radares que se cruzan:

- **Tech Radar** — qué está apareciendo en el mundo (`sources` → `items` → `technologies`).
- **Business Problem Radar** — qué nos duele de verdad (`problems`).
- **Matching Engine** — el cruce (`matches`), con tres ejes: relevancia, dificultad de
  implementación y valor de negocio. Separados a propósito: algo puede ser 10 en relevancia
  y 2 en implementación, y con un solo score eso se pierde.

---

## Estado

| Pieza | Estado |
|---|---|
| Schema (11 tablas, SQLite) | ✅ |
| Registro de proyectos (6) | ✅ |
| Business Problem Radar | ✅ 10 problemas de La Gene, con evidencia |
| Tech Radar / ingesta GitHub | ⏳ siguiente |
| Matching Engine | ⏳ |
| Experimentos | ⏳ |
| Tablero TODAY | ⏳ |

---

## Uso

```bash
node scripts/init_db.js              # monta lab.db y carga el seed (idempotente)
node scripts/init_db.js --reset      # desde cero

node scripts/problemas.js                  # el radar completo
node scripts/problemas.js distributor-lab  # un proyecto
node scripts/problemas.js --bloqueantes    # lo que espera respuesta del cliente
node scripts/problemas.js DIST-PED-001     # la ficha de uno
```

Requiere **Node ≥ 22** (usa `node:sqlite`, nativo). Sin dependencias externas.

---

## Cómo se agrega un problema

Se edita [`seed/problems.json`](seed/problems.json) y se corre `init_db.js`. Es idempotente.

**Reglas que el código hace cumplir** (ver D-006):

- `evidence` es obligatorio. Sin fuente verificable, no entra.
- `severity` y `economic_impact` arrancan en `null`. **Se valoran con el cliente**, no por
  nuestra cuenta. Un radar lleno de dolores inventados es peor que un radar vacío.

---

## Relación con el resto del ecosistema

Este repo **no reemplaza nada**. `freddy-agent-os/` sigue siendo la **memoria canónica del
negocio** — reglas, workflows, errores conocidos, agentes. El Lab la referencia por path y no
la duplica. **Ante contradicción, gana `freddy-agent-os`.**

| Qué | Dónde |
|---|---|
| Memoria canónica de negocio | `kit-dashboard-facturas/freddy-agent-os/` |
| Patrón de investigación de repos externos | `freddy-agent-os/skills/external_repo_research/` |
| Sandbox de experimentos | `C:\AI-SANDBOX` |
| App de Freddy (producción) | `C:\dev\magna-pyme-os` |
| App de pedidos de La Gene | `C:\dev\magna-pedidos-lagene` |
| Magna OS Familiar | `~/MagnaOS-Familiar` |

Las decisiones de arquitectura y su porqué: [`docs/DECISIONS.md`](docs/DECISIONS.md).

---

## Ley

**Ningún agente del Lab toca producción.** Puede leer, clonar, investigar, instalar en sandbox,
medir y recomendar. Entre el veredicto y producción hay siempre una decisión humana.

## Créditos de diseño

El modelo de datos nació de un diseño de **ChatGPT** (17/08/2026) y se portó a SQLite tras el
discovery del ecosistema existente. Qué se conservó, qué cambió y por qué: `docs/DECISIONS.md`.
