/**
 * MÓDULO CONFIGURACIÓN
 * ------------------------------------------------------------
 * 5 pestañas sobre la hoja "configuracion" (clave/valor). Cada
 * guardado envía SIEMPRE la configuración completa (decisión
 * documentada en el mapa 5.3), no solo la pestaña abierta.
 */

// ============================================================
// 0. ESTADO PROPIO DEL MÓDULO (no vive en el núcleo)
// ============================================================

const CONFIG_PESTANAS = [
  { id: 'mis-datos', titulo: 'Mis datos' },
  { id: 'impuestos-config', titulo: 'Impuestos y retenciones' },
  { id: 'params-calculadora', titulo: 'Parámetros de la calculadora' },
  { id: 'series', titulo: 'Numeración y series' },
  { id: 'textos', titulo: 'Textos de presupuestos y facturas' },
  { id: 'copias', titulo: 'Copias de seguridad' }
];

let configPestanaActiva = 'mis-datos';

// ============================================================
// 1. UTILIDADES DE CONFIGURACIÓN
// ============================================================

function cfgTexto(clave) {
  const v = estado.configuracion[clave];
  return v === undefined || v === null ? '' : String(v);
}

function cfgNumero(clave) {
  return parsearNumero(estado.configuracion[clave]);
}

function cfgArray(clave) {
  const v = estado.configuracion[clave];
  if (Array.isArray(v)) return v;
  if (!v) return [];
  try {
    const parseado = JSON.parse(v);
    return Array.isArray(parseado) ? parseado : [];
  } catch (err) {
    console.error('No se pudo leer el array de configuración', clave, err);
    return [];
  }
}

// Genera un id estable la primera vez que ve una fila sin id
// (decisión I2 — lo asigna la pantalla, no el backend).
function idArrayEstable(prefijo) {
  return prefijo + '-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e6).toString(36);
}

// ============================================================
// 2. PINTADO PRINCIPAL
// ============================================================

function pintarConfiguracion() {
  const contenido = document.getElementById('contenido');
  if (!contenido) return;

  contenido.innerHTML =
    '<div class="config-layout">' +
      '<nav class="config-tabs" id="config-tabs"></nav>' +
      '<div class="config-panel" id="config-panel"></div>' +
    '</div>';

  pintarPestanas();
  pintarPanelActivo();
}

function pintarPestanas() {
  const nav = document.getElementById('config-tabs');
  nav.innerHTML = CONFIG_PESTANAS.map(function (p) {
    return '<button type="button" class="config-tab' +
      (p.id === configPestanaActiva ? ' activa' : '') + '" data-tab="' + p.id + '">' +
      escaparHtml(p.titulo) + '</button>';
  }).join('');

  nav.querySelectorAll('.config-tab').forEach(function (boton) {
    boton.addEventListener('click', function () {
      configPestanaActiva = boton.dataset.tab;
      pintarPestanas();
      pintarPanelActivo();
    });
  });
}

function pintarPanelActivo() {
  const panel = document.getElementById('config-panel');
  const renderes = {
    'mis-datos': renderMisDatos,
    'impuestos-config': renderImpuestosConfig,
    'params-calculadora': renderParamsCalculadora,
    'series': renderSeries,
    'textos': renderTextos,
    'copias': renderCopias
  };
  panel.innerHTML = renderes[configPestanaActiva]();
  cablearPanelActivo(panel);
  if (configPestanaActiva === 'copias') {
    cablearCopias(panel);
    cablearArchivo(panel);   // 28/09/2026: no depende de que se pueda consultar Drive
  }
}

// ============================================================
// 3. PESTAÑA: MIS DATOS
// ============================================================
// Fusión de las antiguas "Mis Datos & Perfil" y "Datos Fiscales"
// (20/09/2026): son lo mismo — los datos con los que apareces como
// emisor en presupuestos, facturas e informes. Van en el mismo orden
// en que se imprimen en el documento.

function renderMisDatos() {
  return (
    '<h2>Mis datos</h2>' +
    '<div class="config-cartel">' +
      'Estos son los datos con los que apareces en tus presupuestos, facturas e informes.' +
    '</div>' +
    '<div class="config-grid dos-columnas">' +
      campoTexto('fiscal_nombre', 'Nombre fiscal', cfgTexto('fiscal_nombre')) +
      campoTexto('fiscal_nif', 'NIF', cfgTexto('fiscal_nif')) +
      campoTexto('fiscal_calle', 'Calle', cfgTexto('fiscal_calle')) +
      campoTexto('fiscal_numero', 'Número', cfgTexto('fiscal_numero')) +
      campoTexto('fiscal_codigo_postal', 'Código postal', cfgTexto('fiscal_codigo_postal')) +
      campoTexto('fiscal_poblacion', 'Población', cfgTexto('fiscal_poblacion')) +
      campoTexto('fiscal_provincia', 'Provincia', cfgTexto('fiscal_provincia')) +
      campoTexto('perfil_telefono', 'Teléfono', cfgTexto('perfil_telefono')) +
      campoTexto('perfil_email', 'Email', cfgTexto('perfil_email'), 'email') +
      // IBAN (26/09/2026): solo lo usa la pantalla "Mis datos" para
      // copiarlo o compartirlo. En los PDF sigue saliendo desde el
      // texto del pie de factura (decisión M3), no desde aquí.
      campoTexto('fiscal_iban', 'IBAN (para cobros)', cfgTexto('fiscal_iban')) +
    '</div>' +
    '<div class="direccion-preview" id="direccion-preview">' + escaparHtml(construirDireccionPreview()) + '</div>' +
    piePanelGuardar()
  );
}

