/**
 * MÓDULO CLIENTES Y PROVEEDORES
 * ------------------------------------------------------------
 * Referencia visual de la app (lista + ficha modal). El patrón de
 * este módulo se reutiliza en Presupuestos y Facturas más adelante.
 */

// ============================================================
// 0. ESTADO PROPIO DEL MÓDULO
// ============================================================

let cliPestana = 'cliente';       // 'cliente' | 'proveedor'
let cliFiltroTipo = 'todos';      // 'todos' | <código de tipo> | 'inactivos'
let cliBusqueda = '';

const TIPOS_CLIENTE_DEFECTO = [
  { nombre: 'normal', etiqueta: 'Normal', ajuste: 0 },
  { nombre: 'profesional', etiqueta: 'Profesional', ajuste: -5 },
  { nombre: 'habitual', etiqueta: 'Cliente habitual', ajuste: -8 },
  { nombre: 'ayuntamiento_pequeno', etiqueta: 'Ayuntamiento pequeño', ajuste: 2 },
  { nombre: 'ayuntamiento_mediano', etiqueta: 'Ayuntamiento mediano', ajuste: 5 },
  { nombre: 'ayuntamiento_grande', etiqueta: 'Ayuntamiento grande', ajuste: 10 }
];

// ============================================================
// 1. UTILIDADES DEL MÓDULO
// ============================================================

function cliTiposCliente() {
  const v = estado.configuracion.tipos_cliente;
  if (!v) return TIPOS_CLIENTE_DEFECTO;
  try {
    const arr = JSON.parse(v);
    return Array.isArray(arr) && arr.length ? arr : TIPOS_CLIENTE_DEFECTO;
  } catch (err) {
    return TIPOS_CLIENTE_DEFECTO;
  }
}

function cliEtiquetaTipo(codigo) {
  const tipo = cliTiposCliente().find(function (t) { return t.nombre === codigo; });
  return tipo ? tipo.etiqueta : (codigo || '');
}

// Enlaces "tel:" y "mailto:" — abren la app de teléfono/correo del
// dispositivo. Sin ellos, se muestra un guion como antes.
function enlaceTelefono(v) {
  if (!v) return '—';
  return '<a href="tel:' + escaparHtml(v.replace(/\s/g, '')) + '" onclick="event.stopPropagation()">' + escaparHtml(v) + '</a>';
}
function enlaceMail(v) {
  if (!v) return '—';
  return '<a href="mailto:' + escaparHtml(v) + '" onclick="event.stopPropagation()">' + escaparHtml(v) + '</a>';
}

function cliDireccionLinea(c) {
  const l1 = [c.calle, c.numero].filter(Boolean).join(' ');
  const l2 = [c.codigo_postal, c.poblacion].filter(Boolean).join(' ');
  return [l1, l2].filter(Boolean).join(', ') || '—';
}

function normaliseNif(v) {
  return String(v || '').toUpperCase().replace(/[\s.\-]/g, '');
}

function cliContactosActivosOrdenados() {
  return estado.clientes.slice().sort(function (a, b) {
    return (a.nombre_contacto || '').localeCompare(b.nombre_contacto || '', 'es');
  });
}

// Todo el texto por el que se puede buscar un contacto, normalizado.
function cliTextoBusqueda(c) {
  return normalizarBusqueda([
    c.nombre_contacto, c.nombre_fiscal, c.nif, c.calle, c.numero, c.codigo_postal,
    c.poblacion, c.provincia, c.mail, c.telefono,
    cliEtiquetaTipo(c.tipo), c.rol
  ].filter(Boolean).join(' '));
}

// ============================================================
// 2. PINTADO PRINCIPAL DE LA LISTA
// ============================================================

function pintarClientes() {
  const contenido = document.getElementById('contenido');
  if (!contenido) return;

  contenido.innerHTML =
    '<div class="cli-cabecera-lista">' +
      '<div class="cli-selector" id="cli-selector">' +
        '<button type="button" data-pestana="cliente">Clientes</button>' +
        '<button type="button" data-pestana="proveedor">Proveedores</button>' +
      '</div>' +
      '<button type="button" class="cli-flotante" id="cli-btn-nuevo" aria-label="Nuevo contacto"><i class="ti ti-plus"></i></button>' +
    '</div>' +

    '<div class="cli-barra" style="position:relative">' +
      '<input type="text" class="cli-buscador" id="cli-buscador" placeholder="Buscar..." value="' + escaparHtml(cliBusqueda) + '">' +
      '<button type="button" class="cli-btn-filtro' + (cliFiltroTipo !== 'todos' ? ' con-filtro' : '') + '" id="cli-btn-filtro"><i class="ti ti-filter"></i></button>' +
      renderFiltrosPanel() +
    '</div>' +

    '<div id="cli-lista-contenedor"></div>';

  cablearCabeceraLista();
  pintarListaFiltrada();
}

function renderFiltrosPanel() {
  const tipos = cliTiposCliente();
  const opciones = [['todos', 'Todos']]
    .concat(tipos.map(function (t) { return [t.nombre, t.etiqueta]; }))
    .concat([['inactivos', 'Inactivos']]);

  return '<div class="cli-filtros-panel" id="cli-filtros-panel">' +
    opciones.map(function (op) {
      return '<button type="button" data-filtro="' + op[0] + '"' +
        (op[0] === cliFiltroTipo ? ' class="activa"' : '') + '>' + escaparHtml(op[1]) + '</button>';
    }).join('') +
    '</div>';
}

