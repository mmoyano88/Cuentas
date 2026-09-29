/**
 * PDF DE INFORMES (trimestral y anual) — 29/09/2026
 * ------------------------------------------------------------
 * Crea el PDF del informe como archivo REAL dentro de la app (jsPDF), en
 * A4 apaisado y con tantas hojas como haga falta. Sustituye al método
 * anterior (una ventana con HTML que el navegador imprimía).
 *
 * Es un documento pensado para LEER Y LOCALIZAR datos, no para lucir:
 *   - Trimestral (para el asesor): facturas de venta, facturas de compra
 *     y apuntes de empresa del trimestre. Sin estimaciones ni impuestos.
 *   - Anual (copia de seguridad del ejercicio, para el propietario):
 *     resumen del año, facturas, apuntes de empresa y personales, e
 *     impuestos del año.
 * Los datos y los cálculos son exactamente los de siempre (funciones
 * inf* de mod-informes.js); aquí solo se DIBUJAN.
 *
 * Cada tabla que no cabe en una hoja sigue en la siguiente repitiendo su
 * cabecera, y la fila TOTAL sale una sola vez, al final de la tabla.
 *
 * Necesita: mod-pdf-motor.js (librería, fuentes y primitivas de dibujo) y
 * mod-informes.js (datos). Se guarda en Drive con pdfDocGuardarArchivo()
 * (mod-pdf-documentos.js).
 */

// ============================================================
// 1. MEDIDAS
// ============================================================

const PDFI_ANCHO = 297;
const PDFI_ALTO = 210;
const PDFI_MARGEN = 12;                       // margen lateral
const PDFI_UTIL = PDFI_ANCHO - 2 * PDFI_MARGEN; // 273 mm
const PDFI_FIN = 198;                         // el contenido no pasa de aquí
const PDFI_INICIO_CONT = 17;                  // hojas 2 en adelante
const PDFI_TEXTO = 7.5;                       // cuerpo de tabla (pt)
const PDFI_TEXTO_CAB = 6.8;                   // cabecera de tabla (pt)
const PDFI_LINEA = PDFI_TEXTO * PDFM_PT * 1.3; // alto de un renglón (mm)
const PDFI_RELLENO_V = 1.1;                   // aire arriba y abajo de cada fila
const PDFI_RELLENO_H = 1.2;                   // aire a los lados de cada celda
const PDFI_COLOR_NEGATIVO = '#A3241F';
const PDFI_COLOR_GRIS = '#6A6A6A';
const PDFI_COLOR_DESTACADA = '#f2f2ee';

// Columnas (ancho en mm; suman 273 en cada tabla de documentos)
const PDFI_COLS_FACTURAS = [
  { t: 'Nº', w: 21 }, { t: 'Fecha', w: 19 }, { t: 'Nombre', w: 34 }, { t: 'NIF', w: 18 },
  { t: 'Dirección', w: 42 }, { t: 'Concepto', w: 41 },
  { t: 'Base', w: 20, r: true }, { t: '% IVA', w: 10, r: true }, { t: 'IVA', w: 18, r: true },
  { t: '% IRPF', w: 10, r: true }, { t: 'Retención', w: 18, r: true }, { t: 'Total', w: 22, r: true }
];

const PDFI_COLS_APUNTES = [
  { t: 'Fecha', w: 19 }, { t: 'Ámbito', w: 14 }, { t: 'Tipo', w: 13 }, { t: 'Nombre', w: 33 },
  { t: 'NIF', w: 18 }, { t: 'Dirección', w: 38 }, { t: 'Concepto', w: 40 },
  { t: 'Base', w: 20, r: true }, { t: '% IVA', w: 10, r: true }, { t: 'IVA', w: 18, r: true },
  { t: '% IRPF', w: 10, r: true }, { t: 'Retención', w: 18, r: true }, { t: 'Total', w: 22, r: true }
];

// ============================================================
// 2. TEXTOS DE CELDA
// ============================================================

function pdfInfPct(v) {
  return String(parsearNumero(v)).replace('.', ',') + '%';
}

function pdfInfFilaFactura(f) {
  return [
    f.numero, f.fecha, f.nombre, f.nif, f.direccion, f.concepto,
    pdfMotorDinero(f.base), pdfInfPct(f.ivaPct), pdfMotorDinero(f.iva),
    pdfInfPct(f.irpfPct), pdfMotorDinero(f.irpf), pdfMotorDinero(f.total)
  ];
}

