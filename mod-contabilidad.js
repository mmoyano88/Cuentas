/**
 * MÓDULO APUNTES / CONTABILIDAD
 * ------------------------------------------------------------
 * Libro de tesorería (mapa 11). Registra dinero que se ha movido de
 * verdad, no facturas emitidas.
 *
 * Tres orígenes de un apunte (mapa 11.2):
 * - Automático desde factura de venta cobrada (mod-facturas-venta.js).
 * - Automático desde factura de compra pagada (mod-facturas-compra.js).
 * - Manual, creado aquí (cualquier otro movimiento: cuota de autónomo,
 *   gasto personal, etc.).
 *
 * Los apuntes automáticos (vinculados a una factura) NO se pueden
 * editar ni borrar desde aquí — se modifican desde la factura de
 * origen (mapa 11.2). Aquí solo se puede "Ver factura".
 *
 * Sin círculo de icono en las filas (decisión 04/09/2026): en su
 * lugar, el importe va coloreado según sea ingreso (verde) o gasto
 * (rojo), que es el dato que más importa de un vistazo.
 *
 * La ficha de detalle (solo lectura) se cierra al tocar fuera. El
 * formulario de apunte manual, no: solo con su botón de cerrar o
 * Cancelar (regla general de formularios con trabajo dentro).
 */

// ============================================================
// 0. ESTADO PROPIO DEL MÓDULO
// ============================================================

let ctFiltroTipo = 'todos';     // 'todos' | 'ingreso' | 'gasto'
let ctFiltroAmbito = 'todos';   // 'todos' | 'empresa' | 'personal'
let ctOrden = 'fecha-desc';
let ctBusqueda = '';

const ctSyncEstados = {};
const ctPendientes = {};

function ctMarcarSync(id, valor) {
  if (!id) return;
  if (valor) ctSyncEstados[String(id)] = valor;
  else delete ctSyncEstados[String(id)];
}

function ctEstadoSync(a) {
  const marcado = ctSyncEstados[String(a.id)];
  if (marcado) return marcado;
  if (esDePrueba(a)) return 'prueba';
  return 'ok';
}

const CT_PUNTOS = {
  ok:        { clase: 'ok',        titulo: 'Guardado en la base de datos' },
  guardando: { clase: 'guardando', titulo: 'Guardando...' },
  error:     { clase: 'error',     titulo: 'No se pudo guardar. Abre "Más opciones" y reintenta.' },
  prueba:    { clase: 'prueba',    titulo: 'Solo en este dispositivo (modo prueba)' }
};

function ctPuntoEstado(a) {
  const info = CT_PUNTOS[ctEstadoSync(a)] || CT_PUNTOS.ok;
  return '<span class="ct-punto ' + info.clase + '" title="' + escaparHtml(info.titulo) + '"></span>';
}

// Círculo visual del apunte (decisión 05/09/2026, sustituye al icono
// por ámbito de la sesión anterior): el COLOR de fondo sigue diciendo
// si es ingreso (verde) o gasto (rojo). El ICONO de dentro ahora dice
// de DÓNDE viene el apunte, para reconocerlo de un vistazo:
//   · registro de Impuestos           → maletín
//   · factura de venta o de compra    → símbolo de moneda
//   · manual, de empresa              → calculadora
//   · manual, personal                → persona
// El color ya distingue venta de compra por sí solo: una factura de
// venta cobrada siempre es ingreso (verde) y una de compra pagada
// siempre es gasto (rojo), así que no hace falta ningún icono extra
// para eso.
function ctCirculoTipo(a, tamanoPx) {
  const tam = tamanoPx || 42;
  const esIngreso = a.tipo === 'ingreso';
  const esPersonal = a.ambito === 'personal';
  const fondo = esIngreso ? '#3E9E4E' : 'var(--rojo)';

  let claseIcono, origen;
  if (ctVieneDeImpuesto(a)) {
    claseIcono = 'ti-briefcase';
    origen = 'Pago de impuestos';
  } else if (ctVieneDeFactura(a)) {
    claseIcono = 'ti-currency-dollar';
    origen = a.id_factura_venta ? 'Factura de venta' : 'Factura de compra';
  } else if (esPersonal) {
    claseIcono = 'ti-user';
    origen = 'Apunte personal';
  } else {
    claseIcono = 'ti-calculator';
    origen = 'Apunte de empresa';
  }

  const tituloTipo = esIngreso ? 'Ingreso' : 'Gasto';

  return '<div class="ct-circulo" style="width:' + tam + 'px;height:' + tam + 'px;background:' + fondo + ';font-size:' + Math.round(tam * 0.5) + 'px" ' +
    'title="' + escaparHtml(tituloTipo + ' · ' + origen) + '">' +
    '<i class="ti ' + claseIcono + '"></i></div>';
}

// ============================================================
// 1. UTILIDADES
// ============================================================

function ctNuevoId(prefijo) {
  if (estado.modoPrueba) return generarIdPrueba(prefijo);
  return prefijo + '-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e9).toString(36);
}

// Un apunte es automático si viene de una factura O de un registro de
// Impuestos: en los dos casos no se puede editar ni borrar desde aquí
// (mapa 11.2), se modifica desde su origen. Pero el origen concreto sí
// importa para el mensaje y el botón que se muestran, así que se
// distingue con dos funciones más finas.
function ctVieneDeFactura(a) {
  return !!(a.id_factura_venta || a.id_factura_compra);
}
function ctVieneDeImpuesto(a) {
  return !!a.id_impuesto;
}
function ctEsAutomatico(a) {
  return ctVieneDeFactura(a) || ctVieneDeImpuesto(a);
}

// Un apunte se puede convertir en factura si es manual (no viene ya de
// una factura ni es un pago de impuestos), es de empresa y tiene
// importe. Sirve para cuando cobras o pagas algo antes de tener la
// factura: el movimiento se apunta ya, y la factura se emite después.
function ctEsConvertible(a) {
  if (!a) return false;
  if (ctEsAutomatico(a)) return false;
  if (String(a.ambito || '') !== 'empresa') return false;
  return parsearNumero(a.total) > 0;
}

function ctContactoDe(a) {
  if (!a.id_contacto) return null;
  return estado.clientes.find(function (c) { return String(c.id) === String(a.id_contacto); }) || null;
}

// Concepto mostrado (mapa 11.4): si el apunte viene de una factura, se
// muestra el número y concepto ACTUALES de esa factura, no el texto
// que quedó congelado en el apunte en su día. Así, renombrar una
// factura se refleja también en Contabilidad.
function ctConceptoMostrado(a) {
  if (a.id_factura_venta) {
    const f = estado.ventas.find(function (x) { return String(x.id) === String(a.id_factura_venta); });
    if (f) return (f.numero || '') + ' — ' + (f.concepto || '');
  }
  if (a.id_factura_compra) {
    const f = estado.compras.find(function (x) { return String(x.id) === String(a.id_factura_compra); });
    if (f) return (f.numero || '') + ' — ' + (f.concepto || '');
  }
  return a.concepto || '—';
}

function ctNombreContacto(a) {
  const c = ctContactoDe(a);
  return c ? (c.nombre_contacto || '—') : '—';
}

function ctTextoBusqueda(a) {
  return normalizarBusqueda([
    ctConceptoMostrado(a), ctNombreContacto(a), mostrarFecha(a.fecha),
    a.ambito, a.tipo, formatMoney(a.total), formatMoney(a.base)
  ].filter(Boolean).join(' '));
}

// ============================================================
// 2. CÁLCULO 🔒 (mapa 11.3) — cálculo inverso del apunte manual
// ============================================================
// El usuario introduce el TOTAL (lo que realmente cobró o pagó) y los
// porcentajes; la base se deduce. Si el ámbito es personal, no hay
// impuestos: base = total.

