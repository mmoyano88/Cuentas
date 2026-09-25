/**
 * MÓDULO DASHBOARD (pantalla de Inicio)
 * ------------------------------------------------------------
 * Primera pantalla que se ve al abrir la aplicación. Resumen visual
 * del negocio: seis tarjetas de colores y cinco gráficos.
 *
 * DOS CIFRAS POR TARJETA 🔒 (mapa 14.2), concepto clave de esta
 * pantalla y decisión mantenida por el propietario:
 *
 *   · ECONÓMICO  → se calcula sobre `base` (sin impuestos). Es el
 *     resultado real del negocio, lo que de verdad se gana.
 *   · TESORERÍA  → se calcula sobre `total` (con impuestos). Es el
 *     dinero que entra o sale del banco.
 *
 * Los apuntes que son PAGOS DE IMPUESTOS se excluyen del cálculo
 * económico pero SÍ cuentan en tesorería: pagar el IVA no es un gasto
 * del negocio, es devolver dinero que nunca fue tuyo, pero sale del
 * banco igual.
 *
 * SOLO DINERO QUE SE HA MOVIDO DE VERDAD (decisión del propietario,
 * 23/09/2026): ingresos, gastos, beneficio, media, gráfico de líneas y
 * donuts se calculan únicamente con los apuntes de Contabilidad —lo
 * cobrado y lo pagado—, con la fecha del cobro o del pago. Una factura
 * emitida pero sin cobrar (o recibida y sin pagar) no cuenta aquí
 * hasta que se cobra o se paga. Es lo que ya hacía la app original
 * (mapa 14.2). Antes de este cambio se contaban las facturas por su
 * fecha aunque no estuvieran cobradas, y la cifra "Cobrado" incluía
 * dinero que no había entrado.
 *
 * La EXCEPCIÓN son las tarjetas de impuestos (5 y 6): para Hacienda una
 * factura cuenta desde que se emite, esté cobrada o no, así que esas
 * dos siguen usando las facturas, igual que la pantalla de Impuestos.
 *
 * PERSPECTIVAS: Empresa · Personal · Total. Filtran por el `ambito`
 * de los apuntes. «Total» no filtra. Las facturas son siempre de
 * empresa por naturaleza, así que en la perspectiva Personal no
 * entran.
 *
 * Las tarjetas 5 y 6 (impuestos) NO dependen de la perspectiva: los
 * impuestos son siempre de la actividad económica, nunca personales.
 * Muestran lo mismo en las tres (decisión del propietario), en vez de
 * quedarse a cero en Personal como hacía la app original.
 *
 * Los datos de impuestos se piden directamente a las funciones de
 * `mod-impuestos.js` (`impProximoPago`, `impFacturasSinCobrar`...), NO leyendo el
 * texto ya pintado en esa pantalla como hacía la app original
 * (decisión I6 de la guía: aquello era un acoplamiento frágil vía DOM
 * que se rompía si esa pantalla no estaba abierta).
 */

// ============================================================
// 0. ESTADO PROPIO DEL MÓDULO
// ============================================================

let dashPerspectiva = 'total';   // 'empresa' | 'personal' | 'total'

// Las instancias de Chart.js se guardan para poder destruirlas antes
// de volver a pintar: si no, cada repintado deja el gráfico anterior
// vivo por debajo y la memoria crece sin parar.
const dashGraficos = {};

const DASH_PERSPECTIVAS = [
  { id: 'empresa',  etiqueta: 'Empresa' },
  { id: 'personal', etiqueta: 'Personal' },
  { id: 'total',    etiqueta: 'Total' }
];

function dashEtiquetaPerspectiva() {
  const p = DASH_PERSPECTIVAS.find(function (x) { return x.id === dashPerspectiva; });
  return p ? p.etiqueta : 'Total';
}

// ============================================================
// 1. UTILIDADES
// ============================================================

function dashTexto(v) {
  return String(v === null || v === undefined ? '' : v).trim();
}

// Un apunte es un pago de impuestos si viene del módulo de Impuestos.
// Se comprueba igual que en Contabilidad (mapa 14.2).
function dashEsPagoImpuestos(a) {
  return !!a.id_impuesto && ['iva', 'irpf'].indexOf(dashTexto(a.impuesto_pago)) !== -1;
}

// «2026-09» a partir de una fecha ISO. Sirve de clave para agrupar
// por mes sin líos de zona horaria.
function dashClaveMes(iso) {
  const f = normalizarFecha(iso);
  if (!f) return null;
  const p = dashTexto(f).split('-');
  if (p.length < 2) return null;
  return p[0] + '-' + p[1];
}

function dashEtiquetaMes(clave) {
  const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const p = dashTexto(clave).split('-');
  const mes = parseInt(p[1], 10);
  if (!(mes >= 1 && mes <= 12)) return clave;
  return MESES[mes - 1] + ' ' + dashTexto(p[0]).slice(2);
}