function cablearCabeceraLista() {
  document.getElementById('cli-selector').querySelectorAll('[data-pestana]').forEach(function (b) {
    b.classList.toggle('activa', b.dataset.pestana === cliPestana);
    b.addEventListener('click', function () {
      cliPestana = b.dataset.pestana;
      pintarClientes();
    });
  });

  document.getElementById('cli-btn-nuevo').addEventListener('click', function () { abrirFormularioContacto(null); });

  const buscador = document.getElementById('cli-buscador');
  buscador.addEventListener('input', function () {
    cliBusqueda = buscador.value;
    pintarListaFiltrada();
  });

  const btnFiltro = document.getElementById('cli-btn-filtro');
  const panel = document.getElementById('cli-filtros-panel');

  function cerrarPanelFiltro() {
    panel.classList.remove('abierto');
    document.removeEventListener('click', cerrarPanelFiltroSiFuera);
  }
  function cerrarPanelFiltroSiFuera(ev) {
    if (!panel.contains(ev.target) && ev.target !== btnFiltro && !btnFiltro.contains(ev.target)) cerrarPanelFiltro();
  }

  btnFiltro.addEventListener('click', function (ev) {
    ev.stopPropagation();
    const seVaAAbrir = !panel.classList.contains('abierto');
    panel.classList.toggle('abierto');
    if (seVaAAbrir) {
      // Se añade en el siguiente turno para que este mismo click, que
      // ya está en marcha, no cierre el panel que acaba de abrirse.
      setTimeout(function () { document.addEventListener('click', cerrarPanelFiltroSiFuera); }, 0);
    } else {
      document.removeEventListener('click', cerrarPanelFiltroSiFuera);
    }
  });
  panel.querySelectorAll('[data-filtro]').forEach(function (b) {
    b.addEventListener('click', function () {
      cliFiltroTipo = b.dataset.filtro;
      pintarClientes();
    });
  });
}

// ============================================================
// 3. FILTRADO Y PINTADO DE LA LISTA (móvil + PC)
// ============================================================

function cliListaFiltrada() {
  const soloPrueba = false; // los de prueba se ven mezclados, marcados aparte (I8)
  const textoBusqueda = normalizarBusqueda(cliBusqueda);

  return cliContactosActivosOrdenados().filter(function (c) {
    // Pestaña por rol
    const rolEncaja = cliPestana === 'cliente'
      ? (c.rol === 'cliente' || c.rol === 'ambos')
      : (c.rol === 'proveedor' || c.rol === 'ambos');
    if (!rolEncaja) return false;

    // Filtro "Inactivos" sustituye la lista (mapa 6.3, ⚠️ documentado así)
    if (cliFiltroTipo === 'inactivos') {
      if (c.estado === 'activo') return false;
    } else {
      if (c.estado !== 'activo') return false;
      if (cliFiltroTipo !== 'todos' && c.tipo !== cliFiltroTipo) return false;
    }

    if (textoBusqueda && cliTextoBusqueda(c).indexOf(textoBusqueda) === -1) return false;

    return true;
  });
}

function pintarListaFiltrada() {
  const contenedor = document.getElementById('cli-lista-contenedor');
  if (!contenedor) return;
  const lista = cliListaFiltrada();

  if (lista.length === 0) {
    contenedor.innerHTML = '<p class="cli-vacio">' +
      (cliBusqueda || cliFiltroTipo !== 'todos'
        ? 'No hay resultados con estos filtros.'
        : 'Todavía no hay ' + (cliPestana === 'cliente' ? 'clientes' : 'proveedores') + '.') +
      '</p>';
    return;
  }

  contenedor.innerHTML =
    '<div class="cli-lista-movil">' + lista.map(renderFilaMovil).join('') + '</div>' +
    '<div class="cli-tabla-wrap"><table class="cli-tabla"><thead><tr>' +
      '<th>Nombre</th><th>DNI/NIF</th><th>Dirección</th><th>Email</th><th>Teléfono</th><th></th>' +
    '</tr></thead><tbody>' + lista.map(renderFilaTabla).join('') + '</tbody></table></div>';

  cablearFilas(contenedor);
}

function metaLinea(c) {
  const partes = [c.rol === 'ambos' ? 'Cliente y proveedor' : (c.rol === 'cliente' ? 'Cliente' : 'Proveedor')];
  if (c.tipo) partes.push(cliEtiquetaTipo(c.tipo));
  let html = escaparHtml(partes.join(' · '));
  if (c.estado !== 'activo') html += ' · <span class="inactivo">Inactivo</span>';
  return html;
}

function metaLineaMovil(c) {
  const partes = [c.telefono, c.mail].filter(Boolean);
  let html = escaparHtml(partes.join(' · ') || '—');
  if (c.estado !== 'activo') html += ' · <span class="inactivo">Inactivo</span>';
  return html;
}

function renderFilaMovil(c) {
  return '<div class="cli-fila" data-id="' + c.id + '">' +
    htmlIconoContacto(c.icono, 42) +
    '<div class="cli-info">' +
      '<p class="cli-nombre">' + escaparHtml(c.nombre_contacto) + '</p>' +
      '<p class="cli-meta">' + metaLineaMovil(c) + '</p>' +
    '</div>' +
    '<div class="cli-acciones">' +
      '<button type="button" class="cli-btn-icono" data-mas="' + c.id + '" aria-label="Más opciones"><i class="ti ti-dots-vertical"></i></button>' +
    '</div>' +
  '</div>';
}