function construirDireccionPreview() {
  const calle = cfgTexto('fiscal_calle'), numero = cfgTexto('fiscal_numero');
  const cp = cfgTexto('fiscal_codigo_postal'), poblacion = cfgTexto('fiscal_poblacion'), provincia = cfgTexto('fiscal_provincia');
  const linea1 = [calle, numero].filter(Boolean).join(' ');
  const linea2 = [cp, poblacion].filter(Boolean).join(' ');
  return [linea1, linea2 + (provincia ? ' (' + provincia + ')' : '')].filter(Boolean).join(', ') || 'Sin dirección todavía';
}

// ============================================================
// 4. PESTAÑA: IMPUESTOS Y RETENCIONES
// ============================================================

function renderImpuestosConfig() {
  return (
    '<h2>Impuestos y retenciones</h2>' +
    '<div class="campo-grupo">' +
      '<label>Tipos de IVA</label>' +
      renderArrayEditor('iva', [
        { campo: 'nombre', tipo: 'texto', placeholder: 'Nombre' },
        { campo: 'porcentaje', tipo: 'numero', placeholder: '%' }
      ]) +
    '</div>' +
    '<div class="campo-grupo">' +
      '<label>Tipos de IRPF</label>' +
      renderArrayEditor('irpf', [
        { campo: 'nombre', tipo: 'texto', placeholder: 'Nombre' },
        { campo: 'porcentaje', tipo: 'numero', placeholder: '%' }
      ]) +
    '</div>' +
    '<div class="config-grid">' +
      campoTexto('compensacion_irpf', 'Compensación de IRPF (%)', cfgTexto('compensacion_irpf') || '20', 'numero') +
    '</div>' +
    '<p class="config-nota">Este porcentaje afecta a la vez a la Calculadora/Presupuestos (para compensar la retención) y a la estimación trimestral en Impuestos. Si lo cambias, cambia en los dos sitios.</p>' +
    piePanelGuardar()
  );
}

// ============================================================
// 5. PESTAÑA: PARÁMETROS CALCULADORA
// ============================================================

function renderParamsCalculadora() {
  return (
    '<h2>Parámetros de la calculadora</h2>' +
    '<div class="config-grid dos-columnas">' +
      campoTexto('precio_hora_trabajo', 'Precio hora de trabajo (€)', cfgTexto('precio_hora_trabajo'), 'numero') +
      campoTexto('precio_hora_edicion', 'Precio hora de edición (€)', cfgTexto('precio_hora_edicion'), 'numero') +
      campoTexto('precio_hora_desplazamiento', 'Precio hora de desplazamiento (€)', cfgTexto('precio_hora_desplazamiento'), 'numero') +
      campoTexto('precio_km', 'Precio por km (€)', cfgTexto('precio_km'), 'numero') +
      campoTexto('incremento_noche', 'Incremento noche/festivo (%)', cfgTexto('incremento_noche'), 'numero') +
      campoTexto('margen_otros_gastos', 'Margen otros gastos (%)', cfgTexto('margen_otros_gastos'), 'numero') +
    '</div>' +

    '<div class="campo-grupo">' +
      '<label>Tipos de cliente</label>' +
      renderArrayEditor('tiposCliente', [
        { campo: 'etiqueta', tipo: 'texto', placeholder: 'Nombre visible' },
        { campo: 'nombre', tipo: 'texto', placeholder: 'Código', soloLectura: true },
        { campo: 'ajuste', tipo: 'numero', placeholder: 'Ajuste %' }
      ]) +
      '<p class="config-nota">El "Código" identifica al tipo de cliente de forma interna: no lo cambies una vez que lo estés usando.</p>' +
    '</div>' +

    '<div class="campo-grupo">' +
      '<label>Equipos</label>' +
      renderArrayEditor('equipos', [
        { campo: 'nombre', tipo: 'texto', placeholder: 'Equipo' },
        { campo: 'precio', tipo: 'numero', placeholder: '€' }
      ]) +
    '</div>' +

    '<div class="campo-grupo">' +
      '<label>Servicios extra</label>' +
      renderArrayEditor('serviciosExtra', [
        { campo: 'nombre', tipo: 'texto', placeholder: 'Servicio' },
        { campo: 'tipo', tipo: 'seleccion', opciones: [['importe', 'Importe'], ['porcentaje', 'Porcentaje']] },
        { campo: 'valor', tipo: 'numero', placeholder: 'Valor' }
      ]) +
    '</div>' +

    piePanelGuardar()
  );
}

// ============================================================
// 6. PESTAÑA: SERIES (informativa, sin cambios — decisión M2)
// ============================================================

function renderSeries() {
  return (
    '<h2>Numeración y series</h2>' +
    '<div class="config-cartel">' +
      'Por ahora solo usas una serie de numeración (F/P + año + número). ' +
      'Cuando necesites una segunda actividad con numeración independiente, se activará aquí.' +
    '</div>'
  );
}

// ============================================================
// 7. PESTAÑA: TEXTOS
// ============================================================

function renderTextos() {
  return (
    '<h2>Textos de presupuestos y facturas</h2>' +
    '<div class="campo-grupo">' +
      '<label>Pie del PDF de presupuesto</label>' +
      renderRichEditor('texto_pie_presupuesto', cfgTexto('texto_pie_presupuesto')) +
    '</div>' +
    '<div class="campo-grupo">' +
      '<label>Pie del PDF de factura</label>' +
      renderRichEditor('texto_pie_factura', cfgTexto('texto_pie_factura')) +
    '</div>' +
    piePanelGuardar()
  );
}


// ============================================================
// 7.1 PESTAÑA: COPIAS DE SEGURIDAD (26/09/2026)
// ============================================================
// Solo consulta y lanza la copia que ya existía en Código.gs (cada 14
// días, se conservan 4). Nada de esta pestaña toca los datos de la
// hoja. Las copias hechas desde aquí cuentan dentro de las 4 que se
// conservan (decisión del propietario, 26/09/2026).
//
// "Hacer copia ahora" va con UN solo intento, sin el reintento
// automático de llamarBackend(): si la respuesta tardara, repetirla
// haría dos copias y mandaría a la papelera una copia buena de más.

