/**
 * CUENTAS — Núcleo de la aplicación
 * ------------------------------------------------------------
 * Motor interno compartido por todos los módulos. El núcleo no
 * conoce a los módulos: son ellos los que se enganchan al núcleo a
 * través de `pintadores` y `reconciliadores`.
 */

// ============================================================
// 0. CONEXIÓN CON EL BACKEND
// ============================================================

// Dirección del backend (el Código.gs publicado desde Apps Script).
// Solo hay que cambiarla si algún día se crea una implementación
// NUEVA en Apps Script, en vez de una versión de la actual.
const API_URL = 'https://script.google.com/macros/s/AKfycbxO4OadW9yMI7lB6bt-UQI8G8u3S4j004Dw_Qxu7QVfdPinMH4pCr0AUTzn4DqznNEg/exec';

const LS_CLAVE = 'cuentas_clave_v1';

// Código de sesión que devuelve el backend al entrar con clave + PIN.
// Es lo que mantiene la sesión abierta en este dispositivo. El PIN NO
// se guarda aquí ni en ningún otro sitio del dispositivo: de este
// código no se puede sacar el PIN de vuelta (20/09/2026).
const LS_TOKEN = 'cuentas_token_v1';

function obtenerClave() {
  return localStorage.getItem(LS_CLAVE) || '';
}

function obtenerToken() {
  return localStorage.getItem(LS_TOKEN) || '';
}

/**
 * Toda comunicación con el backend pasa por aquí. Se envía siempre
 * por POST con la clave dentro del cuerpo (nunca en la dirección).
 * El tipo text/plain es deliberado: evita una comprobación previa
 * del navegador que Apps Script no sabe responder.
 */
//
// TIEMPO MÁXIMO Y REINTENTO (23/09/2026). Antes la app esperaba sin
// límite: si una respuesta se perdía por el camino (cobertura floja,
// wifi que se corta), se quedaba "guardando" hasta que el navegador se
// rendía y salía un error. En el registro de Ejecuciones de Apps
// Script se vio que el backend nunca fallaba (todo "Completada", entre
// 0,4 y 5,6 s), así que el problema estaba en la espera, no en Google.
// Ahora cada intento tiene un tiempo máximo y, si no llega respuesta,
// se repite UNA vez sola antes de dar el fallo.
//
// Solo se repite lo que es seguro repetir: sincronizar, guardar un
// registro que ya tiene su id (se sobrescribe la misma fila) o borrar
// (si ya estaba borrado, el backend responde bien igualmente). NO se
// repiten la entrada ni la comprobación del PIN (contaría un fallo de
// más contra el límite de intentos) ni el guardado de un cliente
// nuevo sin id (podría crearse dos veces).
const ESPERA_MAXIMA_MS = 25000;

function sePuedeRepetir(cuerpo) {
  const accion = cuerpo && cuerpo.action;
  if (accion === 'login' || accion === 'comprobar_pin') return false;
  if (accion === 'save') return !!(cuerpo.data && cuerpo.data.id);
  return true;
}

async function unIntentoBackend(cuerpo) {
  const control = new AbortController();
  const temporizador = setTimeout(function () { control.abort(); }, ESPERA_MAXIMA_MS);
  try {
    const respuesta = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(Object.assign({ clave: obtenerClave(), token: obtenerToken() }, cuerpo)),
      signal: control.signal
    });
    if (!respuesta.ok) throw new Error('El servidor respondió con un error.');
    return await respuesta.json();
  } catch (err) {
    if (err && err.name === 'AbortError') {
      throw new Error('El servidor no ha respondido a tiempo.');
    }
    throw err;
  } finally {
    clearTimeout(temporizador);
  }
}

async function llamarBackend(cuerpo) {
  let resultado;
  try {
    resultado = await unIntentoBackend(cuerpo);
  } catch (err) {
    if (!sePuedeRepetir(cuerpo)) throw err;
    console.warn('Sin respuesta del servidor, se reintenta una vez:', err);
    resultado = await unIntentoBackend(cuerpo);
  }
  if (resultado.code === 'clave') {
    cerrarSesion('La clave de acceso ya no es válida. Vuelve a introducirla.');
    throw new Error('Clave inválida');
  }
  return resultado;
}

// ============================================================
// 1. ESTADO GLOBAL
// ============================================================

const ENTIDADES = [
  'clientes', 'presupuestos', 'presupuestos_detalle', 'ventas',
  'compras', 'apuntes', 'impuestos'
];

const estado = {
  configuracion: {},
  clientes: [],
  presupuestos: [],
  presupuestos_detalle: [],
  ventas: [],
  compras: [],
  apuntes: [],
  impuestos: [],
  syncReady: false
};

// Puntos de enganche para los módulos futuros. Cada módulo registra
// su función de pintado (se ejecuta al arrancar y tras cada
// sincronización) y, si le corresponde, su reconciliador.
const pintadores = [];
const reconciliadores = [];

function ejecutarPintadores() {
  pintadores.forEach(function (fn) {
    try { fn(); } catch (err) { console.error('Error al pintar:', err); }
  });
}

async function ejecutarReconciliadores() {
  for (const fn of reconciliadores) {
    try { await fn(); } catch (err) { console.error('Error en reconciliador:', err); }
  }
}

// ============================================================
// 1.1 VISTAS (pantallas) Y NAVEGACIÓN ENTRE ELLAS
// ============================================================
// Cada pantalla (Configuración, Clientes, Facturas...) se registra
// con `registrarVista()`. La navegación (mod-navegacion.js) es quien
// pinta los botones y llama a `cambiarVista()`; el núcleo no conoce
// los nombres de los módulos, solo esta lista.

const VISTA_INICIAL = 'dashboard';

const vistas = {};
let vistaActiva = null;

function registrarVista(id, opciones) {
  vistas[id] = opciones; // { titulo, pintar }
}

function pintarVistaActiva() {
  if (!vistaActiva || !vistas[vistaActiva]) return;
  const titulo = document.getElementById('titulo-pantalla');
  if (titulo) titulo.textContent = vistas[vistaActiva].titulo;

  // Protegido a propósito: si el pintado de una pantalla falla (por
  // ejemplo, por un dato con un formato inesperado), el error se queda
  // aquí y no impide que se repinte la barra de navegación, que se
  // pinta justo después de llamar a esta función. Antes, un fallo en
  // una pantalla dejaba la app entera inutilizable, sin menú y sin
  // forma de salir de esa sección. Ver diario, 04/09/2026.
  try {
    vistas[vistaActiva].pintar();
  } catch (err) {
    console.error('Error al pintar la vista "' + vistaActiva + '":', err);
    const contenido = document.getElementById('contenido');
    if (contenido) {
      contenido.innerHTML =
        '<div class="proximamente"><i class="ti ti-alert-triangle"></i>' +
        '<p>No se ha podido mostrar esta pantalla por un problema con algún dato.<br>' +
        'Puedes seguir usando el resto de la app desde el menú.</p></div>';
    }
  }
}

