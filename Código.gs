/**
 * CÓDIGO.GS — Backend de la app «Cuentas»
 * ------------------------------------------------------------
 * Único cometido: leer y escribir en la hoja de cálculo.
 * La pantalla de la aplicación NO vive aquí (va en GitHub Pages).
 *
 * Todas las peticiones llegan por POST y deben traer la clave de
 * acceso. Sin clave correcta, el backend no devuelve ningún dato.
 * Para entrar además hace falta el PIN: la primera petición
 * (action: 'login') comprueba clave + PIN y devuelve un código de
 * sesión que el dispositivo debe mandar en todas las peticiones
 * siguientes. Ver sección 2.1.
 */

// ============================================================
// 1. CONFIGURACIÓN
// ============================================================

// ⚠️ CAMBIA ESTO por tu clave larga generada con Bitwarden, dejándola
// entre las comillas. Es la misma que escribirás en la app la primera
// vez que la abras en cada dispositivo.
const CLAVE_ACCESO = 'CAMBIAME';

// ⚠️ PON AQUÍ TU PIN NUEVO, entre las comillas. Solo vive aquí y en tu
// cabeza: nunca se guarda en el dispositivo.
const PIN_ACCESO = 'CAMBIAME';

// ⚠️ PON AQUÍ EL ID DE TU HOJA REAL: es el trozo largo de su dirección,
// entre "/d/" y "/edit".
const SPREADSHEET_ID = 'PEGA_AQUI_EL_ID_DE_LA_HOJA_REAL';

// Nombre lógico (el que usa la app) → nombre real de la pestaña.
// Coinciden todas menos "impuestos": la pestaña real se llama
// "Impuestos" con mayúscula. Aquí se traduce automáticamente.
//
// "ventas_detalle" se eliminó (12/09/2026): las facturas de venta ya
// no llevan líneas de detalle desde la simplificación del 07/09/2026
// (GUÍA sección 20). Nada en la app la escribe ni la lee.
//
// Las tres hojas de plantillas se añadieron el 25/09/2026 (módulo
// Plantillas). ⚠️ Las tres pestañas tienen que existir en el Sheets
// ANTES de publicar esta versión: si falta alguna, la sincronización
// falla en todos los dispositivos. El desglose de la Calculadora de una
// plantilla de presupuesto no tiene pestaña propia: va en
// presupuestos_detalle, como el de los presupuestos.
const SHEETS = {
  configuracion: 'configuracion',
  clientes: 'clientes',
  presupuestos: 'presupuestos',
  presupuestos_detalle: 'presupuestos_detalle',
  ventas: 'ventas',
  compras: 'compras',
  apuntes: 'apuntes',
  impuestos: 'Impuestos',
  plantillas_presupuesto: 'plantillas_presupuesto',
  plantillas_factura: 'plantillas_factura',
  plantillas_apunte: 'plantillas_apunte'
};

// Nombre de la pestaña donde se guarda la marca de última
// modificación de cada hoja lógica (mecanismo de sincronización
// eficiente, 12/09/2026). Debe existir en el Sheets con esta pestaña
// y las cabeceras "hoja" | "marca" en la fila 1.
const HOJA_MARCAS = 'sync_marcas';

// Límite de intentos del PIN (22/09/2026): con 10 fallos dentro de la
// misma hora, el PIN deja de aceptarse (aunque sea el bueno) hasta que
// pase esa hora. Evita que alguien lo adivine probando números. Los
// fallos se apuntan en las "propiedades" privadas del propio Apps
// Script, no en el Sheets. Un acierto borra la cuenta de fallos.
const PIN_MAX_FALLOS = 10;
const PIN_VENTANA_MS = 60 * 60 * 1000;

// Copias de seguridad automáticas (22/09/2026): cada 14 días se hace
// una copia completa de esta hoja de cálculo en una carpeta de tu
// Google Drive, y se conservan solo las 4 más recientes. Las más
// antiguas van a la papelera de Drive (30 días para recuperarlas).
// Se ponen en marcha con activarAutomatismos() (sección 9).
// Desde el 26/09/2026 también se puede hacer una copia a mano desde la
// app (Configuración → Copias de seguridad); cuenta dentro de las 4.
const CARPETA_COPIAS = 'Cuentas - Copias de seguridad';
const COPIAS_A_CONSERVAR = 4;
const DIAS_ENTRE_COPIAS = 14;

// Archivar años antiguos (28/09/2026, sección 9.1). Los registros de
// esos años pasan a una hoja aparte en la carpeta "Cuentas - Archivo"
// de tu Drive (que nunca se vacía sola) y salen de esta hoja y de la
// app. Nunca se pueden archivar el año en curso ni los 5 anteriores:
// lo comprueba aquí Google, aunque la app pidiera otra cosa.
const ANIOS_PROTEGIDOS = 5;
const CARPETA_ARCHIVO = 'Cuentas - Archivo';
const HOJAS_ARCHIVABLES = ['ventas', 'compras', 'apuntes', 'impuestos'];

// ============================================================
// 2. PUNTOS DE ENTRADA
// ============================================================

function doGet(e) {
  // Abrir esta dirección en el navegador ya no muestra ningún dato.
  return salidaJson({ status: 'ok', message: 'API de Cuentas. Las peticiones se hacen por POST.' });
}

