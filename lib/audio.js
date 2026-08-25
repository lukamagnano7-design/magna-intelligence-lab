// SENIAL DE AUDIO — lo que el creador DICE.
//
// EL BUG QUE ORIGINO ESTE ARCHIVO (25/08/2026):
// el handoff decia "Instagram no entrego audio". Era falso. El selector de formato era
//
//     -f bestvideo[height<=1280]/best[height<=1280]
//
// y en yt-dlp `bestvideo` significa literalmente "el mejor stream SOLO-VIDEO". Nuestro
// propio selector excluia el audio por definicion, y despues concluimos que la plataforma
// no lo daba. El Reel tenia una pista m4a de 3,4 MB, publica y sin autenticacion.
//
// Es la tercera vez con la misma forma (antes: el RSS del podcast). No fallo el criterio:
// fallo la ingesta, y la capa de analisis reporto sobre lo que le llego como si fuera todo.
//
// En un video donde alguien EXPLICA una arquitectura, la narracion dice cosas que no estan
// escritas en ninguna pantalla: por que eligio cada capa, que fallo antes, como opera el
// equipo. El OCR no las puede ver nunca.
//
// Todo local: yt-dlp + ffmpeg + whisper.cpp. Cero API paga.

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { bin } = require('./senales');
const medios = require('./medios');

// El fix: `bestaudio` (no `bestvideo`). El fallback `best` trae un progresivo con las dos
// pistas; de ahi ffmpeg extrae el audio igual.
const FORMATO_AUDIO = 'bestaudio/best';

function disponible() {
  const falta = [];
  if (!bin('yt-dlp')) falta.push('yt-dlp');
  if (!bin('ffmpeg')) falta.push('ffmpeg');
  const cap = medios.capacidades();
  if (!cap.whisper.ok) falta.push('whisper.cpp (modelo o binario)');
  return falta.length ? { ok: false, motivo: `falta ${falta.join(', ')}` } : { ok: true };
}

/** Baja SOLO la pista de audio. Pesa ~3 MB donde el video pesa ~78 MB. */
function bajar(url, tmp) {
  const ff = bin('ffmpeg');
  const args = ['-f', FORMATO_AUDIO, '--no-warnings', '-o', path.join(tmp, 'a.%(ext)s')];
  // Ver el comentario de vision.bajar(): yt-dlp no encuentra el ffmpeg anidado de WinGet.
  if (ff) args.push('--ffmpeg-location', path.dirname(ff));
  try {
    execFileSync(bin('yt-dlp'), [...args, url], { stdio: 'ignore', timeout: 240000 });
  } catch { /* puede fallar un formato y haber bajado otro: manda el disco */ }
  const f = fs.readdirSync(tmp).find(x => /^a.*\.(m4a|mp3|opus|webm|mp4|aac|wav)$/i.test(x));
  return f ? path.join(tmp, f) : null;
}

/** whisper.cpp quiere WAV mono 16 kHz. Es la unica conversion que pide. */
function aWav(entrada, salida) {
  execFileSync(bin('ffmpeg'), ['-hide_banner', '-loglevel', 'error', '-i', entrada,
    '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', salida, '-y'], { timeout: 300000 });
  return salida;
}

const aSeg = (hms) => {
  const [h, m, s] = hms.split(':');
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
};

/**
 * Transcribe con timestamps por segmento.
 * Los timestamps NO son decoracion: son la mitad del provenance temporal. Permiten decir
 * "esto se dijo en el minuto 4:12" y cruzarlo contra lo que se veia en pantalla ahi.
 */
