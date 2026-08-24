#!/usr/bin/env node
// TESTS DE VISION Y SIGNAL FUSION.
//
// No bajan videos: prueban la LOGICA (dedup, patrones de pantalla, fusion, provenance)
// contra datos fijos. Los tests que dependen de red son fragiles y no sirven de arnes.
//
//   node test/vision.test.js

process.env.LAB_DB = require('node:path').join(
  require('node:os').tmpdir(), `mil-vis-test-${process.pid}.db`);

const fs = require('node:fs');
const db = require('../lib/db');
const vision = require('../lib/vision');
const { detectar, extraerEntidades } = require('../lib/entidades');

let pasaron = 0, fallaron = 0;
const test = (n, fn) => {
  try { fn(); console.log(`  ok    ${n}`); pasaron++; }
  catch (e) { console.log(`  FALLA ${n}\n          ${e.message}`); fallaron++; }
};
const igual = (a, b, m) => {
  if (JSON.stringify(a) !== JSON.stringify(b))
    throw new Error(`${m ?? ''} esperaba ${JSON.stringify(b)}, dio ${JSON.stringify(a)}`);
};
const cierto = (c, m) => { if (!c) throw new Error(m ?? 'esperaba verdadero'); };

console.log('\nDEDUPLICACION PERCEPTUAL\n');

test('dos hashes identicos tienen distancia 0', () => {
  igual(vision.hamming('1'.repeat(64), '1'.repeat(64)), 0);
});

test('dos hashes opuestos tienen distancia maxima', () => {
  igual(vision.hamming('1'.repeat(64), '0'.repeat(64)), 64);
});

test('un cambio chico queda por debajo del umbral (mismo frame)', () => {
  // Mover el cursor cambia pocos pixeles: no es una pantalla nueva.
  const a = '1'.repeat(64);
  const b = '0'.repeat(3) + '1'.repeat(61);
  cierto(vision.hamming(a, b) <= vision.HAMMING_MAX,
    `distancia ${vision.hamming(a, b)} deberia ser <= ${vision.HAMMING_MAX}`);
});

test('un cambio grande supera el umbral (pantalla distinta)', () => {
  const a = '1'.repeat(64);
  const b = '0'.repeat(30) + '1'.repeat(34);
  cierto(vision.hamming(a, b) > vision.HAMMING_MAX);
});

console.log('\nPATRONES DE TEXTO EN PANTALLA\n');

test('detecta el nombre de una skill desde la ruta del SKILL.md', () => {
  // Caso REAL del video 2LWT22jkIts, frame @12s.
  const r = detectar('serps app/blob/main/new-app/SKILL.md 1d o', 'frame_ocr');
  cierto(r.some(e => e.normalized === 'new-app' && e.entity_type === 'skill'),
    'deberia sacar "new-app" de la ruta');
});

test('tolera que el OCR se coma la primera letra de blob', () => {
  // Tambien real: tesseract leyo "lob/main" en vez de "blob/main".
  const r = detectar('lob/main/add-login/SKILL.md', 'frame_ocr');
  cierto(r.some(e => e.normalized === 'add-login'), 'deberia sacar "add-login" igual');
});

test('detecta un repo desde una URL de github en pantalla', () => {
  const r = detectar('github.com/anthropics/skills', 'frame_ocr');
  cierto(r.some(e => e.normalized === 'anthropics/skills' && e.entity_type === 'repository'));
});

test('detecta un paquete desde un comando de instalacion', () => {
  const r = detectar('$ npx create-magna-app', 'frame_ocr');
  cierto(r.some(e => e.normalized === 'create-magna-app'));
});

test('los patrones de pantalla NO se aplican a la transcripcion', () => {
  // Un comando "dicho" no tiene la misma fuerza que uno escrito, y ademas el ASR lo
  // destroza. Aplicarlos al audio produciria entidades basura.
  const r = detectar('github.com/anthropics/skills', 'transcript');
  cierto(!r.some(e => e.metadata?.via === 'texto en pantalla'));
});

console.log('\nSIGNAL FUSION Y PROVENANCE\n');

db.applySchema();
db.run(`INSERT INTO sources (platform, source_type, handle) VALUES ('youtube','channel','@t')`);
const sid = db.get(`SELECT id FROM sources`).id;
const nuevoItem = (ext) => {
  db.run(`INSERT INTO items (source_id, external_id, item_type, title, fingerprint)
          VALUES (?, ?, 'video', ?, ?)`, sid, ext, ext, ext);
  return db.get('SELECT id FROM items WHERE external_id = ?', ext).id;
};
const senal = (item, kind, txt) => db.run(
  `INSERT INTO signals (item_id, kind, content, extractor) VALUES (?, ?, ?, 'test')`,
  item, kind, txt);

