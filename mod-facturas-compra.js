/**
 * MÓDULO FACTURAS DE COMPRA
 * ------------------------------------------------------------
 * Comparte pantalla con Facturas de venta: el selector Ventas/Compras
 * y el botón "+" viven en mod-facturas-venta.js, que llama aquí cuando
 * el área activa es "compras". Este módulo pinta dentro de #fv-zona.
 *
 * Diferencias con ventas (mapa 10.1):
 * - No tiene líneas: la base imponible se escribe directamente.
 * - No tiene numeración automática: el número lo pone el proveedor y
 *   lo escribe Miguel. Es obligatorio.
 * - No tiene ajuste de tipo de cliente ni compensación de IRPF.
 * - No genera PDF.
 * - Todo en minúscula (decisión I3).
 *
 * Decisiones tomadas en esta sesión (03/09/2026):
 * - IVA e IRPF: desplegable con los tipos de Configuración MÁS la
 *   opción "Otro...", que abre un campo para escribir el porcentaje a
 *   mano. Una factura de proveedor puede traer cualquier tipo.
 * - Número repetido con el MISMO proveedor: avisa, pero deja guardar.
 * - Concepto obligatorio, igual que en ventas.
 */

// ============================================================
// 0. ESTADO PROPIO DEL MÓDULO
// ============================================================

let fcFiltroEstado = 'todos';      // 'todos' | 'pendiente' | 'pagada'
let fcFiltroRegistro = 'activas';  // 'activas' | 'todas' | 'inactivas'
let fcOrden = 'fecha-desc';
let fcBusqueda = '';

const fcSyncEstados = {};
const fcPendientes = {};

function fcMarcarSync(id, valor) {
  if (!id) return;
  if (valor) fcSyncEstados[String(id)] = valor;
  else delete fcSyncEstados[String(id)];
}

function fcEstadoSync(f) {
  const marcado = fcSyncEstados[String(f.id)];
  if (marcado) return marcado;
  if (esDePrueba(f)) return 'prueba';
  return 'ok';
}

function fcPuntoEstado(f) {
  const info = FV_PUNTOS[fcEstadoSync(f)] || FV_PUNTOS.ok;
  return '<span class="fv-punto ' + info.clase + '" title="' + escaparHtml(info.titulo) + '"></span>';
}

// Mismas etiquetas que ventas, pero "pagada" aquí significa que la has
// pagado tú al proveedor.
const FC_ESTADOS = {
  pendiente: { etiqueta: 'Pendiente', clase: 'ind-ambar' },
  pagada:    { etiqueta: 'Pagada',    clase: 'ind-verde' }
};

function fcPastillaEstado(valor) {
  const info = FC_ESTADOS[String(valor)] || FC_ESTADOS.pendiente;
  return '<span class="pastilla ' + info.clase + '">' + info.etiqueta + '</span>';
}

// ============================================================
// 1. UTILIDADES
// ============================================================

function fcNuevoId(prefijo) {
  if (estado.modoPrueba) return generarIdPrueba(prefijo);
  return prefijo + '-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e9).toString(36);
}

function fcEstaActiva(f) {
  return String(f.estado_registro || 'activo').toLowerCase() !== 'inactivo';
}

// Contactos que pueden ser proveedor (mapa 10.3).
function fcProveedoresDisponibles() {
  return estado.clientes.filter(function (c) {
    if (c.estado !== 'activo') return false;
    if (c.rol !== 'proveedor' && c.rol !== 'ambos') return false;
    if (!estado.modoPrueba && esDePrueba(c)) return false;
    return true;
  }).sort(function (a, b) {
    return (a.nombre_contacto || '').localeCompare(b.nombre_contacto || '', 'es');
  });
}

function fcTextoBusqueda(f) {
  return normalizarBusqueda([
    f.numero, f.proveedor, f.nif, f.concepto, mostrarFecha(f.fecha), f.estado,
    formatMoney(f.total), formatMoney(f.base)
  ].filter(Boolean).join(' '));
}

// Aviso de número repetido: solo cuenta si es el MISMO proveedor
// (dos proveedores distintos pueden usar el mismo número, cada uno
// lleva su propia serie). Se excluye la factura que se está editando.
function fcNumeroRepetido(numero, idProveedor, idActual) {
  const limpio = String(numero || '').trim().toLowerCase();
  if (!limpio) return null;
  return estado.compras.find(function (f) {
    if (idActual && String(f.id) === String(idActual)) return false;
    if (String(f.id_proveedor || '') !== String(idProveedor || '')) return false;
    return String(f.numero || '').trim().toLowerCase() === limpio;
  }) || null;
}

// ============================================================
// 2. CÁLCULO 🔒 (mapa 10.2)
// ============================================================
// Directo, sin ajuste de cliente ni compensación de IRPF:
//   iva   = base × (ivaPct / 100)
//   irpf  = base × (irpfPct / 100)
//   total = base + iva − irpf

function fcCalcularTotales(base, ivaPct, irpfPct) {
  const b = roundMoney(parsearNumero(base));
  const pIva = parsearNumero(ivaPct);
  const pIrpf = parsearNumero(irpfPct);
  const iva = roundMoney(b * (pIva / 100));
  const irpf = roundMoney(b * (pIrpf / 100));
  return {
    base: b,
    ivaPct: pIva,
    iva: iva,
    irpfPct: pIrpf,
    irpf: irpf,
    total: roundMoney(b + iva - irpf)
  };
}