function renderFilaTabla(c) {
  return '<tr class="cli-fila-tabla" data-id="' + c.id + '">' +
    '<td><div class="cli-nombre-cell">' + htmlIconoContacto(c.icono, 32) +
      '<div><div style="font-weight:500">' + escaparHtml(c.nombre_contacto) + (c.estado !== 'activo' ? ' <span class="inactivo">· Inactivo</span>' : '') + '</div>' +
      '<div style="font-size:11px;color:var(--texto-secundario)">' + escaparHtml(c.nombre_fiscal) + '</div></div></div></td>' +
    '<td>' + escaparHtml(c.nif || '—') + '</td>' +
    '<td>' + escaparHtml(cliDireccionLinea(c)) + '</td>' +
    '<td>' + enlaceMail(c.mail) + '</td>' +
    '<td>' + enlaceTelefono(c.telefono) + '</td>' +
    '<td><div class="cli-acciones">' +
      '<button type="button" class="cli-btn-icono" data-editar="' + c.id + '" aria-label="Editar"><i class="ti ti-pencil"></i></button>' +
      '<button type="button" class="cli-btn-icono" data-mas="' + c.id + '" aria-label="Más opciones"><i class="ti ti-dots-vertical"></i></button>' +
    '</div></td>' +
  '</tr>';
}

function cablearFilas(contenedor) {
  // Abrir ficha al pulsar la fila (fuera de los botones de acción)
  contenedor.querySelectorAll('.cli-fila, .cli-fila-tabla').forEach(function (fila) {
    fila.addEventListener('click', function (ev) {
      if (ev.target.closest('.cli-acciones')) return;
      abrirFichaContacto(fila.dataset.id);
    });
  });

  contenedor.querySelectorAll('[data-editar]').forEach(function (b) {
    b.addEventListener('click', function (ev) {
      ev.stopPropagation();
      abrirFormularioContacto(b.dataset.editar);
    });
  });

  contenedor.querySelectorAll('[data-mas]').forEach(function (b) {
    b.addEventListener('click', function (ev) {
      ev.stopPropagation();
      abrirMenuMas(b, b.dataset.mas);
    });
  });
}

// ============================================================
// 4. MENÚ "MÁS OPCIONES"
// ============================================================

function abrirMenuMas(boton, id) {
  document.querySelectorAll('.cli-menu-mas').forEach(function (m) { m.remove(); });

  const contacto = estado.clientes.find(function (c) { return String(c.id) === String(id); });
  if (!contacto) return;

  const menu = document.createElement('div');
  menu.className = 'cli-menu-mas';
  menu.innerHTML = contacto.estado === 'activo'
    ? '<button type="button" data-accion="desactivar">Desactivar</button>'
    : '<button type="button" data-accion="reactivar">Reactivar</button>' +
      '<button type="button" class="peligro" data-accion="eliminar">Eliminar definitivamente</button>';

  document.body.appendChild(menu);
  posicionarMenuMas(menu, boton);

  function cerrarMenu() {
    menu.remove();
    document.removeEventListener('click', cerrarMenuSiFuera);
  }
  function cerrarMenuSiFuera(ev) {
    if (!menu.contains(ev.target)) cerrarMenu();
  }

  menu.querySelector('[data-accion="desactivar"]')?.addEventListener('click', function () { cerrarMenu(); cambiarEstadoContacto(id, 'inactivo'); });
  menu.querySelector('[data-accion="reactivar"]')?.addEventListener('click', function () { cerrarMenu(); cambiarEstadoContacto(id, 'activo'); });
  menu.querySelector('[data-accion="eliminar"]')?.addEventListener('click', function () { cerrarMenu(); eliminarContactoDefinitivo(id); });

  setTimeout(function () { document.addEventListener('click', cerrarMenuSiFuera); }, 0);
}

// Coloca el menú pegado al botón que lo abrió, hacia abajo por
// defecto — pero hacia arriba si no queda espacio antes del final de
// la pantalla (por ejemplo, en la última fila de una lista larga).
function posicionarMenuMas(menu, boton) {
  const rectBoton = boton.getBoundingClientRect();
  const altoMenu = menu.offsetHeight;
  const espacioAbajo = window.innerHeight - rectBoton.bottom;

  const arriba = espacioAbajo < altoMenu + 12;
  menu.style.top = arriba
    ? (rectBoton.top - altoMenu - 4) + 'px'
    : (rectBoton.bottom + 4) + 'px';

  const izquierdaDeseada = rectBoton.right - menu.offsetWidth;
  menu.style.left = Math.max(8, izquierdaDeseada) + 'px';
}

async function cambiarEstadoContacto(id, nuevoEstado) {
  const contacto = estado.clientes.find(function (c) { return String(c.id) === String(id); });
  if (!contacto) return;

  const mensaje = nuevoEstado === 'inactivo'
    ? 'Desactivar a "' + contacto.nombre_contacto + '"? No se borra nada, y el ID no se reutiliza.'
    : 'Reactivar a "' + contacto.nombre_contacto + '"?';
  if (!confirm(mensaje)) return;

  await guardarRegistro('clientes', Object.assign({}, contacto, { estado: nuevoEstado }), pintarListaFiltrada, null);
}

function contactoTieneHistorial(id) {
  return estado.presupuestos.some(function (p) { return String(p.id_cliente) === String(id); }) ||
         estado.ventas.some(function (v) { return String(v.id_cliente) === String(id); }) ||
         estado.compras.some(function (c) { return String(c.id_proveedor) === String(id); }) ||
         estado.apuntes.some(function (a) { return String(a.id_contacto) === String(id); });
}

