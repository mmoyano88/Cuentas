/**
 * MÓDULO PLANTILLAS (25/09/2026)
 * ------------------------------------------------------------
 * Trabajos y pagos que se repiten (una boda, las redes de El Viso, la
 * cuota de la asesoría...) guardados una vez y convertidos en un
 * presupuesto, una factura o un apunte cuando hacen falta.
 *
 * Reglas acordadas con el propietario (DIARIO, sección PLANTILLAS):
 * - Tres tipos, cada uno convierte SOLO a lo suyo: plantilla de
 *   presupuesto → presupuesto, de factura → factura de venta, de apunte
 *   → apunte de Contabilidad. Una hoja por tipo en Sheets.
 * - Pantalla de TARJETAS, no de lista: icono grande con el color de su
 *   categoría, título, cliente habitual (si lo hay), concepto,
 *   descripción cortada y, abajo a la derecha, el precio final.
 * - Al tocar una tarjeta se abre la plantilla completa (con los
 *   "detalles", que son solo de la plantilla y nunca pasan al
 *   documento), el desglose del precio, y cliente + fecha para crear.
 *   Esta ventana SÍ se cierra al tocar fuera (excepción acordada a la
 *   regla 10.1: dentro solo se pierden el cliente y la fecha).
 * - Al convertir:
 *     · presupuesto: se copian subtotal, descuento, IVA e IRPF, y el
 *       ajuste por tipo de cliente lo pone el cliente elegido;
 *     · factura: el importe se copia tal cual (en facturas no hay
 *       ajuste de cliente, GUÍA 20);
 *     · apunte: copia exacta; solo se eligen fecha y, si se quiere,
 *       otro contacto.
 *   La plantilla no se toca ni se gasta.
 * - Numeración del documento creado: la siguiente de la serie del año
 *   en curso, con las mismas funciones que Presupuestos y Facturas.
 * - El desglose de la Calculadora de una plantilla de presupuesto vive
 *   en presupuestos_detalle, con el id de la plantilla ("plp-...") en
 *   la columna id_presupuesto. Al convertir se copia al presupuesto.
 *
 * Se apoya en funciones de otros módulos (cargados antes en
 * index.html): mod-presupuestos.js (cálculo 🔒, numeración, desglose),
 * mod-facturas-venta.js (numeración, guardado), mod-contabilidad.js
 * (cálculo inverso 🔒 del apunte). No se ha cambiado ninguna fórmula.
 *
 * Estilos: reutiliza las clases de ventana y formulario de
 * Presupuestos (pre-modal, pre-campo-grupo...) para que se vea igual
 * que el resto de la app; mod-plantillas.css solo lleva lo propio
 * (las tarjetas y la ficha).
 */

// ============================================================
// 0. ESTADO Y TIPOS
// ============================================================

let plVista = 'presupuesto';   // 'presupuesto' | 'factura' | 'apunte'
let plBusqueda = '';

const PL_TIPOS = {
  presupuesto: {
    entidad: 'plantillas_presupuesto', prefijo: 'plp', selector: 'Presupuestos',
    crear: 'Crear presupuesto', nombre: 'plantilla de presupuesto', vacio: 'Todavía no hay plantillas de presupuesto.'
  },
  factura: {
    entidad: 'plantillas_factura', prefijo: 'plf', selector: 'Facturas',
    crear: 'Crear factura', nombre: 'plantilla de factura', vacio: 'Todavía no hay plantillas de factura.'
  },
  apunte: {
    entidad: 'plantillas_apunte', prefijo: 'pla', selector: 'Contabilidad',
    crear: 'Crear apunte', nombre: 'plantilla de apunte', vacio: 'Todavía no hay plantillas de apunte.'
  }
};

const PL_PUNTOS = {
  ok:        { clase: 'ok',        titulo: 'Guardado en la base de datos' },
  guardando: { clase: 'guardando', titulo: 'Guardando...' },
  error:     { clase: 'error',     titulo: 'No se pudo guardar. Abre "Más opciones" y reintenta.' }
};

// ============================================================
// 1. UTILIDADES
// ============================================================

function plNuevoId(prefijo) {
  return prefijo + '-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e9).toString(36);
}

function plLista(tipo) {
  return estado[PL_TIPOS[tipo].entidad] || [];
}

function plBuscar(tipo, id) {
  return plLista(tipo).find(function (x) { return String(x.id) === String(id); }) || null;
}

function plContactoPorId(id) {
  if (id === '' || id === null || id === undefined) return null;
  return estado.clientes.find(function (c) { return String(c.id) === String(id); }) || null;
}

// Desglose de la Calculadora de una plantilla de presupuesto (misma
// hoja y misma búsqueda que el de un presupuesto).
function plDetalleDe(tipo, id) {
  if (tipo !== 'presupuesto') return null;
  return preDetalleDe(id);
}

function plEstadoSync(tipo, pl) {
  const propio = estadoSyncDe(PL_TIPOS[tipo].entidad, pl);
  if (propio !== 'ok') return propio;
  const d = plDetalleDe(tipo, pl.id);
  return d ? estadoSyncDe('presupuestos_detalle', d) : 'ok';
}

function plPunto(tipo, pl) {
  const info = PL_PUNTOS[plEstadoSync(tipo, pl)] || PL_PUNTOS.ok;
  return '<span class="pre-punto ' + info.clase + '" title="' + escaparHtml(info.titulo) + '"></span>';
}

// Contactos que se pueden elegir según el tipo de plantilla. En los
// apuntes depende de si es ingreso (clientes) o gasto (proveedores),
// igual que en el formulario de Contabilidad.
function plContactosDisponibles(tipo, tipoApunte) {
  if (tipo === 'apunte' && tipoApunte !== 'ingreso') return fcProveedoresDisponibles();
  return fvClientesDisponibles();
}

// Id del contacto habitual guardado en la plantilla.
function plIdContactoHabitual(tipo, pl) {
  return tipo === 'apunte' ? pl.id_contacto : pl.id_cliente;
}

function plNombreContacto(tipo, pl) {
  const c = plContactoPorId(plIdContactoHabitual(tipo, pl));
  if (c) return String(c.nombre_contacto || '');
  if (tipo === 'apunte' && pl.contacto_libre) return String(pl.contacto_libre);
  return '';
}

// Opciones de IVA / IRPF por PORCENTAJE (es lo que se guarda en la
// plantilla, igual que en presupuestos, facturas y apuntes). Si la
// plantilla tiene un porcentaje que ya no está en Configuración, se
// añade al final para no perderlo al editar.
function plOpcionesPorcentaje(tipos, actual, conCero, etiquetaCero) {
  const opciones = [];
  const vistos = {};
  if (conCero) { opciones.push(['0', etiquetaCero]); vistos['0'] = true; }
  tipos.forEach(function (x) {
    const clave = String(parsearNumero(x.porcentaje));
    if (vistos[clave]) return;
    vistos[clave] = true;
    opciones.push([clave, x.nombre + ' (' + x.porcentaje + '%)']);
  });
  const claveActual = String(parsearNumero(actual));
  if (actual !== undefined && actual !== null && actual !== '' && !vistos[claveActual]) {
    opciones.push([claveActual, claveActual + '%']);
  }
  return opciones;
}

// ============================================================
// 2. CÁLCULO (reutiliza las fórmulas 🔒 de cada módulo, sin tocarlas)
// ============================================================

// Presupuesto: el mismo tramo que el formulario de presupuesto
// (preTotalesDesdeSubtotal). El ajuste lo pone el tipo del cliente
// indicado; sin cliente, el primer tipo de la lista, igual que hace el
// formulario de presupuesto mientras no se elige cliente.
function plCalcularPresupuesto(pl, idCliente) {
  const cliente = plContactoPorId(idCliente);
  let tipoCliente = cliente ? preTipoClientePorId(cliente.tipo) : null;
  if (!tipoCliente) tipoCliente = preTiposCliente()[0] || null;
  const t = preTotalesDesdeSubtotal({
    subtotal: parsearNumero(pl.subtotal),
    factorCliente: tipoCliente ? tipoCliente.factor : 1,
    compensacionPct: preTarifas().compensacionPct,
    descTipo: String(pl.descuento_especial_tipo) === 'fixed' ? 'fixed' : 'percent',
    descValor: parsearNumero(pl.descuento_especial_valor),
    ivaPct: parsearNumero(pl.iva_pct),
    irpfPct: parsearNumero(pl.irpf_pct)
  });
  t.tipoCliente = tipoCliente;
  t.cliente = cliente;
  return t;
}

