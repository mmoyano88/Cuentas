/**
 * MÓDULO FACTURAS DE VENTA
 * ------------------------------------------------------------
 * Sigue el patrón de lista + ficha de mod-clientes.js y
 * mod-presupuestos.js.
 *
 * Reglas propias de este módulo:
 * - La ficha de detalle (solo lectura) SÍ se cierra al tocar fuera.
 * - El formulario NO se cierra al tocar fuera: solo con su botón de
 *   cerrar o con Cancelar (hay trabajo dentro que se puede perder).
 * - Estados en minúscula siempre (decisión I3): `estado`
 *   (pendiente/pagada) y `estado_registro` (activo/inactivo).
 * - Las facturas no se borran nunca, solo se desactivan/reactivan.
 * - Marcar Pagada/Pendiente y Desactivar/Reactivar generan o borran
 *   automáticamente el apunte de tesorería correspondiente (mapa 9.7).
 *
 * SIMPLIFICACIÓN 07/09/2026 (GUÍA sección 20) — sustituye al diseño
 * anterior de líneas de detalle:
 * - Una factura tiene CONCEPTO (frase corta), DESCRIPCIÓN (varias
 *   líneas) y un único importe, que ES la base imponible. Se acabaron
 *   las líneas de detalle y la hoja `ventas_detalle`.
 * - Aquí NO se aplica el ajuste por tipo de cliente ni la compensación
 *   del 20% de IRPF: esos ajustes viven solo en Presupuestos, que es
 *   donde se decide el precio. La cifra que se escribe ya es la final.
 * - Sobre la base se aplican descuento especial (si lo hay), IVA y
 *   retención de IRPF (si la hay).
 * - Motivo del cambio: las facturas guardaban el importe en dos sitios
 *   que debían cuadrar entre sí (las líneas, sin ajustar, y `base`, ya
 *   ajustada), y mantenerlos sincronizados fue el origen de varios
 *   fallos. Con un solo importe, el problema desaparece de raíz.
 * - Las columnas `subtotal`, `ajuste_cliente_*` y `compensacion_irpf_*`
 *   se conservan en la hoja (para no romper facturas antiguas) pero se
 *   guardan a cero en las nuevas.
 */

// ============================================================
// 0. ESTADO PROPIO DEL MÓDULO
// ============================================================

let fvArea = 'ventas';          // esta pantalla comparte "Facturas" con Compras
let fvFiltroEstado = 'todos';   // 'todos' | 'pendiente' | 'pagada'
let fvFiltroRegistro = 'activas'; // 'activas' | 'todas' | 'inactivas'
let fvOrden = 'fecha-desc';
let fvBusqueda = '';

// Prefijo de la serie de numeración. Hoy solo hay una serie (decisión
// M2): cuando existan varias, este valor vendrá de la serie elegida.
// Mismo planteamiento que PRE_PREFIJO_SERIE en Presupuestos.
const FV_PREFIJO_SERIE = 'F';

// Estado de sincronización de cada factura, para el punto de color de
// la lista. Mismo patrón que preSyncEstados en Presupuestos.
const fvSyncEstados = {};
const fvPendientes = {};

function fvMarcarSync(id, valor) {
  if (!id) return;
  if (valor) fvSyncEstados[String(id)] = valor;
  else delete fvSyncEstados[String(id)];
}

function fvEstadoSync(f) {
  const marcado = fvSyncEstados[String(f.id)];
  if (marcado) return marcado;
  if (esDePrueba(f)) return 'prueba';
  return 'ok';
}

const FV_PUNTOS = {
  ok:        { clase: 'ok',        titulo: 'Guardado en la base de datos' },
  guardando: { clase: 'guardando', titulo: 'Guardando...' },
  error:     { clase: 'error',     titulo: 'No se pudo guardar. Abre "Más opciones" y reintenta.' },
  prueba:    { clase: 'prueba',    titulo: 'Solo en este dispositivo (modo prueba)' }
};

function fvPuntoEstado(f) {
  const info = FV_PUNTOS[fvEstadoSync(f)] || FV_PUNTOS.ok;
  return '<span class="fv-punto ' + info.clase + '" title="' + escaparHtml(info.titulo) + '"></span>';
}

const FV_ESTADOS = {
  pendiente: { etiqueta: 'Pendiente', clase: 'ind-ambar' },
  pagada:    { etiqueta: 'Pagada',    clase: 'ind-verde' }
};

// ============================================================
// 1. UTILIDADES DEL MÓDULO
// ============================================================

function fvIniciales(texto) {
  const limpio = String(texto || '').trim();
  if (!limpio) return '?';
  const partes = limpio.split(/\s+/);
  return (partes[0][0] + (partes[1] ? partes[1][0] : '')).toUpperCase();
}

function fvNuevoId(prefijo) {
  if (estado.modoPrueba) return generarIdPrueba(prefijo);
  return prefijo + '-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e9).toString(36);
}

// Numeración F{AÑO}/{0000} (mapa 9.1). Solo cuentan las facturas con
// estado_registro === 'activo' (decisión B1: una factura desactivada
// libera su número, tal como confirmaste — no es riesgo fiscal).
function fvSiguienteNumero() {
  const anio = new Date().getFullYear();
  const patron = new RegExp('^' + FV_PREFIJO_SERIE + anio + '\\/(\\d{4})$');
  let mayor = 0;
  estado.ventas.forEach(function (f) {
    if (String(f.estado_registro || '').toLowerCase() !== 'activo') return;
    const m = String(f.numero || '').match(patron);
    if (m) mayor = Math.max(mayor, parseInt(m[1], 10));
  });
  return FV_PREFIJO_SERIE + anio + '/' + String(mayor + 1).padStart(4, '0');
}

function fvPastillaEstado(valor) {
  const info = FV_ESTADOS[String(valor)] || FV_ESTADOS.pendiente;
  return '<span class="pastilla ' + info.clase + '">' + info.etiqueta + '</span>';
}

function fvClienteDe(f) {
  return estado.clientes.find(function (c) { return String(c.id) === String(f.id_cliente); }) || null;
}

// Contactos que pueden ser cliente de una factura — mismo filtro que
// Presupuestos (mapa 8.3 / 9.5).
function fvClientesDisponibles() {
  return estado.clientes.filter(function (c) {
    if (c.estado !== 'activo') return false;
    if (c.rol !== 'cliente' && c.rol !== 'ambos') return false;
    if (!estado.modoPrueba && esDePrueba(c)) return false;
    return true;
  }).sort(function (a, b) {
    return String(a.nombre_contacto || '').localeCompare(String(b.nombre_contacto || ''), 'es');
  });
}

function fvTextoBusqueda(f) {
  return normalizarBusqueda([
    f.numero, f.cliente, f.nif, f.concepto, mostrarFecha(f.fecha), f.estado,
    formatMoney(f.total), formatMoney(f.base)
  ].filter(Boolean).join(' '));
}

function fvEstaActiva(f) {
  return String(f.estado_registro || 'activo').toLowerCase() !== 'inactivo';
}

// ============================================================
// 2. LECTURA DE CONFIGURACIÓN — mismas fuentes que Presupuestos
// ============================================================
// Se reutilizan tal cual las funciones ya construidas en Presupuestos
// (preTiposIva, preTiposIrpf...): viven en mod-presupuestos.js,
// cargado antes que este módulo. No se duplican aquí para no tener
// dos fuentes de verdad distintas.
//
// Ya NO se lee la compensación de IRPF ni el factor de tipo de
// cliente (simplificación 07/09/2026, GUÍA 20): esos ajustes se
// aplican solo en presupuestos. En facturas, la base imponible se
// introduce directamente.

// ============================================================
// 4. PINTADO PRINCIPAL (selector Ventas / Compras)
// ============================================================
// El área "compras" todavía no existe como módulo: por ahora, si se
// pulsa, se avisa de que está pendiente. Cuando se construya Facturas
// de compra, aquí se enlazará su propio pintado.

