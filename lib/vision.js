// SENIAL VISUAL — lo que el creador MUESTRA.
//
// El objetivo NO es "OCR de videos". Es que el Lab entienda lo que se muestra en pantalla,
// que muchas veces no es lo que se dice. El OCR es una herramienta de esta capa, no la capa.
//
// TODO lo de aca salio de medir sobre contenido real, no de suponer:
//
//   * PREPROCESAR ES LO QUE DEFINE TODO (24/08): sobre el frame crudo, tesseract devolvia
//     "€) sltrapp/nen x". Con upscale x3 + escala de grises, el MISMO frame devolvio
//     "lob/main/add-login/SKILL.md". Sumar contraste ademas del gris empeoro el resultado.
//
//   * EL TOPE ERA POSICIONAL (25/08): habia un `break` al llegar a 24 frames elegidos,
//     dentro de un barrido secuencial. Eso NO es "24 frames repartidos": es "los primeros
//     24 distintos y chau". Sobre el Reel Metallurgia (6:16) cubrio 0-58 s = 15,4% del
//     timeline, y lo poco valioso que encontro estaba justo en el borde del corte.
//     Subir el tope no arreglaba nada: movia el borde. Ahora el presupuesto se REPARTE
//     (ver lib/cobertura.js) y ningun segmento del video queda sin mirar.
//
//   * TODO ESTABA CALIBRADO PARA SHORTS DE 25-71 s (25/08). Este Reel dura 5-15x mas:
//     78 MB y 33 s de descarga donde el comentario decia "~5 MB y ~5 s". Las constantes
//     ahora escalan con la duracion real medida, no con un supuesto.
//
//   * EL OCR LEIA EN INGLES PANTALLAS EN ESPANIOL (25/08): tesseract solo tenia `eng`.
//
// El contrato de `frames` deja lugar para observaciones de un modelo visual (observations,
// visual_entities). Hoy quedan vacias A PROPOSITO: no tenemos ese modelo y no se inventan.

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const db = require('./db');
const { bin } = require('./senales');
const medios = require('./medios');
const cobertura = require('./cobertura');

const INTERVALO_S = 2;      // un candidato cada 2 s a lo largo de TODO el material
const UPSCALE = 3;          // medido: x3 es lo que hace legible el texto chico
const HAMMING_MAX = 6;      // <= 6 bits de diferencia sobre 64 = visualmente el mismo frame
const TECHO_FRAMES = 120;   // tope duro de OCR, ya no posicional: se reparte por segmento
// PSM 6, medido — no supuesto. La hipotesis era que psm 11 (texto disperso) le ganaria a
// psm 6 (bloque uniforme) sobre capturas de paneles y navegador. Se midio sobre 3 frames
// reales del Reel contando palabras legibles de 4+ letras:
//     t=18s   psm3: 5   psm4: 5   psm6: 9
//     t=40s   psm3: 8   psm4: 8   psm6: 18
//     t=300s  psm3: 4   psm4: 10  psm6: 6
// psm 6 gana claro en dos de tres y queda cerca en la restante; psm 11 fragmentaba las
// lineas y perdia texto. La hipotesis era falsa y el default original estaba bien.
const PSM = 6;

// El fix del audio: `bestvideo+bestaudio` baja las dos pistas y yt-dlp las multiplexa.
// Antes decia solo `bestvideo`, que por definicion excluye el audio. Ver lib/audio.js.
const FORMATO = 'bestvideo[height<=1280]+bestaudio/best[height<=1280]/best';

/** Herramientas que necesita esta capa. Si falta alguna, se dice cual. */
function disponible() {
  const falta = [];
  if (!bin('yt-dlp')) falta.push('yt-dlp');
  if (!bin('ffmpeg')) falta.push('ffmpeg');
  if (!tesseract()) falta.push('tesseract');
  return falta.length ? { ok: false, motivo: `falta ${falta.join(', ')}` } : { ok: true };
}

const tesseract = () => bin('tesseract')
  ?? (fs.existsSync('C:\\Program Files\\Tesseract-OCR\\tesseract.exe')
      ? 'C:\\Program Files\\Tesseract-OCR\\tesseract.exe' : null);