// Los 12 meses COMPLETOS anteriores al actual, del más antiguo al más
// reciente. El mes en curso NO entra: está a medias y hundiría la
// media (decisión del propietario: "si estamos a mediados de
// septiembre, contamos desde octubre del año anterior, octubre
// completo").
function dashUltimos12Meses() {
  const hoy = new Date();
  const claves = [];
  for (let i = 12; i >= 1; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    claves.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
  }
  return claves;
}

// ÚLTIMOS 365 DÍAS HASTA HOY (23/09/2026, decisión del propietario).
// Sustituye a "los 12 meses completos" en los donuts y en la media
// mensual: así cuentan también el mes en curso y los datos no se
// quedan un mes atrás. Ventana: desde hace 364 días hasta hoy, ambos
// incluidos (365 días justos). Lo fechado en el futuro no entra.
function dashIsoLocal(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function dashVentana365() {
  const hoy = new Date();
  const desde = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 364);
  return { desde: dashIsoLocal(desde), hasta: dashIsoLocal(hoy) };
}

function dashEnVentana(fechaIso, ventana) {
  return !!fechaIso && fechaIso >= ventana.desde && fechaIso <= ventana.hasta;
}

// Día del primer movimiento de dinero registrado, para la media sobre
// 365 días.
function dashDiaInicioActividad() {
  let minimo = null;
  estado.apuntes.forEach(function (a) {
    const f = normalizarFecha(a.fecha);
    if (!f) return;
    if (minimo === null || f < minimo) minimo = f;
  });
  return minimo;
}

// ============================================================
// 2. RECOGIDA DE MOVIMIENTOS
// ============================================================
// Todo el dashboard trabaja sobre una lista única y normalizada de
// movimientos: los apuntes de Contabilidad, que son el dinero que ha
// entrado o salido de verdad. Incluye los apuntes que vienen de una
// factura cobrada o pagada (llevan el cliente o proveedor de esa
// factura) y los manuales. Las facturas en sí no se leen aquí: una
// factura sin cobrar no es dinero todavía (23/09/2026).
//
// Cada movimiento lleva: mes, fecha, tipo (ingreso/gasto), ámbito, si
// es un pago de impuestos, su importe económico (base), su importe de
// tesorería (total) y su contacto REGISTRADO (id_contacto). Un
// contacto_libre (nombre suelto sin registrar) no cuenta para los
// donuts de clientes y proveedores, tal como se decidió.

function dashMovimientos() {
  const lista = [];
  estado.apuntes.forEach(function (a) {
    const mes = dashClaveMes(a.fecha);
    if (!mes) return;
    lista.push({
      mes: mes,
      fecha: normalizarFecha(a.fecha),
      tipo: dashTexto(a.tipo) === 'ingreso' ? 'ingreso' : 'gasto',
      ambito: dashTexto(a.ambito) === 'personal' ? 'personal' : 'empresa',
      pagoImpuestos: dashEsPagoImpuestos(a),
      base: parsearNumero(a.base),
      total: parsearNumero(a.total),
      idContacto: a.id_contacto || ''
    });
  });
  return lista;
}

function dashFiltrarPerspectiva(movimientos, perspectiva) {
  if (perspectiva === 'total') return movimientos;
  return movimientos.filter(function (m) { return m.ambito === perspectiva; });
}

// ============================================================
// 3. CÁLCULO DE LAS TARJETAS 🔒
// ============================================================

// Suma económica y de tesorería de una lista de movimientos.
// El económico deja fuera los pagos de impuestos (mapa 14.2).
function dashTotales(movimientos) {
  let ingresos = 0, gastos = 0, tesIngresos = 0, tesGastos = 0;

  movimientos.forEach(function (m) {
    if (m.tipo === 'ingreso') {
      if (!m.pagoImpuestos) ingresos += m.base;
      tesIngresos += m.total;
    } else {
      if (!m.pagoImpuestos) gastos += m.base;
      tesGastos += m.total;
    }
  });

  return {
    ingresos: roundMoney(ingresos),
    gastos: roundMoney(gastos),
    beneficio: roundMoney(ingresos - gastos),
    tesIngresos: roundMoney(tesIngresos),
    tesGastos: roundMoney(tesGastos),
    tesNeta: roundMoney(tesIngresos - tesGastos)
  };
}

// Media mensual sobre los ÚLTIMOS 365 DÍAS hasta hoy 🔒
// (regla del propietario; el 23/09/2026 pasó de "12 meses completos"
// a "365 días hasta hoy", para que cuente también el mes en curso):
//   · Se suma lo de los últimos 365 días y se divide entre 12.
//   · Un periodo sin actividad cuenta como CERO, no se descarta — la
//     media busca aproximar "un sueldo medio" para ver la viabilidad
//     del negocio, y un mes sin ingresos también forma parte de eso.
//   · PERO no se cuenta el tiempo anterior al primer movimiento
//     registrado: si la actividad empezó hace 3 meses, se divide
//     entre 3, no entre 12. Se calcula en días (días de actividad
//     dentro de la ventana ÷ 30,42) y nunca por debajo de 1 mes, para
//     que en las primeras semanas la media no salga disparada.
const DASH_DIAS_POR_MES = 365 / 12;