function cambiarVista(id) {
  if (!vistas[id]) return;
  vistaActiva = id;
  pintarVistaActiva();
  ejecutarPintadores();
}

// ============================================================
// 2. ALMACENAMIENTO EN EL DISPOSITIVO
// ============================================================
// Cada tipo de dato se guarda en su propia caja del dispositivo, como
// copia de lo último sincronizado, para que la app abra al instante.

const LS_REAL = 'cuentas_real_';

function leerCaja(clave) {
  try {
    const guardado = localStorage.getItem(clave);
    return guardado ? JSON.parse(guardado) : [];
  } catch (err) {
    console.error('No se pudo leer', clave, err);
    return [];
  }
}

function guardarEntidadLocal(entidad) {
  localStorage.setItem(LS_REAL + entidad, JSON.stringify(estado[entidad]));
}

function guardarTodoLocal() {
  ENTIDADES.forEach(guardarEntidadLocal);
  localStorage.setItem(LS_REAL + 'configuracion', JSON.stringify(estado.configuracion));
}

function cargarTodoLocal() {
  ENTIDADES.forEach(function (entidad) {
    estado[entidad] = leerCaja(LS_REAL + entidad);
  });
  try {
    const cfg = localStorage.getItem(LS_REAL + 'configuracion');
    estado.configuracion = cfg ? JSON.parse(cfg) : {};
  } catch (err) {
    estado.configuracion = {};
  }
}

// Borra del dispositivo cualquier dato de esta app que ya no se use
// (restos de versiones anteriores). Solo se conservan las claves que la
// app usa hoy; todo lo demás que empiece por "cuentas_" se elimina.
function limpiarClavesAntiguas() {
  const enUso = [LS_CLAVE, LS_TOKEN, LS_PENDIENTES, LS_MARCAS];
  try {
    const todas = [];
    for (let i = 0; i < localStorage.length; i++) todas.push(localStorage.key(i));
    todas.forEach(function (k) {
      if (!k || k.indexOf('cuentas_') !== 0) return;
      if (enUso.indexOf(k) !== -1 || k.indexOf(LS_REAL) === 0) return;
      localStorage.removeItem(k);
    });
  } catch (err) {
    console.error('No se pudieron limpiar datos antiguos del dispositivo:', err);
  }
}

// ============================================================
// 3. INDICADOR DE SINCRONIZACIÓN
// ============================================================

const ESTADOS_SYNC = {
  sincronizado: { texto: 'Sincronizado', icono: 'ti-cloud-check', clase: 'ind-verde' },
  guardando:    { texto: 'Guardando',    icono: 'ti-refresh',     clase: 'ind-azul' },
  pendiente:    { texto: 'Pendiente',    icono: 'ti-clock',       clase: 'ind-ambar' },
  sinconexion:  { texto: 'Sin conexión', icono: 'ti-cloud-off',   clase: 'ind-rojo' },
  singuardar:   { texto: 'Sin guardar',  icono: 'ti-cloud-x',     clase: 'ind-rojo' }
};

function indicador(nombre) {
  const el = document.getElementById('indicador-sync');
  if (!el) return;

  // Mientras quede algo sin guardar en la base de datos, el botón de
  // arriba se queda en rojo pase lo que pase; y mientras haya envíos
  // en marcha, en "Guardando". Solo vuelve a verde cuando todo está
  // guardado de verdad.
  const n = contarSinGuardar();
  if (nombre === 'sincronizado') {
    if (n > 0) nombre = 'singuardar';
    else if (hayEnviosEnCurso()) nombre = 'guardando';
  }

  const info = ESTADOS_SYNC[nombre] || ESTADOS_SYNC.pendiente;
  el.className = 'pastilla ' + info.clase + (nombre === 'guardando' ? ' girando' : '');
  el.title = info.texto;
  const texto = (nombre === 'singuardar' && n > 0)
    ? (n === 1 ? '1 sin guardar' : n + ' sin guardar')
    : info.texto;
  el.innerHTML = '<span>' + texto + '</span><i class="ti ' + info.icono + '"></i>';
}

// ============================================================
// 4. BLOQUEO DE ESCRITURA
// ============================================================

function puedeEscribir() {
  if (!estado.syncReady) {
    alert('Todavía no hay conexión con Google Sheets. Espera a que el indicador ponga "Sincronizado" antes de guardar.');
    return false;
  }
  return true;
}

// ============================================================
// 5. COLA DE GUARDADO POR REGISTRO
// ============================================================
// Dos guardados seguidos del MISMO registro se ejecutan en orden, no
// a la vez. Se aplica a todas las entidades por igual (decisión M6).

function crearCola() {
  const pendientesCola = new Map();
  return function encolar(id, tarea) {
    const anterior = pendientesCola.get(id) || Promise.resolve();
    const actual = anterior.then(tarea, tarea);
    pendientesCola.set(id, actual);
    return actual;
  };
}

const colas = {};
ENTIDADES.forEach(function (entidad) { colas[entidad] = crearCola(); });

// ============================================================
// 6. REGISTRO CENTRAL DE PENDIENTES
// ============================================================
// Todo lo que todavía no está confirmado en Google Sheets se apunta
// aquí, y se guarda en el dispositivo: si se cierra la app o se recarga
// la página, los pendientes siguen ahí y su fila sigue en rojo.
//
// Se apunta ANTES de enviar, no solo cuando algo falla (23/09/2026).
// Antes, si la app se cerraba (o se recargaba sola por una versión
// nueva) con un guardado todavía en camino, ese registro se quedaba en
// el dispositivo en verde sin haber llegado nunca a Sheets, y
// desaparecía en la siguiente sincronización. Ahora, si el envío no
// llega a confirmarse, el registro aparece en rojo al volver a abrir y
// se reenvía solo al sincronizar.
//
// Estructura: { "entidad|id": { entidad, id, accion, registro } }
//   accion: 'save' (crear/editar) o 'delete' (borrar)

const LS_PENDIENTES = 'cuentas_pendientes_v1';

let pendientes = {};

function clavePendiente(entidad, id) {
  return String(entidad) + '|' + String(id);
}

function cargarPendientes() {
  try {
    const guardado = localStorage.getItem(LS_PENDIENTES);
    pendientes = guardado ? JSON.parse(guardado) : {};
  } catch (err) {
    pendientes = {};
  }
}

function guardarPendientes() {
  try {
    localStorage.setItem(LS_PENDIENTES, JSON.stringify(pendientes));
  } catch (err) {
    console.error('No se pudieron guardar los pendientes:', err);
  }
}

function marcarPendiente(entidad, id, accion, registro) {
  if (!id) return;
  pendientes[clavePendiente(entidad, id)] = {
    entidad: entidad,
    id: id,
    accion: accion || 'save',
    registro: registro || null
  };
  guardarPendientes();
}

// Quita el pendiente al confirmarse el envío. Con `soloSiEs`, solo lo
// quita si sigue siendo ese mismo trabajo: si mientras tanto se guardó
// una versión más nueva del mismo registro, esa sigue apuntada hasta
// que se confirme ella también.
function quitarPendiente(entidad, id, soloSiEs) {
  if (!id) return;
  const k = clavePendiente(entidad, id);
  const p = pendientes[k];
  if (!p) return;
  if (soloSiEs !== undefined && p.registro !== soloSiEs) return;
  delete pendientes[k];
  guardarPendientes();
}

