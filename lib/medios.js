// MEDIR ANTES DE MIRAR.
//
// El Lab analizo el Reel Metallurgia y dijo "24 frames analizados" sin saber que el video
// duraba 6:16. Con ese dato faltante, 24 frames sonaba a mucho: era el 15,4% del timeline.
// ffprobe estaba instalado al lado de ffmpeg, en la misma carpeta, y no se usaba.
//
// La leccion no es "usar ffprobe". Es: **el denominador de una cobertura no lo puede fijar
// el mismo proceso que la consume**. Se mide aparte, primero, contra la fuente.
//
// Todo lo de aca es local y gratis: ffprobe, whisper.cpp y tesseract corren en la maquina.

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { bin } = require('./senales');

// Herramientas que no vienen por WinGet y por eso `bin()` no las encuentra.
const WHISPER_DIR = process.env.LAB_WHISPER_DIR || 'C:\\dev\\tools\\whisper';
const TESSDATA_DIR = process.env.LAB_TESSDATA_DIR || 'C:\\dev\\tools\\tessdata';

const whisperCli = () => path.join(WHISPER_DIR, 'Release', 'whisper-cli.exe');
const whisperModelo = (n = 'base') => path.join(WHISPER_DIR, 'models', `ggml-${n}.bin`);

/** El tessdata propio: eng + osd copiados de Program Files, spa bajado del repo oficial. */
function tessdata() {
  return fs.existsSync(path.join(TESSDATA_DIR, 'spa.traineddata')) ? TESSDATA_DIR : null;
}

/**
 * Mide un medio SIN interpretarlo. Devuelve lo que el archivo dice de si mismo.
 * Si ffprobe no esta, se dice — no se adivina una duracion.
 */
function medir(archivo) {
  const ff = bin('ffprobe');
  if (!ff) return { ok: false, motivo: 'falta ffprobe' };
  try {
    const salida = execFileSync(ff, ['-v', 'error', '-show_entries',
      'format=duration,size', '-show_entries',
      'stream=index,codec_type,codec_name,width,height,avg_frame_rate,sample_rate,channels',
      '-of', 'json', archivo], { encoding: 'utf8', timeout: 30000, maxBuffer: 1 << 20 });
    const j = JSON.parse(salida);
    const streams = j.streams ?? [];
    const video = streams.find(s => s.codec_type === 'video') ?? null;
    const audio = streams.find(s => s.codec_type === 'audio') ?? null;
    const dur = Number(j.format?.duration);
    return {
      ok: Number.isFinite(dur) && dur > 0,
      duracion_s: Number.isFinite(dur) ? Number(dur.toFixed(2)) : null,
      bytes: Number(j.format?.size) || null,
      video: video && { codec: video.codec_name, w: video.width, h: video.height,
                        fps: video.avg_frame_rate },
      audio: audio && { codec: audio.codec_name, hz: Number(audio.sample_rate) || null,
                        canales: audio.channels ?? null },
      motivo: Number.isFinite(dur) && dur > 0 ? null : 'ffprobe no devolvio duracion',
    };
  } catch (e) {
    return { ok: false, motivo: `ffprobe fallo: ${e.message}` };
  }
}

/**
 * Que herramientas locales hay para entender un medio a fondo.
 * Se reporta cada una por separado: faltar transcripcion NO es lo mismo que faltar OCR,
 * y el informe final tiene que poder decir cual falto.
 */
function capacidades() {
  const td = tessdata();
  let idiomas = [];
  if (td) idiomas = fs.readdirSync(td).filter(f => f.endsWith('.traineddata'))
    .map(f => f.replace('.traineddata', '')).sort();
  return {
    ffprobe: { ok: Boolean(bin('ffprobe')) },
    ffmpeg: { ok: Boolean(bin('ffmpeg')) },
    ytdlp: { ok: Boolean(bin('yt-dlp')) },
    whisper: { ok: fs.existsSync(whisperCli()) && fs.existsSync(whisperModelo()),
               cli: whisperCli(), modelo: 'base' },
    ocr: { ok: Boolean(td), idiomas, dir: td },
  };
}

module.exports = { medir, capacidades, whisperCli, whisperModelo, tessdata,
                   WHISPER_DIR, TESSDATA_DIR };
