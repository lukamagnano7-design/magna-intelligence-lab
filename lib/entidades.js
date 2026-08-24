// EXTRACCION DE ENTIDADES.
//
// De las seniales crudas saca MENCIONES de tecnologia. Ojo: una mencion no es una verdad,
// es una pista. La verdad se establece despues, en la resolucion contra fuente primaria.
//
// Dos cosas que se aprendieron mirando los datos reales de @diegovasquez_ai (24/08/2026):
//
// 1. NO TODA URL EN UNA DESCRIPCION ES UNA TECNOLOGIA. La mayoria son links de afiliado o
//    de captacion (partner.ycloud.com/invitation/...?diegovasquez_ai, bookings de
//    leadconnectorhq, grupos de WhatsApp). Meterlos como "tecnologia detectada" ensuciaria
//    el radar con el embudo de venta del creador. Se descartan CON MOTIVO, no en silencio.
//
// 2. CUANDO NO HAY NINGUNA URL igual hay entidades: los nombres propios de herramientas
//    aparecen en el titulo, en los capitulos y en lo que dice hablando. Ese es justamente
//    el caso que obliga a que el pipeline sea multi-senial.

const db = require('./db');

// Dominios que son embudo del creador, no tecnologia.
const AFILIADO = [
  /partner\./i, /\/invitation\//i, /\?.*(ref|aff|utm_source)=/i,
  /chat\.whatsapp\.com/i, /leadconnectorhq\.com/i, /calendly\.com/i,
  /linktr\.ee/i, /bit\.ly/i, /\.s\.gy\//i, /patreon\.com/i,
  /instagram\.com/i, /tiktok\.com/i, /twitter\.com/i, /x\.com/i,
  /youtube\.com/i, /youtu\.be/i, /discord\.gg/i,
];

// Dominios que SI son fuente tecnica.
const TECNICO = [
  { re: /github\.com\/([\w.-]+)\/([\w.-]+)/i, type: 'repository' },
  { re: /gitlab\.com\/([\w.-]+)\/([\w.-]+)/i, type: 'repository' },
  { re: /npmjs\.com\/package\/([@\w./-]+)/i,  type: 'tool' },
  { re: /pypi\.org\/project\/([\w.-]+)/i,     type: 'tool' },
  { re: /huggingface\.co\/([\w.-]+)/i,        type: 'tool' },
  { re: /docs?\.[\w.-]+\.\w+/i,               type: 'framework' },
];

// Vocabulario conocido. No pretende ser exhaustivo: son los nombres que ya sabemos que
// importan en este dominio. Cuando aparezca uno nuevo repetido, se agrega.
const VOCABULARIO = [
  { nombre: 'Claude Code',    re: /\bclaude\s*code\b/i,                    type: 'tool' },
  { nombre: 'Claude Skills',  re: /\bskills?\b.{0,25}\bclaude\b|\bclaude\b.{0,25}\bskills?\b/i, type: 'skill' },
  { nombre: 'MCP',            re: /\bMCP\b|model context protocol/i,       type: 'mcp' },
  { nombre: 'n8n',            re: /\bn8n\b/i,                              type: 'tool' },
  { nombre: 'Supabase',       re: /\bsupabase\b/i,                         type: 'framework' },
  { nombre: 'Next.js',        re: /\bnext\.?js\b/i,                        type: 'framework' },
  { nombre: 'LangChain',      re: /\blangchain\b/i,                        type: 'framework' },
  { nombre: 'Cursor',         re: /\bcursor\b(?!\s*(del|de la))/i,         type: 'tool' },
  { nombre: 'YCloud',         re: /\bycloud\b/i,                           type: 'company' },
  { nombre: 'Zernio',         re: /\bzernio\b/i,                           type: 'company' },
  { nombre: 'Coolify',        re: /\bcoolify\b/i,                          type: 'tool' },
  { nombre: 'Vercel',         re: /\bvercel\b/i,                           type: 'company' },
  { nombre: 'WhatsApp API',   re: /whatsapp.{0,15}(api|business)/i,        type: 'framework' },
  { nombre: 'Tokko Broker',   re: /\btokko\b/i,                            type: 'company' },
  { nombre: 'Stripe',         re: /\bstripe\b/i,                           type: 'company' },
  { nombre: 'Polar',          re: /\bpolar\b/i,                            type: 'company' },
  { nombre: 'Agentic Loop',   re: /\bbucle\s+ag[eé]ntico\b|\bagentic\s+loop\b/i, type: 'technique' },
];

