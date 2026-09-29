/**
 * MÓDULO PDF DE DOCUMENTOS (Presupuesto y Factura de venta) — 29/09/2026
 * ------------------------------------------------------------
 * Genera el PDF de cliente de Presupuestos y Facturas de venta y lo
 * GUARDA EN GOOGLE DRIVE, en la carpeta que le toca:
 *
 *     carpeta madre › año › Ventas | Presupuestos › F2026-0007 - Cliente.pdf
 *
 * El año es el de la fecha de emisión. Si el mismo documento se vuelve
 * a generar, el archivo anterior se sustituye. Las facturas de compra
 * NO generan PDF (siguen guardándose a mano) y los Informes siguen con
 * su sistema anterior (segundo paso).
 *
 * El dibujo del PDF vive en mod-pdf-motor.js. Este módulo se ocupa de:
 *   1. Avisar si la descripción no cabe entera en la hoja (aviso exacto,
 *      ya no una estimación).
 *   2. Guardar el PDF en el dispositivo ANTES de enviarlo (IndexedDB), para
 *      que nunca se pierda: si no hay conexión o falla el envío, queda
 *      pendiente y se reenvía solo (al volver la conexión, al volver a
 *      abrir la app o cada par de minutos).
 *   3. Enviarlo al backend (acción guardar_pdf de Código.gs).
 *   4. Avisar del resultado con «Abrir en Drive» y «Descargar».
 *
 * Los PDF pendientes NO usan el sistema de pendientes de los registros
 * (localStorage): un PDF es un archivo y no cabe ahí.
 */

// ============================================================
// 1. PDF PENDIENTES EN EL DISPOSITIVO (IndexedDB)
// ============================================================

const PDF_DB_NOMBRE = 'cuentas_pdf_v1';
const PDF_DB_ALMACEN = 'pendientes';

function pdfDbAbrir() {
  return new Promise(function (ok, ko) {
    if (!window.indexedDB) { ko(new Error('Este navegador no permite guardar archivos en el dispositivo.')); return; }
    const peticion = indexedDB.open(PDF_DB_NOMBRE, 1);
    peticion.onupgradeneeded = function () { peticion.result.createObjectStore(PDF_DB_ALMACEN, { keyPath: 'clave' }); };
    peticion.onsuccess = function () { ok(peticion.result); };
    peticion.onerror = function () { ko(peticion.error); };
  });
}

function pdfDbOperar(modo, operacion) {
  return pdfDbAbrir().then(function (db) {
    return new Promise(function (ok, ko) {
      const tx = db.transaction(PDF_DB_ALMACEN, modo);
      const almacen = tx.objectStore(PDF_DB_ALMACEN);
      const peticion = operacion(almacen);
      tx.oncomplete = function () { db.close(); ok(peticion ? peticion.result : undefined); };
      tx.onerror = function () { db.close(); ko(tx.error); };
      tx.onabort = function () { db.close(); ko(tx.error); };
    });
  });
}

function pdfDbGuardar(item) { return pdfDbOperar('readwrite', function (a) { return a.put(item); }); }
function pdfDbBorrar(clave) { return pdfDbOperar('readwrite', function (a) { return a.delete(clave); }); }
function pdfDbLista() { return pdfDbOperar('readonly', function (a) { return a.getAll(); }); }

// ============================================================
// 2. ENVÍO A DRIVE
// ============================================================

function pdfDocABase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

// Envía un PDF pendiente. Devuelve { url, ruta } o lanza un error.
async function pdfDocEnviar(item) {
  if (navigator.onLine === false) throw new Error('Sin conexión.');
  const resultado = await llamarBackend({
    action: 'guardar_pdf',
    tipo: item.carpeta,
    anio: item.anio,
    nombre: item.nombre,
    pdf: pdfDocABase64(item.datos)
  });
  if (!resultado || resultado.status !== 'success') {
    throw new Error((resultado && resultado.message) || 'No se pudo guardar en Drive.');
  }
  return { url: resultado.url, ruta: resultado.ruta || (item.anio + ' › ' + item.carpeta) };
}

// Claves de los PDF que se están enviando ahora mismo (para que el
// reenvío automático no duplique el envío).
const pdfDocEnCurso = {};
let pdfDocReenviando = false;

async function pdfDocReintentar() {
  if (pdfDocReenviando) return;
  if (typeof haySesion === 'function' && !haySesion()) return;
  if (navigator.onLine === false) return;
  pdfDocReenviando = true;
  try {
    const lista = await pdfDbLista();
    for (let i = 0; i < lista.length; i++) {
      const item = lista[i];
      if (pdfDocEnCurso[item.clave]) continue;
      pdfDocEnCurso[item.clave] = true;
      try {
        const r = await pdfDocEnviar(item);
        await pdfDbBorrar(item.clave);
        pdfDocAviso({ estado: 'ok', titulo: 'Guardado en Drive', detalle: r.ruta + ' › ' + item.nombre, url: r.url, blob: new Blob([item.datos], { type: 'application/pdf' }), nombre: item.nombre });
      } catch (err) {
        console.warn('El PDF sigue pendiente:', item.nombre, err);
      } finally {
        delete pdfDocEnCurso[item.clave];
      }
    }
  } catch (err) {
    console.warn('No se pudo revisar los PDF pendientes:', err);
  } finally {
    pdfDocReenviando = false;
  }
}