function transcribir(wav, { modelo = 'base', idioma = 'es' } = {}) {
  const salida = execFileSync(medios.whisperCli(),
    // -np = sin banners. Los timestamps se dejan A PROPOSITO (no usar -nt): son la mitad
    // del provenance temporal, lo que permite cruzar "esto se dijo" contra "esto se veia".
    ['-m', medios.whisperModelo(modelo), '-f', wav, '-l', idioma, '-np'],
    { encoding: 'utf8', timeout: 1800000, maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'ignore'] });

  const segmentos = [];
  for (const cruda of salida.split('\n')) {
    // .trim() NO es cosmetico: en Windows cada linea termina en \r, y en una regex de JS
    // el `.` no matchea \r, asi que `(.*)$` fallaba en TODAS las lineas y la transcripcion
    // salia vacia sin ningun error. whisper habia corrido bien los 66 s.
    const linea = cruda.trim();
    const m = linea.match(/^\[(\d\d:\d\d:\d\d\.\d+)\s*-->\s*(\d\d:\d\d:\d\d\.\d+)\]\s*(.*)$/);
    if (!m) continue;
    const texto = m[3].trim();
    if (texto) segmentos.push({ desde: aSeg(m[1]), hasta: aSeg(m[2]), texto });
  }
  return segmentos;
}

/**
 * Pipeline completo de la pista de audio para un item.
 * NUNCA lanza: si algo falla devuelve {ok:false, motivo} y el analisis sigue con las otras
 * seniales — degradado, pero diciendo que le falto.
 */
function extraer(item, tmp, { modelo = 'base', idioma = 'es', archivoLocal = null } = {}) {
  const d = disponible();
  if (!d.ok) return { ok: false, motivo: `AUDIO_UNAVAILABLE: ${d.motivo}`, segmentos: [] };

  const t0 = Date.now();
  const metricas = { ms_descarga: 0, ms_wav: 0, ms_whisper: 0, mb_audio: 0 };
  try {
    const td = Date.now();
    const origen = archivoLocal && fs.existsSync(archivoLocal) ? archivoLocal : bajar(item.url, tmp);
    metricas.ms_descarga = Date.now() - td;
    if (!origen) return { ok: false, motivo: 'AUDIO_UNAVAILABLE: no se pudo bajar la pista',
                          segmentos: [], metricas };

    const medida = medios.medir(origen);
    metricas.mb_audio = Number((fs.statSync(origen).size / 1048576).toFixed(1));
    if (!medida.audio)
      return { ok: false, motivo: 'AUDIO_UNAVAILABLE: el archivo no trae pista de audio',
               segmentos: [], metricas };

    const tw = Date.now();
    const wav = aWav(origen, path.join(tmp, 'a16.wav'));
    metricas.ms_wav = Date.now() - tw;

    const th = Date.now();
    const segmentos = transcribir(wav, { modelo, idioma });
    metricas.ms_whisper = Date.now() - th;
    metricas.ms_total = Date.now() - t0;

    const cubierto = segmentos.length ? segmentos[segmentos.length - 1].hasta : 0;
    return { ok: true, segmentos, duracion_audio_s: medida.duracion_s,
             cubierto_s: cubierto, modelo, metricas };
  } catch (e) {
    return { ok: false, motivo: `AUDIO_UNAVAILABLE: ${e.message}`, segmentos: [], metricas };
  }
}

/** Guarda la transcripcion como UNA senial `transcript`, con sus tiempos. Idempotente. */
function guardar(itemId, segmentos, { modelo = 'base' } = {}) {
  const db = require('./db');
  if (!segmentos.length) return;
  const texto = segmentos.map(s => `[${s.desde.toFixed(1)}s] ${s.texto}`).join('\n');
  db.run(`INSERT INTO signals (item_id, kind, content, extractor, metadata)
          VALUES (?, 'transcript', ?, ?, ?)
          ON CONFLICT(item_id, kind, extractor) DO UPDATE SET
            content=excluded.content, metadata=excluded.metadata`,
    itemId, texto, `whisper.cpp:${modelo}`,
    JSON.stringify({ segmentos: segmentos.length,
                     cubierto_s: segmentos[segmentos.length - 1].hasta }));
}

module.exports = { extraer, guardar, transcribir, bajar, aWav, disponible, FORMATO_AUDIO };
