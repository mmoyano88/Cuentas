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
 * `mod-impuestos.js` (`impCalcular`, `impAdelantar`), NO leyendo el
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

function dashVisible(r) {
  // En modo prueba los datos ficticios se mezclan con los reales, a
  // propósito, para que las pruebas se sientan realistas (guía). Al
  // desactivar el modo prueba desaparecen solos, porque el núcleo los
  // borra del almacenamiento local.
  if (!estado.modoPrueba && esDePrueba(r)) return false;
  return true;
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

// Mes del primer movimiento registrado de toda la aplicación: la
// "antigüedad" del negocio. Sirve para no dividir la media entre
// meses anteriores a que la actividad existiera (decisión del
// propietario: si solo llevas 3 meses, se divide entre 3, no entre
// 12).
function dashMesInicioActividad() {
  let minimo = null;
  const anotar = function (iso) {
    const clave = dashClaveMes(iso);
    if (!clave) return;
    if (minimo === null || clave < minimo) minimo = clave;
  };

  estado.ventas.forEach(function (f) { if (fvEstaActiva(f) && dashVisible(f)) anotar(f.fecha); });
  estado.compras.forEach(function (f) { if (fcEstaActiva(f) && dashVisible(f)) anotar(f.fecha); });
  estado.apuntes.forEach(function (a) { if (dashVisible(a)) anotar(a.fecha); });

  return minimo;
}

// ============================================================
// 2. RECOGIDA DE MOVIMIENTOS
// ============================================================
// Todo el dashboard trabaja sobre una lista única y normalizada de
// movimientos, para no repetir tres veces la misma lógica de filtro.
//
// Cada movimiento lleva: mes, tipo (ingreso/gasto), ámbito, si es un
// pago de impuestos, su importe económico (base) y su importe de
// tesorería (total).

function dashMovimientos() {
  const lista = [];

  // --- Facturas de venta: ingreso de empresa ---
  estado.ventas.forEach(function (f) {
    if (!fvEstaActiva(f) || !dashVisible(f)) return;
    const mes = dashClaveMes(f.fecha);
    if (!mes) return;
    lista.push({
      mes: mes,
      tipo: 'ingreso',
      ambito: 'empresa',
      pagoImpuestos: false,
      base: parsearNumero(f.base),
      total: parsearNumero(f.total)
    });
  });

  // --- Facturas de compra: gasto de empresa ---
  estado.compras.forEach(function (f) {
    if (!fcEstaActiva(f) || !dashVisible(f)) return;
    const mes = dashClaveMes(f.fecha);
    if (!mes) return;
    lista.push({
      mes: mes,
      tipo: 'gasto',
      ambito: 'empresa',
      pagoImpuestos: false,
      base: parsearNumero(f.base),
      total: parsearNumero(f.total)
    });
  });

  // --- Apuntes ---
  // Los que vienen de una factura se saltan: esa factura ya está
  // contada arriba y se duplicaría. Los pagos de impuestos SÍ entran,
  // marcados, porque cuentan en tesorería aunque no en lo económico.
  estado.apuntes.forEach(function (a) {
    if (!dashVisible(a)) return;
    if (a.id_factura_venta || a.id_factura_compra) return;
    const mes = dashClaveMes(a.fecha);
    if (!mes) return;
    lista.push({
      mes: mes,
      tipo: dashTexto(a.tipo) === 'ingreso' ? 'ingreso' : 'gasto',
      ambito: dashTexto(a.ambito) === 'personal' ? 'personal' : 'empresa',
      pagoImpuestos: dashEsPagoImpuestos(a),
      base: parsearNumero(a.base),
      total: parsearNumero(a.total)
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

// Media mensual sobre los 12 meses completos anteriores 🔒
// (regla del propietario, sustituye a la del mapa 14.3):
//   · Se suman los 12 meses y se divide entre 12.
//   · Un mes sin actividad cuenta como CERO, no se descarta — la
//     media busca aproximar "un sueldo medio" para ver la viabilidad
//     del negocio, y un mes sin ingresos también forma parte de eso.
//   · PERO no se cuentan meses anteriores al primer movimiento
//     registrado: si la actividad empezó hace 3 meses, se divide
//     entre 3, no entre 12.
function dashMediaMensual(movimientos) {
  const meses = dashUltimos12Meses();
  const inicio = dashMesInicioActividad();

  const mesesContados = inicio
    ? meses.filter(function (m) { return m >= inicio; })
    : [];

  if (mesesContados.length === 0) {
    return { beneficio: 0, tesoreria: 0, meses: 0 };
  }

  const enVentana = movimientos.filter(function (m) {
    return mesesContados.indexOf(m.mes) !== -1;
  });
  const t = dashTotales(enVentana);

  return {
    beneficio: roundMoney(t.beneficio / mesesContados.length),
    tesoreria: roundMoney(t.tesNeta / mesesContados.length),
    meses: mesesContados.length
  };
}

// Datos mes a mes para el gráfico grande de líneas.
function dashSerieMensual(movimientos) {
  const meses = dashUltimos12Meses();
  const porMes = {};
  meses.forEach(function (m) { porMes[m] = { ingresos: 0, gastos: 0 }; });

  movimientos.forEach(function (m) {
    if (!porMes[m.mes]) return;
    if (m.pagoImpuestos) return;   // el gráfico es económico, sin impuestos
    if (m.tipo === 'ingreso') porMes[m.mes].ingresos += m.base;
    else porMes[m.mes].gastos += m.base;
  });

  return {
    etiquetas: meses.map(dashEtiquetaMes),
    ingresos: meses.map(function (m) { return roundMoney(porMes[m].ingresos); }),
    gastos: meses.map(function (m) { return roundMoney(porMes[m].gastos); }),
    beneficio: meses.map(function (m) { return roundMoney(porMes[m].ingresos - porMes[m].gastos); })
  };
}

// ============================================================
// 4. DATOS DE LOS GRÁFICOS CIRCULARES
// ============================================================
// Los cuatro son FIJOS: no reaccionan al selector de perspectiva
// (decisión del propietario). Todos miran los últimos 12 meses
// completos, igual que la media mensual y el gráfico de líneas.

function dashNombreContacto(id, nombreEnDocumento) {
  const c = estado.clientes.find(function (x) { return String(x.id) === String(id); });
  if (c) return dashTexto(c.nombre_fiscal) || dashTexto(c.nombre_contacto) || 'Sin nombre';
  return dashTexto(nombreEnDocumento) || 'Sin nombre';
}

// Top 5 por base facturada + «Otros» agrupando el resto.
function dashConcentracion(documentos, campoId, campoNombre) {
  const meses = dashUltimos12Meses();
  const porContacto = {};

  documentos.forEach(function (f) {
    const mes = dashClaveMes(f.fecha);
    if (!mes || meses.indexOf(mes) === -1) return;
    const nombre = dashNombreContacto(f[campoId], f[campoNombre]);
    porContacto[nombre] = (porContacto[nombre] || 0) + parsearNumero(f.base);
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

function dashConcentracionClientes() {
  return dashConcentracion(
    estado.ventas.filter(function (f) { return fvEstaActiva(f) && dashVisible(f); }),
    'id_cliente', 'cliente'
  );
}

function dashConcentracionProveedores() {
  return dashConcentracion(
    estado.compras.filter(function (f) { return fcEstaActiva(f) && dashVisible(f); }),
    'id_proveedor', 'proveedor'
  );
}

// Empresa contra personal, sobre los últimos 12 meses. Sin pagos de
// impuestos: es una comparación económica, no de tesorería.
function dashPorAmbito(tipo) {
  const meses = dashUltimos12Meses();
  let empresa = 0, personal = 0;

  dashMovimientos().forEach(function (m) {
    if (m.tipo !== tipo) return;
    if (m.pagoImpuestos) return;
    if (meses.indexOf(m.mes) === -1) return;
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

function dashImpuestos() {
  const anio = new Date().getFullYear();
  const trimestre = typeof impTrimestreActual === 'function'
    ? impTrimestreActual()
    : fvTrimestreDeFecha(fechaHoyISO());

  const disponible = typeof impCalcular === 'function' && typeof impAdelantar === 'function';
  if (!disponible) {
    return { trimestre: trimestre, estimado: 0, pagadoAnio: 0, adelantar: 0, pendienteCobro: 0 };
  }

  const c = impCalcular(anio, trimestre);
  const a = impAdelantar(anio, trimestre);

  // Tesorería de la tarjeta 5: lo realmente pagado de impuestos en el
  // año, sumando los apuntes de pago (no las estimaciones).
  let pagadoAnio = 0;
  estado.apuntes.forEach(function (ap) {
    if (!dashVisible(ap) || !dashEsPagoImpuestos(ap)) return;
    if (dashClaveMes(ap.fecha) && dashClaveMes(ap.fecha).slice(0, 4) === String(anio)) {
      pagadoAnio += parsearNumero(ap.total) * (dashTexto(ap.tipo) === 'ingreso' ? -1 : 1);
    }
  });

  // Tesorería de la tarjeta 6: el total (con impuestos) de las
  // facturas de venta activas todavía sin cobrar.
  let pendienteCobro = 0;
  estado.ventas.forEach(function (f) {
    if (!fvEstaActiva(f) || !dashVisible(f)) return;
    if (dashTexto(f.estado).toLowerCase() === 'pagada') return;
    pendienteCobro += parsearNumero(f.total);
  });

  return {
    trimestre: trimestre,
    estimado: roundMoney(c.total),
    pagadoAnio: roundMoney(pagadoAnio),
    adelantar: roundMoney(a.iva + a.irpf),
    pendienteCobro: roundMoney(pendienteCobro)
  };
}

// ============================================================
// 6. PINTADO
// ============================================================

const DASH_TARJETAS_COLOR = {
  ingresos:  { clase: 'verde',       icono: 'ti-trending-up' },
  gastos:    { clase: 'rojo',        icono: 'ti-trending-down' },
  beneficio: { clase: 'azul',        icono: 'ti-wallet' },
  media:     { clase: 'azul-suave',  icono: 'ti-calendar-stats' },
  impuestos: { clase: 'ambar',       icono: 'ti-briefcase' },
  adelantar: { clase: 'ambar-fuerte',icono: 'ti-alert-triangle' }
};

function dashTarjeta(clave, titulo, valor, etiquetaTesoreria, valorTesoreria) {
  const info = DASH_TARJETAS_COLOR[clave];
  return '<div class="dash-tarjeta ' + info.clase + '">' +
    '<div class="dash-tarjeta-cabecera">' +
      '<span class="dash-tarjeta-titulo">' + escaparHtml(titulo) + '</span>' +
      '<i class="ti ' + info.icono + '"></i>' +
    '</div>' +
    '<p class="dash-tarjeta-valor">' + escaparHtml(formatMoney(valor)) + '</p>' +
    '<p class="dash-tarjeta-tesoreria">' +
      escaparHtml(etiquetaTesoreria) + ' ' + escaparHtml(formatMoney(valorTesoreria)) +
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
        '<p class="dash-grafico-titulo">Evolución de los últimos 12 meses</p>' +
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
        '<p class="dash-grafico-titulo">Clientes que más facturan</p>' +
        '<div class="dash-lienzo"><canvas id="dash-g-clientes"></canvas></div>' +
      '</div>' +
      '<div class="dash-grafico-caja">' +
        '<p class="dash-grafico-titulo">Proveedores con más gasto</p>' +
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
    '<p class="dash-nota">Cifra grande sin impuestos (lo que gana el negocio); debajo, en pequeño, el dinero que se mueve en el banco. Los gráficos circulares no cambian con el selector.</p>';

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
    dashTarjeta('impuestos', 'Impuestos ' + imp.trimestre, imp.estimado, 'Pagado ' + anio + ':', imp.pagadoAnio) +
    dashTarjeta('adelantar', 'Impuestos a adelantar', imp.adelantar, 'Sin cobrar:', imp.pendienteCobro);
}

// ============================================================
// 7. GRÁFICOS (Chart.js)
// ============================================================

const DASH_COLORES_DONUT = [
  '#D32F2F', '#3E9E4E', '#2F6FB5', '#E0A32E', '#7B4EA8', '#8A8A82'
];

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
  dashGraficoDonut('dash-g-clientes', dashConcentracionClientes(), 'Todavía no hay facturas de venta en los últimos 12 meses.');
  dashGraficoDonut('dash-g-proveedores', dashConcentracionProveedores(), 'Todavía no hay facturas de compra en los últimos 12 meses.');

  const ingAmbito = dashPorAmbito('ingreso');
  dashGraficoDonut('dash-g-ingresos-ambito', [
    { nombre: 'Empresa', importe: ingAmbito.empresa },
    { nombre: 'Personal', importe: ingAmbito.personal }
  ].filter(function (x) { return x.importe > 0; }), 'Todavía no hay ingresos en los últimos 12 meses.');

  const gasAmbito = dashPorAmbito('gasto');
  dashGraficoDonut('dash-g-gastos-ambito', [
    { nombre: 'Empresa', importe: gasAmbito.empresa },
    { nombre: 'Personal', importe: gasAmbito.personal }
  ].filter(function (x) { return x.importe > 0; }), 'Todavía no hay gastos en los últimos 12 meses.');
}

function dashGraficoEvolucion() {
  const lienzo = document.getElementById('dash-g-evolucion');
  if (!lienzo) return;

  const movimientos = dashFiltrarPerspectiva(dashMovimientos(), dashPerspectiva);
  const serie = dashSerieMensual(movimientos);

  const hayAlgo = serie.ingresos.concat(serie.gastos).some(function (v) { return v !== 0; });
  if (!hayAlgo) {
    dashMensajeVacio('dash-g-evolucion', 'Todavía no hay movimientos en los últimos 12 meses.');
    return;
  }

  dashGraficos.evolucion = new Chart(lienzo, {
    type: 'line',
    data: {
      labels: serie.etiquetas,
      datasets: [
        { label: 'Ingresos',  data: serie.ingresos,  borderColor: '#3E9E4E', backgroundColor: '#3E9E4E', tension: 0.3, borderWidth: 2, pointRadius: 2 },
        { label: 'Gastos',    data: serie.gastos,    borderColor: '#D32F2F', backgroundColor: '#D32F2F', tension: 0.3, borderWidth: 2, pointRadius: 2 },
        { label: 'Beneficio', data: serie.beneficio, borderColor: '#2F6FB5', backgroundColor: '#2F6FB5', tension: 0.3, borderWidth: 2, pointRadius: 2 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
        tooltip: {
          callbacks: {
            label: function (ctx) { return ctx.dataset.label + ': ' + formatMoney(ctx.parsed.y); }
          }
        }
      },
      scales: {
        y: {
          ticks: {
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
        backgroundColor: datos.map(function (d, i) { return DASH_COLORES_DONUT[i % DASH_COLORES_DONUT.length]; }),
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '58%',
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 }, padding: 8 } },
        tooltip: {
          callbacks: {
            label: function (ctx) {
              const total = ctx.dataset.data.reduce(function (s, v) { return s + v; }, 0);
              const pct = total > 0 ? Math.round((ctx.parsed / total) * 100) : 0;
              return ctx.label + ': ' + formatMoney(ctx.parsed) + ' (' + pct + '%)';
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
