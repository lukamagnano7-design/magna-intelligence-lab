#!/usr/bin/env node
// Ingesta MANUAL de una URL al Lab. Es el camino que ya estaba previsto en docs/FUENTES.md
// para todo lo que el colector automatico todavia no alcanza (Instagram, podcasts sin RSS).
//
// NO es un pipeline paralelo: guarda un `item` normal, con su `fingerprint` anti-duplicado,
// para que despues lo procese el MISMO analizar.js que procesa los videos de YouTube.
//
//   node scripts/ingerir_manual.js <url> [--plataforma instagram] [--handle @creador]

const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const db = require('../lib/db');
const { bin } = require('../lib/senales');

const ARGV = process.argv.slice(2);
const URL = ARGV.find(a => a.startsWith('http'));
const val = (n, d) => { const i = ARGV.indexOf(`--${n}`); return i >= 0 ? ARGV[i + 1] : d; };
if (!URL) { console.error('Uso: node scripts/ingerir_manual.js <url> [--plataforma X] [--handle Y]'); process.exit(1); }

const plataforma = val('plataforma', URL.includes('instagram') ? 'instagram' : 'web');

// Los metadatos los saca yt-dlp, la misma herramienta que ya usa lib/vision.js.
let meta = {};
try {
  const out = execFileSync(bin('yt-dlp'),
    ['--skip-download', '--no-warnings', '--print',
     '%(id)s%(uploader_id)s%(title)s%(description)s', URL],
    { encoding: 'utf8', timeout: 120000 }).split('\n')[0].split('');
  meta = { id: out[0], uploader: out[1], title: out[2], description: out[3] };
} catch (e) { console.error('yt-dlp no pudo leer la URL:', e.message.slice(0, 120)); process.exit(1); }

const handle = val('handle', meta.uploader ? `ig:${meta.uploader}` : 'manual');

db.tx(() => {
  db.run(`INSERT INTO sources (platform, source_type, handle, url, radar, priority, active, metadata)
          VALUES (?, 'creator', ?, ?, 'tecnico', 5, 0, ?)
          ON CONFLICT(platform, handle) DO NOTHING`,
    plataforma, handle, URL, JSON.stringify({ notas: 'ingesta manual: el colector automatico todavia no llega a esta plataforma' }));
  const sid = db.get('SELECT id FROM sources WHERE platform=? AND handle=?', plataforma, handle).id;

  const fp = crypto.createHash('sha256').update(`${plataforma}::${meta.id}`).digest('hex').slice(0, 32);
  const ya = db.get('SELECT id FROM items WHERE fingerprint = ?', fp);
  if (ya) { console.log(`ya estaba ingerido (item ${ya.id.slice(0, 8)})`); return; }

  db.run(`INSERT INTO items (source_id, external_id, item_type, title, url, raw_text, raw_metadata, fingerprint)
          VALUES (?, ?, 'video', ?, ?, ?, ?, ?)`,
    sid, meta.id, meta.title || meta.id, URL, meta.description || null,
    JSON.stringify({ autor: meta.uploader, via: 'ingesta_manual' }), fp);
  console.log(`ingerido: ${meta.id}  (${handle})`);
  console.log(`  ${String(meta.title || '').slice(0, 70)}`);
});
db.close();