async function eliminarContactoDefinitivo(id) {
  const contacto = estado.clientes.find(function (c) { return String(c.id) === String(id); });
  if (!contacto) return;

  if (!esDePrueba(contacto)) {
    if (contacto.estado === 'activo') {
      alert('Solo se pueden eliminar contactos inactivos. Desactívalo primero.');
      return;
    }
    if (contactoTieneHistorial(id)) {
      alert('Este contacto tiene presupuestos, facturas o apuntes asociados. No se puede eliminar, solo desactivar.');
      return;
    }
  }

  if (!confirm('Eliminar definitivamente a "' + contacto.nombre_contacto + '"? Esto no se puede deshacer.')) return;

  await borrarRegistro('clientes', id, pintarListaFiltrada, null);
}

// ============================================================
// 5. FICHA DE DETALLE (modal)
// ============================================================

function abrirFichaContacto(id) {
  const c = estado.clientes.find(function (x) { return String(x.id) === String(id); });
  if (!c) return;

  const fondo = document.createElement('div');
  fondo.className = 'cli-modal-fondo';
  fondo.innerHTML =
    '<div class="cli-modal">' +
      '<div class="cli-modal-cabecera">' +
        htmlIconoContacto(c.icono, 44) +
        '<div>' +
          '<p class="cli-modal-titulo">' + escaparHtml(c.nombre_contacto) + '</p>' +
          '<p class="cli-modal-subtitulo">' + metaLinea(c) + '</p>' +
        '</div>' +
        '<button type="button" class="cli-modal-cerrar" aria-label="Cerrar"><i class="ti ti-x"></i></button>' +
      '</div>' +
      '<div class="cli-modal-cuerpo">' +
        '<div class="cli-ficha-dato"><span>Nombre fiscal</span><span>' + escaparHtml(c.nombre_fiscal || '—') + '</span></div>' +
        '<div class="cli-ficha-dato"><span>NIF</span><span>' + escaparHtml(c.nif || '—') + '</span></div>' +
        '<div class="cli-ficha-dato"><span>Dirección</span><span>' + escaparHtml(cliDireccionLinea(c)) + '</span></div>' +
        '<div class="cli-ficha-dato"><span>Provincia</span><span>' + escaparHtml(c.provincia || '—') + '</span></div>' +
        '<div class="cli-ficha-dato"><span>Email</span><span>' + enlaceMail(c.mail) + '</span></div>' +
        '<div class="cli-ficha-dato"><span>Teléfono</span><span>' + enlaceTelefono(c.telefono) + '</span></div>' +
      '</div>' +
      '<div class="cli-modal-pie">' +
        '<button type="button" class="boton-secundario" id="cli-ficha-editar">Editar</button>' +
        (cliPuedeSerClienteDePresupuesto(c)
          ? '<button type="button" class="boton-principal" id="cli-ficha-nuevo-presupuesto">Nuevo presupuesto</button>'
          : '') +
      '</div>' +
    '</div>';

  document.body.appendChild(fondo);
  fondo.addEventListener('click', function (ev) { if (ev.target === fondo) fondo.remove(); });
  fondo.querySelector('.cli-modal-cerrar').addEventListener('click', function () { fondo.remove(); });
  fondo.querySelector('#cli-ficha-editar').addEventListener('click', function () {
    fondo.remove();
    abrirFormularioContacto(id);
  });
  // Presupuestos (mod-presupuestos.js) expone abrirFormularioPresupuesto()
  // de forma global; si ese módulo aún no está cargado, el botón ni
  // siquiera se pinta (ver cliPuedeSerClienteDePresupuesto).
  fondo.querySelector('#cli-ficha-nuevo-presupuesto')?.addEventListener('click', function () {
    fondo.remove();
    abrirFormularioPresupuesto(null, { id_cliente_prefill: c.id });
  });
}

// Solo contactos activos con rol cliente o "ambos" pueden recibir un
// presupuesto (mismo filtro que preClientesDisponibles() en
// mod-presupuestos.js). Si ese módulo todavía no está cargado en esta
// pantalla, el botón no se ofrece.
function cliPuedeSerClienteDePresupuesto(c) {
  if (typeof abrirFormularioPresupuesto !== 'function') return false;
  if (c.estado !== 'activo') return false;
  return c.rol === 'cliente' || c.rol === 'ambos';
}

// ============================================================
// 6. FORMULARIO (crear / editar)
// ============================================================

