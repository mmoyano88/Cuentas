/**
 * MÓDULO PENDIENTE
 * ------------------------------------------------------------
 * El "bloc de notas" de trabajos por facturar (octubre 2026). Cuando se
 * hacen varios trabajos para un mismo cliente, se van apuntando aquí
 * (concepto + importe) y, cuando toca, se facturan todos juntos: los
 * conceptos pasan a la descripción de la factura, uno por línea, y los
 * importes se suman.
 *
 * Hoja `pendiente` (una fila por trabajo):
 *   id | id_cliente | concepto | importe | id_factura | factura
 *
 * REGLAS DEL MÓDULO
 *  - Sin fecha editable ni descuento por trabajo: si hace falta una
 *    fecha se escribe en el concepto, y el descuento se pone al facturar.
 *  - Un trabajo está FACTURADO si tiene `id_factura` y esa factura está
 *    activa, o si esa factura ya no existe en la app (archivada). Si la
 *    factura está DESACTIVADA, el trabajo vuelve a pendiente; al
 *    reactivarla, vuelve a estar facturado. Por eso desactivar o
 *    reactivar una factura NO escribe nada en esta hoja.
 *  - Un trabajo facturado no se edita ni se borra. Un pendiente sí; si
 *    pertenecía a una factura desactivada y se edita, deja de estar
 *    unido a ella.
 *  - La fecha de apuntado sale de la hora de creación que lleva el id
 *    (pen-<hora en base 36>-<azar>): no hay columna para ella.
 *  - El cliente de un trabajo no se cambia una vez apuntado.
 *  - IVA e IRPF no se guardan aquí: son de la factura. En la vista
 *    previa y al facturar salen de la última factura del cliente (si no
 *    tiene, de Configuración).
 *
 * Reutiliza el formulario de Facturas de venta (cliente fijo y datos ya
 * rellenos) y sus estilos de fila, menú y ventana (clases fv-*).
 */

const PEN_ENTIDAD = 'pendiente';

let penClienteSel = '';        // id del cliente elegido en la fila de arriba ('' = ninguno)
let penDesmarcados = {};       // ids de trabajos desmarcados del cliente elegido (por defecto, todos marcados)
let penFiltroEstado = 'pendiente';   // 'pendiente' | 'facturado' | 'todos'
let penBusqueda = '';

// ============================================================
// 1. UTILIDADES
// ============================================================

function penNuevoId() {
  return 'pen-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e9).toString(36);
}

// Hora de creación (milisegundos), sacada del propio id.
function penCreado(t) {
  const partes = String(t.id || '').split('-');
  const n = parseInt(partes[1], 36);
  return isFinite(n) ? n : 0;
}

function penFechaApuntado(t) {
  const ms = penCreado(t);
  if (!ms) return '';
  const d = new Date(ms);
  const iso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  return mostrarFecha(iso);
}

function penImporte(t) {
  return roundMoney(parsearNumero(t.importe));
}

function penClienteDe(idCliente) {
  return estado.clientes.find(function (c) { return String(c.id) === String(idCliente); }) || null;
}

function penNombreCliente(idCliente) {
  const c = penClienteDe(idCliente);
  if (!c) return '—';
  return String(c.nombre_contacto || c.nombre_fiscal || '—');
}

function penClienteFacturable(c) {
  return !!c && c.estado === 'activo' && (c.rol === 'cliente' || c.rol === 'ambos');
}

function penFacturaDe(t) {
  if (!t.id_factura) return null;
  return estado.ventas.find(function (f) { return String(f.id) === String(t.id_factura); }) || null;
}

function penActiva(f) {
  return String(f.estado_registro || 'activo').toLowerCase() !== 'inactivo';
}

// Facturado = factura activa, o factura que ya no está en la app
// (archivada). Factura desactivada = vuelve a pendiente.
function penEsFacturado(t) {
  if (!t.id_factura) return false;
  const f = penFacturaDe(t);
  if (!f) return true;
  return penActiva(f);
}

// ---- Enlace con presupuestos (octubre 2026) ----
// Un trabajo puede venir de un presupuesto aceptado (columna id_presupuesto).
// Vacío = trabajo apuntado a mano, como siempre.
function penEsDePresupuesto(t) {
  return !!t && String(t.id_presupuesto || '') !== '';
}

function penPresupuestoDe(t) {
  if (!penEsDePresupuesto(t)) return null;
  return estado.presupuestos.find(function (p) { return String(p.id) === String(t.id_presupuesto); }) || null;
}

// Trabajo pendiente (sin facturar) unido a este presupuesto, o null.
function penPendienteDePresupuesto(idPresupuesto) {
  return estado.pendiente.find(function (t) {
    return String(t.id_presupuesto || '') === String(idPresupuesto) && !penEsFacturado(t);
  }) || null;
}

// ¿Hay algún trabajo unido a este presupuesto que ya esté facturado?
function penPresupuestoFacturado(idPresupuesto) {
  return estado.pendiente.some(function (t) {
    return String(t.id_presupuesto || '') === String(idPresupuesto) && penEsFacturado(t);
  });
}

// Abre Pendiente con un cliente ya elegido.
function penIrACliente(idCliente) {
  penClienteSel = String(idCliente);
  penDesmarcados = {};
  cambiarVista('pendiente');
}

