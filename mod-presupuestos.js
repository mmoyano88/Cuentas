/**
 * MÓDULO PRESUPUESTOS (con la calculadora dentro)
 * ------------------------------------------------------------
 * Sigue el patrón de lista + ficha de mod-clientes.js.
 *
 * Reglas propias de este módulo:
 * - La ficha de detalle (solo lectura) SÍ se cierra al tocar fuera.
 * - El formulario y la calculadora NO se cierran al tocar fuera:
 *   solo con su botón de cerrar o con Cancelar (hay trabajo dentro
 *   que se puede perder).
 *
 * Fórmulas: mapa 7.2, 7.3 y 8.4 🔒 — no se han modificado.
 */

// ============================================================
// 0. ESTADO PROPIO DEL MÓDULO
// ============================================================

let preSubvista = 'relacion';      // 'relacion' | 'calculadora'
let preFiltroEstado = 'todos';     // 'todos' | 'pendiente' | 'aceptado' | 'rechazado'
let preOrden = 'fecha-desc';
let preBusqueda = '';

// Instantánea de la calculadora pendiente de guardar junto al
// presupuesto (equivale a `presupuestoDetallePrefill` del original).
let preDetallePrefill = null;

// Aviso que se muestra en la calculadora tras recuperar un presupuesto.
let preAvisoCalculadora = '';

// Si la calculadora se abrió para editar un presupuesto ya guardado,
// aquí queda su id: al terminar se actualiza ese mismo presupuesto en
// vez de crear uno nuevo.
let preCalcEditandoId = null;

// Contenido de la calculadora. Vive aquí para que no se pierda al
// cambiar de pestaña o de sección y volver.
const PRE_CALC_VACIA = {
  concepto: '',
  horas_trabajo: '', horas_noche: '', horas_edicion: '',
  desplaz_horas: '', desplaz_km: '',
  gasto_salarios: '', gasto_materiales: '', gasto_dietas: '', gasto_otros: '',
  tipo_cliente_id: '', iva_id: '', irpf_id: '',
  desc_tipo: 'percent', desc_valor: '',
  equipos: [], servicios: []
};

let preCalc = Object.assign({}, PRE_CALC_VACIA);

// Prefijo de la serie de numeración. Hoy solo hay una serie (decisión
// M2): cuando existan varias, este valor vendrá de la serie elegida.
const PRE_PREFIJO_SERIE = 'P';

const PRE_ESTADOS = {
  pendiente: { etiqueta: 'Pendiente', clase: 'ind-ambar' },
  aceptado:  { etiqueta: 'Aceptado',  clase: 'ind-verde' },
  rechazado: { etiqueta: 'Rechazado', clase: 'ind-rojo' }
};

// ============================================================
// 1. LECTURA DE LA CONFIGURACIÓN
// ============================================================

function preConfigNumero(clave, porDefecto) {
  const v = estado.configuracion[clave];
  if (v === undefined || v === null || v === '') return porDefecto;
  return parsearNumero(v);
}

function preConfigArray(clave) {
  const v = estado.configuracion[clave];
  if (!v) return [];
  try {
    const arr = typeof v === 'string' ? JSON.parse(v) : v;
    return Array.isArray(arr) ? arr : [];
  } catch (err) {
    return [];
  }
}

// Tipos de cliente: el id estable es el campo `nombre` (mapa 1.9).
function preTiposCliente() {
  const arr = preConfigArray('tipos_cliente');
  const lista = arr.length ? arr : [
    { nombre: 'normal', etiqueta: 'Normal', ajuste: 0 },
    { nombre: 'profesional', etiqueta: 'Profesional', ajuste: -5 },
    { nombre: 'habitual', etiqueta: 'Cliente habitual', ajuste: -8 },
    { nombre: 'ayuntamiento_pequeno', etiqueta: 'Ayuntamiento pequeño', ajuste: 2 },
    { nombre: 'ayuntamiento_mediano', etiqueta: 'Ayuntamiento mediano', ajuste: 5 },
    { nombre: 'ayuntamiento_grande', etiqueta: 'Ayuntamiento grande', ajuste: 10 }
  ];
  return lista.map(function (t) {
    const pct = parsearNumero(t.ajuste);
    return {
      id: String(t.nombre),
      etiqueta: t.etiqueta || t.nombre,
      ajustePct: pct,
      factor: 1 + (pct / 100)
    };
  });
}

function preTipoClientePorId(id) {
  const tipos = preTiposCliente();
  return tipos.find(function (t) { return t.id === String(id); }) || null;
}

// IVA / IRPF / equipos / servicios: se usa el id propio si Configuración
// ya lo generó (decisión I2). Si una fila antigua todavía no lo tiene,
// se usa como respaldo el mismo id por posición que usaba la app
// original, para que los presupuestos ya guardados sigan resolviendo.
function preTiposIva() {
  return preConfigArray('iva_tipos').map(function (x, i) {
    const pct = parsearNumero(x.porcentaje);
    return { id: String(x.id || ('iva-' + pct + '-' + i)), nombre: x.nombre || ('IVA ' + pct + '%'), porcentaje: pct };
  });
}

function preTiposIrpf() {
  return preConfigArray('irpf_tipos').map(function (x, i) {
    const pct = parsearNumero(x.porcentaje);
    return { id: String(x.id || ('irpf-' + pct + '-' + i)), nombre: x.nombre || ('IRPF ' + pct + '%'), porcentaje: pct };
  });
}

function preEquipos() {
  return preConfigArray('equipos').map(function (x, i) {
    return { id: String(x.id || ('eq-' + i)), nombre: String(x.nombre || ''), precio: parsearNumero(x.precio) };
  });
}

// El tipo se guarda en la hoja como 'importe' o 'porcentaje'.
function preServicios() {
  return preConfigArray('servicios_extra').map(function (x, i) {
    const tipo = String(x.tipo || 'importe').toLowerCase();
    const esPorcentaje = tipo === 'porcentaje' || tipo === 'percent_work' || tipo === 'percent';
    return {
      id: String(x.id || ('srv-' + i)),
      nombre: String(x.nombre || ''),
      tipo: esPorcentaje ? 'porcentaje' : 'importe',
      valor: parsearNumero(x.valor)
    };
  });
}

function preTarifas() {
  return {
    trabajo: preConfigNumero('precio_hora_trabajo', 25),
    edicion: preConfigNumero('precio_hora_edicion', 15),
    desplazHora: preConfigNumero('precio_hora_desplazamiento', 10),
    km: preConfigNumero('precio_km', 0.35),
    incrementoNochePct: preConfigNumero('incremento_noche', 50),
    margenGastosPct: preConfigNumero('margen_otros_gastos', 30),
    compensacionPct: preConfigNumero('compensacion_irpf', 20)
  };
}

// ============================================================
// 2. UTILIDADES DEL MÓDULO
// ============================================================

function preIniciales(texto) {
  const limpio = String(texto || '').trim();
  if (!limpio) return '?';
  const partes = limpio.split(/\s+/);
  return (partes[0][0] + (partes[1] ? partes[1][0] : '')).toUpperCase();
}

function preNuevoId(prefijo) {
  if (estado.modoPrueba) return generarIdPrueba(prefijo);
  return prefijo + '-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e9).toString(36);
}

// Numeración P{AÑO}/{0000} (mapa 8.1). Los presupuestos de prueba
// también cuentan, tal como hacía la app original.
function preSiguienteNumero() {
  const anio = new Date().getFullYear();
  const patron = new RegExp('^' + PRE_PREFIJO_SERIE + anio + '\\/(\\d{4})$');
  let mayor = 0;
  estado.presupuestos.forEach(function (p) {
    const m = String(p.numero || '').match(patron);
    if (m) mayor = Math.max(mayor, parseInt(m[1], 10));
  });
  return PRE_PREFIJO_SERIE + anio + '/' + String(mayor + 1).padStart(4, '0');
}

function preTieneFactura(idPresupuesto) {
  return estado.ventas.some(function (v) {
    return String(v.id_presupuesto || '') === String(idPresupuesto);
  });
}

function preBloqueado(p) {
  if (!p) return false;
  return String(p.estado) === 'aceptado' || preTieneFactura(p.id);
}

function prePastillaEstado(valor) {
  const info = PRE_ESTADOS[String(valor)] || PRE_ESTADOS.pendiente;
  return '<span class="pastilla ' + info.clase + '">' + info.etiqueta + '</span>';
}

function preDetalleDe(idPresupuesto) {
  return estado.presupuestos_detalle.find(function (d) {
    return String(d.id_presupuesto) === String(idPresupuesto);
  }) || null;
}

function preClienteDe(p) {
  return estado.clientes.find(function (c) { return String(c.id) === String(p.id_cliente); }) || null;
}

// Contactos que pueden ser cliente de un presupuesto (mapa 8.3).
function preClientesDisponibles() {
  return estado.clientes.filter(function (c) {
    if (c.estado !== 'activo') return false;
    if (c.rol !== 'cliente' && c.rol !== 'ambos') return false;
    if (!estado.modoPrueba && esDePrueba(c)) return false;
    return true;
  }).sort(function (a, b) {
    return (a.nombre_contacto || '').localeCompare(b.nombre_contacto || '', 'es');
  });
}

function preTextoBusqueda(p) {
  return normalizarBusqueda([
    p.numero, p.cliente, p.nif, p.concepto, mostrarFecha(p.fecha), p.estado,
    formatMoney(p.total), formatMoney(p.base)
  ].filter(Boolean).join(' '));
}

// ============================================================
// 3. CÁLCULOS 🔒 (mapa 7.2, 7.3 y 8.4 — no modificar)
// ============================================================

