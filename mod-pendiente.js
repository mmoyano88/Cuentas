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
 *   id | id_cliente | concepto | importe | id_factura | factura |
 *   id_presupuesto | tipo | ambito | id_apunte | contacto_libre
 *
 * DOS ÁMBITOS (selector Empresa / Personal):
 *  - EMPRESA (ambito vacío o 'empresa', tipo 'factura'): trabajos por
 *    facturar, como siempre. Pueden venir de un presupuesto aceptado
 *    (id_presupuesto).
 *  - PERSONAL (ambito 'personal', tipo 'cobro'): cobros SIN factura, sin
 *    IVA ni IRPF. El pagador es un contacto registrado (id_cliente) o un
 *    nombre escrito a mano (contacto_libre). Al marcarlos como cobrados
 *    se crea un apunte de Contabilidad (ingreso personal, fecha de hoy) y
 *    el cobro guarda su id en id_apunte. Un cobro está COBRADO mientras
 *    ese apunte exista: si se borra desde Contabilidad, vuelve a
 *    pendiente.
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
let penAmbito = 'empresa';      // 'empresa' | 'personal'

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

// ---- Cobros personales (octubre 2026) ----
function penEsPersonal(t) {
  return !!t && String(t.ambito || '') === 'personal';
}

function penApunteDe(t) {
  if (!t || !t.id_apunte) return null;
  return estado.apuntes.find(function (a) { return String(a.id) === String(t.id_apunte); }) || null;
}

// Cobrado = su apunte existe. Si el apunte se borra desde Contabilidad,
// el cobro vuelve a pendiente. Excepción: un cobro de hace más de 5 años
// cuyo apunte ya no está se da por cobrado (el apunte pudo archivarse).
function penEsCobrado(t) {
  if (!penEsPersonal(t) || !t.id_apunte) return false;
  if (penApunteDe(t)) return true;
  const ms = penCreado(t);
  return !!ms && new Date(ms).getFullYear() < new Date().getFullYear() - 5;
}

// Terminado: facturado (empresa) o cobrado (personal).
function penHecho(t) {
  return penEsPersonal(t) ? penEsCobrado(t) : penEsFacturado(t);
}

function penDelAmbito(t, ambito) {
  return penEsPersonal(t) === ((ambito || penAmbito) === 'personal');
}

// Los trabajos se agrupan por cliente; un cobro personal sin contacto
// registrado se agrupa por el nombre escrito ('libre:<nombre>').
function penClave(t) {
  const id = String(t.id_cliente == null ? '' : t.id_cliente);
  if (id !== '') return id;
  return 'libre:' + normalizarBusqueda(String(t.contacto_libre || '').trim());
}

function penNombreDe(t) {
  const id = String(t.id_cliente == null ? '' : t.id_cliente);
  if (id !== '') return penNombreCliente(id);
  return String(t.contacto_libre || '').trim() || '—';
}

function penNombreClave(clave) {
  if (String(clave).indexOf('libre:') === 0) {
    const t = estado.pendiente.find(function (x) { return penClave(x) === String(clave); });
    return t ? penNombreDe(t) : '—';
  }
  return penNombreCliente(clave);
}

function penClienteDeClave(clave) {
  return String(clave).indexOf('libre:') === 0 ? null : penClienteDe(clave);
}

function penNuevoIdApunte() {
  return 'apu-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e9).toString(36);
}

// Contactos activos de cualquier rol: quien te debe un cobro personal
// puede ser un cliente, un proveedor o ambos.
function penContactosActivos() {
  return estado.clientes.filter(function (c) { return c.estado === 'activo'; })
    .sort(function (a, b) {
      return String(a.nombre_contacto || '').localeCompare(String(b.nombre_contacto || ''), 'es');
    });
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
  penAmbito = 'empresa';
  penClienteSel = String(idCliente);
  penDesmarcados = {};
  cambiarVista('pendiente');
}

