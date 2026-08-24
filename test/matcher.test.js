#!/usr/bin/env node
// TESTS CONTRA MATCHES FALSOS.
//
// Un match falso es peor que ningun match: manda a experimentar contra un problema que la
// herramienta no resuelve, quema tiempo y erosiona la confianza en todo el Lab.
//
// Cada test de aca nace de un modo de fallar concreto, igual que los arneses de Freddy.
// Corre contra una base temporal: NO toca lab.db.
//
//   node test/matcher.test.js

process.env.LAB_DB = require('node:path').join(
  require('node:os').tmpdir(), `mil-test-${process.pid}.db`);

const fs = require('node:fs');
const db = require('../lib/db');
const matcher = require('../lib/matcher');
const riesgo = require('../lib/riesgo');

let pasaron = 0, fallaron = 0;
const test = (nombre, fn) => {
  try { fn(); console.log(`  ok    ${nombre}`); pasaron++; }
  catch (e) { console.log(`  FALLA ${nombre}\n          ${e.message}`); fallaron++; }
};
const igual = (a, b, msg) => {
  if (JSON.stringify(a) !== JSON.stringify(b))
    throw new Error(`${msg ?? ''} esperaba ${JSON.stringify(b)}, dio ${JSON.stringify(a)}`);
};
const cierto = (c, msg) => { if (!c) throw new Error(msg ?? 'esperaba verdadero'); };

// ---------------------------------------------------------------- fixture
db.applySchema();
db.run(`INSERT INTO projects (slug, name) VALUES ('proj-test', 'Proyecto de prueba')`);
const proj = db.get(`SELECT id FROM projects WHERE slug='proj-test'`).id;

for (const [id, n] of [['cap_a', 'Capacidad A'], ['cap_b', 'Capacidad B'], ['cap_c', 'Capacidad C']])
  db.run(`INSERT INTO capabilities (id, nombre, descripcion) VALUES (?, ?, ?)`, id, n, n);

function problema(code, { req = [], util = [], estado = 'OK', gap = null } = {}) {
  db.run(`INSERT INTO problems (code, project_id, title, evidence, data_status, data_gap)
          VALUES (?, ?, ?, 'fixture de test', ?, ?)`, code, proj, code, estado, gap);
  const id = db.get('SELECT id FROM problems WHERE code = ?', code).id;
  for (const c of req)  db.run(`INSERT INTO problem_capabilities VALUES (?,?, 'required')`, id, c);
  for (const c of util) db.run(`INSERT INTO problem_capabilities VALUES (?,?, 'useful')`, id, c);
  return id;
}

function tecnologia(nombre, caps, origen = 'curado') {
  db.run(`INSERT INTO technologies (name) VALUES (?)`, nombre);
  const id = db.get('SELECT id FROM technologies WHERE name = ?', nombre).id;
  for (const c of caps)
    db.run(`INSERT INTO technology_capabilities (technology_id, capability_id, origen, evidencia)
            VALUES (?, ?, ?, 'fixture')`, id, c, origen);
  return id;
}

console.log('\nTESTS DEL MATCHER\n');

// ---------------------------------------------------------------- casos
problema('P-REQ-A',   { req: ['cap_a'] });
problema('P-REQ-AB',  { req: ['cap_a', 'cap_b'] });
problema('P-UTIL-A',  { req: ['cap_b'], util: ['cap_a'] });
problema('P-VACIO',   {});                                   // no requiere tecnologia
problema('P-INSUF',   { req: ['cap_a'], estado: 'INSUFFICIENT_PROBLEM_DATA', gap: 'falta relevar' });

const techA  = tecnologia('SoloA',  ['cap_a']);
const techC  = tecnologia('SoloC',  ['cap_c']);
const techAB = tecnologia('AyB',    ['cap_a', 'cap_b']);
const techInf= tecnologia('Inferida', ['cap_a'], 'inferido');
const techNada = tecnologia('SinCaps', []);

test('una tecnologia que cubre lo requerido matchea', () => {
  const r = matcher.cruzar(techA);
  cierto(r.matches.some(m => m.problema.code === 'P-REQ-A'), 'P-REQ-A deberia matchear');
});

test('una tecnologia sin ninguna capacidad en comun NO matchea', () => {
  const r = matcher.cruzar(techC);
  igual(r.matches.length, 0, 'SoloC no deberia matchear con nada:');
  cierto(r.no_matches.length > 0, 'deberia haber no_matches explicitos');
});

test('cubrir SOLO una capacidad util NO alcanza para declarar match', () => {
  // El corazon del anti-match-falso: aporta algo, pero el problema seguiria sin resolverse.
  const r = matcher.cruzar(techA);
  cierto(!r.matches.some(m => m.problema.code === 'P-UTIL-A'),
    'P-UTIL-A NO deberia matchear: cap_a es util, lo requerido es cap_b');
  const n = r.no_matches.find(m => m.problema.code === 'P-UTIL-A');
  cierto(n && n.matched.includes('cap_a'), 'deberia registrar la relacion parcial');
});