function pdfInfFilaApunte(f) {
  return [
    f.fecha, f.ambito, f.tipo, f.nombre, f.nif, f.direccion, f.concepto,
    pdfMotorDinero(f.base), pdfInfPct(f.ivaPct), pdfMotorDinero(f.iva),
    pdfInfPct(f.irpfPct), pdfMotorDinero(f.irpf), pdfMotorDinero(f.total)
  ];
}

// Fila TOTAL de una tabla de facturas o de apuntes: la etiqueta ocupa las
// columnas de texto y los importes van bajo sus columnas.
function pdfInfTotales(filas, columnasTexto, columnas) {
  const suma = function (campo) { return roundMoney(filas.reduce(function (s, f) { return s + f[campo]; }, 0)); };
  const celdas = [];
  for (let i = 0; i < columnas; i++) celdas.push('');
  celdas[0] = 'TOTAL';
  celdas[columnasTexto] = pdfMotorDinero(suma('base'));
  celdas[columnasTexto + 2] = pdfMotorDinero(suma('iva'));
  celdas[columnasTexto + 4] = pdfMotorDinero(suma('irpf'));
  celdas[columnasTexto + 5] = pdfMotorDinero(suma('total'));
  return celdas;
}

// ============================================================
// 3. ESTADO DEL DOCUMENTO Y PÁGINAS
// ============================================================

function pdfInfBarraSuperior(S) {
  pdfMotorRelleno(S.ctx, PDFM_COLOR_NEGRO, 0, 0, PDFI_ANCHO, 6);
  pdfMotorRelleno(S.ctx, PDFM_COLOR_ROJO, PDFI_MARGEN, 0, 26, 6);
}

// Cabecera de la primera hoja: emisor a la izquierda, título a la derecha.
function pdfInfCabeceraPrimera(S) {
  const c = S.ctx, e = S.emisor;
  pdfInfBarraSuperior(S);

  let y = 12;
  if (e.nombre) {
    pdfMotorLinea(c, pdfMotorTextoLimpio(e.nombre), PDFI_MARGEN, y, 11.5, 6.4, 'i800', PDFM_COLOR_TEXTO);
    y += 6.4;
  }
  const lineas = [
    [e.nif, e.direccion].filter(Boolean).join(' · '),
    [e.telefono, e.email].filter(Boolean).join(' · ')
  ].filter(Boolean);
  lineas.forEach(function (l) {
    pdfMotorLinea(c, pdfMotorTextoLimpio(l), PDFI_MARGEN, y, 8.5, 4.6, 'i400', PDFI_COLOR_GRIS);
    y += 4.6;
  });

  const xDer = PDFI_ANCHO - PDFI_MARGEN;
  const altoTitulo = 18 * PDFM_PT * 1.05;
  pdfMotorLinea(c, S.titulo.toUpperCase(), xDer, 11.5, 18, altoTitulo, 'archivo', PDFM_COLOR_NEGRO, 'right');
  pdfMotorLinea(c, pdfMotorTextoLimpio(S.subtitulo), xDer, 11.5 + altoTitulo + 0.8, 10, 5, 'i700', PDFM_COLOR_ROJO, 'right');
  pdfMotorLinea(c, 'Generado el ' + mostrarFecha(fechaHoyISO()), xDer, 11.5 + altoTitulo + 0.8 + 5, 8, 4.4, 'i400', PDFI_COLOR_GRIS, 'right');

  y = Math.max(y, 11.5 + altoTitulo + 10.2) + 3;
  pdfMotorRelleno(c, PDFM_COLOR_LINEA, PDFI_MARGEN, y, PDFI_UTIL, 0.3);
  return y + 5;
}

// Hojas siguientes: barra fina y una línea que dice de qué informe es.
function pdfInfCabeceraContinua(S) {
  pdfInfBarraSuperior(S);
  const texto = S.titulo + ' · ' + S.subtitulo + (S.emisor.nombre ? ' — ' + S.emisor.nombre : '');
  pdfMotorLinea(S.ctx, pdfMotorTextoLimpio(texto), PDFI_MARGEN, 8.4, 7.5, 4.2, 'i700', PDFI_COLOR_GRIS);
  return PDFI_INICIO_CONT;
}

function pdfInfPagina(S) {
  S.doc.addPage();
  S.y = pdfInfCabeceraContinua(S);
}