/** Idiomas de OCR realmente disponibles. `spa+eng` si esta el tessdata propio; si no, `eng`. */
function idiomasOcr() {
  const td = medios.tessdata();
  if (!td) return { lang: 'eng', dir: null, completo: false };
  const hay = fs.readdirSync(td).filter(f => f.endsWith('.traineddata'))
    .map(f => f.replace('.traineddata', ''));
  const l = ['spa', 'eng'].filter(x => hay.includes(x));
  return { lang: l.join('+') || 'eng', dir: td, completo: l.includes('spa') };
}

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
function ocr(ffmpegPath, imagen, tmp, { lang = 'eng', dir = null, psm = PSM } = {}) {
  const grande = path.join(tmp, `up_${path.basename(imagen, '.jpg')}.png`);
  try {
    execFileSync(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-i', imagen,
      '-vf', `scale=iw*${UPSCALE}:ih*${UPSCALE}:flags=lanczos,format=gray`,
      '-q:v', '1', grande, '-y'], { timeout: 30000 });
    const args = [grande, '-', '-l', lang, '--psm', String(psm)];
    if (dir) args.push('--tessdata-dir', dir);
    const txt = execFileSync(tesseract(), args,
      { encoding: 'utf8', timeout: 45000, stdio: ['ignore', 'pipe', 'ignore'] });
    return txt.replace(/[ \t]+/g, ' ').split('\n').map(l => l.trim()).filter(Boolean).join('\n');
  } catch { return null; }         // un frame ilegible se registra y se sigue
  finally { try { fs.rmSync(grande, { force: true }); } catch {} }
}

/** Baja el medio con las dos pistas. Devuelve la ruta del archivo. */
function bajar(url, tmp) {
  try {
    execFileSync(bin('yt-dlp'), ['-f', FORMATO, '--no-warnings',
      '-o', path.join(tmp, 'v.%(ext)s'), url], { stdio: 'ignore', timeout: 600000 });
  } catch { /* puede fallar un formato y haber bajado otro: manda el disco */ }
  const f = fs.readdirSync(tmp).find(x => /^v\.(mp4|webm|mkv)$/i.test(x));
  return f ? path.join(tmp, f) : null;
}

/**
 * Extrae senial visual de un item, cubriendo TODA su duracion.
 * NUNCA lanza: si algo falla devuelve {ok:false, motivo} y el analisis sigue con las otras
 * seniales. La vision es enriquecimiento, no un punto unico de falla.
 */