// ============================================================
// 3. LISTA
// ============================================================

function pintarFacturasCompra() {
  const zona = document.getElementById('fv-zona');
  if (!zona) return;

  zona.innerHTML =
    '<div class="fv-barra" style="position:relative">' +
      '<input type="text" class="fv-buscador" id="fc-buscador" placeholder="Buscar..." value="' + escaparHtml(fcBusqueda) + '">' +
      '<button type="button" class="fv-btn-filtro' + ((fcFiltroEstado !== 'todos' || fcFiltroRegistro !== 'activas') ? ' con-filtro' : '') + '" id="fc-btn-filtro"><i class="ti ti-filter"></i></button>' +
      fcRenderFiltrosPanel() +
    '</div>' +
    '<div id="fc-lista-contenedor"></div>';

  fcCablearBarra();
  fcRepintarLista();
}

function fcRenderFiltrosPanel() {
  const estados = [['todos', 'Todos'], ['pendiente', 'Pendientes'], ['pagada', 'Pagadas']];
  const registros = [['activas', 'Activas'], ['todas', 'Todas'], ['inactivas', 'Inactivas']];
  const ordenes = [
    ['fecha-desc', 'Fecha (más nuevo primero)'],
    ['fecha-asc', 'Fecha (más antiguo primero)'],
    ['total-desc', 'Importe (mayor primero)']
  ];

  return '<div class="fv-filtros-panel" id="fc-filtros-panel">' +
    '<p class="fv-filtros-titulo">Estado</p>' +
    estados.map(function (op) {
      return '<button type="button" data-estado="' + op[0] + '"' +
        (op[0] === fcFiltroEstado ? ' class="activa"' : '') + '>' + escaparHtml(op[1]) + '</button>';
    }).join('') +
    '<p class="fv-filtros-titulo">Registro</p>' +
    registros.map(function (op) {
      return '<button type="button" data-registro="' + op[0] + '"' +
        (op[0] === fcFiltroRegistro ? ' class="activa"' : '') + '>' + escaparHtml(op[1]) + '</button>';
    }).join('') +
    '<p class="fv-filtros-titulo">Ordenar por</p>' +
    ordenes.map(function (op) {
      return '<button type="button" data-orden="' + op[0] + '"' +
        (op[0] === fcOrden ? ' class="activa"' : '') + '>' + escaparHtml(op[1]) + '</button>';
    }).join('') +
    '</div>';
}

function fcCablearBarra() {
  const buscador = document.getElementById('fc-buscador');
  buscador.addEventListener('input', function () {
    fcBusqueda = buscador.value;
    fcRepintarLista();
  });

  const btnFiltro = document.getElementById('fc-btn-filtro');
  const panel = document.getElementById('fc-filtros-panel');

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
    b.addEventListener('click', function () { fcFiltroEstado = b.dataset.estado; pintarFacturasCompra(); });
  });
  panel.querySelectorAll('[data-registro]').forEach(function (b) {
    b.addEventListener('click', function () { fcFiltroRegistro = b.dataset.registro; pintarFacturasCompra(); });
  });
  panel.querySelectorAll('[data-orden]').forEach(function (b) {
    b.addEventListener('click', function () { fcOrden = b.dataset.orden; pintarFacturasCompra(); });
  });
}

function fcListaFiltrada() {
  const texto = normalizarBusqueda(fcBusqueda);
  return estado.compras.filter(function (f) {
    if (fcFiltroEstado !== 'todos' && String(f.estado) !== fcFiltroEstado) return false;
    if (fcFiltroRegistro === 'activas' && !fcEstaActiva(f)) return false;
    if (fcFiltroRegistro === 'inactivas' && fcEstaActiva(f)) return false;
    if (texto && fcTextoBusqueda(f).indexOf(texto) === -1) return false;
    return true;
  }).sort(function (a, b) {
    return compararRegistros(a, b, fcOrden);
  });
}

function fcRepintarLista() {
  const contenedor = document.getElementById('fc-lista-contenedor');
  if (!contenedor) return;
  const lista = fcListaFiltrada();

  if (lista.length === 0) {
    contenedor.innerHTML = '<p class="fv-vacio">' +
      (fcBusqueda || fcFiltroEstado !== 'todos' || fcFiltroRegistro !== 'activas'
        ? 'No hay resultados con estos filtros.'
        : 'Todavía no hay facturas de compra.') +
      '</p>';
    return;
  }

  contenedor.innerHTML =
    '<div class="fv-lista-movil">' + lista.map(fcRenderFilaMovil).join('') + '</div>' +
    '<div class="fv-tabla-wrap"><table class="fv-tabla"><thead><tr>' +
      '<th>Fecha</th><th>Número</th><th>Proveedor</th><th>Concepto</th>' +
      '<th class="fv-celda-derecha">Base</th><th class="fv-celda-derecha">Total</th><th></th>' +
    '</tr></thead><tbody>' + lista.map(fcRenderFilaTabla).join('') + '</tbody></table></div>';

  fcCablearFilas(contenedor);
}

