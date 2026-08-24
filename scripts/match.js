#!/usr/bin/env node
// Cruza UNA tecnologia contra todos los problemas y muestra el resultado explicado.
// Sirve para inspeccionar el matcher sin volver a analizar un video entero.
//
//   node scripts/match.js "Stripe"
//   node scripts/match.js anthropics/skills
//   node scripts/match.js --listar

const db = require('../lib/db');
const capacidades = require('../lib/capacidades');
const matcher = require('../lib/matcher');

const arg = process.argv[2];

if (!arg || arg === '--listar') {
  console.log('\nTecnologias en la base:\n');
  for (const t of db.all(`SELECT t.name, t.canonical_url, count(tc.capability_id) AS caps
                          FROM technologies t
                          LEFT JOIN technology_capabilities tc ON tc.technology_id = t.id
                          GROUP BY t.id ORDER BY t.name`))
    console.log(`  ${t.name.padEnd(28)} ${String(t.caps).padStart(2)} capacidades  ${t.canonical_url ?? ''}`);
  console.log('\nTambien podes pasar un nombre del registro curado aunque no este en la base.\n');
  db.close(); process.exit(0);
}

// Si no esta en la base pero SI en el registro curado, se registra al vuelo.
let tech = db.get('SELECT * FROM technologies WHERE name = ? COLLATE NOCASE', arg);
let det;
if (!tech) {
  if (!capacidades.CURADO[arg]) {
    console.error(`No conozco "${arg}". Corré --listar para ver las que hay.`);
    process.exit(1);
  }
  const id = capacidades.registrar(arg, null, null);
  tech = db.get('SELECT * FROM technologies WHERE id = ?', id);
}
det = capacidades.determinar({ nombre: tech.name, repo: tech.name });
capacidades.guardar(tech.id, det.caps);

console.log(`\n${'='.repeat(72)}\n${tech.name}\n${'='.repeat(72)}`);
console.log('\nCAPACIDADES QUE OFRECE');
if (det.caps.length) for (const c of det.caps) console.log(`  · ${c.capability_id} [${c.origen}]`);
else {
  console.log('  ninguna de nuestra taxonomia');
  if (det.nota_curada) console.log(`  ↳ ${det.nota_curada}`);
}

const r = matcher.cruzar(tech.id, { determinado: Boolean(det.determinado) });
matcher.guardar(tech.id, r);

console.log('\nRELEVANCIA DE NEGOCIO');
if (r.sin_base) {
  console.log('\n  SIN BASE: no sabemos que capacidades tiene, asi que no se puede opinar.');
  console.log('  Distinto de NO_MATCH: eso seria afirmar que no sirve.');
} else if (!r.matches.length) {
  console.log('\n     >>> NO_MATCH <<<\n');
  console.log('  No resuelve ninguno de nuestros problemas documentados.');
  console.log('  Es una conclusion de NEGOCIO, no un juicio tecnico sobre la herramienta.');
} else {
  for (const m of r.matches) {
    console.log(`\n  MATCH · ${m.problema.code} · ${m.confidence} · relevancia ${m.relevance_score}/10`);
    console.log(`    ${m.problema.title}`);
    console.log(`    ${m.argument}`);
  }
}
console.log(`\n  ${r.matches.length} match · ${r.no_matches.length} no-match · ${r.insuficientes.length} datos insuficientes\n`);
db.close();