function renderCopias() {
  return (
    '<h2>Copias de seguridad</h2>' +
    '<div class="config-cartel config-cartel-izquierda">' +
      'Cada 14 días se hace sola una copia completa de tu hoja de cálculo en tu Google Drive, ' +
      'en la carpeta «Cuentas - Copias de seguridad». Se conservan las 4 más recientes, contando ' +
      'también las que hagas desde aquí; las más antiguas van a la papelera de Drive, donde se ' +
      'pueden recuperar durante 30 días.' +
    '</div>' +
    '<div class="copias-info" id="copias-info"><p class="copias-cargando">Consultando tu Drive...</p></div>' +
    '<div class="config-guardar">' +
      '<button type="button" class="boton-secundario" id="btn-copia-ahora" disabled>Hacer copia ahora</button>' +
    '</div>' +
    renderArchivo()
  );
}

function copiasFechaLegible(texto) {
  // Llega como "AAAA-MM-DD HH:mm" (hora de España, la del script).
  const m = String(texto || '').match(/^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}))?/);
  if (!m) return '—';
  const h = fechaHoyISO().split('-');
  const dias = Math.round((new Date(+h[0], h[1] - 1, +h[2]) - new Date(+m[1], m[2] - 1, +m[3])) / 86400000);
  const cuando = dias <= 0 ? 'hoy' : dias === 1 ? 'ayer' : 'hace ' + dias + ' días';
  return m[3] + '/' + m[2] + '/' + m[1] + (m[4] ? ' a las ' + m[4] + ':' + m[5] : '') + ' (' + cuando + ')';
}

function copiasPintarInfo(respuesta) {
  const caja = document.getElementById('copias-info');
  if (!caja) return;
  const copias = (respuesta && respuesta.copias) || [];
  if (copias.length === 0) {
    caja.innerHTML = '<p class="copias-linea">Todavía no hay ninguna copia en la carpeta.</p>';
    return;
  }
  caja.innerHTML =
    '<div class="copias-linea"><span>Última copia</span><strong>' + escaparHtml(copiasFechaLegible(copias[0].fecha)) + '</strong></div>' +
    '<div class="copias-linea"><span>Copias guardadas</span><strong>' + copias.length + '</strong></div>' +
    '<ul class="copias-lista">' + copias.map(function (c) {
      return '<li>' + escaparHtml(copiasFechaLegible(c.fecha)) + '</li>';
    }).join('') + '</ul>';
}

function copiasPintarError(err) {
  const caja = document.getElementById('copias-info');
  if (!caja) return;
  const texto = String((err && err.message) || err || '');
  caja.innerHTML = '<p class="copias-error">' + (texto.indexOf('Acción desconocida') !== -1
    ? 'Falta publicar la nueva versión de Código.gs en Apps Script (Implementar → Gestionar implementaciones → lápiz → Nueva versión).'
    : 'No se ha podido consultar tu Drive. Comprueba la conexión y vuelve a entrar en esta pestaña.') + '</p>';
}

async function cablearCopias(panel) {
  const boton = panel.querySelector('#btn-copia-ahora');
  try {
    const r = await llamarBackend({ action: 'info_copias' });
    if (r.status !== 'success') throw new Error(r.message || 'Fallo al consultar');
    copiasPintarInfo(r);
    if (boton) boton.disabled = false;
  } catch (err) {
    console.error('No se pudo consultar las copias:', err);
    copiasPintarError(err);
    return;
  }

  boton.addEventListener('click', async function () {
    const eleccion = await mostrarDialogoOpciones(
      'Hacer copia ahora',
      'Se hará una copia completa de tu hoja en Drive. Como se conservan las 4 más recientes, la más antigua irá a la papelera de Drive.',
      [{ id: 'cancelar', texto: 'Cancelar' }, { id: 'copiar', texto: 'Hacer copia', tipo: 'principal' }]
    );
    if (eleccion !== 'copiar') return;

    boton.disabled = true;
    boton.textContent = 'Haciendo copia...';
    try {
      const r = await unIntentoBackend({ action: 'copia_ahora' });
      if (r.code === 'clave') { cerrarSesion('La clave de acceso ya no es válida. Vuelve a introducirla.'); return; }
      if (r.status !== 'success') throw new Error(r.message || 'Fallo al hacer la copia');
      copiasPintarInfo(r);
      boton.textContent = 'Copia hecha';
      setTimeout(function () { boton.textContent = 'Hacer copia ahora'; boton.disabled = false; }, 2500);
    } catch (err) {
      console.error('No se pudo hacer la copia:', err);
      alert('No se ha podido confirmar la copia. Puede que se haya hecho igualmente: vuelve a entrar en esta pestaña para comprobarlo antes de repetirla.');
      boton.textContent = 'Hacer copia ahora';
      boton.disabled = false;
    }
  });
}

// ============================================================
// 7.2 ARCHIVAR AÑOS ANTIGUOS (28/09/2026)
// ============================================================
// Pasa a una hoja aparte de tu Drive (carpeta «Cuentas - Archivo») los
// registros de los años que elijas y los quita de la app y de la hoja
// principal, para que ocupen menos. Decisiones del propietario:
//   · Solo se archiva lo que va en el Excel anual de esos años: facturas
//     de venta y de compra activas, apuntes y trimestres de Impuestos.
//     Los apuntes de cobro, de pago y de impuestos van con su factura o
//     con su trimestre (sus datos están en el Excel: estado, fecha de
//     cobro y pagos de impuestos). Nunca se archivan presupuestos,
//     contactos, plantillas, configuración ni facturas desactivadas.
//   · Nunca se archivan el año en curso ni los 5 anteriores. Google lo
//     vuelve a comprobar en Código.gs, pida lo que pida la app.
//   · Antes de archivar: el Excel anual de cada año se descarga solo,
//     y Google hace una copia de seguridad completa en Drive.
// Lo que va unido no se separa: si una factura de un año archivado se
// cobró en un año que se conserva, se quedan las dos cosas en la app.