function fcRenderFilaMovil(f) {
  const inactiva = !fcEstaActiva(f);
  return '<div class="fv-fila' + (inactiva ? ' fv-fila-inactiva' : '') + '" data-id="' + escaparHtml(f.id) + '">' +
    '<div class="fv-avatar">' + escaparHtml(fvIniciales(f.proveedor)) + '</div>' +
    '<div class="fv-info">' +
      '<p class="fv-nombre">' + escaparHtml(f.proveedor || '—') + '</p>' +
      '<p class="fv-meta">' + escaparHtml(f.numero || '—') + ' · ' + escaparHtml(mostrarFecha(f.fecha)) + (inactiva ? ' · Inactiva' : '') + '</p>' +
      '<p class="fv-meta">' + escaparHtml(f.concepto || '—') + '</p>' +
    '</div>' +
    '<div class="fv-derecha">' +
      '<span class="fv-total-fila">' + escaparHtml(formatMoney(f.total)) + '</span>' +
      '<button type="button" class="fv-pastilla-boton" data-estado-de="' + escaparHtml(f.id) + '">' +
        fcPastillaEstado(f.estado) +
      '</button>' +
    '</div>' +
    '<div class="fv-control">' +
      '<button type="button" class="fv-btn-icono" data-mas="' + escaparHtml(f.id) + '" aria-label="Más opciones"><i class="ti ti-dots-vertical"></i></button>' +
      fcPuntoEstado(f) +
    '</div>' +
  '</div>';
}

function fcRenderFilaTabla(f) {
  const inactiva = !fcEstaActiva(f);
  return '<tr class="fv-fila-tabla' + (inactiva ? ' fv-fila-inactiva' : '') + '" data-id="' + escaparHtml(f.id) + '">' +
    '<td>' + escaparHtml(mostrarFecha(f.fecha)) + '</td>' +
    '<td class="fv-celda-numero">' + escaparHtml(f.numero || '—') + (inactiva ? ' <span style="color:var(--texto-secundario);font-weight:400">(inactiva)</span>' : '') + '</td>' +
    '<td>' + escaparHtml(f.proveedor || '—') + '</td>' +
    '<td class="fv-celda-concepto">' +
      '<div class="fv-concepto-texto">' + escaparHtml(f.concepto || '—') + '</div>' +
      '<button type="button" data-estado-de="' + escaparHtml(f.id) + '" style="border:none;background:none;padding:4px 0 0;cursor:pointer">' +
        fcPastillaEstado(f.estado) +
      '</button>' +
    '</td>' +
    '<td class="fv-celda-derecha">' + escaparHtml(formatMoney(f.base)) + '</td>' +
    '<td class="fv-celda-derecha">' + escaparHtml(formatMoney(f.total)) + '</td>' +
    '<td><div class="fv-control">' +
      '<button type="button" class="fv-btn-icono" data-mas="' + escaparHtml(f.id) + '" aria-label="Más opciones"><i class="ti ti-dots-vertical"></i></button>' +
      fcPuntoEstado(f) +
    '</div></td>' +
  '</tr>';
}

function fcCablearFilas(contenedor) {
  contenedor.querySelectorAll('.fv-fila, .fv-fila-tabla').forEach(function (fila) {
    fila.addEventListener('click', function (ev) {
      if (ev.target.closest('.fv-control')) return;
      if (ev.target.closest('[data-estado-de]')) return;
      abrirFichaFacturaCompra(fila.dataset.id);
    });
  });

  contenedor.querySelectorAll('[data-mas]').forEach(function (b) {
    b.addEventListener('click', function (ev) {
      ev.stopPropagation();
      fcAbrirMenuMas(b, b.dataset.mas);
    });
  });

  contenedor.querySelectorAll('[data-estado-de]').forEach(function (b) {
    b.addEventListener('click', function (ev) {
      ev.stopPropagation();
      fcCambiarPago(b.dataset.estadoDe);
    });
  });
}

// ============================================================
// 4. MENÚ "MÁS OPCIONES" Y ACCIONES
// ============================================================

function fcAbrirMenuMas(boton, id) {
  document.querySelectorAll('.fv-menu-mas').forEach(function (m) { m.remove(); });

  const f = estado.compras.find(function (x) { return String(x.id) === String(id); });
  if (!f) return;

  const activa = fcEstaActiva(f);

  const menu = document.createElement('div');
  menu.className = 'fv-menu-mas';
  menu.innerHTML =
    (fcEstadoSync(f) === 'error'
      ? '<button type="button" class="destacado" data-accion="reintentar">Reintentar guardado</button>'
      : '') +
    (activa ? '<button type="button" data-accion="editar">Editar</button>' : '') +
    (activa ? '<button type="button" data-accion="pago">Marcar como ' + (String(f.estado) === 'pagada' ? 'pendiente' : 'pagada') + '</button>' : '') +
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

  menu.querySelector('[data-accion="reintentar"]')?.addEventListener('click', function () { cerrarMenu(); fcReintentarGuardado(id); });
  menu.querySelector('[data-accion="editar"]')?.addEventListener('click', function () { cerrarMenu(); abrirFormularioFacturaCompra(id); });
  menu.querySelector('[data-accion="pago"]')?.addEventListener('click', function () { cerrarMenu(); fcCambiarPago(id); });
  menu.querySelector('[data-accion="desactivar"]')?.addEventListener('click', function () { cerrarMenu(); fcDesactivar(id); });
  menu.querySelector('[data-accion="reactivar"]')?.addEventListener('click', function () { cerrarMenu(); fcReactivar(id); });

  setTimeout(function () { document.addEventListener('click', cerrarSiFuera); }, 0);
}