function penPendientesDe(idCliente) {
  return estado.pendiente.filter(function (t) {
    return String(t.id_cliente) === String(idCliente) && !penEsFacturado(t);
  }).sort(function (a, b) { return penCreado(a) - penCreado(b); });
}

// Clientes con al menos un trabajo pendiente, el último apuntado primero.
function penClientesConPendientes() {
  const por = {};
  estado.pendiente.forEach(function (t) {
    if (penEsFacturado(t)) return;
    const k = String(t.id_cliente);
    if (!por[k]) por[k] = { id: k, ultimo: 0, n: 0, total: 0 };
    por[k].n += 1;
    por[k].total = roundMoney(por[k].total + penImporte(t));
    por[k].ultimo = Math.max(por[k].ultimo, penCreado(t));
  });
  return Object.keys(por).map(function (k) { return por[k]; })
    .sort(function (a, b) { return b.ultimo - a.ultimo; });
}

// IVA e IRPF por defecto de un cliente: los de su última factura activa
// (reconocidos por porcentaje en la lista de Configuración) o, si no
// tiene o no coinciden, el primero de cada lista, igual que el
// formulario de factura.
function penCondicionesDe(idCliente) {
  const tiposIva = preTiposIva();
  const tiposIrpf = preTiposIrpf();
  const ultima = estado.ventas.filter(function (f) {
    return String(f.id_cliente) === String(idCliente) && penActiva(f);
  }).sort(function (a, b) {
    return normalizarFecha(b.fecha).localeCompare(normalizarFecha(a.fecha)) ||
      String(b.id).localeCompare(String(a.id));
  })[0];

  let iva = tiposIva[0] || null;
  let irpf = tiposIrpf[0] || null;
  let deUltima = false;
  if (ultima) {
    const ei = tiposIva.find(function (x) { return Math.abs(parsearNumero(x.porcentaje) - parsearNumero(ultima.iva_pct)) < 0.01; });
    const er = tiposIrpf.find(function (x) { return Math.abs(parsearNumero(x.porcentaje) - parsearNumero(ultima.irpf_pct)) < 0.01; });
    if (ei) iva = ei;
    if (er) irpf = er;
    deUltima = !!(ei || er);
  }
  return {
    iva: iva,
    irpf: irpf,
    ivaPct: iva ? parsearNumero(iva.porcentaje) : 0,
    irpfPct: irpf ? parsearNumero(irpf.porcentaje) : 0,
    deUltima: deUltima
  };
}

// IVA e IRPF al facturar unos trabajos. Si TODOS vienen de presupuestos y
// esos presupuestos llevan el mismo IVA y el mismo IRPF, se usan los del
// presupuesto. En cualquier otro caso, los de siempre (última factura del
// cliente o primeros de la lista).
function penCondiciones(idCliente, trabajos) {
  const base = penCondicionesDe(idCliente);
  const lista = trabajos || [];
  if (!lista.length) return base;
  const presupuestos = lista.map(function (t) { return penPresupuestoDe(t); });
  if (presupuestos.some(function (p) { return !p; })) return base;

  const iva0 = parsearNumero(presupuestos[0].iva_pct);
  const irpf0 = parsearNumero(presupuestos[0].irpf_pct);
  const iguales = presupuestos.every(function (p) {
    return Math.abs(parsearNumero(p.iva_pct) - iva0) < 0.01 && Math.abs(parsearNumero(p.irpf_pct) - irpf0) < 0.01;
  });
  if (!iguales) return base;

  const iva = preTiposIva().find(function (x) { return Math.abs(parsearNumero(x.porcentaje) - iva0) < 0.01; });
  const irpf = preTiposIrpf().find(function (x) { return Math.abs(parsearNumero(x.porcentaje) - irpf0) < 0.01; });
  if (!iva || !irpf) return base;
  return {
    iva: iva,
    irpf: irpf,
    ivaPct: parsearNumero(iva.porcentaje),
    irpfPct: parsearNumero(irpf.porcentaje),
    deUltima: false,
    dePresupuesto: true
  };
}

// Mismo cálculo que el formulario de factura, sin descuento.
function penCalcularFactura(suma, cond) {
  const base = roundMoney(suma);
  const iva = roundMoney(base * cond.ivaPct / 100);
  const irpf = roundMoney(base * cond.irpfPct / 100);
  return { base: base, iva: iva, irpf: irpf, total: roundMoney(base + iva - irpf) };
}

function penPunto(t) {
  const info = {
    ok:        { clase: 'ok',        titulo: 'Guardado en la base de datos' },
    guardando: { clase: 'guardando', titulo: 'Guardando...' },
    error:     { clase: 'error',     titulo: 'No se pudo guardar. Abre "Más opciones" y reintenta.' }
  }[estadoSyncDe(PEN_ENTIDAD, t)] || { clase: 'ok', titulo: 'Guardado en la base de datos' };
  return '<span class="fv-punto ' + info.clase + '" title="' + escaparHtml(info.titulo) + '"></span>';
}

function penRepintar() {
  if (typeof vistaActiva !== 'undefined' && vistaActiva === 'pendiente') {
    repintarSinSaltar(pintarPendiente);
  }
}

// ============================================================
// 2. PINTADO PRINCIPAL
// ============================================================