const ARCHIVO_ANIOS_PROTEGIDOS = 5;
const ARCHIVO_HOJAS = ['ventas', 'compras', 'apuntes', 'impuestos'];

// Año más reciente que se puede archivar (en 2026, el 2020).
function arcAnioMaximo() {
  return new Date().getFullYear() - ARCHIVO_ANIOS_PROTEGIDOS - 1;
}

function arcAnioDe(iso) {
  const f = normalizarFecha(iso);
  if (!f) return 0;
  const a = parseInt(String(f).slice(0, 4), 10);
  return a > 1990 ? a : 0;
}

function arcAnioImpuesto(r) {
  const a = parseInt(String(r['año'] || ''), 10);
  return a > 1990 ? a : 0;
}

// Qué se archivaría eligiendo «hasta» ese año (incluido). Solo lee.
// Devuelve { hasta, ids: { ventas: [...], ... }, cuenta, anios, retenidos }.
function arcSeleccion(hasta) {
  const dentro = function (a) { return a > 1990 && a <= hasta; };
  const sel = { ventas: {}, compras: {}, apuntes: {}, impuestos: {} };

  estado.ventas.forEach(function (f) {
    if (fvEstaActiva(f) && dentro(arcAnioDe(f.fecha))) sel.ventas[String(f.id)] = true;
  });
  estado.compras.forEach(function (f) {
    if (fcEstaActiva(f) && dentro(arcAnioDe(f.fecha))) sel.compras[String(f.id)] = true;
  });
  estado.impuestos.forEach(function (r) {
    if (dentro(arcAnioImpuesto(r))) sel.impuestos[String(r.id)] = true;
  });
  // Apuntes hechos a mano (los que salen en la hoja «Apuntes» del Excel).
  estado.apuntes.forEach(function (a) {
    if (a.id_factura_venta || a.id_factura_compra || a.id_impuesto) return;
    if (dentro(arcAnioDe(a.fecha))) sel.apuntes[String(a.id)] = true;
  });

  // Cada factura o trimestre se lleva sus apuntes, y solo se archiva si
  // TODOS sus apuntes son también de años que se archivan.
  let retenidos = 0;
  [['ventas', 'id_factura_venta'], ['compras', 'id_factura_compra'], ['impuestos', 'id_impuesto']].forEach(function (par) {
    Object.keys(sel[par[0]]).forEach(function (id) {
      const suyos = estado.apuntes.filter(function (a) { return String(a[par[1]] || '') === id; });
      if (suyos.every(function (a) { return dentro(arcAnioDe(a.fecha)); })) {
        suyos.forEach(function (a) { sel.apuntes[String(a.id)] = true; });
      } else {
        delete sel[par[0]][id];
        retenidos++;
      }
    });
  });

  const ids = {};
  const cuenta = {};
  let total = 0;
  ARCHIVO_HOJAS.forEach(function (h) {
    ids[h] = Object.keys(sel[h]);
    cuenta[h] = ids[h].length;
    total += ids[h].length;
  });

  // Años con algo que archivar: de cada uno se descarga su Excel anual.
  const anios = {};
  ARCHIVO_HOJAS.forEach(function (h) {
    estado[h].forEach(function (r) {
      if (!sel[h][String(r.id)]) return;
      const a = h === 'impuestos' ? arcAnioImpuesto(r) : arcAnioDe(r.fecha);
      if (a) anios[a] = true;
    });
  });

  return {
    hasta: hasta, ids: ids, cuenta: cuenta, total: total, retenidos: retenidos,
    anios: Object.keys(anios).map(Number).sort(function (a, b) { return a - b; })
  };
}

// Años con contabilidad que ya se podrían archivar (del más reciente al
// más antiguo).
function arcAniosArchivables() {
  const todos = typeof infAniosConDatos === 'function' ? infAniosConDatos() : [];
  const maximo = arcAnioMaximo();
  return todos.filter(function (a) { return a <= maximo; }).sort(function (a, b) { return b - a; });
}

function renderArchivo() {
  return (
    '<h2 class="archivo-titulo">Archivar años antiguos</h2>' +
    '<div class="config-cartel config-cartel-izquierda">' +
      'Pasa a una hoja aparte de tu Drive, en la carpeta «Cuentas - Archivo», las facturas, compras, ' +
      'apuntes e impuestos de los años que elijas, y los quita de la app para que ocupe menos. Antes ' +
      'se descarga el Excel anual de cada uno de esos años y se hace una copia de seguridad. Nunca se ' +
      'archivan el año en curso ni los ' + ARCHIVO_ANIOS_PROTEGIDOS + ' anteriores, ni los presupuestos, ' +
      'contactos o plantillas.' +
    '</div>' +
    '<div class="copias-info" id="archivo-info"></div>' +
    '<div class="config-guardar">' +
      '<button type="button" class="boton-secundario" id="btn-archivar" disabled>Archivar...</button>' +
    '</div>'
  );
}