// Factura: exactamente el mismo cálculo que fvCalcularFormulario
// (mod-facturas-venta.js), sin ajuste de cliente ni compensación. Se
// repite aquí porque aquel parte del id del tipo de IVA/IRPF y la
// plantilla guarda el porcentaje, igual que la factura.
function plCalcularFactura(pl) {
  const importe = roundMoney(parsearNumero(pl.importe));
  const descuento = String(pl.descuento_especial_tipo) === 'fixed'
    ? roundMoney(parsearNumero(pl.descuento_especial_valor))
    : roundMoney(importe * parsearNumero(pl.descuento_especial_valor) / 100);
  const base = roundMoney(importe - descuento);
  const ivaPct = parsearNumero(pl.iva_pct);
  const irpfPct = parsearNumero(pl.irpf_pct);
  const iva = roundMoney(base * ivaPct / 100);
  const irpf = roundMoney(base * irpfPct / 100);
  return {
    importe: importe, descuentoImporte: descuento, base: base,
    ivaPct: ivaPct, iva: iva, irpfPct: irpfPct, irpf: irpf,
    total: roundMoney(base + iva - irpf)
  };
}

// Apunte: cálculo inverso 🔒 de Contabilidad (se escribe el total).
function plCalcularApunte(pl) {
  return ctTotalesDesdeTotal(pl.total, pl.iva_pct, pl.irpf_pct, pl.ambito === 'personal' ? 'personal' : 'empresa');
}

function plCalcular(tipo, pl, idContacto) {
  if (tipo === 'presupuesto') return plCalcularPresupuesto(pl, idContacto);
  if (tipo === 'factura') return plCalcularFactura(pl);
  return plCalcularApunte(pl);
}

// Resumen económico detallado (ficha y formularios).
function plResumenHtml(tipo, pl, t) {
  const signo = function (v) { return (Number(v) > 0 ? '+' : (Number(v) < 0 ? '−' : '')) + formatMoney(Math.abs(Number(v || 0))); };

  if (tipo === 'presupuesto') {
    return '<p class="pre-bloque-titulo">Resumen económico</p>' +
      preLinea('Subtotal', formatMoney(t.subtotal)) +
      preLinea('Ajuste por tipo de cliente (' + t.ajustePct + '%)' + (t.tipoCliente ? ' · ' + t.tipoCliente.etiqueta : ''), signo(t.ajusteImporte)) +
      preLinea('Compensación IRPF (' + t.compensacionPct + '%)', signo(t.compensacion)) +
      (t.descImporte > 0 ? preLinea(fvEtiquetaDescuento(t.descTipo, t.descValor), '−' + formatMoney(t.descImporte)) : '') +
      preLinea('Base imponible', formatMoney(t.base), 'destacada') +
      preLinea('IVA (' + t.ivaPct + '%)', '+' + formatMoney(t.iva)) +
      (t.irpf > 0 ? preLinea('Retención IRPF (' + t.irpfPct + '%)', '−' + formatMoney(t.irpf)) : '') +
      '<div class="pre-total-final"><span>TOTAL</span><strong>' + escaparHtml(formatMoney(t.total)) + '</strong></div>';
  }

  if (tipo === 'factura') {
    return '<p class="pre-bloque-titulo">Resumen económico</p>' +
      (t.descuentoImporte > 0
        ? preLinea('Importe', formatMoney(t.importe)) +
          preLinea(fvEtiquetaDescuento(pl.descuento_especial_tipo, pl.descuento_especial_valor), '−' + formatMoney(t.descuentoImporte))
        : '') +
      preLinea('Base imponible', formatMoney(t.base), 'destacada') +
      preLinea('IVA (' + t.ivaPct + '%)', '+' + formatMoney(t.iva)) +
      (t.irpf > 0 ? preLinea('Retención IRPF (' + t.irpfPct + '%)', '−' + formatMoney(t.irpf)) : '') +
      '<div class="pre-total-final"><span>TOTAL</span><strong>' + escaparHtml(formatMoney(t.total)) + '</strong></div>';
  }

  const esIngreso = pl.tipo === 'ingreso';
  const esPersonal = pl.ambito === 'personal';
  return '<p class="pre-bloque-titulo">Resumen económico</p>' +
    preLinea('Base', formatMoney(t.base)) +
    (!esPersonal ? preLinea('IVA (' + t.ivaPct + '%)', '+' + formatMoney(t.iva)) : '') +
    (!esPersonal && t.irpf > 0 ? preLinea('Retención IRPF (' + t.irpfPct + '%)', '−' + formatMoney(t.irpf)) : '') +
    '<div class="pre-total-final"><span>TOTAL</span><strong class="' + (esIngreso ? 'pl-ingreso' : 'pl-gasto') + '">' +
      (esIngreso ? '' : '−') + escaparHtml(formatMoney(t.total)) + '</strong></div>';
}

// ============================================================
// 3. PANTALLA PRINCIPAL: SELECTOR + BUSCADOR + TARJETAS
// ============================================================

function pintarPlantillas() {
  const contenido = document.getElementById('contenido');
  if (!contenido) return;

  contenido.innerHTML =
    '<div class="pre-cabecera-lista">' +
      '<div class="pre-selector" id="pl-selector">' +
        Object.keys(PL_TIPOS).map(function (tipo) {
          return '<button type="button" data-vista="' + tipo + '"' + (tipo === plVista ? ' class="activa"' : '') + '>' +
            escaparHtml(PL_TIPOS[tipo].selector) + '</button>';
        }).join('') +
      '</div>' +
      '<button type="button" class="pre-flotante" id="pl-btn-nuevo" aria-label="Nueva plantilla"><i class="ti ti-plus"></i></button>' +
    '</div>' +
    '<div class="pre-barra">' +
      '<input type="text" class="pre-buscador" id="pl-buscador" placeholder="Buscar plantilla..." value="' + escaparHtml(plBusqueda) + '">' +
    '</div>' +
    '<div id="pl-contenedor"></div>';

  contenido.querySelectorAll('#pl-selector [data-vista]').forEach(function (b) {
    b.addEventListener('click', function () {
      plVista = b.dataset.vista;
      pintarPlantillas();
    });
  });

  document.getElementById('pl-btn-nuevo').addEventListener('click', function () {
    plAbrirFormulario(plVista, null, null, null, null);
  });

  const buscador = document.getElementById('pl-buscador');
  const repintarConRetardo = conRetardo(plRepintar, 180);
  buscador.addEventListener('input', function () {
    plBusqueda = buscador.value;
    repintarConRetardo();
  });

  plRepintar();
}

function plTextoBusqueda(tipo, pl) {
  return normalizarBusqueda([
    pl.nombre, pl.concepto, pl.descripcion, pl.detalles, plNombreContacto(tipo, pl), tituloIconoPlantilla(pl.icono)
  ].filter(Boolean).map(String).join(' '));
}

function plListaFiltrada(tipo) {
  const texto = normalizarBusqueda(plBusqueda);
  return plLista(tipo).filter(function (pl) {
    return !texto || plTextoBusqueda(tipo, pl).indexOf(texto) !== -1;
  }).sort(function (a, b) {
    return String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es', { sensitivity: 'base' });
  });
}