// Tramo común: desde el subtotal hasta el total. Lo usan por igual la
// calculadora y el editor de presupuestos. El orden importa: ajuste de
// cliente → compensación de IRPF → descuento especial.
function preTotalesDesdeSubtotal(o) {
  const subtotal = roundMoney(o.subtotal);
  const factor = Number(o.factorCliente || 1);
  const compPct = Number(o.compensacionPct || 0);
  const factorComp = 1 + (compPct / 100);

  const ajusteImporte = roundMoney(subtotal * (factor - 1));
  const postCliente = roundMoney(subtotal * factor);

  const compensacion = roundMoney(postCliente * (factorComp - 1));
  const postComp = roundMoney(postCliente * factorComp);

  const descVal = Math.max(0, parsearNumero(o.descValor));
  const descImporte = roundMoney(o.descTipo === 'fixed' ? descVal : postComp * (descVal / 100));

  const base = roundMoney(Math.max(0, postComp - descImporte));
  const iva = roundMoney(base * (Number(o.ivaPct || 0) / 100));
  const irpf = roundMoney(base * (Number(o.irpfPct || 0) / 100));
  const total = roundMoney(base + iva - irpf);

  return {
    subtotal: subtotal,
    ajustePct: roundMoney((factor - 1) * 100),
    ajusteImporte: ajusteImporte,
    compensacionPct: compPct,
    compensacion: compensacion,
    descTipo: o.descTipo === 'fixed' ? 'fixed' : 'percent',
    descValor: roundMoney(descVal),
    descImporte: descImporte,
    base: base,
    ivaPct: Number(o.ivaPct || 0),
    iva: iva,
    irpfPct: Number(o.irpfPct || 0),
    irpf: irpf,
    total: total
  };
}

// Calculadora completa (mapa 7.2). Devuelve además los costes
// intermedios que hacen falta para el panel de rentabilidad y para el
// desglose de la ficha de detalle.
function preCalcularCalculadora(d) {
  const t = preTarifas();
  const equipos = preEquipos();
  const servicios = preServicios();

  let hTrabajo = Math.max(0, parsearNumero(d.horas_trabajo));
  let hNoche = Math.max(0, parsearNumero(d.horas_noche));
  let nocheCorregida = false;
  if (hNoche > hTrabajo) { hNoche = hTrabajo; nocheCorregida = true; }

  const factorNoche = 1 + (t.incrementoNochePct / 100);
  const hNormales = hTrabajo - hNoche;
  const costeHorasTrabajo = (hNormales * t.trabajo) + (hNoche * t.trabajo * factorNoche);

  const costeEdicion = Math.max(0, parsearNumero(d.horas_edicion)) * t.edicion;

  const costeDesplazamiento =
    (Math.max(0, parsearNumero(d.desplaz_horas)) * t.desplazHora) +
    (Math.max(0, parsearNumero(d.desplaz_km)) * t.km);

  const equiposElegidos = equipos.filter(function (e) { return d.equipos.indexOf(e.id) !== -1; });
  const costeEquipos = equiposElegidos.reduce(function (s, e) { return s + e.precio; }, 0);

  const gastosDirectos =
    Math.max(0, parsearNumero(d.gasto_salarios)) +
    Math.max(0, parsearNumero(d.gasto_materiales)) +
    Math.max(0, parsearNumero(d.gasto_dietas)) +
    Math.max(0, parsearNumero(d.gasto_otros));
  const gastosConMargen = gastosDirectos * (1 + (t.margenGastosPct / 100));

  const serviciosElegidos = servicios.filter(function (s) { return d.servicios.indexOf(s.id) !== -1; });
  let costeServicios = 0;
  serviciosElegidos.forEach(function (s) {
    costeServicios += s.tipo === 'porcentaje'
      ? costeHorasTrabajo * (s.valor / 100)
      : s.valor;
  });

  const subtotalPrevio = costeHorasTrabajo + costeEdicion + costeDesplazamiento +
                         costeEquipos + gastosConMargen + costeServicios;

  const tipoCliente = preTipoClientePorId(d.tipo_cliente_id) || preTiposCliente()[0];
  const iva = preTiposIva().find(function (x) { return x.id === d.iva_id; }) || preTiposIva()[0] || { porcentaje: 0 };
  const irpf = preTiposIrpf().find(function (x) { return x.id === d.irpf_id; }) || preTiposIrpf()[0] || { porcentaje: 0 };

  const totales = preTotalesDesdeSubtotal({
    subtotal: subtotalPrevio,
    factorCliente: tipoCliente ? tipoCliente.factor : 1,
    compensacionPct: t.compensacionPct,
    descTipo: d.desc_tipo,
    descValor: d.desc_valor,
    ivaPct: iva.porcentaje,
    irpfPct: irpf.porcentaje
  });

  // Rentabilidad interna (mapa 7.3): los gastos se descuentan SIN el
  // margen, y la compensación de IRPF no cuenta como resultado.
  const resultadoTrabajo = roundMoney((totales.base - totales.compensacion) - gastosDirectos);
  const reservaIrpf = roundMoney(Math.max(0, resultadoTrabajo) * (t.compensacionPct / 100));
  const disponible = roundMoney(resultadoTrabajo - reservaIrpf);

  return Object.assign({}, totales, {
    nocheCorregida: nocheCorregida,
    horasNoche: hNoche,
    costeHorasTrabajo: roundMoney(costeHorasTrabajo),
    costeEdicion: roundMoney(costeEdicion),
    costeDesplazamiento: roundMoney(costeDesplazamiento),
    costeEquipos: roundMoney(costeEquipos),
    gastosDirectos: roundMoney(gastosDirectos),
    gastosConMargen: roundMoney(gastosConMargen),
    costeServicios: roundMoney(costeServicios),
    equiposElegidos: equiposElegidos,
    serviciosElegidos: serviciosElegidos,
    tipoCliente: tipoCliente,
    iva: iva,
    irpf: irpf,
    resultadoTrabajo: resultadoTrabajo,
    reservaIrpf: reservaIrpf,
    disponible: disponible
  });
}

// ============================================================
// 4. PINTADO PRINCIPAL (selector Presupuestos / Calculadora)
// ============================================================

function pintarPresupuestos() {
  const contenido = document.getElementById('contenido');
  if (!contenido) return;

  contenido.innerHTML =
    '<div class="pre-cabecera-lista">' +
      '<div class="pre-selector" id="pre-selector">' +
        '<button type="button" data-subvista="relacion">Presupuestos</button>' +
        '<button type="button" data-subvista="calculadora">Calculadora</button>' +
      '</div>' +
      (preSubvista === 'relacion'
        ? '<button type="button" class="pre-flotante" id="pre-btn-nuevo" aria-label="Nuevo presupuesto"><i class="ti ti-plus"></i></button>'
        : '') +
    '</div>' +
    '<div id="pre-zona"></div>';

  document.getElementById('pre-selector').querySelectorAll('[data-subvista]').forEach(function (b) {
    b.classList.toggle('activa', b.dataset.subvista === preSubvista);
    b.addEventListener('click', function () {
      preSubvista = b.dataset.subvista;
      pintarPresupuestos();
    });
  });

  const btnNuevo = document.getElementById('pre-btn-nuevo');
  if (btnNuevo) btnNuevo.addEventListener('click', function () { abrirFormularioPresupuesto(null); });

  if (preSubvista === 'calculadora') pintarCalculadora();
  else pintarRelacionPresupuestos();
}

// ============================================================
// 5. LISTA DE PRESUPUESTOS
// ============================================================

function pintarRelacionPresupuestos() {
  const zona = document.getElementById('pre-zona');
  if (!zona) return;

  zona.innerHTML =
    '<div class="pre-barra" style="position:relative">' +
      '<input type="text" class="pre-buscador" id="pre-buscador" placeholder="Buscar..." value="' + escaparHtml(preBusqueda) + '">' +
      '<button type="button" class="pre-btn-filtro' + (preFiltroEstado !== 'todos' ? ' con-filtro' : '') + '" id="pre-btn-filtro"><i class="ti ti-filter"></i></button>' +
      preRenderFiltrosPanel() +
    '</div>' +
    '<div id="pre-lista-contenedor"></div>';

  preCablearBarra();
  preRepintarLista();
}

function preRenderFiltrosPanel() {
  const estados = [['todos', 'Todos'], ['pendiente', 'Pendientes'], ['aceptado', 'Aceptados'], ['rechazado', 'Rechazados']];
  const ordenes = [
    ['fecha-desc', 'Fecha (más nuevo primero)'],
    ['fecha-asc', 'Fecha (más antiguo primero)'],
    ['numero-desc', 'Número (mayor primero)'],
    ['total-desc', 'Importe (mayor primero)']
  ];

  return '<div class="pre-filtros-panel" id="pre-filtros-panel">' +
    '<p class="pre-filtros-titulo">Estado</p>' +
    estados.map(function (op) {
      return '<button type="button" data-estado="' + op[0] + '"' +
        (op[0] === preFiltroEstado ? ' class="activa"' : '') + '>' + escaparHtml(op[1]) + '</button>';
    }).join('') +
    '<p class="pre-filtros-titulo">Ordenar por</p>' +
    ordenes.map(function (op) {
      return '<button type="button" data-orden="' + op[0] + '"' +
        (op[0] === preOrden ? ' class="activa"' : '') + '>' + escaparHtml(op[1]) + '</button>';
    }).join('') +
    '</div>';
}

function preCablearBarra() {
  const buscador = document.getElementById('pre-buscador');
  buscador.addEventListener('input', function () {
    preBusqueda = buscador.value;
    preRepintarLista();
  });

  const btnFiltro = document.getElementById('pre-btn-filtro');
  const panel = document.getElementById('pre-filtros-panel');

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
    b.addEventListener('click', function () { preFiltroEstado = b.dataset.estado; pintarRelacionPresupuestos(); });
  });
  panel.querySelectorAll('[data-orden]').forEach(function (b) {
    b.addEventListener('click', function () { preOrden = b.dataset.orden; pintarRelacionPresupuestos(); });
  });
}

function preListaFiltrada() {
  const texto = normalizarBusqueda(preBusqueda);
  return estado.presupuestos.filter(function (p) {
    if (preFiltroEstado !== 'todos' && String(p.estado) !== preFiltroEstado) return false;
    if (texto && preTextoBusqueda(p).indexOf(texto) === -1) return false;
    return true;
  }).sort(function (a, b) {
    return compararRegistros(a, b, preOrden);
  });
}