function pintarFacturas() {
  const contenido = document.getElementById('contenido');
  if (!contenido) return;

  contenido.innerHTML =
    '<div class="fv-cabecera-lista">' +
      '<div class="fv-selector" id="fv-selector">' +
        '<button type="button" data-area="ventas">Ventas</button>' +
        '<button type="button" data-area="compras">Compras</button>' +
      '</div>' +
      '<button type="button" class="fv-flotante" id="fv-btn-nuevo" aria-label="Nueva factura"><i class="ti ti-plus"></i></button>' +
    '</div>' +
    '<div id="fv-zona"></div>';

  document.getElementById('fv-selector').querySelectorAll('[data-area]').forEach(function (b) {
    b.classList.toggle('activa', b.dataset.area === fvArea);
    b.addEventListener('click', function () {
      if (b.dataset.area === 'compras' && typeof pintarFacturasCompra !== 'function') {
        alert('El módulo de Facturas de compra todavía no está construido.');
        return;
      }
      fvArea = b.dataset.area;
      pintarFacturas();
    });
  });

  document.getElementById('fv-btn-nuevo').addEventListener('click', function () {
    if (fvArea === 'compras') abrirFormularioFacturaCompra(null);
    else abrirFormularioFacturaVenta(null);
  });

  if (fvArea === 'compras' && typeof pintarFacturasCompra === 'function') {
    pintarFacturasCompra();
  } else {
    pintarRelacionFacturasVenta();
  }
}

// ============================================================
// 5. LISTA DE FACTURAS DE VENTA
// ============================================================

function pintarRelacionFacturasVenta() {
  const zona = document.getElementById('fv-zona');
  if (!zona) return;

  zona.innerHTML =
    '<div class="fv-barra" style="position:relative">' +
      '<input type="text" class="fv-buscador" id="fv-buscador" placeholder="Buscar..." value="' + escaparHtml(fvBusqueda) + '">' +
      '<button type="button" class="fv-btn-filtro' + ((fvFiltroEstado !== 'todos' || fvFiltroRegistro !== 'activas') ? ' con-filtro' : '') + '" id="fv-btn-filtro"><i class="ti ti-filter"></i></button>' +
      fvRenderFiltrosPanel() +
    '</div>' +
    '<div id="fv-lista-contenedor"></div>';

  fvCablearBarra();
  fvRepintarLista();
}

function fvRenderFiltrosPanel() {
  const estados = [['todos', 'Todos'], ['pendiente', 'Pendientes'], ['pagada', 'Pagadas']];
  const registros = [['activas', 'Activas'], ['inactivas', 'Inactivas'], ['todas', 'Todas']];
  const ordenes = [
    ['fecha-desc', 'Fecha (más nuevo primero)'],
    ['fecha-asc', 'Fecha (más antiguo primero)'],
    ['numero-desc', 'Número (mayor primero)'],
    ['total-desc', 'Importe (mayor primero)']
  ];

  return '<div class="fv-filtros-panel" id="fv-filtros-panel">' +
    '<p class="fv-filtros-titulo">Estado</p>' +
    estados.map(function (op) {
      return '<button type="button" data-estado="' + op[0] + '"' +
        (op[0] === fvFiltroEstado ? ' class="activa"' : '') + '>' + escaparHtml(op[1]) + '</button>';
    }).join('') +
    '<p class="fv-filtros-titulo">Registro</p>' +
    registros.map(function (op) {
      return '<button type="button" data-registro="' + op[0] + '"' +
        (op[0] === fvFiltroRegistro ? ' class="activa"' : '') + '>' + escaparHtml(op[1]) + '</button>';
    }).join('') +
    '<p class="fv-filtros-titulo">Ordenar por</p>' +
    ordenes.map(function (op) {
      return '<button type="button" data-orden="' + op[0] + '"' +
        (op[0] === fvOrden ? ' class="activa"' : '') + '>' + escaparHtml(op[1]) + '</button>';
    }).join('') +
    '</div>';
}

function fvCablearBarra() {
  const buscador = document.getElementById('fv-buscador');
  const repintarConRetardo = conRetardo(fvRepintarLista, 180);
  buscador.addEventListener('input', function () {
    fvBusqueda = buscador.value;
    repintarConRetardo();
  });

  const btnFiltro = document.getElementById('fv-btn-filtro');
  const panel = document.getElementById('fv-filtros-panel');

  function cerrarPanel() {
    panel.classList.remove('abierto');
    document.removeEventListener('click', cerrarPanelSiFuera);
  }
  function cerrarPanelSiFuera(ev) {
    if (!panel.contains(ev.target) && ev.target !== btnFiltro && !btnFiltro.contains(ev.target)) cerrarPanel();
  }

  btnFiltro.addEventListener('click', function (ev) {
    ev.stopPropagation();
    const seVaAAbrir = !panel.classList.contains('abierto');
    panel.classList.toggle('abierto');
    if (seVaAAbrir) {
      setTimeout(function () { document.addEventListener('click', cerrarPanelSiFuera); }, 0);
    } else {
      document.removeEventListener('click', cerrarPanelSiFuera);
    }
  });

  panel.querySelectorAll('[data-estado]').forEach(function (b) {
    b.addEventListener('click', function () { fvFiltroEstado = b.dataset.estado; pintarRelacionFacturasVenta(); });
  });
  panel.querySelectorAll('[data-registro]').forEach(function (b) {
    b.addEventListener('click', function () { fvFiltroRegistro = b.dataset.registro; pintarRelacionFacturasVenta(); });
  });
  panel.querySelectorAll('[data-orden]').forEach(function (b) {
    b.addEventListener('click', function () { fvOrden = b.dataset.orden; pintarRelacionFacturasVenta(); });
  });
}

function fvListaFiltrada() {
  const texto = normalizarBusqueda(fvBusqueda);
  return estado.ventas.filter(function (f) {
    if (fvFiltroEstado !== 'todos' && String(f.estado) !== fvFiltroEstado) return false;
    if (fvFiltroRegistro === 'activas' && !fvEstaActiva(f)) return false;
    if (fvFiltroRegistro === 'inactivas' && fvEstaActiva(f)) return false;
    if (texto && fvTextoBusqueda(f).indexOf(texto) === -1) return false;
    return true;
  }).sort(function (a, b) {
    return compararRegistros(a, b, fvOrden);
  });
}

function fvRepintarLista() {
  const contenedor = document.getElementById('fv-lista-contenedor');
  if (!contenedor) return;
  const lista = fvListaFiltrada();

  if (lista.length === 0) {
    contenedor.innerHTML = '<p class="fv-vacio">' +
      (fvBusqueda || fvFiltroEstado !== 'todos' || fvFiltroRegistro !== 'activas'
        ? 'No hay resultados con estos filtros.'
        : 'Todavía no hay facturas de venta.') +
      '</p>';
    return;
  }

  contenedor.innerHTML =
    '<div class="fv-lista-movil">' + lista.map(fvRenderFilaMovil).join('') + '</div>' +
    '<div class="fv-tabla-wrap"><table class="fv-tabla"><thead><tr>' +
      '<th>Fecha</th><th>Número</th><th>Cliente</th><th>Concepto</th>' +
      '<th class="fv-celda-derecha">Base</th><th class="fv-celda-derecha">Total</th><th></th>' +
    '</tr></thead><tbody>' + lista.map(fvRenderFilaTabla).join('') + '</tbody></table></div>';

  fvCablearFilas(contenedor);
}

function fvRenderFilaMovil(f) {
  const inactiva = !fvEstaActiva(f);
  return '<div class="fv-fila' + (inactiva ? ' fv-fila-inactiva' : '') + '" data-id="' + escaparHtml(f.id) + '">' +
    htmlIconoContacto((fvClienteDe(f) || {}).icono, 42) +
    '<div class="fv-info">' +
      '<p class="fv-nombre">' + escaparHtml(f.cliente || '—') + '</p>' +
      '<p class="fv-meta">' + escaparHtml(f.numero || '—') + ' · ' + escaparHtml(mostrarFecha(f.fecha)) + (inactiva ? ' · Inactiva' : '') + '</p>' +
      '<p class="fv-meta">' + escaparHtml(f.concepto || '—') + '</p>' +
    '</div>' +
    '<div class="fv-derecha">' +
      '<span class="fv-total-fila">' + escaparHtml(formatMoney(f.total)) + '</span>' +
      '<button type="button" class="fv-pastilla-boton" data-estado-de="' + escaparHtml(f.id) + '">' +
        fvPastillaEstado(f.estado) +
      '</button>' +
    '</div>' +
    '<div class="fv-control">' +
      '<button type="button" class="fv-btn-icono" data-mas="' + escaparHtml(f.id) + '" aria-label="Más opciones"><i class="ti ti-dots-vertical"></i></button>' +
      fvPuntoEstado(f) +
    '</div>' +
  '</div>';
}