function plRepintar() {
  const contenedor = document.getElementById('pl-contenedor');
  if (!contenedor) return;
  const tipo = plVista;
  const lista = plListaFiltrada(tipo);

  if (lista.length === 0) {
    contenedor.innerHTML = '<p class="pre-vacio">' +
      (plBusqueda ? 'No hay plantillas que coincidan con la búsqueda.' : escaparHtml(PL_TIPOS[tipo].vacio) +
        '<br>Pulsa «+» para crear la primera.') + '</p>';
    return;
  }

  contenedor.innerHTML = '<div class="pl-rejilla">' +
    lista.map(function (pl) { return plTarjetaHtml(tipo, pl); }).join('') + '</div>';

  contenedor.querySelectorAll('.pl-tarjeta').forEach(function (tarjeta) {
    tarjeta.addEventListener('click', function (ev) {
      if (ev.target.closest('.pre-control')) return;
      plAbrirPlantilla(tipo, tarjeta.dataset.id);
    });
  });
  contenedor.querySelectorAll('[data-mas]').forEach(function (b) {
    b.addEventListener('click', function (ev) {
      ev.stopPropagation();
      plAbrirMenuMas(b, tipo, b.dataset.mas);
    });
  });
}

function plTarjetaHtml(tipo, pl) {
  const t = plCalcular(tipo, pl, plIdContactoHabitual(tipo, pl));
  const contacto = plNombreContacto(tipo, pl);
  const esGasto = tipo === 'apunte' && pl.tipo !== 'ingreso';
  const clasePrecio = tipo === 'apunte' ? (esGasto ? ' gasto' : ' ingreso') : '';

  return '<div class="pl-tarjeta" data-id="' + escaparHtml(pl.id) + '">' +
    '<div class="pl-tarjeta-cabecera">' +
      htmlIconoPlantilla(pl.icono, 52) +
      '<div class="pl-tarjeta-titulos">' +
        '<p class="pl-titulo">' + escaparHtml(pl.nombre || 'Sin nombre') + '</p>' +
        (contacto ? '<p class="pl-contacto">' + escaparHtml(contacto) + '</p>' : '') +
      '</div>' +
      '<div class="pre-control">' +
        '<button type="button" class="pre-btn-icono" data-mas="' + escaparHtml(pl.id) + '" aria-label="Más opciones"><i class="ti ti-dots-vertical"></i></button>' +
        plPunto(tipo, pl) +
      '</div>' +
    '</div>' +
    (pl.concepto ? '<p class="pl-concepto">' + escaparHtml(pl.concepto) + '</p>' : '') +
    (pl.descripcion ? '<p class="pl-descripcion">' + escaparHtml(pl.descripcion) + '</p>' : '') +
    '<p class="pl-precio' + clasePrecio + '">' + (esGasto ? '−' : '') + escaparHtml(dineroVisible(t.total)) + '</p>' +
  '</div>';
}

// ============================================================
// 4. MENÚ DE TRES PUNTOS
// ============================================================

function plAbrirMenuMas(boton, tipo, id) {
  document.querySelectorAll('.pre-menu-mas').forEach(function (m) { m.remove(); });
  const pl = plBuscar(tipo, id);
  if (!pl) return;

  const menu = document.createElement('div');
  menu.className = 'pre-menu-mas';
  menu.innerHTML =
    (plEstadoSync(tipo, pl) === 'error'
      ? '<button type="button" class="destacado" data-accion="reintentar">Reintentar guardado</button>'
      : '') +
    '<button type="button" data-accion="usar">' + escaparHtml(PL_TIPOS[tipo].crear) + '</button>' +
    '<button type="button" data-accion="editar">Editar</button>' +
    '<button type="button" data-accion="duplicar">Duplicar plantilla</button>' +
    '<button type="button" class="peligro" data-accion="eliminar">Eliminar</button>';

  document.body.appendChild(menu);
  prePosicionarMenu(menu, boton);

  function cerrarMenu() {
    menu.remove();
    document.removeEventListener('click', cerrarSiFuera);
  }
  function cerrarSiFuera(ev) { if (!menu.contains(ev.target)) cerrarMenu(); }

  menu.querySelector('[data-accion="reintentar"]')?.addEventListener('click', function () { cerrarMenu(); plReintentar(tipo, id); });
  menu.querySelector('[data-accion="usar"]').addEventListener('click', function () { cerrarMenu(); plAbrirPlantilla(tipo, id); });
  menu.querySelector('[data-accion="editar"]').addEventListener('click', function () { cerrarMenu(); plAbrirEdicion(tipo, id); });
  menu.querySelector('[data-accion="duplicar"]').addEventListener('click', function () { cerrarMenu(); plDuplicar(tipo, id); });
  menu.querySelector('[data-accion="eliminar"]').addEventListener('click', function () { cerrarMenu(); plEliminar(tipo, id); });

  setTimeout(function () { document.addEventListener('click', cerrarSiFuera); }, 0);
}

// Editar: una plantilla de presupuesto hecha con la Calculadora se
// reabre EN la Calculadora, igual que un presupuesto; las demás, en su
// formulario.
function plAbrirEdicion(tipo, id) {
  const pl = plBuscar(tipo, id);
  if (!pl) return;
  if (tipo === 'presupuesto' && plDetalleDe(tipo, id) && typeof preEditarPlantillaEnCalculadora === 'function') {
    preEditarPlantillaEnCalculadora(id);
    return;
  }
  plAbrirFormulario(tipo, id, null, null, null);
}

function plReintentar(tipo, id) {
  reintentarRegistro(PL_TIPOS[tipo].entidad, id, plRepintar);
  const d = plDetalleDe(tipo, id);
  if (d) reintentarRegistro('presupuestos_detalle', d.id, plRepintar);
}

function plDuplicar(tipo, id) {
  const pl = plBuscar(tipo, id);
  if (!pl || !puedeEscribir()) return;
  const copia = Object.assign({}, pl, {
    id: plNuevoId(PL_TIPOS[tipo].prefijo),
    nombre: String(pl.nombre || '') + ' (copia)'
  });
  const d = plDetalleDe(tipo, id);
  let copiaDetalle = null;
  if (d) {
    copiaDetalle = Object.assign({}, d);
    delete copiaDetalle.id;
    delete copiaDetalle.id_presupuesto;
  }
  plGuardarEnSegundoPlano(tipo, copia, copiaDetalle);
}

async function plEliminar(tipo, id) {
  const pl = plBuscar(tipo, id);
  if (!pl) return;
  if (!confirm('¿Eliminar la plantilla «' + (pl.nombre || '') + '»? Los presupuestos, facturas o apuntes ya creados con ella no se tocan.')) return;

  // Acción delicada: pide el PIN, como cualquier borrado de la app.
  if (!await confirmarConPin('Vas a eliminar la plantilla «' + (pl.nombre || '') + '».')) return;

  // Primero su desglose de la Calculadora (si lo tiene), después ella,
  // igual que al borrar un presupuesto.
  const d = plDetalleDe(tipo, id);
  if (d) {
    const r = await borrarRegistro('presupuestos_detalle', d.id, null, null);
    if (r.status !== 'success') return;
  }
  await borrarRegistro(PL_TIPOS[tipo].entidad, id, plRepintar, null);
}

// ============================================================
// 5. PLANTILLA ABIERTA: TODO EL CONTENIDO + CREAR
// ============================================================
// Se cierra al tocar fuera, con Escape o con la X (excepción acordada:
// dentro solo hay cliente y fecha, que se vuelven a elegir en dos
// toques). Cliente y fecha se piden aquí; el resto se copia tal cual.