// Marcar Pagada/Pendiente (mapa 10.4). Igual que ventas, pero el
// apunte es de tipo "gasto" y usa fecha_pago.
async function fcCambiarPago(id) {
  const f = estado.compras.find(function (x) { return String(x.id) === String(id); });
  if (!f) return;
  if (!fcEstaActiva(f)) {
    alert('Esta factura está desactivada. Reactívala primero para poder cambiar su estado de pago.');
    return;
  }

  const pasaAPagada = String(f.estado) !== 'pagada';
  const eleccion = await mostrarDialogoOpciones(
    'Estado de pago',
    'Factura ' + (f.numero || '') + ' — ' + (f.proveedor || '') + '. ' +
      (pasaAPagada ? '¿Marcar como pagada hoy?' : '¿Marcar como pendiente? Se borrará el apunte de tesorería asociado.'),
    [
      { id: 'confirmar', texto: pasaAPagada ? 'Marcar como pagada' : 'Marcar como pendiente', tipo: 'principal' },
      { id: 'cancelar', texto: 'Cancelar' }
    ]
  );
  if (eleccion !== 'confirmar') return;

  if (!puedeEscribir()) return;

  fcMarcarSync(id, 'guardando');
  fcRepintarLista();

  const registro = pasaAPagada
    ? Object.assign({}, f, { estado: 'pagada', fecha_pago: fechaHoyISO() })
    : Object.assign({}, f, { estado: 'pendiente', fecha_pago: '' });

  const resultado = await guardarRegistro('compras', registro, fcRepintarLista, null);
  if (resultado.status !== 'success') {
    fcMarcarSync(id, 'error');
    fcPendientes[String(id)] = { registro: registro };
    fcRepintarLista();
    return;
  }
  fcMarcarSync(id, null);
  delete fcPendientes[String(id)];

  if (pasaAPagada) {
    await fcCrearApuntePago(registro);
  } else {
    await fcBorrarApuntePago(registro.id);
  }
  fcRepintarLista();
}

async function fcDesactivar(id) {
  const f = estado.compras.find(function (x) { return String(x.id) === String(id); });
  if (!f) return;
  if (!confirm('¿Desactivar la factura ' + (f.numero || '') + '?\n\nLa factura no se borra: queda guardada pero deja de contar como activa, y no entrará en los cálculos de impuestos.')) return;
  if (!puedeEscribir()) return;

  fcMarcarSync(id, 'guardando');
  fcRepintarLista();

  const registro = Object.assign({}, f, { estado_registro: 'inactivo' });
  const resultado = await guardarRegistro('compras', registro, fcRepintarLista, null);
  if (resultado.status !== 'success') {
    fcMarcarSync(id, 'error');
    fcPendientes[String(id)] = { registro: registro };
    fcRepintarLista();
    return;
  }
  fcMarcarSync(id, null);
  delete fcPendientes[String(id)];

  if (String(f.estado) === 'pagada') {
    await fcBorrarApuntePago(id);
  }
  fcRepintarLista();
}

async function fcReactivar(id) {
  const f = estado.compras.find(function (x) { return String(x.id) === String(id); });
  if (!f) return;
  if (!confirm('¿Reactivar la factura ' + (f.numero || '') + '?')) return;
  if (!puedeEscribir()) return;

  fcMarcarSync(id, 'guardando');
  fcRepintarLista();

  const registro = Object.assign({}, f, { estado_registro: 'activo' });
  const resultado = await guardarRegistro('compras', registro, fcRepintarLista, null);
  if (resultado.status !== 'success') {
    fcMarcarSync(id, 'error');
    fcPendientes[String(id)] = { registro: registro };
    fcRepintarLista();
    return;
  }
  fcMarcarSync(id, null);
  delete fcPendientes[String(id)];

  if (String(f.estado) === 'pagada') {
    await fcCrearApuntePago(registro);
  }
  fcRepintarLista();
}

function fcReintentarGuardado(id) {
  const pendiente = fcPendientes[String(id)];
  const registro = pendiente
    ? pendiente.registro
    : estado.compras.find(function (x) { return String(x.id) === String(id); });
  if (!registro) return;

  fcMarcarSync(id, 'guardando');
  fcRepintarLista();

  fcGuardarEnSegundoPlano(registro);
}

// ============================================================
// 4.1 APUNTE DE TESORERÍA AL PAGAR (mapa 10.4 y 11) 🔒
// ============================================================

function fcApunteDe(idFactura) {
  return estado.apuntes.find(function (a) {
    return String(a.id_factura_compra || '') === String(idFactura);
  }) || null;
}

async function fcCrearApuntePago(factura) {
  const existente = fcApunteDe(factura.id);
  const fecha = factura.fecha_pago || fechaHoyISO();
  const registro = {
    id: existente ? existente.id : fcNuevoId('apu'),
    ambito: 'empresa',
    tipo: 'gasto',
    fecha: fecha,
    concepto: 'Pago factura ' + (factura.numero || ''),
    base: parsearNumero(factura.base),
    iva_pct: parsearNumero(factura.iva_pct),
    iva: parsearNumero(factura.iva),
    irpf_pct: parsearNumero(factura.irpf_pct),
    irpf: parsearNumero(factura.irpf),
    total: parsearNumero(factura.total),
    impuesto_tipo: fvTipoImpuestoApunte(factura.iva, factura.irpf),
    impuesto_trimestre: fvTrimestreDeFecha(fecha),
    impuesto_año: fecha ? parseInt(fecha.split('-')[0], 10) : new Date().getFullYear(),
    id_factura_venta: '',
    id_factura_compra: factura.id,
    id_impuesto: '',
    impuesto_pago: '',
    id_contacto: factura.id_proveedor || ''
  };
  await guardarRegistro('apuntes', registro, null, null);
}

