/**
 * MÓDULO CONFIGURACIÓN
 * ------------------------------------------------------------
 * 7 pestañas sobre la hoja "configuracion" (clave/valor). Cada
 * guardado envía SIEMPRE la configuración completa (decisión
 * documentada en el mapa 5.3), no solo la pestaña abierta.
 */

// ============================================================
// 0. ESTADO PROPIO DEL MÓDULO (no vive en el núcleo)
// ============================================================

const CONFIG_PESTANAS = [
  { id: 'mis-datos', titulo: 'Mis Datos & Perfil' },
  { id: 'datos-fiscales', titulo: 'Datos Fiscales' },
  { id: 'impuestos-config', titulo: 'Impuestos y Retenciones' },
  { id: 'params-calculadora', titulo: 'Parámetros Calculadora' },
  { id: 'series', titulo: 'Numeración y Series' },
  { id: 'textos', titulo: 'Textos Presupuestos/Facturas' },
  { id: 'preferencias', titulo: 'Preferencias Generales' }
];

let configPestanaActiva = 'mis-datos';
let configFotoPendiente = null; // base64 nueva, mientras no se guarde

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

  document.getElementById('titulo-pantalla').textContent = 'Configuración';

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
      configFotoPendiente = null;
      pintarPestanas();
      pintarPanelActivo();
    });
  });
}

function pintarPanelActivo() {
  const panel = document.getElementById('config-panel');
  const renderes = {
    'mis-datos': renderMisDatos,
    'datos-fiscales': renderDatosFiscales,
    'impuestos-config': renderImpuestosConfig,
    'params-calculadora': renderParamsCalculadora,
    'series': renderSeries,
    'textos': renderTextos,
    'preferencias': renderPreferencias
  };
  panel.innerHTML = renderes[configPestanaActiva]();
  cablearPanelActivo(panel);
}

// ============================================================
// 3. PESTAÑA: MIS DATOS
// ============================================================

function renderMisDatos() {
  const foto = configFotoPendiente || cfgTexto('perfil_foto');
  return (
    '<h2>Mis Datos &amp; Perfil</h2>' +
    '<div class="avatar-editor">' +
      '<div class="avatar-preview" id="avatar-preview" style="' +
        (foto ? 'background-image:url(' + JSON.stringify(foto) + ')' : '') + '"></div>' +
      '<div>' +
        '<button type="button" class="boton-secundario" id="btn-cambiar-foto">Cambiar foto</button>' +
        '<input type="file" accept="image/*" id="input-foto" hidden>' +
      '</div>' +
    '</div>' +
    '<div class="config-grid dos-columnas">' +
      campoTexto('perfil_nombre', 'Nombre', cfgTexto('perfil_nombre')) +
      campoTexto('perfil_email', 'Email', cfgTexto('perfil_email'), 'email') +
      campoTexto('perfil_telefono', 'Teléfono', cfgTexto('perfil_telefono')) +
    '</div>' +
    piePanelGuardar()
  );
}

// ============================================================
// 4. PESTAÑA: DATOS FISCALES
// ============================================================