function arcPintarInfo(panel) {
  const caja = panel.querySelector('#archivo-info');
  const boton = panel.querySelector('#btn-archivar');
  if (!caja || !boton) return null;

  const archivables = arcAniosArchivables();
  const maximo = arcAnioMaximo();
  const hoy = new Date().getFullYear();
  if (archivables.length === 0) {
    const todos = typeof infAniosConDatos === 'function' ? infAniosConDatos() : [];
    caja.innerHTML =
      '<p class="copias-linea">Todavía no hay ningún año que se pueda archivar: se conservan siempre de ' +
        (maximo + 1) + ' a ' + hoy + '.</p>' +
      (todos.length ? '<p class="copias-linea"><span>Tu contabilidad empieza en</span><strong>' + todos[0] + '</strong></p>' : '');
    boton.disabled = true;
    return null;
  }

  const select = caja.querySelector('#arc-hasta');
  const hasta = select ? parseInt(select.value, 10) : archivables[0];
  const sel = arcSeleccion(hasta);

  caja.innerHTML =
    '<div class="copias-linea archivo-elegir"><span>Archivar hasta</span>' +
      '<select class="campo archivo-select" id="arc-hasta">' +
        archivables.map(function (a) {
          return '<option value="' + a + '"' + (a === hasta ? ' selected' : '') + '>' + a + ' (incluido)</option>';
        }).join('') +
      '</select>' +
    '</div>' +
    '<div class="copias-linea"><span>Facturas de venta</span><strong>' + sel.cuenta.ventas + '</strong></div>' +
    '<div class="copias-linea"><span>Facturas de compra</span><strong>' + sel.cuenta.compras + '</strong></div>' +
    '<div class="copias-linea"><span>Apuntes (con cobros y pagos)</span><strong>' + sel.cuenta.apuntes + '</strong></div>' +
    '<div class="copias-linea"><span>Trimestres de impuestos</span><strong>' + sel.cuenta.impuestos + '</strong></div>' +
    (sel.retenidos > 0
      ? '<p class="archivo-nota">Se quedan en la app ' + sel.retenidos + (sel.retenidos === 1 ? ' factura o trimestre' : ' facturas o trimestres') +
        ' de esos años porque su cobro o su pago es de un año que se conserva.</p>'
      : '');

  caja.querySelector('#arc-hasta').addEventListener('change', function () { arcPintarInfo(panel); });
  boton.disabled = sel.total === 0;
  return sel;
}

function cablearArchivo(panel) {
  const boton = panel.querySelector('#btn-archivar');
  if (!boton) return;
  arcPintarInfo(panel);
  boton.addEventListener('click', function () { arcArchivar(panel, boton); });
}

