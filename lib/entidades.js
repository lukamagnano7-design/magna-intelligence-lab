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

// LO QUE APARECE EN PANTALLA y no se dice en voz alta. Se aplica solo a `frame_ocr`.
// Salio de mirar el OCR real de @diegovasquez_ai el 24/08/2026: no siempre hay una URL
// completa. Muchas veces hay una ruta de archivo, un comando, o el nombre a secas.
// El OCR ademas come letras (leyo "lob/main" por "blob/main"), asi que los patrones
// toleran el primer caracter.
const PATRONES_PANTALLA = [
  // .../blob/main/<skill>/SKILL.md  -> el nombre de la skill esta en la ruta
  { re: /b?lob\/(?:main|master)\/([\w.-]+)\/SKILL\.md/gi, type: 'skill', grupo: 1 },
  // github.com/owner/repo
  { re: /github\.com\/([\w.-]+\/[\w.-]+)/gi, type: 'repository', grupo: 1 },
  // comandos de instalacion: npx / npm i / pip install / git clone
  { re: /\bnpx\s+([@\w./-]{3,40})/gi, type: 'tool', grupo: 1 },
  { re: /\bnpm\s+(?:i|install)\s+([@\w./-]{3,40})/gi, type: 'tool', grupo: 1 },
  { re: /\bpip\s+install\s+([\w.-]{3,40})/gi, type: 'tool', grupo: 1 },
  { re: /\bgit\s+clone\s+\S*?([\w.-]+\/[\w.-]+?)(?:\.git)?\b/gi, type: 'repository', grupo: 1 },
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

  // Lo que se LEE en pantalla. Es senial fuerte: un texto escrito no depende de que el
  // creador lo pronuncie, y muchas veces es lo unico que identifica a la tecnologia.
  if (kind === 'frame_ocr') {
    for (const p of PATRONES_PANTALLA) {
      for (const m of texto.matchAll(p.re)) {
        const val = (m[p.grupo] || '').trim().replace(/[.,;]+$/, '');
        if (val.length < 3 || RUIDO.test(val)) continue;
        if (found.some(f => (f.normalized || '').toLowerCase() === val.toLowerCase())) continue;
        found.push({ raw_mention: val, entity_type: p.type, normalized: val,
                     confidence: Math.min(0.92, base + 0.05),
                     metadata: { via: 'texto en pantalla' } });
      }
    }
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

// CANONICALIZACION PARA LA FUSION.
//
// El transcript dice "skills de Claude"; el OCR lee "anthropics/skills". Son LA MISMA COSA,
// pero como texto no se parecen en nada, asi que sin esto quedarian como dos entidades
// sueltas y se perderia justamente la convergencia, que es lo que da certeza.
//
// El registro curado (seed/fuentes_oficiales.json) ya sabe que "Claude Skills" vive en
// "anthropics/skills". Se usa ESE conocimiento, no parecido de strings — que seria volver
// al bug de Polar/GRUPOLAR.
const REGISTRO = require('../seed/fuentes_oficiales.json').filter(x => x.nombre);

function claveCanonica(nombre) {
  const n = String(nombre).toLowerCase().trim();
  for (const r of REGISTRO) {
    const nombres = [r.nombre, ...(r.alias || [])].map(x => x.toLowerCase());
    if (nombres.includes(n)) return (r.repo || r.nombre).toLowerCase();
    if (r.repo && r.repo.toLowerCase() === n) return r.repo.toLowerCase();
  }
  return n;
}

/** Fragmento de texto alrededor de la mencion, para poder auditar de donde salio. */
function recorte(texto, mencion) {
  const i = texto.toLowerCase().indexOf(mencion.toLowerCase());
  if (i < 0) return mencion;
  return texto.slice(Math.max(0, i - 45), i + mencion.length + 45).replace(/\s+/g, ' ').trim();
}

/** El timestamp del frame donde aparecio, si la senial es OCR (formato "[12s] texto"). */
function tsDe(contenido, mencion) {
  const i = contenido.toLowerCase().indexOf(mencion.toLowerCase());
  if (i < 0) return null;
  const antes = contenido.slice(0, i);
  const m = [...antes.matchAll(/\[(\d+(?:\.\d+)?)s\]/g)].pop();
  return m ? Number(m[1]) : null;
}

/**
 * SIGNAL FUSION.
 *
 * No hay tres detectores separados creando entidades duplicadas. Hay UN detector que corre
 * sobre cada senial, y despues las menciones se FUSIONAN por clave canonica.
 *
 * Lo que gana con la fusion no es la confianza de la mejor senial: es la CONVERGENCIA.
 * Que el creador diga "las skills de Claude" Y que en pantalla se lea "anthropics/skills"
 * es muchisimo mas fuerte que cualquiera de las dos por separado, porque son dos caminos
 * independientes que llegan al mismo lugar.
 *
 * Y cada evidencia queda guardada con su recorte y su timestamp: nunca alcanza con
 * "el Lab detecto X", tiene que poder responder POR QUE.
 */
function extraerEntidades(itemId) {
  const senales = db.all('SELECT * FROM signals WHERE item_id = ?', itemId);
  const porClave = new Map();

  for (const s of senales) {
    for (const e of detectar(s.content, s.kind)) {
      const clave = claveCanonica(e.normalized || e.raw_mention);
      const evidencia = { signal_kind: s.kind, snippet: recorte(s.content, e.raw_mention),
                          ts_seconds: s.kind === 'frame_ocr' ? tsDe(s.content, e.raw_mention) : null,
                          confidence: e.confidence };
      const prev = porClave.get(clave);
      if (!prev) porClave.set(clave, { ...e, signal_id: s.id, evidencias: [evidencia] });
      else {
        prev.evidencias.push(evidencia);
        // Se conserva la lectura mas fuerte de la entidad, pero sumando la evidencia nueva.
        if (e.confidence > prev.confidence)
          Object.assign(prev, { ...e, signal_id: s.id, evidencias: prev.evidencias });
      }
    }
  }

  // Confianza por CONVERGENCIA de seniales independientes.
  // Una URL exacta leida en pantalla y ademas nombrada en el audio no deja lugar a dudas.
  for (const e of porClave.values()) {
    const kinds = new Set(e.evidencias.map(v => v.signal_kind));
    e.signal_count = kinds.size;
    const urlExacta = e.entity_type === 'repository' && /\//.test(e.normalized ?? '');
    e.confidence_label =
      kinds.size >= 2 && (urlExacta || kinds.has('frame_ocr')) ? 'VERY_HIGH'
      : kinds.size >= 2 ? 'HIGH'
      : urlExacta        ? 'HIGH'
      : e.confidence >= 0.7 ? 'MEDIUM'
      : 'LOW';
    // La convergencia tambien sube el numero, con techo: dos seniales no dan certeza total.
    if (kinds.size >= 2) e.confidence = Math.min(0.97, e.confidence + 0.15 * (kinds.size - 1));
  }

  const guardadas = [];
  db.tx(() => {
    // Se borran TODAS, no solo las 'pending'. Antes se conservaban las ya resueltas y cada
    // corrida acumulaba duplicados (7 -> 10 -> 13...), inflando el score de verificabilidad.
    // Analizar dos veces el mismo item tiene que dar el mismo resultado.
    db.run('DELETE FROM entities WHERE item_id = ?', itemId);
    const framesPorTs = Object.fromEntries(
      db.all('SELECT id, ts_seconds FROM frames WHERE item_id = ?', itemId)
        .map(f => [f.ts_seconds, f.id]));

    for (const e of porClave.values()) {
      const estado = e.descartar ? 'discarded' : 'pending';
      db.run(`INSERT INTO entities (item_id, signal_id, raw_mention, entity_type, normalized,
                confidence, confidence_label, signal_count, resolution_status, discard_reason)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        itemId, e.signal_id, e.raw_mention, e.entity_type, e.normalized,
        e.confidence, e.confidence_label, e.signal_count, estado, e.descartar ?? null);
      const eid = db.get(
        'SELECT id FROM entities WHERE item_id = ? AND raw_mention = ?', itemId, e.raw_mention).id;
      for (const v of e.evidencias)
        db.run(`INSERT INTO entity_evidence (entity_id, signal_kind, frame_id, ts_seconds,
                  snippet, confidence) VALUES (?, ?, ?, ?, ?, ?)`,
          eid, v.signal_kind, framesPorTs[v.ts_seconds] ?? null, v.ts_seconds,
          v.snippet.slice(0, 300), v.confidence);
      guardadas.push({ ...e, estado });
    }
  });
  return guardadas.sort((a, b) => b.confidence - a.confidence);
}

module.exports = { extraerEntidades, detectar, esAfiliado, VOCABULARIO };
