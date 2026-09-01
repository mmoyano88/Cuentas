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

function obtenerClave() {
  return localStorage.getItem(LS_CLAVE) || '';
}

/**
 * Toda comunicación con el backend pasa por aquí. Se envía siempre
 * por POST con la clave dentro del cuerpo (nunca en la dirección).
 * El tipo text/plain es deliberado: evita una comprobación previa
 * del navegador que Apps Script no sabe responder.
 */
async function llamarBackend(cuerpo) {
  const respuesta = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(Object.assign({ clave: obtenerClave() }, cuerpo))
  });
  if (!respuesta.ok) throw new Error('El servidor respondió con un error.');
  const resultado = await respuesta.json();
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
  'ventas_detalle', 'compras', 'apuntes', 'impuestos'
];

const estado = {
  configuracion: {},
  clientes: [],
  presupuestos: [],
  presupuestos_detalle: [],
  ventas: [],
  ventas_detalle: [],
  compras: [],
  apuntes: [],
  impuestos: [],
  syncReady: false,
  modoPrueba: false
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
// 2. ALMACENAMIENTO EN EL DISPOSITIVO
// ============================================================
// Cada tipo de dato tiene DOS cajas separadas: una para los datos
// reales y otra para los de prueba. Nunca se mezclan (decisión I8).

const LS_REAL = 'cuentas_real_';
const LS_TEST = 'cuentas_prueba_';
const LS_MODO_PRUEBA = 'cuentas_modo_prueba_v1';

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
  const reales = estado[entidad].filter(function (r) { return !esDePrueba(r); });
  const pruebas = estado[entidad].filter(esDePrueba);
  localStorage.setItem(LS_REAL + entidad, JSON.stringify(reales));
  localStorage.setItem(LS_TEST + entidad, JSON.stringify(pruebas));
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

function fusionarDatosDePrueba() {
  ENTIDADES.forEach(function (entidad) {
    estado[entidad] = estado[entidad]
      .filter(function (r) { return !esDePrueba(r); })
      .concat(leerCaja(LS_TEST + entidad));
  });
}

// ============================================================
// 3. MODO PRUEBA
// ============================================================

function esDePrueba(registro) {
  if (!registro) return false;
  if (registro.es_prueba === true || registro._test === true) return true;
  return typeof registro.id === 'string' && registro.id.indexOf('test-') === 0;
}

function generarIdPrueba(prefijo) {
  return 'test-' + prefijo + '-' + Date.now().toString(36) + '-' +
         Math.floor(Math.random() * 1e9).toString(36);
}

function activarModoPrueba() {
  estado.modoPrueba = true;
  localStorage.setItem(LS_MODO_PRUEBA, '1');
  pintarBandaPrueba();
}

function desactivarModoPrueba() {
  // Borrado limpio e inmediato de todo lo de prueba, sin papelera.
  ENTIDADES.forEach(function (entidad) {
    localStorage.removeItem(LS_TEST + entidad);
    estado[entidad] = estado[entidad].filter(function (r) { return !esDePrueba(r); });
  });
  estado.modoPrueba = false;
  localStorage.removeItem(LS_MODO_PRUEBA);
  pintarBandaPrueba();
  ejecutarPintadores();
}

function pintarBandaPrueba() {
  const banda = document.getElementById('banda-prueba');
  if (banda) banda.hidden = !estado.modoPrueba;
}

// Con el modo prueba activo, editar un registro REAL no lo modifica:
// crea una copia de prueba. Así una prueba nunca estropea un dato real.
function prepararParaGuardar(entidad, registro) {
  if (!estado.modoPrueba) return registro;
  if (esDePrueba(registro)) return registro;
  const eraReal = estado[entidad].some(function (r) {
    return String(r.id) === String(registro.id) && !esDePrueba(r);
  });
  if (!eraReal) return registro;
  return Object.assign({}, registro, { id: generarIdPrueba(entidad), es_prueba: true });
}

// ============================================================
// 4. INDICADOR DE SINCRONIZACIÓN
// ============================================================

const ESTADOS_SYNC = {
  sincronizado: { texto: 'Sincronizado', icono: 'ti-cloud-check', clase: 'ind-verde' },
  guardando:    { texto: 'Guardando',    icono: 'ti-refresh',     clase: 'ind-azul' },
  pendiente:    { texto: 'Pendiente',    icono: 'ti-clock',       clase: 'ind-ambar' },
  sinconexion:  { texto: 'Sin conexión', icono: 'ti-cloud-off',   clase: 'ind-rojo' }
};

function indicador(nombre) {
  const el = document.getElementById('indicador-sync');
  if (!el) return;
  const info = ESTADOS_SYNC[nombre] || ESTADOS_SYNC.pendiente;
  el.className = 'pastilla ' + info.clase + (nombre === 'guardando' ? ' girando' : '');
  el.title = info.texto;
  el.innerHTML = '<span>' + info.texto + '</span><i class="ti ' + info.icono + '"></i>';
}

// ============================================================
// 5. BLOQUEO DE ESCRITURA
// ============================================================

function puedeEscribir() {
  if (!estado.syncReady && !estado.modoPrueba) {
    alert('Todavía no hay conexión con Google Sheets. Espera a que el indicador ponga "Sincronizado" antes de guardar.');
    return false;
  }
  return true;
}

// ============================================================
// 6. COLA DE GUARDADO POR REGISTRO
// ============================================================
// Dos guardados seguidos del MISMO registro se ejecutan en orden, no
// a la vez. Se aplica a las 8 entidades por igual (decisión M6).

function crearCola() {
  const pendientes = new Map();
  return function encolar(id, tarea) {
    const anterior = pendientes.get(id) || Promise.resolve();
    const actual = anterior.then(tarea, tarea);
    pendientes.set(id, actual);
    return actual;
  };
}

const colas = {};
ENTIDADES.forEach(function (entidad) { colas[entidad] = crearCola(); });

// ============================================================
// 7. GUARDAR Y BORRAR, CON REVERSIÓN SI FALLA
// ============================================================
// Patrón central de la aplicación: la pantalla responde al momento y,
// si el guardado remoto falla, se deshace todo y se avisa.

async function guardarRegistro(entidad, registroEntrada, repintar, cerrarModal) {
  if (!puedeEscribir()) return { status: 'error', message: 'Escritura bloqueada' };

  const registro = prepararParaGuardar(entidad, registroEntrada);
  const copiaSeguridad = estado[entidad].slice();

  const i = estado[entidad].findIndex(function (r) { return String(r.id) === String(registro.id); });
  if (i >= 0) estado[entidad][i] = registro; else estado[entidad].push(registro);

  guardarEntidadLocal(entidad);
  if (repintar) repintar();
  if (cerrarModal) cerrarModal();

  // En modo prueba no se toca Google Sheets en absoluto.
  if (estado.modoPrueba && esDePrueba(registro)) {
    return { status: 'success', soloLocal: true, data: registro };
  }

  try {
    indicador('guardando');
    const resultado = await colas[entidad](registro.id, function () {
      return llamarBackend({ action: 'save', sheet: entidad, data: registro });
    });
    if (resultado.status !== 'success') throw new Error(resultado.message || 'Fallo al guardar');

    // Si el backend completó algún dato (por ejemplo el id numérico de
    // un cliente nuevo), se refleja aquí.
    if (resultado.data) {
      const j = estado[entidad].indexOf(registro);
      if (j >= 0) estado[entidad][j] = resultado.data;
      guardarEntidadLocal(entidad);
      if (repintar) repintar();
    }

    indicador('sincronizado');
    return resultado;

  } catch (err) {
    console.error('Fallo al guardar, deshaciendo:', err);
    estado[entidad] = copiaSeguridad;
    guardarEntidadLocal(entidad);
    if (repintar) repintar();
    indicador('sinconexion');
    alert('No se pudo guardar en Google Sheets. El cambio se ha deshecho. Inténtalo otra vez cuando haya conexión.');
    return { status: 'error', message: String(err) };
  }
}

async function borrarRegistro(entidad, id, repintar, cerrarModal) {
  if (!puedeEscribir()) return { status: 'error', message: 'Escritura bloqueada' };

  const copiaSeguridad = estado[entidad].slice();
  const registro = estado[entidad].find(function (r) { return String(r.id) === String(id); });

  estado[entidad] = estado[entidad].filter(function (r) { return String(r.id) !== String(id); });
  guardarEntidadLocal(entidad);
  if (repintar) repintar();
  if (cerrarModal) cerrarModal();

  if (estado.modoPrueba && esDePrueba(registro)) {
    return { status: 'success', soloLocal: true };
  }

  try {
    indicador('guardando');
    const resultado = await colas[entidad](id, function () {
      return llamarBackend({ action: 'delete', sheet: entidad, data: { id: id } });
    });
    if (resultado.status !== 'success') throw new Error(resultado.message || 'Fallo al borrar');
    indicador('sincronizado');
    return resultado;

  } catch (err) {
    console.error('Fallo al borrar, deshaciendo:', err);
    estado[entidad] = copiaSeguridad;
    guardarEntidadLocal(entidad);
    if (repintar) repintar();
    indicador('sinconexion');
    alert('No se pudo borrar en Google Sheets. El cambio se ha deshecho. Inténtalo otra vez cuando haya conexión.');
    return { status: 'error', message: String(err) };
  }
}

// ============================================================
// 8. SINCRONIZACIÓN
// ============================================================

function configDesdeFilas(filas) {
  const obj = {};
  (filas || []).forEach(function (fila) { obj[fila.clave] = fila.valor; });
  return obj;
}

async function sincronizar() {
  try {
    indicador('guardando');
    const respuesta = await llamarBackend({ action: 'load' });
    if (respuesta.status !== 'success') throw new Error(respuesta.message || 'Fallo al cargar');

    const datos = respuesta.datos;
    estado.configuracion = configDesdeFilas(datos.configuracion);
    ENTIDADES.forEach(function (entidad) { estado[entidad] = datos[entidad] || []; });

    guardarTodoLocal();
    fusionarDatosDePrueba();

    await ejecutarReconciliadores();

    estado.syncReady = true;
    indicador('sincronizado');
  } catch (err) {
    console.error('No se pudo sincronizar:', err);
    indicador('sinconexion');
  }
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
  setTimeout(function () { campo.focus(); }, 50);
}

function cerrarSesion(mensaje) {
  localStorage.removeItem(LS_CLAVE);
  estado.syncReady = false;
  mostrarPantallaAcceso(mensaje);
}

function entrarEnLaApp() {
  document.getElementById('pantalla-acceso').hidden = true;
  document.getElementById('app').hidden = false;
}

async function comprobarClave(clave) {
  const respuesta = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ clave: clave, action: 'ping' })
  });
  const resultado = await respuesta.json();
  return resultado.status === 'success';
}

