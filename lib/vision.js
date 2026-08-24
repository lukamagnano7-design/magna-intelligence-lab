// SENIAL VISUAL.
//
// El objetivo NO es "OCR de videos". Es que el Lab entienda lo que el creador MUESTRA,
// que muchas veces no es lo que dice. El OCR es una herramienta de esta capa, no la capa.
//
// TODO lo de aca salio de medir sobre contenido real el 24/08/2026, no de suponer:
//
//   * Los videos son Shorts verticales de 25 a 71 segundos.
//   * Bajar en 720x1280 pesa ~5 MB y tarda ~5 s. El default de yt-dlp (360x640) tiene 4x
//     menos pixeles y el OCR se pierde el texto chico.
//   * PREPROCESAR ES LO QUE DEFINE TODO: sobre el frame crudo, tesseract devolvia
//     "€) sltrapp/nen x". Con upscale x3 + escala de grises, el MISMO frame devolvio
//     "lob/main/add-login/SKILL.md". La ruta del archivo estaba ahi todo el tiempo.
//   * Sumar contraste ademas del gris empeoro el resultado. Por eso no esta.
//
// El contrato de `frames` deja lugar para observaciones de un modelo visual (observations,
// visual_entities). Hoy quedan vacias A PROPOSITO: no tenemos ese modelo y no se inventan.

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const db = require('./db');
const { bin } = require('./senales');

const INTERVALO_S = 2;      // un frame cada 2 s: en un Short de 60 s da ~30 candidatos
const UPSCALE = 3;          // medido: x3 es lo que hace legible el texto chico
const HAMMING_MAX = 6;      // <= 6 bits de diferencia sobre 64 = visualmente el mismo frame
const MAX_FRAMES = 24;      // techo duro de frames a OCRear, para acotar costo

/** Herramientas que necesita esta capa. Si falta alguna, se dice cual. */
function disponible() {
  const falta = [];
  if (!bin('yt-dlp')) falta.push('yt-dlp');
  if (!bin('ffmpeg')) falta.push('ffmpeg');
  if (!bin('tesseract') && !fs.existsSync('C:\\Program Files\\Tesseract-OCR\\tesseract.exe'))
    falta.push('tesseract');
  return falta.length ? { ok: false, motivo: `falta ${falta.join(', ')}` } : { ok: true };
}

const tesseract = () => bin('tesseract') ?? 'C:\\Program Files\\Tesseract-OCR\\tesseract.exe';

/**
 * Huella perceptual (average hash) en Node puro, sin dependencias.
 * ffmpeg reduce el frame a 8x8 en gris crudo; el hash es "cada pixel vs el promedio".
 * Dos frames de la misma pantalla dan hashes casi iguales aunque cambie el cursor.
 */
function phash(ffmpegPath, imagen) {
  const raw = execFileSync(ffmpegPath,
    ['-hide_banner', '-loglevel', 'error', '-i', imagen,
     '-vf', 'scale=8:8:flags=area,format=gray', '-f', 'rawvideo', '-'],
    { maxBuffer: 1 << 20, timeout: 20000 });
  const px = [...raw.subarray(0, 64)];
  const prom = px.reduce((a, b) => a + b, 0) / px.length;
  return px.map(p => (p >= prom ? '1' : '0')).join('');
}

const hamming = (a, b) => {
  let d = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) d++;
  return d;
};

/** OCR de un frame, con el preprocesado que se midio como el mejor. */
function ocr(ffmpegPath, imagen, tmp) {
  const grande = path.join(tmp, `up_${path.basename(imagen, '.jpg')}.png`);
  try {
    execFileSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-i', imagen,
      '-vf', `scale=iw*${UPSCALE}:ih*${UPSCALE}:flags=lanczos,format=gray`,
      '-q:v', '1', grande, '-y'], { timeout: 30000 });
    const txt = execFileSync(tesseract(), [grande, '-', '--psm', '6'],
      { encoding: 'utf8', timeout: 45000, stdio: ['ignore', 'pipe', 'ignore'] });
    return txt.replace(/[ \t]+/g, ' ').split('\n').map(l => l.trim()).filter(Boolean).join('\n');
  } catch { return null; }         // un frame ilegible se registra y se sigue
  finally { try { fs.rmSync(grande, { force: true }); } catch {} }
}

/**
 * Extrae senial visual de un item.
 * NUNCA lanza: si algo falla devuelve {ok:false, motivo} y el analisis sigue con las
 * otras seniales. La vision es enriquecimiento, no un punto unico de falla.
 */