function dashMediaMensual(movimientos) {
  const ventana = dashVentana365();
  const inicio = dashDiaInicioActividad();
  if (!inicio || inicio > ventana.hasta) {
    return { beneficio: 0, tesoreria: 0, meses: 0 };
  }

  const desde = inicio > ventana.desde ? inicio : ventana.desde;
  const p = desde.split('-').map(Number), h = ventana.hasta.split('-').map(Number);
  const dias = Math.round((new Date(h[0], h[1] - 1, h[2]) - new Date(p[0], p[1] - 1, p[2])) / 86400000) + 1;
  const meses = Math.min(12, Math.max(1, dias / DASH_DIAS_POR_MES));

  const enVentana = movimientos.filter(function (m) { return dashEnVentana(m.fecha, ventana); });
  const t = dashTotales(enVentana);

  return {
    beneficio: roundMoney(t.beneficio / meses),
    tesoreria: roundMoney(t.tesNeta / meses),
    meses: Math.round(meses)
  };
}

// Datos mes a mes para el gráfico grande de líneas: los 12 meses
// completos y, al final, el mes en curso (23/09/2026). El mes en curso
// va marcado como "en curso" y se dibuja punteado y con el punto
// hueco, para que no se lea como una bajada: todavía está a medias.
function dashMesActual() {
  const hoy = new Date();
  return hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0');
}

function dashSerieMensual(movimientos) {
  const meses = dashUltimos12Meses().concat([dashMesActual()]);
  const porMes = {};
  meses.forEach(function (m) { porMes[m] = { ingresos: 0, gastos: 0 }; });

  movimientos.forEach(function (m) {
    if (!porMes[m.mes]) return;
    if (m.pagoImpuestos) return;   // el gráfico es económico, sin impuestos
    if (m.tipo === 'ingreso') porMes[m.mes].ingresos += m.base;
    else porMes[m.mes].gastos += m.base;
  });

  return {
    etiquetas: meses.map(function (m, i) {
      return i === meses.length - 1 ? dashEtiquetaMes(m) + ' (en curso)' : dashEtiquetaMes(m);
    }),
    ingresos: meses.map(function (m) { return roundMoney(porMes[m].ingresos); }),
    gastos: meses.map(function (m) { return roundMoney(porMes[m].gastos); }),
    beneficio: meses.map(function (m) { return roundMoney(porMes[m].ingresos - porMes[m].gastos); })
  };
}

// ============================================================
// 4. DATOS DE LOS GRÁFICOS CIRCULARES
// ============================================================
// Clientes/Proveedores SÍ reaccionan al selector de perspectiva
// (empresa/personal/total) desde el 09/09/2026 — antes eran fijos,
// pero al fusionarse con los apuntes manuales de empresa con contacto
// registrado, tiene sentido poder aislar solo esa parte. Ingresos y
// Gastos por ámbito siguen fijos: su propio eje YA es empresa/
// personal, filtrarlos por perspectiva los dejaría casi siempre con
// una sola porción. Todos miran los últimos 365 días hasta hoy
// (23/09/2026; antes, los 12 meses completos sin el mes en curso).

// Nombre de contacto primero (25/09/2026): los donuts son para que el
// propietario reconozca de un vistazo a quién corresponde cada parte;
// el nombre fiscal queda para lo oficial (PDF, Informes).
function dashNombreContacto(id) {
  const c = estado.clientes.find(function (x) { return String(x.id) === String(id); });
  return c ? (dashTexto(c.nombre_contacto) || dashTexto(c.nombre_fiscal) || 'Sin nombre') : '';
}

// Top 5 por base + «Otros» agrupando el resto. Cuenta solo lo cobrado
// (clientes) o pagado (proveedores), filtrado por la perspectiva activa
// del Dashboard. Solo cuentan los movimientos con un contacto
// REGISTRADO (idContacto): un apunte con contacto_libre no tiene un id
// de cliente/proveedor real al que sumar, así que se queda fuera.
function dashConcentracionPorTipo(tipo, perspectiva) {
  const ventana = dashVentana365();
  const porContacto = {};

  dashMovimientos().forEach(function (m) {
    if (m.tipo !== tipo) return;
    if (m.pagoImpuestos) return;
    if (!m.idContacto) return;
    if (perspectiva !== 'total' && m.ambito !== perspectiva) return;
    if (!dashEnVentana(m.fecha, ventana)) return;
    const nombre = dashNombreContacto(m.idContacto);
    if (!nombre) return; // contacto ya no existe en Clientes
    porContacto[nombre] = (porContacto[nombre] || 0) + m.base;
  });

  const orden = Object.keys(porContacto)
    .map(function (n) { return { nombre: n, importe: roundMoney(porContacto[n]) }; })
    .filter(function (x) { return x.importe > 0; })
    .sort(function (a, b) { return b.importe - a.importe; });

  const top = orden.slice(0, 5);
  const resto = orden.slice(5);
  if (resto.length > 0) {
    top.push({
      nombre: 'Otros (' + resto.length + ')',
      importe: roundMoney(resto.reduce(function (s, x) { return s + x.importe; }, 0))
    });
  }

  return top;
}