async function fcBorrarApuntePago(idFactura) {
  const apunte = fcApunteDe(idFactura);
  if (!apunte) return;
  await borrarRegistro('apuntes', apunte.id, null, null);
}

// ============================================================
// 5. FICHA DE DETALLE (solo lectura — sí se cierra al tocar fuera)
// ============================================================

function abrirFichaFacturaCompra(id) {
  const f = estado.compras.find(function (x) { return String(x.id) === String(id); });
  if (!f) return;

  const activa = fcEstaActiva(f);

  const fondo = document.createElement('div');
  fondo.className = 'fv-modal-fondo';
  fondo.innerHTML =
    '<div class="fv-modal">' +
      '<div class="fv-modal-cabecera">' +
        '<div class="fv-modal-avatar">' + escaparHtml(fvIniciales(f.proveedor)) + '</div>' +
        '<div class="fv-modal-texto">' +
          '<p class="fv-modal-titulo">' + escaparHtml(f.numero || 'Factura') + (activa ? '' : ' · Inactiva') + '</p>' +
          '<p class="fv-modal-subtitulo">' + escaparHtml(f.proveedor || '—') + ' · ' + escaparHtml(mostrarFecha(f.fecha)) + '</p>' +
        '</div>' +
        fcPastillaEstado(f.estado) +
        '<button type="button" class="fv-modal-cerrar" aria-label="Cerrar"><i class="ti ti-x"></i></button>' +
      '</div>' +

      '<div class="fv-modal-cuerpo">' +
        '<div class="fv-ficha-dato"><span>Proveedor</span><span>' + escaparHtml(f.proveedor || '—') + '</span></div>' +
        '<div class="fv-ficha-dato"><span>NIF</span><span>' + escaparHtml(f.nif || '—') + '</span></div>' +
        '<div class="fv-ficha-dato"><span>Fecha</span><span>' + escaparHtml(mostrarFecha(f.fecha)) + '</span></div>' +
        '<div class="fv-ficha-dato"><span>Concepto</span><span>' + escaparHtml(f.concepto || '—') + '</span></div>' +
        (String(f.estado) === 'pagada'
          ? '<div class="fv-ficha-dato"><span>Fecha de pago</span><span>' + escaparHtml(mostrarFecha(f.fecha_pago)) + '</span></div>'
          : '') +

        '<div class="fv-bloque">' +
          '<p class="fv-bloque-titulo">Resumen económico</p>' +
          fvLinea('Base imponible', formatMoney(f.base)) +
          fvLinea('IVA (' + parsearNumero(f.iva_pct) + '%)', '+' + formatMoney(f.iva)) +
          fvLinea('Retención IRPF (' + parsearNumero(f.irpf_pct) + '%)', '−' + formatMoney(f.irpf)) +
          '<div class="fv-total-final"><span>TOTAL</span><strong>' + escaparHtml(formatMoney(f.total)) + '</strong></div>' +
        '</div>' +
      '</div>' +

      (activa
        ? '<div class="fv-modal-pie">' +
            '<button type="button" class="boton-principal" id="fc-ficha-editar">Editar</button>' +
          '</div>'
        : '') +
    '</div>';

  document.body.appendChild(fondo);

  function cerrar() {
    fondo.remove();
    document.removeEventListener('keydown', alPulsarTecla);
  }
  function alPulsarTecla(ev) { if (ev.key === 'Escape') cerrar(); }

  fondo.addEventListener('click', function (ev) { if (ev.target === fondo) cerrar(); });
  document.addEventListener('keydown', alPulsarTecla);
  fondo.querySelector('.fv-modal-cerrar').addEventListener('click', cerrar);

  fondo.querySelector('#fc-ficha-editar')?.addEventListener('click', function () {
    cerrar();
    abrirFormularioFacturaCompra(id);
  });
}

// ============================================================
// 6. FORMULARIO
// ============================================================
// No se cierra al tocar fuera (regla de formularios con trabajo dentro).
//
// IVA e IRPF: desplegable con los tipos de Configuración + "Otro...".
// Al elegir "Otro..." aparece un campo para escribir el porcentaje.
// Si la factura guardada tiene un porcentaje que no está en la lista
// (algo normal en facturas de proveedor), al editarla se abre
// directamente en modo "Otro..." con ese valor escrito.

const FC_OTRO = '__otro__';

function fcOpcionesPorcentaje(tipos, valorActual) {
  const encontrado = tipos.find(function (x) {
    return Math.abs(x.porcentaje - parsearNumero(valorActual)) < 0.01;
  });
  return {
    seleccion: encontrado ? String(encontrado.porcentaje) : FC_OTRO,
    esOtro: !encontrado
  };
}

