// Colector de feeds. Trae novedades y las guarda en `items`.
//
// El mecanismo es UNO SOLO para GitHub, YouTube, podcasts y blogs: pedir un feed publico y
// comparar contra lo que ya vimos. Lo que cambia por plataforma es el parseo, que es fino.
// Ver docs/FUENTES.md.
//
// El anti-duplicado es `items.fingerprint` (UNIQUE): un item que ya entro no vuelve a entrar,
// aunque el feed lo repita todos los dias.

const crypto = require('node:crypto');
const db = require('./db');

const UA = 'Mozilla/5.0 (compatible; MagnaIntelligenceLab/0.1)';

/** Baja una URL con timeout y reintentos. Los feeds fallan seguido por rate limit. */
async function fetchText(url, { intentos = 3, timeoutMs = 20000 } = {}) {
  let ultimo;
  for (let i = 1; i <= intentos; i++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      ultimo = e;
      if (i < intentos) await new Promise(r => setTimeout(r, 2000 * i));
    }
  }
  throw ultimo;
}

const tag = (xml, t) => {
  const m = xml.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`));
  return m ? m[1].trim() : null;
};

const unescape = (s) => s && s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'").replace(/&amp;/g, '&').trim();

/** Parsea un feed Atom de YouTube -> lista de videos. */
function parseYouTube(xml) {
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, e]) => {
    const vid = tag(e, 'yt:videoId');
    return {
      external_id: vid,
      item_type: 'video',
      title: unescape(tag(e, 'title')),
      url: vid ? `https://www.youtube.com/watch?v=${vid}` : null,
      published_at: tag(e, 'published'),
      raw_text: unescape(tag(e, 'media:description')),
      raw_metadata: { autor: unescape(tag(e, 'name')) },
    };
  }).filter(v => v.external_id);
}

/** Parsea un RSS 2.0 generico (podcasts, blogs) -> lista de episodios/posts. */
function parseRss(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, e]) => {
    const link = unescape(tag(e, 'link'));
    const guid = unescape(tag(e, 'guid')) || link;
    const encl = e.match(/<enclosure[^>]*url="([^"]+)"/);
    return {
      external_id: guid,
      item_type: 'episodio',
      title: unescape(tag(e, 'title')),
      url: link,
      published_at: unescape(tag(e, 'pubDate')),
      raw_text: unescape(tag(e, 'description')),
      raw_metadata: { audio: encl ? encl[1] : null },
    };
  }).filter(v => v.external_id);
}

/** Huella estable: misma fuente + mismo id externo = mismo item, siempre. */
const fingerprint = (platform, externalId) =>
  crypto.createHash('sha256').update(`${platform}::${externalId}`).digest('hex').slice(0, 32);

/** Devuelve la URL del feed de una fuente, o null si todavia no sabemos entrar. */
function feedUrl(src) {
  const meta = JSON.parse(src.metadata || '{}');
  if (meta.rss) return meta.rss;
  if (src.platform === 'youtube' && meta.channel_id)
    return `https://www.youtube.com/feeds/videos.xml?channel_id=${meta.channel_id}`;
  return null;
}

/**
 * Recorre una fuente y guarda lo nuevo.
 * Devuelve {fuente, nuevos, total, error}.
 */
async function recolectar(src) {
  const url = feedUrl(src);
  if (!url) return { fuente: src.handle, nuevos: 0, total: 0, error: 'sin feed conocido' };

  let entradas;
  try {
    const xml = await fetchText(url);
    entradas = src.platform === 'youtube' ? parseYouTube(xml) : parseRss(xml);
  } catch (e) {
    return { fuente: src.handle, nuevos: 0, total: 0, error: e.message };
  }

  let nuevos = 0;
  db.tx(() => {
    for (const it of entradas) {
      const fp = fingerprint(src.platform, it.external_id);
      if (db.get('SELECT 1 FROM items WHERE fingerprint = ?', fp)) continue;
      db.run(`INSERT INTO items (source_id, external_id, item_type, title, url,
                published_at, raw_text, raw_metadata, fingerprint)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        src.id, it.external_id, it.item_type, it.title, it.url,
        it.published_at, it.raw_text, JSON.stringify(it.raw_metadata ?? {}), fp);
      nuevos++;
    }
  });
  return { fuente: src.handle, nuevos, total: entradas.length, error: null };
}

module.exports = { recolectar, fetchText, parseYouTube, parseRss, fingerprint, feedUrl };