function dashConcentracionClientes(perspectiva) {
  return dashConcentracionPorTipo('ingreso', perspectiva);
}

function dashConcentracionProveedores(perspectiva) {
  return dashConcentracionPorTipo('gasto', perspectiva);
}

// Empresa contra personal, sobre los últimos 365 días. Sin pagos de
// impuestos: es una comparación económica, no de tesorería.
function dashPorAmbito(tipo) {
  const ventana = dashVentana365();
  let empresa = 0, personal = 0;

  dashMovimientos().forEach(function (m) {
    if (m.tipo !== tipo) return;
    if (m.pagoImpuestos) return;
    if (!dashEnVentana(m.fecha, ventana)) return;
    if (m.ambito === 'personal') personal += m.base;
    else empresa += m.base;
  });

  return { empresa: roundMoney(empresa), personal: roundMoney(personal) };
}

// ============================================================
// 5. TARJETAS DE IMPUESTOS (5 y 6)
// ============================================================
// Llaman directamente a las funciones del módulo de Impuestos
// (decisión I6). No dependen de la perspectiva: los impuestos son
// siempre de la actividad económica.

// Rediseño del 25/09/2026, a petición del propietario:
//   · Tarjeta 5, "Próximo pago Qx": lo que queda por pagar del
//     trimestre que toca pagar (el último terminado si aún no está
//     marcado como pagado; si no, el que está en curso), con el plazo.
//   · Tarjeta 6, "Te deben": el total de las facturas de venta activas
//     sin cobrar, y de eso los impuestos que se adelantan a Hacienda
//     (ya adelantados + los del próximo pago).
// Mismo formato que el resto de tarjetas: título, una cifra y una
// línea pequeña, para no cambiar su tamaño.

function dashImpuestos() {
  const disponible = typeof impProximoPago === 'function' &&
    typeof impPendienteDePago === 'function' &&
    typeof impEstadoPlazo === 'function' &&
    typeof impFacturasSinCobrar === 'function';

  if (!disponible) {
    return { trimestre: fvTrimestreDeFecha(fechaHoyISO()), pendiente: 0, plazo: '', teDeben: 0, adelantas: 0 };
  }

  const proximo = impProximoPago();
  const pendiente = impPendienteDePago(proximo.anio, proximo.trimestre);
  const plazo = impEstadoPlazo(proximo.anio, proximo.trimestre);
  const sinCobrar = impFacturasSinCobrar();

  return {
    trimestre: proximo.trimestre,
    pendiente: pendiente.total,
    plazo: plazo.corto,
    teDeben: sinCobrar.total,
    adelantas: roundMoney(sinCobrar.yaAdelantado + sinCobrar.enProximo)
  };
}

// ============================================================
// 5.1 INFO DEL DASHBOARD (tarjeta desplegable)
// ============================================================
// Sustituye a la nota de texto suelta que iba debajo de los donuts
// (25/09/2026, a petición del propietario: "me chirría ahí"). Misma
// información, pero en una tarjeta plegable, punto por punto por cada
// tarjeta y gráfico, con su mismo icono para reconocerlos de un
// vistazo. Cerrada siempre al entrar en el Dashboard: no se recuerda
// el estado entre visitas.

function dashPuntoInfo(icono, titulo, texto) {
  return '<div class="dash-info-punto">' +
    '<i class="ti ' + icono + '"></i>' +
    '<div>' +
      '<p class="dash-info-punto-titulo">' + escaparHtml(titulo) + '</p>' +
      '<p class="dash-info-punto-texto">' + escaparHtml(texto) + '</p>' +
    '</div>' +
  '</div>';
}