function abrirFormularioContacto(id, prefill) {
  const editando = !!id;
  const original = editando ? estado.clientes.find(function (c) { return String(c.id) === String(id); }) : null;
  if (editando && !original) return;

  const rolForzado = prefill && prefill.rolForzado;
  const datos = Object.assign({
    nombre_contacto: '', nombre_fiscal: '', nif: '', calle: '', numero: '', codigo_postal: '',
    poblacion: '', provincia: '', telefono: '', mail: '', tipo: '', rol: rolForzado || 'cliente',
    estado: 'activo', icono: ICONO_CONTACTO_DEFECTO
  }, original || {}, prefill && prefill.valores ? prefill.valores : {});

  const titulo = editando ? 'Editar contacto' : (datos.rol === 'proveedor' ? 'Nuevo proveedor' : 'Nuevo cliente');

  const fondo = document.createElement('div');
  fondo.className = 'cli-modal-fondo';
  fondo.innerHTML =
    '<div class="cli-modal ancho">' +
      '<div class="cli-modal-cabecera">' +
        '<p class="cli-modal-titulo" id="cli-form-titulo">' + escaparHtml(titulo) + '</p>' +
        '<button type="button" class="cli-modal-cerrar" aria-label="Cerrar"><i class="ti ti-x"></i></button>' +
      '</div>' +
      '<div class="cli-modal-cuerpo">' +
        '<form id="cli-form">' +
          campoIconoContacto(datos.icono) +
          '<div class="cli-form-grid dos-columnas">' +
            campoForm('nombre_contacto', 'Nombre de contacto', datos.nombre_contacto, true) +
            campoForm('nombre_fiscal', 'Nombre fiscal', datos.nombre_fiscal, true) +
            selectorTipo(datos.tipo, datos.rol) +
            selectorRol(datos.rol, !!rolForzado) +
            campoForm('telefono', 'Teléfono', datos.telefono) +
            campoForm('mail', 'Email', datos.mail, false, 'email') +
            campoForm('nif', 'NIF', datos.nif) +
            campoForm('codigo_postal', 'Código postal', datos.codigo_postal) +
            campoForm('calle', 'Calle', datos.calle) +
            campoForm('numero', 'Número', datos.numero) +
            campoForm('poblacion', 'Población', datos.poblacion) +
            campoForm('provincia', 'Provincia', datos.provincia) +
          '</div>' +
        '</form>' +
      '</div>' +
      '<div class="cli-modal-pie">' +
        '<button type="button" class="boton-secundario" id="cli-form-cancelar">Cancelar</button>' +
        '<button type="submit" form="cli-form" class="boton-principal" id="cli-form-guardar">Guardar</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(fondo);
  fondo.addEventListener('click', function (ev) { if (ev.target === fondo) fondo.remove(); });
  fondo.querySelector('.cli-modal-cerrar').addEventListener('click', function () { fondo.remove(); });
  fondo.querySelector('#cli-form-cancelar').addEventListener('click', function () { fondo.remove(); });

  const selectRol = fondo.querySelector('#campo-rol');
  if (rolForzado) {
    // Bloqueado de verdad (no se puede abrir ni cambiar), pero sin usar
    // "disabled": así FormData sigue enviando su valor al guardar.
    selectRol.addEventListener('mousedown', function (ev) { ev.preventDefault(); });
    selectRol.addEventListener('keydown', function (ev) { ev.preventDefault(); });
    selectRol.tabIndex = -1;
    selectRol.style.opacity = '0.6';
    selectRol.style.cursor = 'not-allowed';
  }
  selectRol.addEventListener('change', function () {
    actualizarSelectorTipo(fondo, selectRol.value);
    fondo.querySelector('#cli-form-titulo').textContent = editando ? 'Editar contacto' : (selectRol.value === 'proveedor' ? 'Nuevo proveedor' : 'Nuevo cliente');
  });

  const campoIcono = fondo.querySelector('#campo-icono-elegido');
  campoIcono.addEventListener('click', async function () {
    const elegido = await abrirSelectorIcono(campoIcono.dataset.icono);
    if (!elegido) return;
    campoIcono.dataset.icono = elegido;
    campoIcono.innerHTML = htmlIconoContacto(elegido) + '<span>' + escaparHtml(tituloIconoContacto(elegido)) + ' — toca para cambiarlo</span>';
  });

  fondo.querySelector('#cli-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    procesarGuardadoContacto(fondo, id, original, prefill);
  });

  setTimeout(function () {
    const campoNombre = fondo.querySelector('#campo-nombre');
    if (campoNombre) campoNombre.focus();
  }, 50);
}

function campoIconoContacto(idIcono) {
  return '<div class="campo-grupo" style="margin-bottom:12px">' +
    '<label>Icono</label>' +
    '<div class="campo-icono-elegido" id="campo-icono-elegido" data-icono="' + escaparHtml(idIcono || ICONO_CONTACTO_DEFECTO) + '">' +
      htmlIconoContacto(idIcono) +
      '<span>' + escaparHtml(tituloIconoContacto(idIcono || ICONO_CONTACTO_DEFECTO)) + ' — toca para cambiarlo</span>' +
    '</div>' +
  '</div>';
}

function campoForm(clave, etiqueta, valor, requerido, tipo, claseExtra) {
  return '<div class="campo-grupo' + (claseExtra ? ' ' + claseExtra : '') + '">' +
    '<label for="campo-' + clave + '">' + escaparHtml(etiqueta) + (requerido ? ' *' : '') + '</label>' +
    '<input class="campo" id="campo-' + clave + '" name="' + clave + '" type="' + (tipo || 'text') + '"' +
      (requerido ? ' required' : '') + ' value="' + escaparHtml(valor || '') + '">' +
    '<p class="cli-mensaje-error" data-error-de="' + clave + '" hidden></p>' +
  '</div>';
}

// El rol puede venir "fijado" (al crear rápido un cliente o proveedor
// desde Presupuestos o Facturas). En ese caso se bloquea para que no
// se pueda cambiar, PERO sin usar el atributo "disabled" en el propio
// <select>: un <select> deshabilitado no envía su valor al leer el
// formulario con FormData, así que el contacto se guardaría siempre
// con el rol vacío. En su lugar, se deja el <select> habilitado pero
// se deshabilita cada <option> salvo la elegida: el resultado visual
// es el mismo (no se puede cambiar), pero el valor sí viaja al guardar.
function selectorRol(valor, bloqueado) {
  const opciones = [['cliente', 'Cliente'], ['proveedor', 'Proveedor'], ['ambos', 'Cliente y proveedor']];
  return '<div class="campo-grupo">' +
    '<label for="campo-rol">Rol *</label>' +
    '<select class="campo" id="campo-rol" name="rol"' + (bloqueado ? ' aria-readonly="true"' : '') + '>' +
      opciones.map(function (o) {
        const esElElegido = o[0] === valor;
        return '<option value="' + o[0] + '"' + (esElElegido ? ' selected' : '') +
          (bloqueado && !esElElegido ? ' disabled' : '') + '>' + o[1] + '</option>';
      }).join('') +
    '</select>' +
  '</div>';
}

