#!/usr/bin/env node
// EL VERTICAL SLICE: un item atraviesa todo el Lab de punta a punta.
//
//   ITEM -> SENIALES -> ENTIDADES -> RESOLUCION -> FUENTE PRIMARIA
//        -> CONOCIMIENTO PREVIO -> CRUCE CON PROYECTOS -> 8 CRITERIOS -> VEREDICTO -> MEMORIA
//
// Uso:
//   node scripts/analizar.js <videoId | parte del titulo>
//   node scripts/analizar.js Eil0q3U7LwM --json

const db = require('../lib/db');
const { extraerSenales } = require('../lib/senales');
const { extraerEntidades } = require('../lib/entidades');
const { resolver } = require('../lib/fuente_primaria');
const conocimiento = require('../lib/conocimiento');
const { puntuar, cruzar, veredicto, CRITERIOS } = require('../lib/veredicto');

const arg = process.argv[2];
const jsonOut = process.argv.includes('--json');
if (!arg) { console.error('Uso: node scripts/analizar.js <videoId | titulo>'); process.exit(1); }

const linea = (t) => console.log(`\n${'='.repeat(76)}\n${t}\n${'='.repeat(76)}`);
const bloque = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 72 - t.length))}`);

(async () => {
  const item = db.get(
    `SELECT i.*, s.handle, s.platform, s.radar, s.id AS sid
     FROM items i JOIN sources s ON s.id = i.source_id
     WHERE i.external_id = ? OR i.title LIKE ? LIMIT 1`, arg, `%${arg}%`);
  if (!item) { console.error(`No encontre ningun item con "${arg}"`); process.exit(1); }

  const run = db.run(
    `INSERT INTO agent_runs (agent_name, task_type, input_refs, status)
     VALUES ('analista', 'vertical_slice', ?, 'running')`,
    JSON.stringify([{ item: item.external_id, title: item.title }]));
  const runId = db.get('SELECT id FROM agent_runs WHERE rowid = ?', run.lastInsertRowid).id;

  linea(`${item.title}`);
  console.log(`FUENTE    : ${item.handle} (${item.platform} · radar ${item.radar})`);
  console.log(`CONTENIDO : ${item.url}`);
  console.log(`FECHA     : ${(item.published_at || '').slice(0, 10)}`);

  // ---------------------------------------------------------------- 1. seniales
  bloque('1. SENIALES EXTRAIDAS');
  const sen = extraerSenales(item);
  for (const g of sen.guardadas) console.log(`  ✓ ${g.kind.padEnd(12)} ${g.chars} chars`);
  for (const s of sen.saltadas)  console.log(`  – ${s.kind.padEnd(12)} NO DISPONIBLE: ${s.motivo}`);
  for (const e of sen.errores)   console.log(`  ✗ ${e.kind.padEnd(12)} ERROR: ${e.error}`);
  if (!sen.guardadas.length) console.log('  (ninguna senial: no se puede analizar)');

  // ---------------------------------------------------------------- 2. entidades
  bloque('2. ENTIDADES DETECTADAS');
  const ents = extraerEntidades(item.id);
  for (const e of ents) {
    const marca = e.estado === 'discarded' ? 'DESCARTADA' : `${(e.confidence * 100).toFixed(0)}%`;
    console.log(`  ${marca.padStart(10)}  [${e.entity_type}] ${e.normalized || e.raw_mention}`);
    if (e.descartar) console.log(`              ↳ ${e.descartar}`);
  }
  const vivas = ents.filter(e => e.estado !== 'discarded');
  console.log(`\n  ${vivas.length} entidades vivas · ${ents.length - vivas.length} descartadas`);

  // ---------------------------------------------------------------- 3. resolucion
  bloque('3. RESOLUCION A FUENTE PRIMARIA');
  const resoluciones = [];
  for (const e of vivas) {
    const r = await resolver(e);
    resoluciones.push({ entidad: e, res: r });
    if (r.encontrado) {
      console.log(`  ✓ ${e.normalized}  ->  ${r.url}`);
      db.run(`UPDATE entities SET resolution_status='resolved' WHERE item_id=? AND raw_mention=?`,
        item.id, e.raw_mention);
    } else {
      console.log(`  ? ${e.normalized || e.raw_mention}`);
      console.log(`      ${(r.motivo || '').slice(0, 150)}`);
    }
  }
  const principal = resoluciones.find(r => r.res.encontrado)?.res ?? null;

  // ---------------------------------------------------------------- 4. fuente primaria
  if (principal) {
    bloque('4. LA FUENTE PRIMARIA DICE');
    console.log(`  ${principal.nombre} · ${principal.descripcion ?? 'sin descripcion'}`);
    console.log(`  Licencia ${principal.licencia} · ${principal.stars} stars · ${principal.lenguaje}`);
    console.log(`  Mantenimiento: ${principal.mantenimiento} (ultimo push ${principal.ultimo_push})`);
    console.log(`  Dependencias : ${principal.dependencias?.ecosistema}`);
    if (principal.riesgos?.length) {
      console.log('  RIESGOS:');
      for (const r of principal.riesgos) console.log(`    ! ${r}`);
    }
  } else {
    bloque('4. LA FUENTE PRIMARIA');
    console.log('  Ninguna entidad se pudo resolver a una fuente oficial verificable.');
    console.log('  El Lab NO inventa una: prefiere decir que no sabe.');
  }

  // ---------------------------------------------------------------- 5. conocimiento previo
  bloque('5. ¿YA SABIAMOS ALGO DE ESTO?');
  const previos = vivas.slice(0, 6).map(e => conocimiento.revisar(e.normalized || e.raw_mention));
  let algoSabido = false;
  for (const p of previos) {
    if (!p.razones.length) continue;
    algoSabido = true;
    console.log(`  ${p.nombre}:`);
    for (const r of p.razones) console.log(`    · ${r.slice(0, 150)}`);
  }
  if (!algoSabido) console.log('  Nada previo. Es material nuevo para nosotros.');
  const yaResuelto = previos.find(p => p.ya_resuelto) ?? null;

  // ---------------------------------------------------------------- 6. cruce
  bloque('6. CRUCE CON NUESTROS PROYECTOS');
  for (const m of cruzar(null, principal))
    console.log(`  ${m.proyecto.slug.padEnd(24)} ${String(m.problemas_abiertos).padStart(2)} problemas abiertos · relevancia: ${m.relevancia ?? 'sin evaluar'}`);
  console.log('\n  No se fuerza ningun match: sin criterio, un numero acá seria inventado.');

  // ---------------------------------------------------------------- 7. criterios
  bloque('7. LOS 8 CRITERIOS');
  const scores = puntuar({
    fuente: { id: item.sid }, primaria: principal,
    conocimiento: { entidades: db.all('SELECT * FROM entities WHERE item_id = ?', item.id) },
  });
  for (const [k, desc] of CRITERIOS) {
    const s = scores[k];
    const val = s?.score == null ? ' n/d' : `${String(s.score).padStart(2)}/10`;
    console.log(`  ${val}  ${desc.split(':')[0].padEnd(22)} ${s?.porque ?? ''}`.slice(0, 118));
  }

  // ---------------------------------------------------------------- 8. veredicto
  const v = veredicto({ primaria: principal, conocimiento: yaResuelto, scores });
  bloque('8. VEREDICTO');
  console.log(`\n     >>> ${v.verdict} <<<\n`);
  console.log(`  POR QUE   : ${v.porque}`);
  console.log(`  SIGUIENTE : ${v.siguiente}`);

  // ---------------------------------------------------------------- 9. memoria
  db.tx(() => {
    db.run(`INSERT INTO research_reports (item_id, primary_sources, claims, findings,
              architecture, installation, dependencies, risks, conclusion)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      item.id,
      JSON.stringify(resoluciones.filter(r => r.res.encontrado).map(r => r.res.url)),
      JSON.stringify(vivas.map(e => e.normalized || e.raw_mention)),
      JSON.stringify(principal ? [principal.descripcion] : []),
      principal?.lenguaje ?? null, null,
      JSON.stringify(principal?.dependencias ?? {}),
      JSON.stringify(principal?.riesgos ?? []),
      `${v.verdict}: ${v.porque}`);
    db.run(`UPDATE items SET status = 'researched' WHERE id = ?`, item.id);
    db.run(`UPDATE agent_runs SET status='ok', finished_at=datetime('now'), output=? WHERE id=?`,
      JSON.stringify({ entidades: ents.length, resueltas: resoluciones.filter(r => r.res.encontrado).length,
                       verdict: v.verdict }), runId);
  });
  console.log(`\n  Guardado en research_reports · item marcado 'researched' · run ${runId.slice(0, 8)} registrado.`);

  if (jsonOut) console.log('\n' + JSON.stringify({ item, ents, resoluciones, scores, v }, null, 2));
  db.close();
})().catch(e => { console.error('\nFALLO:', e.message); process.exit(1); });
