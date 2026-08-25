#!/usr/bin/env node
// COMPRENSION PROFUNDA DE UNA FUENTE AUDIOVISUAL — LAB-DEEP-UNDERSTANDING-001.
//
// Encontrar seniales dentro de un video y ENTENDER el video son dos problemas distintos.
// El Lab hacia lo primero y presentaba el resultado como si fuera lo segundo.
//
// Este script hace las dos pistas, sobre TODA la duracion, y despues declara cuanto vio:
//
//   MEDIR (ffprobe)  ->  AUDIO (whisper.cpp local)  ->  VISUAL (frames repartidos + OCR es)
//                    ->  COBERTURA POR SEGMENTO     ->  INFORME CON PROVENANCE TEMPORAL
//
// Todo local y gratis. Ninguna API paga.
//
// Uso:
//   node scripts/comprender.js <videoId | parte del titulo> [--video RUTA] [--audio RUTA]
//                                                           [--modelo base|small] [--json]

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const db = require('../lib/db');
const medios = require('../lib/medios');
const vision = require('../lib/vision');
const audio = require('../lib/audio');
const cobertura = require('../lib/cobertura');

const arg = process.argv[2];
const flag = (n) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : null; };
const jsonOut = process.argv.includes('--json');
if (!arg) { console.error('Uso: node scripts/comprender.js <videoId | titulo> [--video RUTA] [--audio RUTA]'); process.exit(1); }