// ============================================================
// 3. AVISO DE RESULTADO
// ============================================================
// Una tarjeta negra abajo, sin bloquear la pantalla. Estados:
//   trabajando · ok (con «Abrir en Drive» y «Descargar») · pendiente · error

let pdfDocTemporizadorAviso = null;

function pdfDocAvisoCerrar() {
  clearTimeout(pdfDocTemporizadorAviso);
  const a = document.getElementById('pdf-aviso');
  if (a) a.remove();
}

function pdfDocDescargar(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
}

function pdfDocAviso(opciones) {
  pdfDocAvisoCerrar();
  const iconos = {
    trabajando: 'ti-loader-2',
    ok: 'ti-circle-check',
    pendiente: 'ti-clock',
    error: 'ti-alert-triangle'
  };
  const caja = document.createElement('div');
  caja.id = 'pdf-aviso';
  caja.className = 'pdf-aviso pdf-aviso-' + opciones.estado;
  caja.setAttribute('role', 'status');
  caja.innerHTML =
    '<i class="ti ' + iconos[opciones.estado] + ' pdf-aviso-icono" aria-hidden="true"></i>' +
    '<div class="pdf-aviso-cuerpo">' +
      '<p class="pdf-aviso-titulo" id="pdf-aviso-texto">' + escaparHtml(opciones.titulo) + '</p>' +
      (opciones.detalle ? '<p class="pdf-aviso-detalle" id="pdf-aviso-detalle">' + escaparHtml(opciones.detalle) + '</p>' : '') +
      ((opciones.url || opciones.blob)
        ? '<div class="pdf-aviso-botones">' +
            (opciones.url ? '<a class="pdf-aviso-boton" id="pdf-aviso-abrir" href="' + escaparHtml(opciones.url) + '" target="_blank" rel="noopener">Abrir en Drive</a>' : '') +
            (opciones.blob ? '<button type="button" class="pdf-aviso-boton" id="pdf-aviso-descargar">Descargar</button>' : '') +
          '</div>'
        : '') +
    '</div>' +
    (opciones.estado === 'trabajando' ? '' : '<button type="button" class="pdf-aviso-cerrar" id="pdf-aviso-cerrar" aria-label="Cerrar"><i class="ti ti-x"></i></button>');
  document.body.appendChild(caja);

  const cerrar = caja.querySelector('#pdf-aviso-cerrar');
  if (cerrar) cerrar.addEventListener('click', pdfDocAvisoCerrar);
  const descargar = caja.querySelector('#pdf-aviso-descargar');
  if (descargar) descargar.addEventListener('click', function () { pdfDocDescargar(opciones.blob, opciones.nombre || 'documento.pdf'); });

  if (opciones.estado === 'ok') {
    pdfDocTemporizadorAviso = setTimeout(pdfDocAvisoCerrar, 15000);
  }
}

// ============================================================
// 4. GENERAR Y GUARDAR
// ============================================================

let pdfDocOcupado = false;

function pdfDocCarpetaDe(tipo) {
  return tipo === 'factura' ? 'Ventas' : 'Presupuestos';
}

async function pdfDocAbrir(registro, contacto, tipo) {
  if (pdfDocOcupado) return;
  pdfDocOcupado = true;
  try {
    pdfDocAviso({ estado: 'trabajando', titulo: 'Generando el PDF…' });
    const pdf = await pdfMotorGenerar(registro, contacto, tipo);

    if (pdf.recortado) {
      pdfDocAvisoCerrar();
      const eleccion = await mostrarDialogoOpciones(
        'La descripción no cabe entera',
        'Los presupuestos y facturas se generan siempre en una sola página, y el texto que sobra no se vería. ' +
        'Puedes cancelar y acortar la descripción, o guardar el PDF tal como queda.',
        [
          { id: 'seguir', texto: 'Guardar así', tipo: 'principal' },
          { id: 'cancelar', texto: 'Cancelar' }
        ]
      );
      if (eleccion !== 'seguir') return;
      pdfDocAviso({ estado: 'trabajando', titulo: 'Guardando el PDF…' });
    }

    const item = {
      clave: tipo + '|' + (registro.id || pdf.nombre),
      carpeta: pdfDocCarpetaDe(tipo),
      anio: pdf.anio,
      nombre: pdf.nombre,
      datos: await pdf.blob.arrayBuffer(),
      creado: Date.now()
    };

    // 1.º se apunta en el dispositivo; 2.º se envía. Si el paso 1 falla
    // (navegador sin almacenamiento), se envía igualmente y, si tampoco
    // hay conexión, queda la descarga como salvavidas.
    let apuntado = true;
    try { await pdfDbGuardar(item); } catch (err) { apuntado = false; console.warn('No se pudo apuntar el PDF en el dispositivo:', err); }

    pdfDocEnCurso[item.clave] = true;
    try {
      const r = await pdfDocEnviar(item);
      if (apuntado) { try { await pdfDbBorrar(item.clave); } catch (e) { /* se ignora */ } }
      pdfDocAviso({ estado: 'ok', titulo: 'Guardado en Drive', detalle: r.ruta + ' › ' + pdf.nombre, url: r.url, blob: pdf.blob, nombre: pdf.nombre });
    } catch (err) {
      console.warn('El PDF queda pendiente de enviar a Drive:', err);
      pdfDocAviso({
        estado: 'pendiente',
        titulo: 'Pendiente de enviar a Drive',
        detalle: (apuntado ? 'Se enviará solo cuando haya conexión. ' : 'No se pudo apuntar en este dispositivo: descárgalo ahora. ') + pdf.nombre,
        blob: pdf.blob,
        nombre: pdf.nombre
      });
    } finally {
      delete pdfDocEnCurso[item.clave];
    }
  } catch (err) {
    console.error('No se pudo generar el PDF:', err);
    pdfDocAviso({ estado: 'error', titulo: 'No se pudo generar el PDF', detalle: String(err && err.message || err) });
  } finally {
    pdfDocOcupado = false;
  }
}