function selectorTipo(valor, rol) {
  const deshabilitado = rol === 'proveedor';
  const tipos = cliTiposCliente();
  return '<div class="campo-grupo" id="grupo-tipo">' +
    '<label for="campo-tipo">Tipo de cliente' + (deshabilitado ? '' : ' *') + '</label>' +
    '<select class="campo" id="campo-tipo" name="tipo"' + (deshabilitado ? ' disabled' : '') + '>' +
      (deshabilitado ? '<option value="">—</option>' : '<option value="">Selecciona...</option>') +
      tipos.map(function (t) { return '<option value="' + t.nombre + '"' + (t.nombre === valor ? ' selected' : '') + '>' + escaparHtml(t.etiqueta) + '</option>'; }).join('') +
    '</select>' +
    '<p class="cli-mensaje-error" data-error-de="tipo" hidden></p>' +
  '</div>';
}

function actualizarSelectorTipo(fondo, rol) {
  const grupo = fondo.querySelector('#grupo-tipo');
  const nuevo = document.createElement('div');
  nuevo.innerHTML = selectorTipo(rol === 'proveedor' ? '' : fondo.querySelector('#campo-tipo').value, rol);
  grupo.replaceWith(nuevo.firstElementChild);
}

// ============================================================
// 7. GUARDADO, CON LA REGLA DEL NIF
// ============================================================

function mostrarErrorCampo(fondo, campo, mensaje) {
  const input = fondo.querySelector('#campo-' + campo);
  const p = fondo.querySelector('[data-error-de="' + campo + '"]');
  if (input) input.classList.add('cli-campo-error');
  if (p) { p.textContent = mensaje; p.hidden = false; }
}

function limpiarErroresForm(fondo) {
  fondo.querySelectorAll('.cli-campo-error').forEach(function (el) { el.classList.remove('cli-campo-error'); });
  fondo.querySelectorAll('[data-error-de]').forEach(function (el) { el.hidden = true; });
}

async function procesarGuardadoContacto(fondo, id, original, prefill) {
  limpiarErroresForm(fondo);
  const form = fondo.querySelector('#cli-form');
  const fd = new FormData(form);
  const datos = {
    nombre_contacto: (fd.get('nombre_contacto') || '').trim(),
    nombre_fiscal: (fd.get('nombre_fiscal') || '').trim(),
    nif: (fd.get('nif') || '').trim(),
    calle: (fd.get('calle') || '').trim(),
    numero: (fd.get('numero') || '').trim(),
    codigo_postal: (fd.get('codigo_postal') || '').trim(),
    poblacion: (fd.get('poblacion') || '').trim(),
    provincia: (fd.get('provincia') || '').trim(),
    telefono: (fd.get('telefono') || '').trim(),
    mail: (fd.get('mail') || '').trim(),
    rol: fd.get('rol'),
    tipo: fd.get('rol') === 'proveedor' ? '' : (fd.get('tipo') || ''),
    icono: fondo.querySelector('#campo-icono-elegido').dataset.icono || ICONO_CONTACTO_DEFECTO,
    estado: original ? original.estado : 'activo'
  };
  if (original) datos.id = original.id;

  let valido = true;
  if (!datos.nombre_contacto) { mostrarErrorCampo(fondo, 'nombre_contacto', 'Obligatorio'); valido = false; }
  if (!datos.nombre_fiscal) { mostrarErrorCampo(fondo, 'nombre_fiscal', 'Obligatorio'); valido = false; }
  if ((datos.rol === 'cliente' || datos.rol === 'ambos') && !datos.tipo) {
    mostrarErrorCampo(fondo, 'tipo', 'Obligatorio para clientes'); valido = false;
  }
  if (!valido) return;

  // ---- Regla del NIF (mapa 6.5, revisada 01/09/2026 — ver diario) ----
  if (datos.nif) {
    const nifNorm = normaliseNif(datos.nif);
    const existente = estado.clientes.find(function (c) {
      return normaliseNif(c.nif) === nifNorm && String(c.id) !== String(datos.id || '');
    });

    if (existente) {
      await gestionarNifDuplicado(existente, datos, fondo, prefill, original);
      return; // el diálogo ya se ha encargado de todo (guardar, editar, fusionar o cancelar)
    }
  }

  const boton = fondo.querySelector('#cli-form-guardar');
  boton.disabled = true;
  boton.textContent = 'Guardando...';

  const resultado = await guardarRegistro('clientes', datos, pintarListaFiltrada, function () { fondo.remove(); });

  if (resultado.status === 'success' && prefill && typeof prefill.alCrear === 'function') {
    prefill.alCrear(resultado.data || datos);
  }
}

// ---- Regla del NIF: helpers de rol ----

function rolEtiqueta(rol) {
  return rol === 'ambos' ? 'cliente y proveedor' : (rol === 'cliente' ? 'cliente' : 'proveedor');
}

// ¿El rol existente ya incluye todo lo que pide el rol nuevo?
function rolYaCubierto(rolExistente, rolNuevo) {
  if (rolExistente === 'ambos') return true;
  return rolExistente === rolNuevo;
}

// Qué rol falta añadir al existente para cubrir lo que se pide ahora.
function rolQueFalta(rolExistente, rolNuevo) {
  const necesitaCliente = rolNuevo === 'cliente' || rolNuevo === 'ambos';
  const necesitaProveedor = rolNuevo === 'proveedor' || rolNuevo === 'ambos';
  const tieneCliente = rolExistente === 'cliente' || rolExistente === 'ambos';
  const tieneProveedor = rolExistente === 'proveedor' || rolExistente === 'ambos';
  if (necesitaCliente && !tieneCliente) return 'cliente';
  if (necesitaProveedor && !tieneProveedor) return 'proveedor';
  return null;
}