function dashBloqueInfo() {
  return (
    dashPuntoInfo(DASH_TARJETAS_COLOR.ingresos.icono, 'Ingresos',
      'Suma de lo cobrado en el año (apuntes de Contabilidad), sin impuestos. Debajo, en pequeño, lo cobrado con impuestos incluidos (lo que ha entrado en el banco).') +
    dashPuntoInfo(DASH_TARJETAS_COLOR.gastos.icono, 'Gastos',
      'Suma de lo pagado en el año, sin impuestos. Debajo, lo pagado con impuestos incluidos (lo que ha salido del banco).') +
    dashPuntoInfo(DASH_TARJETAS_COLOR.beneficio.icono, 'Beneficio',
      'Ingresos menos gastos del año, sin impuestos: lo que de verdad gana el negocio. Debajo, el resultado en banco (con impuestos).') +
    dashPuntoInfo(DASH_TARJETAS_COLOR.media.icono, 'Media mensual',
      'Beneficio medio de los últimos 365 días, repartido entre los meses reales de actividad (si el negocio lleva menos de un año, se divide solo entre esos meses). Debajo, la misma media pero en banco.') +
    dashPuntoInfo(DASH_TARJETAS_COLOR.impuestos.icono, 'Próximo pago',
      'Lo que queda por pagar del trimestre que toca (IVA + IRPF, cada uno desde 0 €). Debajo, el plazo: hasta cuándo hay tiempo o si ya está pagado. A diferencia del resto, cuenta las facturas desde que se emiten, aunque no estén cobradas.') +
    dashPuntoInfo(DASH_TARJETAS_COLOR.adelantar.icono, 'Te deben',
      'Total de las facturas de venta activas todavía sin cobrar. Debajo, cuánto de los impuestos de esas facturas se adelanta a Hacienda en el próximo pago, antes de haber cobrado el dinero.') +
    dashPuntoInfo('ti-chart-line', 'Gráfico de evolución',
      'Ingresos, gastos y beneficio de los últimos 12 meses completos más el mes en curso (línea punteada, todavía a medias). Sin impuestos, igual que las tarjetas económicas.') +
    dashPuntoInfo('ti-chart-donut', 'Clientes y Proveedores',
      'De qué contactos viene el dinero cobrado o pagado en los últimos 365 días (solo contactos registrados en Clientes). Sí cambian con el selector de arriba (Empresa/Personal/Total).') +
    dashPuntoInfo('ti-chart-donut', 'Ingresos y Gastos: empresa y personal',
      'Compara lo de empresa con lo personal en los últimos 365 días. Estos dos donuts NO cambian con el selector de arriba: su propio gráfico ya separa empresa de personal.')
  );
}

function dashCablearInfo() {
  const cabecera = document.getElementById('dash-info-cabecera');
  const cuerpo = document.getElementById('dash-info-cuerpo');
  const flecha = document.getElementById('dash-info-flecha');
  if (!cabecera || !cuerpo || !flecha) return;

  cabecera.addEventListener('click', function () {
    const abierta = cuerpo.classList.toggle('abierta');
    flecha.classList.toggle('girada', abierta);
  });
}

// ============================================================
// 6. PINTADO
// ============================================================

const DASH_TARJETAS_COLOR = {
  ingresos:  { clase: 'verde',       icono: 'ti-trending-up' },
  gastos:    { clase: 'rojo',        icono: 'ti-trending-down' },
  beneficio: { clase: 'azul',        icono: 'ti-wallet' },
  media:     { clase: 'azul-suave',  icono: 'ti-calendar-stats' },
  impuestos: { clase: 'ambar',       icono: 'ti-calendar-due' },
  adelantar: { clase: 'ambar-fuerte',icono: 'ti-clock-dollar' }
};

function dashTarjeta(clave, titulo, valor, etiquetaTesoreria, valorTesoreria) {
  const info = DASH_TARJETAS_COLOR[clave];
  return '<div class="dash-tarjeta ' + info.clase + '">' +
    '<div class="dash-tarjeta-cabecera">' +
      '<span class="dash-tarjeta-titulo">' + escaparHtml(titulo) + '</span>' +
      '<i class="ti ' + info.icono + '"></i>' +
    '</div>' +
    '<p class="dash-tarjeta-valor">' + escaparHtml(dineroVisible(valor)) + '</p>' +
    // Sin cifra pequeña (valorTesoreria null), la línea es solo texto:
    // la usa "Próximo pago" para el plazo.
    '<p class="dash-tarjeta-tesoreria">' +
      escaparHtml(etiquetaTesoreria) +
      (valorTesoreria === null ? '' : ' ' + escaparHtml(dineroVisible(valorTesoreria))) +
    '</p>' +
  '</div>';
}

