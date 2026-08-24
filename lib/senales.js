// EXTRACTORES DE SENIAL.
//
// Correccion conceptual de Luka (24/08/2026): el pipeline NO es video->frames->OCR->URL.
// Eso supondria que una tecnologia siempre aparece escrita en pantalla, y es falso: se la
// nombra hablando, se la escribe en el titulo, se la tipea en una terminal, o las tres cosas.
//
// Entonces: cada senial es un PLUGIN con la misma forma. El pipeline pide "dame todas las
// seniales de este item" y cada extractor aporta lo que puede. Si una herramienta no esta
// instalada, ese extractor se declara no-disponible y el pipeline sigue —
// **degradado, pero nunca roto, y diciendo que le falto**.
//
// Contrato de un extractor:
//   { kind, nombre, disponible() -> {ok, motivo}, extraer(item) -> [{content, metadata}] }

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const db = require('./db');

// Busca un ejecutable. En Windows, winget no siempre lo deja en el PATH que hereda Node:
// yt-dlp quedo en Packages\ y ffmpeg vino anidado adentro del paquete de yt-dlp. Por eso se
// buscan las rutas concretas ademas del PATH, y se cachea el resultado.
const _binCache = new Map();
function bin(cmd) {
  if (_binCache.has(cmd)) return _binCache.get(cmd);
  const WG = path.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'WinGet');
  const candidatos = [cmd, path.join(WG, 'Links', `${cmd}.exe`)];

  // Barrido de un nivel por WinGet\Packages\*, incluyendo un bin/ anidado.
  try {
    for (const d of fs.readdirSync(path.join(WG, 'Packages'))) {
      const base = path.join(WG, 'Packages', d);
      candidatos.push(path.join(base, `${cmd}.exe`));
      try {
        for (const sub of fs.readdirSync(base)) {
          candidatos.push(path.join(base, sub, `${cmd}.exe`));
          candidatos.push(path.join(base, sub, 'bin', `${cmd}.exe`));
        }
      } catch { /* no es directorio */ }
    }
  } catch { /* sin WinGet */ }

  // ffmpeg usa `-version` (un guion), no `--version`. Se prueban las dos formas.
  for (const p of candidatos) {
    for (const flag of ['--version', '-version']) {
      try { execFileSync(p, [flag], { stdio: 'ignore', timeout: 15000 });
            _binCache.set(cmd, p); return p; }
      catch { /* probar la otra forma */ }
    }
  }
  _binCache.set(cmd, null);
  return null;
}

// ---------------------------------------------------------------- metadata
// Siempre disponible: ya lo trajo el colector. Es la senial mas barata y suele alcanzar.
const metadata = {
  kind: 'metadata',
  nombre: 'metadata-youtube',
  disponible: () => ({ ok: true }),
  extraer(item) {
    const partes = [`TITULO: ${item.title || ''}`];
    if (item.raw_text) partes.push(`DESCRIPCION:\n${item.raw_text}`);
    const meta = JSON.parse(item.raw_metadata || '{}');
    if (meta.autor) partes.push(`AUTOR: ${meta.autor}`);
    // Los capitulos son senial de alta densidad: nombran tecnologias en pocas palabras.
    const caps = [...(item.raw_text || '').matchAll(/^\s*(\d{1,2}:\d{2}(?::\d{2})?)\s+(.+)$/gm)]
      .map(([, t, txt]) => `${t} ${txt.trim()}`);
    if (caps.length) partes.push(`CAPITULOS:\n${caps.join('\n')}`);
    return [{ content: partes.join('\n\n'), metadata: { capitulos: caps.length } }];
  },
};