function pintarPendiente() {
  const contenido = document.getElementById('contenido');
  if (!contenido) return;

  // Si el cliente elegido ya no tiene pendientes (se facturaron o se
  // borraron), se deja de tenerlo elegido.
  if (penClienteSel && penPendientesDe(penClienteSel).length === 0) {
    penClienteSel = '';
    penDesmarcados = {};
  }

  const clientes = penClientesConPendientes();

  contenido.innerHTML =
    '<div class="pen-fila-titulo">' +
      '<p class="pen-bloque-titulo">Clientes con trabajos por facturar</p>' +
      '<button type="button" class="fv-flotante" id="pen-btn-nuevo" aria-label="Apuntar un trabajo"><i class="ti ti-plus"></i></button>' +
    '</div>' +
    (clientes.length === 0
      ? '<p class="pen-sin-clientes">No hay trabajos pendientes de facturar.</p>'
      : '<div class="pen-clientes" id="pen-clientes">' +
          clientes.map(function (c) {
            const cli = penClienteDe(c.id);
            const inactivo = !penClienteFacturable(cli);
            return '<button type="button" class="pen-cliente' + (String(c.id) === String(penClienteSel) ? ' activa' : '') + (inactivo ? ' inactivo' : '') + '" data-cliente="' + escaparHtml(c.id) + '">' +
              '<span class="pen-cliente-icono">' + htmlIconoContacto(cli ? cli.icono : '', 56) + '</span>' +
              '<span class="pen-cliente-nombre">' + escaparHtml(penNombreCliente(c.id)) + '</span>' +
            '</button>';
          }).join('') +
        '</div>') +
    '<div id="pen-zona"></div>';

  document.getElementById('pen-btn-nuevo').addEventListener('click', function () {
    penAbrirFormulario(null, penClienteSel);
  });

  document.querySelectorAll('#pen-clientes [data-cliente]').forEach(function (b) {
    b.addEventListener('click', function () {
      const id = b.dataset.cliente;
      penClienteSel = (String(id) === String(penClienteSel)) ? '' : id;
      penDesmarcados = {};
      pintarPendiente();
    });
  });

  if (penClienteSel) pintarPanelCliente();
  else pintarListaGeneral();
}

// ------------------------------------------------------------
// 2.1 Lista de todos los trabajos
// ------------------------------------------------------------

function pintarListaGeneral() {
  const zona = document.getElementById('pen-zona');
  if (!zona) return;

  zona.innerHTML =
    '<div class="fv-barra" style="position:relative">' +
      '<input type="text" class="fv-buscador" id="pen-buscador" placeholder="Buscar..." value="' + escaparHtml(penBusqueda) + '">' +
      '<button type="button" class="fv-btn-filtro' + (penFiltroEstado !== 'pendiente' ? ' con-filtro' : '') + '" id="pen-btn-filtro" aria-label="Filtros"><i class="ti ti-filter"></i></button>' +
      penPanelFiltros() +
    '</div>' +
    '<div id="pen-lista"></div>';

  penCablearBarra();
  penRepintarLista();
}

function penPanelFiltros() {
  const estados = [['pendiente', 'Pendientes'], ['facturado', 'Facturados'], ['todos', 'Todos']];
  return '<div class="fv-filtros-panel" id="pen-filtros-panel">' +
    '<p class="fv-filtros-titulo">Estado</p>' +
    estados.map(function (op) {
      return '<button type="button" data-estado="' + op[0] + '"' +
        (op[0] === penFiltroEstado ? ' class="activa"' : '') + '>' + escaparHtml(op[1]) + '</button>';
    }).join('') +
  '</div>';
}

function penCablearBarra() {
  const buscador = document.getElementById('pen-buscador');
  const repintarConRetardo = conRetardo(penRepintarLista, 180);
  buscador.addEventListener('input', function () {
    penBusqueda = buscador.value;
    repintarConRetardo();
  });

  const btn = document.getElementById('pen-btn-filtro');
  const panel = document.getElementById('pen-filtros-panel');

  function cerrarPanel() {
    panel.classList.remove('abierto');
    document.removeEventListener('click', cerrarSiFuera);
  }
  function cerrarSiFuera(ev) {
    if (!panel.contains(ev.target) && ev.target !== btn && !btn.contains(ev.target)) cerrarPanel();
  }
  btn.addEventListener('click', function (ev) {
    ev.stopPropagation();
    const seAbre = !panel.classList.contains('abierto');
    panel.classList.toggle('abierto');
    if (seAbre) setTimeout(function () { document.addEventListener('click', cerrarSiFuera); }, 0);
    else document.removeEventListener('click', cerrarSiFuera);
  });

  panel.querySelectorAll('[data-estado]').forEach(function (b) {
    b.addEventListener('click', function () { penFiltroEstado = b.dataset.estado; pintarListaGeneral(); });
  });
}

function penTextoBusqueda(t) {
  const c = penClienteDe(t.id_cliente);
  return normalizarBusqueda([
    t.concepto, c ? c.nombre_contacto : '', c ? c.nombre_fiscal : '', t.factura,
    formatMoney(penImporte(t)), penFechaApuntado(t)
  ].filter(Boolean).join(' '));
}