// Cuanto vale cada senial. Una URL escrita pesa mas que un nombre dicho al pasar.
const PESO = { metadata: 0.75, frame_ocr: 0.9, transcript: 0.6, caption: 0.7, manual: 1.0 };

// Los subtitulos automaticos escuchan mal los nombres propios. Verificado el 24/08/2026 en
// el video Eil0q3U7LwM, donde "skills de Claude" quedo transcripto como "skills de cloud".
// Sin esta correccion el extractor pierde la tecnologia principal del video.
const ASR = [
  { mal: /\bskills?\s+de\s+cloud\b/gi,  bien: 'skills de Claude' },
  { mal: /\bcloud\s+code\b/gi,          bien: 'Claude Code' },
  { mal: /\bweb\s*cook\b/gi,            bien: 'webhooks' },
  { mal: /\bSAS\b/g,                    bien: 'SaaS' },
];
const corregirAsr = (t) => ASR.reduce((s, c) => s.replace(c.mal, c.bien), t);

// Como se nombra una herramienta HABLANDO. En un video nadie dicta una URL: dice
// "se llama X", o enumera: "La segunda skill, add login". Estos patrones son la UNICA via
// de deteccion cuando el creador retiene el link a proposito.
//
// OJO con los acentos: la primera version usaba [\w .-], que no incluye vocales acentuadas,
// y por eso "bucle agentico" (con tilde) no matcheaba NADA. Verificado el 24/08/2026 sobre
// el video Eil0q3U7LwM, donde se perdian 3 de las 4 skills. De ahi el NOMBRE de abajo.
const NOMBRE = '[A-Za-zÁÉÍÓÚÜÑáéíóúüñ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 ._-]{2,28}?';
const FIN = '(?=[.,;:]|\\s+(?:y|que|te|con|en|es|para|porque)\\b|$)';

const PATRONES_NOMBRE = [
  // "se llama bucle agentico" / "se llama New App"
  new RegExp(`\\bse\\s+llama\\s+(${NOMBRE})${FIN}`, 'gi'),
  // "La segunda skill, add login" / "la cuarta, app payments" — enumeracion hablada
  new RegExp(`\\bla\\s+(?:primera|segunda|tercera|cuarta|quinta|ultima)\\s*(?:skill|herramienta)?\\s*[,:]\\s*(${NOMBRE})${FIN}`, 'gi'),
  // "la skill X" / "la herramienta X"
  new RegExp(`\\bla\\s+(?:skill|herramienta|libreria|extension)\\s+(${NOMBRE})${FIN}`, 'gi'),
  // "usando X" / "con la skill X"
  new RegExp(`\\b(?:usando|utilizando)\\s+(?:la\\s+)?(?:skill|herramienta)\\s+(${NOMBRE})${FIN}`, 'gi'),
];

// Palabras que caen en los patrones pero no son nombres de herramienta.
const RUIDO = /^(la|el|un|una|esta|este|mi|su|todo|nada|asi|muy|mas|bien|cuatro|tres|dos|inteligencia|aplicaci|documento|sistema|comando|metodo|guia|orden)/i;

const esAfiliado = (url) => AFILIADO.some(re => re.test(url));