// ---------------------------------------------------------------- transcript
// La senial principal cuando el creador retiene el link ("comenta SKILLS").
// Ahi la tecnologia solo existe en lo que dice en voz alta.
const transcript = {
  kind: 'transcript',
  nombre: 'yt-dlp-subs',
  disponible() {
    const p = bin('yt-dlp');
    return p ? { ok: true, path: p }
             : { ok: false, motivo: 'yt-dlp no instalado (winget install yt-dlp.yt-dlp)' };
  },
  extraer(item) {
    const d = this.disponible();
    if (!d.ok) throw new Error(d.motivo);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mil-'));
    try {
      // Se piden POCOS idiomas de a uno. Pedir 'es.*,en.*' de una hace que YouTube
      // devuelva 429 Too Many Requests (verificado 24/08/2026): son muchas descargas
      // seguidas. Con el primero que entra alcanza.
      for (const lang of ['es', 'es-orig', 'en']) {
        try {
          execFileSync(d.path, ['--skip-download', '--write-auto-subs',
            '--sub-langs', lang, '--sub-format', 'vtt', '--no-warnings',
            '-o', path.join(tmp, 'v.%(ext)s'), item.url],
            { stdio: 'ignore', timeout: 120000 });
        } catch { /* este idioma no esta o dio 429: se revisa igual el disco, ver abajo */ }

        // CLAVE: no confiar en el codigo de salida. yt-dlp puede fallar en un idioma
        // DESPUES de haber escrito otro. Antes se descartaba un subtitulo bueno por un
        // error parcial. Manda lo que hay en disco, no el exit code.
        const vtt = fs.readdirSync(tmp).filter(f => f.endsWith('.vtt'));
        if (!vtt.length) continue;
        const texto = limpiarVtt(fs.readFileSync(path.join(tmp, vtt[0]), 'utf8'));
        if (texto) return [{ content: texto,
                             metadata: { archivo: vtt[0], idioma: lang, chars: texto.length } }];
      }
      return [];
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  },
};

/** VTT -> texto corrido. Los autosubs repiten cada linea 2-3 veces por el efecto karaoke. */
function limpiarVtt(vtt) {
  const vistas = new Set();
  const out = [];
  for (let l of vtt.split('\n')) {
    l = l.replace(/<[^>]+>/g, '').trim();
    if (!l || l === 'WEBVTT' || l.includes('-->') || /^\d+$/.test(l)) continue;
    if (/^(Kind|Language):/.test(l)) continue;
    if (vistas.has(l)) continue;
    vistas.add(l);
    out.push(l);
  }
  return out.join(' ').replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------- frames + OCR
// La senial que Luka identifico como clave para Instagram: la URL visible en el screen
// recording. Requiere yt-dlp + ffmpeg + un OCR. Declarada, no implementada todavia:
// el pipeline la va a pedir y ella va a decir con precision que le falta.
const frames = {
  kind: 'frame_ocr',
  nombre: 'ffmpeg-ocr',
  disponible() {
    const falta = ['yt-dlp', 'ffmpeg'].filter(c => !bin(c));
    if (falta.length) return { ok: false, motivo: `falta ${falta.join(' y ')}` };
    return { ok: false, motivo: 'OCR sin definir todavia (tesseract o API)' };
  },
  extraer() { throw new Error('frame_ocr no implementado todavia'); },
};

const EXTRACTORES = [metadata, transcript, frames];

/**
 * Corre todos los extractores sobre un item y guarda lo que consiga.
 * Devuelve {guardadas, saltadas:[{kind,motivo}], errores:[...]}.
 * NUNCA lanza por un extractor caido: reporta y sigue.
 */
function extraerSenales(item, { solo = null } = {}) {
  const res = { guardadas: [], saltadas: [], errores: [] };
  for (const ex of EXTRACTORES) {
    if (solo && !solo.includes(ex.kind)) continue;
    const d = ex.disponible();
    if (!d.ok) { res.saltadas.push({ kind: ex.kind, extractor: ex.nombre, motivo: d.motivo }); continue; }
    try {
      for (const s of ex.extraer(item)) {
        if (!s.content?.trim()) continue;
        db.run(`INSERT INTO signals (item_id, kind, content, extractor, metadata)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(item_id, kind, extractor) DO UPDATE SET
                  content=excluded.content, metadata=excluded.metadata`,
          item.id, ex.kind, s.content, ex.nombre, JSON.stringify(s.metadata ?? {}));
        res.guardadas.push({ kind: ex.kind, chars: s.content.length });
      }
    } catch (e) { res.errores.push({ kind: ex.kind, error: e.message }); }
  }
  return res;
}

module.exports = { extraerSenales, EXTRACTORES, limpiarVtt, bin };