function penListaFiltrada() {
  const texto = normalizarBusqueda(penBusqueda);
  return estado.pendiente.filter(function (t) {
    const facturado = penEsFacturado(t);
    if (penFiltroEstado === 'pendiente' && facturado) return false;
    if (penFiltroEstado === 'facturado' && !facturado) return false;
    if (texto && penTextoBusqueda(t).indexOf(texto) === -1) return false;
    return true;
  }).sort(function (a, b) { return penCreado(b) - penCreado(a); });
}

function penPastilla(t) {
  if (!penEsFacturado(t)) return '<span class="pastilla ind-ambar">Pendiente</span>';
  const f = penFacturaDe(t);
  const numero = String((f && f.numero) || t.factura || 'Facturado');
  return '<span class="pastilla ind-verde">' + escaparHtml(numero) + '</span>';
}

function penFila(t) {
  const c = penClienteDe(t.id_cliente);
  const facturado = penEsFacturado(t);
  const fecha = penFechaApuntado(t);
  const pres = penPresupuestoDe(t);
  return '<div class="fv-fila pen-fila' + (facturado ? ' pen-fila-facturada' : '') + '" data-id="' + escaparHtml(t.id) + '">' +
    htmlIconoContacto(c ? c.icono : '', 42) +
    '<div class="fv-info">' +
      '<p class="fv-nombre">' + escaparHtml(String(t.concepto || '—')) + '</p>' +
      '<p class="fv-meta">' + escaparHtml(penNombreCliente(t.id_cliente)) + (fecha ? ' · ' + escaparHtml(fecha) : '') + (pres ? ' · ' + escaparHtml(pres.numero || '') : '') + '</p>' +
    '</div>' +
    '<div class="fv-derecha pen-derecha">' +
      '<span class="fv-total-fila">' + escaparHtml(dineroVisible(penImporte(t))) + '</span>' +
      penPastilla(t) +
    '</div>' +
    '<div class="fv-control">' +
      '<button type="button" class="fv-btn-icono" data-mas="' + escaparHtml(t.id) + '" aria-label="Más opciones"><i class="ti ti-dots-vertical"></i></button>' +
      penPunto(t) +
    '</div>' +
  '</div>';
}

function penRepintarLista() {
  const cont = document.getElementById('pen-lista');
  if (!cont) return;
  const lista = penListaFiltrada();

  if (lista.length === 0) {
    cont.innerHTML = '<p class="fv-vacio">' +
      (penBusqueda || penFiltroEstado !== 'pendiente'
        ? 'No hay resultados con estos filtros.'
        : (estado.pendiente.length === 0
          ? 'Todavía no hay trabajos apuntados. Pulsa + para apuntar el primero.'
          : 'No hay trabajos pendientes de facturar.')) +
      '</p>';
    return;
  }

  cont.innerHTML = '<div class="fv-lista-movil pen-lista">' + lista.map(penFila).join('') + '</div>';

  cont.querySelectorAll('[data-mas]').forEach(function (b) {
    b.addEventListener('click', function (ev) { ev.stopPropagation(); penAbrirMenuMas(b, b.dataset.mas); });
  });
  cont.querySelectorAll('.pen-fila').forEach(function (fila) {
    fila.addEventListener('click', function () {
      const t = estado.pendiente.find(function (x) { return String(x.id) === String(fila.dataset.id); });
      if (!t) return;
      if (penEsFacturado(t)) { if (penFacturaDe(t)) abrirFichaFacturaVenta(t.id_factura); }
      else penAbrirFormulario(t.id, '');
    });
  });
}

// ------------------------------------------------------------
// 2.2 Cliente elegido: resumen, trabajos marcables y Facturar
// ------------------------------------------------------------
// El resumen enseña siempre las cifras, aunque el ojo las oculte en las
// listas: es la vista previa de lo que se va a facturar, igual que las
// fichas y los formularios ("si se abre algo, es para verlo").

function penMarcadosDe(idCliente) {
  return penPendientesDe(idCliente).filter(function (t) { return !penDesmarcados[t.id]; });
}