function ctTotalesDesdeTotal(total, ivaPct, irpfPct, ambito) {
  const t = roundMoney(parsearNumero(total));

  if (ambito === 'personal') {
    return { base: t, ivaPct: 0, iva: 0, irpfPct: 0, irpf: 0, total: t };
  }

  const pIva = parsearNumero(ivaPct);
  const pIrpf = parsearNumero(irpfPct);
  const denominador = 1 + (pIva / 100) - (pIrpf / 100);
  const base = denominador > 0 ? roundMoney(t / denominador) : 0;
  const iva = roundMoney(base * pIva / 100);
  const irpf = roundMoney(base * pIrpf / 100);

  return { base: base, ivaPct: pIva, iva: iva, irpfPct: pIrpf, irpf: irpf, total: t };
}

// Mismo criterio que en Facturas: ambos > 0 → iva_irpf; solo IVA →
// iva; solo IRPF → irpf; ninguno → ninguno. Se reutiliza la función ya
// definida en mod-facturas-venta.js (misma regla, una sola fuente).
function ctTipoImpuesto(iva, irpf) {
  return fvTipoImpuestoApunte(iva, irpf);
}

function ctTrimestreDeFecha(iso) {
  return fvTrimestreDeFecha(iso);
}

// ============================================================
// 3. PINTADO PRINCIPAL
// ============================================================

function pintarContabilidad() {
  const contenido = document.getElementById('contenido');
  if (!contenido) return;

  contenido.innerHTML =
    '<div class="ct-cabecera-lista">' +
      '<button type="button" class="ct-flotante" id="ct-btn-nuevo" aria-label="Nuevo apunte"><i class="ti ti-plus"></i></button>' +
    '</div>' +
    '<div class="ct-barra" style="position:relative">' +
      '<input type="text" class="ct-buscador" id="ct-buscador" placeholder="Buscar..." value="' + escaparHtml(ctBusqueda) + '">' +
      '<button type="button" class="ct-btn-filtro' + ((ctFiltroTipo !== 'todos' || ctFiltroAmbito !== 'todos') ? ' con-filtro' : '') + '" id="ct-btn-filtro"><i class="ti ti-filter"></i></button>' +
      ctRenderFiltrosPanel() +
    '</div>' +
    '<div id="ct-lista-contenedor"></div>';

  document.getElementById('ct-btn-nuevo').addEventListener('click', function () { abrirFormularioApunte(null); });

  ctCablearBarra();
  ctRepintarLista();
}

function ctRenderFiltrosPanel() {
  const tipos = [['todos', 'Todos'], ['ingreso', 'Ingresos'], ['gasto', 'Gastos']];
  const ambitos = [['todos', 'Todos'], ['empresa', 'Empresa'], ['personal', 'Personal']];
  const ordenes = [
    ['fecha-desc', 'Fecha (más nuevo primero)'],
    ['fecha-asc', 'Fecha (más antiguo primero)'],
    ['total-desc', 'Importe (mayor primero)']
  ];

  // Tipo y Ámbito son dos filtros independientes que se combinan entre
  // sí (no son pestañas excluyentes entre ellos): se puede marcar
  // "Ingresos" y "Empresa" a la vez para ver solo los ingresos de
  // empresa, por ejemplo.
  return '<div class="ct-filtros-panel" id="ct-filtros-panel">' +
    '<p class="ct-filtros-titulo">Tipo</p>' +
    tipos.map(function (op) {
      return '<button type="button" data-tipo="' + op[0] + '"' +
        (op[0] === ctFiltroTipo ? ' class="activa"' : '') + '>' + escaparHtml(op[1]) + '</button>';
    }).join('') +
    '<p class="ct-filtros-titulo">Ámbito</p>' +
    ambitos.map(function (op) {
      return '<button type="button" data-ambito="' + op[0] + '"' +
        (op[0] === ctFiltroAmbito ? ' class="activa"' : '') + '>' + escaparHtml(op[1]) + '</button>';
    }).join('') +
    '<p class="ct-filtros-titulo">Ordenar por</p>' +
    ordenes.map(function (op) {
      return '<button type="button" data-orden="' + op[0] + '"' +
        (op[0] === ctOrden ? ' class="activa"' : '') + '>' + escaparHtml(op[1]) + '</button>';
    }).join('') +
    '</div>';
}

function ctCablearBarra() {
  const buscador = document.getElementById('ct-buscador');
  buscador.addEventListener('input', function () {
    ctBusqueda = buscador.value;
    ctRepintarLista();
  });

  const btnFiltro = document.getElementById('ct-btn-filtro');
  const panel = document.getElementById('ct-filtros-panel');

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

  panel.querySelectorAll('[data-tipo]').forEach(function (b) {
    b.addEventListener('click', function () { ctFiltroTipo = b.dataset.tipo; pintarContabilidad(); });
  });
  panel.querySelectorAll('[data-ambito]').forEach(function (b) {
    b.addEventListener('click', function () { ctFiltroAmbito = b.dataset.ambito; pintarContabilidad(); });
  });
  panel.querySelectorAll('[data-orden]').forEach(function (b) {
    b.addEventListener('click', function () { ctOrden = b.dataset.orden; pintarContabilidad(); });
  });
}

function ctListaFiltrada() {
  const texto = normalizarBusqueda(ctBusqueda);
  return estado.apuntes.filter(function (a) {
    // Tipo y Ámbito se combinan (Y lógico), no son excluyentes entre
    // sí: se puede pedir "Ingresos" + "Empresa" a la vez.
    if (ctFiltroTipo === 'ingreso' && a.tipo !== 'ingreso') return false;
    if (ctFiltroTipo === 'gasto' && a.tipo !== 'gasto') return false;
    if (ctFiltroAmbito === 'empresa' && a.ambito !== 'empresa') return false;
    if (ctFiltroAmbito === 'personal' && a.ambito !== 'personal') return false;
    if (texto && ctTextoBusqueda(a).indexOf(texto) === -1) return false;
    return true;
  }).sort(function (a, b) {
    return compararRegistros(a, b, ctOrden);
  });
}

function ctRepintarLista() {
  const contenedor = document.getElementById('ct-lista-contenedor');
  if (!contenedor) return;
  const lista = ctListaFiltrada();

  if (lista.length === 0) {
    contenedor.innerHTML = '<p class="ct-vacio">' +
      (ctBusqueda || ctFiltroTipo !== 'todos' || ctFiltroAmbito !== 'todos'
        ? 'No hay resultados con estos filtros.'
        : 'Todavía no hay ningún apunte. Los de facturas pagadas se crean solos; para otros movimientos, usa el botón "+".') +
      '</p>';
    return;
  }

  contenedor.innerHTML =
    '<div class="ct-lista-movil">' + lista.map(ctRenderFilaMovil).join('') + '</div>' +
    '<div class="ct-tabla-wrap"><table class="ct-tabla"><thead><tr>' +
      '<th></th><th>Fecha</th><th>Contacto</th><th>Concepto</th>' +
      '<th class="ct-celda-derecha">Base</th><th class="ct-celda-derecha">IVA</th>' +
      '<th class="ct-celda-derecha">IRPF</th><th class="ct-celda-derecha">Total</th><th></th>' +
    '</tr></thead><tbody>' + lista.map(ctRenderFilaTabla).join('') + '</tbody></table></div>';

  ctCablearFilas(contenedor);
}

function ctRenderFilaMovil(a) {
  const esIngreso = a.tipo === 'ingreso';
  return '<div class="ct-fila" data-id="' + escaparHtml(a.id) + '">' +
    ctCirculoTipo(a, 42) +
    '<div class="ct-info">' +
      '<p class="ct-nombre">' + escaparHtml(ctConceptoMostrado(a)) + '</p>' +
      '<p class="ct-meta">' + escaparHtml(ctNombreContacto(a)) + ' · ' + escaparHtml(mostrarFecha(a.fecha)) + '</p>' +
    '</div>' +
    '<div class="ct-derecha">' +
      '<span class="ct-total-fila ' + (esIngreso ? 'ingreso' : 'gasto') + '">' +
        (esIngreso ? '+' : '−') + escaparHtml(formatMoney(a.total)) +
      '</span>' +
    '</div>' +
    '<div class="ct-control">' +
      '<button type="button" class="ct-btn-icono" data-mas="' + escaparHtml(a.id) + '" aria-label="Más opciones"><i class="ti ti-dots-vertical"></i></button>' +
      ctPuntoEstado(a) +
    '</div>' +
  '</div>';
}

