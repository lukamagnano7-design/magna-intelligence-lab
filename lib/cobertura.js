// CAPTURA != COBERTURA
//
// Principio, incorporado el 25/08/2026 despues del Reel Metallurgia:
//
//   Un analisis parcial puede producir hallazgos, pero NUNCA puede presentarse como
//   comprension completa.
//
// El caso: el Lab miro 58 de 376 segundos (15,4%), no encontro casi nada, y emitio un
// veredicto igual. Lo que fallo no fue el criterio ni el OCR: fue que **nadie midio contra
// que**. El tope de frames era posicional (`break` al frame 24 de un barrido secuencial),
// asi que garantizaba sesgo hacia el principio del video.
//
// Este modulo hace dos cosas y nada mas:
//   1. Reparte un presupuesto de muestras a lo largo de TODO el material (no "los primeros N").
//   2. Calcula un estado de cobertura honesto a partir de lo que realmente se miro.
//
// No decide si algo se entendio. Solo dice cuanto se vio.

// Estados. Deliberadamente pocos: mas granularidad invita a redondear para arriba.
const COMPLETE = 'COMPLETE';   // se miro todo el material, en toda su extension
const PARTIAL = 'PARTIAL';     // quedaron partes sin mirar. El veredicto vale menos
const NONE = 'NONE';           // no se pudo mirar nada de esta pista

/**
 * Corta una duracion en segmentos conceptuales.
 * No hardcodea 30 s: apunta a ~8 tramos y los acota entre 20 y 60 s para que un Short y un
 * Reel de 6 minutos den informes con la misma cantidad de filas legibles.
 */
function segmentar(duracionS, { objetivo = 8, minS = 20, maxS = 60 } = {}) {
  if (!(duracionS > 0)) return [];
  const paso = Math.min(maxS, Math.max(minS, Math.ceil(duracionS / objetivo)));
  const segs = [];
  for (let inicio = 0; inicio < duracionS; inicio += paso)
    segs.push({ i: segs.length, desde: inicio, hasta: Math.min(inicio + paso, duracionS) });
  return segs;
}

/**
 * Reparte un techo de muestras entre segmentos, garantizando que NINGUN segmento quede en
 * cero mientras tenga candidatos.
 *
 * Esta es la correccion concreta del bug: antes se tomaban las primeras N muestras del
 * barrido; ahora primero se asegura presencia en todo el timeline y recien despues se
 * gasta el excedente donde hay mas densidad de cambio de pantalla.
 */
function repartir(candidatos, segmentos, techo) {
  if (!candidatos.length || !segmentos.length) return [];
  const porSeg = segmentos.map(() => []);
  for (const c of candidatos) {
    const idx = segmentos.findIndex(s => c.ts >= s.desde && c.ts < s.hasta);
    porSeg[idx === -1 ? segmentos.length - 1 : idx].push(c);
  }

  // Si entra todo, entra todo. El OCR es local y gratis: recortar aca seria gratuito y falso.
  if (candidatos.length <= techo) return [...candidatos].sort((a, b) => a.ts - b.ts);

  // Ronda 1: uno por segmento con candidatos. Esto es lo que hace la cobertura temporal real.
  const elegidos = [];
  const restantes = porSeg.map(g => [...g]);
  for (const g of restantes) if (g.length) elegidos.push(g.shift());

  // Ronda 2: el excedente va por turnos rotando entre segmentos, no de corrido.
  // Rotar evita que un segmento denso se coma el presupuesto de los que vienen despues.
  let quedan = techo - elegidos.length;
  let hubo = true;
  while (quedan > 0 && hubo) {
    hubo = false;
    for (const g of restantes) {
      if (quedan <= 0) break;
      if (!g.length) continue;
      elegidos.push(g.shift());
      quedan--; hubo = true;
    }
  }
  return elegidos.sort((a, b) => a.ts - b.ts);
}

/**
 * Estado de cobertura de UNA pista (visual o audio), medido contra la duracion real.
 * `cubiertoS` es cuanto material quedo efectivamente representado por las muestras.
 */
function evaluar({ duracionS, segmentos = [], segmentosConMuestra = 0, muestras = 0,
                   candidatos = 0, disponible = true, motivo = null }) {
  if (!disponible) {
    return { estado: NONE, pct: 0, segmentos: segmentos.length, segmentos_vistos: 0,
             nota: motivo || 'pista no disponible' };
  }
  if (!(duracionS > 0)) {
    return { estado: NONE, pct: 0, segmentos: 0, segmentos_vistos: 0,
             nota: 'no se pudo medir la duracion: cualquier porcentaje seria inventado' };
  }
  const nSeg = segmentos.length || 1;
  const pct = Number(((segmentosConMuestra / nSeg) * 100).toFixed(1));
  const completo = segmentosConMuestra >= nSeg && muestras > 0;

  const nota = completo
    ? `${muestras} muestras repartidas sobre ${nSeg}/${nSeg} segmentos de los ${fmt(duracionS)} totales`
    : `solo ${segmentosConMuestra} de ${nSeg} segmentos tienen muestra: ${(100 - pct).toFixed(1)}% del material sin mirar`;

  return {
    estado: completo ? COMPLETE : (muestras > 0 ? PARTIAL : NONE),
    pct, segmentos: nSeg, segmentos_vistos: segmentosConMuestra, muestras, candidatos, nota,
  };
}

/**
 * Cobertura del ITEM: la peor de sus pistas manda.
 * Tener la transcripcion completa no autoriza a decir que se entendio el video si no se
 * miro ni una pantalla, y al reves tampoco.
 */
function consolidar(pistas) {
  const vivas = Object.entries(pistas).filter(([, p]) => p && p.estado);
  if (!vivas.length) return { estado: NONE, pct: 0, nota: 'sin pistas' };

  const rank = { [NONE]: 0, [PARTIAL]: 1, [COMPLETE]: 2 };
  const peor = vivas.reduce((a, b) => (rank[a[1].estado] <= rank[b[1].estado] ? a : b));

  // El consolidado es el MINIMO, no el promedio. Promediar dejaba pasar
  // "CONSOLIDADO NONE 100%" —un estado sin cobertura mostrando el 100% de la otra pista—
  // que es exactamente el numero halagador que este modulo existe para impedir.
  const pct = Math.min(...vivas.map(([, p]) => p.pct));

  const detalle = vivas.map(([k, p]) => `${k}:${p.estado}`).join(' · ');
  const nota = peor[1].estado === COMPLETE
    ? `todas las pistas completas (${detalle})`
    : `manda la pista mas debil — ${peor[0]}: ${peor[1].nota} (${detalle})`;

  return { estado: peor[1].estado, pct, nota, por_pista: pistas };
}

/** La frase que el informe DEBE llevar cuando la cobertura no es total. */
function advertencia(cob) {
  if (cob.estado === COMPLETE) return null;
  if (cob.estado === NONE) return 'SIN COBERTURA — no hay base para ningun veredicto sobre el contenido.';
  return 'COBERTURA PARCIAL — hay hallazgos, pero esto NO es comprension completa del material.';
}

const fmt = (s) => {
  if (s === 0) return '0:00';            // el inicio del timeline no es un dato faltante
  if (!(s > 0)) return 'n/d';
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.round(s - m * 60)).padStart(2, '0')}`;
};

module.exports = { segmentar, repartir, evaluar, consolidar, advertencia, fmt,
                   COMPLETE, PARTIAL, NONE };