function preRepintarLista() {
  const contenedor = document.getElementById('pre-lista-contenedor');
  if (!contenedor) return;
  const lista = preListaFiltrada();

  if (lista.length === 0) {
    contenedor.innerHTML = '<p class="pre-vacio">' +
      (preBusqueda || preFiltroEstado !== 'todos'
        ? 'No hay resultados con estos filtros.'
        : 'Todavía no hay presupuestos.') +
      '</p>';
    return;
  }

  contenedor.innerHTML =
    '<div class="pre-lista-movil">' + lista.map(preRenderFilaMovil).join('') + '</div>' +
    '<div class="pre-tabla-wrap"><table class="pre-tabla"><thead><tr>' +
      '<th>Fecha</th><th>Número</th><th>Cliente</th><th>Concepto</th>' +
      '<th class="pre-celda-derecha">Base</th><th class="pre-celda-derecha">Total</th><th></th>' +
    '</tr></thead><tbody>' + lista.map(preRenderFilaTabla).join('') + '</tbody></table></div>';

  preCablearFilas(contenedor);
}

function preRenderFilaMovil(p) {
  return '<div class="pre-fila" data-id="' + escaparHtml(p.id) + '">' +
    '<div class="pre-avatar">' + escaparHtml(preIniciales(p.cliente)) + '</div>' +
    '<div class="pre-info">' +
      '<p class="pre-nombre">' + escaparHtml(p.cliente || '—') + '</p>' +
      '<p class="pre-meta">' + escaparHtml(p.numero || '—') + ' · ' + escaparHtml(mostrarFecha(p.fecha)) + '</p>' +
      '<p class="pre-meta">' + escaparHtml(p.concepto || '—') + '</p>' +
    '</div>' +
    '<div class="pre-derecha">' +
      '<span class="pre-total-fila">' + escaparHtml(formatMoney(p.total)) + '</span>' +
      '<button type="button" class="pre-pastilla-boton" data-estado-de="' + escaparHtml(p.id) + '">' +
        prePastillaEstado(p.estado) +
      '</button>' +
    '</div>' +
    '<div class="pre-acciones">' +
      '<button type="button" class="pre-btn-icono" data-mas="' + escaparHtml(p.id) + '" aria-label="Más opciones"><i class="ti ti-dots-vertical"></i></button>' +
    '</div>' +
  '</div>';
}

function preRenderFilaTabla(p) {
  const puedeEditar = !preBloqueado(p);
  return '<tr class="pre-fila-tabla" data-id="' + escaparHtml(p.id) + '">' +
    '<td>' + escaparHtml(mostrarFecha(p.fecha)) + '</td>' +
    '<td class="pre-celda-numero">' + escaparHtml(p.numero || '—') + '</td>' +
    '<td>' + escaparHtml(p.cliente || '—') + '</td>' +
    '<td class="pre-celda-concepto">' +
      '<div class="pre-concepto-texto">' + escaparHtml(p.concepto || '—') + '</div>' +
      '<button type="button" data-estado-de="' + escaparHtml(p.id) + '" style="border:none;background:none;padding:4px 0 0;cursor:pointer">' +
        prePastillaEstado(p.estado) +
      '</button>' +
    '</td>' +
    '<td class="pre-celda-derecha">' + escaparHtml(formatMoney(p.base)) + '</td>' +
    '<td class="pre-celda-derecha">' + escaparHtml(formatMoney(p.total)) + '</td>' +
    '<td><div class="pre-acciones">' +
      (puedeEditar
        ? '<button type="button" class="pre-btn-icono" data-editar="' + escaparHtml(p.id) + '" aria-label="Editar"><i class="ti ti-pencil"></i></button>'
        : '') +
      '<button type="button" class="pre-btn-icono" data-mas="' + escaparHtml(p.id) + '" aria-label="Más opciones"><i class="ti ti-dots-vertical"></i></button>' +
    '</div></td>' +
  '</tr>';
}

function preCablearFilas(contenedor) {
  contenedor.querySelectorAll('.pre-fila, .pre-fila-tabla').forEach(function (fila) {
    fila.addEventListener('click', function (ev) {
      if (ev.target.closest('.pre-acciones')) return;
      if (ev.target.closest('[data-estado-de]')) return;
      abrirFichaPresupuesto(fila.dataset.id);
    });
  });

  contenedor.querySelectorAll('[data-editar]').forEach(function (b) {
    b.addEventListener('click', function (ev) {
      ev.stopPropagation();
      preAbrirEdicion(b.dataset.editar);
    });
  });

  contenedor.querySelectorAll('[data-mas]').forEach(function (b) {
    b.addEventListener('click', function (ev) {
      ev.stopPropagation();
      preAbrirMenuMas(b, b.dataset.mas);
    });
  });

  contenedor.querySelectorAll('[data-estado-de]').forEach(function (b) {
    b.addEventListener('click', function (ev) {
      ev.stopPropagation();
      preCambiarEstado(b.dataset.estadoDe);
    });
  });
}

// ============================================================
// 6. MENÚ "MÁS OPCIONES" Y ACCIONES SOBRE UN PRESUPUESTO
// ============================================================

/**
 * Puerta de entrada única para "Editar". Si el presupuesto se creó con
 * la calculadora, se vuelve a abrir EN la calculadora con todos sus
 * datos; si se hizo a mano, se abre el formulario normal.
 */
function preAbrirEdicion(id) {
  const p = estado.presupuestos.find(function (x) { return String(x.id) === String(id); });
  if (!p) return;

  if (preBloqueado(p)) {
    alert(String(p.estado) === 'aceptado'
      ? 'Un presupuesto aceptado no se puede editar. Utiliza "Duplicar presupuesto" para crear una nueva versión.'
      : 'Este presupuesto tiene una factura asociada y no se puede editar.');
    return;
  }

  if (preDetalleDe(id)) preEditarEnCalculadora(id);
  else abrirFormularioPresupuesto(id);
}

function preAbrirMenuMas(boton, id) {
  document.querySelectorAll('.pre-menu-mas').forEach(function (m) { m.remove(); });

  const p = estado.presupuestos.find(function (x) { return String(x.id) === String(id); });
  if (!p) return;

  const tieneFactura = preTieneFactura(id);
  const puedeFacturar = String(p.estado) === 'aceptado' && !tieneFactura;

  const menu = document.createElement('div');
  menu.className = 'pre-menu-mas';
  menu.innerHTML =
    (preBloqueado(p) ? '' : '<button type="button" data-accion="editar">Editar</button>') +
    '<button type="button" data-accion="estado">Cambiar estado</button>' +
    '<button type="button" data-accion="duplicar">Duplicar presupuesto</button>' +
    '<button type="button" data-accion="pdf">Descargar PDF</button>' +
    '<button type="button" data-accion="factura"' + (puedeFacturar ? '' : ' disabled') + '>Convertir en factura</button>' +
    (tieneFactura ? '' : '<button type="button" class="peligro" data-accion="eliminar">Eliminar</button>');

  document.body.appendChild(menu);
  prePosicionarMenu(menu, boton);

  function cerrarMenu() {
    menu.remove();
    document.removeEventListener('click', cerrarSiFuera);
  }
  function cerrarSiFuera(ev) { if (!menu.contains(ev.target)) cerrarMenu(); }

  menu.querySelector('[data-accion="editar"]')?.addEventListener('click', function () { cerrarMenu(); preAbrirEdicion(id); });
  menu.querySelector('[data-accion="estado"]')?.addEventListener('click', function () { cerrarMenu(); preCambiarEstado(id); });
  menu.querySelector('[data-accion="duplicar"]')?.addEventListener('click', function () { cerrarMenu(); preDuplicar(id); });
  menu.querySelector('[data-accion="pdf"]')?.addEventListener('click', function () { cerrarMenu(); preBotonDePrueba('Descargar PDF'); });
  menu.querySelector('[data-accion="factura"]')?.addEventListener('click', function () { cerrarMenu(); preBotonDePrueba('Convertir en factura'); });
  menu.querySelector('[data-accion="eliminar"]')?.addEventListener('click', function () { cerrarMenu(); preEliminar(id); });

  setTimeout(function () { document.addEventListener('click', cerrarSiFuera); }, 0);
}

function prePosicionarMenu(menu, boton) {
  const rect = boton.getBoundingClientRect();
  const alto = menu.offsetHeight;
  const espacioAbajo = window.innerHeight - rect.bottom;
  const arriba = espacioAbajo < alto + 12;

  menu.style.top = arriba ? (rect.top - alto - 4) + 'px' : (rect.bottom + 4) + 'px';
  menu.style.left = Math.max(8, rect.right - menu.offsetWidth) + 'px';
}

// Botones de interfaz que todavía no tienen función asignada.
function preBotonDePrueba(nombre) {
  alert('Botón de prueba: "' + nombre + '" todavía no tiene función. Se conectará cuando se construya su módulo.');
}

async function preCambiarEstado(id) {
  const p = estado.presupuestos.find(function (x) { return String(x.id) === String(id); });
  if (!p) return;

  if (preTieneFactura(id)) {
    alert('Este presupuesto ya tiene una factura asociada. No se puede cambiar de estado.');
    return;
  }
  if (String(p.estado) === 'aceptado') {
    alert('Un presupuesto aceptado no se puede editar ni cambiar de estado. Utiliza "Duplicar presupuesto" para crear una nueva versión.');
    return;
  }

  const eleccion = await mostrarDialogoOpciones(
    'Estado del presupuesto',
    'Presupuesto ' + (p.numero || '') + ' — ' + (p.cliente || '') + '. Estado actual: ' + (PRE_ESTADOS[p.estado] || PRE_ESTADOS.pendiente).etiqueta + '.',
    [
      { id: 'aceptado', texto: 'Marcar como aceptado', tipo: 'principal' },
      { id: 'pendiente', texto: 'Marcar como pendiente' },
      { id: 'rechazado', texto: 'Marcar como rechazado' },
      { id: 'cancelar', texto: 'Cancelar' }
    ]
  );

  if (!eleccion || eleccion === 'cancelar' || eleccion === p.estado) return;

  if (eleccion === 'aceptado') {
    if (!confirm('Al marcar el presupuesto como aceptado ya no se podrá editar ni cambiar de estado. ¿Continuar?')) return;
  }

  await guardarRegistro('presupuestos', Object.assign({}, p, { estado: eleccion }), preRepintarLista, null);
}