function doPost(e) {
  try {
    const peticion = JSON.parse(e.postData.contents);

    // Red de seguridad: si falta poner la clave o el PIN, no se abre
    // nada (así nunca queda en marcha con un valor de ejemplo).
    if (PIN_ACCESO === 'CAMBIAME' || CLAVE_ACCESO === 'CAMBIAME') {
      return salidaJson({ status: 'error', code: 'sinpin',
        message: 'Falta poner la clave o el PIN en Código.gs (líneas CLAVE_ACCESO y PIN_ACCESO).' });
    }

    if (peticion.clave !== CLAVE_ACCESO) {
      return salidaJson({ status: 'error', code: 'clave', message: 'Clave de acceso incorrecta.' });
    }

    const action = peticion.action;
    const sheet = peticion.sheet;
    const data = peticion.data;

    if (!action) throw new Error('Falta "action" en la petición.');

    // --- ENTRAR: clave + PIN. Devuelve el código de sesión. ---
    if (action === 'login') {
      const fallo = conCerrojo(function () { return comprobarPin(peticion.pin); });
      if (fallo) return salidaJson(fallo);
      return salidaJson({ status: 'success', token: codigoDeSesion() });
    }

    // --- Todo lo demás exige un código de sesión válido ---
    if (String(peticion.token || '') !== codigoDeSesion()) {
      return salidaJson({ status: 'error', code: 'clave',
        message: 'La sesión ya no es válida. Vuelve a entrar con tu clave y tu PIN.' });
    }

    // --- Comprobación del PIN para una acción delicada ---
    if (action === 'comprobar_pin') {
      const fallo = conCerrojo(function () { return comprobarPin(peticion.pin); });
      if (fallo) return salidaJson(fallo);
      return salidaJson({ status: 'success' });
    }

    // Las escrituras van siempre con cerrojo (ver sección 2.3).
    let resultado;
    if (action === 'ping') {
      resultado = { status: 'success' };              // solo comprueba que la sesión sigue valiendo
    } else if (action === 'sync') {
      resultado = sincronizacion(peticion.marcas);   // marcas + datos en UNA sola petición
    } else if (action === 'save') {
      resultado = conCerrojo(function () { return manejarGuardar(sheet, data); });
    } else if (action === 'delete') {
      resultado = conCerrojo(function () { return manejarBorrar(sheet, data); });
    } else if (action === 'save_config') {
      resultado = conCerrojo(function () { return manejarGuardarConfig(data); });
    } else if (action === 'info_copias') {
      resultado = infoCopias();                      // solo consulta la carpeta de Drive (26/09/2026)
    } else if (action === 'copia_ahora') {
      resultado = conCerrojo(function () { copiaDeSeguridad(); return infoCopias(); });
    } else if (action === 'archivar') {
      resultado = conCerrojo(function () { return archivarAnios(peticion.hasta, peticion.ids); });   // 28/09/2026
    } else {
      throw new Error('Acción desconocida: ' + action);
    }

    return salidaJson(resultado);
  } catch (err) {
    return salidaJson({ status: 'error', message: String(err) });
  }
}

// ============================================================
// 2.1 CÓDIGO DE SESIÓN
// ============================================================
// Cuando se entra con clave + PIN correctos, el dispositivo se lleva
// este código y lo manda en cada petición. El PIN NO se guarda en el
// dispositivo: solo vive aquí y en la cabeza del propietario.
//
// El código se calcula a partir de la clave y el PIN con una "huella"
// de un solo sentido (SHA-256): se puede comprobar, pero de él no se
// puede sacar el PIN de vuelta. Si el PIN cambia, todos los códigos
// que hubiera por ahí dejan de valer solos.

function codigoDeSesion() {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    CLAVE_ACCESO + '|' + PIN_ACCESO + '|cuentas-sesion-v1',
    Utilities.Charset.UTF_8
  );
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += ('0' + (bytes[i] & 0xFF).toString(16)).slice(-2);
  }
  return hex;
}

// ============================================================
// 2.2 LÍMITE DE INTENTOS DEL PIN
// ============================================================
// Devuelve null si el PIN es correcto y no hay bloqueo. Si no, devuelve
// la respuesta de error que hay que mandar a la app.

function comprobarPin(pinRecibido) {
  const props = PropertiesService.getScriptProperties();
  const ahora = Date.now();
  let fallos = [];
  try { fallos = JSON.parse(props.getProperty('pin_fallos') || '[]'); } catch (e) { fallos = []; }
  fallos = fallos.filter(function (t) { return ahora - t < PIN_VENTANA_MS; });

  if (fallos.length >= PIN_MAX_FALLOS) {
    const minutos = Math.max(1, Math.ceil((fallos[0] + PIN_VENTANA_MS - ahora) / 60000));
    props.setProperty('pin_fallos', JSON.stringify(fallos));
    return { status: 'error', code: 'bloqueado',
      message: 'Demasiados intentos fallidos. El PIN está bloqueado durante ' + minutos + ' min.' };
  }

  if (String(pinRecibido || '') !== String(PIN_ACCESO)) {
    fallos.push(ahora);
    props.setProperty('pin_fallos', JSON.stringify(fallos));
    const quedan = PIN_MAX_FALLOS - fallos.length;
    return { status: 'error', code: 'pin',
      message: quedan > 0
        ? 'PIN incorrecto. ' + (quedan === 1 ? 'Te queda 1 intento' : 'Te quedan ' + quedan + ' intentos') + ' esta hora.'
        : 'PIN incorrecto. Has agotado los intentos: el PIN queda bloqueado una hora.' };
  }

  props.deleteProperty('pin_fallos');
  return null;
}

// Por si alguna vez te bloqueas tú mismo y no quieres esperar la hora:
// elige esta función arriba en el editor y pulsa Ejecutar.
function desbloquearPin() {
  PropertiesService.getScriptProperties().deleteProperty('pin_fallos');
  Logger.log('PIN desbloqueado.');
}