function plAbrirPlantilla(tipo, id) {
  const pl = plBuscar(tipo, id);
  if (!pl) return;

  const info = PL_TIPOS[tipo];
  const detalle = plDetalleDe(tipo, id);
  const idHabitual = plIdContactoHabitual(tipo, pl);
  const contactos = plContactosDisponibles(tipo, pl.tipo);
  const habitualDisponible = idHabitual !== '' && idHabitual !== undefined && idHabitual !== null &&
    contactos.some(function (c) { return String(c.id) === String(idHabitual); });

  // Lo que se elige al crear. En los apuntes el contacto es opcional y
  // puede ser un nombre libre, como en Contabilidad.
  const eleccion = {
    id_contacto: habitualDisponible ? String(idHabitual) : '',
    contacto_libre: (tipo === 'apunte' && !habitualDisponible) ? String(pl.contacto_libre || '') : ''
  };

  const etiquetaContacto = tipo === 'apunte' ? (pl.tipo === 'ingreso' ? 'Cliente' : 'Proveedor') : 'Cliente *';

  const fondo = document.createElement('div');
  fondo.className = 'pre-modal-fondo';
  fondo.innerHTML =
    '<div class="pre-modal ancho">' +
      '<div class="pre-modal-cabecera">' +
        htmlIconoPlantilla(pl.icono, 48) +
        '<div class="pre-modal-texto">' +
          '<p class="pre-modal-titulo">' + escaparHtml(pl.nombre || 'Plantilla') + '</p>' +
          '<p class="pre-modal-subtitulo">' + escaparHtml(info.nombre.charAt(0).toUpperCase() + info.nombre.slice(1)) +
            (tipo === 'apunte' ? ' · ' + (pl.tipo === 'ingreso' ? 'Ingreso' : 'Gasto') + ' · ' + (pl.ambito === 'personal' ? 'Personal' : 'Empresa') : '') +
          '</p>' +
        '</div>' +
        plPunto(tipo, pl) +
        '<button type="button" class="pre-modal-cerrar" aria-label="Cerrar"><i class="ti ti-x"></i></button>' +
      '</div>' +

      '<div class="pre-modal-cuerpo">' +
        (pl.concepto ? '<p class="pl-ficha-etiqueta">Concepto</p><p class="pl-ficha-concepto">' + escaparHtml(pl.concepto) + '</p>' : '') +
        (pl.descripcion ? '<p class="pl-ficha-etiqueta">Descripción</p><p class="pl-ficha-texto">' + escaparHtml(pl.descripcion) + '</p>' : '') +
        (pl.detalles
          ? '<div class="pl-detalles"><p class="pl-detalles-titulo">Detalles del trabajo <span>solo en la plantilla</span></p>' +
            '<p class="pl-ficha-texto">' + escaparHtml(pl.detalles) + '</p></div>'
          : '') +

        '<div class="pre-bloque" id="pl-usar-resumen"></div>' +
        '<div class="pl-crear">' +
          '<p class="pre-bloque-titulo">' + escaparHtml(info.crear) + '</p>' +
          '<div class="pre-form-grid dos-columnas">' +
            '<div class="pre-campo-grupo ancho-total">' +
              '<label>' + escaparHtml(etiquetaContacto) + '</label>' +
              '<button type="button" class="campo-contacto-btn" id="pl-usar-contacto"></button>' +
              '<p class="pre-mensaje-error" data-error-de="contacto" hidden></p>' +
            '</div>' +
            (tipo !== 'apunte'
              ? '<button type="button" class="boton-menor pre-enlace-cliente" id="pl-usar-nuevo-cliente">+ Crear un cliente nuevo</button>'
              : '') +
            ((idHabitual && !habitualDisponible)
              ? '<p class="pre-aviso">El contacto habitual de esta plantilla ya no está disponible (se borró o está inactivo). Elige otro.</p>'
              : '') +
            '<div class="pre-campo-grupo">' +
              '<label for="pl-usar-fecha">' + (tipo === 'apunte' ? 'Fecha del cobro o pago *' : 'Fecha *') + '</label>' +
              '<input class="campo" type="date" id="pl-usar-fecha" value="' + escaparHtml(fechaHoyISO()) + '">' +
              '<p class="pre-mensaje-error" data-error-de="fecha" hidden></p>' +
            '</div>' +
          '</div>' +
        '</div>' +

        (detalle ? preBloqueDesglose({ subtotal: pl.subtotal, compensacion_irpf_pct: preTarifas().compensacionPct }, detalle) : '') +
      '</div>' +

      '<div class="pre-modal-pie">' +
        '<button type="button" class="boton-secundario" id="pl-usar-editar">Editar</button>' +
        '<button type="button" class="boton-principal" id="pl-usar-crear">' + escaparHtml(info.crear) + '</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(fondo);

  function cerrar() {
    fondo.remove();
    document.removeEventListener('keydown', alPulsarTecla);
  }
  function alPulsarTecla(ev) {
    // Escape solo cierra si no hay otra ventana abierta por encima
    // (selector de contacto, alta de cliente...).
    if (ev.key !== 'Escape') return;
    if (document.querySelector('.selector-icono-fondo, .cli-modal-fondo, .dialogo-fondo')) return;
    cerrar();
  }
  fondo.addEventListener('click', function (ev) { if (ev.target === fondo) cerrar(); });
  document.addEventListener('keydown', alPulsarTecla);
  fondo.querySelector('.pre-modal-cerrar').addEventListener('click', cerrar);

  fondo.querySelector('#pl-usar-editar').addEventListener('click', function () {
    cerrar();
    plAbrirEdicion(tipo, id);
  });
  fondo.querySelector('#pre-ficha-calculadora')?.addEventListener('click', function () {
    cerrar();
    plAbrirEdicion(tipo, id);
  });

  // ---- Contacto ----
  const botonContacto = fondo.querySelector('#pl-usar-contacto');
  function pintarContacto() {
    const lista = plContactosDisponibles(tipo, pl.tipo);
    const c = lista.find(function (x) { return String(x.id) === String(eleccion.id_contacto); });
    let texto = c ? (c.nombre_contacto + (c.nombre_fiscal && c.nombre_fiscal !== c.nombre_contacto ? ' (' + c.nombre_fiscal + ')' : '')) : '';
    if (!texto && eleccion.contacto_libre) texto = eleccion.contacto_libre + ' (sin registrar)';
    const vacio = tipo === 'apunte' ? 'Sin contacto' : 'Selecciona un cliente...';
    botonContacto.innerHTML =
      '<span class="campo-contacto-valor' + (texto ? '' : ' vacio') + '">' + escaparHtml(texto || vacio) + '</span>' +
      '<i class="ti ti-chevron-down"></i>';
  }
  botonContacto.addEventListener('click', function () {
    abrirSelectorContacto(plContactosDisponibles(tipo, pl.tipo), eleccion.id_contacto, {
      permitirLibre: tipo === 'apunte',
      etiquetaLibre: 'nombre de ' + (pl.tipo === 'ingreso' ? 'cliente' : 'proveedor')
    }).then(function (resultado) {
      if (resultado === null) return;
      if (resultado && typeof resultado === 'object' && 'libre' in resultado) {
        eleccion.id_contacto = '';
        eleccion.contacto_libre = resultado.libre;
      } else {
        eleccion.id_contacto = String(resultado || '');
        eleccion.contacto_libre = '';
      }
      pintarContacto();
      pintarResumen();
    });
  });

  const btnNuevoCliente = fondo.querySelector('#pl-usar-nuevo-cliente');
  if (btnNuevoCliente) {
    btnNuevoCliente.addEventListener('click', function () {
      if (typeof abrirCreacionRapidaContacto !== 'function') {
        alert('El módulo de Clientes no está disponible.');
        return;
      }
      if (document.querySelector('.cli-modal-fondo')) return;
      btnNuevoCliente.disabled = true;
      abrirCreacionRapidaContacto('cliente', function (contacto) {
        eleccion.id_contacto = String(contacto.id);
        eleccion.contacto_libre = '';
        pintarContacto();
        pintarResumen();
      });
      const vigilante = setInterval(function () {
        if (!document.querySelector('.cli-modal-fondo')) {
          btnNuevoCliente.disabled = false;
          clearInterval(vigilante);
        }
      }, 300);
    });
  }

  // ---- Resumen (en presupuestos cambia con el tipo del cliente) ----
  function pintarResumen() {
    const t = plCalcular(tipo, pl, eleccion.id_contacto);
    fondo.querySelector('#pl-usar-resumen').innerHTML = plResumenHtml(tipo, pl, t);
  }

  pintarContacto();
  pintarResumen();

  fondo.querySelector('#pl-usar-crear').addEventListener('click', function () {
    plCrearDesdePlantilla(tipo, id, fondo, eleccion, cerrar);
  });
}