// Si el existente está inactivo, pregunta si reactivarlo. Devuelve el
// contacto (posiblemente con estado:'activo') listo para guardar.
async function posiblementeReactivar(contacto) {
  if (contacto.estado !== 'inactivo') return contacto;
  const reactivar = await mostrarDialogoOpciones(
    'Contacto inactivo',
    '"' + contacto.nombre_contacto + '" está desactivado. ¿Quieres reactivarlo?',
    [{ id: 'si', texto: 'Reactivar', tipo: 'principal' }, { id: 'no', texto: 'Dejarlo inactivo' }]
  );
  return reactivar === 'si' ? Object.assign({}, contacto, { estado: 'activo' }) : contacto;
}

// Punto central: decide qué ofrecer según si el NIF ya existe en la
// misma categoría (o más amplia) o en una categoría cruzada.
// `original` es el contacto que se estaba editando (null si es alta
// nueva) — cuando existe, se ofrece FUSIONAR las dos fichas en una,
// en vez de "usar/editar el existente" (ya se está editando uno).
async function gestionarNifDuplicado(existente, datosNuevos, fondo, prefill, original) {
  if (rolYaCubierto(existente.rol, datosNuevos.rol)) {
    if (original) {
      // Editando: el NIF que has puesto coincide con otra ficha ya
      // en la misma categoría — probablemente están duplicados.
      const eleccion = await mostrarDialogoOpciones(
        'Ese NIF ya existe',
        'Ya existe otro/a ' + rolEtiqueta(existente.rol) + ' con este NIF: "' + existente.nombre_contacto +
          '". Puede que estén duplicados. ¿Qué quieres hacer?',
        [
          { id: 'fusionar', texto: 'Fusionar en "' + existente.nombre_contacto + '"', tipo: 'principal' },
          { id: 'ver', texto: 'Ver la otra ficha' },
          { id: 'cancelar', texto: 'Cancelar, seguir editando' }
        ]
      );

      if (eleccion === 'fusionar') {
        await fusionarEnExistente(existente, original, fondo);
        return;
      }
      if (eleccion === 'ver') {
        fondo.remove();
        abrirFichaContacto(existente.id);
        return;
      }
      return; // cancelar: se queda en el formulario, nada se guarda
    }

    const eleccion = await mostrarDialogoOpciones(
      'Ese NIF ya existe',
      'Ya existe un/a ' + rolEtiqueta(existente.rol) + ' con este NIF: "' + existente.nombre_contacto + '".',
      [
        { id: 'usar', texto: 'Usar el existente', tipo: 'principal' },
        { id: 'editar', texto: 'Editar el existente' },
        { id: 'cancelar', texto: 'Cancelar' }
      ]
    );

    if (eleccion === 'usar') {
      fondo.remove();
      abrirFichaContacto(existente.id);
      if (prefill && typeof prefill.alCrear === 'function') prefill.alCrear(existente);
      return;
    }
    if (eleccion === 'editar') {
      fondo.remove();
      abrirFormularioContacto(existente.id);
      return;
    }
    return; // cancelar o cerrar: se queda en el formulario
  }

  // Categoría cruzada: se ofrece añadir el rol que falta
  const faltante = rolQueFalta(existente.rol, datosNuevos.rol);
  const mensajeBase = 'Ya existe un/a ' + rolEtiqueta(existente.rol) + ' con este NIF: "' + existente.nombre_contacto + '".';

  if (original) {
    const eleccion = await mostrarDialogoOpciones(
      'Ese NIF ya existe',
      mensajeBase + ' ¿Quieres fusionar esta ficha con esa (quedará como cliente y proveedor), o puede que estén duplicados por error?',
      [
        { id: 'fusionar', texto: 'Fusionar con "' + existente.nombre_contacto + '"', tipo: 'principal' },
        { id: 'ver', texto: 'Ver la otra ficha' },
        { id: 'cancelar', texto: 'Cancelar, seguir editando' }
      ]
    );
    if (eleccion === 'fusionar') {
      await fusionarEnExistente(existente, original, fondo);
      return;
    }
    if (eleccion === 'ver') {
      fondo.remove();
      abrirFichaContacto(existente.id);
    }
    return;
  }

  const eleccion = await mostrarDialogoOpciones(
    'Ese NIF ya existe',
    mensajeBase + ' ¿Quieres añadirlo también como ' + faltante + '? Quedará registrado como cliente y proveedor.',
    [
      { id: 'anadir', texto: 'Añadir rol de ' + faltante, tipo: 'principal' },
      { id: 'cancelar', texto: 'Cancelar' }
    ]
  );

  if (eleccion === 'anadir') {
    let fusionado = Object.assign({}, existente, { rol: 'ambos' });
    if (!existente.tipo && datosNuevos.tipo) fusionado.tipo = datosNuevos.tipo;
    fusionado = await posiblementeReactivar(fusionado);

    const resultado = await guardarRegistro('clientes', fusionado, pintarListaFiltrada, function () { fondo.remove(); });
    if (resultado.status === 'success' && prefill && typeof prefill.alCrear === 'function') {
      prefill.alCrear(resultado.data || fusionado);
    }
  }
}