function ctRenderFilaTabla(a) {
  const esIngreso = a.tipo === 'ingreso';
  return '<tr class="ct-fila-tabla" data-id="' + escaparHtml(a.id) + '">' +
    '<td>' + ctCirculoTipo(a, 32) + '</td>' +
    '<td>' + escaparHtml(mostrarFecha(a.fecha)) + '</td>' +
    '<td>' + escaparHtml(ctNombreContacto(a)) + '</td>' +
    '<td class="ct-celda-concepto">' +
      '<div class="ct-concepto-texto">' + escaparHtml(ctConceptoMostrado(a)) + '</div>' +
      '<div style="font-size:11px;color:var(--texto-secundario)">' + (a.ambito === 'personal' ? 'Personal' : 'Empresa') + '</div>' +
    '</td>' +
    '<td class="ct-celda-derecha">' + escaparHtml(formatMoney(a.base)) + '</td>' +
    '<td class="ct-celda-derecha">' + (parsearNumero(a.iva) > 0 ? '+' + escaparHtml(formatMoney(a.iva)) : '—') + '</td>' +
    '<td class="ct-celda-derecha">' + (parsearNumero(a.irpf) > 0 ? '−' + escaparHtml(formatMoney(a.irpf)) : '—') + '</td>' +
    '<td class="ct-celda-derecha ct-importe ' + (esIngreso ? 'ingreso' : 'gasto') + '" style="font-weight:600">' +
      (esIngreso ? '+' : '−') + escaparHtml(formatMoney(a.total)) +
    '</td>' +
    '<td><div class="ct-control">' +
      '<button type="button" class="ct-btn-icono" data-mas="' + escaparHtml(a.id) + '" aria-label="Más opciones"><i class="ti ti-dots-vertical"></i></button>' +
      ctPuntoEstado(a) +
    '</div></td>' +
  '</tr>';
}

function ctCablearFilas(contenedor) {
  contenedor.querySelectorAll('.ct-fila, .ct-fila-tabla').forEach(function (fila) {
    fila.addEventListener('click', function (ev) {
      if (ev.target.closest('.ct-control')) return;
      abrirFichaApunte(fila.dataset.id);
    });
  });

  contenedor.querySelectorAll('[data-mas]').forEach(function (b) {
    b.addEventListener('click', function (ev) {
      ev.stopPropagation();
      ctAbrirMenuMas(b, b.dataset.mas);
    });
  });
}

// ============================================================
// 4. MENÚ "MÁS OPCIONES"
// ============================================================

function ctAbrirMenuMas(boton, id) {
  document.querySelectorAll('.ct-menu-mas').forEach(function (m) { m.remove(); });

  const a = estado.apuntes.find(function (x) { return String(x.id) === String(id); });
  if (!a) return;

  const automatico = ctEsAutomatico(a);

  const menu = document.createElement('div');
  menu.className = 'ct-menu-mas';
  menu.innerHTML =
    (ctEstadoSync(a) === 'error'
      ? '<button type="button" class="destacado" data-accion="reintentar">Reintentar guardado</button>'
      : '') +
    (automatico
      ? '<button type="button" data-accion="' + (ctVieneDeImpuesto(a) ? 'verimpuesto' : 'verfactura') + '">' +
          (ctVieneDeImpuesto(a) ? 'Ver en Impuestos' : 'Ver factura') + '</button>'
      : '<button type="button" data-accion="editar">Editar</button>' +
        (ctEsConvertible(a) ? '<button type="button" data-accion="convertir">Convertir en factura</button>' : '') +
        '<button type="button" class="peligro" data-accion="eliminar">Eliminar</button>');

  document.body.appendChild(menu);
  ctPosicionarMenu(menu, boton);

  function cerrarMenu() {
    menu.remove();
    document.removeEventListener('click', cerrarSiFuera);
  }
  function cerrarSiFuera(ev) { if (!menu.contains(ev.target)) cerrarMenu(); }

  menu.querySelector('[data-accion="reintentar"]')?.addEventListener('click', function () { cerrarMenu(); ctReintentarGuardado(id); });
  menu.querySelector('[data-accion="editar"]')?.addEventListener('click', function () { cerrarMenu(); abrirFormularioApunte(id); });
  menu.querySelector('[data-accion="eliminar"]')?.addEventListener('click', function () { cerrarMenu(); ctEliminar(id); });
  menu.querySelector('[data-accion="verfactura"]')?.addEventListener('click', function () { cerrarMenu(); ctVerFactura(a); });
  menu.querySelector('[data-accion="verimpuesto"]')?.addEventListener('click', function () { cerrarMenu(); ctVerImpuesto(a); });
  menu.querySelector('[data-accion="convertir"]')?.addEventListener('click', function () { cerrarMenu(); abrirConversorFactura(id); });

  setTimeout(function () { document.addEventListener('click', cerrarSiFuera); }, 0);
}

function ctPosicionarMenu(menu, boton) {
  const rect = boton.getBoundingClientRect();
  const alto = menu.offsetHeight;
  const espacioAbajo = window.innerHeight - rect.bottom;
  const arriba = espacioAbajo < alto + 12;

  menu.style.top = arriba ? (rect.top - alto - 4) + 'px' : (rect.bottom + 4) + 'px';
  menu.style.left = Math.max(8, rect.right - menu.offsetWidth) + 'px';
}

// Abre la ficha de la factura de origen directamente encima de la
// pantalla actual, sin cambiar de sección — mismo patrón que "Nuevo
// presupuesto" desde la ficha de Clientes.
function ctVerFactura(a) {
  if (a.id_factura_venta) {
    if (typeof abrirFichaFacturaVenta !== 'function') { alert('El módulo de Facturas no está disponible.'); return; }
    abrirFichaFacturaVenta(a.id_factura_venta);
    return;
  }
  if (a.id_factura_compra) {
    if (typeof abrirFichaFacturaCompra !== 'function') { alert('El módulo de Facturas no está disponible.'); return; }
    abrirFichaFacturaCompra(a.id_factura_compra);
    return;
  }
  alert('Este apunte no tiene una factura de origen disponible.');
}

// Lleva a Impuestos, al trimestre exacto del registro que generó este
// apunte. Si el módulo de Impuestos no está cargado (no debería pasar,
// pero por si acaso), avisa en vez de fallar en silencio.
function ctVerImpuesto(a) {
  const r = estado.impuestos.find(function (x) { return String(x.id) === String(a.id_impuesto); });
  if (!r || typeof impIrAlPeriodoDe !== 'function') {
    alert('Este apunte no tiene un registro de Impuestos disponible.');
    return;
  }
  if (typeof cambiarVista === 'function') cambiarVista('impuestos');
  impIrAlPeriodoDe(r.id);
}

async function ctEliminar(id) {
  const a = estado.apuntes.find(function (x) { return String(x.id) === String(id); });
  if (!a) return;
  if (ctEsAutomatico(a)) {
    alert(ctVieneDeImpuesto(a)
      ? 'Este apunte viene de un pago de impuestos y no se puede eliminar desde aquí. Se modifica desde Impuestos.'
      : 'Este apunte viene de una factura y no se puede eliminar desde aquí. Se modifica desde la propia factura.');
    return;
  }
  if (!confirm('¿Eliminar este apunte? Esta acción no se puede deshacer.')) return;
  if (!puedeEscribir()) return;

  ctMarcarSync(id, 'guardando');
  ctRepintarLista();

  const resultado = await borrarRegistro('apuntes', id, ctRepintarLista, null);
  if (resultado.status !== 'success') {
    ctMarcarSync(id, 'error');
    ctRepintarLista();
    return;
  }
  ctMarcarSync(id, null);
  ctRepintarLista();
}