// Si no cabe `alto` en lo que queda de hoja, pasa a la siguiente.
function pdfInfAsegurar(S, alto) {
  if (S.y + alto > PDFI_FIN) { pdfInfPagina(S); return true; }
  return false;
}

// Pie de todas las hojas, al terminar (así se sabe el total de hojas).
function pdfInfPies(S) {
  const total = S.doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    S.doc.setPage(i);
    pdfMotorRelleno(S.ctx, PDFM_COLOR_LINEA, PDFI_MARGEN, 202, PDFI_UTIL, 0.25);
    pdfMotorLinea(S.ctx, 'Documento generado por Cuentas', PDFI_MARGEN, 203, 7, 4, 'i400', PDFI_COLOR_GRIS);
    pdfMotorLinea(S.ctx, 'Hoja ' + i + ' de ' + total, PDFI_ANCHO - PDFI_MARGEN, 203, 7, 4, 'i700', PDFI_COLOR_GRIS, 'right');
  }
}

// ============================================================
// 4. TÍTULOS Y TABLAS
// ============================================================

const PDFI_ALTO_TITULO = 8.2;

function pdfInfTitulo(S, texto, cuenta, chico) {
  const c = S.ctx;
  const fs = chico ? 8.6 : 10.5;
  pdfMotorRelleno(c, PDFM_COLOR_ROJO, PDFI_MARGEN, S.y + 1.6, 1.1, 4.4);
  pdfMotorLinea(c, pdfMotorTextoLimpio(texto), PDFI_MARGEN + 3, S.y, fs, 7.6, 'i800', PDFM_COLOR_NEGRO);
  if (cuenta !== null && cuenta !== undefined) {
    const ancho = pdfMotorAncho(c, pdfMotorTextoLimpio(texto), fs, 'i800');
    pdfMotorLinea(c, '(' + cuenta + ')', PDFI_MARGEN + 3 + ancho + 1.6, S.y, 8, 7.6, 'i400', PDFI_COLOR_GRIS);
  }
  S.y += PDFI_ALTO_TITULO;
}

function pdfInfTextoVacio(S, texto) {
  pdfMotorLinea(S.ctx, pdfMotorTextoLimpio(texto), PDFI_MARGEN + 3, S.y, 8, 5, 'i400', PDFI_COLOR_GRIS);
  S.y += 8;
}

// Divide una celda en renglones. Las columnas numéricas no se parten:
// si el importe no cabe, se reduce un poco la letra.
function pdfInfRenglones(S, valor, col) {
  const ancho = col.w - 2 * PDFI_RELLENO_H;
  if (col.r) return [pdfMotorTextoLimpio(valor)];
  return pdfMotorEnvolver(S.ctx, valor, ancho, PDFI_TEXTO, 'i400');
}

function pdfInfAltoFila(S, fila, cols) {
  let max = 1;
  cols.forEach(function (col, i) {
    const n = pdfInfRenglones(S, fila[i], col).length;
    if (n > max) max = n;
  });
  return max * PDFI_LINEA + 2 * PDFI_RELLENO_V;
}

function pdfInfCabeceraTabla(S, cols) {
  const c = S.ctx, alto = 5.6;
  pdfMotorRelleno(c, PDFM_COLOR_CABECERA_FONDO, PDFI_MARGEN, S.y, PDFI_UTIL, alto);
  let x = PDFI_MARGEN;
  cols.forEach(function (col) {
    if (col.r) pdfMotorLinea(c, col.t, x + col.w - PDFI_RELLENO_H, S.y, PDFI_TEXTO_CAB, alto, 'i700', PDFM_COLOR_TEXTO, 'right');
    else pdfMotorLinea(c, col.t, x + PDFI_RELLENO_H, S.y, PDFI_TEXTO_CAB, alto, 'i700', PDFM_COLOR_TEXTO);
    x += col.w;
  });
  S.y += alto;
}

