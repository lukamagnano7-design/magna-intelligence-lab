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
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
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

-- El Matching Engine. Tres ejes separados a proposito:
-- algo puede ser 10 en relevancia y 2 en implementacion. Con un solo score, eso se pierde.
CREATE TABLE IF NOT EXISTS matches (
  id                   TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  technology_id        TEXT NOT NULL REFERENCES technologies(id) ON DELETE CASCADE,
  project_id           TEXT NOT NULL REFERENCES projects(id)     ON DELETE CASCADE,
  problem_id           TEXT REFERENCES problems(id) ON DELETE SET NULL,
  relevance_score      REAL NOT NULL CHECK (relevance_score      BETWEEN 0 AND 10),
  implementation_score REAL          CHECK (implementation_score BETWEEN 0 AND 10),
  business_value_score REAL          CHECK (business_value_score BETWEEN 0 AND 10),
  rationale            TEXT NOT NULL,   -- el porque. Un numero sin porque no sirve.
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

CREATE INDEX IF NOT EXISTS idx_problems_project ON problems(project_id, status);
CREATE INDEX IF NOT EXISTS idx_items_status     ON items(status, created_at);
CREATE INDEX IF NOT EXISTS idx_matches_project  ON matches(project_id, relevance_score DESC);
CREATE INDEX IF NOT EXISTS idx_agent_runs_name  ON agent_runs(agent_name, started_at DESC);