// ============================================================
// 6. CREAR EL DOCUMENTO REAL (copia exacta, solo cliente y fecha)
// ============================================================

async function plCrearDesdePlantilla(tipo, id, fondo, eleccion, cerrar) {
  const pl = plBuscar(tipo, id);
  if (!pl) { cerrar(); return; }

  fondo.querySelectorAll('[data-error-de]').forEach(function (el) { el.hidden = true; });
  const error = function (campo, texto) {
    const p = fondo.querySelector('[data-error-de="' + campo + '"]');
    if (p) { p.textContent = texto; p.hidden = false; }
  };

  const fecha = normalizarFecha(fondo.querySelector('#pl-usar-fecha').value);
  let valido = true;
  if (!fecha) { error('fecha', 'Obligatoria'); valido = false; }

  let contacto = null;
  if (eleccion.id_contacto) {
    contacto = plContactoPorId(eleccion.id_contacto);
    if (!contacto) { error('contacto', 'Ese contacto ya no existe.'); valido = false; }
  } else if (tipo !== 'apunte') {
    error('contacto', 'Selecciona un cliente activo. Si no existe, créalo primero.');
    valido = false;
  }
  if (!valido) return;
  if (!puedeEscribir()) return;

  if (tipo === 'presupuesto') {
    cerrar();
    plCrearPresupuesto(pl, contacto, fecha);
  } else if (tipo === 'factura') {
    // Avisos que no bloquean (acordado el 24/09/2026): el número es
    // siempre el siguiente de la serie del año en curso.
    if (!await plAvisosFechaFactura(fecha)) return;
    cerrar();
    plCrearFactura(pl, contacto, fecha);
  } else {
    cerrar();
    plCrearApunte(pl, contacto, eleccion.contacto_libre, fecha);
  }
}

async function plAvisosFechaFactura(fecha) {
  const anioActual = new Date().getFullYear();
  const numero = fvSiguienteNumero();
  const avisos = [];

  if (parseInt(fecha.split('-')[0], 10) !== anioActual) {
    avisos.push('La fecha es de otro año, pero el número (' + numero + ') será el siguiente de la serie de ' + anioActual + '.');
  }
  const ultima = estado.ventas.filter(function (f) {
    return fvEstaActiva(f) && normalizarFecha(f.fecha).indexOf(String(anioActual)) === 0;
  }).map(function (f) { return normalizarFecha(f.fecha); }).sort().pop();
  if (ultima && fecha < ultima) {
    avisos.push('La fecha es anterior a la de tu última factura (' + mostrarFecha(ultima) + '). Conviene que las facturas vayan en orden de fecha.');
  }
  if (avisos.length === 0) return true;

  const eleccion = await mostrarDialogoOpciones('Revisa la fecha', avisos.join(' '), [
    { id: 'seguir', texto: 'Crear igualmente', tipo: 'principal' },
    { id: 'volver', texto: 'Volver' }
  ]);
  return eleccion === 'seguir';
}

function plCrearPresupuesto(pl, cliente, fecha) {
  const t = plCalcularPresupuesto(pl, cliente.id);

  // Mismos campos, en el mismo orden, que un presupuesto hecho a mano
  // (preProcesarGuardado). Los datos del cliente se congelan.
  const registro = {
    id: preNuevoId('pres'),
    id_presupuesto_origen: '',
    numero: preSiguienteNumero(),
    fecha: fecha,
    id_cliente: cliente.id,
    cliente: cliente.nombre_fiscal || cliente.nombre_contacto || '',
    nif: cliente.nif || '',
    concepto: String(pl.concepto || ''),
    descripcion: String(pl.descripcion || ''),
    subtotal: t.subtotal,
    ajuste_cliente_pct: t.ajustePct,
    ajuste_cliente_importe: t.ajusteImporte,
    compensacion_irpf_pct: t.compensacionPct,
    compensacion_irpf_importe: t.compensacion,
    descuento_especial_tipo: t.descTipo,
    descuento_especial_valor: t.descValor,
    descuento_especial_importe: t.descImporte,
    base: t.base,
    iva_pct: t.ivaPct,
    iva: t.iva,
    irpf_pct: t.irpfPct,
    irpf: t.irpf,
    total: t.total,
    estado: 'pendiente'
  };

  // El desglose de la Calculadora (si la plantilla lo tiene) se copia
  // al presupuesto nuevo, para poder seguir editándolo en la Calculadora.
  const d = plDetalleDe('presupuesto', pl.id);
  let copiaDetalle = null;
  if (d) {
    copiaDetalle = Object.assign({}, d);
    delete copiaDetalle.id;
    delete copiaDetalle.id_presupuesto;
  }

  preGuardarEnSegundoPlano(registro, copiaDetalle);
  plAvisarCreado('presupuesto', registro);
}

function plCrearFactura(pl, cliente, fecha) {
  const t = plCalcularFactura(pl);

  // Mismos campos que una factura hecha a mano (fvProcesarGuardado):
  // subtotal y ajustes a cero, como en cualquier factura desde el
  // 07/09/2026 (GUÍA 20).
  const registro = {
    id: fvNuevoId('fv'),
    numero: fvSiguienteNumero(),
    fecha: fecha,
    id_cliente: cliente.id,
    cliente: cliente.nombre_fiscal || cliente.nombre_contacto || '',
    nif: cliente.nif || '',
    id_presupuesto: '',
    concepto: String(pl.concepto || ''),
    descripcion: String(pl.descripcion || ''),
    subtotal: 0,
    ajuste_cliente_pct: 0,
    ajuste_cliente_importe: 0,
    compensacion_irpf_pct: 0,
    compensacion_irpf_importe: 0,
    descuento_especial_tipo: String(pl.descuento_especial_tipo) === 'fixed' ? 'fixed' : 'percent',
    descuento_especial_valor: parsearNumero(pl.descuento_especial_valor),
    descuento_especial_importe: t.descuentoImporte,
    base: t.base,
    iva_pct: t.ivaPct,
    iva: t.iva,
    irpf_pct: t.irpfPct,
    irpf: t.irpf,
    total: t.total,
    estado: 'pendiente',
    fecha_cobro: '',
    estado_registro: 'activo'
  };

  fvGuardarEnSegundoPlano(registro);
  plAvisarCreado('factura', registro);
}

function plCrearApunte(pl, contacto, contactoLibre, fecha) {
  const ambito = pl.ambito === 'personal' ? 'personal' : 'empresa';
  const t = plCalcularApunte(pl);

  // Mismos campos que un apunte manual (ctProcesarGuardado).
  const registro = {
    id: ctNuevoId('apu'),
    ambito: ambito,
    tipo: pl.tipo === 'ingreso' ? 'ingreso' : 'gasto',
    fecha: fecha,
    concepto: String(pl.concepto || ''),
    base: t.base,
    iva_pct: t.ivaPct,
    iva: t.iva,
    irpf_pct: t.irpfPct,
    irpf: t.irpf,
    total: t.total,
    impuesto_tipo: ambito === 'personal' ? 'ninguno' : ctTipoImpuesto(t.iva, t.irpf),
    impuesto_trimestre: ambito === 'empresa' ? ctTrimestreDeFecha(fecha) : '',
    impuesto_año: ambito === 'empresa' ? parseInt(fecha.split('-')[0], 10) : '',
    id_factura_venta: '',
    id_factura_compra: '',
    id_impuesto: '',
    impuesto_pago: '',
    id_contacto: contacto ? contacto.id : '',
    contacto_libre: contacto ? '' : String(contactoLibre || '')
  };

  guardarRegistro('apuntes', registro, null, null);
  plAvisarCreado('apunte', registro);
}