function fvRenderFilaTabla(f) {
  const inactiva = !fvEstaActiva(f);
  return '<tr class="fv-fila-tabla' + (inactiva ? ' fv-fila-inactiva' : '') + '" data-id="' + escaparHtml(f.id) + '">' +
    '<td>' + escaparHtml(mostrarFecha(f.fecha)) + '</td>' +
    '<td class="fv-celda-numero">' + escaparHtml(f.numero || '—') + (inactiva ? ' <span style="color:var(--texto-secundario);font-weight:400">(inactiva)</span>' : '') + '</td>' +
    '<td>' + escaparHtml(f.cliente || '—') + '</td>' +
    '<td class="fv-celda-concepto">' +
      '<div class="fv-concepto-texto">' + escaparHtml(f.concepto || '—') + '</div>' +
      '<button type="button" data-estado-de="' + escaparHtml(f.id) + '" style="border:none;background:none;padding:4px 0 0;cursor:pointer">' +
        fvPastillaEstado(f.estado) +
      '</button>' +
    '</td>' +
    '<td class="fv-celda-derecha">' + escaparHtml(formatMoney(f.base)) + '</td>' +
    '<td class="fv-celda-derecha">' + escaparHtml(formatMoney(f.total)) + '</td>' +
    '<td><div class="fv-control">' +
      '<button type="button" class="fv-btn-icono" data-mas="' + escaparHtml(f.id) + '" aria-label="Más opciones"><i class="ti ti-dots-vertical"></i></button>' +
      fvPuntoEstado(f) +
    '</div></td>' +
  '</tr>';
}

function fvCablearFilas(contenedor) {
  contenedor.querySelectorAll('.fv-fila, .fv-fila-tabla').forEach(function (fila) {
    fila.addEventListener('click', function (ev) {
      if (ev.target.closest('.fv-control')) return;
      if (ev.target.closest('[data-estado-de]')) return;
      abrirFichaFacturaVenta(fila.dataset.id);
    });
  });

  contenedor.querySelectorAll('[data-mas]').forEach(function (b) {
    b.addEventListener('click', function (ev) {
      ev.stopPropagation();
      fvAbrirMenuMas(b, b.dataset.mas);
    });
  });

  contenedor.querySelectorAll('[data-estado-de]').forEach(function (b) {
    b.addEventListener('click', function (ev) {
      ev.stopPropagation();
      fvCambiarCobro(b.dataset.estadoDe);
    });
  });
}

// ============================================================
// 6. MENÚ "MÁS OPCIONES" Y ACCIONES SOBRE UNA FACTURA
// ============================================================

function fvAbrirMenuMas(boton, id) {
  document.querySelectorAll('.fv-menu-mas').forEach(function (m) { m.remove(); });

  const f = estado.ventas.find(function (x) { return String(x.id) === String(id); });
  if (!f) return;

  const activa = fvEstaActiva(f);

  const menu = document.createElement('div');
  menu.className = 'fv-menu-mas';
  menu.innerHTML =
    (fvEstadoSync(f) === 'error'
      ? '<button type="button" class="destacado" data-accion="reintentar">Reintentar guardado</button>'
      : '') +
    (activa ? '<button type="button" data-accion="editar">Editar</button>' : '') +
    (activa ? '<button type="button" data-accion="cobro">Marcar como ' + (String(f.estado) === 'pagada' ? 'pendiente' : 'pagada') + '</button>' : '') +
    '<button type="button" data-accion="pdf">Descargar PDF</button>' +
    (activa
      ? '<button type="button" class="peligro" data-accion="desactivar">Desactivar factura</button>'
      : '<button type="button" data-accion="reactivar">Reactivar factura</button>');

  document.body.appendChild(menu);
  fvPosicionarMenu(menu, boton);

  function cerrarMenu() {
    menu.remove();
    document.removeEventListener('click', cerrarSiFuera);
  }
  function cerrarSiFuera(ev) { if (!menu.contains(ev.target)) cerrarMenu(); }

  menu.querySelector('[data-accion="reintentar"]')?.addEventListener('click', function () { cerrarMenu(); fvReintentarGuardado(id); });
  menu.querySelector('[data-accion="editar"]')?.addEventListener('click', function () { cerrarMenu(); abrirFormularioFacturaVenta(id); });
  menu.querySelector('[data-accion="cobro"]')?.addEventListener('click', function () { cerrarMenu(); fvCambiarCobro(id); });
  menu.querySelector('[data-accion="pdf"]')?.addEventListener('click', function () { cerrarMenu(); pdfDocAbrirFactura(id); });
  menu.querySelector('[data-accion="desactivar"]')?.addEventListener('click', function () { cerrarMenu(); fvDesactivar(id); });
  menu.querySelector('[data-accion="reactivar"]')?.addEventListener('click', function () { cerrarMenu(); fvReactivar(id); });

  setTimeout(function () { document.addEventListener('click', cerrarSiFuera); }, 0);
}

function fvPosicionarMenu(menu, boton) {
  const rect = boton.getBoundingClientRect();
  const alto = menu.offsetHeight;
  const espacioAbajo = window.innerHeight - rect.bottom;
  const arriba = espacioAbajo < alto + 12;

  menu.style.top = arriba ? (rect.top - alto - 4) + 'px' : (rect.bottom + 4) + 'px';
  menu.style.left = Math.max(8, rect.right - menu.offsetWidth) + 'px';
}

// Botones de interfaz que todavía no tienen función asignada (PDF: se
// diseña en el módulo Informes/PDFs, más adelante).
function fvBotonDePrueba(nombre) {
  alert('Botón de prueba: "' + nombre + '" todavía no tiene función. Se conectará cuando se construya su módulo.');
}

// Marcar Pagada/Pendiente (mapa 9.7). Genera o borra el apunte de
// tesorería correspondiente en la misma operación.
async function fvCambiarCobro(id) {
  const f = estado.ventas.find(function (x) { return String(x.id) === String(id); });
  if (!f) return;
  if (!fvEstaActiva(f)) {
    alert('Esta factura está desactivada. Reactívala primero para poder cambiar su estado de cobro.');
    return;
  }

  const pasaAPagada = String(f.estado) !== 'pagada';
  const eleccion = await mostrarDialogoOpciones(
    'Estado de cobro',
    'Factura ' + (f.numero || '') + ' — ' + (f.cliente || '') + '. ' +
      (pasaAPagada ? '¿Marcar como pagada hoy?' : '¿Marcar como pendiente? Se borrará el apunte de tesorería asociado.'),
    [
      { id: 'confirmar', texto: pasaAPagada ? 'Marcar como pagada' : 'Marcar como pendiente', tipo: 'principal' },
      { id: 'cancelar', texto: 'Cancelar' }
    ]
  );
  if (eleccion !== 'confirmar') return;

  if (!puedeEscribir()) return;

  fvMarcarSync(id, 'guardando');
  fvRepintarLista();

  const registro = pasaAPagada
    ? Object.assign({}, f, { estado: 'pagada', fecha_cobro: fechaHoyISO() })
    : Object.assign({}, f, { estado: 'pendiente', fecha_cobro: '' });

  const resultado = await guardarRegistro('ventas', registro, fvRepintarLista, null);
  if (resultado.status !== 'success') {
    fvMarcarSync(id, 'error');
    fvPendientes[String(id)] = { registro: registro };
    fvRepintarLista();
    return;
  }
  fvMarcarSync(id, null);
  delete fvPendientes[String(id)];

  const okApunte = pasaAPagada
    ? await fvCrearApunteCobro(registro)
    : await fvBorrarApunteCobro(registro.id);

  if (!okApunte) {
    // La factura ya se guardó bien; lo que falló es su apunte de
    // tesorería. Se marca en rojo para que quede un aviso visible y
    // persistente — el alert de borrarRegistro/guardarRegistro es
    // puntual y se puede pasar por alto.
    fvMarcarSync(id, 'error');
  }
  fvRepintarLista();
}

async function fvDesactivar(id) {
  const f = estado.ventas.find(function (x) { return String(x.id) === String(id); });
  if (!f) return;
  if (!confirm('¿Desactivar la factura ' + (f.numero || '') + '?\n\nLa factura no se borra: queda guardada mas deja de contar como activa. Su número podrá volver a usarse en la siguiente factura.')) return;
  if (!puedeEscribir()) return;

  fvMarcarSync(id, 'guardando');
  fvRepintarLista();

  const registro = Object.assign({}, f, { estado_registro: 'inactivo' });
  const resultado = await guardarRegistro('ventas', registro, fvRepintarLista, null);
  if (resultado.status !== 'success') {
    fvMarcarSync(id, 'error');
    fvPendientes[String(id)] = { registro: registro };
    fvRepintarLista();
    return;
  }
  fvMarcarSync(id, null);
  delete fvPendientes[String(id)];

  // Si la factura estaba pagada, su apunte de tesorería se borra también.
  if (String(f.estado) === 'pagada') {
    const okApunte = await fvBorrarApunteCobro(id);
    if (!okApunte) fvMarcarSync(id, 'error');
  }
  fvRepintarLista();
}