async function preDuplicar(id) {
  const p = estado.presupuestos.find(function (x) { return String(x.id) === String(id); });
  if (!p) return;
  if (!puedeEscribir()) return;

  const nuevoId = preNuevoId('pres');
  const copia = Object.assign({}, p, {
    id: nuevoId,
    id_presupuesto_origen: p.id,
    numero: preSiguienteNumero(),
    fecha: fechaHoyISO(),
    estado: 'pendiente'
  });

  const resultado = await guardarRegistro('presupuestos', copia, preRepintarLista, null);
  if (resultado.status !== 'success') return;

  const idFinal = (resultado.data && resultado.data.id) || nuevoId;

  // El desglose de la calculadora también se copia, si lo hubiera.
  const detalle = preDetalleDe(id);
  if (detalle) {
    const copiaDetalle = Object.assign({}, detalle);
    delete copiaDetalle.id;
    await preGuardarDetalle(idFinal, copiaDetalle);
  }

  alert('Creado el presupuesto ' + copia.numero + ' como copia de ' + (p.numero || '') + '.');
}

async function preEliminar(id) {
  const p = estado.presupuestos.find(function (x) { return String(x.id) === String(id); });
  if (!p) return;

  if (preTieneFactura(id)) {
    alert('Este presupuesto tiene una factura asociada. No se puede eliminar.');
    return;
  }
  if (!confirm('Eliminar el presupuesto ' + (p.numero || '') + '? Esto no se puede deshacer.')) return;

  // Primero el detalle, después el presupuesto (mapa 8.8).
  const detalle = preDetalleDe(id);
  if (detalle) {
    const r = await borrarRegistro('presupuestos_detalle', detalle.id, null, null);
    if (r.status !== 'success') return;
  }
  await borrarRegistro('presupuestos', id, preRepintarLista, null);
}

// ============================================================
// 7. FICHA DE DETALLE (solo lectura — sí se cierra al tocar fuera)
// ============================================================

function abrirFichaPresupuesto(id) {
  const p = estado.presupuestos.find(function (x) { return String(x.id) === String(id); });
  if (!p) return;

  const detalle = preDetalleDe(id);
  const bloqueado = preBloqueado(p);

  const fondo = document.createElement('div');
  fondo.className = 'pre-modal-fondo';
  fondo.innerHTML =
    '<div class="pre-modal ancho">' +
      '<div class="pre-modal-cabecera">' +
        '<div class="pre-modal-avatar">' + escaparHtml(preIniciales(p.cliente)) + '</div>' +
        '<div class="pre-modal-texto">' +
          '<p class="pre-modal-titulo">' + escaparHtml(p.numero || 'Presupuesto') + '</p>' +
          '<p class="pre-modal-subtitulo">' + escaparHtml(p.cliente || '—') + ' · ' + escaparHtml(mostrarFecha(p.fecha)) + '</p>' +
        '</div>' +
        prePastillaEstado(p.estado) +
        '<button type="button" class="pre-modal-cerrar" aria-label="Cerrar"><i class="ti ti-x"></i></button>' +
      '</div>' +

      '<div class="pre-modal-cuerpo">' +
        '<div class="pre-ficha-dato"><span>Cliente</span><span>' + escaparHtml(p.cliente || '—') + '</span></div>' +
        '<div class="pre-ficha-dato"><span>NIF</span><span>' + escaparHtml(p.nif || '—') + '</span></div>' +
        '<div class="pre-ficha-dato"><span>Fecha</span><span>' + escaparHtml(mostrarFecha(p.fecha)) + '</span></div>' +
        '<div class="pre-ficha-dato"><span>Concepto</span><span>' + escaparHtml(p.concepto || '—') + '</span></div>' +
        (p.id_presupuesto_origen
          ? '<div class="pre-ficha-dato"><span>Copia de</span><span>' + escaparHtml(preNumeroDe(p.id_presupuesto_origen)) + '</span></div>'
          : '') +

        preBloqueImportes(p) +
        (detalle ? preBloqueDesglose(p, detalle) : '') +
      '</div>' +

      '<div class="pre-modal-pie">' +
        (bloqueado ? '' : '<button type="button" class="boton-secundario" id="pre-ficha-editar">Editar</button>') +
        '<button type="button" class="boton-principal" id="pre-ficha-pdf">Descargar PDF</button>' +
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
  fondo.querySelector('.pre-modal-cerrar').addEventListener('click', cerrar);

  fondo.querySelector('#pre-ficha-pdf').addEventListener('click', function () { preBotonDePrueba('Descargar PDF'); });
  fondo.querySelector('#pre-ficha-editar')?.addEventListener('click', function () {
    cerrar();
    preAbrirEdicion(id);
  });
  fondo.querySelector('#pre-ficha-calculadora')?.addEventListener('click', function () {
    cerrar();
    preEditarEnCalculadora(id);
  });
}

function preNumeroDe(id) {
  const p = estado.presupuestos.find(function (x) { return String(x.id) === String(id); });
  return p ? (p.numero || id) : String(id);
}

function preLinea(etiqueta, valor, clase) {
  return '<div class="pre-linea' + (clase ? ' ' + clase : '') + '"><span>' + escaparHtml(etiqueta) +
    '</span><strong>' + escaparHtml(valor) + '</strong></div>';
}

function preBloqueImportes(p) {
  const signo = function (v) { return (Number(v) > 0 ? '+' : (Number(v) < 0 ? '−' : '')) + formatMoney(Math.abs(Number(v || 0))); };
  return '<div class="pre-bloque">' +
    '<p class="pre-bloque-titulo">Resumen económico</p>' +
    preLinea('Subtotal', formatMoney(p.subtotal)) +
    preLinea('Ajuste por tipo de cliente (' + parsearNumero(p.ajuste_cliente_pct) + '%)', signo(p.ajuste_cliente_importe)) +
    preLinea('Compensación IRPF (' + parsearNumero(p.compensacion_irpf_pct) + '%)', signo(p.compensacion_irpf_importe)) +
    preLinea('Descuento especial' + (String(p.descuento_especial_tipo) === 'fixed'
        ? ' (' + formatMoney(p.descuento_especial_valor) + ')'
        : ' (' + parsearNumero(p.descuento_especial_valor) + '%)'),
      '−' + formatMoney(p.descuento_especial_importe)) +
    preLinea('Base imponible', formatMoney(p.base), 'destacada') +
    preLinea('IVA (' + parsearNumero(p.iva_pct) + '%)', '+' + formatMoney(p.iva)) +
    preLinea('Retención IRPF (' + parsearNumero(p.irpf_pct) + '%)', '−' + formatMoney(p.irpf)) +
    '<div class="pre-total-final"><span>TOTAL</span><strong>' + escaparHtml(formatMoney(p.total)) + '</strong></div>' +
  '</div>';
}

// Desglose reconstruido desde presupuestos_detalle (decisión B6: no se
// guarda ningún texto, se vuelve a montar con los datos estructurados).
function preBloqueDesglose(p, d) {
  let equipos = [];
  let servicios = [];
  try { equipos = JSON.parse(d.equipos_json || '[]') || []; } catch (err) { equipos = []; }
  try { servicios = JSON.parse(d.servicios_extra_json || '[]') || []; } catch (err) { servicios = []; }

  const tarifas = preTarifas();
  const compPct = parsearNumero(p.compensacion_irpf_pct) || tarifas.compensacionPct;
  const gastosDirectos = parsearNumero(d.gasto_salarios) + parsearNumero(d.gasto_materiales) +
                         parsearNumero(d.gasto_dietas) + parsearNumero(d.gasto_otros);
  const resultadoTrabajo = roundMoney((parsearNumero(p.base) - parsearNumero(p.compensacion_irpf_importe)) - gastosDirectos);
  const reservaIrpf = roundMoney(Math.max(0, resultadoTrabajo) * (compPct / 100));
  const disponible = roundMoney(resultadoTrabajo - reservaIrpf);

  return '<div class="pre-bloque">' +
    '<p class="pre-bloque-titulo">Desglose de la calculadora</p>' +
    (d.concepto_calculadora ? preLinea('Concepto', String(d.concepto_calculadora)) : '') +
    preLinea('Horas de trabajo', parsearNumero(d.horas_trabajo) + ' h (' + parsearNumero(d.horas_noche_festivo) + ' h noche/festivo)') +
    preLinea('Horas de edición', parsearNumero(d.horas_edicion) + ' h') +
    preLinea('Desplazamiento', parsearNumero(d.horas_desplazamiento) + ' h · ' + parsearNumero(d.kilometros_desplazamiento) + ' km') +
    preLinea('Gastos directos', formatMoney(gastosDirectos) + ' (+' + parsearNumero(d.margen_otros_gastos_pct) + '% de margen)') +
    preLinea('Precios aplicados',
      formatMoney(d.precio_hora_trabajo) + '/h · edición ' + formatMoney(d.precio_hora_edicion) + '/h · ' +
      formatMoney(d.precio_hora_desplazamiento) + '/h · ' + formatMoney(d.precio_km) + '/km') +
    preLinea('Recargo noche/festivo', parsearNumero(d.incremento_noche_pct) + '%') +

    '<div class="pre-linea"><span>Equipos</span></div>' +
    (equipos.length
      ? '<ul class="pre-lista-simple">' + equipos.map(function (e) {
          return '<li>' + escaparHtml(e.nombre) + ' — ' + escaparHtml(formatMoney(e.precio)) + '</li>';
        }).join('') + '</ul>'
      : '<ul class="pre-lista-simple"><li>Ninguno</li></ul>') +

    '<div class="pre-linea"><span>Servicios extra</span></div>' +
    (servicios.length
      ? '<ul class="pre-lista-simple">' + servicios.map(function (s) {
          const valor = String(s.tipo) === 'porcentaje' ? (parsearNumero(s.valor) + '% de las horas de trabajo') : formatMoney(s.valor);
          return '<li>' + escaparHtml(s.nombre) + ' — ' + escaparHtml(valor) + '</li>';
        }).join('') + '</ul>'
      : '<ul class="pre-lista-simple"><li>Ninguno</li></ul>') +

    preLinea('Subtotal de la calculadora', formatMoney(d.subtotal_calculadora), 'destacada') +

    '<p class="pre-bloque-titulo" style="margin-top:14px">Rentabilidad interna</p>' +
    preLinea('Resultado del trabajo', formatMoney(resultadoTrabajo)) +
    preLinea('Reserva de IRPF (' + compPct + '%)', '−' + formatMoney(reservaIrpf)) +
    preLinea('Disponible estimado', formatMoney(disponible), 'destacada') +

    '<button type="button" class="boton-menor" id="pre-ficha-calculadora" style="padding-left:0;text-decoration:underline">Editar en calculadora</button>' +
  '</div>';
}

