#!/usr/bin/env node
// MORNING BRIEF — adaptador de entrega (consola / markdown).
//
// NO tiene lógica: renderiza lo que devuelve lib/brief.js. Cuando exista el adaptador de
// WhatsApp o email, va a consumir el MISMO objeto. La inteligencia no se muda.
//
//   node scripts/brief.js              a consola
//   node scripts/brief.js --md         markdown a stdout
//   node scripts/brief.js --entregado  marca lo mostrado (no se repite mañana)

const db = require('../lib/db');
const brief = require('../lib/brief');

const MD = process.argv.includes('--md');
const b = brief.generar();
const L = [];
const p = s => L.push(s);
const hr = () => p(MD ? '\n---\n' : '\n' + '━'.repeat(66) + '\n');

p(MD ? '# MAGNA INTELLIGENCE LAB — Morning Brief' : `\n${'═'.repeat(66)}\n  MAGNA INTELLIGENCE LAB — MORNING BRIEF`);
p(`  ${b.fecha}`);
if (!MD) p('═'.repeat(66));

// ---------------------------------------------------------------- qué hizo
hr();
p(MD ? '## Qué hice' : 'QUÉ HICE');
const a = b.actividad;
p(`  ${b.salud.activas} de ${b.salud.total} fuentes activas · ${a.items_total} piezas capturadas`);
p(`  ${a.analizados} analizadas a fondo · ${a.sin_procesar} en cola`);
p(`  ${a.tecnologias} tecnologías investigadas contra su fuente primaria`);
p(`  ${a.matches} match(es) contra tus ${a.problemas_abiertos} problemas abiertos · ${a.no_matches} descartados`);

// ---------------------------------------------------------------- lo que importa
hr();
p(MD ? '## Lo que necesita tu atención' : 'LO QUE NECESITA TU ATENCIÓN');
if (!b.hallazgos.length) {
  p('\n  Nada nuevo que amerite una decisión hoy.');
  p('  Eso es un resultado válido: el filtro funcionó.');
} else {
  for (const h of b.hallazgos.slice(0, 5)) {
    p(`\n  ${MD ? '### ' : ''}PRIORIDAD ${h.prioridad}${h.nuevo ? '' : '  (ya te lo mostré antes)'}`);
    p(`  ${h.name}  →  ${h.canonical_url ?? 's/url'}`);
    p(`  QUÉ TOCA     : ${h.code} (${h.proyecto}) — ${h.problema}`);
    p(`  POR QUÉ      : ${h.argument}`);
    p(`  CONFIANZA    : ${h.confidence} · relevancia ${h.relevance_score}/10`);
    if (h.contenido) p(`  LO ENCONTRÉ  : "${String(h.contenido).slice(0, 56)}" (${h.fuente})`);
    if (h.coverage === 'PARTIAL') p(`  ⚠ COBERTURA  : PARCIAL — el veredicto se basa en parte de la fuente`);
  }
}

// ---------------------------------------------------------------- cola
if (b.triage.length) {
  hr();
  p(MD ? '## Cola de análisis (candidatos, NO veredictos)' : 'COLA DE ANÁLISIS  (candidatos, NO veredictos)');
  p('  Capturado y sin analizar. El título menciona algo de nuestro vocabulario:\n');
  for (const t of b.triage)
    p(`  · ${String(t.title).slice(0, 58)}\n      ${t.handle} · menciona: ${t.menciona.join(', ')}`);
  p('\n  Analizar cuesta tiempo y API. Esto ordena la cola; no decide nada.');
}

// ---------------------------------------------------------------- salud
hr();
p(MD ? '## Salud del Lab' : 'SALUD DEL LAB');
for (const [plat, s] of Object.entries(b.salud.porPlataforma)) {
  const marca = s.estado === 'OK' ? 'OK' : s.estado;
  p(`  ${plat.padEnd(11)} ${marca.padEnd(9)} ${s.activas}/${s.total} activas · ${s.items} items`);
}
if (b.salud.conError.length) {
  p('\n  FUENTES CON PROBLEMA:');
  for (const f of b.salud.conError)
    p(`   ! ${f.handle} — ${f.fallas_seguidas} falla(s) seguidas: ${String(f.last_error).slice(0, 50)}`);
}
const inactivas = b.salud.fuentes.filter(f => !f.active);
if (inactivas.length)
  p(`\n  ${inactivas.length} fuentes inactivas a propósito (Instagram: sin ingesta automática todavía)`);

// ---------------------------------------------------------------- descartado
hr();
p(MD ? '## No necesitás mirar' : 'NO NECESITÁS MIRAR');
p(`  ${a.no_matches} cruces dieron NO_MATCH: la tecnología es real pero no resuelve`);
p('  ninguno de nuestros problemas documentados. No es un defecto de la herramienta.');
p(`  ${a.sin_procesar} piezas siguen en cola sin analizar.`);

if (!MD) p('\n' + '═'.repeat(66) + '\n');
console.log(L.join('\n'));

if (process.argv.includes('--entregado')) {
  brief.marcarEntregado(b);
  console.error('\n(marcado como entregado: no se repite mañana)');
}
db.close();