async function fvReactivar(id) {
  const f = estado.ventas.find(function (x) { return String(x.id) === String(id); });
  if (!f) return;
  if (!confirm('¿Reactivar la factura ' + (f.numero || '') + '?')) return;
  if (!puedeEscribir()) return;

  fvMarcarSync(id, 'guardando');
  fvRepintarLista();

  const registro = Object.assign({}, f, { estado_registro: 'activo' });
  const resultado = await guardarRegistro('ventas', registro, fvRepintarLista, null);
  if (resultado.status !== 'success') {
    fvMarcarSync(id, 'error');
    fvPendientes[String(id)] = { registro: registro };
    fvRepintarLista();
    return;
  }
  fvMarcarSync(id, null);
  delete fvPendientes[String(id)];

  // Si estaba pagada, se vuelve a crear su apunte de tesorería.
  if (String(f.estado) === 'pagada') {
    const okApunte = await fvCrearApunteCobro(registro);
    if (!okApunte) fvMarcarSync(id, 'error');
  }
  fvRepintarLista();
}

/**
 * Reintento manual desde "Más opciones" de una factura que quedó en
 * rojo. Si lo que falló fue solo el cambio de cobro/estado (sin
 * líneas pendientes), se reintenta solo ese guardado; si lo que falló
 * fue la creación/edición con líneas, se reintenta el ciclo completo
 * (factura + líneas) con fvGuardarEnSegundoPlano, para no dejar la
 * factura guardada con líneas antiguas o sin líneas nuevas.
 */
function fvReintentarGuardado(id) {
  const pendiente = fvPendientes[String(id)];
  const registro = pendiente
    ? pendiente.registro
    : estado.ventas.find(function (x) { return String(x.id) === String(id); });
  if (!registro) return;

  fvMarcarSync(id, 'guardando');
  fvRepintarLista();

  fvGuardarEnSegundoPlano(registro);
}

// ============================================================
// 6.1 APUNTE DE TESORERÍA AL COBRAR (mapa 9.7 y 11) 🔒
// ============================================================
// Un apunte por factura como máximo. Se identifica por id_factura_venta,
// igual que hace el resto de la app para relacionar registros.

function fvApunteDe(idFactura) {
  return estado.apuntes.find(function (a) {
    return String(a.id_factura_venta || '') === String(idFactura);
  }) || null;
}

// apunteTaxType (mapa 11.1): ambos > 0 → iva_irpf; solo IVA → iva;
// solo IRPF → irpf; ninguno → ninguno.
function fvTipoImpuestoApunte(iva, irpf) {
  const tieneIva = Number(iva || 0) > 0;
  const tieneIrpf = Number(irpf || 0) > 0;
  if (tieneIva && tieneIrpf) return 'iva_irpf';
  if (tieneIva) return 'iva';
  if (tieneIrpf) return 'irpf';
  return 'ninguno';
}

// getFiscalPeriodFromDate (mapa 11.1): meses 1-3 → Q1, 4-6 → Q2, etc.
function fvTrimestreDeFecha(iso) {
  const mes = parseInt(String(iso || '').split('-')[1] || '0', 10);
  if (mes >= 1 && mes <= 3) return 'Q1';
  if (mes >= 4 && mes <= 6) return 'Q2';
  if (mes >= 7 && mes <= 9) return 'Q3';
  return 'Q4';
}

// Los importes se copian desglosados (base, iva, irpf, total), que son
// las columnas reales de la hoja `apuntes`. Sin ellos, Contabilidad,
// Impuestos y Dashboard verían el apunte a cero.
async function fvCrearApunteCobro(factura) {
  const existente = fvApunteDe(factura.id);
  const fecha = normalizarFecha(factura.fecha_cobro || fechaHoyISO());
  const registro = {
    id: existente ? existente.id : fvNuevoId('apu'),
    ambito: 'empresa',
    tipo: 'ingreso',
    fecha: fecha,
    concepto: 'Cobro factura ' + (factura.numero || ''),
    base: parsearNumero(factura.base),
    iva_pct: parsearNumero(factura.iva_pct),
    iva: parsearNumero(factura.iva),
    irpf_pct: parsearNumero(factura.irpf_pct),
    irpf: parsearNumero(factura.irpf),
    total: parsearNumero(factura.total),
    impuesto_tipo: fvTipoImpuestoApunte(factura.iva, factura.irpf),
    impuesto_trimestre: fvTrimestreDeFecha(fecha),
    impuesto_año: fecha ? parseInt(fecha.split('-')[0], 10) : new Date().getFullYear(),
    id_factura_venta: factura.id,
    id_factura_compra: '',
    id_impuesto: '',
    impuesto_pago: '',
    id_contacto: factura.id_cliente || ''
  };
  const resultado = await guardarRegistro('apuntes', registro, null, null);
  return resultado && resultado.status === 'success';
}

// Devuelve true si se borró con éxito, false si falló (borrarRegistro
// ya deshace el cambio local y avisa con un alert si falla — aquí
// además se informa a quien llama para que pueda marcar la factura en
// rojo, ya que sin esto el aviso quedaba solo en el alert puntual, sin
// ningún rastro visible después. Ver diario, 09/09/2026, punto 2).
async function fvBorrarApunteCobro(idFactura) {
  const apunte = fvApunteDe(idFactura);
  if (!apunte) return true;
  const resultado = await borrarRegistro('apuntes', apunte.id, null, null);
  return resultado && resultado.status === 'success';
}

// ============================================================
// 7. FICHA DE DETALLE (solo lectura — sí se cierra al tocar fuera)
// ============================================================

function abrirFichaFacturaVenta(id) {
  const f = estado.ventas.find(function (x) { return String(x.id) === String(id); });
  if (!f) return;

  const activa = fvEstaActiva(f);

  const fondo = document.createElement('div');
  fondo.className = 'fv-modal-fondo';
  fondo.innerHTML =
    '<div class="fv-modal ancho">' +
      '<div class="fv-modal-cabecera">' +
        htmlIconoContacto((fvClienteDe(f) || {}).icono, 44) +
        '<div class="fv-modal-texto">' +
          '<p class="fv-modal-titulo">' + escaparHtml(f.numero || 'Factura') + (activa ? '' : ' · Inactiva') + '</p>' +
          '<p class="fv-modal-subtitulo">' + escaparHtml(f.cliente || '—') + ' · ' + escaparHtml(mostrarFecha(f.fecha)) + '</p>' +
        '</div>' +
        fvPastillaEstado(f.estado) +
        '<button type="button" class="fv-modal-cerrar" aria-label="Cerrar"><i class="ti ti-x"></i></button>' +
      '</div>' +

      '<div class="fv-modal-cuerpo">' +
        '<div class="fv-ficha-dato"><span>Cliente</span><span>' + escaparHtml(f.cliente || '—') + '</span></div>' +
        '<div class="fv-ficha-dato"><span>NIF</span><span>' + escaparHtml(f.nif || '—') + '</span></div>' +
        '<div class="fv-ficha-dato"><span>Fecha</span><span>' + escaparHtml(mostrarFecha(f.fecha)) + '</span></div>' +
        '<div class="fv-ficha-dato"><span>Concepto</span><span>' + escaparHtml(f.concepto || '—') + '</span></div>' +
        (f.descripcion
          ? '<div class="fv-ficha-dato"><span>Descripción</span><span style="white-space:pre-line">' + escaparHtml(f.descripcion) + '</span></div>'
          : '') +
        (f.id_presupuesto
          ? '<div class="fv-ficha-dato"><span>Desde presupuesto</span><span>' + escaparHtml(fvNumeroPresupuestoDe(f.id_presupuesto)) + '</span></div>'
          : '') +
        (f.estado === 'pagada'
          ? '<div class="fv-ficha-dato"><span>Fecha de cobro</span><span>' + escaparHtml(mostrarFecha(f.fecha_cobro)) + '</span></div>'
          : '') +

        fvBloqueImportes(f) +
      '</div>' +

      '<div class="fv-modal-pie">' +
        (activa ? '<button type="button" class="boton-secundario" id="fv-ficha-editar">Editar</button>' : '') +
        '<button type="button" class="boton-principal" id="fv-ficha-pdf">Descargar PDF</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(fondo);

  // Ficha de solo lectura: se cierra al tocar fuera y con Escape.
  function cerrar() {
    fondo.remove();
    document.removeEventListener('keydown', alPulsarTecla);
  }
  function alPulsarTecla(ev) { if (ev.key === 'Escape') cerrar(); }

  fondo.addEventListener('click', function (ev) { if (ev.target === fondo) cerrar(); });
  document.addEventListener('keydown', alPulsarTecla);
  fondo.querySelector('.fv-modal-cerrar').addEventListener('click', cerrar);

  fondo.querySelector('#fv-ficha-pdf').addEventListener('click', function () { pdfDocAbrirFactura(id); });
  fondo.querySelector('#fv-ficha-editar')?.addEventListener('click', function () {
    cerrar();
    abrirFormularioFacturaVenta(id);
  });
}