// ============================================================
// 8. FORMULARIO DE PRESUPUESTO
// ============================================================
// No se cierra al tocar fuera: puede haber trabajo dentro.

function preCampo(clave, etiqueta, valor, opciones) {
  const o = opciones || {};
  return '<div class="pre-campo-grupo' + (o.anchoTotal ? ' ancho-total' : '') + '">' +
    '<label for="pre-campo-' + clave + '">' + escaparHtml(etiqueta) + (o.requerido ? ' *' : '') + '</label>' +
    (o.textarea
      ? '<textarea class="campo" id="pre-campo-' + clave + '" name="' + clave + '">' + escaparHtml(valor || '') + '</textarea>'
      : '<input class="campo" id="pre-campo-' + clave + '" name="' + clave + '" type="text"' +
        (o.numero ? ' data-numero="1" inputmode="decimal"' : '') +
        (o.soloLectura ? ' readonly' : '') +
        ' value="' + escaparHtml(valor === 0 ? '0' : (valor || '')) + '">') +
    '<p class="pre-mensaje-error" data-error-de="' + clave + '" hidden></p>' +
  '</div>';
}

function preSelect(clave, etiqueta, opciones, valor, extra) {
  const o = extra || {};
  return '<div class="pre-campo-grupo' + (o.anchoTotal ? ' ancho-total' : '') + (o.clase ? ' ' + o.clase : '') + '">' +
    '<label for="pre-campo-' + clave + '">' + escaparHtml(etiqueta) + (o.requerido ? ' *' : '') + '</label>' +
    '<select class="campo" id="pre-campo-' + clave + '" name="' + clave + '">' +
      opciones.map(function (op) {
        return '<option value="' + escaparHtml(op[0]) + '"' + (String(op[0]) === String(valor) ? ' selected' : '') + '>' +
          escaparHtml(op[1]) + '</option>';
      }).join('') +
    '</select>' +
    '<p class="pre-mensaje-error" data-error-de="' + clave + '" hidden></p>' +
  '</div>';
}

/**
 * @param id       id del presupuesto a editar, o null si es nuevo
 * @param prefill  datos que llegan de la calculadora (opcional)
 */
function abrirFormularioPresupuesto(id, prefill) {
  const editando = !!id;
  const original = editando ? estado.presupuestos.find(function (p) { return String(p.id) === String(id); }) : null;
  if (editando && !original) return;

  if (original && preBloqueado(original)) {
    alert(String(original.estado) === 'aceptado'
      ? 'Un presupuesto aceptado no se puede editar. Utiliza "Duplicar presupuesto" para crear una nueva versión.'
      : 'Este presupuesto tiene una factura asociada y no se puede editar.');
    return;
  }

  const tiposIva = preTiposIva();
  const tiposIrpf = preTiposIrpf();
  const clientes = preClientesDisponibles();

  // Si venimos de la calculadora, sus números mandan (aunque se esté
  // editando un presupuesto ya guardado: se acaban de recalcular).
  const deCalculadora = !!prefill;

  const datos = {
    numero: original ? original.numero : preSiguienteNumero(),
    fecha: original ? normalizarFecha(original.fecha) : fechaHoyISO(),
    id_cliente: original ? String(original.id_cliente || '') : '',
    concepto: deCalculadora ? (prefill.concepto || '') : (original ? (original.concepto || '') : ''),
    subtotal: deCalculadora ? prefill.subtotal : (original ? parsearNumero(original.subtotal) : 0),
    desc_tipo: deCalculadora
      ? (prefill.desc_tipo === 'fixed' ? 'fixed' : 'percent')
      : (original ? (String(original.descuento_especial_tipo) === 'fixed' ? 'fixed' : 'percent') : 'percent'),
    desc_valor: deCalculadora ? prefill.desc_valor : (original ? parsearNumero(original.descuento_especial_valor) : 0),
    iva_id: deCalculadora ? (prefill.iva_id || '') : '',
    irpf_id: deCalculadora ? (prefill.irpf_id || '') : ''
  };

  // Al editar sin pasar por la calculadora, el tipo de IVA/IRPF se
  // reconoce por el porcentaje guardado en el presupuesto.
  if (original && !deCalculadora) {
    const ivaEnc = tiposIva.find(function (x) { return Math.abs(x.porcentaje - parsearNumero(original.iva_pct)) < 0.01; });
    const irpfEnc = tiposIrpf.find(function (x) { return Math.abs(x.porcentaje - parsearNumero(original.irpf_pct)) < 0.01; });
    datos.iva_id = ivaEnc ? ivaEnc.id : (tiposIva[0] ? tiposIva[0].id : '');
    datos.irpf_id = irpfEnc ? irpfEnc.id : (tiposIrpf[0] ? tiposIrpf[0].id : '');
  }
  if (!datos.iva_id && tiposIva[0]) datos.iva_id = tiposIva[0].id;
  if (!datos.irpf_id && tiposIrpf[0]) datos.irpf_id = tiposIrpf[0].id;

  const titulo = editando ? 'Editar presupuesto' : 'Nuevo presupuesto';

  const fondo = document.createElement('div');
  fondo.className = 'pre-modal-fondo';
  fondo.innerHTML =
    '<div class="pre-modal ancho">' +
      '<div class="pre-modal-cabecera">' +
        '<div class="pre-modal-texto">' +
          '<p class="pre-modal-titulo">' + escaparHtml(titulo) + '</p>' +
          '<p class="pre-modal-subtitulo">' + escaparHtml(datos.numero) + '</p>' +
        '</div>' +
        '<button type="button" class="pre-modal-cerrar" aria-label="Cerrar"><i class="ti ti-x"></i></button>' +
      '</div>' +

      '<div class="pre-modal-cuerpo">' +
        '<form id="pre-form">' +
          '<div class="pre-form-grid dos-columnas">' +
            preCampo('numero', 'Número', datos.numero, { soloLectura: true }) +
            '<div class="pre-campo-grupo"><label for="pre-campo-fecha">Fecha *</label>' +
              '<input class="campo" type="date" id="pre-campo-fecha" name="fecha" value="' + escaparHtml(datos.fecha) + '">' +
              '<p class="pre-mensaje-error" data-error-de="fecha" hidden></p></div>' +

            preSelect('id_cliente', 'Cliente',
              [['', 'Selecciona un cliente...']].concat(clientes.map(function (c) {
                return [String(c.id), c.nombre_contacto + (c.nombre_fiscal && c.nombre_fiscal !== c.nombre_contacto ? ' (' + c.nombre_fiscal + ')' : '')];
              })),
              datos.id_cliente, { requerido: true, anchoTotal: true }) +

            '<button type="button" class="boton-menor pre-enlace-cliente" id="pre-nuevo-cliente">+ Crear un cliente nuevo</button>' +
            '<p class="pre-info-cliente" id="pre-info-cliente" hidden></p>' +
            '<p class="pre-aviso" id="pre-aviso-tipo" hidden></p>' +

            preCampo('concepto', 'Concepto', datos.concepto, { textarea: true, anchoTotal: true }) +
            preCampo('subtotal', 'Subtotal (antes de ajustes)', datos.subtotal, { numero: true, requerido: true }) +

            '<div class="pre-campo-grupo">' +
              '<label for="pre-campo-desc_valor">Descuento especial</label>' +
              '<div class="pre-fila-doble">' +
                '<select class="campo pre-descuento-tipo" id="pre-campo-desc_tipo" name="desc_tipo">' +
                  '<option value="percent"' + (datos.desc_tipo === 'percent' ? ' selected' : '') + '>Porcentaje</option>' +
                  '<option value="fixed"' + (datos.desc_tipo === 'fixed' ? ' selected' : '') + '>Euros</option>' +
                '</select>' +
                '<input class="campo" id="pre-campo-desc_valor" name="desc_valor" type="text" data-numero="1" inputmode="decimal" value="' + escaparHtml(String(datos.desc_valor)) + '">' +
              '</div>' +
            '</div>' +

            preSelect('iva_id', 'IVA', tiposIva.map(function (x) { return [x.id, x.nombre + ' (' + x.porcentaje + '%)']; }), datos.iva_id) +
            preSelect('irpf_id', 'IRPF', tiposIrpf.map(function (x) { return [x.id, x.nombre + ' (' + x.porcentaje + '%)']; }), datos.irpf_id) +
          '</div>' +

          '<div class="pre-bloque" id="pre-totales"></div>' +
        '</form>' +
      '</div>' +

      '<div class="pre-modal-pie">' +
        '<button type="button" class="boton-secundario" id="pre-form-cancelar">Cancelar</button>' +
        '<button type="submit" form="pre-form" class="boton-principal" id="pre-form-guardar">Guardar presupuesto</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(fondo);

  // ---- NO se cierra al tocar fuera (regla de formularios con trabajo dentro) ----
  fondo.querySelector('.pre-modal-cerrar').addEventListener('click', function () { preCerrarFormulario(fondo); });
  fondo.querySelector('#pre-form-cancelar').addEventListener('click', function () { preCerrarFormulario(fondo); });

  const btnNuevoCliente = fondo.querySelector('#pre-nuevo-cliente');
  btnNuevoCliente.addEventListener('click', function () {
    if (typeof abrirCreacionRapidaContacto !== 'function') {
      alert('El módulo de Clientes no está disponible.');
      return;
    }
    // Solo puede haber una ventana de nuevo cliente abierta a la vez.
    if (document.querySelector('.cli-modal-fondo')) return;
    btnNuevoCliente.disabled = true;

    abrirCreacionRapidaContacto('cliente', function (contacto) {
      const select = fondo.querySelector('#pre-campo-id_cliente');
      if (!select.querySelector('option[value="' + String(contacto.id) + '"]')) {
        const opcion = document.createElement('option');
        opcion.value = String(contacto.id);
        opcion.textContent = contacto.nombre_contacto;
        select.appendChild(opcion);
      }
      select.value = String(contacto.id);
      preActualizarFormulario(fondo, prefill);
    });

    // Se vuelve a permitir en cuanto la ventana de cliente desaparezca,
    // se haya guardado o cancelado.
    const vigilante = setInterval(function () {
      if (!document.querySelector('.cli-modal-fondo')) {
        btnNuevoCliente.disabled = false;
        clearInterval(vigilante);
      }
    }, 300);
  });

  fondo.querySelectorAll('#pre-form input, #pre-form select, #pre-form textarea').forEach(function (el) {
    el.addEventListener('input', function () { preActualizarFormulario(fondo, prefill); });
    el.addEventListener('change', function () { preActualizarFormulario(fondo, prefill); });
  });

  fondo.querySelector('#pre-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    preProcesarGuardado(fondo, original, prefill);
  });

  preActualizarFormulario(fondo, prefill);
}