function obtenerPendiente(entidad, id) {
  return pendientes[clavePendiente(entidad, id)] || null;
}

function listaPendientes() {
  return Object.keys(pendientes).map(function (k) { return pendientes[k]; });
}

// Envíos que están en camino ahora mismo (en memoria: al cerrar la app
// desaparecen, y lo que no se confirmó queda como pendiente en rojo).
// Se cuentan por registro, porque puede haber dos guardados seguidos
// del mismo registro en la cola.
const enviosEnCurso = {};

function empezarEnvio(entidad, id) {
  const k = clavePendiente(entidad, id);
  enviosEnCurso[k] = (enviosEnCurso[k] || 0) + 1;
}

function terminarEnvio(entidad, id) {
  const k = clavePendiente(entidad, id);
  if (enviosEnCurso[k] > 1) enviosEnCurso[k]--;
  else delete enviosEnCurso[k];
}

function estaEnCurso(entidad, id) {
  return !!enviosEnCurso[clavePendiente(entidad, id)];
}

function hayEnviosEnCurso() {
  return Object.keys(enviosEnCurso).length > 0;
}

// Lo que está sin guardar y NO está en camino: lo que de verdad falló.
function pendientesSinGuardar() {
  return listaPendientes().filter(function (p) { return !estaEnCurso(p.entidad, p.id); });
}

function contarSinGuardar() {
  return pendientesSinGuardar().length;
}

// Estado de sincronización de un registro concreto, para el punto de
// color de su fila. Es la única fuente: todos los módulos preguntan
// aquí en vez de llevar su propia lista.
//   'ok' verde | 'guardando' ámbar | 'error' rojo
function estadoSyncDe(entidad, registro) {
  if (!registro) return 'ok';
  if (estaEnCurso(entidad, registro.id)) return 'guardando';
  if (pendientes[clavePendiente(entidad, registro.id)]) return 'error';
  return 'ok';
}

// ============================================================
// 7. GUARDAR Y BORRAR
// ============================================================
// Patrón central de la aplicación: la pantalla responde al momento, y
// el envío a Google Sheets sigue en segundo plano. Si falla, el cambio
// NO se deshace: se queda en el dispositivo, en rojo, y se reenvía al
// sincronizar o con "Reintentar guardado" (decisión 15/09/2026).

async function guardarRegistro(entidad, registro, repintar, cerrarModal) {
  if (!puedeEscribir()) return { status: 'error', message: 'Escritura bloqueada' };

  // Contacto nuevo: su número (id) lo pone Google, así que no se puede
  // apuntar como pendiente hasta tenerlo. Va por un camino aparte.
  if (!registro.id) return guardarRegistroNuevoSinId(entidad, registro, repintar, cerrarModal);

  const id = registro.id;
  const i = estado[entidad].findIndex(function (r) { return String(r.id) === String(id); });
  if (i >= 0) estado[entidad][i] = registro; else estado[entidad].push(registro);
  guardarEntidadLocal(entidad);

  marcarPendiente(entidad, id, 'save', registro);
  empezarEnvio(entidad, id);
  indicador('guardando');
  if (repintar) repintar();
  if (cerrarModal) cerrarModal();

  try {
    const resultado = await colas[entidad](id, function () {
      return llamarBackend({ action: 'save', sheet: entidad, data: registro });
    });
    if (resultado.status !== 'success') throw new Error(resultado.message || 'Fallo al guardar');

    terminarEnvio(entidad, id);
    quitarPendiente(entidad, id, registro);
    if (repintar) repintar();
    indicador('sincronizado');
    return resultado;

  } catch (err) {
    // Se queda apuntado como pendiente (ya lo estaba desde antes de
    // enviar), con su fila en rojo.
    console.error('Fallo al guardar, queda pendiente:', err);
    terminarEnvio(entidad, id);
    if (repintar) repintar();
    indicador('singuardar');
    avisarFalloGuardado(nombreLegible(entidad, registro), false);
    return { status: 'error', message: String(err), pendiente: true };
  }
}

// Contacto nuevo (23/09/2026). Hasta que Google no le da su número, el
// contacto no existe de verdad, así que aquí SÍ se espera a la
// respuesta: la ventana no se cierra hasta que se confirma. Si falla,
// no se deja en la lista una ficha "fantasma" sin número (antes salía
// en verde y se perdía en la siguiente sincronización): la ventana
// sigue abierta con lo escrito, para volver a intentarlo.
async function guardarRegistroNuevoSinId(entidad, registro, repintar, cerrarModal) {
  indicador('guardando');
  try {
    const resultado = await llamarBackend({ action: 'save', sheet: entidad, data: registro });
    if (resultado.status !== 'success' || !resultado.data || !resultado.data.id) {
      throw new Error(resultado.message || 'Fallo al guardar');
    }
    estado[entidad].push(resultado.data);
    guardarEntidadLocal(entidad);
    if (repintar) repintar();
    if (cerrarModal) cerrarModal();
    indicador('sincronizado');
    return resultado;
  } catch (err) {
    console.error('No se pudo crear el registro nuevo:', err);
    indicador('sinconexion');
    return { status: 'error', message: String(err), noCreado: true };
  }
}

async function borrarRegistro(entidad, id, repintar, cerrarModal) {
  if (!puedeEscribir()) return { status: 'error', message: 'Escritura bloqueada' };

  const registro = estado[entidad].find(function (r) { return String(r.id) === String(id); });
  const copiaRegistro = registro ? Object.assign({}, registro) : null;

  estado[entidad] = estado[entidad].filter(function (r) { return String(r.id) !== String(id); });
  guardarEntidadLocal(entidad);

  marcarPendiente(entidad, id, 'delete', copiaRegistro);
  empezarEnvio(entidad, id);
  indicador('guardando');
  if (repintar) repintar();
  if (cerrarModal) cerrarModal();

  try {
    const resultado = await colas[entidad](id, function () {
      return llamarBackend({ action: 'delete', sheet: entidad, data: { id: id } });
    });
    if (resultado.status !== 'success') throw new Error(resultado.message || 'Fallo al borrar');

    terminarEnvio(entidad, id);
    quitarPendiente(entidad, id, copiaRegistro);
    // Por si una sincronización lo volvió a traer mientras se borraba.
    estado[entidad] = estado[entidad].filter(function (r) { return String(r.id) !== String(id); });
    guardarEntidadLocal(entidad);
    if (repintar) repintar();
    indicador('sincronizado');
    return resultado;

  } catch (err) {
    // El borrado falló: el registro REAPARECE en la lista, en rojo,
    // hasta que se confirme el borrado en Sheets (decisión 15/09/2026).
    console.error('Fallo al borrar, queda pendiente:', err);
    terminarEnvio(entidad, id);
    if (copiaRegistro) {
      const existe = estado[entidad].some(function (r) { return String(r.id) === String(id); });
      if (!existe) estado[entidad].push(copiaRegistro);
      guardarEntidadLocal(entidad);
    }
    if (repintar) repintar();
    indicador('singuardar');
    avisarFalloGuardado(nombreLegible(entidad, copiaRegistro), true);
    return { status: 'error', message: String(err), pendiente: true };
  }
}