const linea = (t) => console.log(`\n${'='.repeat(78)}\n${t}\n${'='.repeat(78)}`);
const bloque = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 74 - t.length))}`);
const fmt = cobertura.fmt;

(async () => {
  const item = db.get(
    `SELECT i.*, s.handle, s.platform FROM items i
     LEFT JOIN sources s ON s.id = i.source_id
     WHERE i.external_id = ? OR i.title LIKE ? LIMIT 1`, arg, `%${arg}%`);
  if (!item) { console.error(`No encontre ningun item con "${arg}"`); process.exit(1); }

  linea(`COMPRENSION PROFUNDA · ${item.title || item.external_id}`);
  console.log(`FUENTE    : ${item.handle ?? 'n/d'} (${item.platform ?? 'n/d'})`);
  console.log(`CONTENIDO : ${item.url}`);

  // ---------------------------------------------------------------- 0. capacidades
  bloque('0. HERRAMIENTAS LOCALES');
  const cap = medios.capacidades();
  for (const [k, v] of Object.entries(cap)) {
    const extra = k === 'ocr' ? ` idiomas: ${v.idiomas?.join('+') || 'ninguno'}`
                : k === 'whisper' ? ` modelo: ${v.modelo}` : '';
    console.log(`  ${v.ok ? '✓' : '✗'} ${k.padEnd(9)}${extra}`);
  }
  console.log('  (todas locales y gratuitas — ninguna API paga en esta corrida)');

  const rutaVideo = flag('--video');
  const rutaAudio = flag('--audio');
  const modelo = flag('--modelo') || 'base';
  if (rutaVideo) console.log(`\n  Reutilizando video ya descargado: ${rutaVideo}`);
  if (rutaAudio) console.log(`  Reutilizando audio ya descargado: ${rutaAudio}`);

  // ---------------------------------------------------------------- 1. medir
  bloque('1. MEDIR ANTES DE MIRAR');
  let medida = null;
  if (rutaVideo && fs.existsSync(rutaVideo)) {
    medida = medios.medir(rutaVideo);
    console.log(`  Duracion real     : ${medida.duracion_s} s  (${fmt(medida.duracion_s)})`);
    if (medida.video) console.log(`  Video             : ${medida.video.codec} ${medida.video.w}x${medida.video.h} @ ${medida.video.fps}`);
    console.log(`  Peso              : ${(medida.bytes / 1048576).toFixed(1)} MB`);
  } else console.log('  (se medira al bajar el medio)');

  // ---------------------------------------------------------------- 2. audio
  bloque('2. PISTA DE AUDIO — lo que DICE');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mil-aud-'));
  let aud;
  try {
    aud = audio.extraer(item, tmp, { modelo, archivoLocal: rutaAudio });
  } finally { /* el tmp se limpia al final */ }

  if (!aud.ok) {
    console.log(`  ✗ ${aud.motivo}`);
  } else {
    const m = aud.metricas;
    console.log(`  ✓ transcripcion   ${aud.segmentos.length} segmentos · modelo whisper.cpp:${modelo}`);
    console.log(`  Audio             ${aud.duracion_audio_s} s (${fmt(aud.duracion_audio_s)}) · ${m.mb_audio} MB`);
    console.log(`  Cubierto por voz  hasta ${aud.cubierto_s.toFixed(1)} s (${fmt(aud.cubierto_s)})`);
    console.log(`  Tiempos (s)       descarga ${(m.ms_descarga / 1000).toFixed(1)} · wav ${(m.ms_wav / 1000).toFixed(1)} · whisper ${(m.ms_whisper / 1000).toFixed(1)}`);
    audio.guardar(item.id, aud.segmentos, { modelo });
    const palabras = aud.segmentos.reduce((s, x) => s + x.texto.split(/\s+/).length, 0);
    console.log(`  Palabras          ${palabras}`);
  }

  // ---------------------------------------------------------------- 3. visual
  bloque('3. PISTA VISUAL — lo que MUESTRA');
  const vis = vision.extraer(item, { archivoLocal: rutaVideo });
  if (!vis.ok) {
    console.log(`  ✗ ${vis.motivo}`);
  } else {
    const m = vis.metricas;
    console.log(`  Duracion medida       : ${vis.duracion_s} s (${fmt(vis.duracion_s)})`);
    console.log(`  Frames candidatos     : ${m.candidatos}   (1 cada ${vision.INTERVALO_S} s sobre TODO el material)`);
    console.log(`  Descartados por dup   : ${m.descartados_redundantes}`);
    console.log(`  Recortados por techo  : ${m.recortados_por_techo ?? 0}`);
    console.log(`  OCReados              : ${vis.frames.length}   idioma: ${m.ocr_lang}`);
    console.log(`  Sin texto legible     : ${m.ocr_vacios}`);
    console.log(`  Tiempos (s)           : frames ${(m.ms_frames / 1000).toFixed(1)} · phash ${(m.ms_phash / 1000).toFixed(1)} · OCR ${(m.ms_ocr / 1000).toFixed(1)} · total ${(m.ms_total / 1000).toFixed(1)}`);
    vision.guardar(item.id, vis.frames, { lang: m.ocr_lang });
  }

  // ---------------------------------------------------------------- 4. cobertura
  bloque('4. COBERTURA  —  CAPTURA != COBERTURA');
  const duracionS = vis.ok ? vis.duracion_s : (medida?.duracion_s ?? null);
  const segmentos = vis.ok ? vis.segmentos : cobertura.segmentar(duracionS);

  const segAudio = segmentos.filter(s =>
    aud.ok && aud.segmentos.some(t => t.hasta > s.desde && t.desde < s.hasta)).length;
  const cobAudio = cobertura.evaluar({
    duracionS, segmentos, segmentosConMuestra: segAudio,
    muestras: aud.ok ? aud.segmentos.length : 0,
    disponible: aud.ok, motivo: aud.ok ? null : aud.motivo });

  const cobVisual = vis.ok ? vis.cobertura
    : cobertura.evaluar({ duracionS, segmentos, disponible: false, motivo: vis.motivo });

  const cob = cobertura.consolidar({ audio: cobAudio, visual: cobVisual });

  console.log(`  DURACION TOTAL   ${fmt(duracionS)}   (${duracionS} s)`);
  console.log(`  SEGMENTOS        ${segmentos.length}`);
  console.log(`  AUDIO            ${cobAudio.estado.padEnd(9)} ${cobAudio.pct}%  ${cobAudio.segmentos_vistos}/${segmentos.length} segmentos`);
  console.log(`  VISION/OCR       ${cobVisual.estado.padEnd(9)} ${cobVisual.pct}%  ${cobVisual.segmentos_vistos}/${segmentos.length} segmentos`);
  console.log(`  ────────────────────────────────────────────────────────────`);
  console.log(`  CONSOLIDADO      ${cob.estado}  ${cob.pct}%`);
  console.log(`  ${cob.nota}`);
  const adv = cobertura.advertencia(cob);
  if (adv) console.log(`\n  ⚠ ${adv}`);

  // barra visual del timeline
  const ANCHO = 60;
  const barra = segmentos.map(s => {
    const v = vis.ok && vis.frames.some(f => f.ts_seconds >= s.desde && f.ts_seconds < s.hasta);
    const a = aud.ok && aud.segmentos.some(t => t.hasta > s.desde && t.desde < s.hasta);
    return (v && a) ? '█' : (v || a) ? '▄' : '░';
  }).join('');
  const rep = Math.max(1, Math.floor(ANCHO / Math.max(1, segmentos.length)));
  console.log(`\n  0:00 ${barra.split('').map(c => c.repeat(rep)).join('')} ${fmt(duracionS)}`);
  console.log(`       █ = audio + vision    ▄ = una sola pista    ░ = sin mirar`);

  if (duracionS) vision.guardarCobertura(item.id, cob, duracionS);

  // ---------------------------------------------------------------- 5. por segmento
  bloque('5. PROVENANCE TEMPORAL — que hay en cada tramo');
  for (const s of segmentos) {
    const fr = vis.ok ? vis.frames.filter(f => f.ts_seconds >= s.desde && f.ts_seconds < s.hasta) : [];
    const tr = aud.ok ? aud.segmentos.filter(t => t.hasta > s.desde && t.desde < s.hasta) : [];
    const dicho = tr.map(t => t.texto).join(' ').replace(/\s+/g, ' ').trim();
    const visto = fr.map(f => (f.ocr_text || '').replace(/\n/g, ' | '))
      .join(' ').replace(/\s+/g, ' ').trim();
    console.log(`\n  ${fmt(s.desde)}–${fmt(s.hasta)}   [${fr.length} frames · ${tr.length} tramos de voz]`);
    if (dicho) console.log(`     DICE : ${dicho.slice(0, 400)}${dicho.length > 400 ? '…' : ''}`);
    if (visto) console.log(`     VE   : ${visto.slice(0, 260)}${visto.length > 260 ? '…' : ''}`);
    if (!dicho && !visto) console.log('     (sin senial legible en este tramo)');
  }

  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}

  bloque('RESUMEN');
  console.log(`  ${cob.estado} · ${cob.pct}% · audio ${cobAudio.estado} / vision ${cobVisual.estado}`);
  console.log(`  Guardado: signals(transcript + frame_ocr), frames, items.coverage/duracion_s`);

  if (jsonOut) console.log('\n' + JSON.stringify({ duracionS, cob, cobAudio, cobVisual,
    segmentos: segmentos.length, frames: vis.frames?.length ?? 0,
    voz: aud.segmentos?.length ?? 0 }, null, 2));
  db.close();
})().catch(e => { console.error('\nFALLO:', e.message, '\n', e.stack); process.exit(1); });