function fvNumeroPresupuestoDe(idPresupuesto) {
  const p = estado.presupuestos.find(function (x) { return String(x.id) === String(idPresupuesto); });
  return p ? (p.numero || idPresupuesto) : String(idPresupuesto);
}

function fvLinea(etiqueta, valor, clase) {
  return '<div class="fv-linea' + (clase ? ' ' + clase : '') + '"><span>' + escaparHtml(etiqueta) +
    '</span><strong>' + escaparHtml(valor) + '</strong></div>';
}

// Resumen económico simplificado (07/09/2026, GUÍA 20): ya no se
// muestran subtotal, ajuste por tipo de cliente ni compensación de
// IRPF, porque en facturas siempre valen cero — esos ajustes viven
// solo en presupuestos. El descuento especial y la retención de IRPF
// se muestran únicamente si existen, para no ensuciar el resumen con
// líneas a cero. Se conservan las columnas antiguas en la hoja, así
// que las facturas viejas siguen abriéndose sin problema.
function fvBloqueImportes(f) {
  const descuento = parsearNumero(f.descuento_especial_importe);
  const irpf = parsearNumero(f.irpf);
  return '<div class="fv-bloque">' +
    '<p class="fv-bloque-titulo">Resumen económico</p>' +
    (descuento > 0
      ? fvLinea('Descuento especial' + (String(f.descuento_especial_tipo) === 'fixed'
          ? ' (' + formatMoney(f.descuento_especial_valor) + ')'
          : ' (' + parsearNumero(f.descuento_especial_valor) + '%)'),
        '−' + formatMoney(descuento))
      : '') +
    fvLinea('Base imponible', formatMoney(f.base), 'destacada') +
    fvLinea('IVA (' + parsearNumero(f.iva_pct) + '%)', '+' + formatMoney(f.iva)) +
    (irpf > 0
      ? fvLinea('Retención IRPF (' + parsearNumero(f.irpf_pct) + '%)', '−' + formatMoney(irpf))
      : '') +
    '<div class="fv-total-final"><span>TOTAL</span><strong>' + escaparHtml(formatMoney(f.total)) + '</strong></div>' +
  '</div>';
}

// ============================================================
// 8. FORMULARIO DE FACTURA
// ============================================================
// No se cierra al tocar fuera: hay líneas y trabajo dentro que se
// pueden perder (regla de la guía, sección 10.1).

function fvCampo(clave, etiqueta, valor, opciones) {
  const o = opciones || {};
  return '<div class="fv-campo-grupo' + (o.anchoTotal ? ' ancho-total' : '') + '">' +
    '<label for="fv-campo-' + clave + '">' + escaparHtml(etiqueta) + (o.requerido ? ' *' : '') + '</label>' +
    (o.textarea
      ? '<textarea class="campo" id="fv-campo-' + clave + '" name="' + clave + '">' + escaparHtml(valor || '') + '</textarea>'
      : '<input class="campo" id="fv-campo-' + clave + '" name="' + clave + '" type="text"' +
        (o.numero ? ' data-numero="1" inputmode="decimal"' : '') +
        (o.soloLectura ? ' readonly' : '') +
        ' value="' + escaparHtml(valor === 0 ? '0' : (valor || '')) + '">') +
    '<p class="fv-mensaje-error" data-error-de="' + clave + '" hidden></p>' +
  '</div>';
}

function fvSelect(clave, etiqueta, opciones, valor, extra) {
  const o = extra || {};
  return '<div class="fv-campo-grupo' + (o.anchoTotal ? ' ancho-total' : '') + (o.clase ? ' ' + o.clase : '') + '">' +
    '<label for="fv-campo-' + clave + '">' + escaparHtml(etiqueta) + (o.requerido ? ' *' : '') + '</label>' +
    '<select class="campo" id="fv-campo-' + clave + '" name="' + clave + '">' +
      opciones.map(function (op) {
        return '<option value="' + escaparHtml(op[0]) + '"' + (String(op[0]) === String(valor) ? ' selected' : '') + '>' +
          escaparHtml(op[1]) + '</option>';
      }).join('') +
    '</select>' +
    '<p class="fv-mensaje-error" data-error-de="' + clave + '" hidden></p>' +
  '</div>';
}

/**
 * @param id       id de la factura a editar, o null si es nueva
 * @param prefill  datos que llegan de "Convertir en factura" desde un
 *                 presupuesto (opcional): { id_presupuesto, id_cliente,
 *                 concepto, subtotal, desc_tipo, desc_valor,
 *                 ajuste_cliente_pct, ajuste_cliente_importe, aviso }
 */