function ctReintentarGuardado(id) {
  const pendiente = ctPendientes[String(id)];
  const registro = pendiente
    ? pendiente.registro
    : estado.apuntes.find(function (x) { return String(x.id) === String(id); });
  if (!registro) return;

  ctMarcarSync(id, 'guardando');
  ctRepintarLista();

  guardarRegistro('apuntes', registro, ctRepintarLista, null).then(function (resultado) {
    if (resultado.status !== 'success') {
      ctMarcarSync(id, 'error');
      ctRepintarLista();
      return;
    }
    ctMarcarSync(id, null);
    delete ctPendientes[String(id)];
    ctRepintarLista();
  });
}

// ============================================================
// 5. FICHA DE DETALLE (solo lectura — se cierra al tocar fuera)
// ============================================================

function abrirFichaApunte(id) {
  const a = estado.apuntes.find(function (x) { return String(x.id) === String(id); });
  if (!a) return;

  const esIngreso = a.tipo === 'ingreso';
  const automatico = ctEsAutomatico(a);
  const contacto = ctContactoDe(a);

  const fondo = document.createElement('div');
  fondo.className = 'ct-modal-fondo';
  fondo.innerHTML =
    '<div class="ct-modal">' +
      '<div class="ct-modal-cabecera">' +
        ctCirculoTipo(a, 44) +
        '<div class="ct-modal-texto">' +
          '<p class="ct-modal-titulo">' + escaparHtml(esIngreso ? 'Ingreso' : 'Gasto') + '</p>' +
          '<p class="ct-modal-subtitulo">' + escaparHtml(mostrarFecha(a.fecha)) + ' · ' + (a.ambito === 'personal' ? 'Personal' : 'Empresa') + '</p>' +
        '</div>' +
        '<button type="button" class="ct-modal-cerrar" aria-label="Cerrar"><i class="ti ti-x"></i></button>' +
      '</div>' +

      '<div class="ct-modal-cuerpo">' +
        (ctVieneDeImpuesto(a)
          ? '<p class="ct-aviso">Este apunte viene de un pago de impuestos y se actualiza solo. Para cambiarlo, edítalo desde Impuestos.</p>'
          : ctVieneDeFactura(a)
            ? '<p class="ct-aviso">Este apunte viene de una factura y se actualiza solo. Para cambiarlo, edítalo desde la propia factura.</p>'
            : '') +
        '<div class="ct-ficha-dato"><span>Concepto</span><span>' + escaparHtml(ctConceptoMostrado(a)) + '</span></div>' +
        '<div class="ct-ficha-dato"><span>Contacto</span><span>' + escaparHtml(contacto ? contacto.nombre_contacto : '—') + '</span></div>' +
        '<div class="ct-ficha-dato"><span>Fecha</span><span>' + escaparHtml(mostrarFecha(a.fecha)) + '</span></div>' +

        '<div class="ct-bloque">' +
          '<p class="ct-bloque-titulo">Importes</p>' +
          '<div class="ct-linea"><span>Base</span><strong>' + escaparHtml(formatMoney(a.base)) + '</strong></div>' +
          (parsearNumero(a.iva) > 0
            ? '<div class="ct-linea"><span>IVA (' + parsearNumero(a.iva_pct) + '%)</span><strong>+' + escaparHtml(formatMoney(a.iva)) + '</strong></div>'
            : '') +
          (parsearNumero(a.irpf) > 0
            ? '<div class="ct-linea"><span>Retención IRPF (' + parsearNumero(a.irpf_pct) + '%)</span><strong>−' + escaparHtml(formatMoney(a.irpf)) + '</strong></div>'
            : '') +
          '<div class="ct-total-final"><span>TOTAL</span><strong class="' + (esIngreso ? 'ingreso' : 'gasto') + '">' +
            (esIngreso ? '+' : '−') + escaparHtml(formatMoney(a.total)) + '</strong></div>' +
        '</div>' +
      '</div>' +

      '<div class="ct-modal-pie">' +
        (ctVieneDeImpuesto(a)
          ? '<button type="button" class="boton-principal" id="ct-ficha-verimpuesto">Ver en Impuestos</button>'
          : ctVieneDeFactura(a)
            ? '<button type="button" class="boton-principal" id="ct-ficha-verfactura">Ver factura</button>'
            : ctEsConvertible(a)
              ? '<button type="button" class="boton-secundario" id="ct-ficha-editar">Editar</button>' +
                '<button type="button" class="boton-principal" id="ct-ficha-convertir">Convertir en factura</button>'
              : '<button type="button" class="boton-principal" id="ct-ficha-editar">Editar</button>') +
      '</div>' +
    '</div>';

  document.body.appendChild(fondo);

  function cerrar() {
    fondo.remove();
    document.removeEventListener('keydown', alPulsarTecla);
  }
  function alPulsarTecla(ev) { if (ev.key === 'Escape') cerrar(); }

  fondo.addEventListener('click', function (ev) { if (ev.target === fondo) cerrar(); });
  document.addEventListener('keydown', alPulsarTecla);
  fondo.querySelector('.ct-modal-cerrar').addEventListener('click', cerrar);

  fondo.querySelector('#ct-ficha-verfactura')?.addEventListener('click', function () { cerrar(); ctVerFactura(a); });
  fondo.querySelector('#ct-ficha-verimpuesto')?.addEventListener('click', function () { cerrar(); ctVerImpuesto(a); });
  fondo.querySelector('#ct-ficha-editar')?.addEventListener('click', function () { cerrar(); abrirFormularioApunte(id); });
  fondo.querySelector('#ct-ficha-convertir')?.addEventListener('click', function () { cerrar(); abrirConversorFactura(id); });
}

// ============================================================
// 6. FORMULARIO (solo apuntes manuales)
// ============================================================
// No se cierra al tocar fuera (regla de formularios con trabajo dentro).

function ctCampo(clave, etiqueta, valor, opciones) {
  const o = opciones || {};
  return '<div class="ct-campo-grupo' + (o.anchoTotal ? ' ancho-total' : '') + '">' +
    '<label for="ct-campo-' + clave + '">' + escaparHtml(etiqueta) + (o.requerido ? ' *' : '') + '</label>' +
    (o.textarea
      ? '<textarea class="campo" id="ct-campo-' + clave + '">' + escaparHtml(valor || '') + '</textarea>'
      : '<input class="campo" id="ct-campo-' + clave + '" type="text"' +
        (o.numero ? ' data-numero="1" inputmode="decimal"' : '') +
        ' value="' + escaparHtml(valor === 0 ? '0' : (valor || '')) + '">') +
    '<p class="ct-mensaje-error" data-error-de="' + clave + '" hidden></p>' +
  '</div>';
}

function ctSelect(clave, etiqueta, opciones, valor, extra) {
  const o = extra || {};
  return '<div class="ct-campo-grupo' + (o.anchoTotal ? ' ancho-total' : '') + '">' +
    '<label for="ct-campo-' + clave + '">' + escaparHtml(etiqueta) + '</label>' +
    '<select class="campo" id="ct-campo-' + clave + '"' + (o.deshabilitado ? ' disabled' : '') + '>' +
      opciones.map(function (op) {
        return '<option value="' + escaparHtml(op[0]) + '"' + (String(op[0]) === String(valor) ? ' selected' : '') + '>' +
          escaparHtml(op[1]) + '</option>';
      }).join('') +
    '</select>' +
  '</div>';
}