// Puntos de entrada usados desde mod-presupuestos.js y
// mod-facturas-venta.js (sin cambios de nombre).
function pdfDocAbrirPresupuesto(id) {
  const p = estado.presupuestos.find(function (x) { return String(x.id) === String(id); });
  if (!p) { alert('No se ha encontrado el presupuesto.'); return; }
  pdfDocAbrir(p, preClienteDe(p), 'presupuesto');
}

function pdfDocAbrirFactura(id) {
  const f = estado.ventas.find(function (x) { return String(x.id) === String(id); });
  if (!f) { alert('No se ha encontrado la factura.'); return; }
  pdfDocAbrir(f, fvClienteDe(f), 'factura');
}

// ============================================================
// 5. «ABRIR EN DRIVE» DESDE EL MENÚ
// ============================================================
// La hoja no guarda el enlace del PDF, así que se busca en Drive por su
// nombre (mismo nombre y año que al generarlo). Sirve para volver a abrir
// un PDF ya guardado sin generarlo de nuevo.

async function pdfDocBuscarEnDrive(registro, contacto, tipo) {
  const nombre = pdfMotorNombreDe(registro, contacto);
  const anio = pdfMotorAnio(registro);
  const carpeta = pdfDocCarpetaDe(tipo);
  const clave = tipo + '|' + (registro.id || nombre);

  pdfDocAviso({ estado: 'trabajando', titulo: 'Buscando en Drive…' });
  try {
    const pendientes = await pdfDbLista();
    const pendiente = pendientes.find(function (p) { return p.clave === clave; });
    if (pendiente) {
      pdfDocAviso({
        estado: 'pendiente', titulo: 'Pendiente de enviar a Drive',
        detalle: 'Aún no ha llegado a Drive. Se enviará solo cuando haya conexión. ' + nombre,
        blob: new Blob([pendiente.datos], { type: 'application/pdf' }), nombre: nombre
      });
      return;
    }
    const r = await llamarBackend({ action: 'url_pdf', tipo: carpeta, anio: anio, nombre: nombre });
    if (r && r.status === 'success' && r.url) {
      pdfDocAviso({ estado: 'ok', titulo: 'PDF en Drive', detalle: anio + ' › ' + carpeta + ' › ' + nombre, url: r.url });
    } else if (r && r.status === 'success') {
      pdfDocAviso({ estado: 'error', titulo: 'Todavía no hay PDF en Drive', detalle: 'Genera el PDF de este documento y se guardará en ' + anio + ' › ' + carpeta + '.' });
    } else {
      throw new Error((r && r.message) || 'No se pudo consultar Drive.');
    }
  } catch (err) {
    pdfDocAviso({ estado: 'error', titulo: 'No se pudo consultar Drive', detalle: String(err && err.message || err) });
  }
}

function pdfDocAbrirEnDrivePresupuesto(id) {
  const p = estado.presupuestos.find(function (x) { return String(x.id) === String(id); });
  if (p) pdfDocBuscarEnDrive(p, preClienteDe(p), 'presupuesto');
}

function pdfDocAbrirEnDriveFactura(id) {
  const f = estado.ventas.find(function (x) { return String(x.id) === String(id); });
  if (f) pdfDocBuscarEnDrive(f, fvClienteDe(f), 'factura');
}

// ============================================================
// 6. REENVÍO AUTOMÁTICO DE LO PENDIENTE
// ============================================================

window.addEventListener('online', function () { setTimeout(pdfDocReintentar, 1500); });
document.addEventListener('visibilitychange', function () {
  if (document.visibilityState === 'visible') setTimeout(pdfDocReintentar, 1500);
});
setInterval(pdfDocReintentar, 120000);
setTimeout(pdfDocReintentar, 6000);