function penPendientesDe(clave) {
  return estado.pendiente.filter(function (t) {
    return penClave(t) === String(clave) && penDelAmbito(t) && !penHecho(t);
  }).sort(function (a, b) { return penCreado(a) - penCreado(b); });
}

// Clientes con al menos un trabajo pendiente, el último apuntado primero.
function penClientesConPendientes(ambito) {
  const amb = ambito || 'empresa';
  const por = {};
  estado.pendiente.forEach(function (t) {
    if (!penDelAmbito(t, amb) || penHecho(t)) return;
    const k = penClave(t);
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

function penTituloBloque() {
  return penAmbito === 'personal' ? 'Quién te debe (sin factura)' : 'Clientes con trabajos por facturar';
}

function pintarPendiente() {
  const contenido = document.getElementById('contenido');
  if (!contenido) return;

  // Si el elegido ya no tiene pendientes en este ámbito, se mira el otro
  // (por ejemplo, al llegar desde el Inicio). Si tampoco, se deja de
  // tenerlo elegido (se facturó, se cobró o se borró).
  if (penClienteSel && penPendientesDe(penClienteSel).length === 0) {
    const previo = penAmbito;
    penAmbito = (penAmbito === 'empresa') ? 'personal' : 'empresa';
    if (penPendientesDe(penClienteSel).length === 0) {
      penAmbito = previo;
      penClienteSel = '';
      penDesmarcados = {};
    }
  }

  const personal = penAmbito === 'personal';
  const clientes = penClientesConPendientes(penAmbito);

  contenido.innerHTML =
    '<div class="fv-cabecera-lista">' +
      '<div class="fv-selector" id="pen-selector">' +
        '<button type="button" data-ambito="empresa">Empresa</button>' +
        '<button type="button" data-ambito="personal">Personal</button>' +
      '</div>' +
      '<button type="button" class="fv-flotante" id="pen-btn-nuevo" aria-label="' + (personal ? 'Apuntar un cobro' : 'Apuntar un trabajo') + '"><i class="ti ti-plus"></i></button>' +
    '</div>' +
    '<div class="pen-fila-titulo">' +
      '<p class="pen-bloque-titulo">' + escaparHtml(penTituloBloque()) + '</p>' +
    '</div>' +
    (clientes.length === 0
      ? '<p class="pen-sin-clientes">' + (personal ? 'No hay cobros personales pendientes.' : 'No hay trabajos pendientes de facturar.') + '</p>'
      : '<div class="pen-clientes" id="pen-clientes">' +
          clientes.map(function (c) {
            const cli = penClienteDeClave(c.id);
            const inactivo = !personal && !penClienteFacturable(cli);
            return '<button type="button" class="pen-cliente' + (String(c.id) === String(penClienteSel) ? ' activa' : '') + (inactivo ? ' inactivo' : '') + '" data-cliente="' + escaparHtml(c.id) + '">' +
              '<span class="pen-cliente-icono">' + htmlIconoContacto(cli ? cli.icono : '', 56) + '</span>' +
              '<span class="pen-cliente-nombre">' + escaparHtml(penNombreClave(c.id)) + '</span>' +
            '</button>';
          }).join('') +
        '</div>') +
    '<div id="pen-zona"></div>';

  document.getElementById('pen-selector').querySelectorAll('[data-ambito]').forEach(function (b) {
    b.classList.toggle('activa', b.dataset.ambito === penAmbito);
    b.addEventListener('click', function () {
      if (b.dataset.ambito === penAmbito) return;
      penAmbito = b.dataset.ambito;
      penClienteSel = '';
      penDesmarcados = {};
      penFiltroEstado = 'pendiente';
      penBusqueda = '';
      pintarPendiente();
    });
  });

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
  const estados = [['pendiente', 'Pendientes'], ['facturado', penAmbito === 'personal' ? 'Cobrados' : 'Facturados'], ['todos', 'Todos']];
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
    t.concepto, c ? c.nombre_contacto : '', c ? c.nombre_fiscal : '', t.contacto_libre, t.factura,
    formatMoney(penImporte(t)), penFechaApuntado(t)
  ].filter(Boolean).join(' '));
}

function penListaFiltrada() {
  const texto = normalizarBusqueda(penBusqueda);
  return estado.pendiente.filter(function (t) {
    if (!penDelAmbito(t)) return false;
    const hecho = penHecho(t);
    if (penFiltroEstado === 'pendiente' && hecho) return false;
    if (penFiltroEstado === 'facturado' && !hecho) return false;
    if (texto && penTextoBusqueda(t).indexOf(texto) === -1) return false;
    return true;
  }).sort(function (a, b) { return penCreado(b) - penCreado(a); });
}

function penPastilla(t) {
  if (!penHecho(t)) return '<span class="pastilla ind-ambar">Pendiente</span>';
  if (penEsPersonal(t)) return '<span class="pastilla ind-verde">Cobrado</span>';
  const f = penFacturaDe(t);
  const numero = String((f && f.numero) || t.factura || 'Facturado');
  return '<span class="pastilla ind-verde">' + escaparHtml(numero) + '</span>';
}

function penFila(t) {
  const c = penClienteDe(t.id_cliente);
  const hecho = penHecho(t);
  const fecha = penFechaApuntado(t);
  const pres = penPresupuestoDe(t);
  return '<div class="fv-fila pen-fila' + (hecho ? ' pen-fila-facturada' : '') + '" data-id="' + escaparHtml(t.id) + '">' +
    htmlIconoContacto(c ? c.icono : '', 42) +
    '<div class="fv-info">' +
      '<p class="fv-nombre">' + escaparHtml(String(t.concepto || '—')) + '</p>' +
      '<p class="fv-meta">' + escaparHtml(penNombreDe(t)) + (fecha ? ' · ' + escaparHtml(fecha) : '') + (pres ? ' · ' + escaparHtml(pres.numero || '') : '') + '</p>' +
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
  const personal = penAmbito === 'personal';

  if (lista.length === 0) {
    const hayDelAmbito = estado.pendiente.some(function (t) { return penDelAmbito(t); });
    cont.innerHTML = '<p class="fv-vacio">' +
      (penBusqueda || penFiltroEstado !== 'pendiente'
        ? 'No hay resultados con estos filtros.'
        : (!hayDelAmbito
          ? (personal ? 'Todavía no hay cobros apuntados. Pulsa + para apuntar el primero.' : 'Todavía no hay trabajos apuntados. Pulsa + para apuntar el primero.')
          : (personal ? 'No hay cobros pendientes.' : 'No hay trabajos pendientes de facturar.'))) +
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
      if (penHecho(t)) {
        if (penEsPersonal(t)) { if (penApunteDe(t)) abrirFichaApunte(t.id_apunte); }
        else if (penFacturaDe(t)) abrirFichaFacturaVenta(t.id_factura);
      } else if (penEsDePresupuesto(t)) {
        if (penPresupuestoDe(t)) abrirFichaPresupuesto(t.id_presupuesto);
      } else {
        penAbrirFormulario(t.id, '');
      }
    });
  });
}