function abrirFormularioFacturaVenta(id, prefill) {
  const editando = !!id;
  const original = editando ? estado.ventas.find(function (f) { return String(f.id) === String(id); }) : null;
  if (editando && !original) return;

  if (original && !fvEstaActiva(original)) {
    alert('Esta factura está desactivada y no se puede editar. Reactívala primero.');
    return;
  }

  const tiposIva = preTiposIva();
  const tiposIrpf = preTiposIrpf();
  const clientes = fvClientesDisponibles();

  const deDesdePresupuesto = !!(prefill && prefill.id_presupuesto);

  const datos = {
    numero: original ? original.numero : fvSiguienteNumero(),
    fecha: original ? normalizarFecha(original.fecha) : fechaHoyISO(),
    id_cliente: original ? String(original.id_cliente || '') : String((prefill && prefill.id_cliente) || ''),
    concepto: original ? (original.concepto || '') : ((prefill && prefill.concepto) || ''),
    desc_tipo: original
      ? (String(original.descuento_especial_tipo) === 'fixed' ? 'fixed' : 'percent')
      : (prefill && prefill.desc_tipo === 'fixed' ? 'fixed' : 'percent'),
    desc_valor: original ? parsearNumero(original.descuento_especial_valor) : parsearNumero(prefill && prefill.desc_valor),
    iva_id: '',
    irpf_id: ''
  };

  // El tipo de IVA/IRPF se reconoce por el porcentaje guardado, ya que
  // en "ventas" se guarda el porcentaje, no el id (mapa 9.4).
  if (original) {
    const ivaEnc = tiposIva.find(function (x) { return Math.abs(x.porcentaje - parsearNumero(original.iva_pct)) < 0.01; });
    const irpfEnc = tiposIrpf.find(function (x) { return Math.abs(x.porcentaje - parsearNumero(original.irpf_pct)) < 0.01; });
    datos.iva_id = ivaEnc ? ivaEnc.id : (tiposIva[0] ? tiposIva[0].id : '');
    datos.irpf_id = irpfEnc ? irpfEnc.id : (tiposIrpf[0] ? tiposIrpf[0].id : '');
  } else if (prefill) {
    // Viene de un presupuesto: hereda sus tipos, ya traducidos a id.
    // Esto va ANTES del valor por defecto de abajo, o el primer tipo
    // de la lista pisaría lo heredado — la retención de IRPF del
    // presupuesto se perdía por eso (fallo reportado el 07/09/2026).
    if (prefill.iva_id) datos.iva_id = String(prefill.iva_id);
    if (prefill.irpf_id) datos.irpf_id = String(prefill.irpf_id);
  }
  if (!datos.iva_id && tiposIva[0]) datos.iva_id = tiposIva[0].id;
  if (!datos.irpf_id && tiposIrpf[0]) datos.irpf_id = tiposIrpf[0].id;

  // Descripción y base imponible sustituyen a las líneas de detalle
  // (simplificación 07/09/2026, GUÍA 20): la factura tiene un único
  // importe, que ya ES la base imponible — sin ajuste de tipo de
  // cliente ni compensación de IRPF, que viven solo en presupuestos.
  datos.descripcion = editando ? String(original.descripcion || '') : '';
  datos.base = editando ? parsearNumero(original.base) : 0;

  // Desde un presupuesto: se hereda su base (YA ajustada), nunca el
  // subtotal sin ajustar — ese fue justo un fallo corregido el
  // 06/09/2026 y se deja escrito para no repetirlo.
  if (!editando && prefill) {
    if (prefill.descripcion !== undefined) datos.descripcion = String(prefill.descripcion || '');
    if (prefill.base !== undefined) datos.base = parsearNumero(prefill.base);
    else if (prefill.subtotal !== undefined) datos.base = parsearNumero(prefill.subtotal);
  }

  const titulo = editando ? 'Editar factura' : 'Nueva factura';

  const fondo = document.createElement('div');
  fondo.className = 'fv-modal-fondo';
  fondo.innerHTML =
    '<div class="fv-modal ancho">' +
      '<div class="fv-modal-cabecera">' +
        '<div class="fv-modal-texto">' +
          '<p class="fv-modal-titulo">' + escaparHtml(titulo) + '</p>' +
          '<p class="fv-modal-subtitulo">' + escaparHtml(datos.numero) + '</p>' +
        '</div>' +
        '<button type="button" class="fv-modal-cerrar" aria-label="Cerrar"><i class="ti ti-x"></i></button>' +
      '</div>' +

      '<div class="fv-modal-cuerpo">' +
        '<form id="fv-form">' +
          '<div class="fv-form-grid dos-columnas">' +
            fvCampo('numero', 'Número', datos.numero, { soloLectura: true }) +
            '<div class="fv-campo-grupo"><label for="fv-campo-fecha">Fecha *</label>' +
              '<input class="campo" type="date" id="fv-campo-fecha" name="fecha" value="' + escaparHtml(datos.fecha) + '">' +
              '<p class="fv-mensaje-error" data-error-de="fecha" hidden></p></div>' +

            '<div class="fv-campo-grupo ancho-total">' +
              '<label>Cliente *</label>' +
              '<input type="hidden" id="fv-campo-id_cliente" name="id_cliente" value="' + escaparHtml(datos.id_cliente) + '">' +
              '<button type="button" class="campo-contacto-btn" id="fv-btn-cliente"></button>' +
              '<p class="fv-mensaje-error" data-error-de="id_cliente" hidden></p>' +
            '</div>' +

            '<button type="button" class="boton-menor fv-enlace-cliente" id="fv-nuevo-cliente">+ Crear un cliente nuevo</button>' +
            '<p class="fv-info-cliente" id="fv-info-cliente" hidden></p>' +
            (deDesdePresupuesto
              ? '<p class="fv-aviso verde">Desde presupuesto ' + escaparHtml(fvNumeroPresupuestoDe(prefill.id_presupuesto)) +
                '. La base imponible ya viene calculada del presupuesto, con su ajuste incluido. Puedes cambiarla si hace falta.</p>'
              : '<p class="fv-aviso" id="fv-aviso-tipo" hidden></p>') +

            fvCampo('concepto', 'Concepto', datos.concepto, { textarea: true, anchoTotal: true }) +
            fvCampo('descripcion', 'Descripción (una línea por punto)', datos.descripcion, { textarea: true, anchoTotal: true }) +
            fvCampo('base', 'Base imponible', datos.base, { numero: true, requerido: true, anchoTotal: true }) +

            '<div class="fv-campo-grupo">' +
              '<label for="fv-campo-desc_valor">Descuento especial</label>' +
              '<div class="fv-fila-doble">' +
                '<select class="campo fv-descuento-tipo" id="fv-campo-desc_tipo" name="desc_tipo">' +
                  '<option value="percent"' + (datos.desc_tipo === 'percent' ? ' selected' : '') + '>Porcentaje</option>' +
                  '<option value="fixed"' + (datos.desc_tipo === 'fixed' ? ' selected' : '') + '>Euros</option>' +
                '</select>' +
                '<input class="campo" id="fv-campo-desc_valor" name="desc_valor" type="text" data-numero="1" inputmode="decimal" value="' + escaparHtml(String(datos.desc_valor)) + '">' +
              '</div>' +
            '</div>' +

            fvSelect('iva_id', 'IVA', tiposIva.map(function (x) { return [x.id, x.nombre + ' (' + x.porcentaje + '%)']; }), datos.iva_id) +
            fvSelect('irpf_id', 'IRPF', tiposIrpf.map(function (x) { return [x.id, x.nombre + ' (' + x.porcentaje + '%)']; }), datos.irpf_id) +
          '</div>' +

          '<div class="fv-bloque" id="fv-totales"></div>' +
        '</form>' +
      '</div>' +

      '<div class="fv-modal-pie">' +
        '<button type="button" class="boton-secundario" id="fv-form-cancelar">Cancelar</button>' +
        '<button type="submit" form="fv-form" class="boton-principal" id="fv-form-guardar">Guardar factura</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(fondo);

  fvPintarSelectorCliente(fondo, clientes, prefill);

  // ---- NO se cierra al tocar fuera (regla de formularios con trabajo dentro) ----
  fondo.querySelector('.fv-modal-cerrar').addEventListener('click', function () { fvCerrarFormulario(fondo); });
  fondo.querySelector('#fv-form-cancelar').addEventListener('click', function () { fvCerrarFormulario(fondo); });

  const btnNuevoCliente = fondo.querySelector('#fv-nuevo-cliente');
  btnNuevoCliente.addEventListener('click', function () {
    if (typeof abrirCreacionRapidaContacto !== 'function') {
      alert('El módulo de Clientes no está disponible.');
      return;
    }
    if (document.querySelector('.cli-modal-fondo')) return;
    btnNuevoCliente.disabled = true;

    abrirCreacionRapidaContacto('cliente', function (contacto) {
      if (!clientes.some(function (c) { return String(c.id) === String(contacto.id); })) {
        clientes.push(contacto);
      }
      fondo.querySelector('#fv-campo-id_cliente').value = String(contacto.id);
      fvPintarSelectorCliente(fondo, clientes, prefill);
      fvActualizarFormulario(fondo, prefill);
    });

    const vigilante = setInterval(function () {
      if (!document.querySelector('.cli-modal-fondo')) {
        btnNuevoCliente.disabled = false;
        clearInterval(vigilante);
      }
    }, 300);
  });

  fondo.querySelectorAll('#fv-form input, #fv-form select, #fv-form textarea').forEach(function (el) {
    el.addEventListener('input', function () { fvActualizarFormulario(fondo, prefill); });
    el.addEventListener('change', function () { fvActualizarFormulario(fondo, prefill); });
  });

  fondo.querySelector('#fv-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    fvProcesarGuardado(fondo, original, prefill);
  });

  fvActualizarFormulario(fondo, prefill);
}

function fvCerrarFormulario(fondo) {
  fondo.remove();
}

// Pinta el botón "Cliente" (abre el selector con buscador) y mantiene
// sincronizado el input oculto #fv-campo-id_cliente, que es de donde
// lee fvLeerFormulario — así el resto del módulo no cambia.
function fvPintarSelectorCliente(fondo, clientes, prefill) {
  const oculto = fondo.querySelector('#fv-campo-id_cliente');
  const boton = fondo.querySelector('#fv-btn-cliente');

  function nombreDe(id) {
    const c = clientes.find(function (x) { return String(x.id) === String(id); });
    if (!c) return '';
    return c.nombre_contacto + (c.nombre_fiscal && c.nombre_fiscal !== c.nombre_contacto ? ' (' + c.nombre_fiscal + ')' : '');
  }

  function repintar() {
    const nombre = nombreDe(oculto.value);
    boton.innerHTML =
      '<span class="campo-contacto-valor' + (nombre ? '' : ' vacio') + '">' + escaparHtml(nombre || 'Selecciona un cliente...') + '</span>' +
      '<i class="ti ti-chevron-down"></i>';
  }

  boton.addEventListener('click', function () {
    abrirSelectorContacto(clientes, oculto.value, { permitirLibre: false }).then(function (resultado) {
      if (resultado === null) return;
      oculto.value = resultado || '';
      repintar();
      fvActualizarFormulario(fondo, prefill);
    });
  });

  repintar();
}

// ---- Lectura y cálculo en vivo ----

