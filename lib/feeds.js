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

/**
 * Resuelve el RSS publico de un podcast a partir de su NOMBRE.
 *
 * POR QUE EXISTE (LAB-INGEST-001, 25/08/2026): la fuente "Inteligencia Artificial para los
 * Negocios" estaba cargada y activa desde el 18/08 y tenia CERO items. El colector fallaba
 * con "sin feed conocido" porque un link de open.spotify.com no dice donde esta el RSS.
 * El RSS existia todo el tiempo, publico y gratis. Luka encontro el episodio #175 a mano
 * ANTES que el Lab -- y el #175 era el mas reciente del feed.
 *
 * No fallo el criterio: fallo la ingesta. `parseRss()` ya estaba escrita y funcionaba.
 *
 * Spotify no publica el RSS de un show en su API. Pero el directorio de Apple SI, y su
 * endpoint de busqueda es publico y **no requiere autenticacion**. Una llamada, sin
 * dependencias nuevas. Es el mecanismo minimo que resuelve el problema.
 */
async function resolverRssPodcast(nombre) {
  const url = 'https://itunes.apple.com/search?entity=podcast&limit=5&term='
            + encodeURIComponent(nombre);
  const j = JSON.parse(await fetchText(url));
  // Se exige coincidencia razonable del nombre: el buscador devuelve parecidos, y traer el
  // feed de OTRO podcast seria peor que no traer ninguno.
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const n = norm(nombre);
  const hit = (j.results || []).find(r => r.feedUrl && norm(r.collectionName) === n)
           ?? (j.results || []).find(r => r.feedUrl && (norm(r.collectionName).includes(n) || n.includes(norm(r.collectionName))));
  if (!hit) return null;
  return { rss: hit.feedUrl, nombre: hit.collectionName, episodios: hit.trackCount };
}

/**
 * Deja registrada la salud de la fuente en cada intento.
 * Sin esto, una fuente puede fallar en silencio durante dias -- que es exactamente lo que
 * paso con el podcast entre el 18 y el 25/08. El brief lee estas columnas.
 */
function registrarSalud(sourceId, { ok, nuevos = 0, error = null }) {
  const ahora = new Date().toISOString();
  if (ok) {
    db.run(`UPDATE sources SET last_attempt=?, last_success=?, last_error=NULL,
            fallas_seguidas=0, items_ultima_corrida=? WHERE id=?`,
      ahora, ahora, nuevos, sourceId);
  } else {
    db.run(`UPDATE sources SET last_attempt=?, last_error=?,
            fallas_seguidas=fallas_seguidas+1 WHERE id=?`,
      ahora, error, sourceId);
  }
}

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
  let url = feedUrl(src);

  // Antes de rendirse con 'sin feed conocido', intentar resolverlo. Es el bug de
  // LAB-INGEST-001: la fuente estaba bien cargada y el colector no sabia como entrar.
  if (!url && src.platform === 'podcast') {
    const meta = JSON.parse(src.metadata || '{}');
    if (meta.nombre) {
      try {
        const r = await resolverRssPodcast(meta.nombre);
        if (r) {
          url = r.rss;
          meta.rss = r.rss; meta.episodios_feed = r.episodios;
          meta.rss_resuelto = new Date().toISOString().slice(0, 10);
          db.run('UPDATE sources SET metadata=? WHERE id=?', JSON.stringify(meta), src.id);
        }
      } catch { /* si no se puede resolver, cae al error de abajo con su motivo */ }
    }
  }
  if (!url) { registrarSalud(src.id, { ok: false, error: 'sin feed conocido' });
    return { fuente: src.handle, nuevos: 0, total: 0, error: 'sin feed conocido' }; }

  let entradas;
  try {
    const xml = await fetchText(url);
    entradas = src.platform === 'youtube' ? parseYouTube(xml) : parseRss(xml);
  } catch (e) {
    registrarSalud(src.id, { ok: false, error: e.message });
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
  registrarSalud(src.id, { ok: true, nuevos });
  return { fuente: src.handle, nuevos, total: entradas.length, error: null };
}

module.exports = { recolectar, fetchText, parseYouTube, parseRss, fingerprint, feedUrl, resolverRssPodcast };
