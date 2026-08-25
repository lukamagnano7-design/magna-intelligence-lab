#!/usr/bin/env node
// ARNESES DE COBERTURA — CAPTURA != COBERTURA.
//
// Cada test de aca es una pregunta si/no sobre un bug que YA PASO sobre material real.
// No bajan nada: prueban la logica de reparto y de estado contra datos fijos.
//
//   node test/cobertura.test.js

const c = require('../lib/cobertura');

let pasaron = 0, fallaron = 0;
const test = (n, fn) => {
  try { fn(); console.log(`  ok    ${n}`); pasaron++; }
  catch (e) { console.log(`  FALLA ${n}\n          ${e.message}`); fallaron++; }
};
const igual = (a, b, m) => {
  if (JSON.stringify(a) !== JSON.stringify(b))
    throw new Error(`${m ?? ''} esperaba ${JSON.stringify(b)}, dio ${JSON.stringify(a)}`);
};
const cierto = (v, m) => { if (!v) throw new Error(m ?? 'esperaba verdadero'); };

console.log('\nCOBERTURA — los bugs que ya pasaron\n');

// El caso original, con los numeros reales del Reel Metallurgia (25/08/2026).
const REEL = 376.4;
const candidatos = Array.from({ length: 188 }, (_, i) => ({ ts: i * 2, archivo: `f${i}` }));

test('C1  el reparto NO devuelve los primeros N (era el bug: `break` posicional)', () => {
  const segs = c.segmentar(REEL);
  const el = c.repartir(candidatos, segs, 24);
  igual(el.length, 24, 'cantidad');
  // El bug daba ts 0..46. Lo que importa es que ahora el ULTIMO elegido este cerca del final.
  cierto(el[el.length - 1].ts > REEL * 0.8,
    `el ultimo frame quedo en ${el[el.length - 1].ts}s de ${REEL}s: sigue habiendo sesgo al inicio`);
});

test('C2  con techo chico, NINGUN segmento queda en cero', () => {
  const segs = c.segmentar(REEL);
  const el = c.repartir(candidatos, segs, 8);
  for (const s of segs)
    cierto(el.some(e => e.ts >= s.desde && e.ts < s.hasta),
      `el segmento ${s.desde}-${s.hasta}s quedo sin ninguna muestra`);
});

test('C3  si entra todo bajo el techo, no se recorta nada', () => {
  const segs = c.segmentar(REEL);
  igual(c.repartir(candidatos, segs, 500).length, 188);
});

test('C4  mirar 24 de 188 sobre 8 segmentos NO puede dar COMPLETE', () => {
  const segs = c.segmentar(REEL);
  const cob = c.evaluar({ duracionS: REEL, segmentos: segs,
    segmentosConMuestra: 2, muestras: 24, candidatos: 188 });
  igual(cob.estado, c.PARTIAL);
  cierto(cob.pct < 50, `dio ${cob.pct}%`);
});

test('C5  sin duracion medida no hay porcentaje: el denominador no lo fija el proceso', () => {
  const cob = c.evaluar({ duracionS: null, segmentos: [], muestras: 99 });
  igual(cob.estado, c.NONE);
  igual(cob.pct, 0);
  cierto(/duracion/i.test(cob.nota), 'la nota tiene que decir POR QUE no hay porcentaje');
});

test('C6  una pista COMPLETE no tapa a otra NONE (manda la mas debil)', () => {
  const cob = c.consolidar({
    audio: { estado: c.NONE, pct: 0, nota: 'sin transcripcion' },
    visual: { estado: c.COMPLETE, pct: 100, nota: 'todo visto' } });
  igual(cob.estado, c.NONE);
  // El bug real del 25/08: mostraba "CONSOLIDADO NONE 100%" porque promediaba
  // solo las pistas con dato. Un estado sin cobertura no puede exhibir 100%.
  igual(cob.pct, 0, 'el consolidado es el MINIMO, no el promedio de las que tienen dato');
});

test('C7  todo completo consolida completo', () => {
  const cob = c.consolidar({
    audio: { estado: c.COMPLETE, pct: 100, nota: '' },
    visual: { estado: c.COMPLETE, pct: 100, nota: '' } });
  igual(cob.estado, c.COMPLETE);
  igual(cob.pct, 100);
});

test('C8  todo lo que no es COMPLETE lleva advertencia explicita', () => {
  igual(c.advertencia({ estado: c.COMPLETE }), null);
  cierto(/NO es comprension completa/i.test(c.advertencia({ estado: c.PARTIAL })));
  cierto(/SIN COBERTURA/i.test(c.advertencia({ estado: c.NONE })));
});

test('C9  el inicio del timeline es 0:00, no un dato faltante', () => {
  igual(c.fmt(0), '0:00');
  igual(c.fmt(376.4), '6:16');
  igual(c.fmt(null), 'n/d');
});

test('C10 un Short y un Reel dan informes de largo parecido (segmentos acotados)', () => {
  igual(c.segmentar(58).length, 3);     // Short de ~1 min
  igual(c.segmentar(376.4).length, 8);  // Reel de 6:16
  cierto(c.segmentar(3600).length <= 60, 'una hora no puede dar cientos de filas');
});

console.log(`\n${pasaron} pasaron · ${fallaron} fallaron\n`);
process.exit(fallaron ? 1 : 0);
