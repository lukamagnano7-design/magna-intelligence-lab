#!/usr/bin/env node
// El Business Problem Radar en consola.
// Uso:
//   node scripts/problemas.js                    todos, agrupados por proyecto
//   node scripts/problemas.js distributor-lab    solo un proyecto
//   node scripts/problemas.js --bloqueantes      solo los que esperan al cliente
//   node scripts/problemas.js DIST-PED-001       la ficha completa de uno

const db = require('../lib/db');
const arg = process.argv[2];

if (arg && /^[A-Z]+-[A-Z]+-\d+$/.test(arg)) {
  const p = db.get(`SELECT pr.*, pj.name AS proyecto FROM problems pr
                    JOIN projects pj ON pj.id = pr.project_id WHERE pr.code = ?`, arg);
  if (!p) { console.error(`No existe ${arg}`); process.exit(1); }
  const val = (v) => v ?? '- sin valorar -';
  console.log(`\n${p.code}  ${p.title}\n${'='.repeat(60)}`);
  console.log(`Proyecto   : ${p.proyecto}`);
  console.log(`Categoria  : ${p.category}`);
  console.log(`Estado     : ${p.status}`);
  console.log(`\n${p.description}\n`);
  console.log(`Hoy lo resuelve asi : ${p.current_process ?? '-'}`);
  console.log(`Workaround          : ${p.workaround ?? '-'}`);
  console.log(`\nSeveridad ${val(p.severity)}/10 · Frecuencia ${val(p.frequency)}/10 · Impacto economico ${val(p.economic_impact)}/10`);
  console.log(`Tags       : ${JSON.parse(p.tags).join(', ') || '-'}`);
  console.log(`\nEVIDENCIA  : ${p.evidence}\n`);
  db.close();
  process.exit(0);
}

const soloBloq = arg === '--bloqueantes';
const filtro = arg && !soloBloq ? 'AND pj.slug = ?' : '';
const rows = db.all(
  `SELECT pr.code, pr.title, pr.category, pr.severity, pr.frequency,
          pr.economic_impact, pr.tags, pj.slug AS pslug, pj.name AS proyecto
   FROM problems pr JOIN projects pj ON pj.id = pr.project_id
   WHERE pr.status = 'open' ${filtro}
   ORDER BY pj.slug, pr.code`, ...(arg && !soloBloq ? [arg] : []));

const vis = soloBloq ? rows.filter(r => JSON.parse(r.tags).includes('bloqueante')) : rows;
if (!vis.length) { console.log('Nada que mostrar.'); db.close(); process.exit(0); }

let actual = null;
for (const r of vis) {
  if (r.pslug !== actual) { console.log(`\n${r.proyecto}\n${'-'.repeat(60)}`); actual = r.pslug; }
  const marca = JSON.parse(r.tags).includes('bloqueante') ? ' [BLOQUEANTE]' : '';
  const sc = (r.severity == null || r.economic_impact == null)
    ? 'sin valorar' : `sev ${r.severity} · frec ${r.frequency} · $ ${r.economic_impact}`;
  console.log(`  ${r.code}  ${r.title}${marca}`);
  console.log(`  ${' '.repeat(r.code.length)}  ${r.category} · ${sc}`);
}

const faltan = vis.filter(r => r.severity == null || r.economic_impact == null).length;
console.log(`\n${vis.length} problemas abiertos · ${faltan} sin valorar (se valoran con el cliente).`);
db.close();