function preCerrarFormulario(fondo) {
  fondo.remove();
  preDetallePrefill = null;
}

// Lee el formulario, recalcula y repinta la tarjeta de totales.
function preLeerFormulario(fondo) {
  const valor = function (id) {
    const el = fondo.querySelector('#pre-campo-' + id);
    return el ? el.value : '';
  };
  return {
    fecha: valor('fecha'),
    id_cliente: valor('id_cliente'),
    concepto: valor('concepto').trim(),
    subtotal: parsearNumero(valor('subtotal')),
    desc_tipo: valor('desc_tipo') === 'fixed' ? 'fixed' : 'percent',
    desc_valor: parsearNumero(valor('desc_valor')),
    iva_id: valor('iva_id'),
    irpf_id: valor('irpf_id')
  };
}

function preCalcularFormulario(datos, prefill) {
  const cliente = estado.clientes.find(function (c) { return String(c.id) === String(datos.id_cliente); }) || null;
  const tarifas = preTarifas();

  // El tipo del cliente manda siempre sobre el usado en la calculadora
  // (mapa 8.3). Si no hay cliente elegido todavía, se usa el de la
  // calculadora como referencia provisional.
  let tipo = cliente ? preTipoClientePorId(cliente.tipo) : null;
  if (!tipo && prefill && prefill.tipo_cliente_id) tipo = preTipoClientePorId(prefill.tipo_cliente_id);
  if (!tipo) tipo = preTiposCliente()[0];

  const iva = preTiposIva().find(function (x) { return x.id === datos.iva_id; }) || { porcentaje: 0 };
  const irpf = preTiposIrpf().find(function (x) { return x.id === datos.irpf_id; }) || { porcentaje: 0 };

  const totales = preTotalesDesdeSubtotal({
    subtotal: datos.subtotal,
    factorCliente: tipo ? tipo.factor : 1,
    compensacionPct: tarifas.compensacionPct,
    descTipo: datos.desc_tipo,
    descValor: datos.desc_valor,
    ivaPct: iva.porcentaje,
    irpfPct: irpf.porcentaje
  });

  return { totales: totales, cliente: cliente, tipo: tipo };
}

function preActualizarFormulario(fondo, prefill) {
  const datos = preLeerFormulario(fondo);
  const r = preCalcularFormulario(datos, prefill);

  // Línea informativa del cliente
  const info = fondo.querySelector('#pre-info-cliente');
  if (r.cliente) {
    info.hidden = false;
    info.textContent = [
      r.cliente.nombre_fiscal || r.cliente.nombre_contacto,
      r.cliente.nif || 'sin NIF',
      r.tipo ? r.tipo.etiqueta : '',
      r.tipo ? ('ajuste ' + (r.tipo.ajustePct >= 0 ? '+' : '') + r.tipo.ajustePct + '%') : ''
    ].filter(Boolean).join(' · ');
  } else {
    info.hidden = true;
  }

  // Aviso si el tipo usado en la calculadora no es el del cliente (mapa 8.3)
  const aviso = fondo.querySelector('#pre-aviso-tipo');
  if (prefill && prefill.tipo_cliente_id && r.cliente && r.tipo && String(prefill.tipo_cliente_id) !== String(r.tipo.id)) {
    const tipoCalc = preTipoClientePorId(prefill.tipo_cliente_id);
    aviso.hidden = false;
    aviso.textContent = 'El tipo de cliente utilizado en la calculadora (' +
      (tipoCalc ? tipoCalc.etiqueta : prefill.tipo_cliente_id) +
      ') no coincide con el tipo actual del cliente (' + r.tipo.etiqueta +
      '). El presupuesto se recalcula usando el tipo actual del cliente.';
  } else {
    aviso.hidden = true;
  }

  const t = r.totales;
  const signo = function (v) { return (Number(v) > 0 ? '+' : (Number(v) < 0 ? '−' : '')) + formatMoney(Math.abs(Number(v || 0))); };

  fondo.querySelector('#pre-totales').innerHTML =
    '<p class="pre-bloque-titulo">Resumen económico</p>' +
    preLinea('Subtotal', formatMoney(t.subtotal)) +
    preLinea('Ajuste por tipo de cliente (' + t.ajustePct + '%)', signo(t.ajusteImporte)) +
    preLinea('Compensación IRPF (' + t.compensacionPct + '%)', signo(t.compensacion)) +
    preLinea('Descuento especial', '−' + formatMoney(t.descImporte)) +
    preLinea('Base imponible', formatMoney(t.base), 'destacada') +
    preLinea('IVA (' + t.ivaPct + '%)', '+' + formatMoney(t.iva)) +
    preLinea('Retención IRPF (' + t.irpfPct + '%)', '−' + formatMoney(t.irpf)) +
    '<div class="pre-total-final"><span>TOTAL</span><strong>' + escaparHtml(formatMoney(t.total)) + '</strong></div>';
}

// ============================================================
// 9. GUARDADO
// ============================================================

function preMostrarError(fondo, campo, mensaje) {
  const input = fondo.querySelector('#pre-campo-' + campo);
  const p = fondo.querySelector('[data-error-de="' + campo + '"]');
  if (input) input.classList.add('pre-campo-error');
  if (p) { p.textContent = mensaje; p.hidden = false; }
}

function preLimpiarErrores(fondo) {
  fondo.querySelectorAll('.pre-campo-error').forEach(function (el) { el.classList.remove('pre-campo-error'); });
  fondo.querySelectorAll('[data-error-de]').forEach(function (el) { el.hidden = true; });
}

async function preProcesarGuardado(fondo, original, prefill) {
  preLimpiarErrores(fondo);
  const datos = preLeerFormulario(fondo);

  // Validaciones (mapa 8.6)
  let valido = true;
  if (!datos.fecha) { preMostrarError(fondo, 'fecha', 'Obligatoria'); valido = false; }
  if (!datos.id_cliente) {
    preMostrarError(fondo, 'id_cliente', 'Selecciona un cliente activo. Si no existe, créalo primero.');
    valido = false;
  }
  if (!valido) return;

  const cliente = estado.clientes.find(function (c) { return String(c.id) === String(datos.id_cliente); });
  if (!cliente) {
    preMostrarError(fondo, 'id_cliente', 'Ese cliente ya no existe.');
    return;
  }
  if (!estado.modoPrueba && esDePrueba(cliente)) {
    alert('Este cliente es de prueba y no puede utilizarse en un presupuesto real. Activa el modo prueba para trabajar con datos de prueba.');
    return;
  }
  if (original && preBloqueado(original)) {
    alert('Este presupuesto ya no se puede editar.');
    return;
  }

  const r = preCalcularFormulario(datos, prefill);
  const t = r.totales;

  const idPresupuesto = original ? original.id : preNuevoId('pres');

  // Los datos del cliente se congelan en el presupuesto (mapa 8.6).
  const registro = {
    id: idPresupuesto,
    id_presupuesto_origen: original ? (original.id_presupuesto_origen || '') : '',
    numero: original ? original.numero : preSiguienteNumero(),
    fecha: normalizarFecha(datos.fecha),
    id_cliente: cliente.id,
    cliente: cliente.nombre_fiscal || cliente.nombre_contacto || '',
    nif: cliente.nif || '',
    concepto: datos.concepto,
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
    estado: original ? (original.estado || 'pendiente') : 'pendiente'
  };

  const boton = fondo.querySelector('#pre-form-guardar');
  boton.disabled = true;
  boton.textContent = 'Guardando...';

  const detalleAGuardar = preDetallePrefill;

  const resultado = await guardarRegistro('presupuestos', registro, preRepintarLista, null);

  if (resultado.status !== 'success') {
    boton.disabled = false;
    boton.textContent = 'Guardar presupuesto';
    return;
  }

  const idFinal = (resultado.data && resultado.data.id) || idPresupuesto;

  // Si el presupuesto viene de la calculadora, se guarda su desglose
  // (operación separada, mapa 8.7).
  if (detalleAGuardar) {
    await preGuardarDetalle(idFinal, detalleAGuardar);
  }

  preDetallePrefill = null;
  fondo.remove();

  // Si el presupuesto venía de la calculadora, se deja limpia para el
  // siguiente trabajo.
  if (detalleAGuardar) {
    preCalc = Object.assign({}, PRE_CALC_VACIA, { equipos: [], servicios: [] });
    preCalcEditandoId = null;
    preAvisoCalculadora = '';
  }

  preSubvista = 'relacion';
  pintarPresupuestos();
}

/**
 * Guarda la fila de presupuestos_detalle. Solo hay una fila por
 * presupuesto, así que se reutiliza su id y se sobrescribe, en vez de
 * borrar y volver a crear (una sola llamada, sin quedarse nunca sin
 * detalle a mitad de camino).
 */
async function preGuardarDetalle(idPresupuesto, snapshot) {
  const existentes = estado.presupuestos_detalle.filter(function (d) {
    return String(d.id_presupuesto) === String(idPresupuesto);
  });

  const idDetalle = existentes.length ? existentes[0].id : preNuevoId('pdet');
  const fila = Object.assign({}, snapshot, { id: idDetalle, id_presupuesto: idPresupuesto });

  await guardarRegistro('presupuestos_detalle', fila, null, null);

  // Por si en algún momento quedaron filas duplicadas de un presupuesto.
  for (let i = 1; i < existentes.length; i++) {
    await borrarRegistro('presupuestos_detalle', existentes[i].id, null, null);
  }
}

// ============================================================
// 10. CALCULADORA
// ============================================================