// Dibuja una fila. `estilo`: 'normal', 'destacada' (fondo claro y negrita)
// o 'total' (fondo negro y letra blanca).
function pdfInfFila(S, fila, cols, estilo) {
  const c = S.ctx;
  const renglones = cols.map(function (col, i) { return pdfInfRenglones(S, fila[i], col); });
  let max = 1;
  renglones.forEach(function (r) { if (r.length > max) max = r.length; });
  const alto = max * PDFI_LINEA + 2 * PDFI_RELLENO_V;

  if (estilo === 'total') pdfMotorRelleno(c, PDFM_COLOR_NEGRO, PDFI_MARGEN, S.y, PDFI_UTIL, alto);
  else if (estilo === 'destacada') pdfMotorRelleno(c, PDFI_COLOR_DESTACADA, PDFI_MARGEN, S.y, PDFI_UTIL, alto);

  const fuente = estilo === 'normal' ? 'i400' : 'i800';
  let x = PDFI_MARGEN;
  cols.forEach(function (col, i) {
    const texto = renglones[i];
    let color = estilo === 'total' ? '#ffffff' : PDFM_COLOR_TEXTO;
    if (col.r && estilo !== 'total' && /^−/.test(texto[0])) color = PDFI_COLOR_NEGATIVO;
    if (fila[i] === '—' && col.r && estilo !== 'total') color = '#9A9A94';

    let fs = PDFI_TEXTO;
    if (col.r) {
      // Que el importe siempre quepa en su columna.
      while (fs > 5.5 && pdfMotorAncho(c, texto[0], fs, fuente) > col.w - 2 * PDFI_RELLENO_H) fs -= 0.25;
    }
    texto.forEach(function (linea, n) {
      const top = S.y + PDFI_RELLENO_V + n * PDFI_LINEA;
      if (col.r) pdfMotorLinea(c, linea, x + col.w - PDFI_RELLENO_H, top, fs, PDFI_LINEA, fuente, color, 'right');
      else pdfMotorLinea(c, linea, x + PDFI_RELLENO_H, top, fs, PDFI_LINEA, fuente, color);
    });
    x += col.w;
  });
  S.y += alto;
  if (estilo !== 'total') pdfMotorRelleno(c, PDFM_COLOR_LINEA, PDFI_MARGEN, S.y, PDFI_UTIL, 0.2);
  return alto;
}

// Dibuja una tabla completa con su título. `opc`:
//   filas       lista de filas (cada una, una lista de textos)
//   total       fila TOTAL (opcional)
//   destacadas  índices de filas en negrita (opcional)
//   ancho       ancho de la tabla si no ocupa toda la hoja (opcional)
//   chico       título de segundo nivel
//   vacio       texto si no hay filas
function pdfInfTabla(S, titulo, cols, opc) {
  const filas = opc.filas;
  const anchoTotal = cols.reduce(function (s, col) { return s + col.w; }, 0);

  if (!filas.length) {
    pdfInfAsegurar(S, PDFI_ALTO_TITULO + 8);
    pdfInfTitulo(S, titulo, null, opc.chico);
    pdfInfTextoVacio(S, opc.vacio || 'Sin datos.');
    return;
  }

  // El título, la cabecera y la primera fila van siempre juntos.
  // Las tablas pequeñas (resúmenes) van enteras en la misma hoja.
  let necesario = PDFI_ALTO_TITULO + 5.6 + pdfInfAltoFila(S, filas[0], cols);
  if (opc.juntas) {
    necesario = PDFI_ALTO_TITULO + 5.6 + filas.reduce(function (t, f) { return t + pdfInfAltoFila(S, f, cols); }, 0) +
      (opc.total ? pdfInfAltoFila(S, opc.total, cols) : 0);
  }
  pdfInfAsegurar(S, necesario);
  pdfInfTitulo(S, titulo, opc.cuenta === undefined ? null : opc.cuenta, opc.chico);
  pdfInfCabeceraTabla(S, cols);

  filas.forEach(function (fila, i) {
    const alto = pdfInfAltoFila(S, fila, cols);
    if (S.y + alto > PDFI_FIN) {
      pdfInfPagina(S);
      pdfInfCabeceraTabla(S, cols);
    }
    const destacada = opc.destacadas && opc.destacadas.indexOf(i) !== -1;
    pdfInfFila(S, fila, cols, destacada ? 'destacada' : 'normal');
  });

  if (opc.total) {
    const alto = pdfInfAltoFila(S, opc.total, cols);
    if (S.y + alto > PDFI_FIN) {
      pdfInfPagina(S);
      pdfInfCabeceraTabla(S, cols);
    }
    pdfInfFila(S, opc.total, cols, 'total');
  }
  S.y += 6;
  return anchoTotal;
}

// ============================================================
// 5. LOS DOS INFORMES
// ============================================================

function pdfInfTablaFacturas(S, titulo, lista, vacio) {
  const filas = lista.map(pdfInfFilaFactura);
  pdfInfTabla(S, titulo, PDFI_COLS_FACTURAS, {
    filas: filas,
    cuenta: lista.length,
    total: lista.length ? pdfInfTotales(lista, 6, PDFI_COLS_FACTURAS.length) : null,
    vacio: vacio
  });
}

