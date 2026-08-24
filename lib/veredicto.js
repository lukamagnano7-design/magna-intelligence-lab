// CRUCE CON EL NEGOCIO + LOS 8 CRITERIOS + VEREDICTO.
//
// Tres reglas que gobiernan este archivo:
//
// 1. NO FORZAR MATCHES. Si algo solo sirve para el workflow tecnico, esta perfecto. Si no
//    resuelve ningun problema real, el Lab tiene que poder decirlo. Un radar que le encuentra
//    utilidad a todo no filtra nada.
// 2. NINGUN NUMERO SIN SU PORQUE. Cada score viaja con su razon y su evidencia. Es la misma
//    regla que en `problems`: un numero sin fundamento es peor que un hueco.
// 3. LO QUE NO SE PUEDE MEDIR VA NULL, no cero. Cero significa "malo"; null significa
//    "todavia no sabemos". Confundirlos hace que el radar mienta con cara de precision.

const db = require('./db');

const CRITERIOS = [
  ['constancia_practica', 'Constancia de practica: se publica codigo o solo opiniones'],
  ['verificabilidad',     'Verificabilidad: nombra repo y version, o hay que adivinar'],
  ['senal_ruido',         'Senal sobre ruido: tecnologia concreta vs contenido motivacional'],
  ['originalidad',        'Originalidad vs eco: llega primero o repite'],
  ['correccion_publica',  'Correccion publica: alguna vez se retracto'],
  ['skin_in_the_game',    'Skin in the game: tiene algo real corriendo con esto'],
  ['aval_del_nicho',      'Aval del nicho: quien lo respalda (NO cuanta gente comenta)'],
  ['resultado_verificado','Resultado verificado: ya produjo adopciones nuestras'],
];

/** Puntua los 8 criterios con la evidencia disponible. Deja NULL lo que no se puede medir. */
function puntuar({ fuente, primaria, conocimiento }) {
  const s = {};
  const put = (k, v, porque) => { s[k] = { score: v, porque }; };

  // 1. Constancia de practica -> medible contra el repo, que no miente.
  if (primaria?.encontrado) {
    const d = primaria.dias_sin_push;
    const v = primaria.archivado ? 1 : d == null ? null : d < 30 ? 9 : d < 90 ? 7 : d < 180 ? 5 : 2;
    put('constancia_practica', v,
      primaria.archivado ? 'el repo esta archivado'
        : `ultimo push hace ${d} dias (${primaria.mantenimiento})`);
  } else put('constancia_practica', null, 'sin fuente primaria resuelta, no se puede medir');

  // 2. Verificabilidad -> el creador dio con que trabajar, o no.
  const resueltas = (conocimiento?.entidades ?? []).filter(e => e.resolution_status === 'resolved').length;
  const total = (conocimiento?.entidades ?? []).filter(e => e.resolution_status !== 'discarded').length;
  put('verificabilidad', total ? Math.round((resueltas / total) * 10) : null,
    total ? `${resueltas} de ${total} entidades se pudieron resolver a fuente oficial`
          : 'no se detectaron entidades');

  // 3. Senal sobre ruido -> proporcion de entidades tecnicas contra links de embudo.
  const ents = conocimiento?.entidades ?? [];
  const tec = ents.filter(e => e.resolution_status !== 'discarded').length;
  const humo = ents.filter(e => e.resolution_status === 'discarded').length;
  put('senal_ruido', ents.length ? Math.round((tec / ents.length) * 10) : null,
    ents.length ? `${tec} seniales tecnicas contra ${humo} links de afiliado/captacion`
                : 'sin entidades para medir');

  // 4-7. No se pueden medir con UN item: necesitan historial de la fuente.
  put('originalidad', null, 'requiere historial de la fuente, no se mide con un solo item');
  put('correccion_publica', null, 'requiere revisar el historial del creador');
  put('skin_in_the_game', null, 'requiere investigar si tiene un producto real corriendo');
  put('aval_del_nicho', null, 'requiere revisar historias destacadas y colaboraciones');

  // 8. Resultado verificado -> el mas fuerte, y el Lab lo cuenta solo.
  const adopciones = db.get(
    `SELECT count(*) AS n FROM decisions d
     JOIN technologies t ON t.id = d.technology_id
     JOIN research_reports r ON r.technology_id = t.id
     JOIN items i ON i.id = r.item_id
     WHERE i.source_id = ? AND d.verdict IN ('ADOPT','TEST_NOW')`, fuente.id).n;
  put('resultado_verificado', adopciones ? Math.min(10, 5 + adopciones * 2) : null,
    adopciones ? `${adopciones} adopcion(es) previas salieron de esta fuente`
               : 'todavia no hay adopciones nuestras de esta fuente (es la primera vez)');

  return s;
}

/** Cruza contra los proyectos. No fuerza: si no pega, lo dice. */
function cruzar(tecnologia, primaria) {
  const proyectos = db.all(`SELECT id, slug, name FROM projects WHERE status != 'backlog'`);
  const out = [];
  for (const p of proyectos) {
    const problemas = db.all(
      `SELECT code, title, category FROM problems WHERE project_id = ? AND status = 'open'`, p.id);
    out.push({ proyecto: p, problemas_abiertos: problemas.length,
               relevancia: null, problema: null,
               porque: 'pendiente de evaluacion humana o de un matcher con criterio' });
  }
  return out;
}

/**
 * Emite el veredicto. La logica es deliberadamente conservadora:
 * ante duda, RESEARCH_DEEPER. Un falso ADOPT cuesta mucho mas que un falso WATCH.
 */
function veredicto({ primaria, conocimiento, scores }) {
  if (conocimiento?.ya_resuelto)
    return { verdict: 'ALREADY_SOLVED',
             porque: conocimiento.razones.join(' · '),
             siguiente: 'No investigar de cero. Si aparecio una version nueva, comparar contra lo que ya sabemos.' };

  if (!primaria?.encontrado)
    return { verdict: 'RESEARCH_DEEPER',
             porque: primaria?.motivo ?? 'no se resolvio la fuente primaria',
             siguiente: 'Conseguir otra senial (transcripcion o frame con la URL) o preguntarle a Luka.' };

  if (primaria.archivado)
    return { verdict: 'REJECT', porque: 'el repositorio esta archivado',
             siguiente: 'Buscar si hay un fork mantenido.' };

  if (primaria.licencia === 'SIN LICENCIA')
    return { verdict: 'WATCH',
             porque: 'sin licencia declarada: no se puede reusar legalmente en un producto que se vende',
             siguiente: 'Abrir un issue preguntando la licencia, o buscar alternativa con licencia clara.' };

  const c = scores.constancia_practica?.score;
  if (c != null && c <= 2)
    return { verdict: 'WATCH', porque: `mantenimiento flojo: ${scores.constancia_practica.porque}`,
             siguiente: 'Revisar en 3 meses si volvio a tener actividad.' };

  return { verdict: 'RESEARCH_DEEPER',
           porque: 'la fuente primaria existe y esta sana, pero todavia no se evaluo contra un problema concreto nuestro',
           siguiente: 'Cruzar contra los problemas abiertos y decidir si amerita experimento.' };
}

module.exports = { puntuar, cruzar, veredicto, CRITERIOS };