function abrirFormularioApunte(id) {
  const editando = !!id;
  const original = editando ? estado.apuntes.find(function (x) { return String(x.id) === String(id); }) : null;
  if (editando && !original) return;

  if (original && ctEsAutomatico(original)) {
    alert('Este apunte viene de una factura y no se puede editar desde aquí.');
    return;
  }

  const tiposIva = preTiposIva();
  const tiposIrpf = preTiposIrpf();

  const datos = {
    fecha: original ? normalizarFecha(original.fecha) : fechaHoyISO(),
    ambito: original ? (original.ambito || 'empresa') : 'empresa',
    tipo: original ? (original.tipo || 'gasto') : 'gasto',
    id_contacto: original ? String(original.id_contacto || '') : '',
    concepto: original ? (original.concepto || '') : '',
    total: original ? parsearNumero(original.total) : '',
    iva_pct: original ? parsearNumero(original.iva_pct) : 0,
    irpf_pct: original ? parsearNumero(original.irpf_pct) : 0
  };

  const titulo = editando ? 'Editar apunte' : 'Nuevo apunte';

  const fondo = document.createElement('div');
  fondo.className = 'ct-modal-fondo';
  fondo.innerHTML =
    '<div class="ct-modal">' +
      '<div class="ct-modal-cabecera">' +
        '<div class="ct-modal-texto">' +
          '<p class="ct-modal-titulo">' + escaparHtml(titulo) + '</p>' +
        '</div>' +
        '<button type="button" class="ct-modal-cerrar" aria-label="Cerrar"><i class="ti ti-x"></i></button>' +
      '</div>' +

      '<div class="ct-modal-cuerpo">' +
        '<form id="ct-form">' +
          '<div class="ct-form-grid dos-columnas">' +

            '<div class="ct-selector" id="ct-selector-tipo">' +
              '<button type="button" data-tipo="ingreso" class="' + (datos.tipo === 'ingreso' ? 'activa ingreso' : '') + '">Ingreso</button>' +
              '<button type="button" data-tipo="gasto" class="' + (datos.tipo === 'gasto' ? 'activa gasto' : '') + '">Gasto</button>' +
            '</div>' +
            '<div class="ct-selector" id="ct-selector-ambito">' +
              '<button type="button" data-ambito="empresa" class="' + (datos.ambito === 'empresa' ? 'activa' : '') + '">Empresa</button>' +
              '<button type="button" data-ambito="personal" class="' + (datos.ambito === 'personal' ? 'activa' : '') + '">Personal</button>' +
            '</div>' +

            '<div class="ct-campo-grupo"><label for="ct-campo-fecha">Fecha *</label>' +
              '<input class="campo" type="date" id="ct-campo-fecha" value="' + escaparHtml(datos.fecha) + '">' +
              '<p class="ct-mensaje-error" data-error-de="fecha" hidden></p></div>' +

            '<div class="ct-campo-grupo" id="ct-grupo-contacto"></div>' +

            ctCampo('concepto', 'Concepto', datos.concepto, { anchoTotal: true, requerido: true }) +

            ctCampo('total', 'Total (lo que se cobró o pagó de verdad)', datos.total, { numero: true, requerido: true, anchoTotal: true }) +

            '<div id="ct-grupo-impuestos" class="ct-form-grid dos-columnas" style="grid-column:1/-1;margin:0">' +
              ctSelect('iva_pct', 'IVA', [['0', 'Sin IVA']].concat(tiposIva.map(function (x) { return [String(x.porcentaje), x.nombre + ' (' + x.porcentaje + '%)']; })), datos.iva_pct) +
              ctSelect('irpf_pct', 'IRPF', [['0', 'Sin IRPF']].concat(tiposIrpf.map(function (x) { return [String(x.porcentaje), x.nombre + ' (' + x.porcentaje + '%)']; })), datos.irpf_pct) +
            '</div>' +
            '<p class="ct-aviso" id="ct-aviso-personal" style="grid-column:1/-1" hidden>Un movimiento personal no lleva impuestos: el total se guarda tal cual, como base.</p>' +
          '</div>' +

          '<div class="ct-bloque" id="ct-totales"></div>' +
        '</form>' +
      '</div>' +

      '<div class="ct-modal-pie">' +
        '<button type="button" class="boton-secundario" id="ct-form-cancelar">Cancelar</button>' +
        '<button type="submit" form="ct-form" class="boton-principal">Guardar</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(fondo);

  fondo.querySelector('.ct-modal-cerrar').addEventListener('click', function () { fondo.remove(); });
  fondo.querySelector('#ct-form-cancelar').addEventListener('click', function () { fondo.remove(); });

  fondo.querySelector('#ct-selector-tipo').querySelectorAll('[data-tipo]').forEach(function (b) {
    b.addEventListener('click', function () {
      datos.tipo = b.dataset.tipo;
      fondo.querySelector('#ct-selector-tipo').querySelectorAll('button').forEach(function (x) { x.className = ''; });
      b.className = 'activa ' + b.dataset.tipo;
      ctPintarSelectorContacto(fondo, datos);
      ctActualizarFormulario(fondo, datos);
    });
  });

  fondo.querySelector('#ct-selector-ambito').querySelectorAll('[data-ambito]').forEach(function (b) {
    b.addEventListener('click', function () {
      datos.ambito = b.dataset.ambito;
      fondo.querySelector('#ct-selector-ambito').querySelectorAll('button').forEach(function (x) { x.className = ''; });
      b.className = 'activa';
      ctActualizarFormulario(fondo, datos);
    });
  });

  ctPintarSelectorContacto(fondo, datos);

  fondo.querySelectorAll('#ct-form input, #ct-form select, #ct-form textarea').forEach(function (el) {
    el.addEventListener('input', function () { ctActualizarFormulario(fondo, datos); });
    el.addEventListener('change', function () { ctActualizarFormulario(fondo, datos); });
  });

  fondo.querySelector('#ct-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    ctProcesarGuardado(fondo, original, datos);
  });

  ctActualizarFormulario(fondo, datos);
}

// El contacto disponible cambia entre Cliente y Proveedor según el
// tipo (mapa 11.3), igual que en la app original.
function ctPintarSelectorContacto(fondo, datos) {
  const grupo = fondo.querySelector('#ct-grupo-contacto');
  const contactos = datos.tipo === 'ingreso' ? fvClientesDisponibles() : fcProveedoresDisponibles();
  const etiqueta = datos.tipo === 'ingreso' ? 'Cliente' : 'Proveedor';

  const idPrevio = fondo.querySelector('#ct-campo-id_contacto') ? fondo.querySelector('#ct-campo-id_contacto').value : datos.id_contacto;
  const sigueExistiendo = contactos.some(function (c) { return String(c.id) === String(idPrevio); });

  grupo.innerHTML =
    '<label for="ct-campo-id_contacto">' + etiqueta + '</label>' +
    '<select class="campo" id="ct-campo-id_contacto">' +
      '<option value="">Sin contacto</option>' +
      contactos.map(function (c) {
        return '<option value="' + escaparHtml(String(c.id)) + '"' + (sigueExistiendo && String(c.id) === String(idPrevio) ? ' selected' : '') + '>' +
          escaparHtml(c.nombre_contacto) + '</option>';
      }).join('') +
    '</select>';

  grupo.querySelector('#ct-campo-id_contacto').addEventListener('change', function () { ctActualizarFormulario(fondo, datos); });
}

function ctLeerFormulario(fondo, datos) {
  const valor = function (id) {
    const el = fondo.querySelector('#ct-campo-' + id);
    return el ? el.value : '';
  };
  return {
    fecha: valor('fecha'),
    ambito: datos.ambito,
    tipo: datos.tipo,
    id_contacto: valor('id_contacto'),
    concepto: valor('concepto').trim(),
    total: parsearNumero(valor('total')),
    iva_pct: parsearNumero(valor('iva_pct')),
    irpf_pct: parsearNumero(valor('irpf_pct'))
  };
}

function ctActualizarFormulario(fondo, datos) {
  const d = ctLeerFormulario(fondo, datos);
  const esPersonal = d.ambito === 'personal';

  fondo.querySelector('#ct-grupo-impuestos').style.display = esPersonal ? 'none' : 'grid';
  fondo.querySelector('#ct-aviso-personal').hidden = !esPersonal;

  const t = ctTotalesDesdeTotal(d.total, d.iva_pct, d.irpf_pct, d.ambito);
  const esIngreso = d.tipo === 'ingreso';

  fondo.querySelector('#ct-totales').innerHTML =
    '<p class="ct-bloque-titulo">Se guardará así</p>' +
    '<div class="ct-linea"><span>Base</span><strong>' + escaparHtml(formatMoney(t.base)) + '</strong></div>' +
    (!esPersonal ? '<div class="ct-linea"><span>IVA (' + t.ivaPct + '%)</span><strong>+' + escaparHtml(formatMoney(t.iva)) + '</strong></div>' : '') +
    (!esPersonal ? '<div class="ct-linea"><span>Retención IRPF (' + t.irpfPct + '%)</span><strong>−' + escaparHtml(formatMoney(t.irpf)) + '</strong></div>' : '') +
    '<div class="ct-total-final"><span>TOTAL</span><strong class="' + (esIngreso ? 'ingreso' : 'gasto') + '">' +
      (esIngreso ? '+' : '−') + escaparHtml(formatMoney(t.total)) + '</strong></div>';
}