// "Reintentar guardado" del menú de tres puntos de una fila en rojo:
// vuelve a enviar lo que quedó pendiente de ese registro.
function reintentarRegistro(entidad, id, repintar) {
  const p = obtenerPendiente(entidad, id);
  if (!p) return Promise.resolve(null);
  if (p.accion === 'delete') return borrarRegistro(entidad, id, repintar, null);
  if (!p.registro) return Promise.resolve(null);
  return guardarRegistro(entidad, p.registro, repintar, null);
}

// ------------------------------------------------------------
// Nombre corto y reconocible de un registro, para los avisos.
// ------------------------------------------------------------
function nombreLegible(entidad, registro) {
  if (!registro) return 'el elemento';
  const r = registro;
  const texto = r.nombre_contacto || r.numero || r.concepto || r.descripcion || r.nombre || '';
  const etiquetas = {
    clientes: 'el contacto',
    presupuestos: 'el presupuesto',
    presupuestos_detalle: 'el desglose del presupuesto',
    ventas: 'la factura',
    compras: 'la factura de compra',
    apuntes: 'el apunte',
    impuestos: 'el impuesto'
  };
  const base = etiquetas[entidad] || 'el elemento';
  return texto ? base + ' «' + texto + '»' : base;
}

// ------------------------------------------------------------
// Aviso de que algo no se pudo guardar, con opción de reintentar
// ahora mismo o dejarlo para más tarde (decisión 15/09/2026).
// ------------------------------------------------------------
let avisoFalloAbierto = false;

function avisarFalloGuardado(nombre, esBorrado) {
  // Si varios guardados fallan seguidos (por ejemplo al perder la
  // conexión), se avisa una sola vez en vez de apilar ventanas. El
  // resto queda igualmente en rojo en su fila.
  if (avisoFalloAbierto) return;
  avisoFalloAbierto = true;

  const accion = esBorrado ? 'borrar' : 'guardar';
  mostrarDialogoOpciones(
    'No se pudo ' + accion,
    'No se ha podido ' + accion + ' ' + nombre + ' en la base de datos. El cambio sigue en este dispositivo y aparece en rojo en la lista. Puedes reintentarlo ahora o más tarde con el botón de sincronizar.',
    [
      { id: 'sincronizar', texto: 'Sincronizar', tipo: 'principal' },
      { id: 'cerrar', texto: 'Cerrar' }
    ]
  ).then(function (eleccion) {
    avisoFalloAbierto = false;
    if (eleccion === 'sincronizar') sincronizar();
  });
}

// ------------------------------------------------------------
// Reenvía TODOS los pendientes que no estén ya en camino. Unos pueden
// guardarse y otros fallar; al final solo se avisa de los que han
// fallado (decisión 15/09/2026).
// ------------------------------------------------------------
async function reintentarPendientes() {
  const lista = pendientesSinGuardar();
  if (lista.length === 0) return { fallidos: [], logrados: 0 };

  const fallidos = [];
  let logrados = 0;

  lista.forEach(function (p) { empezarEnvio(p.entidad, p.id); });
  ejecutarPintadores();
  pintarVistaActiva();

  for (let i = 0; i < lista.length; i++) {
    const p = lista[i];
    try {
      if (!colas[p.entidad]) throw new Error('Tipo de dato desconocido: ' + p.entidad);
      const cuerpo = (p.accion === 'delete')
        ? { action: 'delete', sheet: p.entidad, data: { id: p.id } }
        : { action: 'save', sheet: p.entidad, data: p.registro };

      const resultado = await colas[p.entidad](p.id, function () { return llamarBackend(cuerpo); });
      if (resultado.status !== 'success') throw new Error(resultado.message || 'Fallo');

      // Si era un borrado y ahora sí se ha borrado en Sheets, se
      // quita también del dispositivo (había reaparecido en rojo).
      if (p.accion === 'delete') {
        estado[p.entidad] = estado[p.entidad].filter(function (r) { return String(r.id) !== String(p.id); });
        guardarEntidadLocal(p.entidad);
      }

      terminarEnvio(p.entidad, p.id);
      quitarPendiente(p.entidad, p.id, p.registro);
      logrados++;

    } catch (err) {
      console.error('Sigue sin poder guardarse:', p.entidad, p.id, err);
      terminarEnvio(p.entidad, p.id);
      fallidos.push(nombreLegible(p.entidad, p.registro));
    }
  }

  ejecutarPintadores();
  pintarVistaActiva();

  return { fallidos: fallidos, logrados: logrados };
}

// ============================================================
// 7.1 DIÁLOGO CON VARIAS OPCIONES
// ============================================================
// Como alert()/confirm() pero con más de dos botones (p. ej. "Usar
// el existente" / "Editarlo" / "Cancelar"). Devuelve una promesa con
// el id del botón pulsado, o null si se cierra sin elegir.

function mostrarDialogoOpciones(titulo, mensaje, botones) {
  return new Promise(function (resolve) {
    const fondo = document.createElement('div');
    fondo.className = 'dialogo-fondo';
    fondo.innerHTML =
      '<div class="dialogo-caja">' +
        '<p class="dialogo-titulo">' + escaparHtml(titulo) + '</p>' +
        '<p class="dialogo-mensaje">' + escaparHtml(mensaje) + '</p>' +
        '<div class="dialogo-botones">' +
          botones.map(function (b) {
            const clase = b.tipo === 'principal' ? 'boton-principal' : 'boton-secundario';
            return '<button type="button" class="' + clase + '" data-id="' + b.id + '">' + escaparHtml(b.texto) + '</button>';
          }).join('') +
        '</div>' +
      '</div>';
    document.body.appendChild(fondo);

    function cerrar(valor) { fondo.remove(); resolve(valor); }

    fondo.addEventListener('click', function (ev) { if (ev.target === fondo) cerrar(null); });
    fondo.querySelectorAll('[data-id]').forEach(function (b) {
      b.addEventListener('click', function () { cerrar(b.dataset.id); });
    });
  });
}

// ============================================================
// 7.2 ICONO DE CONTACTO Y SU SELECTOR
// ============================================================
// Requiere que iconos-contacto.js esté cargado (define
// CATEGORIAS_ICONOS_CONTACTO, ICONO_CONTACTO_DEFECTO y
// SVG_ICONOS_CONTACTO). Reutilizable por cualquier módulo que
// muestre contactos: Clientes hoy, Presupuestos/Facturas más
// adelante.

function svgIconoContacto(id) {
  const interior = (typeof SVG_ICONOS_CONTACTO !== 'undefined' && SVG_ICONOS_CONTACTO[id])
    ? SVG_ICONOS_CONTACTO[id]
    : (typeof SVG_ICONOS_CONTACTO !== 'undefined' ? SVG_ICONOS_CONTACTO[ICONO_CONTACTO_DEFECTO] : '');
  return '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + interior + '</svg>';
}

