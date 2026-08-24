// EL MATCHING ENGINE.
//
// Regla numero uno: NO SE MATCHEA POR PARECIDO DE PALABRAS. Eso seria el mismo error que
// "Polar" matcheando dentro de "GRUPOLAR" — coincidencia de letras sin relacion real.
// Se matchea por CAPACIDADES: lo que el problema necesita contra lo que la tecnologia da.
//
// Regla numero dos: NO FORZAR MATCHES. Si de 100 tecnologias 70 no sirven, el Lab esta
// funcionando bien. El objetivo es filtrar, no producir recomendaciones.
//
// Regla numero tres: separar CALIDAD TECNICA de RELEVANCIA DE NEGOCIO. Una herramienta
// excelente puede no resolver nada nuestro. Eso no la hace mala.

const db = require('./db');

/**
 * Cruza una tecnologia contra todos los problemas.
 * Devuelve { matches, no_matches, insuficientes, sin_base }.
 */
function cruzar(technologyId, { determinado = false } = {}) {
  const ofrece = db.all(
    `SELECT capability_id, origen, evidencia FROM technology_capabilities WHERE technology_id = ?`,
    technologyId);
  const setOfrece = new Set(ofrece.map(o => o.capability_id));
  const origenDe = Object.fromEntries(ofrece.map(o => [o.capability_id, o]));

  // Sin capacidades hay DOS situaciones distintas que no se pueden confundir:
  //   determinado=false -> no sabemos que hace. No se puede opinar. sin_base.
  //   determinado=true  -> alguien lo miro y concluyo que no cubre nada nuestro. Eso SI
  //                        es un NO_MATCH legitimo, y es una conclusion valiosa.
  if (!setOfrece.size && !determinado)
    return { matches: [], no_matches: [], insuficientes: [], sin_base: true };

  const problemas = db.all(
    `SELECT p.*, pj.slug AS proyecto, pj.name AS proyecto_nombre
     FROM problems p JOIN projects pj ON pj.id = p.project_id
     WHERE p.status = 'open' ORDER BY p.code`);

  const matches = [], no_matches = [], insuficientes = [];

  for (const p of problemas) {
    if (p.data_status === 'INSUFFICIENT_PROBLEM_DATA') {
      insuficientes.push({ problema: p, motivo: p.data_gap });
      continue;
    }

    const req = db.all(
      `SELECT capability_id FROM problem_capabilities WHERE problem_id = ? AND kind = 'required'`,
      p.id).map(r => r.capability_id);
    const utiles = db.all(
      `SELECT capability_id FROM problem_capabilities WHERE problem_id = ? AND kind = 'useful'`,
      p.id).map(r => r.capability_id);

    // Un problema sin capacidades declaradas no puede matchear con nada. Es a proposito:
    // ej. DIST-LOG-004 es un hueco de modelo de datos, no de tecnologia.
    if (!req.length && !utiles.length) {
      no_matches.push({ problema: p, matched: [], missing: [],
        argument: 'El problema no declara ninguna capacidad tecnologica: no se resuelve con una herramienta externa.' });
      continue;
    }

    const cubiertasReq = req.filter(c => setOfrece.has(c));
    const faltantesReq = req.filter(c => !setOfrece.has(c));
    const cubiertasUtil = utiles.filter(c => setOfrece.has(c));
    const matched = [...cubiertasReq, ...cubiertasUtil];

    if (!matched.length) {
      no_matches.push({ problema: p, matched: [], missing: faltantesReq,
        argument: `La tecnologia no ofrece ninguna de las capacidades que el problema pide (${[...req, ...utiles].join(', ')}).` });
      continue;
    }

    // Cubrir SOLO capacidades "utiles" no alcanza para declarar match: el problema
    // seguiria sin resolverse. Se registra como no-match, pero explicando la relacion parcial.
    if (req.length && !cubiertasReq.length) {
      no_matches.push({ problema: p, matched: cubiertasUtil, missing: faltantesReq,
        argument: `Aporta ${cubiertasUtil.join(', ')} pero NO cubre lo requerido (${faltantesReq.join(', ')}), `
                + `asi que el problema seguiria sin resolverse.` });
      continue;
    }

    // Confianza: manda el ORIGEN de la capacidad, no la cantidad. Una capacidad inferida
    // de un README no puede sostener un match de confianza alta.
    const origenes = matched.map(c => origenDe[c]?.origen);
    const todoCurado = origenes.every(o => o === 'curado' || o === 'declarado');
    const cubreTodoReq = faltantesReq.length === 0;
    const confidence = todoCurado && cubreTodoReq ? 'HIGH'
                     : todoCurado || cubreTodoReq ? 'MEDIUM' : 'LOW';

    // Relevancia = cuanto de lo requerido cubre. Sin problema no hay relevancia.
    const relevance = req.length ? (cubiertasReq.length / req.length) * 10 : 5;

    matches.push({
      problema: p, matched, missing: faltantesReq, confidence,
      relevance_score: Number(relevance.toFixed(1)),
      argument: cubreTodoReq
        ? `Cubre las ${req.length} capacidad(es) requerida(s): ${cubiertasReq.join(', ')}.`
          + (cubiertasUtil.length ? ` Ademas aporta ${cubiertasUtil.join(', ')}.` : '')
        : `Cubre ${cubiertasReq.length} de ${req.length} requeridas (${cubiertasReq.join(', ')}), `
          + `falta ${faltantesReq.join(', ')}.`,
      evidence: matched.map(c => `${c}: ${origenDe[c]?.evidencia ?? 's/d'}`).join(' | '),
    });
  }

  matches.sort((a, b) => b.relevance_score - a.relevance_score);
  return { matches, no_matches, insuficientes, sin_base: false };
}

/** Persiste el resultado del cruce. Idempotente por tecnologia. */
function guardar(technologyId, resultado) {
  db.tx(() => {
    db.run('DELETE FROM matches WHERE technology_id = ?', technologyId);
    const ins = (m, outcome) => db.run(
      `INSERT INTO matches (technology_id, project_id, problem_id, outcome,
         matched_capabilities, missing_capabilities, confidence, relevance_score,
         argument, evidence, recommended_action)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      technologyId, m.problema.project_id, m.problema.id, outcome,
      JSON.stringify(m.matched ?? []), JSON.stringify(m.missing ?? []),
      m.confidence ?? null, m.relevance_score ?? null,
      m.argument ?? m.motivo ?? '', m.evidence ?? null, m.recommended_action ?? null);

    for (const m of resultado.matches)   ins(m, 'MATCH');
    for (const m of resultado.no_matches) ins(m, 'NO_MATCH');
    for (const m of resultado.insuficientes)
      ins({ ...m, argument: `INSUFFICIENT_PROBLEM_DATA: ${m.motivo}` }, 'INSUFFICIENT_PROBLEM_DATA');
  });
}

module.exports = { cruzar, guardar };