// ------------------------------------------------------------
// 2.2 Cliente elegido: resumen, trabajos marcables y Facturar
// ------------------------------------------------------------
// El resumen enseña siempre las cifras, aunque el ojo las oculte en las
// listas: es la vista previa de lo que se va a facturar, igual que las
// fichas y los formularios ("si se abre algo, es para verlo").

function penMarcadosDe(clave) {
  return penPendientesDe(clave).filter(function (t) { return !penDesmarcados[t.id]; });
}

function pintarPanelCliente() {
  const zona = document.getElementById('pen-zona');
  if (!zona) return;
  const personal = penAmbito === 'personal';
  const todos = penPendientesDe(penClienteSel);
  const cli = penClienteDeClave(penClienteSel);
  const facturable = personal ? true : penClienteFacturable(cli);

  // Estructura: en el móvil, todo en una columna (resumen, trabajos y
  // botón Facturar o Cobrado, por ese orden). En PC, dos columnas: los
  // trabajos a la izquierda y, a la derecha y fijos al bajar, el resumen y
  // el botón.
  zona.innerHTML =
    '<button type="button" class="pen-volver" id="pen-volver"><i class="ti ti-arrow-left"></i> ' + (personal ? 'Todos los cobros' : 'Todos los trabajos') + '</button>' +
    '<div class="pen-panel">' +
    '<div class="pen-lateral">' +
      '<div class="pen-resumen" id="pen-resumen"></div>' +
      (facturable ? '' : '<p class="fv-aviso pen-aviso-inactivo">Este cliente está desactivado. Reactívalo en Clientes para poder facturar sus trabajos.</p>') +
      '<button type="button" class="boton-principal pen-btn-facturar" id="pen-btn-facturar"></button>' +
    '</div>' +
    '<div class="pen-trabajos">' +
    '<div class="pen-fila-titulo pen-fila-titulo-lista">' +
      '<p class="pen-bloque-titulo">' + (personal ? 'Cobros pendientes' : 'Trabajos pendientes') + '</p>' +
      '<button type="button" class="boton-menor" id="pen-anadir">' + (personal ? '+ Añadir cobro' : '+ Añadir trabajo') + '</button>' +
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
    if (personal) penCobrar(penMarcadosDe(penClienteSel));
    else penFacturar(penClienteSel);
  });

  penActualizarResumen();
}