// Aviso tras crear, con la opción de ir a verlo.
function plAvisarCreado(tipo, registro) {
  const textos = {
    presupuesto: ['Presupuesto creado', 'Creado el presupuesto ' + registro.numero + '. Queda pendiente, como cualquier presupuesto nuevo.', 'Ver presupuesto'],
    factura: ['Factura creada', 'Creada la factura ' + registro.numero + ', pendiente de cobro.', 'Ver factura'],
    apunte: ['Apunte creado', 'Creado el apunte «' + registro.concepto + '» con fecha ' + mostrarFecha(registro.fecha) + '.', 'Ver apunte']
  };
  const t = textos[tipo];
  mostrarDialogoOpciones(t[0], t[1], [
    { id: 'ver', texto: t[2], tipo: 'principal' },
    { id: 'cerrar', texto: 'Seguir en Plantillas' }
  ]).then(function (eleccion) {
    if (eleccion !== 'ver') { plRepintar(); return; }
    if (tipo === 'presupuesto') {
      preSubvista = 'relacion';
      cambiarVista('presupuestos');
      abrirFichaPresupuesto(registro.id);
    } else if (tipo === 'factura') {
      fvArea = 'ventas';
      cambiarVista('facturas');
      abrirFichaFacturaVenta(registro.id);
    } else {
      cambiarVista('contabilidad');
      abrirFichaApunte(registro.id);
    }
  });
}

// ============================================================
// 7. FORMULARIO DE PLANTILLA (crear y editar)
// ============================================================
// No se cierra al tocar fuera: hay trabajo dentro (regla 10.1).
//
// @param tipo       'presupuesto' | 'factura' | 'apunte'
// @param id         plantilla a editar, o null si es nueva
// @param prefill    datos de partida (desde la Calculadora o desde un
//                   presupuesto/factura/apunte existente), con los mismos
//                   nombres que las columnas de la hoja
// @param snapshot   desglose de la Calculadora a guardar con la
//                   plantilla (solo presupuestos), o null
// @param opciones   { alGuardar: función, avisarAlGuardar: bool }

function plCampo(clave, etiqueta, valor, o) {
  o = o || {};
  return '<div class="pre-campo-grupo' + (o.anchoTotal ? ' ancho-total' : '') + '">' +
    '<label for="plf-' + clave + '">' + escaparHtml(etiqueta) + (o.requerido ? ' *' : '') + '</label>' +
    (o.textarea
      ? '<textarea class="campo' + (o.grande ? ' pl-textarea-grande' : '') + '" id="plf-' + clave + '">' + escaparHtml(valor || '') + '</textarea>'
      : '<input class="campo" id="plf-' + clave + '" type="text"' +
        (o.numero ? ' data-numero="1" inputmode="decimal"' : '') +
        (o.placeholder ? ' placeholder="' + escaparHtml(o.placeholder) + '"' : '') +
        ' value="' + escaparHtml(valor === 0 ? '0' : (valor || '')) + '">') +
    (o.nota ? '<p class="pl-nota-campo">' + escaparHtml(o.nota) + '</p>' : '') +
    '<p class="pre-mensaje-error" data-error-de="' + clave + '" hidden></p>' +
  '</div>';
}

function plSelect(clave, etiqueta, opciones, valor) {
  return '<div class="pre-campo-grupo">' +
    '<label for="plf-' + clave + '">' + escaparHtml(etiqueta) + '</label>' +
    '<select class="campo" id="plf-' + clave + '">' +
      opciones.map(function (op) {
        return '<option value="' + escaparHtml(op[0]) + '"' + (String(op[0]) === String(valor) ? ' selected' : '') + '>' +
          escaparHtml(op[1]) + '</option>';
      }).join('') +
    '</select>' +
  '</div>';
}