function pintarPanelCliente() {
  const zona = document.getElementById('pen-zona');
  if (!zona) return;
  const todos = penPendientesDe(penClienteSel);
  const cli = penClienteDe(penClienteSel);
  const facturable = penClienteFacturable(cli);

  // Estructura: en el móvil, todo en una columna (resumen, trabajos y
  // botón Facturar, por ese orden). En PC, dos columnas: los trabajos a
  // la izquierda y, a la derecha y fijos al bajar, el resumen y el botón.
  zona.innerHTML =
    '<button type="button" class="pen-volver" id="pen-volver"><i class="ti ti-arrow-left"></i> Todos los trabajos</button>' +
    '<div class="pen-panel">' +
    '<div class="pen-lateral">' +
      '<div class="pen-resumen" id="pen-resumen"></div>' +
      (facturable ? '' : '<p class="fv-aviso pen-aviso-inactivo">Este cliente está desactivado. Reactívalo en Clientes para poder facturar sus trabajos.</p>') +
      '<button type="button" class="boton-principal pen-btn-facturar" id="pen-btn-facturar"></button>' +
    '</div>' +
    '<div class="pen-trabajos">' +
    '<div class="pen-fila-titulo pen-fila-titulo-lista">' +
      '<p class="pen-bloque-titulo">Trabajos pendientes</p>' +
      '<button type="button" class="boton-menor" id="pen-anadir">+ Añadir trabajo</button>' +
    '</div>' +
    '<div class="pen-lista pen-lista-marcar">' +
      todos.map(function (t) {
        const marcado = !penDesmarcados[t.id];
        const pres = penPresupuestoDe(t);
        return '<div class="pen-fila-marcar' + (marcado ? '' : ' pen-sin-marcar') + '" data-id="' + escaparHtml(t.id) + '">' +
          '<label class="pen-marcar-zona">' +
            '<input type="checkbox" class="pen-casilla" data-marcar="' + escaparHtml(t.id) + '"' + (marcado ? ' checked' : '') + '>' +
            '<span class="fv-info"><span class="fv-nombre pen-concepto">' + escaparHtml(String(t.concepto || '—')) + '</span>' +
              '<span class="fv-meta pen-sub">Apuntado el ' + escaparHtml(penFechaApuntado(t) || '—') + (pres ? ' · ' + escaparHtml(pres.numero || '') : '') + '</span></span>' +
            // Dentro de un cliente las cifras se ven siempre, aunque el ojo esté cerrado:
            // abrir el cliente es dar permiso, como al abrir una ficha (octubre 2026).
            '<span class="fv-total-fila">' + escaparHtml(formatMoney(penImporte(t))) + '</span>' +
          '</label>' +
          '<div class="fv-control">' +
            '<button type="button" class="fv-btn-icono" data-mas="' + escaparHtml(t.id) + '" aria-label="Más opciones"><i class="ti ti-dots-vertical"></i></button>' +
            penPunto(t) +
          '</div>' +
        '</div>';
      }).join('') +
    '</div>' +
    '</div>' +
    '</div>';

  document.getElementById('pen-volver').addEventListener('click', function () {
    penClienteSel = '';
    penDesmarcados = {};
    pintarPendiente();
  });

  zona.querySelectorAll('[data-marcar]').forEach(function (c) {
    c.addEventListener('change', function () {
      if (c.checked) delete penDesmarcados[c.dataset.marcar];
      else penDesmarcados[c.dataset.marcar] = true;
      c.closest('.pen-fila-marcar').classList.toggle('pen-sin-marcar', !c.checked);
      penActualizarResumen();
    });
  });
  zona.querySelectorAll('[data-mas]').forEach(function (b) {
    b.addEventListener('click', function (ev) { ev.stopPropagation(); penAbrirMenuMas(b, b.dataset.mas); });
  });
  document.getElementById('pen-anadir').addEventListener('click', function () {
    penAbrirFormulario(null, penClienteSel);
  });
  document.getElementById('pen-btn-facturar').addEventListener('click', function () {
    penFacturar(penClienteSel);
  });

  penActualizarResumen();
}

function penActualizarResumen() {
  const resumen = document.getElementById('pen-resumen');
  const boton = document.getElementById('pen-btn-facturar');
  if (!resumen || !boton || !penClienteSel) return;

  const todos = penPendientesDe(penClienteSel);
  const marcados = penMarcadosDe(penClienteSel);
  const suma = roundMoney(marcados.reduce(function (n, t) { return n + penImporte(t); }, 0));
  const cond = penCondiciones(penClienteSel, marcados);
  const r = penCalcularFactura(suma, cond);

  resumen.innerHTML =
    '<div class="pen-resumen-cab">' +
      '<span class="pen-resumen-cliente">' + escaparHtml(penNombreCliente(penClienteSel)) + '</span>' +
      '<span class="pen-resumen-marcados">' + marcados.length + ' de ' + todos.length + ' marcados</span>' +
    '</div>' +
    '<div class="pen-resumen-lin"><span>Subtotal</span><span>' + escaparHtml(formatMoney(suma)) + '</span></div>' +
    '<div class="pen-resumen-total"><span>Factura</span><strong>' + escaparHtml(formatMoney(r.total)) + '</strong></div>' +
    '<p class="pen-resumen-nota">IVA ' + cond.ivaPct + ' % · IRPF ' + cond.irpfPct + ' %' +
      (cond.dePresupuesto ? ' (del presupuesto)' : (cond.deUltima ? ' (de su última factura)' : '')) + '</p>';

  const facturable = penClienteFacturable(penClienteDe(penClienteSel));
  boton.textContent = marcados.length === 0
    ? 'Marca algún trabajo'
    : 'Facturar ' + marcados.length + (marcados.length === 1 ? ' trabajo' : ' trabajos');
  boton.disabled = marcados.length === 0 || !facturable;
}

// ============================================================
// 3. FACTURAR
// ============================================================