function pintarCalculadora() {
  const zona = document.getElementById('pre-zona');
  if (!zona) return;

  const tiposCliente = preTiposCliente();
  const tiposIva = preTiposIva();
  const tiposIrpf = preTiposIrpf();
  const equipos = preEquipos();
  const servicios = preServicios();
  const t = preTarifas();

  if (!preCalc.tipo_cliente_id && tiposCliente[0]) preCalc.tipo_cliente_id = tiposCliente[0].id;
  if (!preCalc.iva_id && tiposIva[0]) preCalc.iva_id = tiposIva[0].id;
  if (!preCalc.irpf_id && tiposIrpf[0]) preCalc.irpf_id = tiposIrpf[0].id;

  const campo = function (clave, etiqueta, sufijo) {
    return '<div class="pre-campo-grupo">' +
      '<label for="pcalc-' + clave + '">' + escaparHtml(etiqueta) + (sufijo ? ' (' + sufijo + ')' : '') + '</label>' +
      '<input class="campo" id="pcalc-' + clave + '" data-calc="' + clave + '" type="text" data-numero="1" inputmode="decimal" value="' +
        escaparHtml(String(preCalc[clave] || '')) + '">' +
    '</div>';
  };

  zona.innerHTML =
    (preAvisoCalculadora ? '<p class="pre-nota aviso" style="margin-bottom:12px">' + escaparHtml(preAvisoCalculadora) + '</p>' : '') +

    '<div class="pre-calc-grid">' +

      '<div class="pre-tarjeta">' +
        '<p class="pre-tarjeta-titulo">Trabajo</p>' +
        '<div class="pre-form-grid">' +
          '<div class="pre-campo-grupo"><label for="pcalc-concepto">Concepto</label>' +
            '<input class="campo" id="pcalc-concepto" data-calc="concepto" type="text" value="' + escaparHtml(preCalc.concepto || '') + '"></div>' +
        '</div>' +
        '<div class="pre-form-grid dos-columnas" style="margin-top:12px">' +
          campo('horas_trabajo', 'Horas de trabajo') +
          campo('horas_noche', 'De noche o festivo') +
          campo('horas_edicion', 'Horas de edición') +
          campo('desplaz_horas', 'Horas de desplazamiento') +
          campo('desplaz_km', 'Kilómetros') +
        '</div>' +
        '<p class="pre-nota" id="pcalc-noche-aviso" hidden></p>' +
        '<p class="pre-nota">Tarifas: ' + escaparHtml(formatMoney(t.trabajo)) + '/h · edición ' + escaparHtml(formatMoney(t.edicion)) +
          '/h · desplazamiento ' + escaparHtml(formatMoney(t.desplazHora)) + '/h y ' + escaparHtml(formatMoney(t.km)) +
          '/km · recargo noche +' + t.incrementoNochePct + '%.</p>' +
      '</div>' +

      '<div class="pre-tarjeta pre-calc-resultado" id="pcalc-resultado"></div>' +

      '<div class="pre-tarjeta">' +
        '<p class="pre-tarjeta-titulo">Gastos directos</p>' +
        '<div class="pre-form-grid dos-columnas">' +
          campo('gasto_salarios', 'Salarios') +
          campo('gasto_materiales', 'Materiales') +
          campo('gasto_dietas', 'Dietas') +
          campo('gasto_otros', 'Otros') +
        '</div>' +
        '<p class="pre-nota">Se repercuten al cliente con un margen del ' + t.margenGastosPct + '%.</p>' +
      '</div>' +

      '<div class="pre-tarjeta">' +
        '<p class="pre-tarjeta-titulo">Cliente e impuestos</p>' +
        '<div class="pre-form-grid dos-columnas">' +
          '<div class="pre-campo-grupo"><label for="pcalc-tipo_cliente_id">Tipo de cliente</label>' +
            '<select class="campo" id="pcalc-tipo_cliente_id" data-calc="tipo_cliente_id">' +
              tiposCliente.map(function (x) {
                return '<option value="' + escaparHtml(x.id) + '"' + (x.id === preCalc.tipo_cliente_id ? ' selected' : '') + '>' +
                  escaparHtml(x.etiqueta) + ' (' + (x.ajustePct >= 0 ? '+' : '') + x.ajustePct + '%)</option>';
              }).join('') +
            '</select></div>' +
          '<div class="pre-campo-grupo"><label for="pcalc-desc_valor">Descuento especial</label>' +
            '<div class="pre-fila-doble">' +
              '<select class="campo pre-descuento-tipo" id="pcalc-desc_tipo" data-calc="desc_tipo">' +
                '<option value="percent"' + (preCalc.desc_tipo === 'percent' ? ' selected' : '') + '>Porcentaje</option>' +
                '<option value="fixed"' + (preCalc.desc_tipo === 'fixed' ? ' selected' : '') + '>Euros</option>' +
              '</select>' +
              '<input class="campo" id="pcalc-desc_valor" data-calc="desc_valor" type="text" data-numero="1" inputmode="decimal" value="' + escaparHtml(String(preCalc.desc_valor || '')) + '">' +
            '</div></div>' +
          '<div class="pre-campo-grupo"><label for="pcalc-iva_id">IVA</label>' +
            '<select class="campo" id="pcalc-iva_id" data-calc="iva_id">' +
              tiposIva.map(function (x) {
                return '<option value="' + escaparHtml(x.id) + '"' + (x.id === preCalc.iva_id ? ' selected' : '') + '>' +
                  escaparHtml(x.nombre) + ' (' + x.porcentaje + '%)</option>';
              }).join('') +
            '</select></div>' +
          '<div class="pre-campo-grupo"><label for="pcalc-irpf_id">IRPF</label>' +
            '<select class="campo" id="pcalc-irpf_id" data-calc="irpf_id">' +
              tiposIrpf.map(function (x) {
                return '<option value="' + escaparHtml(x.id) + '"' + (x.id === preCalc.irpf_id ? ' selected' : '') + '>' +
                  escaparHtml(x.nombre) + ' (' + x.porcentaje + '%)</option>';
              }).join('') +
            '</select></div>' +
        '</div>' +
      '</div>' +

      '<div class="pre-tarjeta">' +
        '<p class="pre-tarjeta-titulo">Equipos</p>' +
        (equipos.length
          ? '<div class="pre-casillas">' + equipos.map(function (e) {
              return '<label class="pre-casilla"><input type="checkbox" data-equipo="' + escaparHtml(e.id) + '"' +
                (preCalc.equipos.indexOf(e.id) !== -1 ? ' checked' : '') + '>' +
                '<span>' + escaparHtml(e.nombre) + '</span><em>' + escaparHtml(formatMoney(e.precio)) + '</em></label>';
            }).join('') + '</div>'
          : '<p class="pre-nota">No hay equipos definidos en Configuración.</p>') +
      '</div>' +

      '<div class="pre-tarjeta">' +
        '<p class="pre-tarjeta-titulo">Servicios extra</p>' +
        (servicios.length
          ? '<div class="pre-casillas">' + servicios.map(function (s) {
              const etiqueta = s.tipo === 'porcentaje' ? ('+' + s.valor + '% horas trabajo') : formatMoney(s.valor);
              return '<label class="pre-casilla"><input type="checkbox" data-servicio="' + escaparHtml(s.id) + '"' +
                (preCalc.servicios.indexOf(s.id) !== -1 ? ' checked' : '') + '>' +
                '<span>' + escaparHtml(s.nombre) + '</span><em>' + escaparHtml(etiqueta) + '</em></label>';
            }).join('') + '</div>'
          : '<p class="pre-nota">No hay servicios extra definidos en Configuración.</p>') +
      '</div>' +

    '</div>';

  // Cableado: cualquier cambio recalcula al momento
  zona.querySelectorAll('[data-calc]').forEach(function (el) {
    const guardar = function () {
      preCalc[el.dataset.calc] = el.value;
      preRecalcularCalculadora();
    };
    el.addEventListener('input', guardar);
    el.addEventListener('change', guardar);
  });

  zona.querySelectorAll('[data-equipo]').forEach(function (cb) {
    cb.addEventListener('change', function () {
      const id = cb.dataset.equipo;
      preCalc.equipos = cb.checked
        ? preCalc.equipos.concat([id])
        : preCalc.equipos.filter(function (x) { return x !== id; });
      preRecalcularCalculadora();
    });
  });

  zona.querySelectorAll('[data-servicio]').forEach(function (cb) {
    cb.addEventListener('change', function () {
      const id = cb.dataset.servicio;
      preCalc.servicios = cb.checked
        ? preCalc.servicios.concat([id])
        : preCalc.servicios.filter(function (x) { return x !== id; });
      preRecalcularCalculadora();
    });
  });

  preRecalcularCalculadora();
}