function fcSelectPorcentaje(clave, etiqueta, tipos, valorActual) {
  const info = fcOpcionesPorcentaje(tipos, valorActual);
  return '<div class="fv-campo-grupo">' +
    '<label for="fc-campo-' + clave + '">' + escaparHtml(etiqueta) + '</label>' +
    '<select class="campo" id="fc-campo-' + clave + '">' +
      tipos.map(function (x) {
        return '<option value="' + escaparHtml(String(x.porcentaje)) + '"' +
          (!info.esOtro && String(x.porcentaje) === info.seleccion ? ' selected' : '') + '>' +
          escaparHtml(x.nombre + ' (' + x.porcentaje + '%)') + '</option>';
      }).join('') +
      '<option value="' + FC_OTRO + '"' + (info.esOtro ? ' selected' : '') + '>Otro...</option>' +
    '</select>' +
    '<input class="campo fc-otro-campo" id="fc-campo-' + clave + '-otro" type="text" data-numero="1" ' +
      'inputmode="decimal" placeholder="Escribe el %" value="' +
      (info.esOtro ? escaparHtml(String(parsearNumero(valorActual))) : '') + '"' +
      (info.esOtro ? '' : ' hidden') + '>' +
  '</div>';
}

function abrirFormularioFacturaCompra(id) {
  const editando = !!id;
  const original = editando ? estado.compras.find(function (f) { return String(f.id) === String(id); }) : null;
  if (editando && !original) return;

  if (original && !fcEstaActiva(original)) {
    alert('Esta factura está desactivada y no se puede editar. Reactívala primero.');
    return;
  }

  const proveedores = fcProveedoresDisponibles();
  const tiposIva = preTiposIva();
  const tiposIrpf = preTiposIrpf();

  // Valores por defecto del mapa 10.2: IVA 21%, IRPF 0%.
  const datos = {
    numero: original ? (original.numero || '') : '',
    fecha: original ? normalizarFecha(original.fecha) : fechaHoyISO(),
    id_proveedor: original ? String(original.id_proveedor || '') : '',
    concepto: original ? (original.concepto || '') : '',
    base: original ? parsearNumero(original.base) : '',
    iva_pct: original ? parsearNumero(original.iva_pct) : 21,
    irpf_pct: original ? parsearNumero(original.irpf_pct) : 0
  };

  const fondo = document.createElement('div');
  fondo.className = 'fv-modal-fondo';
  fondo.innerHTML =
    '<div class="fv-modal">' +
      '<div class="fv-modal-cabecera">' +
        '<div class="fv-modal-texto">' +
          '<p class="fv-modal-titulo">' + (editando ? 'Editar factura de compra' : 'Nueva factura de compra') + '</p>' +
          '<p class="fv-modal-subtitulo">El número lo pone el proveedor</p>' +
        '</div>' +
        '<button type="button" class="fv-modal-cerrar" aria-label="Cerrar"><i class="ti ti-x"></i></button>' +
      '</div>' +

      '<div class="fv-modal-cuerpo">' +
        '<form id="fc-form">' +
          '<div class="fv-form-grid dos-columnas">' +
            '<div class="fv-campo-grupo"><label for="fc-campo-numero">Número *</label>' +
              '<input class="campo" id="fc-campo-numero" type="text" value="' + escaparHtml(datos.numero) + '">' +
              '<p class="fv-mensaje-error" data-error-de="numero" hidden></p></div>' +

            '<div class="fv-campo-grupo"><label for="fc-campo-fecha">Fecha *</label>' +
              '<input class="campo" type="date" id="fc-campo-fecha" value="' + escaparHtml(datos.fecha) + '">' +
              '<p class="fv-mensaje-error" data-error-de="fecha" hidden></p></div>' +

            '<div class="fv-campo-grupo ancho-total"><label for="fc-campo-id_proveedor">Proveedor *</label>' +
              '<select class="campo" id="fc-campo-id_proveedor">' +
                '<option value="">Selecciona un proveedor...</option>' +
                proveedores.map(function (c) {
                  return '<option value="' + escaparHtml(String(c.id)) + '"' +
                    (String(c.id) === datos.id_proveedor ? ' selected' : '') + '>' +
                    escaparHtml(c.nombre_contacto + (c.nombre_fiscal && c.nombre_fiscal !== c.nombre_contacto ? ' (' + c.nombre_fiscal + ')' : '')) +
                  '</option>';
                }).join('') +
              '</select>' +
              '<p class="fv-mensaje-error" data-error-de="id_proveedor" hidden></p></div>' +

            '<button type="button" class="boton-menor fv-enlace-cliente" id="fc-nuevo-proveedor">+ Crear un proveedor nuevo</button>' +
            '<p class="fv-info-cliente" id="fc-info-proveedor" hidden></p>' +
            '<p class="fv-aviso" id="fc-aviso-numero" hidden></p>' +

            '<div class="fv-campo-grupo ancho-total"><label for="fc-campo-concepto">Concepto *</label>' +
              '<textarea class="campo" id="fc-campo-concepto">' + escaparHtml(datos.concepto) + '</textarea>' +
              '<p class="fv-mensaje-error" data-error-de="concepto" hidden></p></div>' +

            '<div class="fv-campo-grupo"><label for="fc-campo-base">Base imponible *</label>' +
              '<input class="campo" id="fc-campo-base" type="text" data-numero="1" inputmode="decimal" value="' +
                escaparHtml(datos.base === 0 ? '0' : String(datos.base)) + '">' +
              '<p class="fv-mensaje-error" data-error-de="base" hidden></p></div>' +

            '<div></div>' +

            fcSelectPorcentaje('iva_pct', 'IVA', tiposIva, datos.iva_pct) +
            fcSelectPorcentaje('irpf_pct', 'IRPF', tiposIrpf, datos.irpf_pct) +
          '</div>' +

          '<div class="fv-bloque" id="fc-totales"></div>' +
        '</form>' +
      '</div>' +

      '<div class="fv-modal-pie">' +
        '<button type="button" class="boton-secundario" id="fc-form-cancelar">Cancelar</button>' +
        '<button type="submit" form="fc-form" class="boton-principal">Guardar factura</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(fondo);

  fondo.querySelector('.fv-modal-cerrar').addEventListener('click', function () { fondo.remove(); });
  fondo.querySelector('#fc-form-cancelar').addEventListener('click', function () { fondo.remove(); });

  const btnNuevoProveedor = fondo.querySelector('#fc-nuevo-proveedor');
  btnNuevoProveedor.addEventListener('click', function () {
    if (typeof abrirCreacionRapidaContacto !== 'function') {
      alert('El módulo de Clientes no está disponible.');
      return;
    }
    if (document.querySelector('.cli-modal-fondo')) return;
    btnNuevoProveedor.disabled = true;

    abrirCreacionRapidaContacto('proveedor', function (contacto) {
      const select = fondo.querySelector('#fc-campo-id_proveedor');
      if (!select.querySelector('option[value="' + String(contacto.id) + '"]')) {
        const opcion = document.createElement('option');
        opcion.value = String(contacto.id);
        opcion.textContent = contacto.nombre_contacto;
        select.appendChild(opcion);
      }
      select.value = String(contacto.id);
      fcActualizarFormulario(fondo, original);
    });

    const vigilante = setInterval(function () {
      if (!document.querySelector('.cli-modal-fondo')) {
        btnNuevoProveedor.disabled = false;
        clearInterval(vigilante);
      }
    }, 300);
  });

  // Mostrar u ocultar el campo "Otro..." al cambiar el desplegable.
  ['iva_pct', 'irpf_pct'].forEach(function (clave) {
    const select = fondo.querySelector('#fc-campo-' + clave);
    const otro = fondo.querySelector('#fc-campo-' + clave + '-otro');
    select.addEventListener('change', function () {
      const esOtro = select.value === FC_OTRO;
      otro.hidden = !esOtro;
      if (esOtro) otro.focus();
      fcActualizarFormulario(fondo, original);
    });
  });

  fondo.querySelectorAll('#fc-form input, #fc-form select, #fc-form textarea').forEach(function (el) {
    el.addEventListener('input', function () { fcActualizarFormulario(fondo, original); });
    el.addEventListener('change', function () { fcActualizarFormulario(fondo, original); });
  });

  fondo.querySelector('#fc-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    fcProcesarGuardado(fondo, original);
  });

  fcActualizarFormulario(fondo, original);
}