// Devuelve el HTML del círculo con icono, listo para insertar en
// cualquier lista o ficha. `tamano` es opcional (por defecto hereda
// del CSS, ver .icono-contacto).
function htmlIconoContacto(idIcono, tamanoPx) {
  const estilo = tamanoPx ? ' style="width:' + tamanoPx + 'px;height:' + tamanoPx + 'px"' : '';
  return '<div class="icono-contacto"' + estilo + '>' + svgIconoContacto(idIcono || ICONO_CONTACTO_DEFECTO) + '</div>';
}

function tituloIconoContacto(id) {
  for (const cat of CATEGORIAS_ICONOS_CONTACTO) {
    const encontrado = cat.iconos.find(function (i) { return i.id === id; });
    if (encontrado) return encontrado.titulo;
  }
  return 'Icono';
}

// Abre el selector y devuelve una promesa con el id elegido, o null
// si se cierra sin elegir nada.
function abrirSelectorIcono(idActual) {
  return new Promise(function (resolve) {
    const fondo = document.createElement('div');
    fondo.className = 'selector-icono-fondo';
    fondo.innerHTML =
      '<div class="selector-icono-caja">' +
        '<div class="selector-icono-cabecera">' +
          '<p class="selector-icono-titulo">Elegir icono</p>' +
          '<button type="button" class="selector-icono-cerrar" aria-label="Cerrar"><i class="ti ti-x"></i></button>' +
        '</div>' +
        '<input type="text" class="selector-icono-buscador" placeholder="Buscar (ej. taller, fotografía, ayuntamiento...)">' +
        '<div class="selector-icono-cuerpo" id="selector-icono-cuerpo"></div>' +
      '</div>';
    document.body.appendChild(fondo);

    function cerrar(valor) { fondo.remove(); resolve(valor); }
    fondo.addEventListener('click', function (ev) { if (ev.target === fondo) cerrar(null); });
    fondo.querySelector('.selector-icono-cerrar').addEventListener('click', function () { cerrar(null); });

    function pintar(filtro) {
      const cuerpo = fondo.querySelector('#selector-icono-cuerpo');
      const texto = normalizarBusqueda(filtro || '');
      let huboResultados = false;
      let html = '';

      CATEGORIAS_ICONOS_CONTACTO.forEach(function (cat) {
        const iconosFiltrados = !texto ? cat.iconos : cat.iconos.filter(function (i) {
          return normalizarBusqueda(i.titulo + ' ' + i.buscar + ' ' + i.id).indexOf(texto) !== -1;
        });
        if (iconosFiltrados.length === 0) return;
        huboResultados = true;
        html += '<p class="selector-icono-categoria-titulo">' + escaparHtml(cat.nombre) + '</p>';
        html += '<div class="selector-icono-rejilla">';
        html += iconosFiltrados.map(function (i) {
          return '<button type="button" class="selector-icono-opcion' + (i.id === idActual ? ' seleccionado' : '') +
            '" data-icono="' + i.id + '" title="' + escaparHtml(i.titulo) + '">' + svgIconoContacto(i.id) + '</button>';
        }).join('');
        html += '</div>';
      });

      cuerpo.innerHTML = huboResultados ? html : '<p class="selector-icono-vacio">Sin resultados para esa búsqueda.</p>';
      cuerpo.querySelectorAll('[data-icono]').forEach(function (b) {
        b.addEventListener('click', function () { cerrar(b.dataset.icono); });
      });
    }

    pintar('');
    const buscador = fondo.querySelector('.selector-icono-buscador');
    buscador.addEventListener('input', function () { pintar(buscador.value); });
    setTimeout(function () { buscador.focus(); }, 50);
  });
}

// ============================================================
// 7.3 SELECTOR DE CONTACTO (CLIENTE / PROVEEDOR) CON BUSCADOR
// ============================================================
// Mismo patrón visual que el selector de icono: ventana modal con
// buscador arriba, filtrado en vivo con normalizarBusqueda. Sustituye
// a los <select> nativos de cliente/proveedor en Apuntes, Facturas de
// venta, Facturas de compra y Presupuestos — pensados para listas
// largas y para usarse con el teclado en móvil.
//
// `contactos`: array de objetos con {id, nombre_contacto}.
// `idActual`: id ya seleccionado, o '' si no hay ninguno.
// `opciones.permitirLibre`: si es true, añade una opción para escribir
//   un nombre suelto sin registrar (solo se usa en Apuntes). El valor
//   se devuelve como { libre: 'nombre escrito' } en vez de un id.
//
// Devuelve una promesa que resuelve a:
//   - null                    → se cerró sin elegir nada
//   - ''                      → "Sin contacto"
//   - un id (string)          → contacto elegido de la lista
//   - { libre: 'texto' }      → nombre libre escrito (solo si se permite)
function abrirSelectorContacto(contactos, idActual, opciones) {
  const permitirLibre = !!(opciones && opciones.permitirLibre);
  const etiquetaLibre = (opciones && opciones.etiquetaLibre) || 'nombre sin registrar';

  return new Promise(function (resolve) {
    const fondo = document.createElement('div');
    fondo.className = 'selector-icono-fondo';
    fondo.innerHTML =
      '<div class="selector-icono-caja">' +
        '<div class="selector-icono-cabecera">' +
          '<p class="selector-icono-titulo">Elegir contacto</p>' +
          '<button type="button" class="selector-icono-cerrar" aria-label="Cerrar"><i class="ti ti-x"></i></button>' +
        '</div>' +
        '<input type="text" class="selector-icono-buscador" placeholder="Buscar por nombre...">' +
        (permitirLibre
          ? '<button type="button" class="selector-contacto-libre-btn" id="selector-contacto-libre-btn">' +
              '<i class="ti ti-edit"></i> Poner un ' + etiquetaLibre +
            '</button>'
          : '') +
        '<div class="selector-icono-cuerpo" id="selector-contacto-cuerpo"></div>' +
      '</div>';
    document.body.appendChild(fondo);

    function cerrar(valor) { fondo.remove(); resolve(valor); }
    fondo.addEventListener('click', function (ev) { if (ev.target === fondo) cerrar(null); });
    fondo.querySelector('.selector-icono-cerrar').addEventListener('click', function () { cerrar(null); });

    if (permitirLibre) {
      fondo.querySelector('#selector-contacto-libre-btn').addEventListener('click', function () {
        const nombre = prompt('Escribe el nombre (no se registrará como cliente/proveedor):');
        if (nombre === null) return;
        const limpio = nombre.trim();
        if (!limpio) return;
        cerrar({ libre: limpio });
      });
    }

    function pintar(filtro) {
      const cuerpo = fondo.querySelector('#selector-contacto-cuerpo');
      const texto = normalizarBusqueda(filtro || '');

      const filtrados = !texto ? contactos : contactos.filter(function (c) {
        return normalizarBusqueda(c.nombre_contacto).indexOf(texto) !== -1;
      });

      let html = '<div class="selector-contacto-lista">';
      if (!texto) {
        html += '<button type="button" class="selector-contacto-opcion' + (!idActual ? ' seleccionado' : '') +
          '" data-id="">Sin contacto</button>';
      }
      html += filtrados.map(function (c) {
        return '<button type="button" class="selector-contacto-opcion' + (String(c.id) === String(idActual) ? ' seleccionado' : '') +
          '" data-id="' + escaparHtml(String(c.id)) + '">' + escaparHtml(c.nombre_contacto) + '</button>';
      }).join('');
      html += '</div>';

      cuerpo.innerHTML = (filtrados.length === 0 && texto)
        ? '<p class="selector-icono-vacio">Sin resultados para esa búsqueda.</p>'
        : html;

      cuerpo.querySelectorAll('[data-id]').forEach(function (b) {
        b.addEventListener('click', function () { cerrar(b.dataset.id); });
      });
    }

    pintar('');
    const buscador = fondo.querySelector('.selector-icono-buscador');
    buscador.addEventListener('input', function () { pintar(buscador.value); });
    setTimeout(function () { buscador.focus(); }, 50);
  });
}

