// RIESGO SEGUN EL USO PRETENDIDO.
//
// Correccion de Luka (24/08/2026): "SIN LICENCIA -> WATCH" es prudente pero demasiado
// general. La ausencia de licencia tiene consecuencias MUY distintas segun para que se
// quiera usar la cosa.
//
// El Risk Agent no puede confundir cuatro cosas que no son la misma:
//   estudiar una idea  !=  usar una herramienta internamente
//                      !=  copiar codigo al producto
//                      !=  redistribuirlo
//
// AVISO IMPORTANTE, y va tambien en la salida: esto NO es asesoramiento legal. Es un
// semaforo para saber CUANDO conviene consultar a alguien que sepa. Cuando hay
// incertidumbre juridica el Lab tiene que decirlo, no resolverla.

// Los usos pretendidos, ordenados de menor a mayor exposicion legal.
const USOS = {
  ARCHITECTURAL_INSPIRATION: {
    nombre: 'Inspiracion arquitectonica',
    que_es: 'Leer como esta resuelto y aplicar la IDEA con codigo propio. No se copia nada.',
    exposicion: 1,
  },
  LEARNING_REFERENCE: {
    nombre: 'Referencia de aprendizaje',
    que_es: 'Estudiarlo para entender un tema. No entra a ningun sistema.',
    exposicion: 1,
  },
  EXPERIMENT_ONLY: {
    nombre: 'Solo experimento',
    que_es: 'Correrlo en sandbox aislado para medir. No toca produccion ni datos reales.',
    exposicion: 2,
  },
  INTERNAL_TOOL: {
    nombre: 'Herramienta interna',
    que_es: 'Usarlo puertas adentro para trabajar. No se entrega ni se revende.',
    exposicion: 3,
  },
  CODE_REUSE: {
    nombre: 'Reuso de codigo',
    que_es: 'Copiar codigo suyo tal cual dentro de nuestro codigo.',
    exposicion: 4,
  },
  CODE_MODIFICATION: {
    nombre: 'Modificacion de codigo',
    que_es: 'Tomar su codigo, modificarlo y mantener una version propia.',
    exposicion: 4,
  },
  PRODUCT_INTEGRATION: {
    nombre: 'Integracion al producto',
    que_es: 'Que forme parte de lo que se le entrega y se le cobra a un cliente.',
    exposicion: 5,
  },
  REDISTRIBUTION: {
    nombre: 'Redistribucion',
    que_es: 'Distribuirlo, con o sin cambios, a terceros.',
    exposicion: 5,
  },
};

// Licencias permisivas conocidas: dejan usar, modificar y redistribuir con atribucion.
const PERMISIVAS = ['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', '0BSD', 'Unlicense'];
// Copyleft fuerte: puede obligar a liberar el codigo que la incorpora.
const COPYLEFT  = ['GPL-2.0', 'GPL-3.0', 'AGPL-3.0', 'LGPL-3.0', 'MPL-2.0'];

const NIVEL = { BAJO: 1, MEDIO: 2, ALTO: 3, MUY_ALTO: 4 };

/**
 * Evalua el riesgo de una licencia para CADA uso pretendido.
 * Devuelve una fila por uso, para que la decision sea del humano y no del semaforo.
 */
function evaluar(licencia, { archivado = false } = {}) {
  const sinLicencia = !licencia || licencia === 'SIN LICENCIA' || licencia === 'NOASSERTION';
  const permisiva = PERMISIVAS.includes(licencia);
  const copyleft = COPYLEFT.includes(licencia);

  const filas = Object.entries(USOS).map(([id, u]) => {
    let nivel, porque;

    if (sinLicencia) {
      // Sin licencia, por defecto NO hay permiso de uso: el autor conserva todos los
      // derechos. Pero eso pesa distinto segun que se quiera hacer.
      if (u.exposicion <= 1) {
        nivel = 'BAJO';
        porque = 'Leer codigo publico y aprender de una idea no requiere licencia. '
               + 'Las ideas y arquitecturas no se protegen por copyright; el codigo si.';
      } else if (u.exposicion === 2) {
        nivel = 'BAJO';
        porque = 'Correrlo en sandbox para evaluarlo es uso privado y no distribuye nada.';
      } else if (u.exposicion === 3) {
        nivel = 'MEDIO';
        porque = 'Uso interno sin distribucion suele ser de bajo riesgo practico, pero '
               + 'sin licencia no hay permiso explicito. Zona gris.';
      } else {
        nivel = 'MUY_ALTO';
        porque = 'Sin licencia el autor conserva todos los derechos: no hay permiso para '
               + 'copiar, integrar ni redistribuir. En un producto que se cobra, esto es '
               + 'exposicion real.';
      }
    } else if (permisiva) {
      nivel = 'BAJO';
      porque = `${licencia} es permisiva: permite usar, modificar y redistribuir manteniendo `
             + 'el aviso de copyright.';
    } else if (copyleft) {
      nivel = u.exposicion >= 4 ? 'ALTO' : 'BAJO';
      porque = u.exposicion >= 4
        ? `${licencia} es copyleft: incorporarla al producto puede obligar a liberar el codigo `
          + 'que la usa. Es la licencia que mas cuidado exige en software que se vende.'
        : `${licencia} es copyleft, pero para este uso no se distribuye nada, asi que la `
          + 'obligacion de liberar no se dispara.';
    } else {
      nivel = u.exposicion >= 4 ? 'MEDIO' : 'BAJO';
      porque = `Licencia "${licencia}" no esta en las listas conocidas del Lab: hay que leerla.`;
    }

    if (archivado && u.exposicion >= 3)
      porque += ' Ademas el repo esta archivado: no va a haber parches de seguridad.';

    return { uso: id, nombre: u.nombre, que_es: u.que_es, nivel, porque };
  });

  return {
    licencia: licencia ?? 'SIN LICENCIA',
    sin_licencia: sinLicencia,
    filas: filas.sort((a, b) => NIVEL[a.nivel] - NIVEL[b.nivel]),
    aviso: 'Esto NO es asesoramiento legal. Es un semaforo para saber cuando conviene '
         + 'consultar a alguien que sepa antes de avanzar.',
  };
}

/** El uso que efectivamente se le pretende dar, segun donde matcheo. */
function usoProbable({ matches, esWorkflow }) {
  if (!matches.length)
    return { uso: 'LEARNING_REFERENCE',
             porque: 'No matcheo con ningun problema: por ahora solo material de estudio.' };
  if (esWorkflow)
    return { uso: 'INTERNAL_TOOL',
             porque: 'Matcheo contra problemas de nuestro propio workflow: se usaria puertas '
                   + 'adentro, no se le entrega al cliente.' };
  return { uso: 'PRODUCT_INTEGRATION',
           porque: 'Matcheo contra problemas de un producto que se le cobra a un cliente.' };
}

module.exports = { evaluar, usoProbable, USOS, PERMISIVAS, COPYLEFT };
