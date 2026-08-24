// CONOCIMIENTO EXISTENTE.
//
// Antes de declarar que algo es nuevo, hay que mirar si ya lo sabemos. Sin esto, dentro de
// seis meses el Lab vuelve a preguntar "que es Engram?" en vez de decir "lo probamos en
// marzo, fallaba en esto, esta version cambio aquello".
//
// Busca en TRES lugares, de menor a mayor autoridad:
//   1. lab.db          -> lo que este mismo Lab ya investigo y decidio
//   2. memoria canonica de freddy-agent-os -> reglas, decisiones y errores del negocio
//   3. los proyectos reales -> si la herramienta YA esta instalada y corriendo
//
// El criterio 8 (resultado verificado) manda: si algo de esta fuente ya termino adoptado en
// un sistema real, eso pesa mas que cualquier cantidad de stars.

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const db = require('./db');

// La memoria canonica del negocio. El Lab la LEE, nunca la escribe.
const MEMORIA = 'C:\\Users\\lukam\\OneDrive\\Escritorio\\10 SKILLS ADRI Y JUANPE\\'
              + '10 SKILLS ADRI Y JUANPE\\kit-dashboard-facturas\\freddy-agent-os';

const PROYECTOS = [
  { slug: 'magna-pyme-os',  path: 'C:\\dev\\magna-pyme-os' },
  { slug: 'magna-intelligence-lab', path: 'C:\\dev\\magna-intelligence-lab' },
  { slug: 'magna-os-familiar', path: 'C:\\Users\\lukam\\MagnaOS-Familiar\\magna-app' },
];

/**
 * Busca un termino en la memoria canonica (read-only), en Node puro.
 *
 * OJO — se probo con `rg` primero y fallaba con ENOENT: ripgrep esta en el PATH del shell
 * pero no en el que hereda Node. Silenciosamente devolvia "no encontre nada", que en ESTE
 * componente es el peor error posible: haria que el Lab declare nuevo todo lo que ya sabemos.
 * Sin dependencias externas no puede volver a pasar.
 */
function buscarEnMemoria(termino) {
  if (!fs.existsSync(MEMORIA)) return { disponible: false, hits: [], error: 'memoria no encontrada' };
  // OJO — con subcadena simple, "Polar" matcheaba dentro de "GRUPOLAR", que es un proveedor
  // de Freddy, y el Lab reportaba "esto ya lo conocemos" sobre algo que no tenia nada que ver.
  // Verificado el 24/08/2026. Con limite de palabra no puede volver a pasar.
  const esc = termino.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(?<![\\p{L}\\d])${esc}(?![\\p{L}\\d])`, 'iu');
  const hits = [];

  const caminar = (dir, prof = 0) => {
    if (prof > 6 || hits.length >= 12) return;
    let entradas;
    try { entradas = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entradas) {
      if (hits.length >= 12) return;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { if (!e.name.startsWith('_backup')) caminar(full, prof + 1); continue; }
      if (!/\.(md|json|txt)$/i.test(e.name)) continue;
      try {
        if (re.test(fs.readFileSync(full, "utf8")))
          hits.push(path.relative(MEMORIA, full));
      } catch { /* archivo ilegible, seguir */ }
    }
  };
  caminar(MEMORIA);
  return { disponible: true, hits };
}

/** ¿La herramienta ya esta instalada como dependencia en alguno de los proyectos? */
function yaInstalado(nombre) {
  const clave = nombre.toLowerCase().replace(/\s+/g, '-');
  const encontrado = [];
  for (const p of PROYECTOS) {
    const pkg = path.join(p.path, 'package.json');
    if (!fs.existsSync(pkg)) continue;
    try {
      const j = JSON.parse(fs.readFileSync(pkg, 'utf8'));
      const deps = { ...(j.dependencies ?? {}), ...(j.devDependencies ?? {}) };
      for (const d of Object.keys(deps))
        if (d.toLowerCase().includes(clave) || clave.includes(d.toLowerCase()))
          encontrado.push({ proyecto: p.slug, dependencia: d, version: deps[d] });
    } catch { /* package.json roto, seguir */ }
  }
  return encontrado;
}

/** ¿Este mismo Lab ya lo investigo / decidio / experimento? */
function yaEnElLab(nombre) {
  const like = `%${nombre}%`;
  return {
    tecnologias: db.all(
      `SELECT id, name, canonical_url, summary FROM technologies
       WHERE name LIKE ? OR canonical_url LIKE ?`, like, like),
    decisiones: db.all(
      `SELECT d.verdict, d.rationale, d.created_at, t.name
       FROM decisions d LEFT JOIN technologies t ON t.id = d.technology_id
       WHERE t.name LIKE ?`, like),
    experimentos: db.all(
      `SELECT e.title, e.status, e.result, t.name FROM experiments e
       LEFT JOIN technologies t ON t.id = e.technology_id WHERE t.name LIKE ?`, like),
  };
}

/**
 * Consolida todo. Devuelve un veredicto previo si ya hay evidencia propia.
 * `ya_resuelto` en true significa: NO hace falta investigar de cero.
 */
function revisar(nombre) {
  const lab = yaEnElLab(nombre);
  const mem = buscarEnMemoria(nombre);
  const inst = yaInstalado(nombre);

  const razones = [];
  if (lab.decisiones.length)
    razones.push(`Ya hay ${lab.decisiones.length} decision(es) previa(s): ${lab.decisiones.map(d => d.verdict).join(', ')}`);
  if (lab.experimentos.length)
    razones.push(`Ya se experimento: ${lab.experimentos.map(e => `${e.title} (${e.status})`).join('; ')}`);
  if (inst.length)
    razones.push(`YA ESTA EN USO: ${inst.map(i => `${i.dependencia}@${i.version} en ${i.proyecto}`).join(', ')}`);
  if (mem.hits.length)
    razones.push(`Aparece en la memoria canonica (${mem.hits.length} archivos): ${mem.hits.slice(0, 4).join(', ')}`);

  return {
    nombre,
    ya_resuelto: inst.length > 0 || lab.decisiones.length > 0,
    razones,
    detalle: { lab, memoria: mem, instalado: inst },
  };
}

module.exports = { revisar, buscarEnMemoria, yaInstalado, yaEnElLab, MEMORIA };