// ============================================================
// 2.3 CERROJO PARA LAS ESCRITURAS
// ============================================================
// Google puede atender dos peticiones a la vez (dos guardados seguidos,
// dos dispositivos, o el reintento automático de la app mientras la
// primera petición todavía se está procesando). Borrar una fila mueve
// hacia arriba todas las de debajo, así que un guardado que había
// localizado su fila justo antes podía acabar escribiendo en la fila
// de OTRO registro. Con el cerrojo, las escrituras se hacen de una en
// una: la segunda espera (como mucho 20 s) a que termine la primera.
// La lectura (sincronizar) no espera a nadie. Añadido el 23/09/2026.

function conCerrojo(tarea) {
  const cerrojo = LockService.getScriptLock();
  cerrojo.waitLock(20000);   // si no se consigue a tiempo, da error y la app lo deja pendiente
  try {
    const resultado = tarea();
    SpreadsheetApp.flush();  // que lo escrito quede guardado antes de soltar el cerrojo
    return resultado;
  } finally {
    cerrojo.releaseLock();
  }
}

// ============================================================
// 3. SINCRONIZACIÓN EN UNA SOLA PETICIÓN
// ============================================================
// Cada llamada a Apps Script cuesta varios segundos solo por hacerla,
// traiga muchos datos o ninguno. Por eso preguntar "¿qué ha cambiado?"
// y pedir los datos después, en dos peticiones, salía MÁS LENTO que
// traerlo todo de una vez como se hacía antes (comprobado 20/09/2026).
//
// Aquí se hace todo en una sola ida y vuelta: la app manda las marcas
// que ella tiene, y se le devuelven las marcas actuales junto con los
// datos de las hojas que hayan cambiado. Si no ha cambiado nada,
// "datos" viene vacío y no se transporta nada.

function sincronizacion(marcasCliente) {
  const marcas = obtenerMarcasPlano();
  const delCliente = marcasCliente || {};
  const primeraVez = Object.keys(delCliente).length === 0;

  const datos = {};
  Object.keys(SHEETS).forEach(function (nombreLogico) {
    const cambio = primeraVez ||
      String(marcas[nombreLogico]) !== String(delCliente[nombreLogico]);
    if (cambio) datos[nombreLogico] = leerHojaComoObjetos(nombreLogico);
  });

  return { status: 'success', marcas: marcas, datos: datos };
}

// ============================================================
// 4. LECTURA
// ============================================================

// El libro se abre UNA sola vez por petición y se reutiliza. Antes se
// abría de nuevo en cada pestaña que se leía (hasta 8 veces seguidas),
// y abrir el libro es de lo más lento que hay (20/09/2026).
let _libro = null;

function abrirLibro() {
  if (!_libro) _libro = SpreadsheetApp.openById(SPREADSHEET_ID);
  return _libro;
}

function obtenerHojaFisica(nombreLogico) {
  const nombreReal = SHEETS[nombreLogico];
  if (!nombreReal) throw new Error('Hoja desconocida: ' + nombreLogico);
  const hoja = abrirLibro().getSheetByName(nombreReal);
  if (!hoja) throw new Error('No existe la pestaña "' + nombreReal + '" en la hoja de cálculo.');
  return hoja;
}

function obtenerCabeceras(hoja) {
  const ultimaCol = hoja.getLastColumn();
  if (ultimaCol === 0) return [];
  return hoja.getRange(1, 1, 1, ultimaCol).getValues()[0];
}

function leerHojaComoObjetos(nombreLogico) {
  const hoja = obtenerHojaFisica(nombreLogico);
  const cabeceras = obtenerCabeceras(hoja);
  const ultimaFila = hoja.getLastRow();
  if (ultimaFila < 2 || cabeceras.length === 0) return [];

  const valores = hoja.getRange(2, 1, ultimaFila - 1, cabeceras.length).getValues();
  const filas = [];
  for (let i = 0; i < valores.length; i++) {
    const fila = valores[i];
    if (fila.every(function (v) { return v === '' || v === null; })) continue; // fila vacía
    const obj = {};
    for (let c = 0; c < cabeceras.length; c++) {
      obj[cabeceras[c]] = normalizarValorSalida(fila[c], cabeceras[c]);
    }
    filas.push(obj);
  }
  return filas;
}

// Si una celda de fecha se guardó como fecha real, Apps Script la
// devuelve como objeto Date y al convertirla puede desplazarse un día
// por la zona horaria. Se fuerza siempre a texto YYYY-MM-DD.
//
// Columnas de identificador ("id" y las que empiezan por "id_"): nunca
// son fechas. Si Sheets les puso formato de fecha por su cuenta (pasó
// el 21/09/2026: el contacto 9 apareció como 1900-01-08 y el apunte se
// quedó sin cliente), se recupera el número original.
function esColumnaId(columna) {
  const c = String(columna || '');
  return c === 'id' || c.indexOf('id_') === 0;
}

function normalizarValorSalida(valor, columna) {
  if (Object.prototype.toString.call(valor) === '[object Date]') {
    if (esColumnaId(columna)) return numeroDeSerieDeFecha(valor);
    return Utilities.formatDate(valor, zonaHoraria(), 'yyyy-MM-dd');
  }
  return valor;
}

// Deshace la conversión de Sheets: el número 9 se muestra como el día
// 9 contado desde el 30/12/1899.
function numeroDeSerieDeFecha(fecha) {
  const texto = Utilities.formatDate(fecha, zonaHoraria(), 'yyyy-MM-dd');
  const partes = texto.split('-');
  const utc = Date.UTC(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]));
  return Math.round((utc - Date.UTC(1899, 11, 30)) / 86400000);
}