function penFacturar(idCliente) {
  const cli = penClienteDe(idCliente);
  if (!penClienteFacturable(cli)) {
    alert('Este cliente está desactivado. Reactívalo en Clientes para poder facturar.');
    return;
  }
  const marcados = penMarcadosDe(idCliente);
  if (marcados.length === 0) return;
  if (typeof abrirFormularioFacturaVenta !== 'function') {
    alert('El módulo de Facturas de venta no está disponible.');
    return;
  }

  // Un solo trabajo unido a un presupuesto: es un acceso directo al
  // presupuesto, que se factura tal cual (concepto, descripción, importe,
  // IVA e IRPF). El trabajo queda unido a la factura al guardarla.
  if (marcados.length === 1 && penEsDePresupuesto(marcados[0])) {
    const pres = penPresupuestoDe(marcados[0]);
    if (pres && typeof convertirPresupuestoEnFactura === 'function') {
      convertirPresupuestoEnFactura(pres.id);
      return;
    }
  }

  const suma = roundMoney(marcados.reduce(function (n, t) { return n + penImporte(t); }, 0));
  const cond = penCondiciones(idCliente, marcados);

  // El concepto se escribe al facturar; la descripción lleva un trabajo
  // por línea, sin guion, en el orden en que se apuntaron.
  abrirFormularioFacturaVenta(null, {
    id_cliente: cli.id,
    trabajos_ids: marcados.map(function (t) { return t.id; }),
    descripcion: marcados.map(function (t) { return String(t.concepto || '').trim(); }).join('\n'),
    base: suma,
    iva_id: cond.iva ? cond.iva.id : '',
    irpf_id: cond.irpf ? cond.irpf.id : ''
  });
}

// Lo llama el formulario de factura al guardar una factura nueva hecha
// desde Pendiente: cada trabajo recibe el id y el número de la factura.
// Se lanzan todos a la vez: cada uno queda apuntado como pendiente de
// guardar en el dispositivo antes de enviarse, así que si algo falla
// queda en rojo y se reenvía solo.
function penAsignarFactura(ids, factura) {
  (ids || []).forEach(function (idTrabajo) {
    const t = estado.pendiente.find(function (x) { return String(x.id) === String(idTrabajo); });
    if (!t) return;
    guardarRegistro(PEN_ENTIDAD, Object.assign({}, t, {
      id_factura: String(factura.id),
      factura: String(factura.numero || '')
    }), penRepintar, null);
  });
  penClienteSel = '';
  penDesmarcados = {};
}

// ============================================================
// 4. MENÚ DE TRES PUNTOS
// ============================================================

function penAbrirMenuMas(boton, id) {
  document.querySelectorAll('.fv-menu-mas').forEach(function (m) { m.remove(); });

  const t = estado.pendiente.find(function (x) { return String(x.id) === String(id); });
  if (!t) return;

  const facturado = penEsFacturado(t);
  const factura = penFacturaDe(t);

  const menu = document.createElement('div');
  menu.className = 'fv-menu-mas';
  menu.innerHTML =
    (estadoSyncDe(PEN_ENTIDAD, t) === 'error'
      ? '<button type="button" class="destacado" data-accion="reintentar">Reintentar guardado</button>'
      : '') +
    (facturado
      ? (factura
          ? '<button type="button" data-accion="ver">Ver factura</button>'
          : '<button type="button" disabled>Factura archivada</button>')
      : (penEsDePresupuesto(t) ? '' : '<button type="button" data-accion="editar">Editar</button>') +
        '<button type="button" class="peligro" data-accion="eliminar">' +
          (penEsDePresupuesto(t) ? 'Quitar de Pendiente' : 'Eliminar') + '</button>') +
    (penPresupuestoDe(t) ? '<button type="button" data-accion="verpresupuesto">Ver presupuesto</button>' : '');

  document.body.appendChild(menu);
  fvPosicionarMenu(menu, boton);

  function cerrarMenu() {
    menu.remove();
    document.removeEventListener('click', cerrarSiFuera);
  }
  function cerrarSiFuera(ev) { if (!menu.contains(ev.target)) cerrarMenu(); }

  const accion = function (nombre, fn) {
    const b = menu.querySelector('[data-accion="' + nombre + '"]');
    if (b) b.addEventListener('click', function () { cerrarMenu(); fn(); });
  };
  accion('reintentar', function () { reintentarRegistro(PEN_ENTIDAD, id, penRepintar); });
  accion('ver', function () { abrirFichaFacturaVenta(t.id_factura); });
  accion('verpresupuesto', function () { abrirFichaPresupuesto(t.id_presupuesto); });
  accion('editar', function () { penAbrirFormulario(id, ''); });
  accion('eliminar', function () { penEliminar(id); });

  setTimeout(function () { document.addEventListener('click', cerrarSiFuera); }, 0);
}

function penEliminar(id) {
  const t = estado.pendiente.find(function (x) { return String(x.id) === String(id); });
  if (!t) return;
  if (penEsFacturado(t)) {
    alert('Este trabajo ya está facturado y no se puede borrar.');
    return;
  }
  const mensaje = penEsDePresupuesto(t)
    ? '¿Quitar «' + String(t.concepto || '') + '» de Pendiente? El presupuesto sigue aceptado y podrás volver a pasarlo a Pendiente.'
    : '¿Eliminar el trabajo «' + String(t.concepto || '') + '»?';
  if (!confirm(mensaje)) return;
  borrarRegistro(PEN_ENTIDAD, id, penRepintar, null);
}

// ============================================================
// 5. FORMULARIO DE UN TRABAJO
// ============================================================

/**
 * @param id               id del trabajo a editar, o null si es nuevo
 * @param idClientePrevio  cliente con el que se abre un trabajo nuevo
 * @param extra            opcional, solo en trabajos nuevos:
 *                         { concepto, importe, avisar }. Lo usa la calculadora
 *                         ("Guardar como pendiente"): rellena el formulario y,
 *                         al guardar, avisa y ofrece ir a Pendiente.
 */