function pdfInfTablaApuntes(S, titulo, lista, vacio) {
  const filas = lista.map(pdfInfFilaApunte);
  pdfInfTabla(S, titulo, PDFI_COLS_APUNTES, {
    filas: filas,
    cuenta: lista.length,
    total: lista.length ? pdfInfTotales(lista, 7, PDFI_COLS_APUNTES.length) : null,
    vacio: vacio
  });
}

// Resumen del año: tres tablas iguales (Ingresos, Gastos, Resultado) y una
// de impuestos y otros datos. Mismas cifras que infResumenAnual().
function pdfInfResumenAnual(S, anio) {
  const r = infResumenAnual(anio);
  const m = function (v) { return v === null ? '—' : pdfMotorDinero(v); };
  const cols3 = [{ t: 'Concepto', w: 84 }, { t: 'Empresa', w: 34, r: true }, { t: 'Personal', w: 34, r: true }, { t: 'Conjunto', w: 34, r: true }];

  pdfInfTitulo(S, 'Resumen del año', null, false);

  pdfInfTabla(S, 'Ingresos', cols3, {
    chico: true, juntas: true,
    filas: [
      ['Facturación (base de ventas)', m(r.facturacion), m(null), m(r.facturacion)],
      ['Otros ingresos (apuntes)', m(r.otrosIngresosEmpresa), m(r.otrosIngresosPersonal), m(roundMoney(r.otrosIngresosEmpresa + r.otrosIngresosPersonal))],
      ['TOTAL INGRESOS', m(r.ingresosEmpresa), m(r.ingresosPersonal), m(r.ingresosConjunto)]
    ],
    destacadas: [2]
  });
  pdfInfTabla(S, 'Gastos', cols3, {
    chico: true, juntas: true,
    filas: [
      ['Compras (base de facturas)', m(r.comprasBase), m(null), m(r.comprasBase)],
      ['Otros gastos (apuntes)', m(r.otrosGastosEmpresa), m(r.otrosGastosPersonal), m(roundMoney(r.otrosGastosEmpresa + r.otrosGastosPersonal))],
      ['TOTAL GASTOS', m(r.gastosEmpresa), m(r.gastosPersonal), m(r.gastosConjunto)]
    ],
    destacadas: [2]
  });
  pdfInfTabla(S, 'Resultado', cols3, {
    chico: true, juntas: true,
    filas: [['RESULTADO DEL AÑO', m(r.resultadoEmpresa), m(r.resultadoPersonal), m(r.resultadoConjunto)]],
    destacadas: [0]
  });
  pdfInfTabla(S, 'Impuestos y otros datos del año (empresa)', [{ t: 'Concepto', w: 84 }, { t: 'Importe', w: 40, r: true }], {
    chico: true, juntas: true,
    filas: [
      ['IVA repercutido (ventas)', m(r.ivaRepercutido)],
      ['IVA soportado (compras)', m(r.ivaSoportado)],
      ['IVA neto del año', m(r.ivaNeto)],
      ['IRPF retenido en tus facturas', m(r.irpfSoportado)],
      ['IRPF retenido por ti a terceros', m(r.irpfTerceros)],
      ['Impuestos pagados en el año', m(r.impuestosPagados)],
      ['Pendiente de cobro a fin de año', m(r.pendienteCobro)],
      ['Nº de facturas emitidas', String(r.numVentas)],
      ['Nº de facturas recibidas', String(r.numCompras)],
      ['Nº de apuntes (empresa / personal)', r.numApuntesEmpresa + ' / ' + r.numApuntesPersonal],
      ['Nº de facturas sin cobrar', String(r.numSinCobrar)]
    ]
  });
}

