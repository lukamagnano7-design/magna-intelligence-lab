-- Magna Intelligence Lab - schema V1 (SQLite)
-- Portado del schema Postgres que disenio ChatGPT (17/08/2026).
-- Cambios y por que: ver docs/DECISIONS.md (D-001, D-003).
--   * uuid        -> TEXT con lower(hex(randomblob(16)))
--   * timestamptz -> TEXT ISO-8601 via datetime('now')
--   * jsonb       -> TEXT con JSON (SQLite json1)
--   * text[]      -> TEXT con array JSON
--   * knowledge_chunks + pgvector: NO se portan. Graphify ya cubre la capa semantica.

PRAGMA foreign_keys = ON;

-- Los negocios y sistemas contra los que se evalua todo.
CREATE TABLE IF NOT EXISTS projects (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  slug        TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  stack       TEXT NOT NULL DEFAULT '{}',
  constraints TEXT NOT NULL DEFAULT '{}',
  status      TEXT NOT NULL DEFAULT 'active',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- El Business Problem Radar. Sin esto el matching engine no tiene contra que cruzar.
-- REGLA: solo se cargan problemas con evidencia real del cliente. No se inventan necesidades.
-- Los tres scores van NULL hasta que haya evidencia para valorarlos.
CREATE TABLE IF NOT EXISTS problems (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  code            TEXT UNIQUE NOT NULL,
  project_id      TEXT REFERENCES projects(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  category        TEXT,
  severity        INTEGER CHECK (severity        IS NULL OR severity        BETWEEN 1 AND 10),
  frequency       INTEGER CHECK (frequency       IS NULL OR frequency       BETWEEN 1 AND 10),
  economic_impact INTEGER CHECK (economic_impact IS NULL OR economic_impact BETWEEN 1 AND 10),
  current_process TEXT,           -- como lo resuelve HOY
  workaround      TEXT,           -- el Excel / el papel / el parche
  -- Si no hay datos suficientes para matchear con confianza, se DICE. Un score fabricado
  -- sobre un problema mal documentado contamina todas las decisiones que vengan despues.
  data_status     TEXT NOT NULL DEFAULT 'OK'
                  CHECK (data_status IN ('OK','INSUFFICIENT_PROBLEM_DATA')),
  data_gap        TEXT,           -- que falta exactamente. Es la pregunta para el cliente.
  evidence        TEXT NOT NULL,  -- de donde salio. Sin fuente no entra.
  status          TEXT NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open','solved','wont_fix','superseded')),
  tags            TEXT NOT NULL DEFAULT '[]',
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Las fuentes que vigilan los radares (creadores de GitHub, cuentas IG, canales, podcasts...).
-- Dos radares, porque no se evaluan igual (decision Luka 18/08):
--   'tecnico' -> skills, repos, MCPs, agentes. Se le pide constancia de commits.
--   'negocio' -> pricing, ofertas, como se vende software a PyMEs. Se le pide empresa real.
-- A Hormozi no le pedis commits; a un dev no le pedis facturacion.
CREATE TABLE IF NOT EXISTS sources (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  platform    TEXT NOT NULL,
  source_type TEXT NOT NULL,
  handle      TEXT,
  url         TEXT,
  radar       TEXT NOT NULL DEFAULT 'tecnico' CHECK (radar IN ('tecnico','negocio','ambos')),
  priority    INTEGER NOT NULL DEFAULT 5,
  active      INTEGER NOT NULL DEFAULT 1,
  metadata    TEXT NOT NULL DEFAULT '{}',
  -- SALUD (LAB-BRIEF-001): la fuente del podcast estuvo 7 dias fallando en silencio y
  -- nadie se entero hasta que Luka encontro el episodio a mano. Una fuente que falla
  -- repetidamente ES informacion relevante y tiene que llegar al brief sola.
  last_attempt  TEXT,
  last_success  TEXT,
  last_error    TEXT,
  fallas_seguidas INTEGER NOT NULL DEFAULT 0,
  items_ultima_corrida INTEGER,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (platform, handle)
);

-- Cada pieza cruda que entra. fingerprint UNIQUE = el anti-duplicado.
CREATE TABLE IF NOT EXISTS items (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  source_id    TEXT REFERENCES sources(id) ON DELETE SET NULL,
  external_id  TEXT,
  item_type    TEXT NOT NULL,
  title        TEXT,
  url          TEXT,
  published_at TEXT,
  raw_text     TEXT,
  raw_metadata TEXT NOT NULL DEFAULT '{}',
  fingerprint  TEXT UNIQUE,
  status       TEXT NOT NULL DEFAULT 'new'
               CHECK (status IN ('new','researching','researched','discarded')),
  -- COBERTURA (LAB-INGEST-001): decir analizado cuando se vieron 48 de 376 segundos es
  -- mentir por omision. El Reel B tenia 188 frames candidatos y se procesaron 24: el 13%.
  -- Un veredicto sobre el 13% de una fuente no vale lo mismo que uno sobre el 100%, y el
  -- brief tiene que poder decirlo.
  coverage     TEXT CHECK (coverage IS NULL OR coverage IN ('COMPLETE','PARTIAL','NONE')),
  coverage_pct REAL,
  coverage_nota TEXT,
  -- Duracion real del medio, medida con ffprobe ANTES de analizarlo (LAB-DEEP-001).
  -- Es el DENOMINADOR de coverage_pct. Sin este dato, cualquier porcentaje de cobertura lo
  -- fija el mismo proceso que lo consume, y siempre da bien.
  duracion_s   REAL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Las SENIALES crudas de un item. Un video tiene varias y ninguna manda sola.
-- 'metadata' (titulo/descripcion/capitulos) · 'transcript' (audio) · 'frame_ocr' (pantalla).
-- Existe como tabla propia porque el pipeline es multi-senial por diseno: el OCR es UNA
-- herramienta, no la arquitectura (correccion de Luka, 24/08/2026).
CREATE TABLE IF NOT EXISTS signals (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  item_id     TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('metadata','transcript','frame_ocr','caption','manual')),
  content     TEXT NOT NULL,
  extractor   TEXT NOT NULL,   -- que lo produjo, para poder auditar
  metadata    TEXT NOT NULL DEFAULT '{}',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (item_id, kind, extractor)
);

-- FOTOGRAMAS analizados. Uno por frame que sobrevivio a la seleccion y la deduplicacion.
-- El contrato deja lugar para observaciones de un modelo visual que todavia no tenemos:
-- 'observations' y 'visual_entities' quedan vacios hasta que exista. No se inventan.
CREATE TABLE IF NOT EXISTS frames (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  item_id         TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  ts_seconds      REAL NOT NULL,          -- momento exacto del video
  phash           TEXT,                   -- huella perceptual, para deduplicar
  ocr_text        TEXT,                   -- texto crudo leido en pantalla
  ocr_confidence  REAL,
  visual_entities TEXT NOT NULL DEFAULT '[]',  -- reservado para modelo visual
  observations    TEXT NOT NULL DEFAULT '[]',  -- reservado para modelo visual
  extractor       TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (item_id, ts_seconds)
);

-- PROVENANCE: de donde salio cada entidad. Nunca alcanza con "el Lab detecto X":
-- hay que poder preguntar POR QUE y obtener evidencia con timestamp.
-- Una entidad puede tener varias filas: transcript + OCR + metadata. Ahi esta la fusion.
CREATE TABLE IF NOT EXISTS entity_evidence (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  entity_id   TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  signal_kind TEXT NOT NULL,   -- metadata · transcript · frame_ocr · visual
  frame_id    TEXT REFERENCES frames(id) ON DELETE SET NULL,
  ts_seconds  REAL,            -- cuando, si la senial es temporal
  snippet     TEXT NOT NULL,   -- el fragmento exacto que la sostiene
  confidence  REAL NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ENTIDADES DETECTADAS, antes de resolverlas. Es una MENCION, no una verdad.
-- Puede ser un repo, una skill, un MCP, un framework, una empresa, una persona o una tecnica.
-- Se guarda de que senial salio y con que confianza: una URL visible vale mas que un nombre
-- dicho al pasar, y eso tiene que quedar registrado.
CREATE TABLE IF NOT EXISTS entities (
  id             TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  item_id        TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  signal_id      TEXT REFERENCES signals(id) ON DELETE SET NULL,
  raw_mention    TEXT NOT NULL,   -- tal cual aparecio
  entity_type    TEXT NOT NULL CHECK (entity_type IN
                 ('repository','skill','mcp','framework','tool','company','person','url','technique','unknown')),
  normalized     TEXT,            -- nombre canonico, si se pudo normalizar
  confidence     REAL NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  -- Escala nombrada, derivada de CUANTAS seniales independientes la sostienen.
  -- VERY_HIGH exige convergencia: transcript + OCR, o una URL exacta confirmada.
  confidence_label TEXT CHECK (confidence_label IN ('LOW','MEDIUM','HIGH','VERY_HIGH')),
  signal_count   INTEGER NOT NULL DEFAULT 1,
  -- por que NO se resolvio, cuando no se resolvio. Un hueco explicado vale mas que uno mudo.
  resolution_status TEXT NOT NULL DEFAULT 'pending'
                    CHECK (resolution_status IN ('pending','resolved','unresolvable','discarded')),
  discard_reason TEXT,            -- ej: link de afiliado, no es tecnologia
  technology_id  TEXT REFERENCES technologies(id) ON DELETE SET NULL,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- La tecnologia ya verificada contra su FUENTE PRIMARIA, no contra el Reel.
CREATE TABLE IF NOT EXISTS technologies (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name              TEXT NOT NULL,
  canonical_url     TEXT UNIQUE,
  category          TEXT,
  summary           TEXT,
  license           TEXT,
  maturity_score    REAL,
  maintenance_score REAL,
  risk_score        REAL,
  metadata          TEXT NOT NULL DEFAULT '{}',
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- La ficha de investigacion. Mismo contrato que freddy-agent-os/skills/external_repo_research.
CREATE TABLE IF NOT EXISTS research_reports (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  item_id         TEXT REFERENCES items(id) ON DELETE CASCADE,
  technology_id   TEXT REFERENCES technologies(id) ON DELETE SET NULL,
  primary_sources TEXT NOT NULL DEFAULT '[]',
  claims          TEXT NOT NULL DEFAULT '[]',   -- lo que PROMETE el creador
  findings        TEXT NOT NULL DEFAULT '[]',   -- lo que HACE de verdad
  architecture    TEXT,
  installation    TEXT,
  dependencies    TEXT NOT NULL DEFAULT '[]',
  risks           TEXT NOT NULL DEFAULT '[]',
  conclusion      TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- La taxonomia de capacidades: la capa semantica entre tecnologia y problema.
-- Existe para NO matchear por parecido de palabras, que seria el mismo error que
-- 'Polar' matcheando dentro de 'GRUPOLAR'. Ver seed/capabilities.json.
CREATE TABLE IF NOT EXISTS capabilities (
  id          TEXT PRIMARY KEY,           -- slug estable: 'document_generation'
  nombre      TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Que capacidades NECESITA un problema. 'required' = sin eso no se resuelve.
CREATE TABLE IF NOT EXISTS problem_capabilities (
  problem_id    TEXT NOT NULL REFERENCES problems(id)     ON DELETE CASCADE,
  capability_id TEXT NOT NULL REFERENCES capabilities(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL CHECK (kind IN ('required','useful')),
  PRIMARY KEY (problem_id, capability_id, kind)
);

-- Que capacidades OFRECE una tecnologia, y con cuanta confianza lo sabemos.
-- 'curado' = alguien lo verifico. 'inferido' = salio de leer el README, y vale menos.
CREATE TABLE IF NOT EXISTS technology_capabilities (
  technology_id TEXT NOT NULL REFERENCES technologies(id) ON DELETE CASCADE,
  capability_id TEXT NOT NULL REFERENCES capabilities(id) ON DELETE CASCADE,
  origen        TEXT NOT NULL CHECK (origen IN ('curado','inferido','declarado')),
  evidencia     TEXT,
  PRIMARY KEY (technology_id, capability_id)
);

-- El Matching Engine. Un match NO es un numero: es un argumento con evidencia.
-- Incluye NO_MATCH explicito, porque "esto no resuelve nada nuestro" es una conclusion
-- valiosa y NO desmerece la calidad tecnica de la herramienta.
CREATE TABLE IF NOT EXISTS matches (
  id                   TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  technology_id        TEXT NOT NULL REFERENCES technologies(id) ON DELETE CASCADE,
  project_id           TEXT NOT NULL REFERENCES projects(id)     ON DELETE CASCADE,
  problem_id           TEXT REFERENCES problems(id) ON DELETE SET NULL,
  outcome              TEXT NOT NULL DEFAULT 'MATCH'
                       CHECK (outcome IN ('MATCH','NO_MATCH','INSUFFICIENT_PROBLEM_DATA')),
  matched_capabilities TEXT NOT NULL DEFAULT '[]',
  missing_capabilities TEXT NOT NULL DEFAULT '[]',
  confidence           TEXT CHECK (confidence IN ('HIGH','MEDIUM','LOW')),
  relevance_score      REAL CHECK (relevance_score      BETWEEN 0 AND 10),
  implementation_score REAL CHECK (implementation_score BETWEEN 0 AND 10),
  business_value_score REAL CHECK (business_value_score BETWEEN 0 AND 10),
  argument             TEXT NOT NULL,   -- el porque, en castellano
  evidence             TEXT,
  recommended_action   TEXT,
  created_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Nada entra a produccion sin pasar por aca primero.
CREATE TABLE IF NOT EXISTS experiments (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  technology_id TEXT REFERENCES technologies(id) ON DELETE SET NULL,
  project_id    TEXT REFERENCES projects(id)     ON DELETE SET NULL,
  title         TEXT NOT NULL,
  hypothesis    TEXT,
  protocol      TEXT,
  sandbox_path  TEXT,
  status        TEXT NOT NULL DEFAULT 'planned'
                CHECK (status IN ('planned','running','done','aborted')),
  result        TEXT NOT NULL DEFAULT '{}',
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at  TEXT
);

-- Decision Memory: el POR QUE, para que dentro de 6 meses no se reinvestigue desde cero.
CREATE TABLE IF NOT EXISTS decisions (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  code          TEXT UNIQUE,
  technology_id TEXT REFERENCES technologies(id) ON DELETE SET NULL,
  project_id    TEXT REFERENCES projects(id)     ON DELETE SET NULL,
  experiment_id TEXT REFERENCES experiments(id)  ON DELETE SET NULL,
  verdict       TEXT NOT NULL CHECK (verdict IN
                ('ADOPT','TEST_NOW','WATCH','LATER','REJECT','ALREADY_HAVE_BETTER','NEEDS_DEEP_RESEARCH')),
  rationale     TEXT NOT NULL,
  alternatives  TEXT NOT NULL DEFAULT '[]',
  tradeoffs     TEXT,
  decided_by    TEXT NOT NULL DEFAULT 'human',
  superseded_by TEXT REFERENCES decisions(id),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Observabilidad: que hizo cada agente, cuando, con que entrada y que devolvio.
CREATE TABLE IF NOT EXISTS agent_runs (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  agent_name  TEXT NOT NULL,
  task_type   TEXT NOT NULL,
  input_refs  TEXT NOT NULL DEFAULT '[]',
  output      TEXT NOT NULL DEFAULT '{}',
  status      TEXT NOT NULL CHECK (status IN ('running','ok','error','skipped')),
  error       TEXT,
  started_at  TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_frames_item     ON frames(item_id, ts_seconds);
CREATE INDEX IF NOT EXISTS idx_evidence_entity ON entity_evidence(entity_id);
CREATE INDEX IF NOT EXISTS idx_signals_item     ON signals(item_id, kind);
CREATE INDEX IF NOT EXISTS idx_entities_item    ON entities(item_id, resolution_status);
CREATE INDEX IF NOT EXISTS idx_problems_project ON problems(project_id, status);
CREATE INDEX IF NOT EXISTS idx_items_status     ON items(status, created_at);
CREATE INDEX IF NOT EXISTS idx_matches_project  ON matches(project_id, relevance_score DESC);
CREATE INDEX IF NOT EXISTS idx_agent_runs_name  ON agent_runs(agent_name, started_at DESC);