// Lee un porcentaje del formulario: del desplegable, o del campo
// "Otro..." si esa es la opción elegida.
function fcLeerPorcentaje(fondo, clave) {
  const select = fondo.querySelector('#fc-campo-' + clave);
  if (!select) return 0;
  if (select.value === FC_OTRO) {
    return parsearNumero(fondo.querySelector('#fc-campo-' + clave + '-otro').value);
  }
  return parsearNumero(select.value);
}

function fcLeerFormulario(fondo) {
  const valor = function (clave) {
    const el = fondo.querySelector('#fc-campo-' + clave);
    return el ? el.value : '';
  };
  return {
    numero: valor('numero').trim(),
    fecha: valor('fecha'),
    id_proveedor: valor('id_proveedor'),
    concepto: valor('concepto').trim(),
    base: parsearNumero(valor('base')),
    iva_pct: fcLeerPorcentaje(fondo, 'iva_pct'),
    irpf_pct: fcLeerPorcentaje(fondo, 'irpf_pct')
  };
}

function fcActualizarFormulario(fondo, original) {
  const datos = fcLeerFormulario(fondo);
  const t = fcCalcularTotales(datos.base, datos.iva_pct, datos.irpf_pct);

  const proveedor = estado.clientes.find(function (c) { return String(c.id) === String(datos.id_proveedor); });
  const info = fondo.querySelector('#fc-info-proveedor');
  if (proveedor) {
    info.hidden = false;
    info.textContent = [
      proveedor.nombre_fiscal || proveedor.nombre_contacto,
      proveedor.nif || 'sin NIF'
    ].filter(Boolean).join(' · ');
  } else {
    info.hidden = true;
  }

  // Aviso de número repetido con el mismo proveedor: informa, no bloquea.
  const aviso = fondo.querySelector('#fc-aviso-numero');
  const repetida = fcNumeroRepetido(datos.numero, datos.id_proveedor, original ? original.id : null);
  if (repetida) {
    aviso.hidden = false;
    aviso.textContent = 'Ya tienes una factura con el número ' + (repetida.numero || '') +
      ' de este mismo proveedor, con fecha ' + mostrarFecha(repetida.fecha) +
      '. Puedes guardarla igualmente si es correcta.';
  } else {
    aviso.hidden = true;
  }

  fondo.querySelector('#fc-totales').innerHTML =
    '<p class="fv-bloque-titulo">Resumen económico</p>' +
    fvLinea('Base imponible', formatMoney(t.base)) +
    fvLinea('IVA (' + t.ivaPct + '%)', '+' + formatMoney(t.iva)) +
    fvLinea('Retención IRPF (' + t.irpfPct + '%)', '−' + formatMoney(t.irpf)) +
    '<div class="fv-total-final"><span>TOTAL</span><strong>' + escaparHtml(formatMoney(t.total)) + '</strong></div>';
}