// ============================================================
// 7. GUARDADO
// ============================================================

function ctMostrarError(fondo, campo, mensaje) {
  const input = fondo.querySelector('#ct-campo-' + campo);
  const p = fondo.querySelector('[data-error-de="' + campo + '"]');
  if (input) input.classList.add('ct-campo-error');
  if (p) { p.textContent = mensaje; p.hidden = false; }
}

function ctLimpiarErrores(fondo) {
  fondo.querySelectorAll('.ct-campo-error').forEach(function (el) { el.classList.remove('ct-campo-error'); });
  fondo.querySelectorAll('[data-error-de]').forEach(function (el) { el.hidden = true; });
}

function ctProcesarGuardado(fondo, original, datosSelector) {
  ctLimpiarErrores(fondo);
  const d = ctLeerFormulario(fondo, datosSelector);

  let valido = true;
  if (!d.fecha) { ctMostrarError(fondo, 'fecha', 'Obligatoria'); valido = false; }
  if (!d.concepto) { ctMostrarError(fondo, 'concepto', 'Escribe un concepto para el movimiento.'); valido = false; }
  if (!(d.total > 0)) { ctMostrarError(fondo, 'total', 'Escribe el importe total.'); valido = false; }
  if (!valido) return;

  const t = ctTotalesDesdeTotal(d.total, d.iva_pct, d.irpf_pct, d.ambito);
  const fecha = normalizarFecha(d.fecha);
  const idApunte = original ? original.id : ctNuevoId('apu');

  const registro = {
    id: idApunte,
    ambito: d.ambito,
    tipo: d.tipo,
    fecha: fecha,
    concepto: d.concepto,
    base: t.base,
    iva_pct: t.ivaPct,
    iva: t.iva,
    irpf_pct: t.irpfPct,
    irpf: t.irpf,
    total: t.total,
    impuesto_tipo: d.ambito === 'personal' ? 'ninguno' : ctTipoImpuesto(t.iva, t.irpf),
    impuesto_trimestre: d.ambito === 'empresa' ? ctTrimestreDeFecha(fecha) : '',
    impuesto_año: d.ambito === 'empresa' && fecha ? parseInt(fecha.split('-')[0], 10) : '',
    id_factura_venta: original ? (original.id_factura_venta || '') : '',
    id_factura_compra: original ? (original.id_factura_compra || '') : '',
    id_impuesto: original ? (original.id_impuesto || '') : '',
    impuesto_pago: original ? (original.impuesto_pago || '') : '',
    id_contacto: d.id_contacto || ''
  };

  // La ventana se cierra al momento; el guardado sigue en segundo plano.
  fondo.remove();

  ctMarcarSync(idApunte, 'guardando');
  ctGuardarEnSegundoPlano(registro);
  pintarContabilidad();
}

function ctGuardarEnSegundoPlano(registro) {
  return guardarRegistro('apuntes', registro, ctRepintarLista, null)
    .then(function (resultado) {
      if (resultado.status !== 'success') {
        ctReponerLocal(registro);
        ctMarcarSync(registro.id, 'error');
        ctPendientes[String(registro.id)] = { registro: registro };
        ctRepintarLista();
        return;
      }
      ctMarcarSync(registro.id, null);
      delete ctPendientes[String(registro.id)];
      ctRepintarLista();
    })
    .catch(function (err) {
      console.error('Fallo al guardar el apunte:', err);
      ctReponerLocal(registro);
      ctMarcarSync(registro.id, 'error');
      ctPendientes[String(registro.id)] = { registro: registro };
      ctRepintarLista();
    });
}

function ctReponerLocal(registro) {
  const i = estado.apuntes.findIndex(function (r) { return String(r.id) === String(registro.id); });
  if (i >= 0) estado.apuntes[i] = registro;
  else estado.apuntes.push(registro);
  guardarEntidadLocal('apuntes');
}

// ============================================================
// 8. CONVERTIR UN APUNTE EN FACTURA
// ============================================================
// Para cuando el dinero se mueve antes de que exista la factura.
//
// Es un conversor BÁSICO a propósito (decisión 05/09/2026): solo base
// imponible, IVA, IRPF y total, además de los datos de facturación y
// la fecha. NO aplica el ajuste por tipo de cliente ni descuentos
// especiales, porque la base que escribiste en el apunte ya es la
// cifra buena — el ajuste, si lo hubo, ya está dentro.
//
// Las DOS fechas son distintas y cada una manda en un sitio:
//   · la fecha de la FACTURA decide en qué trimestre tributa;
//   · la fecha del APUNTE es cuando se movió el dinero, y se queda
//     como fecha de cobro o de pago de la factura.
//
// Al guardar, el apunte NO se borra ni se duplica: se engancha a la
// factura recién creada y pasa a ser su apunte automático, con los
// importes de la factura y su fecha original de cobro/pago.

// Siguiente número libre de la serie de ventas para un año concreto.
// `fvSiguienteNumero()` solo sabe del año en curso; aquí hace falta
// poder emitir con fecha de otro año.
function ctSiguienteNumeroVenta(anio) {
  const prefijo = (typeof FV_PREFIJO_SERIE !== 'undefined') ? FV_PREFIJO_SERIE : 'F';
  const patron = new RegExp('^' + prefijo + anio + '\\/(\\d{4})$');
  let mayor = 0;
  estado.ventas.forEach(function (f) {
    if (String(f.estado_registro || '').toLowerCase() !== 'activo') return;
    const m = String(f.numero || '').match(patron);
    if (m) mayor = Math.max(mayor, parseInt(m[1], 10));
  });
  return prefijo + anio + '/' + String(mayor + 1).padStart(4, '0');
}

// Cálculo del conversor: se parte de la base, no del total.
function ctTotalesDesdeBase(base, ivaPct, irpfPct) {
  const b = roundMoney(parsearNumero(base));
  const pIva = parsearNumero(ivaPct);
  const pIrpf = parsearNumero(irpfPct);
  const iva = roundMoney(b * pIva / 100);
  const irpf = roundMoney(b * pIrpf / 100);
  return { base: b, ivaPct: pIva, iva: iva, irpfPct: pIrpf, irpf: irpf, total: roundMoney(b + iva - irpf) };
}