// Fusiona la ficha que se estaba editando (`original`) dentro de la
// ficha ya existente con el mismo NIF: combina roles y tipo, y borra
// la ficha que sobra (la que se estaba editando), siempre que no
// tenga historial propio — si lo tiene, se avisa y no se hace nada,
// para no perder la trazabilidad de presupuestos/facturas antiguos.
async function fusionarEnExistente(existente, original, fondo) {
  if (contactoTieneHistorial(original.id)) {
    alert('"' + original.nombre_contacto + '" tiene presupuestos, facturas o apuntes asociados. No se puede fusionar automáticamente — habría que mover ese historial a mano primero.');
    return;
  }

  abrirComparacionFusion(existente, original, fondo);
}

// ---- Pantalla de comparación: elige, campo a campo, qué versión se
// queda. Los campos donde ambas fichas coinciden no se muestran. ----

const CAMPOS_FUSION = [
  ['nombre_contacto', 'Nombre de contacto'], ['nombre_fiscal', 'Nombre fiscal'], ['nif', 'NIF'],
  ['calle', 'Calle'], ['numero', 'Número'], ['codigo_postal', 'Código postal'],
  ['poblacion', 'Población'], ['provincia', 'Provincia'],
  ['telefono', 'Teléfono'], ['mail', 'Email'], ['tipo', 'Tipo de cliente']
];

function valorFusionHtml(v) {
  return v ? escaparHtml(v) : '<span class="cli-fusion-valor vacio">(vacío)</span>';
}

function abrirComparacionFusion(existente, original, fondoFormulario) {
  const diferentes = CAMPOS_FUSION.filter(function (c) { return (existente[c[0]] || '') !== (original[c[0]] || ''); });

  const fondo = document.createElement('div');
  fondo.className = 'cli-modal-fondo';
  fondo.innerHTML =
    '<div class="cli-modal ancho">' +
      '<div class="cli-modal-cabecera">' +
        '<p class="cli-modal-titulo">Comparar antes de fusionar</p>' +
        '<button type="button" class="cli-modal-cerrar" aria-label="Cerrar"><i class="ti ti-x"></i></button>' +
      '</div>' +
      '<div class="cli-modal-cuerpo">' +
        '<p class="cli-fusion-intro">Se quedará una sola ficha, con el nombre de "' + escaparHtml(existente.nombre_contacto) +
          '". Elige qué valor quieres conservar en cada dato distinto — el resto de campos donde coinciden no cambian.</p>' +
        (diferentes.length === 0
          ? '<p class="cli-fusion-igual">Todos los campos coinciden, no hay nada que elegir.</p>'
          : diferentes.map(function (c) { return renderFusionFila(c, existente, original); }).join('')) +
      '</div>' +
      '<div class="cli-modal-pie">' +
        '<button type="button" class="boton-secundario" id="fusion-cancelar">Cancelar</button>' +
        '<button type="button" class="boton-principal" id="fusion-confirmar">Fusionar</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(fondo);
  fondo.addEventListener('click', function (ev) { if (ev.target === fondo) fondo.remove(); });
  fondo.querySelector('.cli-modal-cerrar').addEventListener('click', function () { fondo.remove(); });
  fondo.querySelector('#fusion-cancelar').addEventListener('click', function () { fondo.remove(); });

  fondo.querySelector('#fusion-confirmar').addEventListener('click', async function () {
    const elegido = Object.assign({}, existente);
    diferentes.forEach(function (c) {
      const marcado = fondo.querySelector('input[name="fusion-' + c[0] + '"]:checked');
      elegido[c[0]] = marcado ? marcado.value : existente[c[0]];
    });
    if (!rolYaCubierto(existente.rol, original.rol)) elegido.rol = 'ambos';

    const boton = fondo.querySelector('#fusion-confirmar');
    boton.disabled = true;
    boton.textContent = 'Fusionando...';

    const resultado = await guardarRegistro('clientes', elegido, pintarListaFiltrada, null);
    if (resultado.status !== 'success') { boton.disabled = false; boton.textContent = 'Fusionar'; return; }

    await borrarRegistro('clientes', original.id, pintarListaFiltrada, function () {
      fondo.remove();
      fondoFormulario.remove();
    });
  });
}

function renderFusionFila(campo, existente, original) {
  const clave = campo[0], etiqueta = campo[1];
  return '<div class="cli-fusion-fila">' +
    '<span class="cli-fusion-etiqueta">' + escaparHtml(etiqueta) + '</span>' +
    '<div class="cli-fusion-opciones">' +
      '<label class="cli-fusion-opcion"><input type="radio" name="fusion-' + clave + '" value="' + escaparHtml(existente[clave] || '') + '" checked>' +
        '<span class="cli-fusion-valor">' + valorFusionHtml(existente[clave]) + '</span></label>' +
      '<label class="cli-fusion-opcion"><input type="radio" name="fusion-' + clave + '" value="' + escaparHtml(original[clave] || '') + '">' +
        '<span class="cli-fusion-valor">' + valorFusionHtml(original[clave]) + '</span></label>' +
    '</div>' +
  '</div>';
}

// ============================================================
// 8. PUNTO DE ENTRADA PARA OTROS MÓDULOS (mapa 6.8)
// ============================================================
// Presupuestos y Facturas (todavía no existen) podrán llamar a esto
// para crear un contacto rápido sin salir de su formulario:
//   abrirCreacionRapidaContacto('proveedor', function (contacto) {...})

function abrirCreacionRapidaContacto(rolForzado, alCrear) {
  abrirFormularioContacto(null, { rolForzado: rolForzado, alCrear: alCrear });
}

// ============================================================
// 9. REGISTRO COMO VISTA
// ============================================================

registrarVista('clientes', {
  titulo: 'Clientes',
  pintar: pintarClientes
});