// ============================================================
// 7. GUARDADO
// ============================================================

function fcMostrarError(fondo, campo, mensaje) {
  const input = fondo.querySelector('#fc-campo-' + campo);
  const p = fondo.querySelector('[data-error-de="' + campo + '"]');
  if (input) input.classList.add('fv-campo-error');
  if (p) { p.textContent = mensaje; p.hidden = false; }
}

function fcLimpiarErrores(fondo) {
  fondo.querySelectorAll('.fv-campo-error').forEach(function (el) { el.classList.remove('fv-campo-error'); });
  fondo.querySelectorAll('[data-error-de]').forEach(function (el) { el.hidden = true; });
}

function fcProcesarGuardado(fondo, original) {
  fcLimpiarErrores(fondo);
  const datos = fcLeerFormulario(fondo);

  let valido = true;
  if (!datos.numero) { fcMostrarError(fondo, 'numero', 'Obligatorio: es el número que trae la factura del proveedor.'); valido = false; }
  if (!datos.fecha) { fcMostrarError(fondo, 'fecha', 'Obligatoria'); valido = false; }
  if (!datos.id_proveedor) { fcMostrarError(fondo, 'id_proveedor', 'Selecciona un proveedor activo. Si no existe, créalo primero.'); valido = false; }
  if (!datos.concepto) { fcMostrarError(fondo, 'concepto', 'Escribe un concepto para la factura.'); valido = false; }
  if (!(datos.base > 0)) { fcMostrarError(fondo, 'base', 'Escribe la base imponible de la factura.'); valido = false; }
  if (!valido) return;

  const proveedor = estado.clientes.find(function (c) { return String(c.id) === String(datos.id_proveedor); });
  if (!proveedor) {
    fcMostrarError(fondo, 'id_proveedor', 'Ese proveedor ya no existe.');
    return;
  }
  if (!estado.modoPrueba && esDePrueba(proveedor)) {
    alert('Este proveedor es de prueba y no puede utilizarse en una factura real. Activa el modo prueba para trabajar con datos de prueba.');
    return;
  }
  if (original && !fcEstaActiva(original)) {
    alert('Esta factura está desactivada y no se puede editar.');
    return;
  }

  const t = fcCalcularTotales(datos.base, datos.iva_pct, datos.irpf_pct);
  const idFactura = original ? original.id : fcNuevoId('fc');

  // Los datos del proveedor se congelan en la factura, igual que en ventas.
  const registro = {
    id: idFactura,
    numero: datos.numero,
    fecha: normalizarFecha(datos.fecha),
    id_proveedor: proveedor.id,
    proveedor: proveedor.nombre_fiscal || proveedor.nombre_contacto || '',
    nif: proveedor.nif || '',
    concepto: datos.concepto,
    base: t.base,
    iva_pct: t.ivaPct,
    iva: t.iva,
    irpf_pct: t.irpfPct,
    irpf: t.irpf,
    total: t.total,
    estado: original ? (original.estado || 'pendiente') : 'pendiente',
    fecha_pago: original ? (original.fecha_pago || '') : '',
    estado_registro: original ? (fcEstaActiva(original) ? 'activo' : 'inactivo') : 'activo'
  };

  // La ventana se cierra al momento; el guardado sigue en segundo plano.
  fondo.remove();

  fcMarcarSync(idFactura, 'guardando');
  fcGuardarEnSegundoPlano(registro);
  fcRepintarLista();
}

/**
 * Guarda sin bloquear la pantalla. Si la factura ya estaba pagada y se
 * han cambiado los importes, el apunte de tesorería se rehace para que
 * contabilidad siga cuadrando.
 */
function fcGuardarEnSegundoPlano(registro) {
  return guardarRegistro('compras', registro, fcRepintarLista, null)
    .then(function (resultado) {
      if (resultado.status !== 'success') {
        fcReponerLocal(registro);
        fcMarcarSync(registro.id, 'error');
        fcPendientes[String(registro.id)] = { registro: registro };
        fcRepintarLista();
        return;
      }
      fcMarcarSync(registro.id, null);
      delete fcPendientes[String(registro.id)];

      if (String(registro.estado) === 'pagada') {
        return fcCrearApuntePago(registro).then(function () { fcRepintarLista(); });
      }
      fcRepintarLista();
    })
    .catch(function (err) {
      console.error('Fallo al guardar la factura de compra:', err);
      fcReponerLocal(registro);
      fcMarcarSync(registro.id, 'error');
      fcPendientes[String(registro.id)] = { registro: registro };
      fcRepintarLista();
    });
}

function fcReponerLocal(registro) {
  const i = estado.compras.findIndex(function (r) { return String(r.id) === String(registro.id); });
  if (i >= 0) estado.compras[i] = registro;
  else estado.compras.push(registro);
  guardarEntidadLocal('compras');
}