function penAbrirFormulario(id, idClientePrevio, extra) {
  if (document.querySelector('.pen-modal-fondo')) return;

  const editando = !!id;
  const original = editando ? estado.pendiente.find(function (t) { return String(t.id) === String(id); }) : null;
  if (editando && !original) return;
  if (original && penEsFacturado(original)) {
    alert('Este trabajo ya está facturado y no se puede editar.');
    return;
  }

  const clientes = (typeof fvClientesDisponibles === 'function') ? fvClientesDisponibles() : [];
  const idCliente = original ? String(original.id_cliente) : String(idClientePrevio || '');

  const fondo = document.createElement('div');
  fondo.className = 'fv-modal-fondo pen-modal-fondo';
  fondo.innerHTML =
    '<div class="fv-modal">' +
      '<div class="fv-modal-cabecera">' +
        '<div class="fv-modal-texto">' +
          '<p class="fv-modal-titulo">' + (editando ? 'Editar trabajo' : 'Nuevo trabajo') + '</p>' +
          '<p class="fv-modal-subtitulo">Pendiente de facturar</p>' +
        '</div>' +
        '<button type="button" class="fv-modal-cerrar" aria-label="Cerrar"><i class="ti ti-x"></i></button>' +
      '</div>' +
      '<div class="fv-modal-cuerpo">' +
        '<form id="pen-form">' +
          '<div class="fv-form-grid">' +
            '<div class="fv-campo-grupo ancho-total">' +
              '<label>Cliente *</label>' +
              '<input type="hidden" id="pen-campo-id_cliente" value="' + escaparHtml(idCliente) + '">' +
              '<button type="button" class="campo-contacto-btn" id="pen-btn-cliente"' + (editando ? ' disabled' : '') + '></button>' +
              '<p class="fv-mensaje-error" data-error-de="id_cliente" hidden></p>' +
            '</div>' +
            '<div class="fv-campo-grupo ancho-total">' +
              '<label for="pen-campo-concepto">Concepto *</label>' +
              '<input class="campo" id="pen-campo-concepto" type="text" value="' + escaparHtml(original ? String(original.concepto || '') : String((extra && extra.concepto) || '')) + '">' +
              '<p class="fv-mensaje-error" data-error-de="concepto" hidden></p>' +
            '</div>' +
            '<div class="fv-campo-grupo ancho-total">' +
              '<label for="pen-campo-importe">Importe *</label>' +
              '<input class="campo" id="pen-campo-importe" type="text" data-numero="1" inputmode="decimal" value="' +
                escaparHtml(original ? (penImporte(original) !== 0 ? String(penImporte(original)) : '') : (extra && extra.importe > 0 ? String(roundMoney(extra.importe)) : '')) + '">' +
              '<p class="fv-mensaje-error" data-error-de="importe" hidden></p>' +
            '</div>' +
          '</div>' +
        '</form>' +
      '</div>' +
      '<div class="fv-modal-pie">' +
        '<button type="button" class="boton-secundario" id="pen-form-cancelar">Cancelar</button>' +
        '<button type="submit" form="pen-form" class="boton-principal">Guardar</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(fondo);

  const oculto = fondo.querySelector('#pen-campo-id_cliente');
  const botonCliente = fondo.querySelector('#pen-btn-cliente');

  function pintarCliente() {
    const c = penClienteDe(oculto.value);
    const nombre = c ? String(c.nombre_contacto || c.nombre_fiscal || '') : '';
    botonCliente.innerHTML =
      '<span class="campo-contacto-valor' + (nombre ? '' : ' vacio') + '">' + escaparHtml(nombre || 'Selecciona un cliente...') + '</span>' +
      (editando ? '' : '<i class="ti ti-chevron-down"></i>');
  }
  pintarCliente();

  botonCliente.addEventListener('click', function () {
    if (editando) return;
    abrirSelectorContacto(clientes, oculto.value, { permitirLibre: false }).then(function (resultado) {
      if (resultado === null) return;
      oculto.value = resultado || '';
      pintarCliente();
    });
  });

  // No se cierra al tocar fuera (formulario con trabajo dentro).
  fondo.querySelector('.fv-modal-cerrar').addEventListener('click', function () { fondo.remove(); });
  fondo.querySelector('#pen-form-cancelar').addEventListener('click', function () { fondo.remove(); });

  fondo.querySelector('#pen-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    penGuardarFormulario(fondo, original, extra);
  });

  setTimeout(function () {
    const campo = fondo.querySelector(editando || idCliente ? '#pen-campo-concepto' : '#pen-btn-cliente');
    if (campo) campo.focus();
  }, 50);
}