/** Saca URLs, nombres conocidos y nombres dichos de viva voz. */
function detectar(textoCrudo, kind) {
  const base = PESO[kind] ?? 0.5;
  // Los subtitulos automaticos se corrigen; el texto escrito (metadata) no lo necesita.
  const texto = kind === 'transcript' ? corregirAsr(textoCrudo) : textoCrudo;
  const found = [];

  for (const raw of texto.match(/https?:\/\/[^\s<>")\]]+/g) || []) {
    const url = raw.replace(/[.,;:)]+$/, '');
    const tec = TECNICO.find(t => t.re.test(url));
    if (tec) {
      const m = url.match(tec.re);
      const norm = tec.type === 'repository' ? `${m[1]}/${m[2]}`.replace(/\.git$/, '') : (m[1] || url);
      // Una URL explicita es la senial mas fuerte que hay.
      found.push({ raw_mention: url, entity_type: tec.type, normalized: norm,
                   confidence: Math.min(0.95, base + 0.2) });
    } else if (esAfiliado(url)) {
      found.push({ raw_mention: url, entity_type: 'url', normalized: null, confidence: base,
                   descartar: 'link de afiliado o captacion del creador, no es tecnologia' });
    } else {
      found.push({ raw_mention: url, entity_type: 'url', normalized: null,
                   confidence: base * 0.6 });
    }
  }

  for (const v of VOCABULARIO) {
    if (!v.re.test(texto)) continue;
    // Mencionado muchas veces = mas probable que sea el tema, no una pasada al vuelo.
    const veces = (texto.match(new RegExp(v.re.source, 'gi')) || []).length;
    found.push({ raw_mention: v.nombre, entity_type: v.type, normalized: v.nombre,
                 confidence: Math.min(0.9, base + Math.min(0.15, veces * 0.03)),
                 metadata: { menciones: veces } });
  }

  // Nombres dichos hablando ("se llama X"). Confianza mas baja a proposito: es la senial
  // mas fragil que tenemos, pero cuando el creador retiene el link es la UNICA que hay.
  for (const re of PATRONES_NOMBRE) {
    for (const m of texto.matchAll(re)) {
      const nombre = m[1].trim().replace(/[.,;]+$/, '');
      if (nombre.length < 3 || RUIDO.test(nombre)) continue;
      if (found.some(f => (f.normalized || '').toLowerCase() === nombre.toLowerCase())) continue;
      found.push({ raw_mention: nombre, entity_type: 'skill', normalized: nombre,
                   confidence: Math.min(0.65, base), metadata: { via: 'nombrada en voz' } });
    }
  }
  return found;
}

/**
 * Corre la deteccion sobre TODAS las seniales del item y consolida.
 * Si una entidad aparece en varias seniales, gana la de mayor confianza —
 * que es exactamente el punto de tener un pipeline multi-senial.
 */
function extraerEntidades(itemId) {
  const senales = db.all('SELECT * FROM signals WHERE item_id = ?', itemId);
  const porClave = new Map();

  for (const s of senales) {
    for (const e of detectar(s.content, s.kind)) {
      const clave = (e.normalized || e.raw_mention).toLowerCase();
      const prev = porClave.get(clave);
      if (!prev || e.confidence > prev.confidence)
        porClave.set(clave, { ...e, signal_id: s.id, kind: s.kind });
      else prev.metadata = { ...(prev.metadata || {}), tambien_en: s.kind };
    }
  }

  const guardadas = [];
  db.tx(() => {
    // Se borran TODAS, no solo las 'pending'. Antes se conservaban las ya resueltas y cada
    // corrida acumulaba duplicados (7 -> 10 -> 13...), inflando el score de verificabilidad.
    // Analizar dos veces el mismo item tiene que dar el mismo resultado.
    db.run('DELETE FROM entities WHERE item_id = ?', itemId);
    for (const e of porClave.values()) {
      const estado = e.descartar ? 'discarded' : 'pending';
      db.run(`INSERT INTO entities (item_id, signal_id, raw_mention, entity_type, normalized,
                confidence, resolution_status, discard_reason)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        itemId, e.signal_id, e.raw_mention, e.entity_type, e.normalized,
        e.confidence, estado, e.descartar ?? null);
      guardadas.push({ ...e, estado });
    }
  });
  return guardadas.sort((a, b) => b.confidence - a.confidence);
}

module.exports = { extraerEntidades, detectar, esAfiliado, VOCABULARIO };