// ============================================================
// 8. SINCRONIZACIÓN
// ============================================================
// UNA SOLA petición al backend por sincronización. La app manda las
// marcas que ella tiene y recibe de vuelta las marcas actuales junto
// con los datos de las hojas que hayan cambiado; si no ha cambiado
// nada, no viene ningún dato.
//
// Por qué una sola petición (corrección del 20/09/2026): cada llamada
// a Apps Script cuesta varios segundos SOLO por hacerla, traiga mucho
// o nada. El diseño anterior hacía dos llamadas (preguntar qué cambió,
// y luego pedirlo), así que en el caso normal —que algo haya
// cambiado— salía más lento que traerlo todo de golpe como se hacía
// antes, y encima duplicaba las probabilidades de toparse con un
// fallo puntual de Google. Ahora es un solo viaje, con muchos menos
// datos dentro.

const LS_MARCAS = 'cuentas_marcas_v1';

function leerMarcasLocales() {
  try {
    const guardado = localStorage.getItem(LS_MARCAS);
    return guardado ? JSON.parse(guardado) : {};
  } catch (err) {
    return {};
  }
}

function guardarMarcasLocales(marcas) {
  try {
    localStorage.setItem(LS_MARCAS, JSON.stringify(marcas));
  } catch (err) {
    console.error('No se pudieron guardar las marcas:', err);
  }
}

// Vuelve a poner encima de los datos recién traídos del servidor todo
// lo que sigue pendiente de guardar en este dispositivo (incluido lo que
// está en camino en ese momento), para que una sincronización nunca
// borre ni deshaga trabajo sin confirmar.
function reaplicarPendientes() {
  listaPendientes().forEach(function (p) {
    if (!estado[p.entidad]) return;
    if (p.accion === 'delete') {
      // Un borrado en camino no se enseña aunque el servidor todavía lo
      // tenga. Un borrado que falló deja el registro visible (en rojo)
      // hasta que se confirme: si el servidor lo devuelve, se queda.
      if (estaEnCurso(p.entidad, p.id)) {
        estado[p.entidad] = estado[p.entidad].filter(function (r) { return String(r.id) !== String(p.id); });
      }
      return;
    }
    if (!p.registro) return;
    const i = estado[p.entidad].findIndex(function (r) { return String(r.id) === String(p.id); });
    if (i >= 0) estado[p.entidad][i] = p.registro;
    else estado[p.entidad].push(p.registro);
  });
}

function configDesdeFilas(filas) {
  const obj = {};
  (filas || []).forEach(function (fila) { obj[fila.clave] = fila.valor; });
  return obj;
}

// Solo una sincronización a la vez (23/09/2026). Antes, tocar el
// indicador mientras ya se sincronizaba lanzaba otra encima: las dos
// competían, repetían los mismos guardados y todo iba más lento. Si ya
// hay una en marcha, se espera a esa en vez de empezar otra.
let sincronizacionEnCurso = null;

function sincronizar() {
  if (sincronizacionEnCurso) return sincronizacionEnCurso;
  sincronizacionEnCurso = sincronizarAhora().finally(function () {
    sincronizacionEnCurso = null;
  });
  return sincronizacionEnCurso;
}

async function sincronizarAhora() {
  try {
    indicador('guardando');

    // 0) Antes de traer nada, se reenvía lo que quedó sin guardar.
    //    Se mandan todos de golpe; unos pueden lograrse y otros no,
    //    y solo se avisa de los que han fallado (decisión 15/09/2026).
    if (contarSinGuardar() > 0) {
      const res = await reintentarPendientes();
      if (res.fallidos.length > 0) {
        alert('No se han podido guardar: ' + res.fallidos.join(', ') + '. Siguen marcados en rojo en la lista.');
      } else if (res.logrados > 0) {
        alert(res.logrados === 1
          ? 'Guardado correctamente lo que quedaba pendiente.'
          : 'Guardados correctamente los ' + res.logrados + ' cambios que quedaban pendientes.');
      }
    }

    // 1) Un solo viaje: se mandan las marcas que tiene el dispositivo
    //    y vuelven las marcas actuales más los datos de lo que haya
    //    cambiado. Si el dispositivo no tiene marcas todavía (primera
    //    vez), el backend devuelve todas las hojas.
    const respuesta = await llamarBackend({ action: 'sync', marcas: leerMarcasLocales() });
    if (respuesta.status !== 'success') throw new Error(respuesta.message || 'Fallo al sincronizar');

    const marcasServidor = respuesta.marcas || {};
    const datos = respuesta.datos || {};
    const cambiadas = Object.keys(datos);

    // Si no ha cambiado nada, no hay datos que aplicar. Aun así hay
    // que dejar la conexión como confirmada (syncReady), o la app se
    // quedaría bloqueada sin poder guardar nada aunque la
    // sincronización haya ido bien.
    if (cambiadas.length === 0) {
      guardarMarcasLocales(marcasServidor);
      estado.syncReady = true;
      await ejecutarReconciliadores();
      indicador('sincronizado');
      pintarVistaActiva();
      ejecutarPintadores();
      return;
    }

    if (datos.configuracion !== undefined) {
      estado.configuracion = configDesdeFilas(datos.configuracion);
    }
    ENTIDADES.forEach(function (entidad) {
      if (datos[entidad] !== undefined) estado[entidad] = datos[entidad];
    });

    // Lo que vino del servidor NO puede pisar lo que aún está sin
    // guardar en este dispositivo: se vuelve a poner encima. Sin esto,
    // sincronizar borraría el trabajo pendiente (15/09/2026).
    reaplicarPendientes();

    guardarTodoLocal();

    // Solo se actualizan las marcas guardadas en el dispositivo
    // DESPUÉS de que los datos se hayan guardado bien en local (arriba).
    // Así, si algo falla a mitad de camino, la próxima sincronización
    // lo volverá a intentar en vez de darlo por hecho.
    guardarMarcasLocales(marcasServidor);

    // La conexión se da por buena AQUÍ, antes de los reconciliadores,
    // no después. Los reconciliadores reparan datos escribiendo en
    // Sheets a través de guardarRegistro(), y esa función empieza
    // comprobando puedeEscribir(), que exige `syncReady`. Con el orden
    // anterior, cualquier reparación automática (por ejemplo, recrear
    // el apunte perdido de una factura cobrada o de un impuesto
    // pagado) se encontraba la escritura bloqueada, sacaba el aviso de
    // "todavía no hay conexión" y no se hacía nunca. A estas alturas
    // los datos ya se han cargado del servidor, así que la conexión
    // está confirmada. Ver diario, 05/09/2026.
    estado.syncReady = true;

    await ejecutarReconciliadores();

    indicador('sincronizado');
  } catch (err) {
    console.error('No se pudo sincronizar:', err);
    indicador('sinconexion');
  }
  pintarVistaActiva();
  ejecutarPintadores();
}

