#!/usr/bin/env node
// Monta lab.db desde db/schema.sql y carga el seed. Idempotente: se puede correr mil veces.
// Uso: node scripts/init_db.js  [--reset]

const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const DB_PATH = path.join(ROOT, 'lab.db');
const reset = process.argv.includes('--reset');

if (reset && fs.existsSync(DB_PATH)) {
  fs.rmSync(DB_PATH);
  console.log('lab.db borrada (--reset)');
}

const db = new DatabaseSync(DB_PATH);
db.exec(fs.readFileSync(path.join(ROOT, 'db', 'schema.sql'), 'utf8'));
console.log('schema aplicado');

const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'seed', f), 'utf8'));

// --- proyectos ---
const upProject = db.prepare(`
  INSERT INTO projects (slug, name, description, stack, constraints, status)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(slug) DO UPDATE SET
    name=excluded.name, description=excluded.description, stack=excluded.stack,
    constraints=excluded.constraints, status=excluded.status, updated_at=datetime('now')
`);
for (const p of read('projects.json')) {
  upProject.run(p.slug, p.name, p.description, JSON.stringify(p.stack ?? {}),
                JSON.stringify(p.constraints ?? {}), p.status ?? 'active');
}

const projectId = {};
for (const r of db.prepare('SELECT id, slug FROM projects').all()) projectId[r.slug] = r.id;

// --- problemas ---
// evidence es NOT NULL a proposito: un problema sin fuente no entra al radar.
const upProblem = db.prepare(`
  INSERT INTO problems (code, project_id, title, description, category,
                        severity, frequency, economic_impact,
                        current_process, workaround, evidence, tags)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(code) DO UPDATE SET
    title=excluded.title, description=excluded.description, category=excluded.category,
    severity=excluded.severity, frequency=excluded.frequency,
    economic_impact=excluded.economic_impact, current_process=excluded.current_process,
    workaround=excluded.workaround, evidence=excluded.evidence, tags=excluded.tags
`);
let sinValorar = 0;
for (const p of read('problems.json')) {
  const pid = projectId[p.project];
  if (!pid) throw new Error(`problema ${p.code}: proyecto '${p.project}' no existe en seed/projects.json`);
  if (!p.evidence) throw new Error(`problema ${p.code}: sin evidencia. No se carga.`);
  if (p.severity == null || p.economic_impact == null) sinValorar++;
  upProblem.run(p.code, pid, p.title, p.description ?? null, p.category ?? null,
                p.severity ?? null, p.frequency ?? null, p.economic_impact ?? null,
                p.current_process ?? null, p.workaround ?? null, p.evidence,
                JSON.stringify(p.tags ?? []));
}

const n = (q) => db.prepare(q).get().n;
console.log(`\nproyectos : ${n('SELECT count(*) n FROM projects')}`);
console.log(`problemas : ${n('SELECT count(*) n FROM problems')}`);
console.log(`\n${sinValorar} problemas sin severity/economic_impact.`);
console.log('Eso es correcto: se valoran CON Guille, no por nuestra cuenta.');
console.log(`\nlab.db -> ${DB_PATH}`);
db.close();
