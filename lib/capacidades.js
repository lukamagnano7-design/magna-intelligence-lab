// QUE CAPACIDADES OFRECE UNA TECNOLOGIA.
//
// Es el otro lado del match. El problema declara que NECESITA; la tecnologia declara que DA.
// El cruce se hace entre capacidades, nunca entre palabras.
//
// Tres origenes, con confianza distinta y explicita:
//   curado    -> verificado a mano y versionado en seed/. Es el unico de confianza alta.
//   declarado -> lo dice la propia documentacion oficial.
//   inferido  -> salio de leer el README con patrones. Vale MENOS y hay que decirlo.
//
// Si no se puede determinar ninguna capacidad, se devuelve vacio y el matcher concluye
// que no hay base para matchear. Eso es correcto: es mejor que inventar una capacidad.

const db = require('./db');

// Registro curado: tecnologia -> capacidades verificadas a mano.
// Solo entra lo que se pudo confirmar mirando la fuente primaria.
const CURADO = {
  'anthropics/skills': {
    caps: ['agent_task_scoping', 'knowledge_retrieval'],
    evidencia: 'El repo oficial describe Agent Skills como procedimientos empaquetados que '
             + 'se cargan segun la tarea. Eso es acotar el alcance de un agente y recuperar '
             + 'el procedimiento correcto. Verificado 24/08/2026 contra la API de GitHub.',
  },
  'Stripe':  { caps: [], evidencia: 'Pasarela de pagos. Ninguna de las capacidades de nuestra taxonomia actual (que salio de problemas de distribucion mayorista y de workflow) corresponde a cobros.' },
  'Polar':   { caps: [], evidencia: 'Plataforma de monetizacion para desarrolladores. Idem Stripe: fuera de la taxonomia actual.' },
  'Supabase':{ caps: [], evidencia: 'Backend/base de datos. No cubre ninguna capacidad de la taxonomia actual por si sola.' },
};

// Patrones para INFERIR desde el README. Deliberadamente pocos y estrictos:
// un patron laxo produce capacidades falsas, y una capacidad falsa produce un match falso.
const PATRONES = [
  { cap: 'document_extraction',        re: /\b(OCR|optical character recognition|extract.{0,20}(from )?(PDF|image|scan))\b/i },
  { cap: 'speech_to_text',             re: /\b(speech[- ]to[- ]text|transcrib\w+|whisper|ASR)\b/i },
  { cap: 'geocoding',                  re: /\b(geocod\w+|address.{0,15}coordinates|lat\/l(on|ng))\b/i },
  { cap: 'messaging_integration',      re: /\b(whatsapp|telegram|messaging API)\b/i },
  { cap: 'document_generation',        re: /\b(generate.{0,15}PDF|PDF generation|invoice.{0,10}generat)\b/i },
  { cap: 'persistent_memory',          re: /\b(persistent memory|long[- ]term memory|memory (store|layer))\b/i },
  { cap: 'knowledge_retrieval',        re: /\b(retrieval|RAG|semantic search|knowledge base)\b/i },
  { cap: 'natural_language_extraction',re: /\b(structured (output|extraction)|entity extraction|parse.{0,15}natural language)\b/i },
];

/** Asegura que la tecnologia exista en la tabla y devuelve su id. */
function registrar(nombre, url, resumen) {
  const ex = db.get('SELECT id FROM technologies WHERE canonical_url = ? OR name = ?', url, nombre);
  if (ex) return ex.id;
  db.run(`INSERT INTO technologies (name, canonical_url, summary) VALUES (?, ?, ?)`,
    nombre, url ?? null, resumen ?? null);
  return db.get('SELECT id FROM technologies WHERE name = ?', nombre).id;
}

/**
 * Determina las capacidades de una tecnologia.
 * Devuelve [{capability_id, origen, evidencia}]. Puede devolver [] legitimamente.
 */
function determinar({ nombre, repo, readme, descripcion }) {
  const validas = new Set(db.all('SELECT id FROM capabilities').map(c => c.id));
  const out = new Map();

  // 1. Curado, por repo o por nombre. Manda sobre todo lo demas.
  const cur = CURADO[repo] ?? CURADO[nombre];
  if (cur) {
    for (const c of cur.caps)
      if (validas.has(c)) out.set(c, { origen: 'curado', evidencia: cur.evidencia });
    // Un curado con lista vacia es una AFIRMACION, no un hueco: alguien miro y dijo
    // "esto no cubre nada de nuestra taxonomia". `determinado: true` le avisa al matcher
    // que puede concluir NO_MATCH en vez de "no se que hace", que son cosas distintas.
    if (!cur.caps.length)
      return { caps: [], nota_curada: cur.evidencia, determinado: true };
  }

  // 2. Inferido del README. Solo suma lo que el curado no cubrio, y con menos confianza.
  const texto = `${descripcion ?? ''}\n${readme ?? ''}`;
  for (const p of PATRONES) {
    if (out.has(p.cap) || !validas.has(p.cap)) continue;
    const m = texto.match(p.re);
    if (m) out.set(p.cap, { origen: 'inferido',
      evidencia: `patron "${m[0]}" encontrado en la documentacion oficial (inferencia, no verificado a mano)` });
  }

  return { caps: [...out].map(([capability_id, v]) => ({ capability_id, ...v })),
           nota_curada: null, determinado: Boolean(cur) };
}

/** Guarda las capacidades de una tecnologia. Idempotente. */
function guardar(technologyId, caps) {
  db.tx(() => {
    db.run('DELETE FROM technology_capabilities WHERE technology_id = ?', technologyId);
    for (const c of caps)
      db.run(`INSERT INTO technology_capabilities (technology_id, capability_id, origen, evidencia)
              VALUES (?, ?, ?, ?)`, technologyId, c.capability_id, c.origen, c.evidencia);
  });
}

module.exports = { determinar, guardar, registrar, CURADO };