function preRecalcularCalculadora() {
  const caja = document.getElementById('pcalc-resultado');
  if (!caja) return;

  const r = preCalcularCalculadora(preCalc);

  // Aviso y corrección si las horas de noche superan las de trabajo
  const avisoNoche = document.getElementById('pcalc-noche-aviso');
  if (avisoNoche) {
    avisoNoche.hidden = !r.nocheCorregida;
    if (r.nocheCorregida) {
      avisoNoche.textContent = 'Las horas de noche o festivo no pueden superar las horas de trabajo. Se han ajustado a ' + r.horasNoche + ' h.';
      // Solo se corrige el campo si no se está escribiendo en él, para
      // no pelearse con el teclado mientras se teclea.
      const campoNoche = document.getElementById('pcalc-horas_noche');
      if (campoNoche && document.activeElement !== campoNoche && parsearNumero(campoNoche.value) !== r.horasNoche) {
        campoNoche.value = String(r.horasNoche);
        preCalc.horas_noche = String(r.horasNoche);
      }
    }
  }

  const signo = function (v) { return (Number(v) > 0 ? '+' : (Number(v) < 0 ? '−' : '')) + formatMoney(Math.abs(Number(v || 0))); };

  caja.innerHTML =
    '<p class="pre-tarjeta-titulo">Resultado</p>' +
    preLinea('Horas de trabajo', formatMoney(r.costeHorasTrabajo)) +
    preLinea('Horas de edición', formatMoney(r.costeEdicion)) +
    preLinea('Desplazamiento', formatMoney(r.costeDesplazamiento)) +
    preLinea('Equipos', formatMoney(r.costeEquipos)) +
    preLinea('Gastos con margen', formatMoney(r.gastosConMargen)) +
    preLinea('Servicios extra', formatMoney(r.costeServicios)) +
    preLinea('Subtotal', formatMoney(r.subtotal), 'destacada') +
    preLinea('Ajuste por tipo de cliente (' + r.ajustePct + '%)', signo(r.ajusteImporte)) +
    preLinea('Compensación IRPF (' + r.compensacionPct + '%)', signo(r.compensacion)) +
    preLinea('Descuento especial', '−' + formatMoney(r.descImporte)) +
    preLinea('Base imponible', formatMoney(r.base), 'destacada') +
    preLinea('IVA (' + r.ivaPct + '%)', '+' + formatMoney(r.iva)) +
    preLinea('Retención IRPF (' + r.irpfPct + '%)', '−' + formatMoney(r.irpf)) +
    '<div class="pre-total-final"><span>TOTAL</span><strong>' + escaparHtml(formatMoney(r.total)) + '</strong></div>' +

    '<p class="pre-tarjeta-titulo" style="margin-top:16px">Rentabilidad interna</p>' +
    '<div class="pre-linea"><span>Resultado del trabajo</span><strong' +
      (r.resultadoTrabajo < 0 ? ' class="pre-negativo"' : '') + '>' + escaparHtml(formatMoney(r.resultadoTrabajo)) + '</strong></div>' +
    preLinea('Reserva de IRPF (' + r.compensacionPct + '%)', '−' + formatMoney(r.reservaIrpf)) +
    '<div class="pre-linea destacada"><span>Disponible estimado</span><strong' +
      (r.disponible < 0 ? ' class="pre-negativo"' : '') + '>' + escaparHtml(formatMoney(r.disponible)) + '</strong></div>' +

    '<div style="display:flex;gap:8px;margin-top:14px">' +
      '<button type="button" class="boton-secundario" id="pcalc-limpiar" style="flex:1">Limpiar</button>' +
      '<button type="button" class="boton-principal" id="pcalc-usar" style="flex:1">' +
        (preCalcEditandoId ? 'Guardar cambios' : 'Crear presupuesto') +
      '</button>' +
    '</div>';

  document.getElementById('pcalc-limpiar').addEventListener('click', preLimpiarCalculadora);
  document.getElementById('pcalc-usar').addEventListener('click', preUsarCalculadora);
}

function preLimpiarCalculadora() {
  if (!confirm('Vaciar la calculadora y empezar de cero?')) return;
  preCalc = Object.assign({}, PRE_CALC_VACIA, { equipos: [], servicios: [] });
  preAvisoCalculadora = '';
  preCalcEditandoId = null;
  pintarCalculadora();
}

// Instantánea de la calculadora, con la estructura exacta de las 24
// columnas de presupuestos_detalle. Los equipos y servicios guardan su
// ID real además del nombre (decisión B5).
function preSnapshotCalculadora(r) {
  const t = preTarifas();
  return {
    concepto_calculadora: preCalc.concepto || '',
    horas_trabajo: parsearNumero(preCalc.horas_trabajo),
    horas_noche_festivo: r.horasNoche,
    horas_edicion: parsearNumero(preCalc.horas_edicion),
    horas_desplazamiento: parsearNumero(preCalc.desplaz_horas),
    kilometros_desplazamiento: parsearNumero(preCalc.desplaz_km),
    gasto_salarios: parsearNumero(preCalc.gasto_salarios),
    gasto_materiales: parsearNumero(preCalc.gasto_materiales),
    gasto_dietas: parsearNumero(preCalc.gasto_dietas),
    gasto_otros: parsearNumero(preCalc.gasto_otros),
    margen_otros_gastos_pct: t.margenGastosPct,
    precio_hora_trabajo: t.trabajo,
    incremento_noche_pct: t.incrementoNochePct,
    precio_hora_edicion: t.edicion,
    precio_hora_desplazamiento: t.desplazHora,
    precio_km: t.km,
    equipos_json: JSON.stringify(r.equiposElegidos.map(function (e) {
      return { id: e.id, nombre: e.nombre, precio: e.precio };
    })),
    servicios_extra_json: JSON.stringify(r.serviciosElegidos.map(function (s) {
      return { id: s.id, nombre: s.nombre, tipo: s.tipo, valor: s.valor };
    })),
    subtotal_calculadora: r.subtotal,
    tipo_cliente_id: r.tipoCliente ? r.tipoCliente.id : '',
    iva_id: r.iva ? r.iva.id : '',
    irpf_id: r.irpf ? r.irpf.id : ''
  };
}

// Paso de la calculadora al presupuesto (mapa 7.4). El subtotal se pasa
// como número directo, no leyendo el texto de la pantalla.
function preUsarCalculadora() {
  // Si se está editando un presupuesto que ya no es editable (por
  // ejemplo, se aceptó desde otro dispositivo), no se sigue.
  if (preCalcEditandoId) {
    const existente = estado.presupuestos.find(function (x) { return String(x.id) === String(preCalcEditandoId); });
    if (!existente) {
      alert('El presupuesto que estabas editando ya no existe. Se creará uno nuevo.');
      preCalcEditandoId = null;
    } else if (preBloqueado(existente)) {
      alert('Este presupuesto ya no se puede editar.');
      return;
    }
  }

  const r = preCalcularCalculadora(preCalc);
  preDetallePrefill = preSnapshotCalculadora(r);

  abrirFormularioPresupuesto(preCalcEditandoId || null, {
    concepto: preCalc.concepto || '',
    subtotal: r.subtotal,
    desc_tipo: preCalc.desc_tipo,
    desc_valor: parsearNumero(preCalc.desc_valor),
    iva_id: r.iva ? r.iva.id : '',
    irpf_id: r.irpf ? r.irpf.id : '',
    tipo_cliente_id: r.tipoCliente ? r.tipoCliente.id : ''
  });
}

// Recuperación de un presupuesto en la calculadora (mapa 7.5). Ahora se
// leen los IDs guardados; solo si faltan (filas antiguas) se recurre a
// buscar por porcentaje.
function preEditarEnCalculadora(id) {
  const p = estado.presupuestos.find(function (x) { return String(x.id) === String(id); });
  const d = preDetalleDe(id);
  if (!p || !d) {
    alert('Este presupuesto no tiene guardado el desglose de la calculadora.');
    return;
  }

  let equipos = [];
  let servicios = [];
  try { equipos = JSON.parse(d.equipos_json || '[]') || []; } catch (err) { equipos = []; }
  try { servicios = JSON.parse(d.servicios_extra_json || '[]') || []; } catch (err) { servicios = []; }

  const idsEquipos = preEquipos().map(function (e) { return e.id; });
  const idsServicios = preServicios().map(function (s) { return s.id; });

  const tiposIva = preTiposIva();
  const tiposIrpf = preTiposIrpf();
  let ivaId = d.iva_id ? String(d.iva_id) : '';
  let irpfId = d.irpf_id ? String(d.irpf_id) : '';
  if (!tiposIva.some(function (x) { return x.id === ivaId; })) {
    const enc = tiposIva.find(function (x) { return Math.abs(x.porcentaje - parsearNumero(p.iva_pct)) < 0.01; });
    ivaId = enc ? enc.id : (tiposIva[0] ? tiposIva[0].id : '');
  }
  if (!tiposIrpf.some(function (x) { return x.id === irpfId; })) {
    const enc = tiposIrpf.find(function (x) { return Math.abs(x.porcentaje - parsearNumero(p.irpf_pct)) < 0.01; });
    irpfId = enc ? enc.id : (tiposIrpf[0] ? tiposIrpf[0].id : '');
  }

  preCalc = {
    concepto: d.concepto_calculadora || p.concepto || '',
    horas_trabajo: String(parsearNumero(d.horas_trabajo) || ''),
    horas_noche: String(parsearNumero(d.horas_noche_festivo) || ''),
    horas_edicion: String(parsearNumero(d.horas_edicion) || ''),
    desplaz_horas: String(parsearNumero(d.horas_desplazamiento) || ''),
    desplaz_km: String(parsearNumero(d.kilometros_desplazamiento) || ''),
    gasto_salarios: String(parsearNumero(d.gasto_salarios) || ''),
    gasto_materiales: String(parsearNumero(d.gasto_materiales) || ''),
    gasto_dietas: String(parsearNumero(d.gasto_dietas) || ''),
    gasto_otros: String(parsearNumero(d.gasto_otros) || ''),
    tipo_cliente_id: d.tipo_cliente_id ? String(d.tipo_cliente_id) : '',
    iva_id: ivaId,
    irpf_id: irpfId,
    desc_tipo: String(p.descuento_especial_tipo) === 'fixed' ? 'fixed' : 'percent',
    desc_valor: String(parsearNumero(p.descuento_especial_valor) || ''),
    equipos: equipos.map(function (e) { return String(e.id || ''); }).filter(function (x) { return idsEquipos.indexOf(x) !== -1; }),
    servicios: servicios.map(function (s) { return String(s.id || ''); }).filter(function (x) { return idsServicios.indexOf(x) !== -1; })
  };

  const perdidos = (equipos.length - preCalc.equipos.length) + (servicios.length - preCalc.servicios.length);
  preCalcEditandoId = preBloqueado(p) ? null : p.id;
  preAvisoCalculadora = (preCalcEditandoId
      ? 'Editando el presupuesto ' + (p.numero || '') + ' en la calculadora. Cuando termines, pulsa "Guardar cambios": se actualizará ese mismo presupuesto, no se creará otro.'
      : 'Calculadora recuperada del presupuesto ' + (p.numero || '') + '. Ese presupuesto ya no se puede editar, así que al terminar se creará uno nuevo.') +
    (perdidos > 0 ? ' Aviso: ' + perdidos + ' equipo(s)/servicio(s) ya no existen en Configuración y no se han podido marcar.' : '');

  preSubvista = 'calculadora';
  pintarPresupuestos();
}

// ============================================================
// 11. REGISTRO COMO VISTA
// ============================================================

registrarVista('presupuestos', {
  titulo: 'Presupuestos',
  pintar: pintarPresupuestos
});