function abrirConversorFactura(id) {
  const apunte = estado.apuntes.find(function (x) { return String(x.id) === String(id); });
  if (!apunte) return;

  if (!ctEsConvertible(apunte)) {
    alert('Solo se pueden convertir en factura los apuntes de empresa creados a mano.');
    return;
  }

  const esVenta = String(apunte.tipo) === 'ingreso';
  const contactos = esVenta ? fvClientesDisponibles() : fcProveedoresDisponibles();

  if (contactos.length === 0) {
    alert(esVenta
      ? 'No hay ningún cliente activo. Crea el cliente antes de emitir la factura.'
      : 'No hay ningún proveedor activo. Crea el proveedor antes de registrar la factura.');
    return;
  }

  const tiposIva = preTiposIva();
  const tiposIrpf = preTiposIrpf();

  const fechaApunte = normalizarFecha(apunte.fecha) || fechaHoyISO();
  const contactoPrevio = contactos.some(function (c) { return String(c.id) === String(apunte.id_contacto); })
    ? String(apunte.id_contacto) : '';

  const datos = {
    fecha: fechaApunte,
    id_contacto: contactoPrevio,
    concepto: String(apunte.concepto || ''),
    base: parsearNumero(apunte.base),
    iva_pct: parsearNumero(apunte.iva_pct),
    irpf_pct: parsearNumero(apunte.irpf_pct),
    numero: ''
  };

  const titulo = esVenta ? 'Convertir en factura de venta' : 'Convertir en factura de compra';
  const etiquetaContacto = esVenta ? 'Cliente' : 'Proveedor';

  const fondo = document.createElement('div');
  fondo.className = 'ct-modal-fondo';
  fondo.innerHTML =
    '<div class="ct-modal">' +
      '<div class="ct-modal-cabecera">' +
        '<div class="ct-modal-texto">' +
          '<p class="ct-modal-titulo">' + escaparHtml(titulo) + '</p>' +
          '<p class="ct-modal-subtitulo">El apunte del ' + escaparHtml(mostrarFecha(fechaApunte)) + ' quedará enganchado a esta factura</p>' +
        '</div>' +
        '<button type="button" class="ct-modal-cerrar" aria-label="Cerrar"><i class="ti ti-x"></i></button>' +
      '</div>' +

      '<div class="ct-modal-cuerpo">' +
        '<form id="ct-conv-form">' +
          '<div class="ct-form-grid dos-columnas">' +

            '<div class="ct-campo-grupo" id="ct-conv-grupo-numero"></div>' +

            '<div class="ct-campo-grupo"><label for="ct-campo-fecha">Fecha de la factura *</label>' +
              '<input class="campo" type="date" id="ct-campo-fecha" value="' + escaparHtml(datos.fecha) + '">' +
              '<p class="ct-mensaje-error" data-error-de="fecha" hidden></p></div>' +

            '<div class="ct-campo-grupo ancho-total">' +
              '<label for="ct-campo-id_contacto">' + escaparHtml(etiquetaContacto) + ' *</label>' +
              '<select class="campo" id="ct-campo-id_contacto">' +
                '<option value="">Selecciona...</option>' +
                contactos.map(function (c) {
                  return '<option value="' + escaparHtml(String(c.id)) + '"' +
                    (String(c.id) === datos.id_contacto ? ' selected' : '') + '>' +
                    escaparHtml(c.nombre_contacto) + '</option>';
                }).join('') +
              '</select>' +
              '<p class="ct-mensaje-error" data-error-de="id_contacto" hidden></p></div>' +

            ctCampo('concepto', 'Concepto', datos.concepto, { anchoTotal: true, requerido: true }) +
            ctCampo('base', 'Base imponible', datos.base, { numero: true, requerido: true, anchoTotal: true }) +

            '<div class="ct-form-grid dos-columnas" style="grid-column:1/-1;margin:0">' +
              ctSelect('iva_pct', 'IVA', [['0', 'Sin IVA']].concat(tiposIva.map(function (x) { return [String(x.porcentaje), x.nombre + ' (' + x.porcentaje + '%)']; })), datos.iva_pct) +
              ctSelect('irpf_pct', 'IRPF', [['0', 'Sin IRPF']].concat(tiposIrpf.map(function (x) { return [String(x.porcentaje), x.nombre + ' (' + x.porcentaje + '%)']; })), datos.irpf_pct) +
            '</div>' +

            '<p class="ct-aviso" style="grid-column:1/-1;margin:0">Esta conversión no aplica el ajuste por tipo de cliente ni descuentos: la base que escribas es la definitiva.</p>' +
          '</div>' +

          '<div class="ct-bloque" id="ct-conv-totales"></div>' +
          '<p class="ct-aviso" id="ct-conv-aviso-trimestre" style="margin:14px 0 0" hidden></p>' +
        '</form>' +
      '</div>' +

      '<div class="ct-modal-pie">' +
        '<button type="button" class="boton-secundario" id="ct-conv-cancelar">Cancelar</button>' +
        '<button type="submit" form="ct-conv-form" class="boton-principal">Crear factura</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(fondo);

  // No se cierra al tocar fuera: es un formulario con trabajo dentro.
  fondo.querySelector('.ct-modal-cerrar').addEventListener('click', function () { fondo.remove(); });
  fondo.querySelector('#ct-conv-cancelar').addEventListener('click', function () { fondo.remove(); });

  ctConvPintarNumero(fondo, esVenta);
  ctConvActualizar(fondo, esVenta);

  fondo.querySelectorAll('#ct-conv-form input, #ct-conv-form select').forEach(function (el) {
    el.addEventListener('input', function () { ctConvActualizar(fondo, esVenta); });
    el.addEventListener('change', function () { ctConvActualizar(fondo, esVenta); });
  });

  fondo.querySelector('#ct-conv-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    ctConvGuardar(fondo, apunte, esVenta);
  });
}

// El número de una factura de venta es automático, salvo que la fecha
// sea de un año distinto al actual: en ese caso la numeración
// automática no vale y se escribe a mano. En compras lo pone siempre
// el proveedor.
function ctConvPintarNumero(fondo, esVenta) {
  const grupo = fondo.querySelector('#ct-conv-grupo-numero');
  const fecha = normalizarFecha(fondo.querySelector('#ct-campo-fecha').value) || fechaHoyISO();
  const anio = parseInt(String(fecha).split('-')[0], 10);
  const anioActual = new Date().getFullYear();
  const valorPrevio = fondo.querySelector('#ct-campo-numero') ? fondo.querySelector('#ct-campo-numero').value : '';

  if (!esVenta) {
    grupo.innerHTML =
      '<label for="ct-campo-numero">Nº de factura del proveedor *</label>' +
      '<input class="campo" type="text" id="ct-campo-numero" value="' + escaparHtml(valorPrevio) + '">' +
      '<p class="ct-mensaje-error" data-error-de="numero" hidden></p>';
    grupo.querySelector('#ct-campo-numero').addEventListener('input', function () { ctConvActualizar(fondo, esVenta); });
    return;
  }

  const automatico = anio === anioActual;
  const sugerido = ctSiguienteNumeroVenta(anio > 1990 ? anio : anioActual);

  grupo.innerHTML =
    '<label for="ct-campo-numero">Número' + (automatico ? '' : ' *') + '</label>' +
    '<input class="campo" type="text" id="ct-campo-numero" value="' +
      escaparHtml(automatico ? sugerido : (valorPrevio || sugerido)) + '"' +
      (automatico ? ' readonly' : '') + '>' +
    (automatico
      ? ''
      : '<p class="ct-mensaje-error" data-error-de="numero" hidden></p>' +
        '<p style="font-size:11px;color:var(--texto-secundario);margin:3px 0 0">La fecha es de ' + anio +
        ', así que el número no puede ser automático. Comprueba que encaja con tu serie de ese año.</p>');

  if (!automatico) {
    grupo.querySelector('#ct-campo-numero').addEventListener('input', function () { ctConvActualizar(fondo, esVenta); });
  }
}

function ctConvLeer(fondo) {
  const valor = function (id) {
    const el = fondo.querySelector('#ct-campo-' + id);
    return el ? el.value : '';
  };
  return {
    numero: String(valor('numero')).trim(),
    fecha: valor('fecha'),
    id_contacto: valor('id_contacto'),
    concepto: String(valor('concepto')).trim(),
    base: parsearNumero(valor('base')),
    iva_pct: parsearNumero(valor('iva_pct')),
    irpf_pct: parsearNumero(valor('irpf_pct'))
  };
}

