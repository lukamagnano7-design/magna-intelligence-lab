#!/usr/bin/env node
// Monta lab.db desde db/schema.sql y carga el seed. Idempotente: se puede correr mil veces.
// Uso: node scripts/init_db.js [--reset]
//
// La fuente de verdad son los JSON de seed/, versionados en git. lab.db es DERIVADA:
// se borra y se reconstruye con este comando. Eso es lo que hace portable al Lab.

const fs = require('node:fs');
const path = require('node:path');
const db = require('../lib/db');

const ROOT = path.join(__dirname, '..');
const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'seed', f), 'utf8'));

if (process.argv.includes('--reset')) { db.reset(); console.log('lab.db borrada (--reset)'); }

db.applySchema();
console.log('schema aplicado');

db.tx(() => {
  // --- proyectos ---
  for (const p of read('projects.json')) {
    db.run(`INSERT INTO projects (slug, name, description, stack, constraints, status)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(slug) DO UPDATE SET
              name=excluded.name, description=excluded.description, stack=excluded.stack,
              constraints=excluded.constraints, status=excluded.status,
              updated_at=datetime('now')`,
      p.slug, p.name, p.description, JSON.stringify(p.stack ?? {}),
      JSON.stringify(p.constraints ?? {}), p.status ?? 'active');
  }

  const projectId = {};
  for (const r of db.all('SELECT id, slug FROM projects')) projectId[r.slug] = r.id;

  // --- problemas ---
  // evidence es NOT NULL a proposito: un problema sin fuente no entra al radar (D-006).
  for (const p of read('problems.json')) {
    const pid = projectId[p.project];
    if (!pid) throw new Error(`problema ${p.code}: proyecto '${p.project}' no existe`);
    if (!p.evidence) throw new Error(`problema ${p.code}: sin evidencia. No se carga.`);
    db.run(`INSERT INTO problems (code, project_id, title, description, category,
              severity, frequency, economic_impact, current_process, workaround, evidence, tags)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(code) DO UPDATE SET
              title=excluded.title, description=excluded.description, category=excluded.category,
              severity=excluded.severity, frequency=excluded.frequency,
              economic_impact=excluded.economic_impact, current_process=excluded.current_process,
              workaround=excluded.workaround, evidence=excluded.evidence, tags=excluded.tags`,
      p.code, pid, p.title, p.description ?? null, p.category ?? null,
      p.severity ?? null, p.frequency ?? null, p.economic_impact ?? null,
      p.current_process ?? null, p.workaround ?? null, p.evidence, JSON.stringify(p.tags ?? []));
  }

  // --- fuentes ---
  // Las claves que empiezan con "_" son comentarios del seed: se ignoran.
  for (const s of read('sources.json')) {
    if (!s.platform || !s.handle) continue;
    db.run(`INSERT INTO sources (platform, source_type, handle, url, radar, priority, active, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(platform, handle) DO UPDATE SET
              source_type=excluded.source_type, url=excluded.url, radar=excluded.radar,
              priority=excluded.priority, active=excluded.active, metadata=excluded.metadata`,
      s.platform, s.source_type ?? 'creator', s.handle, s.url ?? null,
      s.radar ?? 'tecnico', s.priority ?? 5, s.active === false ? 0 : 1,
      JSON.stringify({ notas: s.notas ?? null, channel_id: s.channel_id ?? null,
                       rss: s.rss ?? null, feed_status: s.feed_status ?? null,
                       nombre: s.nombre ?? null }));
  }
});

console.log(`\nproyectos : ${db.count('projects')}`);
console.log(`problemas : ${db.count('problems')}`);
console.log(`fuentes   : ${db.count('sources')}`);

const sinValorar = db.get(
  `SELECT count(*) AS n FROM problems WHERE severity IS NULL OR economic_impact IS NULL`).n;
console.log(`\n${sinValorar} problemas sin severity/economic_impact.`);
console.log('Eso es correcto: se valoran CON el cliente, no por nuestra cuenta.');
console.log(`\nlab.db -> ${db.DB_PATH}`);
db.close();