function plAbrirFormulario(tipo, id, prefill, snapshot, opciones) {
  const info = PL_TIPOS[tipo];
  const original = id ? plBuscar(tipo, id) : null;
  if (id && !original) { alert('Esta plantilla ya no existe.'); return; }
  const o = opciones || {};

  // Valores de partida: la plantilla guardada, encima lo que llegue.
  const base = Object.assign({}, original || {}, prefill || {});
  const tiposIva = preTiposIva();
  const tiposIrpf = preTiposIrpf();

  const datos = {
    nombre: String(base.nombre || ''),
    icono: base.icono || '',
    tipo: base.tipo === 'ingreso' ? 'ingreso' : 'gasto',
    ambito: base.ambito === 'personal' ? 'personal' : 'empresa',
    id_contacto: String((tipo === 'apunte' ? base.id_contacto : base.id_cliente) || ''),
    contacto_libre: tipo === 'apunte' ? String(base.contacto_libre || '') : '',
    concepto: String(base.concepto || ''),
    descripcion: String(base.descripcion || ''),
    detalles: String(base.detalles || ''),
    importe: parsearNumero(tipo === 'presupuesto' ? base.subtotal : (tipo === 'factura' ? base.importe : base.total)),
    desc_tipo: String(base.descuento_especial_tipo) === 'fixed' ? 'fixed' : 'percent',
    desc_valor: parsearNumero(base.descuento_especial_valor),
    iva_pct: (base.iva_pct !== undefined && base.iva_pct !== '') ? parsearNumero(base.iva_pct)
      : (tipo === 'apunte' ? 0 : (tiposIva[0] ? tiposIva[0].porcentaje : 0)),
    irpf_pct: (base.irpf_pct !== undefined && base.irpf_pct !== '') ? parsearNumero(base.irpf_pct)
      : (tipo === 'apunte' ? 0 : (tiposIrpf[0] ? tiposIrpf[0].porcentaje : 0))
  };

  const etiquetaImporte = tipo === 'presupuesto'
    ? 'Subtotal (antes de ajustes)'
    : (tipo === 'factura' ? 'Importe (antes de descuento)' : 'Total (lo que se cobra o paga)');

  const titulo = (original ? 'Editar ' : 'Nueva ') + info.nombre;

  const fondo = document.createElement('div');
  fondo.className = 'pre-modal-fondo';
  fondo.innerHTML =
    '<div class="pre-modal ancho">' +
      '<div class="pre-modal-cabecera">' +
        '<div class="pre-modal-texto">' +
          '<p class="pre-modal-titulo">' + escaparHtml(titulo.charAt(0).toUpperCase() + titulo.slice(1)) + '</p>' +
          (snapshot ? '<p class="pre-modal-subtitulo">Importes calculados con la Calculadora</p>' : '') +
        '</div>' +
        '<button type="button" class="pre-modal-cerrar" aria-label="Cerrar"><i class="ti ti-x"></i></button>' +
      '</div>' +

      '<div class="pre-modal-cuerpo">' +
        '<form id="plf-form">' +
          '<div class="pre-form-grid dos-columnas">' +
            plCampo('nombre', 'Nombre de la plantilla', datos.nombre, { requerido: true, anchoTotal: true, placeholder: 'Boda completa, Redes de El Viso...' }) +

            '<div class="pre-campo-grupo ancho-total">' +
              '<label>Icono</label>' +
              '<div class="campo-icono-elegido" id="plf-icono" data-icono="' + escaparHtml(datos.icono) + '"></div>' +
            '</div>' +

            (tipo === 'apunte'
              ? '<div class="ct-selector" id="plf-selector-tipo">' +
                  '<button type="button" data-tipo="ingreso" class="' + (datos.tipo === 'ingreso' ? 'activa ingreso' : '') + '">Ingreso</button>' +
                  '<button type="button" data-tipo="gasto" class="' + (datos.tipo === 'gasto' ? 'activa gasto' : '') + '">Gasto</button>' +
                '</div>' +
                '<div class="ct-selector" id="plf-selector-ambito">' +
                  '<button type="button" data-ambito="empresa" class="' + (datos.ambito === 'empresa' ? 'activa' : '') + '">Empresa</button>' +
                  '<button type="button" data-ambito="personal" class="' + (datos.ambito === 'personal' ? 'activa' : '') + '">Personal</button>' +
                '</div>'
              : '') +

            '<div class="pre-campo-grupo ancho-total">' +
              '<label id="plf-etiqueta-contacto"></label>' +
              '<button type="button" class="campo-contacto-btn" id="plf-contacto"></button>' +
              '<p class="pl-nota-campo">Opcional. Al usar la plantilla viene ya elegido, y se puede cambiar.</p>' +
            '</div>' +

            plCampo('concepto', 'Concepto', datos.concepto, { textarea: tipo !== 'apunte', anchoTotal: true, requerido: tipo !== 'presupuesto' }) +
            (tipo !== 'apunte'
              ? plCampo('descripcion', 'Descripción (una línea por punto)', datos.descripcion, { textarea: true, anchoTotal: true,
                  nota: 'Pasa al ' + (tipo === 'presupuesto' ? 'presupuesto' : 'factura') + ' y a su PDF, igual que ahora.' })
              : '') +
            plCampo('detalles', 'Detalles del trabajo', datos.detalles, { textarea: true, grande: true, anchoTotal: true,
              nota: 'Solo para ti: se ven al abrir la plantilla y no pasan a ningún documento.' }) +

            plCampo('importe', etiquetaImporte, datos.importe, { numero: true, requerido: true, anchoTotal: tipo === 'apunte' }) +

            (tipo !== 'apunte'
              ? '<div class="pre-campo-grupo">' +
                  '<label for="plf-desc_valor">Descuento especial</label>' +
                  '<div class="pre-fila-doble">' +
                    '<select class="campo pre-descuento-tipo" id="plf-desc_tipo">' +
                      '<option value="percent"' + (datos.desc_tipo === 'percent' ? ' selected' : '') + '>Porcentaje</option>' +
                      '<option value="fixed"' + (datos.desc_tipo === 'fixed' ? ' selected' : '') + '>Euros</option>' +
                    '</select>' +
                    '<input class="campo" id="plf-desc_valor" type="text" data-numero="1" inputmode="decimal" value="' + escaparHtml(String(datos.desc_valor)) + '">' +
                  '</div>' +
                '</div>'
              : '') +

            '<div id="plf-grupo-impuestos" class="pre-form-grid dos-columnas" style="grid-column:1/-1;margin:0">' +
              plSelect('iva_pct', 'IVA', plOpcionesPorcentaje(tiposIva, datos.iva_pct, tipo === 'apunte', 'Sin IVA'), String(datos.iva_pct)) +
              plSelect('irpf_pct', 'IRPF', plOpcionesPorcentaje(tiposIrpf, datos.irpf_pct, tipo === 'apunte', 'Sin IRPF'), String(datos.irpf_pct)) +
            '</div>' +
            (tipo === 'apunte'
              ? '<p class="pre-aviso" id="plf-aviso-personal" hidden>Un movimiento personal no lleva impuestos: el total se guarda tal cual, como base.</p>'
              : '') +
          '</div>' +

          '<div class="pre-bloque" id="plf-resumen"></div>' +
        '</form>' +
      '</div>' +

      '<div class="pre-modal-pie">' +
        '<button type="button" class="boton-secundario" id="plf-cancelar">Cancelar</button>' +
        '<button type="submit" form="plf-form" class="boton-principal">Guardar plantilla</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(fondo);

  // ---- NO se cierra al tocar fuera ----
  fondo.querySelector('.pre-modal-cerrar').addEventListener('click', function () { fondo.remove(); });
  fondo.querySelector('#plf-cancelar').addEventListener('click', function () { fondo.remove(); });

  // ---- Icono ----
  const campoIcono = fondo.querySelector('#plf-icono');
  function pintarIcono() {
    const idIcono = campoIcono.dataset.icono;
    campoIcono.innerHTML = htmlIconoPlantilla(idIcono, 32) +
      '<span>' + escaparHtml(idIcono ? tituloIconoPlantilla(idIcono) : 'Sin icono') + ' — toca para cambiarlo</span>';
  }
  campoIcono.addEventListener('click', async function () {
    const elegido = await abrirSelectorIcono(campoIcono.dataset.icono, CATALOGO_ICONOS_PLANTILLA);
    if (!elegido) return;
    campoIcono.dataset.icono = elegido;
    pintarIcono();
  });
  pintarIcono();

  // ---- Contacto habitual ----
  const botonContacto = fondo.querySelector('#plf-contacto');
  function pintarContacto() {
    const lista = plContactosDisponibles(tipo, datos.tipo);
    if (datos.id_contacto && !lista.some(function (c) { return String(c.id) === String(datos.id_contacto); })) {
      // Ya no está disponible (borrado, inactivo o de otro rol).
      datos.id_contacto = '';
    }
    const c = lista.find(function (x) { return String(x.id) === String(datos.id_contacto); });
    let texto = c ? c.nombre_contacto : '';
    if (!texto && datos.contacto_libre) texto = datos.contacto_libre + ' (sin registrar)';
    fondo.querySelector('#plf-etiqueta-contacto').textContent = tipo === 'apunte'
      ? (datos.tipo === 'ingreso' ? 'Cliente habitual' : 'Proveedor habitual')
      : 'Cliente habitual';
    botonContacto.innerHTML =
      '<span class="campo-contacto-valor' + (texto ? '' : ' vacio') + '">' + escaparHtml(texto || 'Sin contacto') + '</span>' +
      '<i class="ti ti-chevron-down"></i>';
  }
  botonContacto.addEventListener('click', function () {
    abrirSelectorContacto(plContactosDisponibles(tipo, datos.tipo), datos.id_contacto, {
      permitirLibre: tipo === 'apunte',
      etiquetaLibre: 'nombre de ' + (datos.tipo === 'ingreso' ? 'cliente' : 'proveedor')
    }).then(function (resultado) {
      if (resultado === null) return;
      if (resultado && typeof resultado === 'object' && 'libre' in resultado) {
        datos.id_contacto = '';
        datos.contacto_libre = resultado.libre;
      } else {
        datos.id_contacto = String(resultado || '');
        datos.contacto_libre = '';
      }
      pintarContacto();
      actualizar();
    });
  });

  // ---- Tipo y ámbito (solo apuntes) ----
  if (tipo === 'apunte') {
    fondo.querySelectorAll('#plf-selector-tipo [data-tipo]').forEach(function (b) {
      b.addEventListener('click', function () {
        datos.tipo = b.dataset.tipo;
        fondo.querySelectorAll('#plf-selector-tipo button').forEach(function (x) { x.className = ''; });
        b.className = 'activa ' + b.dataset.tipo;
        pintarContacto();
        actualizar();
      });
    });
    fondo.querySelectorAll('#plf-selector-ambito [data-ambito]').forEach(function (b) {
      b.addEventListener('click', function () {
        datos.ambito = b.dataset.ambito;
        fondo.querySelectorAll('#plf-selector-ambito button').forEach(function (x) { x.className = ''; });
        b.className = 'activa';
        actualizar();
      });
    });
  }

  // ---- Lectura y resumen en vivo ----
  function valor(clave) {
    const el = fondo.querySelector('#plf-' + clave);
    return el ? el.value : '';
  }

  function leer() {
    const esPersonal = tipo === 'apunte' && datos.ambito === 'personal';
    const registro = {
      id: original ? original.id : null,
      nombre: valor('nombre').trim(),
      icono: campoIcono.dataset.icono || '',
      concepto: valor('concepto').trim(),
      detalles: valor('detalles').trim(),
      iva_pct: esPersonal ? 0 : parsearNumero(valor('iva_pct')),
      irpf_pct: esPersonal ? 0 : parsearNumero(valor('irpf_pct'))
    };
    const importe = roundMoney(parsearNumero(valor('importe')));
    // El id del contacto se guarda tal cual lo tiene su ficha (número),
    // como en el resto de hojas, no convertido a texto.
    const contacto = plContactoPorId(datos.id_contacto);
    const idContacto = contacto ? contacto.id : '';
    if (tipo === 'apunte') {
      Object.assign(registro, {
        tipo: datos.tipo,
        ambito: datos.ambito,
        id_contacto: idContacto,
        contacto_libre: idContacto !== '' ? '' : (datos.contacto_libre || ''),
        total: importe
      });
    } else {
      Object.assign(registro, {
        id_cliente: idContacto,
        descripcion: valor('descripcion').trim(),
        descuento_especial_tipo: valor('desc_tipo') === 'fixed' ? 'fixed' : 'percent',
        descuento_especial_valor: roundMoney(parsearNumero(valor('desc_valor')))
      });
      if (tipo === 'presupuesto') registro.subtotal = importe;
      else registro.importe = importe;
    }
    return registro;
  }

  function actualizar() {
    const r = leer();
    if (tipo === 'apunte') {
      const esPersonal = datos.ambito === 'personal';
      fondo.querySelector('#plf-grupo-impuestos').style.display = esPersonal ? 'none' : 'grid';
      fondo.querySelector('#plf-aviso-personal').hidden = !esPersonal;
    }
    const t = plCalcular(tipo, r, tipo === 'apunte' ? r.id_contacto : r.id_cliente);
    fondo.querySelector('#plf-resumen').innerHTML = plResumenHtml(tipo, r, t) +
      (tipo === 'presupuesto'
        ? '<p class="pl-nota-campo" style="margin-top:8px">Precio con el ajuste ' +
          (r.id_cliente ? 'del cliente habitual' : 'del tipo de cliente por defecto') +
          '. Al crear el presupuesto se aplica el del cliente que elijas.</p>'
        : '');
  }

  fondo.querySelectorAll('#plf-form input, #plf-form select, #plf-form textarea').forEach(function (el) {
    el.addEventListener('input', actualizar);
    el.addEventListener('change', actualizar);
  });

  pintarContacto();
  actualizar();

  // ---- Guardar ----
  fondo.querySelector('#plf-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    fondo.querySelectorAll('.pre-campo-error').forEach(function (el) { el.classList.remove('pre-campo-error'); });
    fondo.querySelectorAll('[data-error-de]').forEach(function (el) { el.hidden = true; });
    const error = function (campo, texto) {
      const input = fondo.querySelector('#plf-' + campo);
      const p = fondo.querySelector('[data-error-de="' + campo + '"]');
      if (input) input.classList.add('pre-campo-error');
      if (p) { p.textContent = texto; p.hidden = false; }
    };

    const r = leer();
    let valido = true;
    if (!r.nombre) { error('nombre', 'Ponle un nombre para reconocerla.'); valido = false; }
    if (tipo !== 'presupuesto' && !r.concepto) { error('concepto', 'Escribe el concepto.'); valido = false; }
    const importe = tipo === 'presupuesto' ? r.subtotal : (tipo === 'factura' ? r.importe : r.total);
    if (!(importe > 0)) { error('importe', 'Escribe el importe.'); valido = false; }
    if (!valido) return;
    if (!puedeEscribir()) return;

    if (!r.id) r.id = plNuevoId(info.prefijo);

    // La ventana se cierra AL MOMENTO; el guardado sigue en segundo
    // plano (GUÍA 9).
    fondo.remove();
    plGuardarEnSegundoPlano(tipo, r, snapshot || null);

    if (typeof o.alGuardar === 'function') o.alGuardar(r);
    if (o.avisarAlGuardar) plAvisarGuardadaFuera(tipo, r);
  });

  setTimeout(function () { const n = fondo.querySelector('#plf-nombre'); if (n && !n.value) n.focus(); }, 50);
}