function ctConvActualizar(fondo, esVenta) {
  const d = ctConvLeer(fondo);
  const t = ctTotalesDesdeBase(d.base, d.iva_pct, d.irpf_pct);

  fondo.querySelector('#ct-conv-totales').innerHTML =
    '<p class="ct-bloque-titulo">La factura quedará así</p>' +
    '<div class="ct-linea"><span>Base imponible</span><strong>' + escaparHtml(formatMoney(t.base)) + '</strong></div>' +
    '<div class="ct-linea"><span>IVA (' + t.ivaPct + '%)</span><strong>+' + escaparHtml(formatMoney(t.iva)) + '</strong></div>' +
    '<div class="ct-linea"><span>Retención IRPF (' + t.irpfPct + '%)</span><strong>−' + escaparHtml(formatMoney(t.irpf)) + '</strong></div>' +
    '<div class="ct-total-final"><span>TOTAL</span><strong class="' + (esVenta ? 'ingreso' : 'gasto') + '">' +
      escaparHtml(formatMoney(t.total)) + '</strong></div>';

  // Aviso si la fecha cae en un trimestre ya liquidado: esa estimación
  // pasada cambiará.
  const aviso = fondo.querySelector('#ct-conv-aviso-trimestre');
  const fecha = normalizarFecha(d.fecha);
  let liquidado = false;
  if (fecha && typeof impRegistroDe === 'function') {
    const anio = parseInt(String(fecha).split('-')[0], 10);
    const trimestre = fvTrimestreDeFecha(fecha);
    const r = impRegistroDe(anio, trimestre);
    liquidado = !!(r && (String(r.iva_estado || '').toLowerCase() === 'pagado' ||
                         String(r.irpf_estado || '').toLowerCase() === 'pagado'));
    if (liquidado) {
      aviso.textContent = 'Ojo: ' + trimestre + ' ' + anio + ' ya está marcado como pagado en Impuestos. ' +
        'Esta factura cambiará la estimación de ese trimestre.';
    }
  }
  aviso.hidden = !liquidado;
}

async function ctConvGuardar(fondo, apunte, esVenta) {
  ctLimpiarErrores(fondo);
  const d = ctConvLeer(fondo);

  let valido = true;
  if (!d.fecha) { ctMostrarError(fondo, 'fecha', 'Obligatoria'); valido = false; }
  if (!d.id_contacto) {
    ctMostrarError(fondo, 'id_contacto', esVenta ? 'Selecciona un cliente.' : 'Selecciona un proveedor.');
    valido = false;
  }
  if (!d.concepto) { ctMostrarError(fondo, 'concepto', 'Escribe un concepto.'); valido = false; }
  if (!(d.base > 0)) { ctMostrarError(fondo, 'base', 'Escribe la base imponible.'); valido = false; }
  if (!d.numero) { ctMostrarError(fondo, 'numero', 'Obligatorio'); valido = false; }
  if (!valido) return;

  const contacto = estado.clientes.find(function (c) { return String(c.id) === String(d.id_contacto); });
  if (!contacto) {
    ctMostrarError(fondo, 'id_contacto', 'Ese contacto ya no existe.');
    return;
  }
  if (!estado.modoPrueba && esDePrueba(contacto)) {
    alert('Ese contacto es de prueba y no puede usarse en una factura real.');
    return;
  }

  // Aviso no bloqueante de número repetido en compras, igual que en el
  // módulo de Facturas de compra.
  if (!esVenta) {
    const repetida = estado.compras.some(function (f) {
      return String(f.id_proveedor) === String(contacto.id) &&
             String(f.numero || '').trim().toLowerCase() === d.numero.toLowerCase();
    });
    if (repetida && !confirm('Ya hay una factura con ese número de este proveedor.\n\n¿Crearla de todas formas?')) return;
  }

  if (!puedeEscribir()) return;

  const t = ctTotalesDesdeBase(d.base, d.iva_pct, d.irpf_pct);
  const fechaFactura = normalizarFecha(d.fecha);
  const fechaMovimiento = normalizarFecha(apunte.fecha) || fechaFactura;
  const nombre = contacto.nombre_fiscal || contacto.nombre_contacto || '';

  fondo.remove();
  ctMarcarSync(apunte.id, 'guardando');
  ctRepintarLista();

  try {
    if (esVenta) {
      const idFactura = ctNuevoId('fv');
      const factura = {
        id: idFactura,
        numero: d.numero,
        fecha: fechaFactura,
        id_cliente: contacto.id,
        cliente: nombre,
        nif: contacto.nif || '',
        id_presupuesto: '',
        concepto: d.concepto,
        subtotal: t.base,
        ajuste_cliente_pct: 0,
        ajuste_cliente_importe: 0,
        compensacion_irpf_pct: 0,
        compensacion_irpf_importe: 0,
        descuento_especial_tipo: 'percent',
        descuento_especial_valor: 0,
        descuento_especial_importe: 0,
        base: t.base,
        iva_pct: t.ivaPct,
        iva: t.iva,
        irpf_pct: t.irpfPct,
        irpf: t.irpf,
        total: t.total,
        estado: 'pagada',
        fecha_cobro: fechaMovimiento,
        estado_registro: 'activo'
      };

      const guardada = await guardarRegistro('ventas', factura, null, null);
      if (guardada.status !== 'success') throw new Error('No se pudo crear la factura');

      const idFinal = (guardada.data && guardada.data.id) || idFactura;

      // Una sola línea con el concepto y la base (guardado en bloque, I9).
      const resLineas = await llamarBackend({
        action: 'save', sheet: 'ventas_detalle',
        data: { id_factura: idFinal, lineas: [{ orden: 1, descripcion: d.concepto, importe: t.base }] }
      });
      if (resLineas.status === 'success') {
        estado.ventas_detalle = estado.ventas_detalle.filter(function (l) { return String(l.id_factura) !== String(idFinal); });
        (resLineas.lineas || []).forEach(function (l) { estado.ventas_detalle.push(l); });
        guardarEntidadLocal('ventas_detalle');
      }

      await ctConvEngancharApunte(apunte, t, fechaMovimiento, contacto.id, {
        id_factura_venta: idFinal, id_factura_compra: '',
        concepto: 'Cobro factura ' + d.numero, tipo: 'ingreso'
      });

    } else {
      const idFactura = ctNuevoId('fc');
      const factura = {
        id: idFactura,
        numero: d.numero,
        fecha: fechaFactura,
        id_proveedor: contacto.id,
        proveedor: nombre,
        nif: contacto.nif || '',
        concepto: d.concepto,
        base: t.base,
        iva_pct: t.ivaPct,
        iva: t.iva,
        irpf_pct: t.irpfPct,
        irpf: t.irpf,
        total: t.total,
        estado: 'pagada',
        fecha_pago: fechaMovimiento,
        estado_registro: 'activo'
      };

      const guardada = await guardarRegistro('compras', factura, null, null);
      if (guardada.status !== 'success') throw new Error('No se pudo crear la factura');

      const idFinal = (guardada.data && guardada.data.id) || idFactura;

      await ctConvEngancharApunte(apunte, t, fechaMovimiento, contacto.id, {
        id_factura_venta: '', id_factura_compra: idFinal,
        concepto: 'Pago factura ' + d.numero, tipo: 'gasto'
      });
    }

    ctMarcarSync(apunte.id, null);
    pintarContabilidad();

  } catch (err) {
    console.error('No se pudo convertir el apunte en factura:', err);
    ctMarcarSync(apunte.id, 'error');
    ctRepintarLista();
    alert('No se ha podido crear la factura. El apunte se queda como estaba, no se ha perdido nada.');
  }
}

// El apunte no se borra ni se duplica: pasa a ser el apunte automático
// de la factura, conservando su fecha real de cobro o de pago.
async function ctConvEngancharApunte(apunte, t, fechaMovimiento, idContacto, vinculo) {
  const registro = {
    id: apunte.id,
    ambito: 'empresa',
    tipo: vinculo.tipo,
    fecha: fechaMovimiento,
    concepto: vinculo.concepto,
    base: t.base,
    iva_pct: t.ivaPct,
    iva: t.iva,
    irpf_pct: t.irpfPct,
    irpf: t.irpf,
    total: t.total,
    impuesto_tipo: fvTipoImpuestoApunte(t.iva, t.irpf),
    impuesto_trimestre: fvTrimestreDeFecha(fechaMovimiento),
    'impuesto_año': fechaMovimiento ? parseInt(fechaMovimiento.split('-')[0], 10) : new Date().getFullYear(),
    id_factura_venta: vinculo.id_factura_venta,
    id_factura_compra: vinculo.id_factura_compra,
    id_impuesto: '',
    impuesto_pago: '',
    id_contacto: idContacto || ''
  };
  await guardarRegistro('apuntes', registro, null, null);
}

// ============================================================
// 9. REGISTRO COMO VISTA
// ============================================================

registrarVista('contabilidad', {
  titulo: 'Contabilidad',
  pintar: pintarContabilidad
});