function penActualizarResumen() {
  const resumen = document.getElementById('pen-resumen');
  const boton = document.getElementById('pen-btn-facturar');
  if (!resumen || !boton || !penClienteSel) return;

  const personal = penAmbito === 'personal';
  const todos = penPendientesDe(penClienteSel);
  const marcados = penMarcadosDe(penClienteSel);
  const suma = roundMoney(marcados.reduce(function (n, t) { return n + penImporte(t); }, 0));

  const cabecera =
    '<div class="pen-resumen-cab">' +
      '<span class="pen-resumen-cliente">' + escaparHtml(penNombreClave(penClienteSel)) + '</span>' +
      '<span class="pen-resumen-marcados">' + marcados.length + ' de ' + todos.length + ' marcados</span>' +
    '</div>';

  if (personal) {
    resumen.innerHTML = cabecera +
      '<div class="pen-resumen-total"><span>Total a cobrar</span><strong>' + escaparHtml(formatMoney(suma)) + '</strong></div>' +
      '<p class="pen-resumen-nota">Sin IVA ni IRPF · al cobrar se anota en Contabilidad (personal)</p>';
    boton.textContent = marcados.length === 0
      ? 'Marca algún cobro'
      : 'Marcar ' + marcados.length + (marcados.length === 1 ? ' cobrado' : ' cobrados');
    boton.disabled = marcados.length === 0;
    return;
  }

  const cond = penCondiciones(penClienteSel, marcados);
  const r = penCalcularFactura(suma, cond);

  resumen.innerHTML = cabecera +
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
// 3 bis. MARCAR COMO COBRADOS (cobros personales)
// ============================================================
// Cada cobro crea su propio apunte de Contabilidad (ingreso personal, sin
// IVA ni IRPF, fecha de hoy) y guarda su id en id_apunte. Los dos se
// envían a la vez; si algo falla, queda en rojo y se reenvía solo.

async function penCobrar(trabajos) {
  const lista = (trabajos || []).filter(function (t) { return penEsPersonal(t) && !penHecho(t); });
  if (lista.length === 0) return;
  if (!puedeEscribir()) return;

  const total = roundMoney(lista.reduce(function (n, t) { return n + penImporte(t); }, 0));
  const eleccion = await mostrarDialogoOpciones(
    'Marcar como cobrado',
    (lista.length === 1
      ? 'Se anotará 1 ingreso personal en Contabilidad'
      : 'Se anotarán ' + lista.length + ' ingresos personales en Contabilidad') +
      ' por ' + formatMoney(total) + ', con fecha de hoy.',
    [
      { id: 'si', texto: 'Marcar cobrado', tipo: 'principal' },
      { id: 'no', texto: 'Cancelar' }
    ]
  );
  if (eleccion !== 'si') return;

  const hoy = fechaHoyISO();
  lista.forEach(function (t) {
    const idApunte = penNuevoIdApunte();
    const importe = penImporte(t);
    const idContacto = String(t.id_cliente == null ? '' : t.id_cliente);
    guardarRegistro('apuntes', {
      id: idApunte,
      ambito: 'personal',
      tipo: 'ingreso',
      fecha: hoy,
      concepto: String(t.concepto || ''),
      base: importe,
      iva_pct: 0,
      iva: 0,
      irpf_pct: 0,
      irpf: 0,
      total: importe,
      impuesto_tipo: 'ninguno',
      impuesto_trimestre: '',
      impuesto_año: '',
      id_factura_venta: '',
      id_factura_compra: '',
      id_impuesto: '',
      impuesto_pago: '',
      id_contacto: idContacto,
      contacto_libre: idContacto !== '' ? '' : String(t.contacto_libre || '')
    }, null, null);
    guardarRegistro(PEN_ENTIDAD, Object.assign({}, t, { id_apunte: idApunte }), penRepintar, null);
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

  const personal = penEsPersonal(t);
  const hecho = penHecho(t);
  const factura = penFacturaDe(t);
  const apunte = penApunteDe(t);

  let opciones;
  if (hecho && personal) {
    opciones = apunte
      ? '<button type="button" data-accion="verapunte">Ver apunte</button>'
      : '<button type="button" disabled>Apunte archivado</button>';
  } else if (hecho) {
    opciones = factura
      ? '<button type="button" data-accion="ver">Ver factura</button>'
      : '<button type="button" disabled>Factura archivada</button>';
  } else {
    opciones =
      (personal ? '<button type="button" data-accion="cobrar">Marcar cobrado</button>' : '') +
      (penEsDePresupuesto(t) ? '' : '<button type="button" data-accion="editar">Editar</button>') +
      '<button type="button" class="peligro" data-accion="eliminar">' +
        (penEsDePresupuesto(t) ? 'Quitar de Pendiente' : 'Eliminar') + '</button>';
  }

  const menu = document.createElement('div');
  menu.className = 'fv-menu-mas';
  menu.innerHTML =
    (estadoSyncDe(PEN_ENTIDAD, t) === 'error'
      ? '<button type="button" class="destacado" data-accion="reintentar">Reintentar guardado</button>'
      : '') +
    opciones +
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
  accion('verapunte', function () { abrirFichaApunte(t.id_apunte); });
  accion('verpresupuesto', function () { abrirFichaPresupuesto(t.id_presupuesto); });
  accion('cobrar', function () { penCobrar([t]); });
  accion('editar', function () { penAbrirFormulario(id, ''); });
  accion('eliminar', function () { penEliminar(id); });

  setTimeout(function () { document.addEventListener('click', cerrarSiFuera); }, 0);
}

function penEliminar(id) {
  const t = estado.pendiente.find(function (x) { return String(x.id) === String(id); });
  if (!t) return;
  if (penHecho(t)) {
    alert(penEsPersonal(t)
      ? 'Este cobro ya está cobrado y no se puede borrar. Para deshacerlo, borra su apunte en Contabilidad.'
      : 'Este trabajo ya está facturado y no se puede borrar.');
    return;
  }
  const mensaje = penEsDePresupuesto(t)
    ? '¿Quitar «' + String(t.concepto || '') + '» de Pendiente? El presupuesto sigue aceptado y podrás volver a pasarlo a Pendiente.'
    : (penEsPersonal(t)
      ? '¿Eliminar el cobro «' + String(t.concepto || '') + '»?'
      : '¿Eliminar el trabajo «' + String(t.concepto || '') + '»?');
  if (!confirm(mensaje)) return;
  borrarRegistro(PEN_ENTIDAD, id, penRepintar, null);
}

// ============================================================
// 5. FORMULARIO DE UN TRABAJO
// ============================================================

// ¿El formulario es de un cobro personal? Un trabajo que se edita lo es
// si lo era; uno nuevo, si se está en Personal (salvo desde la
// calculadora, que siempre apunta trabajos de empresa).
function penFormularioPersonal(original, extra) {
  return original ? penEsPersonal(original) : (!extra && penAmbito === 'personal');
}

/**
 * @param id               id del trabajo a editar, o null si es nuevo
 * @param clavePrevia      grupo con el que se abre un trabajo nuevo (id de
 *                         cliente, o 'libre:<nombre>' en cobros personales)
 * @param extra            opcional, solo en trabajos nuevos:
 *                         { concepto, importe, avisar }. Lo usa la calculadora
 *                         ("Guardar como pendiente"): rellena el formulario y,
 *                         al guardar, avisa y ofrece ir a Pendiente.
 */
function penAbrirFormulario(id, clavePrevia, extra) {
  if (document.querySelector('.pen-modal-fondo')) return;

  const editando = !!id;
  const original = editando ? estado.pendiente.find(function (t) { return String(t.id) === String(id); }) : null;
  if (editando && !original) return;
  if (original && penHecho(original)) {
    alert(penEsPersonal(original) ? 'Este cobro ya está cobrado y no se puede editar.' : 'Este trabajo ya está facturado y no se puede editar.');
    return;
  }
  if (original && penEsDePresupuesto(original)) {
    // Los trabajos que vienen de un presupuesto no se editan (su importe es el del presupuesto).
    if (penPresupuestoDe(original)) abrirFichaPresupuesto(original.id_presupuesto);
    return;
  }

  const personal = penFormularioPersonal(original, extra);
  const clientes = personal
    ? penContactosActivos()
    : ((typeof fvClientesDisponibles === 'function') ? fvClientesDisponibles() : []);

  let idCliente = original ? String(original.id_cliente == null ? '' : original.id_cliente) : String(clavePrevia || '');
  let libre = original ? String(original.contacto_libre || '') : '';
  if (idCliente.indexOf('libre:') === 0) { libre = penNombreClave(idCliente); idCliente = ''; }
  if (idCliente !== '' && !penClienteDe(idCliente)) idCliente = '';

  // El cliente de un trabajo de empresa no se cambia una vez apuntado; el
  // pagador de un cobro personal sí (no hay nada unido a él).
  const bloqueaCliente = editando && !personal;

  const fondo = document.createElement('div');
  fondo.className = 'fv-modal-fondo pen-modal-fondo';
  fondo.innerHTML =
    '<div class="fv-modal">' +
      '<div class="fv-modal-cabecera">' +
        '<div class="fv-modal-texto">' +
          '<p class="fv-modal-titulo">' + (personal ? (editando ? 'Editar cobro' : 'Nuevo cobro') : (editando ? 'Editar trabajo' : 'Nuevo trabajo')) + '</p>' +
          '<p class="fv-modal-subtitulo">' + (personal ? 'Cobro personal, sin factura' : 'Pendiente de facturar') + '</p>' +
        '</div>' +
        '<button type="button" class="fv-modal-cerrar" aria-label="Cerrar"><i class="ti ti-x"></i></button>' +
      '</div>' +
      '<div class="fv-modal-cuerpo">' +
        '<form id="pen-form">' +
          '<div class="fv-form-grid">' +
            '<div class="fv-campo-grupo ancho-total">' +
              '<label>' + (personal ? 'Quién te debe *' : 'Cliente *') + '</label>' +
              '<input type="hidden" id="pen-campo-id_cliente" value="' + escaparHtml(idCliente) + '">' +
              '<input type="hidden" id="pen-campo-libre" value="' + escaparHtml(libre) + '">' +
              '<button type="button" class="campo-contacto-btn" id="pen-btn-cliente"' + (bloqueaCliente ? ' disabled' : '') + '></button>' +
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
  const ocultoLibre = fondo.querySelector('#pen-campo-libre');
  const botonCliente = fondo.querySelector('#pen-btn-cliente');

  function pintarCliente() {
    const c = penClienteDe(oculto.value);
    const nombre = c ? String(c.nombre_contacto || c.nombre_fiscal || '') : String(ocultoLibre.value || '').trim();
    botonCliente.innerHTML =
      '<span class="campo-contacto-valor' + (nombre ? '' : ' vacio') + '">' + escaparHtml(nombre || (personal ? 'Selecciona o escribe un nombre...' : 'Selecciona un cliente...')) + '</span>' +
      (bloqueaCliente ? '' : '<i class="ti ti-chevron-down"></i>');
  }
  pintarCliente();

  botonCliente.addEventListener('click', function () {
    if (bloqueaCliente) return;
    const actual = oculto.value;
    abrirSelectorContacto(clientes, actual, personal
      ? { permitirLibre: true, etiquetaLibre: 'nombre de quien te debe' }
      : { permitirLibre: false }
    ).then(function (resultado) {
      if (resultado === null) return;
      if (resultado && typeof resultado === 'object' && 'libre' in resultado) {
        oculto.value = '';
        ocultoLibre.value = String(resultado.libre || '');
      } else {
        oculto.value = resultado || '';
        ocultoLibre.value = '';
      }
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
    const campo = fondo.querySelector(editando || idCliente || libre ? '#pen-campo-concepto' : '#pen-btn-cliente');
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

  const personal = penFormularioPersonal(original, extra);
  const idCliente = fondo.querySelector('#pen-campo-id_cliente').value;
  const libre = String(fondo.querySelector('#pen-campo-libre').value || '').trim();
  const concepto = fondo.querySelector('#pen-campo-concepto').value.trim();
  const importe = roundMoney(parsearNumero(fondo.querySelector('#pen-campo-importe').value));

  let valido = true;
  const cliente = penClienteDe(idCliente);
  if (personal) {
    if (!cliente && !libre) { error('id_cliente', 'Indica quién te debe: elige un contacto o escribe un nombre.'); valido = false; }
  } else if (!cliente) {
    error('id_cliente', 'Selecciona un cliente.');
    valido = false;
  }
  if (!concepto) { error('concepto', personal ? 'Escribe el concepto del cobro.' : 'Escribe el concepto del trabajo.'); valido = false; }
  if (!(importe > 0)) { error('importe', personal ? 'Escribe el importe del cobro.' : 'Escribe el importe del trabajo.'); valido = false; }
  if (!valido) return;

  if (original && penHecho(original)) {
    alert(penEsPersonal(original) ? 'Este cobro ya está cobrado y no se puede editar.' : 'Este trabajo ya está facturado y no se puede editar.');
    return;
  }

  // Un trabajo nuevo, o editado, queda pendiente y sin factura: si
  // pertenecía a una factura desactivada, deja de estar unido a ella.
  const registro = personal
    ? Object.assign({}, original || {}, {
        id: original ? original.id : penNuevoId(),
        id_cliente: cliente ? cliente.id : '',
        contacto_libre: cliente ? '' : libre,
        concepto: concepto,
        importe: importe,
        id_factura: '',
        factura: '',
        tipo: 'cobro',
        ambito: 'personal',
        id_apunte: ''
      })
    : Object.assign({}, original || {}, {
        id: original ? original.id : penNuevoId(),
        id_cliente: cliente.id,
        concepto: concepto,
        importe: importe,
        id_factura: '',
        factura: '',
        tipo: 'factura',
        ambito: 'empresa'
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
      penIrACliente(cliente.id);
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