// Guarda la plantilla y, si lo hay, su desglose de la Calculadora, a la
// vez (mismo mecanismo que un presupuesto y su desglose).
function plGuardarEnSegundoPlano(tipo, registro, detalle) {
  plVista = tipo;
  return Promise.all([
    guardarRegistro(PL_TIPOS[tipo].entidad, registro, plRepintar, null),
    detalle ? preGuardarDetalle(registro.id, detalle) : Promise.resolve()
  ]).then(function () { plRepintar(); });
}

// Cuando se guarda una plantilla desde otra sección (Calculadora, o el
// menú de un presupuesto, factura o apunte), se avisa y se ofrece ir.
function plAvisarGuardadaFuera(tipo, registro) {
  mostrarDialogoOpciones('Plantilla guardada',
    'Guardada la plantilla «' + registro.nombre + '». La tienes en Plantillas → ' + PL_TIPOS[tipo].selector + '.',
    [
      { id: 'ir', texto: 'Ir a Plantillas', tipo: 'principal' },
      { id: 'cerrar', texto: 'Seguir aquí' }
    ]
  ).then(function (eleccion) {
    if (eleccion !== 'ir') return;
    plVista = tipo;
    cambiarVista('plantillas');
  });
}

// ============================================================
// 8. "GUARDAR COMO PLANTILLA" DESDE OTRAS SECCIONES
// ============================================================
// Se llaman desde el menú de tres puntos de Presupuestos, Facturas de
// venta y Contabilidad. Rellenan el formulario de plantilla con los
// datos del documento; nada del documento original se toca.

function plDesdePresupuesto(idPresupuesto) {
  const p = estado.presupuestos.find(function (x) { return String(x.id) === String(idPresupuesto); });
  if (!p) return;
  const d = preDetalleDe(idPresupuesto);
  let snapshot = null;
  if (d) {
    snapshot = Object.assign({}, d);
    delete snapshot.id;
    delete snapshot.id_presupuesto;
  }
  // Se guarda el SUBTOTAL (antes de ajustes): el ajuste del tipo de
  // cliente se vuelve a aplicar al usar la plantilla.
  plAbrirFormulario('presupuesto', null, {
    nombre: String(p.concepto || '').slice(0, 60),
    id_cliente: p.id_cliente || '',
    concepto: p.concepto || '',
    descripcion: p.descripcion || '',
    subtotal: parsearNumero(p.subtotal),
    descuento_especial_tipo: p.descuento_especial_tipo,
    descuento_especial_valor: parsearNumero(p.descuento_especial_valor),
    iva_pct: parsearNumero(p.iva_pct),
    irpf_pct: parsearNumero(p.irpf_pct)
  }, snapshot, { avisarAlGuardar: true });
}

function plDesdeFactura(idFactura) {
  const f = estado.ventas.find(function (x) { return String(x.id) === String(idFactura); });
  if (!f) return;
  // Importe ANTES del descuento, igual que el formulario de facturas.
  plAbrirFormulario('factura', null, {
    nombre: String(f.concepto || '').slice(0, 60),
    id_cliente: f.id_cliente || '',
    concepto: f.concepto || '',
    descripcion: f.descripcion || '',
    importe: fvImporteAntesDeDescuento(f),
    descuento_especial_tipo: f.descuento_especial_tipo,
    descuento_especial_valor: parsearNumero(f.descuento_especial_valor),
    iva_pct: parsearNumero(f.iva_pct),
    irpf_pct: parsearNumero(f.irpf_pct)
  }, null, { avisarAlGuardar: true });
}

function plDesdeApunte(idApunte) {
  const a = estado.apuntes.find(function (x) { return String(x.id) === String(idApunte); });
  if (!a) return;
  plAbrirFormulario('apunte', null, {
    nombre: String(a.concepto || '').slice(0, 60),
    tipo: a.tipo,
    ambito: a.ambito,
    id_contacto: a.id_contacto || '',
    contacto_libre: a.contacto_libre || '',
    concepto: a.concepto || '',
    total: parsearNumero(a.total),
    iva_pct: parsearNumero(a.iva_pct),
    irpf_pct: parsearNumero(a.irpf_pct)
  }, null, { avisarAlGuardar: true });
}

// ============================================================
// 9. REGISTRO COMO VISTA
// ============================================================

registrarVista('plantillas', {
  titulo: 'Plantillas',
  pintar: pintarPlantillas
});