function fvLeerFormulario(fondo) {
  const valor = function (id) {
    const el = fondo.querySelector('#fv-campo-' + id);
    return el ? el.value : '';
  };
  return {
    fecha: valor('fecha'),
    id_cliente: valor('id_cliente'),
    concepto: valor('concepto').trim(),
    descripcion: valor('descripcion').trim(),
    base: parsearNumero(valor('base')),
    desc_tipo: valor('desc_tipo') === 'fixed' ? 'fixed' : 'percent',
    desc_valor: parsearNumero(valor('desc_valor')),
    iva_id: valor('iva_id'),
    irpf_id: valor('irpf_id')
  };
}

// Cálculo simplificado (07/09/2026, GUÍA 20): la base imponible la
// escribe directamente el propietario, o se hereda ya ajustada del
// presupuesto. Aquí NO se aplica ni el ajuste por tipo de cliente ni
// la compensación del 20% de IRPF — eso vive solo en presupuestos,
// que es donde se decide el precio. Sobre la base se aplican solo el
// descuento especial (si lo hay), el IVA y la retención de IRPF.
function fvCalcularFormulario(datos, prefill) {
  const cliente = estado.clientes.find(function (c) { return String(c.id) === String(datos.id_cliente); }) || null;

  const iva = preTiposIva().find(function (x) { return x.id === datos.iva_id; }) || { porcentaje: 0 };
  const irpf = preTiposIrpf().find(function (x) { return x.id === datos.irpf_id; }) || { porcentaje: 0 };

  const baseBruta = roundMoney(parsearNumero(datos.base));

  // Descuento especial sobre la base introducida.
  const descuento = String(datos.desc_tipo) === 'fixed'
    ? roundMoney(parsearNumero(datos.desc_valor))
    : roundMoney(baseBruta * parsearNumero(datos.desc_valor) / 100);

  const base = roundMoney(baseBruta - descuento);
  const importeIva = roundMoney(base * parsearNumero(iva.porcentaje) / 100);
  const importeIrpf = roundMoney(base * parsearNumero(irpf.porcentaje) / 100);

  const totales = {
    subtotal: baseBruta,
    ajustePct: 0,
    ajusteImporte: 0,
    compensacionPct: 0,
    compensacionImporte: 0,
    descuentoImporte: descuento,
    base: base,
    ivaPct: parsearNumero(iva.porcentaje),
    iva: importeIva,
    irpfPct: parsearNumero(irpf.porcentaje),
    irpf: importeIrpf,
    total: roundMoney(base + importeIva - importeIrpf)
  };

  return { totales: totales, cliente: cliente, ajusteOrigen: 'ninguno' };
}

function fvActualizarFormulario(fondo, prefill) {
  const datos = fvLeerFormulario(fondo);
  const r = fvCalcularFormulario(datos, prefill);

  // Ficha del cliente: ya NO se muestra su ajuste por tipo, porque en
  // facturas no se aplica (07/09/2026, GUÍA 20). El tipo de cliente
  // sigue existiendo en su ficha y se usa en Presupuestos.
  const info = fondo.querySelector('#fv-info-cliente');
  if (r.cliente) {
    info.hidden = false;
    info.textContent = [
      r.cliente.nombre_fiscal || r.cliente.nombre_contacto,
      r.cliente.nif || 'sin NIF'
    ].filter(Boolean).join(' · ');
  } else {
    info.hidden = true;
  }

  const aviso = fondo.querySelector('#fv-aviso-tipo');
  if (aviso) aviso.hidden = true;

  const t = r.totales;

  // Resumen en vivo: solo lo que de verdad se aplica en una factura.
  // El descuento y la retención aparecen únicamente si existen.
  fondo.querySelector('#fv-totales').innerHTML =
    '<p class="fv-bloque-titulo">Resumen económico</p>' +
    (t.descuentoImporte > 0
      ? fvLinea('Descuento especial', '−' + formatMoney(t.descuentoImporte))
      : '') +
    fvLinea('Base imponible', formatMoney(t.base), 'destacada') +
    fvLinea('IVA (' + t.ivaPct + '%)', '+' + formatMoney(t.iva)) +
    (t.irpf > 0
      ? fvLinea('Retención IRPF (' + t.irpfPct + '%)', '−' + formatMoney(t.irpf))
      : '') +
    '<div class="fv-total-final"><span>TOTAL</span><strong>' + escaparHtml(formatMoney(t.total)) + '</strong></div>';
}

// ============================================================
// 9. GUARDADO
// ============================================================

function fvMostrarError(fondo, campo, mensaje) {
  const input = fondo.querySelector('#fv-campo-' + campo);
  const p = fondo.querySelector('[data-error-de="' + campo + '"]');
  if (input) input.classList.add('fv-campo-error');
  if (p) { p.textContent = mensaje; p.hidden = false; }
}

function fvLimpiarErrores(fondo) {
  fondo.querySelectorAll('.fv-campo-error').forEach(function (el) { el.classList.remove('fv-campo-error'); });
  fondo.querySelectorAll('[data-error-de]').forEach(function (el) { el.hidden = true; });
}

function fvProcesarGuardado(fondo, original, prefill) {
  fvLimpiarErrores(fondo);
  const datos = fvLeerFormulario(fondo);

  // Validaciones (mapa 9.2/9.3)
  let valido = true;
  if (!datos.fecha) { fvMostrarError(fondo, 'fecha', 'Obligatoria'); valido = false; }
  if (!datos.id_cliente) {
    fvMostrarError(fondo, 'id_cliente', 'Selecciona un cliente activo. Si no existe, créalo primero.');
    valido = false;
  }
  const concepto = datos.concepto;
  if (!concepto) {
    fvMostrarError(fondo, 'concepto', 'Escribe un concepto resumido para la factura.');
    valido = false;
  }

  // Base imponible: es el importe final de la factura, obligatorio.
  if (!(datos.base > 0)) {
    fvMostrarError(fondo, 'base', 'Escribe la base imponible de la factura.');
    valido = false;
  }
  if (!valido) return;

  const cliente = estado.clientes.find(function (c) { return String(c.id) === String(datos.id_cliente); });
  if (!cliente) {
    fvMostrarError(fondo, 'id_cliente', 'Ese cliente ya no existe.');
    return;
  }
  if (!estado.modoPrueba && esDePrueba(cliente)) {
    alert('Este cliente es de prueba y no puede utilizarse en una factura real. Activa el modo prueba para trabajar con datos de prueba.');
    return;
  }
  if (original && !fvEstaActiva(original)) {
    alert('Esta factura está desactivada y no se puede editar.');
    return;
  }

  const r = fvCalcularFormulario(datos, prefill);
  const t = r.totales;

  const idFactura = original ? original.id : fvNuevoId('fv');

  // Los datos del cliente se congelan en la factura, igual que en
  // Presupuestos (mapa 9.4/8.6).
  //
  // `subtotal`, `ajuste_cliente_*` y `compensacion_irpf_*` se guardan
  // a CERO a propósito (simplificación 07/09/2026, GUÍA 20): esos
  // ajustes viven solo en presupuestos. Las columnas se mantienen en
  // la hoja para no romper facturas antiguas, pero ya no se rellenan.
  const registro = {
    id: idFactura,
    numero: original ? original.numero : fvSiguienteNumero(),
    fecha: normalizarFecha(datos.fecha),
    id_cliente: cliente.id,
    cliente: cliente.nombre_fiscal || cliente.nombre_contacto || '',
    nif: cliente.nif || '',
    id_presupuesto: original ? (original.id_presupuesto || '') : ((prefill && prefill.id_presupuesto) || ''),
    concepto: concepto,
    descripcion: datos.descripcion,
    subtotal: 0,
    ajuste_cliente_pct: 0,
    ajuste_cliente_importe: 0,
    compensacion_irpf_pct: 0,
    compensacion_irpf_importe: 0,
    descuento_especial_tipo: datos.desc_tipo,
    descuento_especial_valor: parsearNumero(datos.desc_valor),
    descuento_especial_importe: t.descuentoImporte,
    base: t.base,
    iva_pct: t.ivaPct,
    iva: t.iva,
    irpf_pct: t.irpfPct,
    irpf: t.irpf,
    total: t.total,
    estado: original ? (original.estado || 'pendiente') : 'pendiente',
    fecha_cobro: original ? (original.fecha_cobro || '') : '',
    estado_registro: original ? (fvEstaActiva(original) ? 'activo' : 'inactivo') : 'activo'
  };

  // La ventana se cierra AL MOMENTO. El guardado sigue en segundo
  // plano (guía, sección 9).
  fondo.remove();

  fvMarcarSync(idFactura, 'guardando');
  fvGuardarEnSegundoPlano(registro);

  pintarFacturas();
}