function penGuardarFormulario(fondo, original, extra) {
  fondo.querySelectorAll('.fv-mensaje-error').forEach(function (p) { p.hidden = true; });
  fondo.querySelectorAll('.fv-campo-error').forEach(function (e) { e.classList.remove('fv-campo-error'); });

  function error(campo, mensaje) {
    const p = fondo.querySelector('[data-error-de="' + campo + '"]');
    const input = fondo.querySelector('#pen-campo-' + campo);
    if (p) { p.textContent = mensaje; p.hidden = false; }
    if (input) input.classList.add('fv-campo-error');
  }

  const idCliente = fondo.querySelector('#pen-campo-id_cliente').value;
  const concepto = fondo.querySelector('#pen-campo-concepto').value.trim();
  const importe = roundMoney(parsearNumero(fondo.querySelector('#pen-campo-importe').value));

  let valido = true;
  const cliente = penClienteDe(idCliente);
  if (!cliente) { error('id_cliente', 'Selecciona un cliente.'); valido = false; }
  if (!concepto) { error('concepto', 'Escribe el concepto del trabajo.'); valido = false; }
  if (!(importe > 0)) { error('importe', 'Escribe el importe del trabajo.'); valido = false; }
  if (!valido) return;

  if (original && penEsFacturado(original)) {
    alert('Este trabajo ya está facturado y no se puede editar.');
    return;
  }

  // Un trabajo nuevo, o editado, queda pendiente y sin factura: si
  // pertenecía a una factura desactivada, deja de estar unido a ella.
  const registro = Object.assign({}, original || {}, {
    id: original ? original.id : penNuevoId(),
    id_cliente: cliente.id,
    concepto: concepto,
    importe: importe,
    id_factura: '',
    factura: ''
  });

  fondo.remove();
  guardarRegistro(PEN_ENTIDAD, registro, penRepintar, null);

  // Desde la calculadora: se queda donde estaba, pero se avisa y se
  // ofrece ir a ver el trabajo apuntado.
  if (extra && extra.avisar && !original) {
    mostrarDialogoOpciones(
      'Trabajo apuntado',
      'Se ha apuntado en Pendiente para ' + penNombreCliente(cliente.id) + '.',
      [
        { id: 'ver', texto: 'Ver en Pendiente', tipo: 'principal' },
        { id: 'seguir', texto: 'Seguir aquí' }
      ]
    ).then(function (eleccion) {
      if (eleccion !== 'ver') return;
      penClienteSel = String(cliente.id);
      penDesmarcados = {};
      cambiarVista('pendiente');
    });
  }
}

// ============================================================
// 5 bis. DESDE UN PRESUPUESTO ACEPTADO (octubre 2026)
// ============================================================
// "Pasar a Pendiente": el trabajo está hecho y queda por facturar. Se
// apunta un trabajo con la BASE del presupuesto (ya lleva el ajuste de
// cliente, la compensación y el descuento) y unido a él por id_presupuesto.
// El presupuesto sigue aceptado y bloqueado. Facturar el trabajo solo es
// facturar el presupuesto (penFacturar); junto a otros, solo cuenta su
// concepto e importe.

async function penPasarPresupuesto(idPresupuesto) {
  const p = estado.presupuestos.find(function (x) { return String(x.id) === String(idPresupuesto); });
  if (!p) { alert('Este presupuesto ya no existe.'); return; }
  if (String(p.estado) !== 'aceptado') {
    alert('El presupuesto debe estar aceptado para pasarlo a Pendiente.');
    return;
  }
  if (typeof preTieneFactura === 'function' && preTieneFactura(p.id)) {
    alert('Este presupuesto ya tiene una factura asociada.');
    return;
  }
  if (penPendienteDePresupuesto(p.id)) {
    alert('Este presupuesto ya está en Pendiente.');
    return;
  }

  // Presupuesto a nombre de alguien sin ficha: primero hay que registrarlo.
  if (!p.id_cliente) {
    if (typeof fvRegistrarClienteDePresupuesto === 'function') {
      fvRegistrarClienteDePresupuesto(p, function () { penPasarPresupuesto(p.id); });
    }
    return;
  }
  const cli = penClienteDe(p.id_cliente);
  if (!penClienteFacturable(cli)) {
    alert('El cliente de este presupuesto no está activo como cliente. Reactívalo en Clientes para pasarlo a Pendiente.');
    return;
  }
  const importe = roundMoney(parsearNumero(p.base));
  if (!(importe > 0)) {
    alert('Este presupuesto no tiene importe. No se puede pasar a Pendiente.');
    return;
  }
  if (!puedeEscribir()) return;

  const registro = {
    id: penNuevoId(),
    id_cliente: cli.id,
    concepto: String(p.concepto || '').trim() || ('Presupuesto ' + String(p.numero || '')),
    importe: importe,
    id_factura: '',
    factura: '',
    id_presupuesto: String(p.id),
    tipo: 'factura',
    ambito: 'empresa',
    id_apunte: '',
    contacto_libre: ''
  };
  guardarRegistro(PEN_ENTIDAD, registro, penRepintar, null);

  const eleccion = await mostrarDialogoOpciones(
    'Trabajo en Pendiente',
    'El presupuesto ' + String(p.numero || '') + ' queda en Pendiente para ' + penNombreCliente(cli.id) + ', listo para facturar.',
    [
      { id: 'ver', texto: 'Ver en Pendiente', tipo: 'principal' },
      { id: 'seguir', texto: 'Seguir aquí' }
    ]
  );
  if (eleccion === 'ver') penIrACliente(cli.id);
}

// ============================================================
// 6. REGISTRO COMO VISTA
// ============================================================

registrarVista('pendiente', {
  titulo: 'Pendiente',
  pintar: pintarPendiente
});
