// Capa de acceso a datos.
//
// POR QUE EXISTE (planteado por ChatGPT el 23/08/2026, y tiene razon):
// la pregunta importante no es "SQLite o Postgres hoy", es "podemos crecer sin destruir
// esto". Si cada script llama a node:sqlite directo, con 2 scripts migrar es trivial y con
// 20 es un proyecto. Esta capa es el seguro, y cuesta menos hoy que en octubre.
//
// REGLA: ningun script fuera de lib/ importa 'node:sqlite'. Todos pasan por aca.
// El dia que el motor cambie, se reescribe este archivo y nada mas.
//
// Ver docs/DECISIONS.md D-001 y D-007.

const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.join(__dirname, '..');
const DB_PATH = process.env.LAB_DB || path.join(ROOT, 'lab.db');

let _db = null;

/** Abre (una sola vez) la conexion. */
function open({ readOnly = false } = {}) {
  if (_db) return _db;
  _db = new DatabaseSync(DB_PATH, { readOnly });
  if (!readOnly) _db.exec('PRAGMA foreign_keys = ON');
  return _db;
}

// Columnas agregadas despues de que la tabla ya existia. `CREATE TABLE IF NOT EXISTS` no
// las aplica sobre una base viva, asi que van por ALTER.
//
// REGLA (aprendida en Freddy OS, arnes M4): aca solo entran columnas que ALTER TABLE puede
// crear TAL CUAL estan declaradas en schema.sql. SQLite no puede agregar un CHECK con
// ALTER TABLE ADD COLUMN: declarar uno en el plano y no tenerlo en la tabla real es fingir
// un candado que no existe — peor que no tenerlo. Si una columna necesita CHECK, se
// reconstruye la tabla, con su propio backup y OK humano.
const MIGRACIONES = [
  ['items', 'duracion_s', 'REAL'],
];

/** Aplica db/schema.sql y las migraciones pendientes. Idempotente. */
function applySchema() {
  const d = open();
  d.exec(fs.readFileSync(path.join(ROOT, 'db', 'schema.sql'), 'utf8'));
  for (const [tabla, col, tipo] of MIGRACIONES) {
    const existe = d.prepare(`PRAGMA table_info(${tabla})`).all().some(c => c.name === col);
    if (!existe) d.exec(`ALTER TABLE ${tabla} ADD COLUMN ${col} ${tipo}`);
  }
}

/** Borra la base. La fuente de verdad es seed/, no el archivo. */
function reset() {
  close();
  for (const f of [DB_PATH, DB_PATH + '-shm', DB_PATH + '-wal'])
    if (fs.existsSync(f)) fs.rmSync(f);
}

/** SELECT que devuelve muchas filas. */
const all = (sql, ...params) => open().prepare(sql).all(...params);

/** SELECT que devuelve una fila (o undefined). */
const get = (sql, ...params) => open().prepare(sql).get(...params);

/** INSERT / UPDATE / DELETE. */
const run = (sql, ...params) => open().prepare(sql).run(...params);

/** Cuenta filas de una tabla. */
const count = (table) => get(`SELECT count(*) AS n FROM ${table}`).n;

/**
 * Ejecuta fn dentro de una transaccion. Si algo falla, no queda nada a medias.
 * Importa cuando se ingiere: un item a medio guardar es peor que ninguno.
 */
function tx(fn) {
  const db = open();
  db.exec('BEGIN');
  try { const r = fn(); db.exec('COMMIT'); return r; }
  catch (e) { db.exec('ROLLBACK'); throw e; }
}

function close() { if (_db) { _db.close(); _db = null; } }

module.exports = { open, applySchema, reset, all, get, run, count, tx, close, DB_PATH };