function pintarDashboard() {
  const contenido = document.getElementById('contenido');
  if (!contenido) return;

  contenido.innerHTML =
    '<div class="dash-cabecera">' +
      '<div class="dash-selector" id="dash-selector">' +
        DASH_PERSPECTIVAS.map(function (p) {
          return '<button type="button" data-perspectiva="' + p.id + '"' +
            (p.id === dashPerspectiva ? ' class="activa"' : '') + '>' + p.etiqueta + '</button>';
        }).join('') +
      '</div>' +
    '</div>' +
    '<div id="dash-tarjetas" class="dash-tarjetas"></div>' +
    '<div class="dash-grafico-grande">' +
      '<div class="dash-grafico-cabecera">' +
        '<p class="dash-grafico-titulo">Evolución: 12 meses y el mes en curso</p>' +
        '<div class="dash-selector pequeno" id="dash-selector-grafico">' +
          DASH_PERSPECTIVAS.map(function (p) {
            return '<button type="button" data-perspectiva="' + p.id + '"' +
              (p.id === dashPerspectiva ? ' class="activa"' : '') + '>' + p.etiqueta + '</button>';
          }).join('') +
        '</div>' +
      '</div>' +
      '<div class="dash-lienzo alto"><canvas id="dash-g-evolucion"></canvas></div>' +
    '</div>' +
    '<div class="dash-donuts">' +
      '<div class="dash-grafico-caja">' +
        '<p class="dash-grafico-titulo">Clientes (' + dashEtiquetaPerspectiva() + ')</p>' +
        '<div class="dash-lienzo"><canvas id="dash-g-clientes"></canvas></div>' +
      '</div>' +
      '<div class="dash-grafico-caja">' +
        '<p class="dash-grafico-titulo">Proveedores (' + dashEtiquetaPerspectiva() + ')</p>' +
        '<div class="dash-lienzo"><canvas id="dash-g-proveedores"></canvas></div>' +
      '</div>' +
      '<div class="dash-grafico-caja">' +
        '<p class="dash-grafico-titulo">Ingresos: empresa y personal</p>' +
        '<div class="dash-lienzo"><canvas id="dash-g-ingresos-ambito"></canvas></div>' +
      '</div>' +
      '<div class="dash-grafico-caja">' +
        '<p class="dash-grafico-titulo">Gastos: empresa y personal</p>' +
        '<div class="dash-lienzo"><canvas id="dash-g-gastos-ambito"></canvas></div>' +
      '</div>' +
    '</div>' +
    '<div class="dash-info">' +
      '<button type="button" class="dash-info-cabecera" id="dash-info-cabecera">' +
        '<span>Info del Dashboard</span>' +
        '<i class="ti ti-chevron-down" id="dash-info-flecha"></i>' +
      '</button>' +
      '<div class="dash-info-cuerpo" id="dash-info-cuerpo">' +
        dashBloqueInfo() +
      '</div>' +
    '</div>';

  // Los dos selectores hacen lo mismo: cambian toda la pantalla.
  ['dash-selector', 'dash-selector-grafico'].forEach(function (id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.querySelectorAll('[data-perspectiva]').forEach(function (b) {
      b.addEventListener('click', function () {
        dashPerspectiva = b.dataset.perspectiva;
        pintarDashboard();
      });
    });
  });

  dashRepintarTarjetas();
  dashRepintarGraficos();
  dashCablearInfo();
}

function dashRepintarTarjetas() {
  const zona = document.getElementById('dash-tarjetas');
  if (!zona) return;

  const anio = new Date().getFullYear();
  const movimientos = dashFiltrarPerspectiva(dashMovimientos(), dashPerspectiva);
  const delAnio = movimientos.filter(function (m) { return m.mes.slice(0, 4) === String(anio); });

  const t = dashTotales(delAnio);
  const media = dashMediaMensual(movimientos);
  const imp = dashImpuestos();

  // La etiqueta de la cifra pequeña cambia según la tarjeta: "En
  // banco" solo tiene sentido donde el dinero entra o queda. Para
  // gastos es dinero que sale, y decir "en banco" confundía
  // (comentario del propietario, 06/09/2026).
  zona.innerHTML =
    dashTarjeta('ingresos',  'Ingresos ' + anio,  t.ingresos,  'Cobrado:', t.tesIngresos) +
    dashTarjeta('gastos',    'Gastos ' + anio,    t.gastos,    'Pagado:',  t.tesGastos) +
    dashTarjeta('beneficio', 'Beneficio ' + anio, t.beneficio, 'En banco:', t.tesNeta) +
    dashTarjeta('media',
      'Media mensual' + (media.meses > 0 && media.meses < 12 ? ' (' + media.meses + ' meses)' : ''),
      media.beneficio, 'En banco:', media.tesoreria) +
    dashTarjeta('impuestos', 'Próximo pago ' + imp.trimestre, imp.pendiente, imp.plazo, null) +
    dashTarjeta('adelantar', 'Te deben', imp.teDeben, 'Adelanto ' + imp.trimestre + ':', imp.adelantas);
}

// ============================================================
// 7. GRÁFICOS (Chart.js)
// ============================================================

const DASH_COLORES_DONUT = [
  '#D32F2F', '#3E9E4E', '#2F6FB5', '#E0A32E', '#7B4EA8', '#8A8A82'
];

// Empresa y Personal llevan siempre el mismo color, elegido por
// nombre — no por su posición en el array de datos (06/09/2026: con
// colores por posición, "Empresa" y "Personal" podían intercambiar
// color según cuál viniera primero o cuál de los dos tuviera importe
// cero y desapareciera del donut).
const DASH_COLORES_AMBITO = {
  'Empresa': '#D32F2F',
  'Personal': '#7B4EA8'
};