// Misma zona horaria que se ha usado siempre para las fechas. Se lee
// una sola vez por petición.
let _zona = null;
function zonaHoraria() {
  if (!_zona) _zona = Session.getScriptTimeZone();
  return _zona;
}

// ============================================================
// 5. GUARDAR
// ============================================================
// "data" es el objeto completo de la fila. Si ya existe una fila con
// ese id se sobrescribe entera; si no, se añade al final.

function manejarGuardar(nombreLogico, data) {
  if (!data) throw new Error('Falta "data" en la petición de guardado.');

  // El id de un cliente nuevo lo genera siempre el backend (decisión B3).
  if (nombreLogico === 'clientes' && !data.id) {
    data.id = siguienteIdCliente();
  }

  const hoja = obtenerHojaFisica(nombreLogico);
  const cabeceras = obtenerCabeceras(hoja);

  // Red de seguridad: si llegara sin id, se genera uno para no perder
  // el registro (no debería ocurrir; los módulos generan el suyo).
  if (!data.id) data.id = generarId('id');

  const fila = buscarFilaPorId(hoja, cabeceras, data.id);
  const valoresFila = cabeceras.map(function (col) {
    return (data[col] !== undefined && data[col] !== null) ? data[col] : '';
  });

  // Fila existente: se sobrescribe. Nueva: va justo debajo de la última.
  const filaDestino = fila > 0 ? fila : hoja.getLastRow() + 1;
  if (filaDestino > hoja.getMaxRows()) hoja.insertRowAfter(hoja.getMaxRows());
  escribirFilaConTexto(hoja.getRange(filaDestino, 1, 1, cabeceras.length), [valoresFila]);

  actualizarMarca(nombreLogico);

  return { status: 'success', data: data };
}

// ------------------------------------------------------------
// EL TEXTO SE GUARDA COMO TEXTO (24/09/2026)
// ------------------------------------------------------------
// Google Sheets "interpreta" lo que se escribe, igual que si se tecleara
// a mano: un número de factura de proveedor como 0012/2026 podía perder
// los ceros o convertirse en una fecha, y 202600003550 se guardaba como
// número. Para evitarlo, antes de escribir se marcan como TEXTO las
// celdas que reciben un texto, y se guarda tal cual, letra por letra.
//
// Excepciones, a propósito:
//   · Los importes y cantidades llegan desde la app como números, no
//     como texto, así que siguen siendo números en la hoja.
//   · Las fechas (AAAA-MM-DD) siguen dejándose como fecha, para que en
//     la hoja se vean y se ordenen como hasta ahora.
// Las celdas que no reciben texto conservan el formato que ya tenían.
function esTextoAProteger(valor) {
  return typeof valor === 'string' && valor !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(valor);
}

function escribirFilaConTexto(rango, valores) {
  const formatos = rango.getNumberFormats();
  valores.forEach(function (fila, i) {
    fila.forEach(function (valor, j) {
      if (esTextoAProteger(valor)) formatos[i][j] = '@';
    });
  });
  rango.setNumberFormats(formatos);
  rango.setValues(valores);
}

function buscarFilaPorId(hoja, cabeceras, id) {
  const colId = cabeceras.indexOf('id');
  if (colId === -1) return -1;
  const ultimaFila = hoja.getLastRow();
  if (ultimaFila < 2) return -1;
  const valoresId = hoja.getRange(2, colId + 1, ultimaFila - 1, 1).getValues();
  for (let i = 0; i < valoresId.length; i++) {
    if (String(valoresId[i][0]) === String(id)) return i + 2; // la fila 1 es la cabecera
  }
  return -1;
}

function siguienteIdCliente() {
  const hoja = obtenerHojaFisica('clientes');
  const cabeceras = obtenerCabeceras(hoja);
  const colId = cabeceras.indexOf('id');
  const ultimaFila = hoja.getLastRow();
  let maxId = 0;
  if (ultimaFila >= 2) {
    const valoresId = hoja.getRange(2, colId + 1, ultimaFila - 1, 1).getValues();
    valoresId.forEach(function (fila) {
      const n = Number(fila[0]);
      if (!isNaN(n) && n > maxId) maxId = n;
    });
  }
  return maxId + 1;
}

function generarId(prefijo) {
  const t = Date.now().toString(36);
  const r = Math.floor(Math.random() * 1e9).toString(36);
  return prefijo + '-' + t + '-' + r;
}

// ============================================================
// 6. BORRAR
// ============================================================

function manejarBorrar(nombreLogico, data) {
  if (!data || !data.id) throw new Error('Falta "id" en la petición de borrado.');
  const hoja = obtenerHojaFisica(nombreLogico);
  const cabeceras = obtenerCabeceras(hoja);
  const fila = buscarFilaPorId(hoja, cabeceras, data.id);
  if (fila === -1) {
    return { status: 'success', deleted: false, message: 'No existía ese id.' };
  }
  hoja.deleteRow(fila);

  actualizarMarca(nombreLogico);

  return { status: 'success', deleted: true, id: data.id };
}

// ============================================================
// 7. GUARDAR CONFIGURACIÓN
// ============================================================
// data: objeto plano { clave1: valor1, ... } con la configuración
// completa. Cada clave se actualiza si existe, o se añade si no.

