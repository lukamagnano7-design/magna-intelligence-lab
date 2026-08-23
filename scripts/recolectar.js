#!/usr/bin/env node
// Recorre las fuentes activas y guarda lo nuevo en `items`.
// Uso:
//   node scripts/recolectar.js                  todas las activas
//   node scripts/recolectar.js --platform youtube
//   node scripts/recolectar.js --nuevos         muestra lo que entro
//
// Es idempotente: correrlo dos veces seguidas trae 0 nuevos la segunda.
// Este es el script que despues va a correr solo, todos los dias.

const db = require('../lib/db');
const { recolectar } = require('../lib/feeds');

const args = process.argv.slice(2);
const plat = args.includes('--platform') ? args[args.indexOf('--platform') + 1] : null;

(async () => {
  const fuentes = db.all(
    `SELECT * FROM sources WHERE active = 1 ${plat ? 'AND platform = ?' : ''}
     ORDER BY priority DESC, handle`, ...(plat ? [plat] : []));

  if (!fuentes.length) { console.log('No hay fuentes activas.'); db.close(); return; }
  console.log(`Recorriendo ${fuentes.length} fuentes activas...\n`);

  const inicio = Date.now();
  let totalNuevos = 0, fallidas = 0;

  for (const src of fuentes) {
    const run = db.run(
      `INSERT INTO agent_runs (agent_name, task_type, input_refs, status)
       VALUES ('colector', 'recolectar', ?, 'running')`,
      JSON.stringify([{ source: src.handle, platform: src.platform }]));
    const runId = db.get('SELECT id FROM agent_runs WHERE rowid = ?', run.lastInsertRowid).id;

    const r = await recolectar(src);
    totalNuevos += r.nuevos;
    if (r.error) fallidas++;

    db.run(`UPDATE agent_runs SET status = ?, error = ?, output = ?, finished_at = datetime('now')
            WHERE id = ?`,
      r.error ? 'error' : 'ok', r.error, JSON.stringify(r), runId);

    const etiqueta = r.error ? `FALLA (${r.error})`
      : r.nuevos ? `${r.nuevos} nuevos de ${r.total}` : `sin novedades (${r.total} vistos)`;
    console.log(`  ${r.error ? '✗' : '✓'} ${String(src.handle).padEnd(24)} ${etiqueta}`);
  }

  console.log(`\n${totalNuevos} items nuevos · ${fallidas} fuentes con error · ${((Date.now() - inicio) / 1000).toFixed(1)}s`);
  console.log(`items en la base: ${db.count('items')}`);

  if (args.includes('--nuevos') && totalNuevos) {
    console.log('\nLo ultimo que entro:');
    for (const i of db.all(
      `SELECT i.title, i.url, s.handle FROM items i JOIN sources s ON s.id = i.source_id
       ORDER BY i.created_at DESC, i.published_at DESC LIMIT 10`))
      console.log(`  [${i.handle}] ${String(i.title).slice(0, 70)}\n     ${i.url}`);
  }
  db.close();
})();
