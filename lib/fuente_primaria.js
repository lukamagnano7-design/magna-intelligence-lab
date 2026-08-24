// RESOLUCION A FUENTE PRIMARIA.
//
// El principio del Lab: el creador DETECTA, la fuente primaria DECIDE.
// Nadie adopta nada porque un video dijo que era increible. Se va al repo oficial y se mira
// lo que hay: README, licencia, dependencias, actividad, issues, releases.
//
// Devuelve dos cosas separadas a proposito:
//   claims   -> lo que el creador PROMETE (sale del video)
//   findings -> lo que la herramienta HACE (sale de la fuente oficial)
// Cuando no coinciden, eso es informacion, no un error.

const { fetchText } = require('./feeds');

const GH = 'https://api.github.com';

async function gh(pathname) {
  const headers = { 'Accept': 'application/vnd.github+json',
                    'User-Agent': 'MagnaIntelligenceLab/0.1' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(GH + pathname, { headers });
  if (res.status === 404) return null;
  if (res.status === 403) throw new Error('rate limit de GitHub (pone GITHUB_TOKEN)');
  if (!res.ok) throw new Error(`GitHub HTTP ${res.status}`);
  return res.json();
}

const dias = (iso) => iso ? Math.floor((Date.now() - new Date(iso)) / 86400000) : null;

/** Investiga un repo de GitHub a fondo. `owner/repo`. */
async function investigarRepo(fullName) {
  const repo = await gh(`/repos/${fullName}`);
  if (!repo) return { encontrado: false, motivo: `no existe ${fullName} en GitHub` };

  const [releases, issues, contenido] = await Promise.all([
    gh(`/repos/${fullName}/releases?per_page=5`).catch(() => []),
    gh(`/repos/${fullName}/issues?state=open&per_page=10`).catch(() => []),
    gh(`/repos/${fullName}/contents`).catch(() => []),
  ]);

  let readme = null;
  try {
    const r = await gh(`/repos/${fullName}/readme`);
    if (r?.download_url) readme = (await fetchText(r.download_url)).slice(0, 12000);
  } catch { /* sin readme */ }

  const archivos = (contenido || []).map(c => c.name);
  const deps = await leerDependencias(fullName, archivos);
  const diasUltimoPush = dias(repo.pushed_at);

  return {
    encontrado: true,
    url: repo.html_url,
    nombre: repo.full_name,
    descripcion: repo.description,
    licencia: repo.license?.spdx_id ?? 'SIN LICENCIA',
    lenguaje: repo.language,
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    issues_abiertos: repo.open_issues_count,
    archivado: repo.archived,
    creado: repo.created_at?.slice(0, 10),
    ultimo_push: repo.pushed_at?.slice(0, 10),
    dias_sin_push: diasUltimoPush,
    releases: (releases || []).map(r => ({ tag: r.tag_name, fecha: r.published_at?.slice(0, 10) })),
    issues_relevantes: (issues || []).filter(i => !i.pull_request)
      .slice(0, 5).map(i => ({ titulo: i.title, dias: dias(i.created_at) })),
    archivos_raiz: archivos.slice(0, 25),
    dependencias: deps,
    readme,
    // Lectura de mantenimiento: es lo que separa una herramienta viva de una abandonada.
    mantenimiento: repo.archived ? 'ARCHIVADO'
      : diasUltimoPush == null ? 'desconocido'
      : diasUltimoPush < 30 ? 'activo'
      : diasUltimoPush < 180 ? 'lento'
      : 'posiblemente abandonado',
    riesgos: riesgosDe(repo, diasUltimoPush, archivos),
  };
}

async function leerDependencias(fullName, archivos) {
  const mapa = { 'package.json': 'npm', 'requirements.txt': 'pip',
                 'pyproject.toml': 'python', 'go.mod': 'go', 'Cargo.toml': 'rust' };
  for (const [f, eco] of Object.entries(mapa)) {
    if (!archivos.includes(f)) continue;
    try {
      const txt = await fetchText(
        `https://raw.githubusercontent.com/${fullName}/HEAD/${f}`);
      if (f === 'package.json') {
        const j = JSON.parse(txt);
        return { ecosistema: eco,
                 runtime: Object.keys(j.dependencies ?? {}),
                 dev: Object.keys(j.devDependencies ?? {}),
                 scripts: Object.keys(j.scripts ?? {}) };
      }
      return { ecosistema: eco, crudo: txt.slice(0, 1200) };
    } catch { /* seguir */ }
  }
  return { ecosistema: 'desconocido' };
}

function riesgosDe(repo, diasSinPush, archivos) {
  const r = [];
  if (repo.archived) r.push('El repo esta ARCHIVADO: no recibe mas cambios.');
  if (!repo.license) r.push('SIN LICENCIA: legalmente no esta permitido reusarlo en un producto que vendes.');
  if (diasSinPush > 180) r.push(`Sin commits hace ${diasSinPush} dias: puede estar abandonado.`);
  if (repo.stargazers_count < 50) r.push(`Solo ${repo.stargazers_count} stars: poca validacion externa. No lo descalifica, pero implica ser el primero en encontrar los bugs.`);
  if (repo.open_issues_count > 200) r.push(`${repo.open_issues_count} issues abiertos: puede indicar mantenimiento desbordado.`);
  if (archivos.some(f => /^(install|setup)\.(sh|ps1)$/i.test(f)))
    r.push('Trae script de instalacion: revisarlo antes de correrlo.');
  return r;
}

// Registro curado de fuentes oficiales. Todas verificadas con una peticion real.
// Ver seed/fuentes_oficiales.json.
const REGISTRO = require('../seed/fuentes_oficiales.json').filter(x => x.nombre);

/** Busca un nombre en el registro curado, por nombre o por alias. */
function enRegistro(nombre) {
  const n = nombre.toLowerCase().trim();
  return REGISTRO.find(r =>
    r.nombre.toLowerCase() === n || (r.alias || []).some(a => a.toLowerCase() === n)) ?? null;
}

/**
 * Resuelve una entidad a su fuente primaria.
 * Si no la puede resolver, dice POR QUE. Un hueco explicado vale mas que uno mudo.
 */
async function resolver(entidad) {
  const n = entidad.normalized || entidad.raw_mention;

  if (entidad.entity_type === 'repository' && /^[\w.-]+\/[\w.-]+$/.test(n))
    return { tipo: 'github', ...(await investigarRepo(n)) };

  // Nombre conocido -> fuente oficial curada. Esto NO es adivinar: es conocimiento
  // canonico versionado y verificado. Si ademas tiene repo, se lo investiga a fondo.
  const reg = enRegistro(n);
  if (reg) {
    if (reg.repo) {
      const repo = await investigarRepo(reg.repo);
      if (repo.encontrado) return { tipo: 'github', via: 'registro curado',
                                    docs_oficiales: reg.oficial, ...repo };
    }
    return { tipo: 'oficial', via: 'registro curado', encontrado: true,
             nombre: reg.nombre, url: reg.oficial, descripcion: `fuente oficial de ${reg.nombre}`,
             licencia: 'n/d (producto, no repo)', stars: null, lenguaje: null,
             mantenimiento: 'producto comercial vigente', dias_sin_push: null,
             riesgos: ['Es un producto de un tercero: depender de el implica depender de su precio y sus terminos.'],
             dependencias: { ecosistema: 'n/d' }, releases: [], issues_relevantes: [],
             archivos_raiz: [], readme: null, verificado: reg.verificado };
  }

  // Un nombre suelto y desconocido no se puede resolver a ciegas: buscar "New App" en
  // GitHub devuelve cientos de repos de terceros y ninguno es la fuente oficial. Adivinar
  // aca seria justamente la venta de humo que el Lab existe para filtrar.
  return {
    tipo: 'no_resuelto',
    encontrado: false,
    motivo: `"${n}" es una mencion por nombre, sin URL y sin entrada en el registro curado. `
          + `Resolverla a ciegas produciria una fuente falsa. Necesita otra senial `
          + `(URL en pantalla o en la transcripcion) o confirmacion humana.`,
  };
}

module.exports = { resolver, investigarRepo, gh };