function manejarGuardarConfig(data) {
  if (!data) throw new Error('Falta "data" en el guardado de configuración.');

  const hoja = obtenerHojaFisica('configuracion');
  const ultimaFila = hoja.getLastRow();
  const filaDeCadaClave = {};

  if (ultimaFila >= 2) {
    const valores = hoja.getRange(2, 1, ultimaFila - 1, 1).getValues();
    valores.forEach(function (fila, i) {
      filaDeCadaClave[fila[0]] = i + 2;
    });
  }

  // El texto se guarda como texto (ver escribirFilaConTexto).
  const filasNuevas = [];
  for (const clave in data) {
    if (filaDeCadaClave[clave]) {
      escribirFilaConTexto(hoja.getRange(filaDeCadaClave[clave], 2), [[data[clave]]]);
    } else {
      filasNuevas.push([clave, data[clave]]);
    }
  }

  if (filasNuevas.length > 0) {
    const primera = hoja.getLastRow() + 1;
    const faltan = primera + filasNuevas.length - 1 - hoja.getMaxRows();
    if (faltan > 0) hoja.insertRowsAfter(hoja.getMaxRows(), faltan);
    escribirFilaConTexto(hoja.getRange(primera, 1, filasNuevas.length, 2), filasNuevas);
  }

  actualizarMarca('configuracion');

  return { status: 'success' };
}

// ============================================================
// 8. MARCAS DE SINCRONIZACIÓN (sync_marcas)
// ============================================================
// Una fila por cada hoja lógica de SHEETS, con la hora de su último
// cambio. La app manda las suyas al sincronizar y solo se le devuelven
// los datos de las hojas cuya marca haya cambiado.
//
// La pestaña "sync_marcas" debe existir en el Sheets, con cabeceras
// "hoja" y "marca" en la fila 1. Las filas que falten se crean solas
// la primera vez. Si falta la pestaña entera, estas funciones no hacen
// nada y la app se descarga todo como antes: nunca rompen el guardado.

function obtenerHojaMarcas() {
  return abrirLibro().getSheetByName(HOJA_MARCAS);
}

// Actualiza a "ahora" la marca de una hoja lógica.
function actualizarMarca(nombreLogico) {
  const hoja = obtenerHojaMarcas();
  if (!hoja) return;

  const ultimaFila = hoja.getLastRow();
  if (ultimaFila >= 2) {
    const valores = hoja.getRange(2, 1, ultimaFila - 1, 1).getValues();
    for (let i = 0; i < valores.length; i++) {
      if (String(valores[i][0]) === String(nombreLogico)) {
        hoja.getRange(i + 2, 2).setValue(Date.now());
        return;
      }
    }
  }
  // Si la hoja lógica no tenía fila todavía en sync_marcas, se añade.
  hoja.appendRow([nombreLogico, Date.now()]);
}

// Una marca es siempre un número (milisegundos). Si la celda tuviera
// formato de fecha, Sheets la devolvería como objeto Date y la
// comparación con lo que manda la app nunca coincidiría: el mecanismo
// dejaría de ahorrar sin dar ningún error. Se fuerza siempre a número.
function normalizarMarca(valor) {
  if (Object.prototype.toString.call(valor) === '[object Date]') return valor.getTime();
  if (valor === '' || valor === null || valor === undefined) return '';
  const n = Number(valor);
  return isNaN(n) ? String(valor) : n;
}

// Devuelve las marcas como objeto: { clientes: 172..., ventas: 172... }
//
// Si alguna hoja lógica no tiene marca todavía (fila vacía o
// inexistente) se le pone una ahora mismo. Sin esto, una hoja sin
// marca se quedaría igual en el servidor y en la app para siempre y
// nunca se descargaría aunque hubiera cambiado.
function obtenerMarcasPlano() {
  const hoja = obtenerHojaMarcas();
  if (!hoja) return {};

  const ultimaFila = hoja.getLastRow();
  const marcas = {};
  const filaDe = {};

  if (ultimaFila >= 2) {
    const valores = hoja.getRange(2, 1, ultimaFila - 1, 2).getValues();
    valores.forEach(function (fila, i) {
      if (fila[0] === '' || fila[0] === null) return;
      marcas[fila[0]] = normalizarMarca(fila[1]);
      filaDe[fila[0]] = i + 2;
    });
  }

  const ahora = Date.now();
  const porAnadir = [];
  let faltaba = false;
  Object.keys(SHEETS).forEach(function (nombreLogico) {
    const m = marcas[nombreLogico];
    if (m === undefined || m === null || m === '') {
      faltaba = true;
      marcas[nombreLogico] = ahora;
      if (filaDe[nombreLogico]) {
        hoja.getRange(filaDe[nombreLogico], 2).setValue(ahora);
      } else {
        porAnadir.push([nombreLogico, ahora]);
      }
    }
  });

  if (porAnadir.length > 0) {
    hoja.getRange(hoja.getLastRow() + 1, 1, porAnadir.length, 2).setValues(porAnadir);
  }

  // La columna de marcas debe quedarse como número simple. Si Sheets
  // le pusiera formato de fecha, las marcas se leerían como fechas y
  // la comparación dejaría de funcionar. Solo se toca cuando se acaba
  // de inicializar alguna, no en cada sincronización.
  if (faltaba) {
    hoja.getRange(2, 2, Math.max(hoja.getLastRow() - 1, 1), 1).setNumberFormat('0');
  }

  return marcas;
}

// Si editas la hoja de cálculo A MANO (desde Google Sheets, no desde
// la app), la app no se enteraría: sus marcas no cambian y seguiría
// usando la copia que ya tenía, e incluso podría volver a escribir el
// dato viejo encima al editar ese registro. Para evitarlo, un aviso
// automático de Google (activado con activarAutomatismos) llama a esta
// función cada vez que cambias algo a mano, y se marcan TODAS las hojas
// como cambiadas: en la siguiente sincronización la app se descarga
// todo de nuevo, una sola vez. Los cambios que hace la propia app no
// disparan este aviso. Añadido el 23/09/2026.
function alCambiarHojaAMano(e) {
  const cerrojo = LockService.getScriptLock();
  if (!cerrojo.tryLock(20000)) return;
  try {
    Object.keys(SHEETS).forEach(actualizarMarca);
    SpreadsheetApp.flush();
  } finally {
    cerrojo.releaseLock();
  }
}

