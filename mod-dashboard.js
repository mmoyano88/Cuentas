/**
 * MÓDULO DASHBOARD (pantalla de Inicio)
 * ------------------------------------------------------------
 * Primera pantalla que se ve al abrir la aplicación. Resumen visual
 * del negocio: seis tarjetas de colores y cinco gráficos.
 *
 * SIMPLIFICACIÓN DEL 26/10/2026 (decisión del propietario). SUSTITUYE a
 * lo que dicen más abajo "DOS CIFRAS POR TARJETA" y la media mensual
 * anterior. Solo cambian fórmulas y datos; el orden, los colores, los
 * iconos y el diseño son los de siempre:
 *
 *   · Todo se mide como lo que te queda en el bolsillo, sin IVA:
 *       ingreso = base − retención de IRPF (la retención la paga el
 *                 cliente en tu nombre, pero no es ganancia tuya);
 *       gasto   = base.
 *     Los pagos de impuestos no cuentan y no se reserva nada para el
 *     trimestre. Por eso estas cifras salen algo menores que las de
 *     Impuestos e Informes, que siguen sobre la base completa.
 *   · Tarjetas negras de los 12 meses: ingresos, gastos y lo que queda
 *     de cada mes, con esa definición.
 *   · Ingresos, Gastos y Beneficio del año: cifra grande = suma desde
 *     el 1 de enero; cifra pequeña = últimos 3 meses (90 días hasta
 *     hoy, sin pasar del 1 de enero: hasta finales de marzo coinciden).
 *   · Media mensual: cifra grande = últimos 365 días entre 12; cifra
 *     pequeña = últimos 90 días entre 3 (por mes). No se corta en el 1
 *     de enero: es una ventana móvil de un año.
 *   · Gráfico: acumulado de los 12 meses con tres líneas (empresa,
 *     personal y total) que se ven siempre, sin depender del selector.
 *   · Se quita la cifra de tesorería ("Cobrado", "Pagado", "En banco")
 *     de las tarjetas. Próximo pago, Te deben, listas y donuts no
 *     cambian (los donuts siguen midiendo la base sin IVA).
 *
 * DOS CIFRAS POR TARJETA 🔒 (mapa 14.2) — SUPERADO, solo historial. Era el
 * concepto clave de esta
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
    const tipo = dashTexto(a.tipo) === 'ingreso' ? 'ingreso' : 'gasto';
    const base = parsearNumero(a.base);
    lista.push({
      mes: mes,
      fecha: normalizarFecha(a.fecha),
      tipo: tipo,
      ambito: dashTexto(a.ambito) === 'personal' ? 'personal' : 'empresa',
      pagoImpuestos: dashEsPagoImpuestos(a),
      base: base,
      // Importe que cuenta en las tarjetas y en el gráfico (26/10/2026):
      // un ingreso, sin IVA y sin la retención de IRPF; un gasto, su base.
      neto: tipo === 'ingreso' ? roundMoney(base - parsearNumero(a.irpf)) : base,
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

// Suma de una lista de movimientos: ingresos netos (base − retención
// de IRPF), gastos (base) y lo que queda. Deja fuera los pagos de
// impuestos y no reserva nada para el trimestre (26/10/2026).
function dashTotales(movimientos) {
  let ingresos = 0, gastos = 0;

  movimientos.forEach(function (m) {
    if (m.pagoImpuestos) return;
    if (m.tipo === 'ingreso') ingresos += m.neto;
    else gastos += m.neto;
  });

  return {
    ingresos: roundMoney(ingresos),
    gastos: roundMoney(gastos),
    beneficio: roundMoney(ingresos - gastos)
  };
}

// Últimos 90 días hasta hoy (los "últimos 3 meses" de las tarjetas),
// ambos días incluidos. Con `noAntesDe` (una fecha ISO) la ventana no
// empieza antes de ese día: las tarjetas del año usan el 1 de enero.
function dashVentana90(noAntesDe) {
  const hoy = new Date();
  const desde = dashIsoLocal(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 89));
  return {
    desde: noAntesDe && desde < noAntesDe ? noAntesDe : desde,
    hasta: dashIsoLocal(hoy)
  };
}

// Meses de actividad dentro de una ventana, contados en días (días desde
// el primer movimiento registrado ÷ 30,42), con un mínimo de 1 mes y un
// máximo de `maxMeses`. Devuelve 0 si aún no hay actividad en la ventana.
const DASH_DIAS_POR_MES = 365 / 12;

function dashMesesDeActividad(ventana, maxMeses) {
  const inicio = dashDiaInicioActividad();
  if (!inicio || inicio > ventana.hasta) return 0;
  // Actividad que cubre toda la ventana: justo `maxMeses` (90 días = 3
  // meses, 365 días = 12), sin el redondeo de dividir días entre 30,42.
  if (inicio <= ventana.desde) return maxMeses;

  const desde = inicio > ventana.desde ? inicio : ventana.desde;
  const p = desde.split('-').map(Number), h = ventana.hasta.split('-').map(Number);
  const dias = Math.round((new Date(h[0], h[1] - 1, h[2]) - new Date(p[0], p[1] - 1, p[2])) / 86400000) + 1;
  return Math.min(maxMeses, Math.max(1, dias / DASH_DIAS_POR_MES));
}

// Media mensual 🔒 de lo que te queda (ingresos netos − gastos):
//   · Grande: los ÚLTIMOS 365 DÍAS hasta hoy entre 12. Un mes sin
//     actividad cuenta como cero (la media busca aproximar "un sueldo
//     medio"), pero no se cuenta el tiempo anterior al primer movimiento
//     registrado: si la actividad lleva menos de un año, se divide entre
//     los meses reales.
//   · Pequeña: los ÚLTIMOS 90 DÍAS entre 3, es decir, por mes, con la
//     misma regla si la actividad lleva menos de 3 meses. Si es mayor
//     que la grande, ahora vas por encima de tu media.
function dashMediaMensual(movimientos) {
  const v365 = dashVentana365();
  const v90 = dashVentana90(null);
  const meses365 = dashMesesDeActividad(v365, 12);
  if (meses365 === 0) return { beneficio: 0, reciente: 0, meses: 0 };

  const meses90 = dashMesesDeActividad(v90, 3);
  const b365 = dashTotales(movimientos.filter(function (m) { return dashEnVentana(m.fecha, v365); })).beneficio;
  const b90 = meses90 > 0
    ? dashTotales(movimientos.filter(function (m) { return dashEnVentana(m.fecha, v90); })).beneficio
    : 0;

  return {
    beneficio: roundMoney(b365 / meses365),
    reciente: meses90 > 0 ? roundMoney(b90 / meses90) : 0,
    meses: Math.round(meses365)
  };
}

// Mes en curso, como «2026-10».
function dashMesActual() {
  const hoy = new Date();
  return hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0');
}

// Datos del gráfico (26/10/2026): lo que queda cada mes (ingresos netos
// − gastos, sin pagos de impuestos) de Empresa y de Personal, y su
// acumulado a lo largo de los mismos 12 meses de las tarjetas negras
// (el último es el mes en curso). El acumulado empieza en cero al
// principio de la ventana. Total = empresa + personal. Los valores
// pueden ser negativos: es normal, no un fallo.
function dashSerieMensual(movimientos) {
  const meses = dashClavesMeses();
  const posicion = {};
  meses.forEach(function (m, i) { posicion[m] = i; });

  const mensual = {
    empresa: meses.map(function () { return 0; }),
    personal: meses.map(function () { return 0; })
  };

  movimientos.forEach(function (m) {
    if (m.pagoImpuestos) return;
    const i = posicion[m.mes];
    if (i === undefined) return;
    mensual[m.ambito === 'personal' ? 'personal' : 'empresa'][i] += (m.tipo === 'ingreso' ? m.neto : -m.neto);
  });

  mensual.empresa = mensual.empresa.map(roundMoney);
  mensual.personal = mensual.personal.map(roundMoney);
  mensual.total = mensual.empresa.map(function (v, i) { return roundMoney(v + mensual.personal[i]); });

  const acumulado = {};
  ['empresa', 'personal', 'total'].forEach(function (k) {
    let suma = 0;
    acumulado[k] = mensual[k].map(function (v) { suma = roundMoney(suma + v); return suma; });
  });

  return {
    etiquetas: meses.map(function (m, i) {
      return i === meses.length - 1 ? dashEtiquetaMes(m) + ' (en curso)' : dashEtiquetaMes(m);
    }),
    mensual: mensual,
    acumulado: acumulado
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
    typeof impFacturasSinCobrar === 'function';

  if (!disponible) {
    return { trimestre: fvTrimestreDeFecha(fechaHoyISO()), pendiente: 0, facturado: 0, teDeben: 0, adelantas: 0 };
  }

  const proximo = impProximoPago();
  const pendiente = impPendienteDePago(proximo.anio, proximo.trimestre);
  const sinCobrar = impFacturasSinCobrar();

  // "Te deben" (26/10/2026): facturas de venta sin cobrar + trabajos de
  // Pendiente todavía sin facturar, estos con el IVA y el IRPF que
  // llevarían en la factura (igual que la tarjeta "Pendiente de
  // facturar"). "Ya facturado" es solo la parte de facturas emitidas.
  const porFacturar = dashPendienteClientes().reduce(function (suma, c) {
    return suma + penCalcularFactura(c.total, penCondicionesDe(c.id)).total;
  }, 0);

  return {
    trimestre: proximo.trimestre,
    pendiente: pendiente.total,
    facturado: sinCobrar.total,
    teDeben: roundMoney(sinCobrar.total + porFacturar),
    adelantas: roundMoney(sinCobrar.yaAdelantado + sinCobrar.enProximo)
  };
}

// Pulsar la tarjeta "Próximo pago" lleva a Impuestos, al trimestre que
// toca pagar (26/10/2026). Es la única tarjeta del Inicio que actúa
// como botón.
function dashIrAImpuestos() {
  if (typeof impProximoPago === 'function' && typeof impAnio !== 'undefined') {
    const p = impProximoPago();
    impAnio = p.anio;
    impTrimestre = p.trimestre;
  }
  cambiarVista('impuestos');
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
    dashPuntoInfo('ti-calendar-month', 'Tarjetas negras de cada mes',
      'Lo que te queda cada mes: ingresos menos gastos, sin IVA y sin la retención de IRPF que te descuenta el cliente (esa retención no es ganancia tuya). Los pagos de impuestos no cuentan y no se aparta nada para el trimestre. Siguen el selector de arriba.') +
    dashPuntoInfo(DASH_TARJETAS_COLOR.ingresos.icono, 'Ingresos',
      'Suma desde el 1 de enero de lo cobrado, sin IVA y sin la retención de IRPF. Por eso sale algo menor que en Impuestos e Informes, que cuentan la base entera. Debajo, lo cobrado en los últimos 3 meses (90 días hasta hoy, sin pasar del 1 de enero: hasta finales de marzo las dos cifras coinciden).') +
    dashPuntoInfo(DASH_TARJETAS_COLOR.gastos.icono, 'Gastos',
      'Suma desde el 1 de enero de lo pagado, sin IVA. Debajo, lo pagado en los últimos 3 meses.') +
    dashPuntoInfo(DASH_TARJETAS_COLOR.beneficio.icono, 'Beneficio',
      'Ingresos menos gastos desde el 1 de enero: lo que te queda en el bolsillo, sin reservar nada para impuestos. Debajo, lo mismo en los últimos 3 meses.') +
    dashPuntoInfo(DASH_TARJETAS_COLOR.media.icono, 'Media mensual',
      'Lo que te queda de media al mes en los últimos 365 días (entre 12): una idea aproximada de tu sueldo. Si llevas menos de un año de actividad, se divide entre los meses reales. Debajo, la media de los últimos 3 meses (90 días entre 3): si es mayor que la grande, ahora vas mejor que tu media.') +
    dashPuntoInfo(DASH_TARJETAS_COLOR.impuestos.icono, 'Próximo pago',
      'Lo que queda por pagar del trimestre que toca (IVA + IRPF, cada uno desde 0 €). Debajo, el adelanto: la parte de ese pago que viene de facturas emitidas que todavía no has cobrado. A diferencia del resto, cuenta las facturas desde que se emiten, aunque no estén cobradas. Pulsa la tarjeta para ir a Impuestos, donde están el plazo y el pago.') +
    dashPuntoInfo(DASH_TARJETAS_COLOR.adelantar.icono, 'Te deben',
      'Lo que te deben y te deberán: las facturas de venta activas sin cobrar más los trabajos de Pendiente que aún no has facturado, estos con el IVA y el IRPF que llevarían en la factura. Debajo, "Ya facturado": solo la parte de facturas ya emitidas y sin cobrar.') +
    dashPuntoInfo('ti-chart-line', 'Gráfico de evolución',
      'Lo que te queda, acumulado mes a mes en los últimos 12 meses, con tres líneas: empresa, personal y total (empresa más personal). La inclinación dice cuándo sube más o menos; por debajo de cero es que has gastado más de lo que has ingresado. Al pulsar un mes sale el acumulado y lo de ese mes. El último tramo, punteado, es el mes en curso. Este gráfico no cambia con el selector de arriba.') +
    dashPuntoInfo('ti-chart-donut', 'Clientes y proveedores',
      'De qué contactos viene el dinero cobrado o pagado en los últimos 365 días, medido en base sin IVA (solo contactos registrados en Clientes). Sí cambian con el selector de arriba (Empresa/Personal/Total).') +
    dashPuntoInfo('ti-chart-donut', 'Ingresos y gastos: empresa y personal',
      'Compara lo de empresa con lo personal en los últimos 365 días, en base sin IVA. Estos dos donuts NO cambian con el selector de arriba: su propio gráfico ya separa empresa de personal.')
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

function dashTarjeta(clave, titulo, valor, etiquetaTesoreria, valorTesoreria, comoBoton) {
  const info = DASH_TARJETAS_COLOR[clave];
  return '<div class="dash-tarjeta ' + info.clase + (comoBoton ? ' dash-tarjeta-boton' : '') + '"' +
    (comoBoton ? ' role="button" tabindex="0" data-ir-impuestos="1"' : '') + '>' +
    '<div class="dash-tarjeta-cabecera">' +
      '<span class="dash-tarjeta-titulo">' + escaparHtml(titulo) + '</span>' +
      '<i class="ti ' + info.icono + '"></i>' +
    '</div>' +
    '<p class="dash-tarjeta-valor">' + escaparHtml(dineroVisible(valor)) + '</p>' +
    // Sin cifra pequeña (valorTesoreria null), la línea es solo texto.
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
    '<div id="dash-mes" class="dash-mes"></div>' +
    '<div id="dash-tarjetas" class="dash-tarjetas"></div>' +
    '<div id="dash-listas" class="dash-listas"></div>' +
    '<div class="dash-grafico-grande">' +
      '<div class="dash-grafico-cabecera">' +
        '<p class="dash-grafico-titulo">Evolución acumulada: 12 meses</p>' +
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
    // Puntos del carrusel de donuts (solo se ven en el móvil).
    '<div class="car-puntos" id="dash-puntos-donuts" aria-hidden="true"><span></span><span></span><span></span><span></span></div>' +
    '<div class="dash-info">' +
      '<button type="button" class="dash-info-cabecera" id="dash-info-cabecera">' +
        '<span>Información del Inicio</span>' +
        '<i class="ti ti-chevron-down" id="dash-info-flecha"></i>' +
      '</button>' +
      '<div class="dash-info-cuerpo" id="dash-info-cuerpo">' +
        dashBloqueInfo() +
      '</div>' +
    '</div>';

  // Donuts en carrusel en el móvil (rediseño, 28/09/2026): uno grande
  // detrás de otro, deslizando de lado. En PC siguen en rejilla.
  if (typeof prepararCarrusel === 'function') {
    prepararCarrusel(document.querySelector('#contenido .dash-donuts'), document.getElementById('dash-puntos-donuts'), { inicial: 0 });
  }

  // El selector cambia las tarjetas, las listas y los donuts de clientes
  // y proveedores (el gráfico enseña siempre las tres líneas; desde el
  // 26/10/2026 ya no tiene selector propio). Se repinta sin mover la
  // página (28/09/2026).
  const selector = document.getElementById('dash-selector');
  if (selector) {
    selector.querySelectorAll('[data-perspectiva]').forEach(function (b) {
      b.addEventListener('click', function () {
        dashPerspectiva = b.dataset.perspectiva;
        if (typeof repintarSinSaltar === 'function') repintarSinSaltar(pintarDashboard);
        else pintarDashboard();
      });
    });
  }

  dashRepintarTarjetas();
  dashRepintarListas();
  dashRepintarGraficos();
  dashCablearInfo();
}

// ============================================================
// LISTAS: ÚLTIMOS APUNTES Y FACTURAS SIN COBRAR (26/09/2026)
// ============================================================
// Entre las tarjetas y el gráfico de líneas. Dos columnas en PC, una
// encima de otra en el móvil, con la misma altura. Solo LEEN datos que
// ya existen: no calculan nada nuevo ni guardan nada.
// - Últimos apuntes: los 5 más recientes hasta hoy, filtrados por el
//   selector Empresa/Personal/Total (decisión del propietario).
// - Facturas sin cobrar: las 5 MÁS ANTIGUAS (las más urgentes de
//   reclamar), activas y pendientes. Siempre son de empresa.
// Tocar una fila abre su ficha encima del Dashboard, con las fichas
// que ya existen en Contabilidad y en Facturas de venta.

const DASH_LISTA_MAX = 5;

// "Más facturas" abre Ventas con el filtro "Pendientes" SOLO esa vez: en
// cuanto se sale de Facturas, el filtro vuelve a "Todos" (lo hace el
// pintador de abajo, que el núcleo ejecuta después de cada cambio de
// pantalla).
let dashFiltroFacturasTemporal = false;

pintadores.push(function () {
  if (dashFiltroFacturasTemporal && vistaActiva !== 'facturas') {
    if (typeof fvFiltroEstado !== 'undefined') fvFiltroEstado = 'todos';
    dashFiltroFacturasTemporal = false;
  }
});

function dashUltimosApuntes() {
  const hoy = fechaHoyISO();
  const lista = estado.apuntes.map(function (a, i) { return { a: a, i: i, fecha: normalizarFecha(a.fecha) }; })
    .filter(function (x) {
      if (!x.fecha || x.fecha > hoy) return false;
      if (dashPerspectiva === 'total') return true;
      const ambito = dashTexto(x.a.ambito) === 'personal' ? 'personal' : 'empresa';
      return ambito === dashPerspectiva;
    });
  // Más reciente primero; con la misma fecha, el apuntado después.
  lista.sort(function (x, y) {
    if (x.fecha !== y.fecha) return x.fecha < y.fecha ? 1 : -1;
    return y.i - x.i;
  });
  return lista.map(function (x) { return x.a; });
}

function dashFacturasSinCobrar() {
  const lista = estado.ventas.filter(function (f) {
    return fvEstaActiva(f) && dashTexto(f.estado).toLowerCase() === 'pendiente';
  });
  lista.sort(function (x, y) {
    const fx = normalizarFecha(x.fecha), fy = normalizarFecha(y.fecha);
    if (fx !== fy) return fx < fy ? -1 : 1;
    return String(x.numero || '').localeCompare(String(y.numero || ''));
  });
  return lista;
}

function dashFilaApunte(a) {
  const esIngreso = dashTexto(a.tipo) === 'ingreso';
  const circulo = typeof ctCirculoTipo === 'function'
    ? ctCirculoTipo(a, 32)
    : '<div class="dash-lista-circulo"></div>';
  const nombre = typeof ctNombreContacto === 'function' ? ctNombreContacto(a) : (dashNombreContacto(a.id_contacto) || '—');
  const concepto = typeof ctConceptoLimpio === 'function' ? ctConceptoLimpio(a) : (a.concepto || '—');
  return '<button type="button" class="dash-lista-fila" data-apunte="' + escaparHtml(a.id) + '">' +
    circulo +
    '<span class="dash-lista-info">' +
      '<span class="dash-lista-nombre">' + escaparHtml(nombre) + '</span>' +
      '<span class="dash-lista-meta">' + escaparHtml(concepto) + ' · ' + escaparHtml(mostrarFecha(a.fecha)) + '</span>' +
    '</span>' +
    '<span class="dash-lista-derecha">' +
      '<span class="dash-lista-importe ' + (esIngreso ? 'ingreso' : 'gasto') + '">' +
        (esIngreso ? '+' : '−') + escaparHtml(dineroVisible(parsearNumero(a.total))) + '</span>' +
    '</span>' +
  '</button>';
}

function dashFilaFactura(f) {
  const cliente = estado.clientes.find(function (c) { return String(c.id) === String(f.id_cliente); }) || {};
  const nombre = typeof fvNombreMostrado === 'function' ? fvNombreMostrado(f) : (f.cliente || '—');
  return '<button type="button" class="dash-lista-fila" data-factura="' + escaparHtml(f.id) + '">' +
    htmlIconoContacto(cliente.icono, 32) +
    '<span class="dash-lista-info">' +
      '<span class="dash-lista-nombre">' + escaparHtml(nombre || '—') + '</span>' +
      '<span class="dash-lista-meta">' + escaparHtml(f.concepto || '—') + ' · ' + escaparHtml(f.numero || '—') + '</span>' +
    '</span>' +
    '<span class="dash-lista-derecha">' +
      '<span class="dash-lista-importe">' + escaparHtml(dineroVisible(parsearNumero(f.total))) + '</span>' +
      (typeof fvHtmlAntiguedad === 'function' ? fvHtmlAntiguedad(f) : '') +
    '</span>' +
  '</button>';
}

// Clientes con trabajos por facturar (módulo Pendiente): una línea por
// cliente, el último con un trabajo apuntado primero. Cifra = lo que
// saldría en la factura de todos sus trabajos pendientes (con IVA e IRPF
// de su última factura), igual que en la pantalla Pendiente.
function dashPendienteClientes() {
  if (typeof penClientesConPendientes !== 'function') return [];
  return penClientesConPendientes();
}

function dashFilaPendiente(c) {
  const cliente = estado.clientes.find(function (x) { return String(x.id) === String(c.id); }) || {};
  const total = penCalcularFactura(c.total, penCondicionesDe(c.id)).total;
  return '<button type="button" class="dash-lista-fila" data-pendiente="' + escaparHtml(c.id) + '">' +
    htmlIconoContacto(cliente.icono, 32) +
    '<span class="dash-lista-info">' +
      '<span class="dash-lista-nombre">' + escaparHtml(penNombreCliente(c.id)) + '</span>' +
      '<span class="dash-lista-meta">' + c.n + (c.n === 1 ? ' trabajo' : ' trabajos') + '</span>' +
    '</span>' +
    '<span class="dash-lista-derecha">' +
      '<span class="dash-lista-importe">' + escaparHtml(dineroVisible(total)) + '</span>' +
    '</span>' +
  '</button>';
}

function dashRepintarListas() {
  const caja = document.getElementById('dash-listas');
  if (!caja) return;

  const apuntes = dashUltimosApuntes();
  const facturas = dashFacturasSinCobrar();
  const pendientes = dashPendienteClientes();
  const tituloApuntes = 'Últimos apuntes' + (dashPerspectiva === 'total' ? '' : ' (' + dashEtiquetaPerspectiva() + ')');

  caja.innerHTML =
    '<section class="dash-lista">' +
      '<div class="dash-lista-cabecera">' +
        '<p class="dash-grafico-titulo">' + escaparHtml(tituloApuntes) + '</p>' +
        '<button type="button" class="dash-lista-anadir" id="dash-nuevo-apunte" aria-label="Añadir apunte"><i class="ti ti-plus" aria-hidden="true"></i></button>' +
      '</div>' +
      (apuntes.length
        ? '<div class="dash-lista-filas">' + apuntes.slice(0, DASH_LISTA_MAX).map(dashFilaApunte).join('') + '</div>'
        : '<p class="dash-lista-vacia">Todavía no hay apuntes' + (dashPerspectiva === 'total' ? '' : ' de este tipo') + '.</p>') +
      '<button type="button" class="boton-menor dash-lista-mas" id="dash-mas-apuntes">Más apuntes <i class="ti ti-chevron-right" aria-hidden="true"></i></button>' +
    '</section>' +
    '<section class="dash-lista">' +
      // Misma cabecera que "Últimos apuntes" (28/09/2026): así las dos
      // listas empiezan a la misma altura en PC, aunque esta no lleve "+".
      '<div class="dash-lista-cabecera">' +
        '<p class="dash-grafico-titulo">Facturas sin cobrar</p>' +
      '</div>' +
      (facturas.length
        ? '<div class="dash-lista-filas">' + facturas.slice(0, DASH_LISTA_MAX).map(dashFilaFactura).join('') + '</div>'
        : '<p class="dash-lista-vacia">No tienes facturas pendientes de cobro.</p>') +
      '<button type="button" class="boton-menor dash-lista-mas" id="dash-mas-facturas">Más facturas' +
        (facturas.length ? ' (' + facturas.length + ')' : '') + ' <i class="ti ti-chevron-right" aria-hidden="true"></i></button>' +
    '</section>' +
    '<section class="dash-lista">' +
      '<div class="dash-lista-cabecera">' +
        '<p class="dash-grafico-titulo">Pendiente de facturar</p>' +
      '</div>' +
      (pendientes.length
        ? '<div class="dash-lista-filas">' + pendientes.slice(0, DASH_LISTA_MAX).map(dashFilaPendiente).join('') + '</div>'
        : '<p class="dash-lista-vacia">No tienes trabajos pendientes de facturar.</p>') +
      '<button type="button" class="boton-menor dash-lista-mas" id="dash-mas-pendiente">Más trabajos' +
        (pendientes.length > DASH_LISTA_MAX ? ' (' + pendientes.length + ' clientes)' : '') + ' <i class="ti ti-chevron-right" aria-hidden="true"></i></button>' +
    '</section>';

  caja.querySelectorAll('[data-apunte]').forEach(function (b) {
    b.addEventListener('click', function () {
      if (typeof abrirFichaApunte === 'function') abrirFichaApunte(b.dataset.apunte);
    });
  });
  caja.querySelectorAll('[data-factura]').forEach(function (b) {
    b.addEventListener('click', function () {
      if (typeof abrirFichaFacturaVenta === 'function') abrirFichaFacturaVenta(b.dataset.factura);
    });
  });
  caja.querySelectorAll('[data-pendiente]').forEach(function (b) {
    b.addEventListener('click', function () {
      // Lleva a Pendiente con ese cliente ya elegido.
      penClienteSel = String(b.dataset.pendiente);
      penDesmarcados = {};
      cambiarVista('pendiente');
    });
  });
  document.getElementById('dash-mas-pendiente').addEventListener('click', function () {
    penClienteSel = '';
    penDesmarcados = {};
    cambiarVista('pendiente');
  });
  document.getElementById('dash-mas-apuntes').addEventListener('click', function () {
    cambiarVista('contabilidad');
  });
  document.getElementById('dash-nuevo-apunte').addEventListener('click', function (ev) {
    ev.stopPropagation();
    if (typeof abrirFormularioApunte === 'function') abrirFormularioApunte(null);
  });
  document.getElementById('dash-mas-facturas').addEventListener('click', function () {
    if (typeof fvArea !== 'undefined') fvArea = 'ventas';
    if (typeof fvFiltroEstado !== 'undefined') fvFiltroEstado = 'pendiente';
    dashFiltroFacturasTemporal = true;
    cambiarVista('facturas');
  });
}

// Beneficio de cada mes (octubre 2026): carrusel con los últimos 12 meses,
// el mes en curso y los 11 anteriores. Cada tarjeta lleva ingresos menos
// gastos del mes natural, sobre la base (sin IVA) y sin pagos de
// impuestos: la misma cuenta que el gráfico de líneas, así que coinciden.
// Sigue el selector Empresa/Personal/Total y el ojo. Móvil: se desliza y
// abre en el mes en curso. PC: se ven tres y dos flechas recorren el resto.
const DASH_MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DASH_MESES_VISTA = 12;

function dashNombreMes(clave) {
  const n = parseInt(String(clave).slice(5, 7), 10);
  const m = DASH_MESES_LARGOS[n - 1] || '';
  return m.charAt(0).toUpperCase() + m.slice(1) + ' ' + String(clave).slice(0, 4);
}

// De más antiguo a más reciente: el mes en curso queda el último.
function dashClavesMeses() {
  const hoy = new Date();
  const claves = [];
  for (let k = DASH_MESES_VISTA - 1; k >= 0; k--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - k, 1);
    claves.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
  }
  return claves;
}

function dashTarjetaMes(clave, t, enCurso) {
  // Con el ojo cerrado la cifra va en blanco: el color delataría si el mes fue bueno o malo.
  const oculto = (typeof cifrasOcultas !== 'undefined') && cifrasOcultas;
  const signo = oculto ? 'cero' : (t.beneficio > 0.004 ? 'pos' : (t.beneficio < -0.004 ? 'neg' : 'cero'));
  return '<div class="dash-mes-tarjeta ' + signo + (enCurso ? ' actual' : '') + '">' +
    '<div class="dm-int">' +
      '<span class="dm-titulo"><i class="ti ti-calendar-month" aria-hidden="true"></i>' + escaparHtml(dashNombreMes(clave)) + '</span>' +
      '<p class="dm-valor">' + escaparHtml(dineroVisible(t.beneficio)) + '</p>' +
      '<span class="dm-sub"><span class="dm-par">Ingresos ' + escaparHtml(dineroVisible(t.ingresos)) + '</span>' +
        '<span class="dm-par">Gastos ' + escaparHtml(dineroVisible(t.gastos)) + '</span></span>' +
    '</div>' +
    (enCurso ? '<em class="dm-curso">en curso</em>' : '') +
  '</div>';
}

function dashRepintarMes() {
  const zona = document.getElementById('dash-mes');
  if (!zona) return;

  const movimientos = dashFiltrarPerspectiva(dashMovimientos(), dashPerspectiva);
  const actual = dashMesActual();
  const claves = dashClavesMeses();

  zona.innerHTML =
    '<div class="dash-meses-caja">' +
      '<button type="button" class="dash-meses-flecha izq" id="dash-meses-izq" aria-label="Meses anteriores" hidden><i class="ti ti-chevron-left"></i></button>' +
      '<div class="dash-meses" id="dash-meses-carrusel">' +
        claves.map(function (c) {
          const t = dashTotales(movimientos.filter(function (m) { return m.mes === c; }));
          return dashTarjetaMes(c, t, c === actual);
        }).join('') +
      '</div>' +
      '<button type="button" class="dash-meses-flecha der" id="dash-meses-der" aria-label="Meses siguientes" hidden><i class="ti ti-chevron-right"></i></button>' +
    '</div>' +
    '<div class="car-puntos" id="dash-puntos-meses" aria-hidden="true">' +
      claves.map(function () { return '<span></span>'; }).join('') +
    '</div>';

  const carrusel = document.getElementById('dash-meses-carrusel');
  const izq = document.getElementById('dash-meses-izq');
  const der = document.getElementById('dash-meses-der');
  const ultimo = claves.length - 1;

  if (window.matchMedia('(max-width: 899px)').matches) {
    prepararCarrusel(carrusel, document.getElementById('dash-puntos-meses'), { inicial: ultimo });
    return;
  }

  // PC: abre en los tres últimos y las flechas recorren los anteriores.
  function flechas() {
    izq.hidden = carrusel.scrollLeft <= 2;
    der.hidden = carrusel.scrollLeft >= carrusel.scrollWidth - carrusel.clientWidth - 2;
  }
  function mover(sentido) {
    const paso = carrusel.children[0].offsetWidth + 10;
    carrusel.scrollBy({ left: sentido * paso, behavior: 'smooth' });
  }
  izq.addEventListener('click', function () { mover(-1); });
  der.addEventListener('click', function () { mover(1); });
  carrusel.addEventListener('scroll', flechas);
  carrusel.scrollLeft = carrusel.scrollWidth;
  flechas();
}

function dashRepintarTarjetas() {
  dashRepintarMes();
  const zona = document.getElementById('dash-tarjetas');
  if (!zona) return;

  const anio = new Date().getFullYear();
  const movimientos = dashFiltrarPerspectiva(dashMovimientos(), dashPerspectiva);
  const delAnio = movimientos.filter(function (m) { return m.mes.slice(0, 4) === String(anio); });

  // Cifra grande: desde el 1 de enero. Cifra pequeña: últimos 90 días
  // hasta hoy, sin pasar del 1 de enero (26/10/2026).
  const t = dashTotales(delAnio);
  const ventanaReciente = dashVentana90(anio + '-01-01');
  const r = dashTotales(movimientos.filter(function (m) { return dashEnVentana(m.fecha, ventanaReciente); }));
  const media = dashMediaMensual(movimientos);
  const imp = dashImpuestos();

  zona.innerHTML =
    dashTarjeta('ingresos',  'Ingresos ' + anio,  t.ingresos,  'Últimos 3 meses:', r.ingresos) +
    dashTarjeta('gastos',    'Gastos ' + anio,    t.gastos,    'Últimos 3 meses:', r.gastos) +
    dashTarjeta('beneficio', 'Beneficio ' + anio, t.beneficio, 'Últimos 3 meses:', r.beneficio) +
    dashTarjeta('media',
      'Media mensual' + (media.meses > 0 && media.meses < 12 ? ' (' + media.meses + ' meses)' : ''),
      media.beneficio, 'Últimos 3 meses:', media.reciente) +
    dashTarjeta('impuestos', 'Próximo pago ' + imp.trimestre, imp.pendiente, 'Adelanto ' + imp.trimestre + ':', imp.adelantas, true) +
    dashTarjeta('adelantar', 'Te deben', imp.teDeben, 'Ya facturado:', imp.facturado);

  // La tarjeta de Próximo pago lleva a Impuestos (también con teclado).
  const boton = zona.querySelector('[data-ir-impuestos]');
  if (boton) {
    boton.addEventListener('click', dashIrAImpuestos);
    boton.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); dashIrAImpuestos(); }
    });
  }
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

  // Las tres líneas se enseñan siempre, sin depender del selector.
  const serie = dashSerieMensual(dashMovimientos());

  const hayAlgo = ['empresa', 'personal', 'total'].some(function (k) {
    return serie.mensual[k].some(function (v) { return v !== 0; });
  });
  if (!hayAlgo) {
    dashMensajeVacio('dash-g-evolucion', 'Todavía no hay movimientos en los últimos 12 meses.');
    return;
  }

  // El último punto es el mes en curso: tramo final punteado y punto
  // hueco (blanco), para que se vea que aún no está cerrado, más un
  // fondo gris muy suave. El resto de puntos no se dibujan (salen al
  // pulsar).
  const ultimo = serie.etiquetas.length - 1;
  const tramoEnCurso = { borderDash: function (ctx) { return ctx.p1DataIndex === ultimo ? [2, 4] : undefined; } };
  const rellenoPuntos = function (color) {
    return serie.etiquetas.map(function (e, i) { return i === ultimo ? '#FFFFFF' : color; });
  };
  const radioPuntos = function (radio) {
    return serie.etiquetas.map(function (e, i) { return i === ultimo ? radio : 0; });
  };

  // Mes completo con el año para la etiqueta al pulsar ("Enero 2026").
  const MESES_LARGOS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio',
    'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const clavesMeses = dashClavesMeses();
  const mesLargo = function (i) {
    const p = String(clavesMeses[i] || '').split('-');
    const n = parseInt(p[1], 10);
    if (!(n >= 1 && n <= 12)) return serie.etiquetas[i];
    return MESES_LARGOS[n - 1] + ' ' + p[0] + (i === ultimo ? ' (en curso)' : '');
  };

  // Fondo gris muy suave detrás del mes en curso.
  const fondoMesEnCurso = {
    id: 'fondoMesEnCurso',
    beforeDatasetsDraw: function (grafico) {
      const x = grafico.scales.x;
      const area = grafico.chartArea;
      if (!x || !area || ultimo < 1) return;
      const ancho = x.getPixelForValue(1) - x.getPixelForValue(0);
      const centro = x.getPixelForValue(ultimo);
      const c = grafico.ctx;
      c.save();
      c.fillStyle = 'rgba(0, 0, 0, .045)';
      c.fillRect(centro - ancho / 2, area.top, ancho, area.bottom - area.top);
      c.restore();
    }
  };

  // Empresa y Personal con sus colores de siempre; Total en el azul de la tarjeta Beneficio y más
  // gruesa, dibujada encima (order 0 se pinta la última).
  const LINEAS = [
    { clave: 'empresa',  etiqueta: 'Empresa',  color: DASH_COLORES_AMBITO.Empresa,  ancho: 2.5, orden: 1, punto: 3 },
    { clave: 'personal', etiqueta: 'Personal', color: DASH_COLORES_AMBITO.Personal, ancho: 2.5, orden: 1, punto: 3 },
    { clave: 'total',    etiqueta: 'Total',    color: '#2F6FB5',                     ancho: 3.5, orden: 0, punto: 3.5 }
  ];

  // Lo de ese mes, con signo ("+1.200,00 €"). Con el ojo cerrado no se
  // enseña ninguna cifra, ni el signo.
  const delMes = function (v) { return (v > 0 ? '+' : '') + formatMoney(v); };

  dashGraficos.evolucion = new Chart(lienzo, {
    type: 'line',
    data: {
      labels: serie.etiquetas,
      datasets: LINEAS.map(function (l) {
        return {
          label: l.etiqueta,
          data: serie.acumulado[l.clave],
          borderColor: l.color,
          backgroundColor: l.color,
          pointBackgroundColor: rellenoPuntos(l.color),
          pointRadius: radioPuntos(l.punto),
          pointHoverRadius: l.punto + 1,
          // Curva suave "monotone": no se pasa por encima ni por debajo
          // de los puntos reales.
          tension: 0.4,
          cubicInterpolationMode: 'monotone',
          borderWidth: l.ancho,
          order: l.orden,
          segment: tramoEnCurso
        };
      })
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        // Leyenda con círculos macizos de cada color.
        legend: {
          position: 'bottom',
          labels: {
            usePointStyle: true,
            pointStyle: 'circle',
            boxWidth: 7,
            boxHeight: 7,
            font: { size: 11 },
            // Empresa, Personal y Total, en ese orden (la línea Total se
            // pinta encima por su `order`, pero no cambia el orden aquí).
            sort: function (a, b) { return a.datasetIndex - b.datasetIndex; },
            generateLabels: function (grafico) {
              return Chart.defaults.plugins.legend.labels.generateLabels(grafico).map(function (etiqueta) {
                const color = grafico.data.datasets[etiqueta.datasetIndex].borderColor;
                etiqueta.lineDash = [];
                etiqueta.fillStyle = color;
                etiqueta.strokeStyle = color;
                return etiqueta;
              });
            }
          }
        },
        // Etiqueta al pulsar: negra, con el mes completo arriba y una
        // fila por línea: acumulado y, entre paréntesis, lo de ese mes.
        tooltip: Object.assign(dashEstiloAviso(), {
          itemSort: function (a, b) { return a.datasetIndex - b.datasetIndex; },
          callbacks: {
            title: function (items) { return items.length ? mesLargo(items[0].dataIndex) : ''; },
            label: function (ctx) {
              const acumulado = dineroVisible(ctx.parsed.y);
              if (cifrasOcultas) return ' ' + ctx.dataset.label + ': ' + acumulado;
              const mes = serie.mensual[LINEAS[ctx.datasetIndex].clave][ctx.dataIndex];
              return ' ' + ctx.dataset.label + ': ' + acumulado + ' (' + delMes(mes) + ' este mes)';
            },
            labelColor: function (ctx) {
              const color = ctx.dataset.borderColor;
              return { borderColor: color, backgroundColor: color, borderWidth: 0, borderRadius: 4 };
            }
          }
        })
      },
      scales: {
        y: {
          border: { display: false },
          // La escala se ajusta sola a los valores, por encima y por
          // debajo de cero; la línea del cero se marca algo más. Con las
          // cifras ocultas (botón del ojo) no se pintan los números del
          // eje: la forma de las líneas se sigue viendo.
          ticks: {
            display: !cifrasOcultas,
            font: { size: 10 },
            color: '#6B6B68',
            maxTicksLimit: 5,
            callback: function (v) { return dashCifraCorta(v); }
          },
          grid: {
            color: function (ctx) { return Number(ctx.tick && ctx.tick.value) === 0 ? '#C3C2B7' : '#F0F0EC'; }
          }
        },
        x: {
          border: { display: false },
          ticks: { font: { size: 10 }, color: '#6B6B68' },
          grid: { display: false }
        }
      }
    },
    plugins: [fondoMesEnCurso]
  });
}

// ---- Estilo común de las etiquetas al pulsar (rediseño, 28/09/2026) ----
// Fondo negro, texto blanco y las cifras en la fuente de títulos.
function dashEstiloAviso() {
  return {
    backgroundColor: '#161615',
    titleColor: '#FFFFFF',
    bodyColor: '#FFFFFF',
    titleFont: { weight: '600', size: 11 },
    bodyFont: { family: "'Bricolage Grotesque', system-ui, sans-serif", weight: '800', size: 12 },
    padding: 10,
    cornerRadius: 10,
    usePointStyle: true,
    boxPadding: 4
  };
}

// Cifra abreviada para el eje: 1500 → "1,5k €". Solo es un rótulo del
// eje; los importes de verdad salen enteros al pulsar.
function dashCifraCorta(v) {
  const n = Number(v) || 0;
  if (Math.abs(n) >= 1000) {
    return (n / 1000).toLocaleString('es-ES', { maximumFractionDigits: 1 }) + 'k €';
  }
  return n.toLocaleString('es-ES', { maximumFractionDigits: 0 }) + ' €';
}

// Total en el centro de los donuts (rediseño, 28/09/2026): la suma de lo
// que ya enseña el donut, con "365 DÍAS" debajo. Respeta el ojo (con las
// cifras ocultas sale "••••• €") y se esconde mientras está abierta la
// etiqueta al pulsar, para que no se pisen.
const dashTotalCentro = {
  id: 'dashTotalCentro',
  afterDraw: function (grafico) {
    if (grafico.tooltip && grafico.tooltip.getActiveElements && grafico.tooltip.getActiveElements().length) return;
    const arco = grafico.getDatasetMeta(0).data[0];
    if (!arco) return;
    const total = grafico.data.datasets[0].data.reduce(function (s, v) { return s + (Number(v) || 0); }, 0);
    const fuente = "'Bricolage Grotesque', system-ui, sans-serif";
    // Si la fuente aún no ha llegado, se vuelve a dibujar en cuanto llegue.
    if (document.fonts && !document.fonts.check('800 13px ' + fuente)) {
      document.fonts.load('800 13px ' + fuente).then(function () { grafico.draw(); }).catch(function () {});
    }
    const c = grafico.ctx;
    const tamano = Math.max(11, Math.min(15, Math.round(arco.innerRadius / 3.6)));
    c.save();
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = '#1A1A1A';
    c.font = '800 ' + tamano + 'px ' + fuente;
    c.fillText(dineroVisible(total), arco.x, arco.y - 6);
    c.fillStyle = '#6B6B68';
    c.font = '600 9px system-ui, sans-serif';
    c.fillText('365 DÍAS', arco.x, arco.y + 9);
    c.restore();
  }
};

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
        // Rediseño (28/09/2026): anillo más fino, porciones redondeadas
        // y separadas por una línea blanca.
        // Con una sola porción no hay nada que separar: sin línea blanca,
        // que si no dejaría un corte arriba del anillo.
        borderWidth: datos.length > 1 ? 2 : 0,
        borderColor: '#FFFFFF',
        borderRadius: datos.length > 1 ? 5 : 0,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      plugins: {
        // Sin leyenda (decisión del propietario, 06/09/2026): ocupaba
        // mucho, variaba de alto según cuántos nombres hubiera —lo que
        // descolocaba unos círculos respecto a otros— y la información
        // ya sale al pulsar cada sección del gráfico.
        legend: { display: false },
        // Etiqueta al pulsar (rediseño, 28/09/2026): negra, con el
        // piquito que señala la porción. Arriba el nombre (recortado si
        // no cabe) y debajo el punto de color con el importe y su
        // porcentaje, sin repetir el nombre.
        tooltip: Object.assign(dashEstiloAviso(), {
          displayColors: true,
          titleFont: { weight: '600', size: 11 },
          callbacks: {
            title: function (items) {
              return items.length ? dashRecortarTooltip(items[0].label, this, items[0].chart) : '';
            },
            label: function (ctx) {
              const total = ctx.dataset.data.reduce(function (s, v) { return s + v; }, 0);
              const pct = total > 0 ? Math.round((ctx.parsed / total) * 100) : 0;
              return ' ' + dineroVisible(ctx.parsed) + ' (' + pct + '%)';
            },
            labelColor: function (ctx) {
              const color = ctx.dataset.backgroundColor[ctx.dataIndex];
              return { borderColor: color, backgroundColor: color, borderWidth: 0, borderRadius: 4 };
            }
          }
        })
      }
    },
    plugins: [dashTotalCentro]
  });
}

// ============================================================
// 8. REGISTRO COMO VISTA
// ============================================================

registrarVista('dashboard', {
  titulo: 'Inicio',
  pintar: pintarDashboard
});