function arcEsperar(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

function arcHayPendientes() {
  return contarSinGuardar() > 0 || hayEnviosEnCurso();
}

// Ventana de "trabajando", sin botones: no se puede cerrar a medias.
function arcMostrarEspera(texto) {
  const fondo = document.createElement('div');
  fondo.className = 'dialogo-fondo';
  fondo.innerHTML = '<div class="dialogo-caja"><p class="dialogo-mensaje">' + escaparHtml(texto) + '</p></div>';
  document.body.appendChild(fondo);
  return fondo;
}

async function arcArchivar(panel, boton) {
  if (!puedeEscribir()) return;
  const select = panel.querySelector('#arc-hasta');
  if (!select) return;
  const hasta = parseInt(select.value, 10);
  if (!(hasta > 1990) || hasta > arcAnioMaximo()) return;

  if (arcHayPendientes()) {
    alert('Hay cambios sin guardar todavía. Sincroniza hasta que todo esté guardado y vuelve a intentarlo.');
    return;
  }

  const previa = arcSeleccion(hasta);
  if (previa.total === 0) return;

  const eleccion = await mostrarDialogoOpciones(
    'Archivar hasta ' + hasta,
    'Se archivarán ' + previa.cuenta.ventas + ' facturas de venta, ' + previa.cuenta.compras + ' de compra, ' +
      previa.cuenta.apuntes + ' apuntes y ' + previa.cuenta.impuestos + ' trimestres de impuestos. ' +
      'Primero se descargará el Excel anual de ' + previa.anios.join(', ') + '. Después, Google hará una copia ' +
      'de seguridad, pasará esos registros a una hoja en la carpeta «Cuentas - Archivo» de tu Drive y los ' +
      'quitará de la app. Conviene hacerlo con los demás dispositivos ya sincronizados.',
    [{ id: 'cancelar', texto: 'Cancelar' }, { id: 'seguir', texto: 'Seguir', tipo: 'principal' }]
  );
  if (eleccion !== 'seguir') return;

  if (!await confirmarConPin('Vas a archivar los años hasta ' + hasta + ' (incluido).')) return;

  // Datos al día antes de decidir qué se archiva.
  await sincronizar();
  if (!estado.syncReady) {
    alert('No hay conexión con Google Sheets. No se ha archivado nada.');
    return;
  }
  if (arcHayPendientes()) {
    alert('Hay cambios sin guardar todavía. Sincroniza hasta que todo esté guardado y vuelve a intentarlo. No se ha archivado nada.');
    return;
  }
  const sel = arcSeleccion(hasta);
  if (sel.total === 0) {
    alert('No queda nada que archivar hasta ' + hasta + '.');
    arcPintarInfo(panel);
    return;
  }

  // 1. Excel anual de cada año, descargado solo.
  if (typeof infDescargarExcelAnual !== 'function') {
    alert('No se ha podido preparar el Excel anual. No se ha archivado nada.');
    return;
  }
  let descargar = true;
  while (descargar) {
    for (let i = 0; i < sel.anios.length; i++) {
      if (!infDescargarExcelAnual(sel.anios[i])) {
        alert('No se ha podido descargar el Excel de ' + sel.anios[i] + '. No se ha archivado nada.');
        return;
      }
      await arcEsperar(700);   // un respiro entre descargas para que el navegador no las bloquee
    }
    const nombres = sel.anios.map(function (a) { return '«Cuentas ' + a + ' anual.xlsx»'; }).join(', ');
    const respuesta = await mostrarDialogoOpciones(
      'Comprueba tus Excel',
      'Se ' + (sel.anios.length === 1 ? 'ha descargado ' : 'han descargado ') + nombres + '. ' +
        'Comprueba que ' + (sel.anios.length === 1 ? 'está' : 'están') + ' en tu carpeta de Descargas antes de seguir. ' +
        'Si el navegador pregunta si permites descargar varios archivos, di que sí y pulsa «Descargar otra vez».',
      [
        { id: 'cancelar', texto: 'Cancelar' },
        { id: 'repetir', texto: 'Descargar otra vez' },
        { id: 'archivar', texto: 'Archivar', tipo: 'principal' }
      ]
    );
    if (respuesta === 'archivar') descargar = false;
    else if (respuesta !== 'repetir') return;
  }

  // 2. Google: copia de seguridad, hoja de archivo y quitar los registros.
  boton.disabled = true;
  const espera = arcMostrarEspera('Archivando... Google está haciendo la copia de seguridad y la hoja de archivo. Puede tardar un minuto: no cierres la app.');
  let r = null;
  let sinRespuesta = false;
  try {
    r = await unIntentoBackend({ action: 'archivar', hasta: sel.hasta, ids: sel.ids }, 180000);
  } catch (err) {
    console.error('Archivar: sin respuesta de Google:', err);
    sinRespuesta = true;
  }
  espera.remove();

  if (r && r.code === 'clave') { cerrarSesion('La clave de acceso ya no es válida. Vuelve a introducirla.'); return; }

  if (sinRespuesta) {
    alert('No ha llegado la respuesta de Google. Puede que se haya archivado igualmente: la app va a sincronizar ahora. ' +
      'Antes de repetirlo, vuelve a esta pestaña y mira si esos años siguen apareciendo. No se ha perdido nada: ' +
      'está todo en tus Excel y en la copia de seguridad.');
    await sincronizar();
    pintarPanelActivo();
    return;
  }

  if (!r || r.status !== 'success') {
    const texto = String((r && r.message) || '');
    alert(texto.indexOf('Acción desconocida') !== -1
      ? 'Falta publicar la nueva versión de Código.gs en Apps Script (Implementar → Gestionar implementaciones → lápiz → Nueva versión). No se ha archivado nada.'
      : 'No se ha podido archivar: ' + texto.replace(/^Error:\s*/, ''));
    await sincronizar();
    pintarPanelActivo();
    return;
  }

  // 3. Fuera de la app, y sincronizar para quedar igual que la hoja.
  ARCHIVO_HOJAS.forEach(function (h) {
    const quitar = {};
    (sel.ids[h] || []).forEach(function (id) { quitar[String(id)] = true; });
    estado[h] = estado[h].filter(function (x) { return !quitar[String(x.id)]; });
    guardarEntidadLocal(h);
  });
  await sincronizar();
  pintarPanelActivo();

  const a = r.archivados || {};
  const final = await mostrarDialogoOpciones(
    'Años archivados',
    'Hecho: ' + (a.ventas || 0) + ' facturas de venta, ' + (a.compras || 0) + ' de compra, ' + (a.apuntes || 0) +
      ' apuntes y ' + (a.impuestos || 0) + ' trimestres están ahora en «' + ((r.archivo && r.archivo.nombre) || 'Cuentas - Archivo') +
      '», en la carpeta «Cuentas - Archivo» de tu Drive, y ya no ocupan sitio en la app.',
    (r.archivo && r.archivo.url)
      ? [{ id: 'abrir', texto: 'Abrir el archivo' }, { id: 'cerrar', texto: 'Cerrar', tipo: 'principal' }]
      : [{ id: 'cerrar', texto: 'Cerrar', tipo: 'principal' }]
  );
  if (final === 'abrir' && r.archivo && r.archivo.url) window.open(r.archivo.url, '_blank', 'noopener');
}

// ============================================================
// 8. COMPONENTES REUTILIZABLES
// ============================================================

function campoTexto(clave, etiqueta, valor, tipo) {
  const esNumero = tipo === 'numero';
  const tipoInput = tipo === 'email' ? 'email' : 'text';
  return (
    '<div class="campo-grupo">' +
      '<label for="cfg-' + clave + '">' + escaparHtml(etiqueta) + '</label>' +
      '<input class="campo" id="cfg-' + clave + '" type="' + tipoInput + '" ' +
        (esNumero ? 'data-numero="1" ' : '') +
        'value="' + escaparHtml(valor) + '" data-config-key="' + clave + '">' +
    '</div>'
  );
}

function piePanelGuardar() {
  return '<div class="config-guardar"><button type="button" class="boton-principal" id="btn-guardar-config">Guardar</button></div>';
}

// ---- Editor de listas (IVA, IRPF, tipos de cliente, equipos, servicios) ----

const ARRAY_CLAVE_SHEET = {
  iva: 'iva_tipos', irpf: 'irpf_tipos', tiposCliente: 'tipos_cliente',
  equipos: 'equipos', serviciosExtra: 'servicios_extra'
};
const ARRAY_PREFIJO_ID = {
  iva: 'iva', irpf: 'irpf', tiposCliente: null, equipos: 'eq', serviciosExtra: 'srv'
};

function renderArrayEditor(nombre, columnas) {
  const claveSheet = ARRAY_CLAVE_SHEET[nombre];
  const filas = cfgArray(claveSheet);
  const claseFilas = 'cols-' + (columnas.length) + (columnas.some(function (c) { return c.tipo === 'seleccion'; }) ? '-select' : '');

  const filasHtml = filas.map(function (fila, i) {
    return renderArrayFila(nombre, columnas, fila, i, claseFilas);
  }).join('');

  return (
    '<div class="array-editor" id="array-' + nombre + '" data-array="' + nombre + '" data-columnas="' + escaparHtml(JSON.stringify(columnas)) + '">' +
      filasHtml +
      '<button type="button" class="array-anadir" data-anadir="' + nombre + '">+ Añadir</button>' +
    '</div>'
  );
}

function renderArrayFila(nombre, columnas, fila, indice, claseFilas) {
  const campos = columnas.map(function (col) {
    const valor = fila[col.campo] === undefined ? '' : fila[col.campo];
    if (col.tipo === 'seleccion') {
      const opciones = col.opciones.map(function (op) {
        return '<option value="' + op[0] + '"' + (valor === op[0] ? ' selected' : '') + '>' + escaparHtml(op[1]) + '</option>';
      }).join('');
      return '<select data-campo="' + col.campo + '">' + opciones + '</select>';
    }
    return '<input type="text" data-campo="' + col.campo + '"' +
      (col.tipo === 'numero' ? ' data-numero="1"' : '') +
      (col.soloLectura ? ' disabled' : '') +
      ' placeholder="' + escaparHtml(col.placeholder || '') + '"' +
      ' value="' + escaparHtml(valor) + '">';
  }).join('');

  // El id real de la fila viaja en data-id-fila, pintado en el DOM
  // desde que la fila existe — NUNCA se reasigna por posición al
  // guardar (fallo corregido el 09/09/2026: antes recogerArray()
  // heredaba el id de "lo que hubiera antes en esa posición", así que
  // borrar una fila corría los ids de todas las siguientes hacia
  // arriba, y cualquier presupuesto o factura que referenciara ese id
  // por casualidad seguía "encontrando algo", pero lo equivocado).
  return (
    '<div class="array-fila ' + claseFilas + '" data-fila="' + indice + '" data-id-fila="' + escaparHtml(fila.id || '') + '">' +
      campos +
      '<button type="button" class="array-quitar" data-quitar title="Quitar"><i class="ti ti-x"></i></button>' +
    '</div>'
  );
}

function cablearArrayEditor(contenedor) {
  contenedor.querySelectorAll('.array-editor').forEach(function (editor) {
    const nombre = editor.dataset.array;
    const columnas = JSON.parse(editor.dataset.columnas);
    const claseFilas = 'cols-' + columnas.length + (columnas.some(function (c) { return c.tipo === 'seleccion'; }) ? '-select' : '');
    const prefijo = ARRAY_PREFIJO_ID[nombre];

    editor.addEventListener('click', function (ev) {
      const quitar = ev.target.closest('[data-quitar]');
      if (quitar) {
        quitar.closest('.array-fila').remove();
        return;
      }
      const anadir = ev.target.closest('[data-anadir]');
      if (anadir) {
        const filaVacia = {};
        columnas.forEach(function (c) { filaVacia[c.campo] = ''; });
        // El id se genera AQUÍ, al nacer la fila — no al recoger el
        // array — para que quede fijado en el DOM desde el principio
        // y nunca dependa de la posición que ocupe después.
        if (prefijo) filaVacia.id = idArrayEstable(prefijo);
        const div = document.createElement('div');
        div.innerHTML = renderArrayFila(nombre, columnas, filaVacia, editor.children.length, claseFilas);
        editor.insertBefore(div.firstChild, anadir);
      }
    });
  });
}

// Recoge las filas actuales de un editor, descartando las vacías. El
// id de cada fila se lee de su propio DOM (data-id-fila, pintado por
// renderArrayFila desde que la fila existe) — nunca se reasigna por
// posición. Antes del 09/09/2026, si borrabas una fila, las
// siguientes heredaban el id de "lo que hubiera antes en esa
// posición" (decisión I2 mal aplicada): borrar el IVA del 21% hacía
// que el IVA del 10% pasara a tener el id del 21%, y cualquier
// presupuesto/equipo que referenciara ese id seguía "encontrando
// algo", pero lo equivocado, en vez de notar que ya no existía.
function recogerArray(nombre) {
  const editor = document.getElementById('array-' + nombre);
  if (!editor) return cfgArray(ARRAY_CLAVE_SHEET[nombre]);

  const prefijo = ARRAY_PREFIJO_ID[nombre];

  const filas = Array.from(editor.querySelectorAll('.array-fila')).map(function (filaEl) {
    const obj = {};
    filaEl.querySelectorAll('[data-campo]').forEach(function (campoEl) {
      const nombreCampo = campoEl.dataset.campo;
      const esNumero = campoEl.dataset.numero === '1';
      obj[nombreCampo] = esNumero ? parsearNumero(campoEl.value) : campoEl.value.trim();
    });
    if (prefijo) {
      const idPropio = filaEl.dataset.idFila;
      obj.id = idPropio || idArrayEstable(prefijo); // red de seguridad: fila sin id propio (no debería ocurrir)
    }
    return obj;
  });

  // Descarta filas totalmente vacías (todas las claves de texto en blanco)
  return filas.filter(function (fila) {
    return Object.keys(fila).some(function (k) {
      if (k === 'id') return false;
      return fila[k] !== '' && fila[k] !== 0;
    });
  });
}

// ---- Editor de texto enriquecido ----

function renderRichEditor(clave, valorHtml) {
  const contenidoInicial = desescaparEntidades(valorHtml);
  return (
    '<div class="rich-editor" data-rich-key="' + clave + '">' +
      '<div class="rich-toolbar">' +
        '<button type="button" data-cmd="bold"><b>B</b></button>' +
        '<button type="button" data-cmd="italic"><i>I</i></button>' +
        '<button type="button" data-cmd="underline"><u>U</u></button>' +
        '<button type="button" data-cmd="insertUnorderedList"><i class="ti ti-list"></i></button>' +
        '<button type="button" data-cmd="removeFormat"><i class="ti ti-clear-formatting"></i></button>' +
      '</div>' +
      '<div class="rich-contenido" contenteditable="true" data-rich-contenido>' + contenidoInicial + '</div>' +
    '</div>'
  );
}

function desescaparEntidades(html) {
  if (!html || html.indexOf('&lt;') === -1) return html;
  const tmp = document.createElement('textarea');
  tmp.innerHTML = html;
  return tmp.value;
}

function cablearRichEditor(contenedor) {
  contenedor.querySelectorAll('.rich-editor').forEach(function (editor) {
    const area = editor.querySelector('[data-rich-contenido]');
    editor.querySelectorAll('.rich-toolbar button').forEach(function (boton) {
      boton.addEventListener('click', function () {
        area.focus();
        document.execCommand(boton.dataset.cmd, false, null);
      });
    });
  });
}

// Permite solo B STRONG I EM U BR P DIV UL OL LI SPAN, y quita
// atributos on*/style/class — igual que hacía pdfSanitizeRichText().
function sanearTextoEnriquecido(html) {
  const permitidas = ['B', 'STRONG', 'I', 'EM', 'U', 'BR', 'P', 'DIV', 'UL', 'OL', 'LI', 'SPAN'];
  const contenedor = document.createElement('div');
  contenedor.innerHTML = html;
  limpiarNodoRico(contenedor, permitidas);
  return contenedor.innerHTML;
}

function limpiarNodoRico(nodo, permitidas) {
  Array.from(nodo.childNodes).forEach(function (hijo) {
    if (hijo.nodeType !== 1) return;
    if (permitidas.indexOf(hijo.tagName) === -1) {
      while (hijo.firstChild) nodo.insertBefore(hijo.firstChild, hijo);
      nodo.removeChild(hijo);
      return;
    }
    Array.from(hijo.attributes).forEach(function (attr) {
      const n = attr.name.toLowerCase();
      if (n.indexOf('on') === 0 || n === 'style' || n === 'class') hijo.removeAttribute(attr.name);
    });
    limpiarNodoRico(hijo, permitidas);
  });
}

// ============================================================
// 9. CABLEADO DE CADA PANEL (eventos)
// ============================================================

function cablearPanelActivo(panel) {
  cablearArrayEditor(panel);
  cablearRichEditor(panel);

  // Vista previa de la dirección, en vivo (pestaña Mis Datos)
  panel.querySelectorAll('[data-config-key^="fiscal_"]').forEach(function (input) {
    input.addEventListener('input', function () {
      const preview = document.getElementById('direccion-preview');
      if (!preview) return;
      // usa los valores actuales del formulario, no los guardados
      const val = function (clave) {
        const el = panel.querySelector('[data-config-key="' + clave + '"]');
        return el ? el.value.trim() : '';
      };
      const linea1 = [val('fiscal_calle'), val('fiscal_numero')].filter(Boolean).join(' ');
      const linea2 = [val('fiscal_codigo_postal'), val('fiscal_poblacion')].filter(Boolean).join(' ');
      const provincia = val('fiscal_provincia');
      preview.textContent = [linea1, linea2 + (provincia ? ' (' + provincia + ')' : '')].filter(Boolean).join(', ') || 'Sin dirección todavía';
    });
  });

  const btnGuardar = document.getElementById('btn-guardar-config');
  if (btnGuardar) btnGuardar.addEventListener('click', function () { guardarConfiguracionActual(btnGuardar); });
}

// ============================================================
// 10. GUARDADO
// ============================================================
// Se envía SIEMPRE la configuración completa (mapa 5.3), partiendo
// de lo que ya había y sustituyendo solo lo de la pestaña visible.

async function guardarConfiguracionActual(boton) {
  if (!puedeEscribir()) return;

  const payload = Object.assign({}, estado.configuracion);
  const panel = document.getElementById('config-panel');

  panel.querySelectorAll('[data-config-key]').forEach(function (input) {
    payload[input.dataset.configKey] = input.value.trim();
  });

  panel.querySelectorAll('[data-rich-key]').forEach(function (editor) {
    const contenido = editor.querySelector('[data-rich-contenido]').innerHTML;
    payload[editor.dataset.richKey] = sanearTextoEnriquecido(contenido);
  });

  if (panel.querySelector('#array-iva')) payload.iva_tipos = JSON.stringify(recogerArray('iva'));
  if (panel.querySelector('#array-irpf')) payload.irpf_tipos = JSON.stringify(recogerArray('irpf'));
  if (panel.querySelector('#array-tiposCliente')) payload.tipos_cliente = JSON.stringify(recogerArray('tiposCliente'));
  if (panel.querySelector('#array-equipos')) payload.equipos = JSON.stringify(recogerArray('equipos'));
  if (panel.querySelector('#array-serviciosExtra')) payload.servicios_extra = JSON.stringify(recogerArray('serviciosExtra'));

  // Acción delicada: pide el PIN cada vez (decisión 15/09/2026).
  if (!await confirmarConPin('Vas a guardar los cambios de la configuración.')) return;

  const textoOriginal = boton.textContent;
  boton.disabled = true;
  boton.textContent = 'Guardando...';
  indicador('guardando');

  try {
    const resultado = await llamarBackend({ action: 'save_config', data: payload });
    if (resultado.status !== 'success') throw new Error(resultado.message || 'Fallo al guardar');

    estado.configuracion = payload;
    guardarTodoLocal();
    indicador('sincronizado');
    pintarPanelActivo();
  } catch (err) {
    console.error('No se pudo guardar la configuración:', err);
    indicador('sinconexion');
    alert('No se pudo guardar en Google Sheets. Vuelve a intentarlo cuando haya conexión.');
  }

  boton.disabled = false;
  boton.textContent = textoOriginal;
}

// ============================================================
// 11. REGISTRO COMO VISTA
// ============================================================
// Sustituye al "próximamente" que mod-navegacion.js registra por
// defecto para esta sección (por eso este archivo debe cargarse
// DESPUÉS de mod-navegacion.js en index.html).

registrarVista('configuracion', {
  titulo: 'Configuración',
  pintar: pintarConfiguracion
});