// Color de una porción del donut: si el nombre tiene un color fijo
// asignado (Empresa/Personal), se usa ese; si no, se recurre a la
// paleta general por posición, como en los demás donuts (clientes,
// proveedores).
function dashColorDonut(nombre, indice) {
  if (DASH_COLORES_AMBITO[nombre]) return DASH_COLORES_AMBITO[nombre];
  return DASH_COLORES_DONUT[indice % DASH_COLORES_DONUT.length];
}

function dashDestruirGraficos() {
  Object.keys(dashGraficos).forEach(function (k) {
    if (dashGraficos[k] && typeof dashGraficos[k].destroy === 'function') {
      dashGraficos[k].destroy();
    }
    delete dashGraficos[k];
  });
}

function dashMensajeVacio(idCanvas, texto) {
  const lienzo = document.getElementById(idCanvas);
  if (!lienzo || !lienzo.parentNode) return;
  lienzo.parentNode.innerHTML = '<p class="dash-grafico-vacio">' + escaparHtml(texto) + '</p>';
}

function dashRepintarGraficos() {
  dashDestruirGraficos();

  if (typeof Chart === 'undefined') {
    // Sin la librería no se puede dibujar. No es un fallo grave: las
    // tarjetas, que son lo importante, ya están pintadas arriba.
    ['dash-g-evolucion', 'dash-g-clientes', 'dash-g-proveedores',
     'dash-g-ingresos-ambito', 'dash-g-gastos-ambito'].forEach(function (id) {
      dashMensajeVacio(id, 'No se han podido cargar los gráficos. Conéctate una vez a internet para descargarlos.');
    });
    return;
  }

  dashGraficoEvolucion();
  dashGraficoDonut('dash-g-clientes', dashConcentracionClientes(dashPerspectiva), 'Todavía no hay ingresos con contacto registrado en los últimos 365 días.');
  dashGraficoDonut('dash-g-proveedores', dashConcentracionProveedores(dashPerspectiva), 'Todavía no hay gastos con contacto registrado en los últimos 365 días.');

  const ingAmbito = dashPorAmbito('ingreso');
  dashGraficoDonut('dash-g-ingresos-ambito', [
    { nombre: 'Empresa', importe: ingAmbito.empresa },
    { nombre: 'Personal', importe: ingAmbito.personal }
  ].filter(function (x) { return x.importe > 0; }), 'Todavía no hay ingresos en los últimos 365 días.');

  const gasAmbito = dashPorAmbito('gasto');
  dashGraficoDonut('dash-g-gastos-ambito', [
    { nombre: 'Empresa', importe: gasAmbito.empresa },
    { nombre: 'Personal', importe: gasAmbito.personal }
  ].filter(function (x) { return x.importe > 0; }), 'Todavía no hay gastos en los últimos 365 días.');
}

function dashGraficoEvolucion() {
  const lienzo = document.getElementById('dash-g-evolucion');
  if (!lienzo) return;

  const movimientos = dashFiltrarPerspectiva(dashMovimientos(), dashPerspectiva);
  const serie = dashSerieMensual(movimientos);

  const hayAlgo = serie.ingresos.concat(serie.gastos).some(function (v) { return v !== 0; });
  if (!hayAlgo) {
    dashMensajeVacio('dash-g-evolucion', 'Todavía no hay movimientos en los últimos 12 meses ni en el mes en curso.');
    return;
  }

  // El último punto es el mes en curso: tramo final punteado y punto
  // hueco (blanco), para que se vea que aún no está cerrado.
  const ultimo = serie.etiquetas.length - 1;
  const tramoEnCurso = { borderDash: function (ctx) { return ctx.p1DataIndex === ultimo ? [2, 4] : undefined; } };
  const rellenoPuntos = function (color) {
    return serie.etiquetas.map(function (e, i) { return i === ultimo ? '#FFFFFF' : color; });
  };

  dashGraficos.evolucion = new Chart(lienzo, {
    type: 'line',
    data: {
      labels: serie.etiquetas,
      datasets: [
        { label: 'Ingresos',  data: serie.ingresos,  borderColor: '#3E9E4E', backgroundColor: '#3E9E4E', pointBackgroundColor: rellenoPuntos('#3E9E4E'), tension: 0.3, borderWidth: 1.5, pointRadius: 2, borderDash: [4, 3], segment: tramoEnCurso },
        { label: 'Gastos',    data: serie.gastos,    borderColor: '#D32F2F', backgroundColor: '#D32F2F', pointBackgroundColor: rellenoPuntos('#D32F2F'), tension: 0.3, borderWidth: 1.5, pointRadius: 2, borderDash: [4, 3], segment: tramoEnCurso },
        { label: 'Beneficio', data: serie.beneficio, borderColor: '#2F6FB5', backgroundColor: '#2F6FB5', pointBackgroundColor: rellenoPuntos('#2F6FB5'), tension: 0.3, borderWidth: 3.5, pointRadius: 3, order: 0, segment: tramoEnCurso }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        // Cuadraditos de color macizos en la leyenda y en el aviso
        // (25/09/2026). Chart.js los dibuja con el mismo borde que su
        // línea, así que los de Ingresos y Gastos salían discontinuos y
        // finos ("rotos") y el de Beneficio macizo. Aquí se les quita la
        // línea discontinua y se rellenan enteros con su color; las
        // líneas del gráfico siguen igual.
        legend: {
          position: 'bottom',
          labels: {
            boxWidth: 12,
            font: { size: 11 },
            generateLabels: function (grafico) {
              return Chart.defaults.plugins.legend.labels.generateLabels(grafico).map(function (etiqueta) {
                etiqueta.lineDash = [];
                etiqueta.lineWidth = 1;
                etiqueta.strokeStyle = etiqueta.fillStyle;
                return etiqueta;
              });
            }
          }
        },
        tooltip: {
          callbacks: {
            label: function (ctx) { return ctx.dataset.label + ': ' + dineroVisible(ctx.parsed.y); },
            labelColor: function (ctx) {
              const color = ctx.dataset.borderColor;
              return { borderColor: color, backgroundColor: color, borderWidth: 1, borderDash: [], borderDashOffset: 0, borderRadius: 0 };
            }
          }
        }
      },
      scales: {
        y: {
          // Con las cifras ocultas (botón del ojo) no se pintan los
          // números del eje: la forma de las líneas se sigue viendo.
          ticks: {
            display: !cifrasOcultas,
            font: { size: 10 },
            callback: function (v) { return formatMoney(v); }
          },
          grid: { color: '#EAEAE6' }
        },
        x: { ticks: { font: { size: 10 } }, grid: { display: false } }
      }
    }
  });
}