function renderDatosFiscales() {
  return (
    '<h2>Datos Fiscales</h2>' +
    '<div class="config-grid dos-columnas">' +
      campoTexto('fiscal_nombre', 'Nombre fiscal', cfgTexto('fiscal_nombre')) +
      campoTexto('fiscal_nif', 'NIF', cfgTexto('fiscal_nif')) +
      campoTexto('fiscal_calle', 'Calle', cfgTexto('fiscal_calle')) +
      campoTexto('fiscal_numero', 'Número', cfgTexto('fiscal_numero')) +
      campoTexto('fiscal_codigo_postal', 'Código postal', cfgTexto('fiscal_codigo_postal')) +
      campoTexto('fiscal_poblacion', 'Población', cfgTexto('fiscal_poblacion')) +
      campoTexto('fiscal_provincia', 'Provincia', cfgTexto('fiscal_provincia')) +
      campoTexto('fiscal_iban', 'IBAN', cfgTexto('fiscal_iban')) +
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
// 5. PESTAÑA: IMPUESTOS Y RETENCIONES
// ============================================================

function renderImpuestosConfig() {
  return (
    '<h2>Impuestos y Retenciones</h2>' +
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
// 6. PESTAÑA: PARÁMETROS CALCULADORA
// ============================================================

function renderParamsCalculadora() {
  return (
    '<h2>Parámetros Calculadora</h2>' +
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
// 7. PESTAÑA: SERIES (informativa, sin cambios — decisión M2)
// ============================================================

function renderSeries() {
  return (
    '<h2>Numeración y Series</h2>' +
    '<div class="config-cartel">' +
      'Por ahora solo usas una serie de numeración (F/P + año + número). ' +
      'Cuando necesites una segunda actividad con numeración independiente, se activará aquí.' +
    '</div>'
  );
}

// ============================================================
// 8. PESTAÑA: TEXTOS
// ============================================================

function renderTextos() {
  return (
    '<h2>Textos Presupuestos/Facturas</h2>' +
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
// 9. PESTAÑA: PREFERENCIAS
// ============================================================

function renderPreferencias() {
  const enPrueba = estado.modoPrueba;
  return (
    '<h2>Preferencias Generales</h2>' +

    '<div class="config-accion">' +
      '<div class="config-accion-texto">' +
        'Modo prueba' +
        '<small>' + (enPrueba
          ? 'Activo. Al desactivarlo se borran los datos de prueba del dispositivo.'
          : 'Prueba la aplicación sin tocar tus datos reales.') + '</small>' +
      '</div>' +
      '<button type="button" class="boton-secundario" id="btn-modo-prueba">' +
        (enPrueba ? 'Desactivar' : 'Activar') +
      '</button>' +
    '</div>' +

    '<div class="config-accion">' +
      '<div class="config-accion-texto">' +
        'Eliminación de emergencia' +
        '<small>Borra un registro a mano, saltándose todas las comprobaciones. Úsalo solo si sabes lo que haces.</small>' +
      '</div>' +
    '</div>' +
    '<button type="button" class="enlace-discreto" id="btn-emergencia">Eliminación de emergencia…</button>'
  );
}

// ============================================================
// 10. COMPONENTES REUTILIZABLES
// ============================================================

function campoTexto(clave, etiqueta, valor, tipo) {
  const esNumero = tipo === 'numero';
  const tipoInput = tipo === 'email' ? 'email' : (esNumero ? 'text' : 'text');
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

  return (
    '<div class="array-fila ' + claseFilas + '" data-fila="' + indice + '">' +
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
        const div = document.createElement('div');
        div.innerHTML = renderArrayFila(nombre, columnas, filaVacia, editor.children.length, claseFilas);
        editor.insertBefore(div.firstChild, anadir);
      }
    });
  });
}

// Recoge las filas actuales de un editor, descartando las vacías, y
// asigna un id estable a cualquier fila que todavía no lo tenga
// (decisión I2 — el id lo genera la pantalla).
function recogerArray(nombre) {
  const editor = document.getElementById('array-' + nombre);
  if (!editor) return cfgArray(ARRAY_CLAVE_SHEET[nombre]);

  const filasAnteriores = cfgArray(ARRAY_CLAVE_SHEET[nombre]);
  const prefijo = ARRAY_PREFIJO_ID[nombre];

  const filas = Array.from(editor.querySelectorAll('.array-fila')).map(function (filaEl, i) {
    const obj = {};
    filaEl.querySelectorAll('[data-campo]').forEach(function (campoEl) {
      const nombreCampo = campoEl.dataset.campo;
      const esNumero = campoEl.dataset.numero === '1';
      obj[nombreCampo] = esNumero ? parsearNumero(campoEl.value) : campoEl.value.trim();
    });
    if (prefijo && filasAnteriores[i] && filasAnteriores[i].id) obj.id = filasAnteriores[i].id;
    else if (prefijo) obj.id = idArrayEstable(prefijo);
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
// 11. CABLEADO DE CADA PANEL (eventos)
// ============================================================

function cablearPanelActivo(panel) {
  cablearArrayEditor(panel);
  cablearRichEditor(panel);

  // Vista previa de dirección en vivo (solo pestaña Datos Fiscales)
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

  const btnFoto = document.getElementById('btn-cambiar-foto');
  if (btnFoto) {
    const inputFoto = document.getElementById('input-foto');
    btnFoto.addEventListener('click', function () { inputFoto.click(); });
    inputFoto.addEventListener('change', function () {
      const archivo = inputFoto.files[0];
      if (!archivo) return;
      procesarFotoPerfil(archivo, function (base64) {
        configFotoPendiente = base64;
        document.getElementById('avatar-preview').style.backgroundImage = 'url(' + base64 + ')';
      });
    });
  }

  const btnGuardar = document.getElementById('btn-guardar-config');
  if (btnGuardar) btnGuardar.addEventListener('click', function () { guardarConfiguracionActual(btnGuardar); });

  const btnModoPrueba = document.getElementById('btn-modo-prueba');
  if (btnModoPrueba) {
    btnModoPrueba.addEventListener('click', function () {
      if (estado.modoPrueba) desactivarModoPrueba();
      else activarModoPrueba();
      pintarPanelActivo();
    });
  }

  const btnEmergencia = document.getElementById('btn-emergencia');
  if (btnEmergencia) btnEmergencia.addEventListener('click', eliminacionEmergencia);
}

// ============================================================
// 12. FOTO DE PERFIL
// ============================================================
// Máximo 256px por el lado mayor, JPEG calidad 0.82, base64.

function procesarFotoPerfil(archivo, callback) {
  const lector = new FileReader();
  lector.onload = function (ev) {
    const img = new Image();
    img.onload = function () {
      const maxLado = 256;
      let w = img.width, h = img.height;
      if (w >= h && w > maxLado) { h = Math.round(h * maxLado / w); w = maxLado; }
      else if (h > w && h > maxLado) { w = Math.round(w * maxLado / h); h = maxLado; }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      callback(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.src = ev.target.result;
  };
  lector.readAsDataURL(archivo);
}

// ============================================================
// 13. GUARDADO
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

  if (configFotoPendiente) payload.perfil_foto = configFotoPendiente;

  const textoOriginal = boton.textContent;
  boton.disabled = true;
  boton.textContent = 'Guardando...';
  indicador('guardando');

  try {
    const resultado = await llamarBackend({ action: 'save_config', data: payload });
    if (resultado.status !== 'success') throw new Error(resultado.message || 'Fallo al guardar');

    estado.configuracion = payload;
    guardarTodoLocal();
    configFotoPendiente = null;
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
// 14. ELIMINACIÓN DE EMERGENCIA
// ============================================================
// Escondida a propósito. Salta todas las comprobaciones de
// integridad — solo para casos de apuro (mapa 5.7).

async function eliminacionEmergencia() {
  const hojasPermitidas = ['ventas', 'presupuestos', 'clientes', 'compras', 'apuntes'];

  const hoja = prompt('Nombre exacto de la hoja (' + hojasPermitidas.join(', ') + '):');
  if (hoja === null) return;
  if (hojasPermitidas.indexOf(hoja.trim()) === -1) {
    alert('Ese nombre no es válido. Tiene que ser exactamente uno de: ' + hojasPermitidas.join(', '));
    return;
  }

  const id = prompt('ID exacto del registro a borrar:');
  if (id === null || !id.trim()) return;

  const confirmacion = prompt('Esto NO se puede deshacer y se salta todas las comprobaciones de seguridad. Escribe BORRAR para confirmar:');
  if (confirmacion !== 'BORRAR') { alert('Cancelado, no se ha borrado nada.'); return; }

  try {
    indicador('guardando');
    const resultado = await llamarBackend({ action: 'delete', sheet: hoja.trim(), data: { id: id.trim() } });
    if (resultado.status !== 'success') throw new Error(resultado.message);
    alert('Borrado. Sincronizando de nuevo...');
    await sincronizar();
  } catch (err) {
    indicador('sinconexion');
    alert('No se pudo borrar: ' + err);
  }
}

// ============================================================
// 15. REGISTRO EN EL NÚCLEO
// ============================================================

pintadores.push(function () {
  // Configuración es, de momento, la única pantalla — se pinta
  // siempre. Cuando haya más módulos, esto pasará por un selector
  // de vista en vez de pintarse directo.
  pintarConfiguracion();
});