function prepararFormularioAcceso() {
  const form = document.getElementById('form-acceso');
  const boton = document.getElementById('boton-entrar');
  const error = document.getElementById('error-acceso');

  form.addEventListener('submit', async function (ev) {
    ev.preventDefault();
    const clave = document.getElementById('campo-clave').value.trim();
    if (!clave) return;

    boton.disabled = true;
    boton.textContent = 'Comprobando...';
    error.hidden = true;

    try {
      if (await comprobarClave(clave)) {
        localStorage.setItem(LS_CLAVE, clave);
        entrarEnLaApp();
        await arrancarAplicacion();
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
// 14. ARRANQUE
// ============================================================
// Primero se pinta con lo último guardado en el dispositivo, para que
// la app abra al instante. Después se sincroniza y se repinta.

async function arrancarAplicacion() {
  estado.modoPrueba = localStorage.getItem(LS_MODO_PRUEBA) === '1';
  pintarBandaPrueba();

  cargarTodoLocal();
  fusionarDatosDePrueba();
  ejecutarPintadores();

  await sincronizar();
}

window.addEventListener('DOMContentLoaded', function () {
  activarCamposNumericos();
  prepararFormularioAcceso();

  const indicadorEl = document.getElementById('indicador-sync');
  if (indicadorEl) indicadorEl.addEventListener('click', sincronizar);

  if (obtenerClave()) {
    entrarEnLaApp();
    arrancarAplicacion();
  } else {
    mostrarPantallaAcceso();
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(function (err) {
      console.error('No se pudo registrar el service worker:', err);
    });
  }
});