// ============================================================
// 9. UTILIDADES — DINERO 🔒 (no modificar sin pedirlo)
// ============================================================

function roundMoney(v) {
  return Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100;
}

function formatMoney(v) {
  return roundMoney(v).toLocaleString('es-ES', {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  }) + ' €';
}

// ============================================================
// 10. UTILIDADES — FECHAS
// ============================================================
// Se guardan y transportan siempre como texto YYYY-MM-DD.
// Se muestran como DD/MM/YYYY, o «—» si no hay fecha.

function fechaHoyISO() {
  const d = new Date();
  return d.getFullYear() + '-' +
         String(d.getMonth() + 1).padStart(2, '0') + '-' +
         String(d.getDate()).padStart(2, '0');
}

function normalizarFecha(valor) {
  if (!valor) return '';
  if (valor instanceof Date) {
    return valor.getFullYear() + '-' +
           String(valor.getMonth() + 1).padStart(2, '0') + '-' +
           String(valor.getDate()).padStart(2, '0');
  }
  const texto = String(valor).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto;
  const barras = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (barras) {
    return barras[3] + '-' + barras[2].padStart(2, '0') + '-' + barras[1].padStart(2, '0');
  }
  const fecha = new Date(texto);
  return isNaN(fecha.getTime()) ? '' : normalizarFecha(fecha);
}

function mostrarFecha(iso) {
  if (!iso) return '—';
  const p = String(iso).split('-');
  return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : '—';
}

// ============================================================
// 11. UTILIDADES — NÚMEROS
// ============================================================

function parsearNumero(v) {
  if (v === null || v === undefined || v === '') return 0;
  const limpio = String(v).trim().replace(/\s/g, '').replace(',', '.');
  const n = parseFloat(limpio);
  return isNaN(n) ? 0 : n;
}

// Limpia mientras se escribe (solo dígitos y un separador decimal) y
// vacía el campo al enfocarlo si vale 0. Funciona con cualquier campo
// marcado con data-numero="1", lo cree el módulo que lo cree.
function activarCamposNumericos() {
  document.addEventListener('input', function (ev) {
    const el = ev.target;
    if (!el.dataset || el.dataset.numero !== '1') return;
    let v = el.value.replace(',', '.').replace(/[^0-9.]/g, '');
    const partes = v.split('.');
    if (partes.length > 2) v = partes[0] + '.' + partes.slice(1).join('');
    el.value = v;
  });
  document.addEventListener('focusin', function (ev) {
    const el = ev.target;
    if (el.dataset && el.dataset.numero === '1' && parsearNumero(el.value) === 0) el.value = '';
  });
}

// ============================================================
// 12. UTILIDADES — BÚSQUEDA, ORDEN, ESCAPADO
// ============================================================

// Retrasa la ejecución de `fn` hasta que pasen `ms` milisegundos sin
// que se vuelva a llamar. Se usa en los buscadores de listado
// (Clientes, Facturas, Apuntes, Presupuestos): al escribir rápido, la
// lista solo se repinta cuando hay una pequeña pausa, en vez de en
// cada tecla — evita reconstruir listas largas de golpe mientras se
// sigue escribiendo (bloque de Rendimiento, 09/09/2026).
function conRetardo(fn, ms) {
  let temporizador = null;
  return function () {
    const args = arguments;
    const contexto = this;
    clearTimeout(temporizador);
    temporizador = setTimeout(function () { fn.apply(contexto, args); }, ms);
  };
}

// Minúsculas y sin acentos. Se usa en TODOS los buscadores de la
// aplicación, sin excepciones (decisión M5).
function normalizarBusqueda(v) {
  return String(v == null ? '' : v)
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function numeroFinal(valor) {
  const m = String(valor || '').match(/(\d+)\s*$/);
  return m ? parseInt(m[1], 10) : 0;
}

function compararRegistros(a, b, campoDireccion) {
  const [campo, direccion = 'desc'] = String(campoDireccion).split('-');
  const signo = direccion === 'asc' ? 1 : -1;
  let va, vb;
  if (campo === 'numero') {
    va = numeroFinal(a.numero); vb = numeroFinal(b.numero);
  } else if (campo === 'total') {
    va = Number(a.total || 0); vb = Number(b.total || 0);
  } else {
    va = a[campo] || ''; vb = b[campo] || '';
  }
  if (va < vb) return -signo;
  if (va > vb) return signo;
  return 0;
}

function escaparHtml(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#39;')
    .replace(/"/g, '&quot;');
}

// ============================================================
// 13. ACCESO CON CLAVE
// ============================================================

function mostrarPantallaAcceso(mensaje) {
  document.getElementById('app').hidden = true;
  document.getElementById('pantalla-acceso').hidden = false;
  const error = document.getElementById('error-acceso');
  error.hidden = !mensaje;
  error.textContent = mensaje || '';
  const campo = document.getElementById('campo-clave');
  campo.value = '';
  const campoPin = document.getElementById('campo-pin');
  if (campoPin) campoPin.value = '';
  setTimeout(function () { campo.focus(); }, 50);
}

function cerrarSesion(mensaje) {
  localStorage.removeItem(LS_CLAVE);
  localStorage.removeItem(LS_TOKEN);
  estado.syncReady = false;
  mostrarPantallaAcceso(mensaje);
}

function entrarEnLaApp() {
  document.getElementById('pantalla-acceso').hidden = true;
  document.getElementById('app').hidden = false;
}

// Hay sesión abierta si están las DOS cosas: la clave y el código de
// sesión que devolvió el backend al entrar con el PIN.
function haySesion() {
  return !!obtenerClave() && !!obtenerToken();
}

/**
 * Entrar: se mandan clave y PIN juntos. Si los dos son correctos, el
 * backend devuelve el código de sesión que este dispositivo guardará.
 * El PIN no se guarda en ningún sitio.
 */
async function iniciarSesion(clave, pin) {
  const control = new AbortController();
  const temporizador = setTimeout(function () { control.abort(); }, ESPERA_MAXIMA_MS);
  try {
    const respuesta = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ clave: clave, pin: pin, action: 'login' }),
      signal: control.signal
    });
    if (!respuesta.ok) throw new Error('El servidor respondió con un error.');
    return await respuesta.json();
  } finally {
    clearTimeout(temporizador);
  }
}