function extraer(item, { techo = TECHO_FRAMES, archivoLocal = null, intervalo = INTERVALO_S } = {}) {
  const d = disponible();
  if (!d.ok) return { ok: false, motivo: `VISUAL_SIGNAL_UNAVAILABLE: ${d.motivo}`, frames: [] };

  const t0 = Date.now();
  const ff = bin('ffmpeg');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mil-vis-'));
  const metricas = { candidatos: 0, descartados_redundantes: 0, ocr_vacios: 0,
                     ms_descarga: 0, ms_frames: 0, ms_phash: 0, ms_ocr: 0, mb_disco: 0 };

  try {
    // 1. El medio. Si ya esta en disco (diagnostico previo), se reutiliza: no se baja de nuevo.
    const td = Date.now();
    const vid = archivoLocal && fs.existsSync(archivoLocal) ? archivoLocal : bajar(item.url, tmp);
    metricas.ms_descarga = Date.now() - td;
    if (!vid) return { ok: false, motivo: 'VISUAL_SIGNAL_UNAVAILABLE: no se pudo bajar el video',
                       frames: [], metricas };

    // 2. MEDIR ANTES DE MIRAR. Sin duracion real no hay denominador y todo porcentaje
    //    de cobertura seria inventado. Ver lib/medios.js.
    const medida = medios.medir(vid);
    if (!medida.ok)
      return { ok: false, motivo: `VISUAL_SIGNAL_UNAVAILABLE: ${medida.motivo}`,
               frames: [], metricas };
    const duracionS = medida.duracion_s;
    const segmentos = cobertura.segmentar(duracionS);

    // 3. Candidatos por intervalo, a lo largo de TODO el material.
    //    Se probo la deteccion de escenas de ffmpeg y devolvio 0 frames sobre este material:
    //    el corte es continuo y el umbral no discrimina. Intervalo + dedup es predecible.
    const tf = Date.now();
    execFileSync(ff, ['-hide_banner', '-loglevel', 'error', '-i', vid,
      '-vf', `fps=1/${intervalo}`, '-q:v', '2', path.join(tmp, 'f_%04d.jpg')],
      { timeout: 600000 });
    const archivos = fs.readdirSync(tmp).filter(f => /^f_\d+\.jpg$/.test(f)).sort();
    metricas.candidatos = archivos.length;
    metricas.ms_frames = Date.now() - tf;

    // 4. Deduplicacion perceptual sobre TODOS los candidatos (antes se cortaba en el 24).
    const tp = Date.now();
    const unicos = [];
    for (let i = 0; i < archivos.length; i++) {
      const f = path.join(tmp, archivos[i]);
      let h; try { h = phash(ff, f); } catch { h = null; }
      const dup = h && unicos.some(e => e.phash && hamming(e.phash, h) <= HAMMING_MAX);
      if (dup) { metricas.descartados_redundantes++; continue; }
      unicos.push({ archivo: f, ts: i * intervalo, phash: h });
    }
    metricas.ms_phash = Date.now() - tp;

    // 5. EL REPARTO. Aca esta el arreglo del bug: en vez de cortar el barrido, se garantiza
    //    presencia en cada segmento y recien despues se gasta el excedente.
    const elegidos = cobertura.repartir(unicos, segmentos, techo);
    metricas.recortados_por_techo = unicos.length - elegidos.length;

    // 6. OCR en el idioma que realmente habla la pantalla.
    const idi = idiomasOcr();
    const to = Date.now();
    const frames = [];
    for (const e of elegidos) {
      const texto = ocr(ff, e.archivo, tmp, idi);
      if (!texto) metricas.ocr_vacios++;
      frames.push({ ts_seconds: e.ts, phash: e.phash, ocr_text: texto,
                    visual_entities: [], observations: [] });
    }
    metricas.ms_ocr = Date.now() - to;
    metricas.ocr_lang = idi.lang;
    metricas.mb_disco = Number((fs.readdirSync(tmp)
      .reduce((a, f) => a + (fs.statSync(path.join(tmp, f)).size || 0), 0) / 1048576).toFixed(1));
    metricas.ms_total = Date.now() - t0;

    // 7. Cobertura honesta: cuantos segmentos quedaron efectivamente representados.
    const conMuestra = segmentos.filter(s =>
      frames.some(f => f.ts_seconds >= s.desde && f.ts_seconds < s.hasta)).length;
    const cob = cobertura.evaluar({
      duracionS, segmentos, segmentosConMuestra: conMuestra,
      muestras: frames.length, candidatos: archivos.length });

    return { ok: true, frames, metricas, duracion_s: duracionS, segmentos, cobertura: cob,
             medida };
  } catch (e) {
    return { ok: false, motivo: `VISUAL_SIGNAL_UNAVAILABLE: ${e.message}`, frames: [], metricas };
  } finally { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {} }
}

/** Guarda los frames y consolida su OCR como una senial `frame_ocr`. Idempotente. */
function guardar(itemId, frames, { lang = 'eng' } = {}) {
  db.tx(() => {
    db.run('DELETE FROM frames WHERE item_id = ?', itemId);
    for (const f of frames)
      db.run(`INSERT INTO frames (item_id, ts_seconds, phash, ocr_text, visual_entities,
                observations, extractor)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        itemId, f.ts_seconds, f.phash, f.ocr_text,
        JSON.stringify(f.visual_entities ?? []), JSON.stringify(f.observations ?? []),
        `ffmpeg+tesseract:${lang}`);

    // El texto de todos los frames se guarda ademas como UNA senial, para que el extractor
    // de entidades lo trate igual que a la transcripcion, sin saber de donde vino.
    const junto = frames.filter(f => f.ocr_text)
      .map(f => `[${f.ts_seconds}s] ${f.ocr_text}`).join('\n');
    if (junto)
      db.run(`INSERT INTO signals (item_id, kind, content, extractor, metadata)
              VALUES (?, 'frame_ocr', ?, ?, ?)
              ON CONFLICT(item_id, kind, extractor) DO UPDATE SET
                content=excluded.content, metadata=excluded.metadata`,
        itemId, junto, `ffmpeg+tesseract:${lang}`, JSON.stringify({ frames: frames.length }));
  });
}

/** Escribe la cobertura consolidada del item. Es lo que impide decir "analizado" sobre el 15%. */
function guardarCobertura(itemId, cob, duracionS) {
  db.run(`UPDATE items SET coverage = ?, coverage_pct = ?, coverage_nota = ?, duracion_s = ?
          WHERE id = ?`,
    cob.estado, cob.pct, cob.nota, duracionS ?? null, itemId);
}

module.exports = { extraer, guardar, guardarCobertura, disponible, phash, hamming, ocr,
                   bajar, idiomasOcr, INTERVALO_S, UPSCALE, HAMMING_MAX, TECHO_FRAMES,
                   PSM, FORMATO };