function extraer(item, { maxFrames = MAX_FRAMES } = {}) {
  const d = disponible();
  if (!d.ok) return { ok: false, motivo: `VISUAL_SIGNAL_UNAVAILABLE: ${d.motivo}`, frames: [] };

  const t0 = Date.now();
  const ff = bin('ffmpeg');
  const yt = bin('yt-dlp');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mil-vis-'));
  const metricas = { candidatos: 0, descartados_redundantes: 0, ocr_vacios: 0,
                     ms_descarga: 0, ms_frames: 0, ms_ocr: 0, mb_disco: 0 };

  try {
    // 1. Bajar el video. Se limita la altura para no traer 4K de un Short.
    const td = Date.now();
    try {
      execFileSync(yt, ['-f', 'bestvideo[height<=1280]/best[height<=1280]',
        '--no-warnings', '-o', path.join(tmp, 'v.%(ext)s'), item.url],
        { stdio: 'ignore', timeout: 240000 });
    } catch { /* puede fallar en un formato y haber bajado otro: manda el disco */ }
    metricas.ms_descarga = Date.now() - td;

    const vid = fs.readdirSync(tmp).find(f => /\.(mp4|webm|mkv)$/i.test(f));
    if (!vid) return { ok: false, motivo: 'VISUAL_SIGNAL_UNAVAILABLE: no se pudo bajar el video',
                       frames: [], metricas };

    // 2. Muestreo por intervalo. Se probo tambien deteccion de escenas de ffmpeg y sobre
    //    este material devolvio 0 frames: los Shorts tienen corte continuo y el umbral no
    //    discrimina. El intervalo + dedup perceptual da el mismo resultado y es predecible.
    const tf = Date.now();
    execFileSync(ff, ['-hide_banner', '-loglevel', 'error', '-i', path.join(tmp, vid),
      '-vf', `fps=1/${INTERVALO_S}`, '-q:v', '2', path.join(tmp, 'f_%03d.jpg')],
      { timeout: 180000 });
    const archivos = fs.readdirSync(tmp).filter(f => /^f_\d+\.jpg$/.test(f)).sort();
    metricas.candidatos = archivos.length;
    metricas.ms_frames = Date.now() - tf;

    // 3. Deduplicacion perceptual. Un Short deja la misma pantalla varios segundos:
    //    OCRear cuatro veces la misma terminal es puro costo sin senial nueva.
    const elegidos = [];
    for (let i = 0; i < archivos.length; i++) {
      const f = path.join(tmp, archivos[i]);
      let h; try { h = phash(ff, f); } catch { h = null; }
      const dup = h && elegidos.some(e => e.phash && hamming(e.phash, h) <= HAMMING_MAX);
      if (dup) { metricas.descartados_redundantes++; continue; }
      elegidos.push({ archivo: f, ts: i * INTERVALO_S, phash: h });
      if (elegidos.length >= maxFrames) break;
    }

    // 4. OCR sobre los que sobrevivieron.
    const to = Date.now();
    const frames = [];
    for (const e of elegidos) {
      const texto = ocr(ff, e.archivo, tmp);
      if (!texto) metricas.ocr_vacios++;
      frames.push({ ts_seconds: e.ts, phash: e.phash, ocr_text: texto,
                    visual_entities: [], observations: [] });
    }
    metricas.ms_ocr = Date.now() - to;
    metricas.mb_disco = Number((fs.readdirSync(tmp)
      .reduce((a, f) => a + (fs.statSync(path.join(tmp, f)).size || 0), 0) / 1048576).toFixed(1));
    metricas.ms_total = Date.now() - t0;

    return { ok: true, frames, metricas };
  } catch (e) {
    return { ok: false, motivo: `VISUAL_SIGNAL_UNAVAILABLE: ${e.message}`, frames: [], metricas };
  } finally { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {} }
}

/** Guarda los frames y consolida su OCR como una senial `frame_ocr`. Idempotente. */
function guardar(itemId, frames) {
  db.tx(() => {
    db.run('DELETE FROM frames WHERE item_id = ?', itemId);
    for (const f of frames)
      db.run(`INSERT INTO frames (item_id, ts_seconds, phash, ocr_text, visual_entities,
                observations, extractor)
              VALUES (?, ?, ?, ?, ?, ?, 'ffmpeg+tesseract')`,
        itemId, f.ts_seconds, f.phash, f.ocr_text,
        JSON.stringify(f.visual_entities ?? []), JSON.stringify(f.observations ?? []));

    // El texto de todos los frames se guarda ademas como UNA senial, para que el extractor
    // de entidades lo trate igual que a la transcripcion, sin saber de donde vino.
    const junto = frames.filter(f => f.ocr_text)
      .map(f => `[${f.ts_seconds}s] ${f.ocr_text}`).join('\n');
    if (junto)
      db.run(`INSERT INTO signals (item_id, kind, content, extractor, metadata)
              VALUES (?, 'frame_ocr', ?, 'ffmpeg+tesseract', ?)
              ON CONFLICT(item_id, kind, extractor) DO UPDATE SET
                content=excluded.content, metadata=excluded.metadata`,
        itemId, junto, JSON.stringify({ frames: frames.length }));
  });
}

module.exports = { extraer, guardar, disponible, phash, hamming, ocr,
                   INTERVALO_S, UPSCALE, HAMMING_MAX };