test('una entidad vista Y escuchada llega a VERY_HIGH', () => {
  const it = nuevoItem('conv');
  senal(it, 'transcript', 'estoy usando las skills de Claude para todo');
  senal(it, 'frame_ocr', '[17s] github.com/anthropics/skills');
  const ents = extraerEntidades(it);
  const repo = ents.find(e => e.normalized === 'anthropics/skills');
  cierto(repo, 'deberia detectar el repo');
  igual(repo.confidence_label, 'VERY_HIGH', 'convergencia transcript+OCR:');
});

test('una sola senial debil NO llega a VERY_HIGH', () => {
  const it = nuevoItem('solo');
  senal(it, 'transcript', 'la tercera se llama bucle agentico');
  const e = extraerEntidades(it).find(x => /bucle/i.test(x.normalized ?? ''));
  cierto(e && e.confidence_label !== 'VERY_HIGH', 'una sola senial no puede dar certeza');
});

test('cada entidad guarda su evidencia con el fragmento exacto', () => {
  const it = nuevoItem('prov');
  senal(it, 'frame_ocr', '[12s] app/blob/main/new-app/SKILL.md');
  extraerEntidades(it);
  const ev = db.all(`SELECT ee.* FROM entity_evidence ee
                     JOIN entities e ON e.id = ee.entity_id WHERE e.item_id = ?`, it);
  cierto(ev.length > 0, 'deberia haber evidencia guardada');
  cierto(ev.some(v => v.snippet.includes('SKILL.md')), 'el fragmento deberia estar');
});

test('la evidencia de OCR conserva el timestamp del frame', () => {
  const it = nuevoItem('ts');
  senal(it, 'frame_ocr', '[0s] nada\n[24s] github.com/owner/repo');
  extraerEntidades(it);
  const v = db.get(`SELECT ee.ts_seconds FROM entity_evidence ee
                    JOIN entities e ON e.id = ee.entity_id
                    WHERE e.item_id = ? AND e.normalized = 'owner/repo'`, it);
  igual(v?.ts_seconds, 24, 'timestamp del frame:');
});

test('la fusion NO duplica: una entidad, varias evidencias', () => {
  const it = nuevoItem('dup');
  senal(it, 'metadata', 'Supabase');
  senal(it, 'transcript', 'uso Supabase para el backend');
  senal(it, 'frame_ocr', '[5s] Supabase');
  const ents = extraerEntidades(it).filter(e => e.normalized === 'Supabase');
  igual(ents.length, 1, 'deberia haber UNA sola entidad Supabase:');
  igual(ents[0].signal_count, 3, 'con evidencia de las 3 seniales:');
});

test('analizar dos veces da lo mismo (idempotencia)', () => {
  const it = nuevoItem('idem');
  senal(it, 'frame_ocr', '[3s] github.com/a/b');
  const a = extraerEntidades(it).length;
  const b = extraerEntidades(it).length;
  igual(a, b, 'cantidad de entidades entre corridas:');
  const ev = db.get(`SELECT count(*) AS n FROM entity_evidence ee
                     JOIN entities e ON e.id = ee.entity_id WHERE e.item_id = ?`, it).n;
  cierto(ev <= 2, `la evidencia no deberia acumularse, hay ${ev}`);
});

console.log('\nTOLERANCIA A FALLAS\n');

test('vision.disponible() informa QUE falta, no solo que fallo', () => {
  const d = vision.disponible();
  cierto(typeof d.ok === 'boolean');
  if (!d.ok) cierto(d.motivo && d.motivo.length > 0, 'deberia decir que falta');
});

test('un item sin senial visual sigue produciendo entidades', () => {
  // La vision es enriquecimiento, NO un punto unico de falla.
  const it = nuevoItem('sinvis');
  senal(it, 'metadata', 'TITULO: algo con Claude Code');
  const ents = extraerEntidades(it);
  cierto(ents.length > 0, 'deberia detectar igual desde metadata');
});

db.close();
try { for (const s of ['', '-shm', '-wal']) fs.rmSync(process.env.LAB_DB + s, { force: true }); } catch {}
console.log(`\n${pasaron} pasaron · ${fallaron} fallaron\n`);
process.exit(fallaron ? 1 : 0);