// ============================================================
// 9. AUTOMATISMOS: COPIAS DE SEGURIDAD Y EDICIÓN A MANO
// ============================================================
// PUESTA EN MARCHA (una sola vez en cada proyecto de Apps Script):
// arriba en el editor elige "activarAutomatismos" y pulsa Ejecutar.
// Google pedirá permiso para usar tu Drive y tu hoja: acéptalo.
//   · Hace una primera copia de seguridad al momento y deja
//     programadas las siguientes cada 14 días, de madrugada.
//   · Activa el aviso de edición a mano (ver alCambiarHojaAMano).
// Se puede volver a ejecutar sin problema: antes de crear los avisos
// borra los que hubiera, así que nunca quedan duplicados.

function activarAutomatismos() {
  const propios = ['copiaDeSeguridad', 'alCambiarHojaAMano'];
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (propios.indexOf(t.getHandlerFunction()) !== -1) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('copiaDeSeguridad').timeBased().everyDays(DIAS_ENTRE_COPIAS).atHour(3).create();
  ScriptApp.newTrigger('alCambiarHojaAMano').forSpreadsheet(SPREADSHEET_ID).onChange().create();
  copiaDeSeguridad();
  Logger.log('Automatismos activados: copia cada ' + DIAS_ENTRE_COPIAS + ' días (se conservan ' +
    COPIAS_A_CONSERVAR + ') y aviso de edición a mano.');
}

function copiaDeSeguridad() {
  const libro = abrirLibro();
  const carpeta = carpetaDeCopias();
  const nombre = 'Copia ' + libro.getName() + ' ' +
    Utilities.formatDate(new Date(), zonaHoraria(), 'yyyy-MM-dd HH.mm');
  DriveApp.getFileById(SPREADSHEET_ID).makeCopy(nombre, carpeta);

  // Solo se conservan las más recientes; el resto va a la papelera.
  const copias = [];
  const archivos = carpeta.getFiles();
  while (archivos.hasNext()) copias.push(archivos.next());
  copias.sort(function (a, b) { return b.getDateCreated() - a.getDateCreated(); });
  copias.slice(COPIAS_A_CONSERVAR).forEach(function (f) { f.setTrashed(true); });

  // De paso, se devuelve el formato de número a las columnas de
  // identificador, por si Sheets les hubiera puesto formato de fecha.
  repararFormatoIds();

  Logger.log('Copia creada: ' + nombre);
}

function carpetaDeCopias() {
  const encontradas = DriveApp.getFoldersByName(CARPETA_COPIAS);
  return encontradas.hasNext() ? encontradas.next() : DriveApp.createFolder(CARPETA_COPIAS);
}

// Consulta de las copias que hay en la carpeta (26/09/2026), para la
// pestaña "Copias de seguridad" de la app. Solo LEE la carpeta: no crea,
// no borra y no toca la hoja de cálculo. Si la carpeta aún no existe,
// devuelve la lista vacía sin crearla. Las copias en la papelera no
// cuentan. Van de la más reciente a la más antigua.
function infoCopias() {
  const encontradas = DriveApp.getFoldersByName(CARPETA_COPIAS);
  const copias = [];
  if (encontradas.hasNext()) {
    const archivos = encontradas.next().getFiles();
    while (archivos.hasNext()) {
      const f = archivos.next();
      if (f.isTrashed()) continue;
      copias.push({ nombre: f.getName(), creada: f.getDateCreated() });
    }
  }
  copias.sort(function (a, b) { return b.creada - a.creada; });
  return {
    status: 'success',
    conservar: COPIAS_A_CONSERVAR,
    copias: copias.map(function (c) {
      return { nombre: c.nombre, fecha: Utilities.formatDate(c.creada, zonaHoraria(), 'yyyy-MM-dd HH:mm') };
    })
  };
}

// Pone formato de número normal a toda columna "id" o "id_..." de cada
// pestaña. No cambia ningún dato, solo cómo se muestra.
function repararFormatoIds() {
  Object.keys(SHEETS).forEach(function (nombreLogico) {
    const hoja = abrirLibro().getSheetByName(SHEETS[nombreLogico]);
    if (!hoja) return;
    const filas = Math.max(hoja.getMaxRows() - 1, 1);
    obtenerCabeceras(hoja).forEach(function (cab, i) {
      if (esColumnaId(cab)) hoja.getRange(2, i + 1, filas, 1).setNumberFormat('0');
    });
  });
}