/**
 * Guarda sin bloquear la pantalla. Primero la factura, después sus
 * líneas en una sola llamada. Si algo falla, el registro se conserva
 * en el dispositivo marcado en rojo, y aparece "Reintentar guardado"
 * en su menú de tres puntos (mismo patrón que Presupuestos).
 */
// Una sola llamada al backend (simplificación 07/09/2026, GUÍA 20):
// al desaparecer las líneas de detalle ya no hace falta la segunda
// escritura en `ventas_detalle`, ni su manejo de errores por separado.
function fvGuardarEnSegundoPlano(registro) {
  return guardarRegistro('ventas', registro, fvRepintarLista, null)
    .then(function (resultado) {
      if (resultado.status !== 'success') {
        fvReponerLocal(registro);
        fvMarcarSync(registro.id, 'error');
        fvPendientes[String(registro.id)] = { registro: registro };
        fvRepintarLista();
        return;
      }

      const idFinal = (resultado.data && resultado.data.id) || registro.id;
      fvMarcarSync(registro.id, null);
      fvMarcarSync(idFinal, null);
      delete fvPendientes[String(registro.id)];
      fvRepintarLista();
    })
    .catch(function (err) {
      console.error('Fallo al guardar la factura:', err);
      fvReponerLocal(registro);
      fvMarcarSync(registro.id, 'error');
      fvPendientes[String(registro.id)] = { registro: registro };
      fvRepintarLista();
    });
}

function fvReponerLocal(registro) {
  const i = estado.ventas.findIndex(function (r) { return String(r.id) === String(registro.id); });
  if (i >= 0) estado.ventas[i] = registro;
  else estado.ventas.push(registro);
  guardarEntidadLocal('ventas');
}

// ============================================================
// 10. DESDE PRESUPUESTO (mapa 9.5) — llamado desde mod-presupuestos.js
// ============================================================
// Validaciones: el presupuesto debe estar aceptado, no tener ya una
// factura asociada, el cliente debe existir y, en modo real, no ser de
// prueba.
//
// Traslada cliente, concepto, descripción y la BASE ya calculada del
// presupuesto (simplificación 07/09/2026, GUÍA 20). Ya no traslada
// subtotal, descuento ni ajuste de cliente: todo eso está aplicado
// dentro de esa base.

function convertirPresupuestoEnFactura(idPresupuesto) {
  const p = estado.presupuestos.find(function (x) { return String(x.id) === String(idPresupuesto); });
  if (!p) { alert('Este presupuesto ya no existe.'); return; }

  if (String(p.estado) !== 'aceptado') {
    alert('El presupuesto debe estar aceptado para poder convertirlo en factura.');
    return;
  }
  const yaTieneFactura = estado.ventas.some(function (f) { return String(f.id_presupuesto || '') === String(idPresupuesto); });
  if (yaTieneFactura) {
    alert('Este presupuesto ya tiene una factura asociada.');
    return;
  }

  const cliente = estado.clientes.find(function (c) { return String(c.id) === String(p.id_cliente); });
  if (!cliente) {
    alert('El cliente de este presupuesto ya no existe. No se puede facturar.');
    return;
  }
  if (!estado.modoPrueba && esDePrueba(cliente)) {
    alert('Este cliente es de prueba y no puede utilizarse para una factura real. Activa el modo prueba para trabajar con datos de prueba.');
    return;
  }

  // Se hereda la BASE del presupuesto, que ya lleva aplicados el
  // ajuste por tipo de cliente y la compensación de IRPF — nunca el
  // `subtotal`, que es la cifra ANTES de esos ajustes. Pasar el
  // subtotal fue un fallo real detectado por el propietario el
  // 07/09/2026: la factura salía con un importe menor que el
  // presupuesto que la originó.
  //
  // El descuento especial NO se hereda: ya está descontado dentro de
  // la base del presupuesto, así que volver a pasarlo lo aplicaría dos
  // veces. Si hace falta un descuento adicional, se añade a mano en la
  // factura.
  //
  // Los tipos de IVA e IRPF se heredan también (07/09/2026): el
  // presupuesto guarda el PORCENTAJE (`iva_pct`, `irpf_pct`), no el
  // id del tipo, así que se busca el tipo vigente cuyo porcentaje
  // coincida. Es el mismo mecanismo que ya usa la calculadora al
  // reabrir un presupuesto guardado.
  //
  // Si el porcentaje guardado ya no existe en Configuración (porque
  // se cambió después), se deja sin preseleccionar y el formulario
  // usa su valor por defecto — mejor eso que asignar un tipo que no
  // corresponde.
  const tipoPorPorcentaje = function (tipos, pct) {
    const encontrado = tipos.find(function (x) {
      return Math.abs(parsearNumero(x.porcentaje) - parsearNumero(pct)) < 0.01;
    });
    return encontrado ? encontrado.id : '';
  };

  abrirFormularioFacturaVenta(null, {
    id_presupuesto: p.id,
    id_cliente: p.id_cliente,
    concepto: p.concepto || '',
    descripcion: p.descripcion || '',
    base: parsearNumero(p.base),
    iva_id: tipoPorPorcentaje(preTiposIva(), p.iva_pct),
    irpf_id: tipoPorPorcentaje(preTiposIrpf(), p.irpf_pct)
  });
}

// ============================================================
// 11. REGISTRO COMO VISTA
// ============================================================

registrarVista('facturas', {
  titulo: 'Facturas',
  pintar: pintarFacturas
});

// ============================================================
// 12. RED DE SEGURIDAD (mapa 11.6) — reconciliador de apuntes
// ============================================================
// En cada sincronización general:
//   1. Crea el apunte de cualquier factura pagada y activa que se haya
//      quedado sin él (por ejemplo, si la factura se guardó bien pero
//      la llamada que crea el apunte falló justo después).
//   2. Borra el apunte de cualquier factura que YA NO está pagada y
//      activa — el caso inverso, añadido el 09/09/2026: si al pasar
//      de Pagada a Pendiente/Inactiva falla el borrado del apunte
//      (fvBorrarApunteCobro), la factura queda actualizada pero el
//      apunte se queda huérfano, contando dinero de más en
//      Contabilidad/Impuestos/Dashboard sin ningún aviso visible más
//      allá del alert puntual del momento.
// Se engancha al mecanismo `reconciliadores` que ya existe en el
// núcleo (app.js) sin tocar ese archivo: cualquier módulo puede
// registrar el suyo.

async function fvReconciliarApuntesCobro() {
  const pagadasActivas = estado.ventas.filter(function (f) {
    return fvEstaActiva(f) && String(f.estado) === 'pagada';
  });
  for (const f of pagadasActivas) {
    if (!fvApunteDe(f.id)) {
      try {
        await fvCrearApunteCobro(f);
      } catch (err) {
        console.error('Reconciliación: no se pudo crear el apunte de la factura ' + f.numero, err);
      }
    }
  }

  // Apuntes que vienen de una factura de venta, cuya factura ya no
  // está pagada y activa (o ya no existe). Se borra en silencio, sin
  // el alert() de borrarRegistro — este es un reconciliador de fondo,
  // no una acción directa del usuario, y si falla (sin conexión en
  // ese momento) ya se reintentará solo en la siguiente
  // sincronización.
  const apuntesDeFacturaSobrantes = estado.apuntes.filter(function (a) {
    if (!a.id_factura_venta) return false;
    const f = estado.ventas.find(function (x) { return String(x.id) === String(a.id_factura_venta); });
    if (!f) return true; // la factura ya no existe: el apunte es huérfano seguro
    return !(fvEstaActiva(f) && String(f.estado) === 'pagada');
  });
  for (const a of apuntesDeFacturaSobrantes) {
    try {
      const resultado = await llamarBackend({ action: 'delete', sheet: 'apuntes', data: { id: a.id } });
      if (resultado.status === 'success') {
        estado.apuntes = estado.apuntes.filter(function (x) { return String(x.id) !== String(a.id); });
        guardarEntidadLocal('apuntes');
      }
    } catch (err) {
      console.error('Reconciliación: no se pudo borrar el apunte sobrante ' + a.id, err);
    }
  }
}

reconciliadores.push(fvReconciliarApuntesCobro);