// Si aun en su propia línea el nombre no cabe en el ancho del gráfico,
// se recorta con «…» para que la caja del aviso nunca se salga del
// borde (así se ve entero el principio del nombre). Si algo fallara al
// medir, se devuelve el nombre tal cual: nunca rompe el gráfico.
function dashRecortarTooltip(texto, tooltip, grafico) {
  texto = String(texto || '');
  let lienzo = null;
  try {
    const opciones = tooltip.options;
    const relleno = Chart.helpers.toPadding(opciones.padding);
    const hueco = grafico.width - relleno.left - relleno.right - 4;
    lienzo = grafico.ctx;
    lienzo.save();
    lienzo.font = Chart.helpers.toFont(opciones.bodyFont).string;
    if (hueco <= 0 || lienzo.measureText(texto).width <= hueco) return texto;
    let corte = texto.length;
    while (corte > 1 && lienzo.measureText(texto.slice(0, corte).trimEnd() + '…').width > hueco) corte--;
    return texto.slice(0, corte).trimEnd() + '…';
  } catch (e) {
    return texto;
  } finally {
    if (lienzo) lienzo.restore();
  }
}

function dashGraficoDonut(idCanvas, datos, textoVacio) {
  const lienzo = document.getElementById(idCanvas);
  if (!lienzo) return;

  if (!datos || datos.length === 0) {
    dashMensajeVacio(idCanvas, textoVacio);
    return;
  }

  dashGraficos[idCanvas] = new Chart(lienzo, {
    type: 'doughnut',
    data: {
      labels: datos.map(function (d) { return d.nombre; }),
      datasets: [{
        data: datos.map(function (d) { return d.importe; }),
        backgroundColor: datos.map(function (d, i) { return dashColorDonut(d.nombre, i); }),
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '58%',
      plugins: {
        // Sin leyenda (decisión del propietario, 06/09/2026): ocupaba
        // mucho, variaba de alto según cuántos nombres hubiera —lo que
        // descolocaba unos círculos respecto a otros— y la información
        // ya sale al pulsar cada sección del gráfico.
        legend: { display: false },
        tooltip: {
          displayColors: false,
          callbacks: {
            title: function () { return ''; },
            // Dos líneas (25/09/2026): arriba el nombre, abajo el importe.
            // En una sola línea, un nombre largo empujaba el importe fuera
            // del gráfico y no se veía.
            label: function (ctx) {
              const total = ctx.dataset.data.reduce(function (s, v) { return s + v; }, 0);
              const pct = total > 0 ? Math.round((ctx.parsed / total) * 100) : 0;
              return [
                dashRecortarTooltip(ctx.label, this, ctx.chart),
                dineroVisible(ctx.parsed) + ' (' + pct + '%)'
              ];
            }
          }
        }
      }
    }
  });
}

// ============================================================
// 8. REGISTRO COMO VISTA
// ============================================================

registrarVista('dashboard', {
  titulo: 'Inicio',
  pintar: pintarDashboard
});