// ============================================================
// 9.1 ARCHIVAR AÑOS ANTIGUOS (28/09/2026)
// ============================================================
// La app (Configuración → Copias de seguridad) decide qué registros se
// archivan y manda sus ids: solo lo que va en el Excel anual de esos años
// (facturas activas, compras activas, apuntes y trimestres de Impuestos),
// con lo que va unido siempre junto (cada factura con su apunte de cobro
// o de pago, cada trimestre con sus apuntes de pago). Antes de llamar
// aquí, la app ya ha descargado el Excel anual de cada año.
//
// Aquí, con el cerrojo puesto y ANTES de tocar nada, se comprueba todo:
//   · que el año pedido no esté protegido (el en curso y los 5 anteriores);
//   · que cada id exista y sea de ese año o anterior;
//   · que no se separe nada de lo que va unido.
// Si algo no cuadra, no se toca nada y se devuelve el motivo.
//
// Después, por este orden:
//   1. Copia de seguridad completa en Drive (la de siempre; cuenta dentro
//      de las 4 que se conservan).
//   2. Hoja nueva en la carpeta "Cuentas - Archivo", con las mismas
//      pestañas y columnas que esta, y dentro las filas tal cual (mismos
//      valores y formatos). Se comprueba que se han escrito todas; si no,
//      esa hoja va a la papelera y no se quita nada de aquí.
//   3. Solo entonces se quitan esas filas de esta hoja. Las demás se
//      quedan en el mismo orden, con sus valores y formatos.
//   4. Se actualizan las marcas: cada dispositivo se descarga esas hojas
//      de nuevo en su siguiente sincronización.
//
// Para recuperar algo: abrir la hoja de archivo y copiar las filas a la
// pestaña del mismo nombre de esta hoja (las columnas son las mismas).