// Tabla «Impuestos del año»: estimado, real y estado de cada trimestre.
function pdfInfImpuestosDelAnio(S, anio) {
  const cols = [
    { t: 'Trimestre', w: 26 },
    { t: 'IVA estimado', w: 30, r: true }, { t: 'IVA real', w: 30, r: true }, { t: 'Estado IVA', w: 26 }, { t: 'Fecha', w: 24 },
    { t: 'IRPF estimado', w: 30, r: true }, { t: 'IRPF real', w: 30, r: true }, { t: 'Estado IRPF', w: 26 }, { t: 'Fecha', w: 24 }
  ];
  const filas = IMP_TRIMESTRES.map(function (t) {
    const r = impRegistroDe(anio, t);
    const c = impCalcular(anio, t);
    return [
      t,
      pdfMotorDinero(c.iva), pdfMotorDinero(r ? parsearNumero(r.iva_real) : 0),
      infEstadoImpuestoTexto(r, 'iva'), r ? mostrarFecha(r.iva_fecha_pago) : '—',
      pdfMotorDinero(c.irpf), pdfMotorDinero(r ? parsearNumero(r.irpf_real) : 0),
      infEstadoImpuestoTexto(r, 'irpf'), r ? mostrarFecha(r.irpf_fecha_pago) : '—'
    ];
  });
  pdfInfTabla(S, 'Impuestos del año', cols, { filas: filas, juntas: true });
}

function pdfInfNota(S, texto) {
  const lineas = pdfMotorEnvolver(S.ctx, texto, PDFI_UTIL, 7.5, 'i400');
  pdfInfAsegurar(S, lineas.length * 4 + 2);
  lineas.forEach(function (l) {
    pdfMotorLinea(S.ctx, l, PDFI_MARGEN, S.y, 7.5, 4, 'i400', PDFI_COLOR_GRIS);
    S.y += 4;
  });
}

function pdfInfConstruir(tipo, anio, trimestre, rec) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape', compress: true });
  const anual = tipo === 'anual';
  const S = {
    doc: doc,
    ctx: pdfMotorCtx(doc, rec),
    emisor: infDatosEmisor(),
    titulo: anual ? 'Informe anual' : 'Informe trimestral',
    subtitulo: anual ? 'Ejercicio ' + anio : trimestre + ' · ' + anio,
    y: 0
  };
  doc.setProperties({ title: S.titulo + ' ' + (anual ? anio : trimestre + ' ' + anio), author: S.emisor.nombre, creator: 'Cuentas' });

  S.y = pdfInfCabeceraPrimera(S);

  if (anual) {
    pdfInfResumenAnual(S, anio);
    pdfInfTablaFacturas(S, 'Facturas de venta', infVentasDelAnio(anio).map(infFilaVenta), 'No hay facturas de venta este año.');
    pdfInfTablaFacturas(S, 'Facturas de compra', infComprasDelAnio(anio).map(infFilaCompra), 'No hay facturas de compra este año.');
    pdfInfTablaApuntes(S, 'Apuntes de contabilidad', infApuntesDelAnio(anio).map(infFilaApunte), 'No hay apuntes este año.');
    pdfInfImpuestosDelAnio(S, anio);
    pdfInfNota(S, 'Documento generado por Cuentas como copia de seguridad del ejercicio ' + anio +
      '. Los gastos figuran en negativo. No incluye presupuestos ni el detalle de líneas de las facturas.');
  } else {
    pdfInfTablaFacturas(S, 'Facturas de venta', infVentasDelTrimestre(anio, trimestre).map(infFilaVenta), 'No hay facturas de venta en este trimestre.');
    pdfInfTablaFacturas(S, 'Facturas de compra', infComprasDelTrimestre(anio, trimestre).map(infFilaCompra), 'No hay facturas de compra en este trimestre.');
    pdfInfTablaApuntes(S, 'Apuntes de empresa', infApuntesEmpresaDelTrimestre(anio, trimestre).map(infFilaApunte), 'No hay apuntes de empresa en este trimestre.');
    pdfInfNota(S, 'Los gastos figuran en negativo. Documento pensado para revisar con tu asesor: no incluye estimaciones internas de la aplicación, solo los datos con los que presentar el trimestre.');
  }

  pdfInfPies(S);
  return doc;
}

// Nombre del archivo, igual para el PDF y para el Excel de un informe:
//   Informe 2026 Q3.pdf   ·   Informe 2026 anual.pdf
function pdfInfNombreBase(tipo, anio, trimestre) {
  return 'Informe ' + anio + ' ' + (tipo === 'anual' ? 'anual' : trimestre);
}

// Punto de entrada: devuelve { blob, nombre, anio }.
async function pdfInfGenerar(tipo, anio, trimestre) {
  await pdfMotorCargarLibreria();
  const rec = await pdfMotorCargarRecursos(PDFM_URL_CABECERA);
  const doc = pdfInfConstruir(tipo, anio, trimestre, rec);
  return { blob: doc.output('blob'), nombre: pdfInfNombreBase(tipo, anio, trimestre) + '.pdf', anio: Number(anio) };
}