function prepararFormularioAcceso() {
  const form = document.getElementById('form-acceso');
  const boton = document.getElementById('boton-entrar');
  const error = document.getElementById('error-acceso');

  form.addEventListener('submit', async function (ev) {
    ev.preventDefault();
    const clave = document.getElementById('campo-clave').value.trim();
    const campoPin = document.getElementById('campo-pin');
    const pin = campoPin ? campoPin.value.trim() : '';
    if (!clave || !pin) {
      error.textContent = 'Escribe la clave y el PIN.';
      error.hidden = false;
      return;
    }

    boton.disabled = true;
    boton.textContent = 'Comprobando...';
    error.hidden = true;

    try {
      const r = await iniciarSesion(clave, pin);
      if (r.status === 'success' && r.token) {
        localStorage.setItem(LS_CLAVE, clave);
        localStorage.setItem(LS_TOKEN, r.token);
        entrarEnLaApp();
        await arrancarAplicacion();
      } else if (r.code === 'pin' || r.code === 'bloqueado') {
        error.textContent = r.message || 'PIN incorrecto.';
        error.hidden = false;
      } else if (r.code === 'sinpin') {
        error.textContent = 'Falta configurar el PIN en Apps Script (línea PIN_ACCESO de Código.gs).';
        error.hidden = false;
      } else {
        error.textContent = 'Clave incorrecta.';
        error.hidden = false;
      }
    } catch (err) {
      error.textContent = 'No se pudo conectar. Comprueba tu conexión.';
      error.hidden = false;
    }

    boton.disabled = false;
    boton.textContent = 'Entrar';
  });
}

// ============================================================
// 13.1 PIN PARA ACCIONES DELICADAS
// ============================================================
// Borrar cosas, deshacer un cobro o tocar la configuración piden el
// PIN cada vez, elemento por elemento (decisión 15/09/2026). Lo
// comprueba Google, no la app: el PIN no está guardado en el
// dispositivo ni escrito en ningún archivo público.

function pedirPin(queSeVaAHacer) {
  return new Promise(function (resolve) {
    const fondo = document.createElement('div');
    fondo.className = 'dialogo-fondo';
    fondo.innerHTML =
      '<div class="dialogo-caja">' +
        '<p class="dialogo-titulo">Confirma con tu PIN</p>' +
        '<p class="dialogo-mensaje">' + escaparHtml(queSeVaAHacer) + '</p>' +
        '<input type="password" class="campo campo-pin-dialogo" id="dialogo-campo-pin" ' +
          'inputmode="numeric" autocomplete="off" aria-label="PIN">' +
        '<p class="dialogo-error" id="dialogo-pin-error" hidden></p>' +
        '<div class="dialogo-botones">' +
          '<button type="button" class="boton-principal" data-id="aceptar">Confirmar</button>' +
          '<button type="button" class="boton-secundario" data-id="cancelar">Cancelar</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(fondo);

    const campo = fondo.querySelector('#dialogo-campo-pin');
    const aviso = fondo.querySelector('#dialogo-pin-error');
    const btnOk = fondo.querySelector('[data-id="aceptar"]');

    function cerrar(valor) { fondo.remove(); resolve(valor); }

    function aceptar() {
      const valor = campo.value.trim();
      if (!valor) {
        aviso.textContent = 'Escribe el PIN.';
        aviso.hidden = false;
        campo.focus();
        return;
      }
      cerrar(valor);
    }

    // El formulario NO se cierra al tocar fuera: hay algo que
    // confirmar dentro. Solo con Cancelar (patrón de la guía).
    fondo.querySelector('[data-id="cancelar"]').addEventListener('click', function () { cerrar(null); });
    btnOk.addEventListener('click', aceptar);
    campo.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') { ev.preventDefault(); aceptar(); }
    });

    setTimeout(function () { campo.focus(); }, 50);
  });
}

/**
 * Pide el PIN y lo comprueba contra Google. Devuelve true solo si es
 * correcto. Si se cancela, si falla o si no hay conexión, devuelve
 * false y NO se ha tocado nada.
 */
async function confirmarConPin(queSeVaAHacer) {
  const pin = await pedirPin(queSeVaAHacer);
  if (pin === null) return false;       // cancelado

  const fondo = document.createElement('div');
  fondo.className = 'dialogo-fondo';
  fondo.innerHTML = '<div class="dialogo-caja"><p class="dialogo-mensaje">Comprobando el PIN...</p></div>';
  document.body.appendChild(fondo);

  try {
    const r = await llamarBackend({ action: 'comprobar_pin', pin: pin });
    fondo.remove();
    if (r.status === 'success') return true;
    alert((r.message || 'PIN incorrecto.') + '\n\nNo se ha hecho ningún cambio.');
    return false;
  } catch (err) {
    fondo.remove();
    console.error('No se pudo comprobar el PIN:', err);
    alert('No se ha podido comprobar el PIN. No se ha hecho ningún cambio.');
    return false;
  }
}

// ============================================================
// 14. ARRANQUE
// ============================================================
// Primero se pinta con lo último guardado en el dispositivo, para que
// la app abra al instante. Después se sincroniza y se repinta.

async function arrancarAplicacion() {
  limpiarClavesAntiguas();
  cargarTodoLocal();
  cargarPendientes();

  // La app abre SIEMPRE en el Dashboard, no en la última pantalla que
  // se estuviera mirando (decisión del propietario, 06/09/2026): es la
  // pantalla de resumen y quiere verla cada vez que entra.
  vistaActiva = VISTA_INICIAL;
  pintarVistaActiva();
  ejecutarPintadores();

  await sincronizar();
}

window.addEventListener('DOMContentLoaded', function () {
  activarCamposNumericos();
  prepararFormularioAcceso();

  const indicadorEl = document.getElementById('indicador-sync');
  if (indicadorEl) indicadorEl.addEventListener('click', sincronizar);

  if (haySesion()) {
    entrarEnLaApp();
    arrancarAplicacion();
  } else {
    mostrarPantallaAcceso();
  }

  // Versión nueva de la app (22/09/2026): cuando se sube una versión y
  // el service worker nuevo toma el control, la página se recarga sola
  // UNA vez para usar ya el código nuevo. Antes había que cerrar y
  // abrir la app varias veces, o borrar los datos del sitio. La primera
  // instalación (sin versión anterior) no recarga nada.
  if ('serviceWorker' in navigator) {
    const habiaVersionAnterior = !!navigator.serviceWorker.controller;
    let recargando = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!habiaVersionAnterior || recargando) return;
      recargando = true;
      window.location.reload();
    });
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' })
      .then(function (reg) { reg.update().catch(function () { /* sin conexión */ }); })
      .catch(function (err) {
        console.error('No se pudo registrar el service worker:', err);
      });
  }
});