function archivarAnios(hastaRecibido, idsRecibidos) {
  const hasta = parseInt(hastaRecibido, 10);
  const anioActual = parseInt(Utilities.formatDate(new Date(), zonaHoraria(), 'yyyy'), 10);
  const maximo = anioActual - ANIOS_PROTEGIDOS - 1;
  if (!(hasta > 1990)) throw new Error('Año no válido para archivar.');
  if (hasta > maximo) {
    throw new Error('No se puede archivar ' + hasta + ': se conservan siempre el año en curso y los ' +
      ANIOS_PROTEGIDOS + ' anteriores. Lo más reciente que se puede archivar es ' + maximo + '.');
  }

  // --- Lectura de las cuatro hojas y de los ids pedidos ---
  const tablas = {};
  let hayAlgo = false;
  HOJAS_ARCHIVABLES.forEach(function (nombre) {
    const hoja = obtenerHojaFisica(nombre);
    const cabeceras = obtenerCabeceras(hoja);
    const n = Math.max(hoja.getLastRow() - 1, 0);
    const rango = n > 0 ? hoja.getRange(2, 1, n, cabeceras.length) : null;
    const valores = rango ? rango.getValues() : [];
    const formatos = rango ? rango.getNumberFormats() : [];
    const colId = cabeceras.indexOf('id');
    if (colId === -1) throw new Error('La pestaña "' + SHEETS[nombre] + '" no tiene columna id.');

    const filaDeId = {};
    valores.forEach(function (fila, i) {
      const id = String(fila[colId]);
      if (id !== '') filaDeId[id] = i;
    });

    const pedidos = {};
    ((idsRecibidos && idsRecibidos[nombre]) || []).forEach(function (id) { pedidos[String(id)] = true; });
    if (Object.keys(pedidos).length > 0) hayAlgo = true;

    tablas[nombre] = {
      hoja: hoja, cabeceras: cabeceras, valores: valores, formatos: formatos,
      n: n, filaDeId: filaDeId, pedidos: pedidos
    };
  });
  if (!hayAlgo) throw new Error('No hay nada que archivar.');

  const col = function (tabla, fila, columna) {
    const j = tabla.cabeceras.indexOf(columna);
    return j === -1 ? '' : fila[j];
  };
  const anioDeFila = function (nombre, fila) {
    const t = tablas[nombre];
    if (nombre === 'impuestos') return parseInt(col(t, fila, 'año'), 10) || 0;
    const f = col(t, fila, 'fecha');
    if (Object.prototype.toString.call(f) === '[object Date]') return parseInt(Utilities.formatDate(f, zonaHoraria(), 'yyyy'), 10);
    const m = String(f || '').match(/^(\d{4})-\d{2}-\d{2}/);
    return m ? parseInt(m[1], 10) : 0;
  };
  const pedido = function (nombre, id) { return !!tablas[nombre].pedidos[String(id)]; };
  const existe = function (nombre, id) { return tablas[nombre].filaDeId[String(id)] !== undefined; };

  // --- Comprobaciones: si algo no cuadra, no se toca nada ---
  HOJAS_ARCHIVABLES.forEach(function (nombre) {
    const t = tablas[nombre];
    Object.keys(t.pedidos).forEach(function (id) {
      if (!existe(nombre, id)) throw new Error('No se encuentra ' + id + ' en "' + SHEETS[nombre] + '". Sincroniza y vuelve a intentarlo.');
      const a = anioDeFila(nombre, t.valores[t.filaDeId[id]]);
      if (!(a > 1990) || a > hasta) throw new Error('El registro ' + id + ' es de ' + (a || 'una fecha no válida') + ', posterior a ' + hasta + '.');
    });
  });

  // Nada de lo que va unido puede quedar separado.
  const apuntes = tablas.apuntes;
  apuntes.valores.forEach(function (fila) {
    const idApunte = String(col(apuntes, fila, 'id'));
    const archivado = pedido('apuntes', idApunte);
    [['ventas', 'id_factura_venta'], ['compras', 'id_factura_compra'], ['impuestos', 'id_impuesto']].forEach(function (par) {
      const idDueno = String(col(apuntes, fila, par[1]) || '');
      if (!idDueno) return;
      const duenoArchivado = pedido(par[0], idDueno);
      // Si el dueño se archiva, su apunte también; y un apunte unido a un
      // dueño que se queda, se queda también.
      if (duenoArchivado !== archivado && (duenoArchivado || existe(par[0], idDueno))) {
        throw new Error('El apunte ' + idApunte + ' y su registro unido (' + idDueno + ') no se pueden separar. Sincroniza y vuelve a intentarlo.');
      }
    });
  });

  // --- 1. Copia de seguridad completa, la de siempre ---
  copiaDeSeguridad();

  // --- 2. Hoja de archivo con las filas tal cual ---
  const ahora = Utilities.formatDate(new Date(), zonaHoraria(), 'yyyy-MM-dd HH.mm');
  const nombreArchivo = 'Cuentas - Archivo hasta ' + hasta + ' (' + ahora + ')';
  const archivo = SpreadsheetApp.create(nombreArchivo);
  const archivoDrive = DriveApp.getFileById(archivo.getId());
  const cuentas = {};
  try {
    archivoDrive.moveTo(carpetaDeArchivo());

    const leeme = archivo.getSheets()[0];
    leeme.setName('LEEME');
    leeme.getRange(1, 1, 5, 1).setValues([
      ['Registros archivados desde la app Cuentas el ' + ahora.replace(' ', ' a las ').replace('.', ':') + '.'],
      ['Años archivados: ' + hasta + ' y anteriores.'],
      ['Cada pestaña tiene las mismas columnas que la del mismo nombre en tu hoja principal.'],
      ['Para recuperar algo, copia sus filas a esa pestaña de la hoja principal.'],
      ['Los presupuestos, contactos, plantillas y configuración no se archivan nunca.']
    ]);

    HOJAS_ARCHIVABLES.forEach(function (nombre) {
      const t = tablas[nombre];
      const valores = [];
      const formatos = [];
      t.valores.forEach(function (fila, i) {
        if (pedido(nombre, fila[t.cabeceras.indexOf('id')])) {
          valores.push(fila);
          formatos.push(t.formatos[i]);
        }
      });
      const destino = archivo.insertSheet(SHEETS[nombre]);
      destino.getRange(1, 1, 1, t.cabeceras.length).setValues([t.cabeceras]);
      if (valores.length > 0) {
        if (destino.getMaxRows() < valores.length + 1) destino.insertRowsAfter(destino.getMaxRows(), valores.length + 1 - destino.getMaxRows());
        if (destino.getMaxColumns() < t.cabeceras.length) destino.insertColumnsAfter(destino.getMaxColumns(), t.cabeceras.length - destino.getMaxColumns());
        const rango = destino.getRange(2, 1, valores.length, t.cabeceras.length);
        rango.setNumberFormats(formatos);
        rango.setValues(valores);
      }
      cuentas[nombre] = valores.length;
    });
    SpreadsheetApp.flush();

    // Se comprueba que se ha escrito todo antes de quitar nada.
    HOJAS_ARCHIVABLES.forEach(function (nombre) {
      const escritas = Math.max(archivo.getSheetByName(SHEETS[nombre]).getLastRow() - 1, 0);
      if (escritas !== cuentas[nombre]) throw new Error('La hoja de archivo no se ha escrito entera (' + SHEETS[nombre] + ').');
    });
  } catch (err) {
    try { archivoDrive.setTrashed(true); } catch (e) { /* se ignora */ }
    throw new Error('No se ha archivado nada: ' + (err && err.message ? err.message : err));
  }

  // --- 3. Se quitan esas filas de esta hoja ---
  // Primero los apuntes y después sus dueños (facturas, compras,
  // trimestres). Si algo fallara a mitad, lo que quede se repara solo:
  // una factura cobrada o un trimestre pagado sin su apunte recupera el
  // apunte en la siguiente sincronización (reconciliadores de la app), y
  // todo sigue además en el archivo y en la copia de seguridad.
  try {
    ['apuntes', 'ventas', 'compras', 'impuestos'].forEach(function (nombre) {
      const t = tablas[nombre];
      if (!cuentas[nombre]) return;
      const colIdQuita = t.cabeceras.indexOf('id');
      const quedanValores = [];
      const quedanFormatos = [];
      t.valores.forEach(function (fila, i) {
        if (!pedido(nombre, fila[colIdQuita])) {
          quedanValores.push(fila);
          quedanFormatos.push(t.formatos[i]);
        }
      });
      if (quedanValores.length > 0) {
        const rango = t.hoja.getRange(2, 1, quedanValores.length, t.cabeceras.length);
        rango.setNumberFormats(quedanFormatos);
        rango.setValues(quedanValores);
      }
      const sobran = t.n - quedanValores.length;
      if (sobran > 0) {
        t.hoja.getRange(2 + quedanValores.length, 1, sobran, t.cabeceras.length).clearContent().clearFormat();
      }
      // --- 4. Marca: los dispositivos se descargan esta hoja de nuevo ---
      actualizarMarca(nombre);
      SpreadsheetApp.flush();
    });
  } catch (err) {
    throw new Error('Se ha creado el archivo «' + nombreArchivo + '», pero no se han podido quitar todos ' +
      'los registros de la hoja principal (' + (err && err.message ? err.message : err) + '). No se ha perdido ' +
      'nada: está todo en el archivo y en la copia de seguridad. Sincroniza y vuelve a entrar en esta pestaña.');
  }

  return {
    status: 'success',
    archivo: { nombre: nombreArchivo, url: archivo.getUrl() },
    archivados: cuentas
  };
}

function carpetaDeArchivo() {
  const encontradas = DriveApp.getFoldersByName(CARPETA_ARCHIVO);
  return encontradas.hasNext() ? encontradas.next() : DriveApp.createFolder(CARPETA_ARCHIVO);
}

// ============================================================
// 10. SALIDA JSON
// ============================================================

function salidaJson(objeto) {
  return ContentService
    .createTextOutput(JSON.stringify(objeto))
    .setMimeType(ContentService.MimeType.JSON);
}
