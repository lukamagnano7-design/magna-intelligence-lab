// BRIEF CORE — la inteligencia, separada de cómo se entrega.
//
// El Lab no entrega items: entrega DECISIONES. Luka no debería abrir 247 items;
// debería leer 3 o 4 cosas que merecen su atención.
//
// SEPARACION OBLIGATORIA: este archivo NO imprime nada. Devuelve un objeto. El adaptador
// (hoy consola/markdown, mañana WhatsApp o email) lo renderiza. La inteligencia no se muda.
//
// ATTENTION IS SCARCE: el trabajo de este módulo es DESCARTAR, no listar.

const db = require('./db');
const { VOCABULARIO } = require('./entidades');

/** Salud del radar. El caso Spotify estuvo 7 días fallando en silencio: no vuelve a pasar. */
function salud() {
  const fuentes = db.all(`SELECT platform, handle, active, last_success, last_attempt,
                                 last_error, fallas_seguidas, items_ultima_corrida
                          FROM sources ORDER BY platform, handle`);
  const activas = fuentes.filter(f => f.active);
  const conError = activas.filter(f => f.fallas_seguidas > 0);
  const nuncaOk = activas.filter(f => !f.last_success);

  // Estado por plataforma: una plataforma con TODAS sus fuentes mudas es un problema real.
  const porPlataforma = {};
  for (const f of fuentes) {
    const p = porPlataforma[f.platform] ??= { total: 0, activas: 0, ok: 0, error: 0, items: 0 };
    p.total++;
    if (!f.active) continue;          // `continue`, no `return`: saltar la fuente, no abortar
    p.activas++;
    if (f.fallas_seguidas > 0) p.error++; else if (f.last_success) p.ok++;
  }
  for (const [plat, p] of Object.entries(porPlataforma)) {
    p.items = db.get(`SELECT count(*) n FROM items i JOIN sources s ON s.id=i.source_id
                      WHERE s.platform=?`, plat).n;
    p.estado = p.activas === 0 ? 'INACTIVA' : p.error > 0 ? 'WARNING'
             : p.ok === p.activas ? 'OK' : 'PARCIAL';
  }

  return { fuentes, total: fuentes.length, activas: activas.length,
           ok: activas.length - conError.length, conError, nuncaOk, porPlataforma };
}

/** Qué hizo el Lab: volumen, no contenido. */
function actividad() {
  const g = q => db.get(q).n;
  return {
    items_total:      g('SELECT count(*) n FROM items'),
    analizados:       g(`SELECT count(*) n FROM items WHERE status='researched'`),
    sin_procesar:     g(`SELECT count(*) n FROM items WHERE status='new'`),
    con_entidades:    g('SELECT count(DISTINCT item_id) n FROM entities'),
    tecnologias:      g('SELECT count(*) n FROM technologies'),
    matches:          g(`SELECT count(*) n FROM matches WHERE outcome='MATCH'`),
    no_matches:       g(`SELECT count(*) n FROM matches WHERE outcome='NO_MATCH'`),
    problemas_abiertos: g(`SELECT count(*) n FROM problems WHERE status='open'`),
  };
}

/**
 * HALLAZGOS: lo único que merece la atención de Luka.
 *
 * Un hallazgo es una tecnología ya investigada (fuente primaria resuelta) que MATCHEA
 * contra un problema real nuestro. No es "un item interesante".
 */
function hallazgos() {
  const rows = db.all(`
    SELECT t.id tid, t.name, t.canonical_url, t.summary,
           m.problem_id, m.confidence, m.relevance_score, m.argument, m.matched_capabilities,
           p.code, p.title AS problema, pj.slug AS proyecto,
           i.id AS item_id, i.title AS contenido, i.url AS contenido_url,
           i.coverage, i.briefed_at, s.handle AS fuente, s.platform
    FROM matches m
    JOIN technologies t ON t.id = m.technology_id
    JOIN problems p     ON p.id = m.problem_id
    JOIN projects pj    ON pj.id = p.project_id
    LEFT JOIN research_reports r ON r.technology_id = t.id
    LEFT JOIN items i   ON i.id = r.item_id
    LEFT JOIN sources s ON s.id = i.source_id
    WHERE m.outcome = 'MATCH'
    ORDER BY m.relevance_score DESC, m.confidence DESC`);

  // Deduplicar por tecnologia+problema: la misma pareja no se muestra dos veces.
  const vistos = new Set(), out = [];
  for (const r of rows) {
    const k = `${r.tid}|${r.problem_id}`;
    if (vistos.has(k)) continue;
    vistos.add(k);
    out.push({ ...r,
      // Prioridad: manda la confianza del match, no el puntaje solo. Un 10/10 con
      // confianza LOW no es una recomendacion, es una corazonada.
      prioridad: r.confidence === 'HIGH' && r.relevance_score >= 8 ? 1
               : r.confidence === 'HIGH' ? 2 : 3,
      nuevo: !r.briefed_at });
  }
  return out.sort((a, b) => a.prioridad - b.prioridad);
}

/**
 * TRIAGE: contenido capturado y todavia sin analizar que MENCIONA algo de nuestro
 * vocabulario en el titulo.
 *
 * OJO — esto NO es un veredicto. Es una cola de trabajo. Analizar 178 episodios cuesta
 * tiempo y plata; el titulo sirve para ordenar la cola, no para decidir. Se etiqueta como
 * CANDIDATO justamente para no confundirlo con un hallazgo.
 */
function triage(limite = 8) {
  const nuevos = db.all(`SELECT i.id, i.title, i.url, i.published_at, s.handle, s.platform
                         FROM items i JOIN sources s ON s.id=i.source_id
                         WHERE i.status='new' ORDER BY i.published_at DESC`);
  const out = [];
  for (const it of nuevos) {
    const hits = VOCABULARIO.filter(v => v.re.test(it.title || '')).map(v => v.nombre);
    if (hits.length) out.push({ ...it, menciona: hits });
    if (out.length >= limite) break;
  }
  return out;
}

/** El brief completo, como DATOS. Ningún adaptador todavía. */
function generar() {
  return {
    fecha: new Date().toISOString().slice(0, 16).replace('T', ' '),
    salud: salud(),
    actividad: actividad(),
    hallazgos: hallazgos(),
    triage: triage(),
  };
}

/** Marca lo que ya se le mostró a Luka. Mañana no se repite como si fuera nuevo. */
function marcarEntregado(brief) {
  const ahora = new Date().toISOString();
  db.tx(() => {
    for (const h of brief.hallazgos)
      if (h.item_id) db.run('UPDATE items SET briefed_at=? WHERE id=?', ahora, h.item_id);
  });
}

module.exports = { generar, salud, actividad, hallazgos, triage, marcarEntregado };
