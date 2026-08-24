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
const capacidades = require('../lib/capacidades');
const matcher = require('../lib/matcher');
const riesgo = require('../lib/riesgo');
const vision = require('../lib/vision');
const { puntuar, veredicto, CRITERIOS } = require('../lib/veredicto');

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
  const sen = extraerSenales(item, { solo: ['metadata', 'transcript'] });
  for (const g of sen.guardadas) console.log(`  ✓ ${g.kind.padEnd(12)} ${g.chars} chars`);
  for (const e of sen.errores)   console.log(`  ✗ ${e.kind.padEnd(12)} ERROR: ${e.error}`);

  // Senial visual. Es ENRIQUECIMIENTO: si falla, se dice y el analisis sigue igual.
  let vis = { ok: false, motivo: 'no solicitada', frames: [], metricas: {} };
  if (!process.argv.includes('--sin-vision')) {
    vis = vision.extraer(item);
    if (vis.ok) {
      vision.guardar(item.id, vis.frames);
      const conTexto = vis.frames.filter(f => f.ocr_text).length;
      console.log(`  ✓ frame_ocr    ${vis.frames.length} frames analizados (${conTexto} con texto)`);
    } else {
      console.log(`  – frame_ocr    ${vis.motivo}`);
      console.log('                 (el analisis sigue con las otras seniales)');
    }
  } else console.log('  – frame_ocr    salteada por --sin-vision');

  if (vis.ok) {
    bloque('1b. ANALISIS VISUAL');
    const m = vis.metricas;
    console.log(`  Frames candidatos     : ${m.candidatos}`);
    console.log(`  Descartados por dup   : ${m.descartados_redundantes}`);
    console.log(`  Analizados            : ${vis.frames.length}`);
    console.log(`  Sin texto legible     : ${m.ocr_vacios}`);
    console.log(`  Tiempos (s)           : descarga ${(m.ms_descarga/1000).toFixed(1)} · frames ${(m.ms_frames/1000).toFixed(1)} · OCR ${(m.ms_ocr/1000).toFixed(1)} · total ${(m.ms_total/1000).toFixed(1)}`);
    console.log(`  Disco temporal        : ${m.mb_disco} MB (se borra al terminar)`);
    const utiles = vis.frames.filter(f => f.ocr_text && f.ocr_text.length > 40);
    if (utiles.length) {
      console.log('\n  Lo que se leyo en pantalla:');
      for (const f of utiles.slice(0, 6))
        console.log(`    [${String(f.ts_seconds).padStart(3)}s] ${f.ocr_text.replace(/\n/g, ' ').slice(0, 96)}`);
    }
  }
  if (!sen.guardadas.length && !vis.ok) console.log('\n  (ninguna senial: no se puede analizar)');

  // ---------------------------------------------------------------- 2. entidades
  bloque('2. ENTIDADES DETECTADAS');
  const ents = extraerEntidades(item.id);
  for (const e of ents) {
    const marca = e.estado === 'discarded' ? 'DESCARTADA' : (e.confidence_label ?? '');
    console.log(`  ${marca.padStart(11)}  [${e.entity_type}] ${e.normalized || e.raw_mention}`);
    if (e.descartar) { console.log(`               ↳ ${e.descartar}`); continue; }
    // PROVENANCE: nunca alcanza con "el Lab detecto X". Hay que poder preguntar POR QUE
    // y obtener la evidencia exacta, con su timestamp.
    for (const v of (e.evidencias ?? [])) {
      const cuando = v.ts_seconds != null ? ` @${v.ts_seconds}s` : '';
      console.log(`               <- ${v.signal_kind}${cuando}: "${v.snippet.slice(0, 66)}"`);
    }
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

  // ---------------------------------------------------------------- 6. capacidades + cruce
  bloque('6. CALIDAD TECNICA  (independiente de si nos sirve)');
  if (principal) {
    console.log(`  Mantenimiento : ${principal.mantenimiento}${principal.dias_sin_push != null ? ` (push hace ${principal.dias_sin_push} dias)` : ''}`);
    console.log(`  Validacion    : ${principal.stars != null ? principal.stars + ' stars' : 'n/d'} · ${principal.issues_abiertos ?? '?'} issues abiertos`);
    console.log(`  Licencia      : ${principal.licencia}`);
    console.log('\n  Una herramienta puede ser excelente y no resolvernos nada. Son dos cosas distintas.');
  } else console.log('  Sin fuente primaria: no se puede evaluar la calidad tecnica.');

  bloque('7. CAPACIDADES QUE OFRECE');
  const techId = principal
    ? capacidades.registrar(principal.nombre, principal.url, principal.descripcion) : null;
  let cruce = { matches: [], no_matches: [], insuficientes: [], sin_base: true };
  let caps = { caps: [], nota_curada: null };

  if (techId) {
    caps = capacidades.determinar({
      nombre: principal.nombre, repo: principal.nombre,
      readme: principal.readme, descripcion: principal.descripcion });
    capacidades.guardar(techId, caps.caps);
    if (caps.caps.length) {
      for (const c of caps.caps) console.log(`  · ${c.capability_id.padEnd(28)} [${c.origen}]`);
    } else {
      console.log('  Ninguna capacidad de nuestra taxonomia.');
      if (caps.nota_curada) console.log(`  ↳ ${caps.nota_curada}`);
    }
    cruce = matcher.cruzar(techId, { determinado: Boolean(caps.determinado) });
    matcher.guardar(techId, cruce);
  }

  bloque('8. RELEVANCIA DE NEGOCIO');
  if (cruce.sin_base) {
    console.log('  SIN BASE PARA MATCHEAR: no se pudieron determinar capacidades.');
    console.log('  Eso NO significa que no sirva: significa que no sabemos que hace.');
  } else if (!cruce.matches.length) {
    console.log('  >>> NO_MATCH <<<\n');
    console.log('  No resuelve ninguno de nuestros problemas documentados.');
    console.log('  Es una conclusion valida y NO desmerece la calidad tecnica.');
  } else {
    for (const m of cruce.matches) {
      console.log(`\n  MATCH · ${m.problema.code} (${m.problema.proyecto}) · confianza ${m.confidence} · relevancia ${m.relevance_score}/10`);
      console.log(`    ${m.problema.title}`);
      console.log(`    capacidades que pegan : ${m.matched.join(', ')}`);
      if (m.missing.length) console.log(`    capacidades que faltan: ${m.missing.join(', ')}`);
      console.log(`    argumento : ${m.argument}`);
    }
  }
  if (!cruce.sin_base) {
    const parciales = cruce.no_matches.filter(n => n.matched?.length);
    if (parciales.length) {
      console.log('\n  Relacionados pero NO resueltos:');
      for (const n of parciales)
        console.log(`    ${n.problema.code}: ${n.argument}`);
    }
    console.log(`\n  ${cruce.matches.length} match · ${cruce.no_matches.length} no-match · ${cruce.insuficientes.length} con datos insuficientes`);
    if (cruce.insuficientes.length) {
      console.log('\n  EXCLUIDOS POR FALTA DE DATOS (hay que preguntarle al cliente):');
      for (const i of cruce.insuficientes)
        console.log(`    ${i.problema.code}: ${(i.motivo || '').slice(0, 105)}`);
    }
  }

  // ---------------------------------------------------------------- riesgo por uso
  bloque('9. USO PRETENDIDO Y RIESGO');
  const esWf = cruce.matches.some(m => m.problema.proyecto === 'claude-code-workflow');
  const uso = riesgo.usoProbable({ matches: cruce.matches, esWorkflow: esWf });
  console.log(`  Uso probable: ${uso.uso}`);
  console.log(`  ${uso.porque}`);
  if (principal) {
    const ev = riesgo.evaluar(principal.licencia, { archivado: principal.archivado });
    console.log(`\n  Licencia declarada: ${ev.licencia}\n`);
    for (const f of ev.filas)
      console.log(`    ${f.nivel.padEnd(9)} ${f.nombre.padEnd(30)} ${f.uso === uso.uso ? '<-- el nuestro' : ''}`);
    const mio = ev.filas.find(f => f.uso === uso.uso);
    if (mio) console.log(`\n  Para NUESTRO uso (${mio.nombre}): riesgo ${mio.nivel}\n    ${mio.porque}`);
    console.log(`\n  ${ev.aviso}`);
  }

  // ---------------------------------------------------------------- 10. criterios
  bloque('10. LOS 8 CRITERIOS DE LA FUENTE');
  const scores = puntuar({
    fuente: { id: item.sid }, primaria: principal,
    conocimiento: { entidades: db.all('SELECT * FROM entities WHERE item_id = ?', item.id) },
  });
  for (const [k, desc] of CRITERIOS) {
    const s = scores[k];
    const val = s?.score == null ? ' n/d' : `${String(s.score).padStart(2)}/10`;
    console.log(`  ${val}  ${desc.split(':')[0].padEnd(22)} ${s?.porque ?? ''}`.slice(0, 118));
  }

  // ---------------------------------------------------------------- 11. veredicto
  const v = veredicto({ primaria: principal, conocimiento: yaResuelto, scores,
                        cruce, uso, esWorkflow: esWf });
  bloque('11. VEREDICTO');
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