test('cubrir parcialmente lo requerido matchea pero con relevancia < 10', () => {
  const r = matcher.cruzar(techA);
  const m = r.matches.find(x => x.problema.code === 'P-REQ-AB');
  cierto(m, 'P-REQ-AB deberia aparecer como match parcial');
  cierto(m.relevance_score < 10, `relevancia deberia ser <10, dio ${m.relevance_score}`);
  cierto(m.missing.includes('cap_b'), 'deberia declarar cap_b como faltante');
});

test('cubrir TODO lo requerido con capacidad curada da confianza HIGH', () => {
  const m = matcher.cruzar(techAB).matches.find(x => x.problema.code === 'P-REQ-AB');
  igual(m.confidence, 'HIGH', 'confianza de AyB sobre P-REQ-AB:');
});

test('una capacidad INFERIDA no puede sostener confianza HIGH', () => {
  // Una inferencia de README es una pista, no una verificacion.
  const m = matcher.cruzar(techInf).matches.find(x => x.problema.code === 'P-REQ-A');
  cierto(m.confidence !== 'HIGH', `no deberia ser HIGH, dio ${m.confidence}`);
});

test('un problema sin capacidades declaradas NO matchea con nada', () => {
  // DIST-LOG-004 en la vida real: es un hueco de modelo de datos, no de tecnologia.
  for (const t of [techA, techAB, techC]) {
    const r = matcher.cruzar(t);
    cierto(!r.matches.some(m => m.problema.code === 'P-VACIO'),
      'P-VACIO no deberia matchear jamas');
  }
});

test('un problema con datos insuficientes queda EXCLUIDO, no matcheado', () => {
  const r = matcher.cruzar(techA);
  cierto(!r.matches.some(m => m.problema.code === 'P-INSUF'), 'no deberia matchear');
  cierto(r.insuficientes.some(m => m.problema.code === 'P-INSUF'), 'deberia estar en insuficientes');
});

test('una tecnologia sin capacidades conocidas devuelve sin_base, no NO_MATCH', () => {
  // "No se que hace" y "no sirve" son cosas distintas y no se pueden confundir.
  const r = matcher.cruzar(techNada);
  igual(r.sin_base, true, 'deberia marcar sin_base:');
  igual(r.matches.length, 0);
});

test('el cruce es idempotente: guardar dos veces no duplica', () => {
  const r = matcher.cruzar(techA);
  matcher.guardar(techA, r); matcher.guardar(techA, r);
  const n = db.get('SELECT count(*) AS n FROM matches WHERE technology_id = ?', techA).n;
  igual(n, r.matches.length + r.no_matches.length + r.insuficientes.length, 'filas de matches:');
});

console.log('\nTESTS DE RIESGO POR USO\n');

test('sin licencia: estudiar la idea es riesgo BAJO', () => {
  const f = riesgo.evaluar('SIN LICENCIA').filas.find(x => x.uso === 'ARCHITECTURAL_INSPIRATION');
  igual(f.nivel, 'BAJO', 'inspiracion arquitectonica sin licencia:');
});

test('sin licencia: integrarlo al producto es riesgo MUY_ALTO', () => {
  const f = riesgo.evaluar('SIN LICENCIA').filas.find(x => x.uso === 'PRODUCT_INTEGRATION');
  igual(f.nivel, 'MUY_ALTO', 'integracion al producto sin licencia:');
});

test('el mismo repo sin licencia da niveles DISTINTOS segun el uso', () => {
  // Es el punto entero: el Risk Agent no puede confundir estudiar con vender.
  const niveles = new Set(riesgo.evaluar('SIN LICENCIA').filas.map(f => f.nivel));
  cierto(niveles.size > 1, 'todos los usos dieron el mismo nivel: el analisis no distingue nada');
});

test('MIT es riesgo BAJO incluso para redistribucion', () => {
  const f = riesgo.evaluar('MIT').filas.find(x => x.uso === 'REDISTRIBUTION');
  igual(f.nivel, 'BAJO', 'MIT + redistribucion:');
});

test('AGPL es riesgo ALTO al integrarlo a un producto que se vende', () => {
  const f = riesgo.evaluar('AGPL-3.0').filas.find(x => x.uso === 'PRODUCT_INTEGRATION');
  igual(f.nivel, 'ALTO', 'AGPL + producto:');
});

test('el analisis de riesgo aclara que no es asesoramiento legal', () => {
  cierto(/no es asesoramiento legal/i.test(riesgo.evaluar('MIT').aviso));
});

// ---------------------------------------------------------------- cierre
db.close();
try { for (const s of ['', '-shm', '-wal']) fs.rmSync(process.env.LAB_DB + s, { force: true }); } catch {}

console.log(`\n${pasaron} pasaron · ${fallaron} fallaron\n`);
process.exit(fallaron ? 1 : 0);
