/**
 * MÓDULO INFORMES
 * ------------------------------------------------------------
 * Vive dentro de la sección Impuestos, en la pestaña «Informes»
 * (decisión de navegación del 31/08/2026). El selector Impuestos ⇄
 * Informes lo pinta `mod-impuestos.js`, que llama aquí a
 * `pintarInformes()`.
 *
 * REDISEÑO 05/09/2026, a petición del propietario: la PANTALLA y el
 * PDF dejan de mostrar lo mismo. Son tres cosas distintas con
 * público distinto, y cada una enseña solo lo suyo:
 *
 * - PANTALLA (esta vista): un resumen simplificado de los impuestos
 *   del año elegido — los cuatro trimestres, pagados o no, con
 *   estimado/real/estado, y el total del año. Nada de facturas, nada
 *   de apuntes, nada de PDF embebido. Es la vista rápida de "cómo va
 *   el año". El detalle línea a línea de cada trimestre ya vive en la
 *   pestaña Impuestos; el detalle del Dashboard vive en el Dashboard.
 *   Aquí solo el resumen.
 *
 * - PDF TRIMESTRAL: documento para el asesor. Solo lo que puede
 *   necesitar para presentar el modelo: facturas de venta, facturas
 *   de compra, apuntes de empresa del trimestre y un totalizador de
 *   facturación. Sin comparativa estimado/real — el asesor no la
 *   necesita, es una herramienta interna de la aplicación.
 *
 * - PDF ANUAL: copia de seguridad de fin de año. Facturas, apuntes
 *   (de empresa y personales) e impuestos del año completo, más un
 *   resumen dividido en tablas pequeñas y claras.
 *
 * El selector Anual/Trimestral que antes decidía qué VER en pantalla
 * ahora decide solo qué PDF descargar — la pantalla ya no cambia de
 * contenido al tocarlo.
 *
 * PDF: sin librería, igual que la app original (mapa 15.1). Se abre
 * una ventana nueva con el documento maquetado para impresión y se
 * llama a print(). La paginación es NATURAL: el navegador reparte el
 * contenido en tantas hojas como haga falta, sin saltos forzados —
 * el propietario elige vertical/horizontal en el propio diálogo de
 * impresión.
 */

// ============================================================
// 0. ESTADO PROPIO DEL MÓDULO
// ============================================================

let infPdfTipo = 'trimestral';  // 'trimestral' | 'anual' — solo decide qué PDF se descarga
let infAnio = null;
let infTrimestre = null;

// ============================================================
// 1. UTILIDADES
// ============================================================

function infTexto(v) {
  return String(v === null || v === undefined ? '' : v).trim();
}

function infAnioDe(iso) {
  const f = normalizarFecha(iso);
  if (!f) return null;
  const a = parseInt(infTexto(f).split('-')[0], 10);
  return a > 1990 ? a : null;
}

function infOrdenarPorFecha(lista) {
  return lista.slice().sort(function (a, b) {
    const fa = normalizarFecha(a.fecha);
    const fb = normalizarFecha(b.fecha);
    if (fa < fb) return -1;
    if (fa > fb) return 1;
    return 0;
  });
}

function infContactoPorId(id) {
  if (!id && id !== 0) return null;
  return estado.clientes.find(function (c) { return String(c.id) === String(id); }) || null;
}

function infDireccionDe(contacto) {
  if (!contacto) return '';
  const calle = [infTexto(contacto.calle), infTexto(contacto.numero)].filter(Boolean).join(' ');
  const ciudad = [infTexto(contacto.codigo_postal), infTexto(contacto.poblacion)].filter(Boolean).join(' ');
  return [calle, ciudad, infTexto(contacto.provincia)].filter(Boolean).join(', ');
}

function infNombreDe(contacto) {
  if (!contacto) return '';
  return infTexto(contacto.nombre_fiscal) || infTexto(contacto.nombre_contacto);
}

function infFilaVenta(f) {
  const c = infContactoPorId(f.id_cliente);
  return {
    numero: infTexto(f.numero) || '—',
    fecha: mostrarFecha(f.fecha),
    nombre: infTexto(f.cliente) || infNombreDe(c) || '—',
    nif: infTexto(f.nif) || infTexto(c && c.nif) || '—',
    direccion: infDireccionDe(c) || '—',
    concepto: infTexto(f.concepto) || '—',
    base: parsearNumero(f.base),
    ivaPct: parsearNumero(f.iva_pct),
    iva: parsearNumero(f.iva),
    irpfPct: parsearNumero(f.irpf_pct),
    irpf: parsearNumero(f.irpf),
    total: parsearNumero(f.total)
  };
}

function infFilaCompra(f) {
  const c = infContactoPorId(f.id_proveedor);
  return {
    numero: infTexto(f.numero) || '—',
    fecha: mostrarFecha(f.fecha),
    nombre: infTexto(f.proveedor) || infNombreDe(c) || '—',
    nif: infTexto(f.nif) || infTexto(c && c.nif) || '—',
    direccion: infDireccionDe(c) || '—',
    concepto: infTexto(f.concepto) || '—',
    base: parsearNumero(f.base),
    ivaPct: parsearNumero(f.iva_pct),
    iva: parsearNumero(f.iva),
    irpfPct: parsearNumero(f.irpf_pct),
    irpf: parsearNumero(f.irpf),
    total: parsearNumero(f.total)
  };
}

function infFilaApunte(a) {
  const c = infContactoPorId(a.id_contacto);
  const esIngreso = infTexto(a.tipo) === 'ingreso';
  const signo = esIngreso ? 1 : -1;
  return {
    numero: '—',
    fecha: mostrarFecha(a.fecha),
    nombre: infNombreDe(c) || '—',
    nif: infTexto(c && c.nif) || '—',
    direccion: infDireccionDe(c) || '—',
    concepto: infTexto(a.concepto) || '—',
    ambito: infTexto(a.ambito) === 'personal' ? 'Personal' : 'Empresa',
    tipo: esIngreso ? 'Ingreso' : 'Gasto',
    esIngreso: esIngreso,
    base: parsearNumero(a.base) * signo,
    ivaPct: parsearNumero(a.iva_pct),
    iva: parsearNumero(a.iva) * signo,
    irpfPct: parsearNumero(a.irpf_pct),
    irpf: parsearNumero(a.irpf) * signo,
    total: parsearNumero(a.total) * signo
  };
}

// ============================================================
// 2. RECOGIDA DE DATOS
// ============================================================

function infVentasDelAnio(anio) {
  return infOrdenarPorFecha(estado.ventas.filter(function (f) {
    return fvEstaActiva(f) && infAnioDe(f.fecha) === anio;
  }));
}

function infComprasDelAnio(anio) {
  return infOrdenarPorFecha(estado.compras.filter(function (f) {
    return fcEstaActiva(f) && infAnioDe(f.fecha) === anio;
  }));
}

function infApuntesDelAnio(anio) {
  return infOrdenarPorFecha(estado.apuntes.filter(function (a) {
    if (a.id_factura_venta || a.id_factura_compra || a.id_impuesto) return false;
    return infAnioDe(a.fecha) === anio;
  }));
}

function infVentasDelTrimestre(anio, trimestre) {
  return infOrdenarPorFecha(impVentasDelPeriodo(anio, trimestre));
}

function infComprasDelTrimestre(anio, trimestre) {
  return infOrdenarPorFecha(impComprasDelPeriodo(anio, trimestre));
}

// Solo de EMPRESA (GUÍA 14.1): el PDF trimestral es para el asesor,
// no lleva movimiento personal.
function infApuntesEmpresaDelTrimestre(anio, trimestre) {
  return infOrdenarPorFecha(estado.apuntes.filter(function (a) {
    if (String(a.ambito || '') !== 'empresa') return false;
    if (a.id_factura_venta || a.id_factura_compra || a.id_impuesto) return false;
    return impEnTrimestre(a.fecha, anio, trimestre);
  }));
}

// ============================================================
// 3. RESUMEN DE LA PANTALLA — solo impuestos del año
// ============================================================

function infResumenPantalla(anio) {
  const filas = IMP_TRIMESTRES.map(function (t) {
    const r = impRegistroDe(anio, t);
    const c = impCalcular(anio, t);

    // La estimación que se muestra es SIEMPRE la calculada en vivo,
    // igual que en la pestaña Impuestos (corrección 06/09/2026).
    //
    // Antes se mostraba el valor guardado en el registro fiscal cuando
    // ese registro existía, y solo se recalculaba si no existía. Eso
    // hacía que un mismo trimestre enseñara dos cifras distintas de
    // IRPF en Impuestos y en Informes, sin ninguna explicación: el
    // campo `irpf_estimado` se congela a propósito al marcar el
    // trimestre como pagado (mapa 12.7), así que se queda desfasado en
    // cuanto se añaden apuntes o facturas de ese trimestre después de
    // haber pagado.
    //
    // El valor congelado no se pierde: se conserva aparte y, si no
    // coincide con el de hoy, se avisa en la tarjeta. Es un dato
    // histórico útil ("esto estimaba la app el día que pagaste"), pero
    // no es la cifra que hay que enseñar como estimación actual.
    const ivaPagado = r && infTexto(r.iva_estado).toLowerCase() === 'pagado';
    const irpfPagado = r && infTexto(r.irpf_estado).toLowerCase() === 'pagado';

    const ivaGuardado = r ? parsearNumero(r.iva_estimado) : 0;
    const irpfGuardado = r ? parsearNumero(r.irpf_estimado) : 0;

    // Solo tiene sentido comparar si el trimestre está pagado (es
    // cuando se congeló la cifra) y hay algo guardado con lo que
    // comparar. Se usa un margen de un céntimo para no avisar por
    // diferencias de redondeo.
    const ivaDesfasado = ivaPagado && ivaGuardado !== 0 && Math.abs(ivaGuardado - c.iva) > 0.01;
    const irpfDesfasado = irpfPagado && irpfGuardado !== 0 && Math.abs(irpfGuardado - c.irpf) > 0.01;

    return {
      trimestre: t,
      ivaEstimado: c.iva,
      ivaGuardado: ivaGuardado,
      ivaDesfasado: ivaDesfasado,
      ivaReal: r ? parsearNumero(r.iva_real) : 0,
      ivaPagado: ivaPagado,
      irpfEstimado: c.irpf,
      irpfGuardado: irpfGuardado,
      irpfDesfasado: irpfDesfasado,
      irpfReal: r ? parsearNumero(r.irpf_real) : 0,
      irpfPagado: irpfPagado,
      completo: ivaPagado && irpfPagado
    };
  });

  const totalEstimado = roundMoney(filas.reduce(function (s, f) { return s + f.ivaEstimado + f.irpfEstimado; }, 0));
  const totalPagado = roundMoney(filas.reduce(function (s, f) {
    return s + (f.ivaPagado ? f.ivaReal : 0) + (f.irpfPagado ? f.irpfReal : 0);
  }, 0));
  const trimestresPendientes = filas.filter(function (f) { return !f.completo; }).length;

  return { filas: filas, totalEstimado: totalEstimado, totalPagado: totalPagado, trimestresPendientes: trimestresPendientes };
}

// ============================================================
// 4. RESUMEN DEL PDF ANUAL — tres tablas separadas, claras
// ============================================================

function infResumenAnual(anio) {
  const ventas = infVentasDelAnio(anio);
  const compras = infComprasDelAnio(anio);
  const apuntes = infApuntesDelAnio(anio);

  const apEmpresa = apuntes.filter(function (a) { return infTexto(a.ambito) !== 'personal'; });
  const apPersonal = apuntes.filter(function (a) { return infTexto(a.ambito) === 'personal'; });

  const ingresoDe = function (lista) { return lista.filter(function (a) { return infTexto(a.tipo) === 'ingreso'; }); };
  const gastoDe = function (lista) { return lista.filter(function (a) { return infTexto(a.tipo) === 'gasto'; }); };

  const facturacion = impSuma(ventas, 'base');
  const otrosIngresosEmpresa = impSuma(ingresoDe(apEmpresa), 'base');
  const otrosIngresosPersonal = impSuma(ingresoDe(apPersonal), 'base');

  const comprasBase = impSuma(compras, 'base');
  const otrosGastosEmpresa = impSuma(gastoDe(apEmpresa), 'base');
  const otrosGastosPersonal = impSuma(gastoDe(apPersonal), 'base');

  const ingresosEmpresa = roundMoney(facturacion + otrosIngresosEmpresa);
  const gastosEmpresa = roundMoney(comprasBase + otrosGastosEmpresa);

  let impuestosPagados = 0;
  IMP_TRIMESTRES.forEach(function (t) {
    const r = impRegistroDe(anio, t);
    if (!r) return;
    if (infTexto(r.iva_estado).toLowerCase() === 'pagado') impuestosPagados += parsearNumero(r.iva_real);
    if (infTexto(r.irpf_estado).toLowerCase() === 'pagado') impuestosPagados += parsearNumero(r.irpf_real);
  });

  const sinCobrar = ventas.filter(function (f) {
    return infTexto(f.estado).toLowerCase() !== 'pagada';
  });

  return {
    facturacion: facturacion,
    otrosIngresosEmpresa: otrosIngresosEmpresa,
    otrosIngresosPersonal: otrosIngresosPersonal,
    ingresosEmpresa: ingresosEmpresa,
    ingresosPersonal: otrosIngresosPersonal,
    ingresosConjunto: roundMoney(ingresosEmpresa + otrosIngresosPersonal),

    comprasBase: comprasBase,
    otrosGastosEmpresa: otrosGastosEmpresa,
    otrosGastosPersonal: otrosGastosPersonal,
    gastosEmpresa: gastosEmpresa,
    gastosPersonal: otrosGastosPersonal,
    gastosConjunto: roundMoney(gastosEmpresa + otrosGastosPersonal),

    resultadoEmpresa: roundMoney(ingresosEmpresa - gastosEmpresa),
    resultadoPersonal: roundMoney(otrosIngresosPersonal - otrosGastosPersonal),
    resultadoConjunto: roundMoney((ingresosEmpresa + otrosIngresosPersonal) - (gastosEmpresa + otrosGastosPersonal)),

    ivaRepercutido: impSuma(ventas, 'iva'),
    ivaSoportado: impSuma(compras, 'iva'),
    ivaNeto: roundMoney(impSuma(ventas, 'iva') - impSuma(compras, 'iva')),
    irpfSoportado: impSuma(ventas, 'irpf'),
    irpfTerceros: impSuma(compras, 'irpf'),
    impuestosPagados: roundMoney(impuestosPagados),
    pendienteCobro: impSuma(sinCobrar, 'total'),

    numVentas: ventas.length,
    numCompras: compras.length,
    numApuntesEmpresa: apEmpresa.length,
    numApuntesPersonal: apPersonal.length,
    numSinCobrar: sinCobrar.length
  };
}

// ============================================================
// 6. CONSTRUCCIÓN DEL DOCUMENTO
// ============================================================

function infDatosEmisor() {
  const direccion = [
    [cfgTexto('fiscal_calle'), cfgTexto('fiscal_numero')].filter(Boolean).join(' '),
    [cfgTexto('fiscal_codigo_postal'), cfgTexto('fiscal_poblacion')].filter(Boolean).join(' '),
    cfgTexto('fiscal_provincia')
  ].filter(Boolean).join(', ');

  return {
    nombre: cfgTexto('fiscal_nombre'),
    nif: cfgTexto('fiscal_nif'),
    direccion: direccion,
    telefono: cfgTexto('perfil_telefono'),
    email: cfgTexto('perfil_email')
  };
}

function infCabeceraDoc(titulo, subtitulo) {
  const e = infDatosEmisor();
  const contacto = [e.telefono, e.email].filter(Boolean).join(' · ');

  return '<div class="inf-doc-cabecera">' +
    '<div class="inf-doc-emisor">' +
      (e.nombre ? '<p class="inf-doc-emisor-nombre">' + escaparHtml(e.nombre) + '</p>' : '') +
      (e.nif ? '<p>NIF ' + escaparHtml(e.nif) + '</p>' : '') +
      (e.direccion ? '<p>' + escaparHtml(e.direccion) + '</p>' : '') +
      (contacto ? '<p>' + escaparHtml(contacto) + '</p>' : '') +
    '</div>' +
    '<div class="inf-doc-titulo-zona">' +
      '<p class="inf-doc-titulo">' + escaparHtml(titulo) + '</p>' +
      '<p class="inf-doc-subtitulo">' + escaparHtml(subtitulo) + '</p>' +
      '<p class="inf-doc-generado">Generado el ' + escaparHtml(mostrarFecha(fechaHoyISO())) + '</p>' +
    '</div>' +
  '</div>';
}

function infCelda(valor) {
  return '<td>' + escaparHtml(valor) + '</td>';
}

function infCeldaNum(valor, conSigno) {
  const n = parsearNumero(valor);
  const clase = conSigno && n < 0 ? ' class="inf-num inf-negativo"' : ' class="inf-num"';
  return '<td' + clase + '>' + escaparHtml(formatMoney(n)) + '</td>';
}

// El % va en un <span> pequeño en línea, dentro de una celda de ancho
// FIJO (ver infColgroup* más abajo): así el porcentaje ya no alarga
// la columna más que su cabecera y descuadra el título.
function infCeldaNumConPct(valor, pct) {
  const n = parsearNumero(valor);
  const clase = n < 0 ? ' class="inf-num inf-negativo"' : ' class="inf-num"';
  return '<td' + clase + '>' + escaparHtml(formatMoney(n)) +
    (pct ? ' <span class="inf-pct">(' + pct + '%)</span>' : '') + '</td>';
}

function infTablaTotales(filas) {
  return {
    base: roundMoney(filas.reduce(function (s, f) { return s + f.base; }, 0)),
    iva: roundMoney(filas.reduce(function (s, f) { return s + f.iva; }, 0)),
    irpf: roundMoney(filas.reduce(function (s, f) { return s + f.irpf; }, 0)),
    total: roundMoney(filas.reduce(function (s, f) { return s + f.total; }, 0))
  };
}

function infTablaFacturas(titulo, filas, conConcepto, vacio) {
  if (filas.length === 0) {
    return '<h2 class="inf-doc-seccion">' + escaparHtml(titulo) + '</h2>' +
           '<p class="inf-doc-vacio">' + escaparHtml(vacio) + '</p>';
  }

  const t = infTablaTotales(filas);

  return '<h2 class="inf-doc-seccion">' + escaparHtml(titulo) +
      ' <span class="inf-doc-cuenta">(' + filas.length + ')</span></h2>' +
    '<table class="inf-tabla-doc inf-tabla-facturas' + (conConcepto ? ' con-concepto' : '') + '"><thead><tr>' +
      '<th>Nº</th><th>Fecha</th><th>Nombre</th><th>NIF</th><th>Dirección</th>' +
      (conConcepto ? '<th>Concepto</th>' : '') +
      '<th class="inf-num">Base</th><th class="inf-num">IVA</th>' +
      '<th class="inf-num">Retención IRPF</th><th class="inf-num">Total</th>' +
    '</tr></thead><tbody>' +
    filas.map(function (f) {
      return '<tr>' +
        infCelda(f.numero) + infCelda(f.fecha) + infCelda(f.nombre) +
        infCelda(f.nif) + infCelda(f.direccion) +
        (conConcepto ? infCelda(f.concepto) : '') +
        infCeldaNum(f.base, true) +
        infCeldaNumConPct(f.iva, f.ivaPct) +
        infCeldaNumConPct(f.irpf, f.irpfPct) +
        infCeldaNum(f.total, true) +
      '</tr>';
    }).join('') +
    '</tbody><tfoot><tr>' +
      '<td colspan="' + (conConcepto ? 6 : 5) + '">TOTAL</td>' +
      infCeldaNum(t.base, true) + infCeldaNum(t.iva, true) +
      infCeldaNum(t.irpf, true) + infCeldaNum(t.total, true) +
    '</tr></tfoot></table>';
}

function infTablaApuntes(titulo, filas, conConcepto, vacio) {
  if (filas.length === 0) {
    return '<h2 class="inf-doc-seccion">' + escaparHtml(titulo) + '</h2>' +
           '<p class="inf-doc-vacio">' + escaparHtml(vacio) + '</p>';
  }

  const t = infTablaTotales(filas);

  return '<h2 class="inf-doc-seccion">' + escaparHtml(titulo) +
      ' <span class="inf-doc-cuenta">(' + filas.length + ')</span></h2>' +
    '<table class="inf-tabla-doc inf-tabla-apuntes' + (conConcepto ? ' con-concepto' : '') + '"><thead><tr>' +
      '<th>Fecha</th><th>Ámbito</th><th>Tipo</th><th>Nombre</th><th>NIF</th><th>Dirección</th>' +
      (conConcepto ? '<th>Concepto</th>' : '') +
      '<th class="inf-num">Base</th><th class="inf-num">IVA</th>' +
      '<th class="inf-num">Retención IRPF</th><th class="inf-num">Total</th>' +
    '</tr></thead><tbody>' +
    filas.map(function (f) {
      return '<tr>' +
        infCelda(f.fecha) + infCelda(f.ambito) + infCelda(f.tipo) +
        infCelda(f.nombre) + infCelda(f.nif) + infCelda(f.direccion) +
        (conConcepto ? infCelda(f.concepto) : '') +
        infCeldaNum(f.base, true) + infCeldaNum(f.iva, true) +
        infCeldaNum(f.irpf, true) + infCeldaNum(f.total, true) +
      '</tr>';
    }).join('') +
    '</tbody><tfoot><tr>' +
      '<td colspan="' + (conConcepto ? 7 : 6) + '">TOTAL</td>' +
      infCeldaNum(t.base, true) + infCeldaNum(t.iva, true) +
      infCeldaNum(t.irpf, true) + infCeldaNum(t.total, true) +
    '</tr></tfoot></table>';
}

// La estimación es SIEMPRE la calculada hoy, igual que en la pantalla de
// Impuestos y en la de Informes (corrección del 06/09/2026, que el PDF
// no había recibido: seguía usando la cifra congelada al pagar, así que
// el PDF y la pantalla podían decir cosas distintas). 23/09/2026.
function infTablaImpuestos(anio) {
  const filas = IMP_TRIMESTRES.map(function (t) {
    const r = impRegistroDe(anio, t);
    const c = impCalcular(anio, t);
    return {
      trimestre: t,
      ivaEstimado: c.iva,
      ivaReal: r ? parsearNumero(r.iva_real) : 0,
      ivaEstado: r && infTexto(r.iva_estado).toLowerCase() === 'pagado' ? 'Pagado' : 'Pendiente',
      ivaFecha: r ? mostrarFecha(r.iva_fecha_pago) : '—',
      irpfEstimado: c.irpf,
      irpfReal: r ? parsearNumero(r.irpf_real) : 0,
      irpfEstado: r && infTexto(r.irpf_estado).toLowerCase() === 'pagado' ? 'Pagado' : 'Pendiente',
      irpfFecha: r ? mostrarFecha(r.irpf_fecha_pago) : '—'
    };
  });

  return '<h2 class="inf-doc-seccion">Impuestos del año</h2>' +
    '<table class="inf-tabla-doc inf-tabla-impuestos"><thead><tr>' +
      '<th>Trimestre</th>' +
      '<th class="inf-num">IVA estimado</th><th class="inf-num">IVA real</th><th>Estado IVA</th><th>Fecha</th>' +
      '<th class="inf-num">IRPF estimado</th><th class="inf-num">IRPF real</th><th>Estado IRPF</th><th>Fecha</th>' +
    '</tr></thead><tbody>' +
    filas.map(function (f) {
      return '<tr>' +
        infCelda(f.trimestre) +
        infCeldaNum(f.ivaEstimado, true) + infCeldaNum(f.ivaReal, true) +
        infCelda(f.ivaEstado) + infCelda(f.ivaFecha) +
        infCeldaNum(f.irpfEstimado, true) + infCeldaNum(f.irpfReal, true) +
        infCelda(f.irpfEstado) + infCelda(f.irpfFecha) +
      '</tr>';
    }).join('') +
    '</tbody></table>';
}

// ---- Resumen anual: TRES tablas separadas (rediseño 05/09/2026) ----

function infFilaResumen(etiqueta, valores) {
  return '<tr>' +
    '<td>' + escaparHtml(etiqueta) + '</td>' +
    valores.map(function (v) {
      if (v === null) return '<td class="inf-num inf-nd">—</td>';
      const n = parsearNumero(v);
      return '<td class="inf-num' + (n < 0 ? ' inf-negativo' : '') + '">' + escaparHtml(formatMoney(n)) + '</td>';
    }).join('') +
  '</tr>';
}

function infFilaResumenDestacada(etiqueta, valores) {
  return infFilaResumen(etiqueta, valores).replace('<tr>', '<tr class="inf-fila-destacada">');
}

function infTablaIngresos(r) {
  return '<h3 class="inf-doc-subseccion">Ingresos</h3>' +
    '<table class="inf-tabla-doc inf-tabla-resumen"><thead><tr>' +
      '<th>Concepto</th><th class="inf-num">Empresa</th><th class="inf-num">Personal</th><th class="inf-num">Conjunto</th>' +
    '</tr></thead><tbody>' +
    infFilaResumen('Facturación (base de ventas)', [r.facturacion, null, r.facturacion]) +
    infFilaResumen('Otros ingresos (apuntes)', [r.otrosIngresosEmpresa, r.otrosIngresosPersonal, roundMoney(r.otrosIngresosEmpresa + r.otrosIngresosPersonal)]) +
    infFilaResumenDestacada('TOTAL INGRESOS', [r.ingresosEmpresa, r.ingresosPersonal, r.ingresosConjunto]) +
    '</tbody></table>';
}

function infTablaGastos(r) {
  return '<h3 class="inf-doc-subseccion">Gastos</h3>' +
    '<table class="inf-tabla-doc inf-tabla-resumen"><thead><tr>' +
      '<th>Concepto</th><th class="inf-num">Empresa</th><th class="inf-num">Personal</th><th class="inf-num">Conjunto</th>' +
    '</tr></thead><tbody>' +
    infFilaResumen('Compras (base de facturas)', [r.comprasBase, null, r.comprasBase]) +
    infFilaResumen('Otros gastos (apuntes)', [r.otrosGastosEmpresa, r.otrosGastosPersonal, roundMoney(r.otrosGastosEmpresa + r.otrosGastosPersonal)]) +
    infFilaResumenDestacada('TOTAL GASTOS', [r.gastosEmpresa, r.gastosPersonal, r.gastosConjunto]) +
    '</tbody></table>';
}

// El resultado va en su propia tabla, separado de Gastos: pegado
// debajo parecía una fila más de la misma tabla y se perdía
// (comentario del propietario, 05/09/2026).
function infTablaResultado(r) {
  return '<h3 class="inf-doc-subseccion">Resultado</h3>' +
    '<table class="inf-tabla-doc inf-tabla-resumen"><thead><tr>' +
      '<th>Concepto</th><th class="inf-num">Empresa</th><th class="inf-num">Personal</th><th class="inf-num">Conjunto</th>' +
    '</tr></thead><tbody>' +
    infFilaResumenDestacada('RESULTADO DEL AÑO', [r.resultadoEmpresa, r.resultadoPersonal, r.resultadoConjunto]) +
    '</tbody></table>';
}

// Solo EMPRESA (el IVA y los impuestos no tienen versión personal):
// una sola columna de importe, sin repetir Empresa/Personal/Conjunto
// con dos columnas en blanco que no aportarían nada.
function infTablaImpuestosYOtros(r) {
  const fila = function (etiqueta, valor) {
    const n = parsearNumero(valor);
    return '<tr><td>' + escaparHtml(etiqueta) + '</td>' +
      '<td class="inf-num' + (n < 0 ? ' inf-negativo' : '') + '">' + escaparHtml(formatMoney(n)) + '</td></tr>';
  };
  const filaTexto = function (etiqueta, valor) {
    return '<tr><td>' + escaparHtml(etiqueta) + '</td><td class="inf-num">' + escaparHtml(valor) + '</td></tr>';
  };

  return '<h3 class="inf-doc-subseccion">Impuestos y otros datos del año (empresa)</h3>' +
    '<table class="inf-tabla-doc inf-tabla-resumen-simple"><tbody>' +
      fila('IVA repercutido (ventas)', r.ivaRepercutido) +
      fila('IVA soportado (compras)', r.ivaSoportado) +
      fila('IVA neto del año', r.ivaNeto) +
      fila('IRPF retenido en tus facturas', r.irpfSoportado) +
      fila('IRPF retenido por ti a terceros', r.irpfTerceros) +
      fila('Impuestos pagados en el año', r.impuestosPagados) +
      fila('Pendiente de cobro a fin de año', r.pendienteCobro) +
      filaTexto('Nº de facturas emitidas', String(r.numVentas)) +
      filaTexto('Nº de facturas recibidas', String(r.numCompras)) +
      filaTexto('Nº de apuntes (empresa / personal)', r.numApuntesEmpresa + ' / ' + r.numApuntesPersonal) +
      filaTexto('Nº de facturas sin cobrar', String(r.numSinCobrar)) +
    '</tbody></table>';
}

function infDocumentoAnual(anio) {
  const ventas = infVentasDelAnio(anio).map(infFilaVenta);
  const compras = infComprasDelAnio(anio).map(infFilaCompra);
  const apuntes = infApuntesDelAnio(anio).map(infFilaApunte);
  const resumen = infResumenAnual(anio);

  return infCabeceraDoc('Informe anual', 'Ejercicio ' + anio) +
    '<h2 class="inf-doc-seccion">Resumen del año</h2>' +
    infTablaIngresos(resumen) +
    infTablaGastos(resumen) +
    infTablaResultado(resumen) +
    infTablaImpuestosYOtros(resumen) +
    infTablaFacturas('Facturas de venta', ventas, true, 'No hay facturas de venta este año.') +
    infTablaFacturas('Facturas de compra', compras, true, 'No hay facturas de compra este año.') +
    infTablaApuntes('Apuntes de contabilidad', apuntes, true, 'No hay apuntes este año.') +
    infTablaImpuestos(anio) +
    '<p class="inf-doc-pie">Documento generado por Cuentas como copia de seguridad del ejercicio ' + anio +
      '. Los gastos figuran en negativo. No incluye presupuestos ni el detalle de líneas de las facturas.</p>';
}

function infDocumentoTrimestral(anio, trimestre) {
  const ventas = infVentasDelTrimestre(anio, trimestre).map(infFilaVenta);
  const compras = infComprasDelTrimestre(anio, trimestre).map(infFilaCompra);
  const apuntes = infApuntesEmpresaDelTrimestre(anio, trimestre).map(infFilaApunte);

  return infCabeceraDoc('Informe trimestral', trimestre + ' · ' + anio) +
    infTablaFacturas('Facturas de venta', ventas, true, 'No hay facturas de venta en este trimestre.') +
    infTablaFacturas('Facturas de compra', compras, true, 'No hay facturas de compra en este trimestre.') +
    infTablaApuntes('Apuntes de empresa', apuntes, true, 'No hay apuntes de empresa en este trimestre.') +
    '<p class="inf-doc-pie">Los gastos figuran en negativo. Documento pensado para revisar con tu asesor: no incluye estimaciones internas de la aplicación, solo los datos con los que presentar el trimestre.</p>';
}

function infDocumentoActual() {
  if (infPdfTipo === 'anual') return infDocumentoAnual(infAnio);
  return infDocumentoTrimestral(infAnio, infTrimestre);
}

function infTituloActual() {
  if (infPdfTipo === 'anual') return 'Informe anual ' + infAnio;
  return 'Informe trimestral ' + infTrimestre + ' ' + infAnio;
}

// ============================================================
// 7. PANTALLA — solo el resumen de impuestos del año
// ============================================================

function pintarInformes() {
  const zona = document.getElementById('imp-zona');
  if (!zona) return;

  const anios = impAniosDisponibles();

  if (infAnio === null || anios.indexOf(infAnio) === -1) {
    const porDefecto = impPeriodoPorDefecto();
    infAnio = porDefecto.anio;
    infTrimestre = porDefecto.trimestre;
  }
  if (IMP_TRIMESTRES.indexOf(infTrimestre) === -1) infTrimestre = fvTrimestreDeFecha(fechaHoyISO());

  const resumen = infResumenPantalla(infAnio);

  zona.innerHTML =
    '<div class="inf-periodo">' +
      '<select class="campo inf-select-anio" id="inf-anio">' +
        anios.map(function (a) {
          return '<option value="' + a + '"' + (a === infAnio ? ' selected' : '') + '>' + a + '</option>';
        }).join('') +
      '</select>' +
    '</div>' +

    '<p class="inf-nota-cabecera">Resumen de los impuestos de ' + infAnio + '. El detalle de cada trimestre está en la pestaña Impuestos.</p>' +

    infResumenPantallaHtml(resumen, infAnio) +

    '<div class="inf-descarga">' +
      '<p class="inf-descarga-titulo">Descargar un informe</p>' +
      '<div class="inf-selector" id="inf-selector-tipo">' +
        '<button type="button" data-tipo="trimestral"' + (infPdfTipo === 'trimestral' ? ' class="activa"' : '') + '>Trimestral</button>' +
        '<button type="button" data-tipo="anual"' + (infPdfTipo === 'anual' ? ' class="activa"' : '') + '>Anual</button>' +
      '</div>' +
      (infPdfTipo === 'trimestral'
        ? '<div class="inf-selector inf-selector-trimestres" id="inf-trimestres">' +
            IMP_TRIMESTRES.map(function (t) {
              return '<button type="button" data-trimestre="' + t + '"' +
                (t === infTrimestre ? ' class="activa"' : '') + '>' + t + '</button>';
            }).join('') +
          '</div>'
        : '') +
      '<div class="inf-botones-descarga">' +
        '<button type="button" class="boton-principal inf-btn-pdf" id="inf-btn-pdf">' +
          '<i class="ti ti-file-type-pdf"></i> PDF' +
        '</button>' +
        '<button type="button" class="boton-secundario inf-btn-pdf" id="inf-btn-excel">' +
          '<i class="ti ti-file-spreadsheet"></i> Excel' +
        '</button>' +
      '</div>' +
      '<p class="inf-descarga-nota">' +
        (infPdfTipo === 'trimestral'
          ? 'Facturas y apuntes de empresa del trimestre, para tu asesor. ' +
            'El Excel lleva lo mismo que el PDF, cada cosa en su hoja.'
          : 'Copia de seguridad completa del año: resumen, facturas, apuntes (empresa y personal) e impuestos. ' +
            'El Excel lleva lo mismo que el PDF, cada cosa en su hoja, y además el resumen del 347.') +
      '</p>' +
    '</div>' +

    // Resumen del 347 y revisión de datos (26/09/2026): solo leen.
    inf347Html(infAnio) +
    (typeof revHtml === 'function' ? revHtml(infAnio) : '') +
    // Espacio que ocupan tus datos en este dispositivo (28/09/2026).
    infEspacioHtml();

  infPrepararCarrusel(zona);

  document.getElementById('inf-anio').addEventListener('change', function (ev) {
    infAnio = parseInt(ev.target.value, 10);
    pintarInformes();
  });

  zona.querySelector('#inf-selector-tipo').querySelectorAll('[data-tipo]').forEach(function (b) {
    b.addEventListener('click', function () {
      infPdfTipo = b.dataset.tipo;
      pintarInformes();
    });
  });

  const trimestres = zona.querySelector('#inf-trimestres');
  if (trimestres) {
    trimestres.querySelectorAll('[data-trimestre]').forEach(function (b) {
      b.addEventListener('click', function () {
        infTrimestre = b.dataset.trimestre;
        pintarInformes();
      });
    });
  }

  zona.querySelector('#inf-btn-pdf').addEventListener('click', infImprimir);
  zona.querySelector('#inf-btn-excel').addEventListener('click', infDescargarExcel);
}

function infResumenPantallaHtml(resumen, anio) {
  // Cada trimestre muestra el estimado Y el real, para poder
  // compararlos de un vistazo (petición del propietario, 05/09/2026).
  // Si aún no está pagado, el real se muestra como «—» en vez de un
  // cero, que haría pensar que se pagó cero.
  const bloque = function (etiqueta, estimado, real, pagado, guardado, desfasado) {
    return '<div class="inf-resumen-bloque">' +
      '<div class="inf-resumen-bloque-cabecera">' +
        '<span>' + etiqueta + '</span>' +
        (pagado
          ? '<span class="pastilla ind-verde">Pagado</span>'
          : '<span class="pastilla ind-ambar">Pendiente</span>') +
      '</div>' +
      '<div class="inf-resumen-par">' +
        '<span class="inf-resumen-dato"><small>Estimado</small>' + escaparHtml(dineroVisible(estimado)) + '</span>' +
        '<span class="inf-resumen-dato"><small>Pagado</small>' +
          (pagado ? escaparHtml(dineroVisible(real)) : '—') + '</span>' +
      '</div>' +
      // La cifra que se congeló al pagar ya no coincide con la de hoy:
      // se han añadido facturas o apuntes de ese trimestre después de
      // marcarlo como pagado. Se enseñan las dos para que no parezca
      // un error.
      (desfasado
        ? '<p class="inf-resumen-desfase">Al pagar se estimó ' + escaparHtml(dineroVisible(guardado)) + '</p>'
        : '') +
    '</div>';
  };

  // Rediseño (28/09/2026): cada trimestre es una tarjeta, con su nombre
  // en grande y una pastilla de estado. En el móvil las cuatro tarjetas
  // van en un carrusel que se desliza de lado (la del trimestre que toca
  // pagar sale en el centro, con borde negro); en PC van en una fila.
  // Encima, una tarjeta oscura con el resumen del año. Ningún cálculo
  // cambia: se enseñan las mismas cifras que antes.
  const destacado = infTrimestreDestacado(anio);
  const etiquetas = { pagado: 'Pagado', pendiente: 'Pendiente', curso: 'En curso', futuro: 'Más adelante' };
  const clasesPastilla = { pagado: 'ind-verde', pendiente: 'ind-ambar', curso: 'ind-azul', futuro: 'inf-pastilla-gris' };

  const filaTrimestre = function (f) {
    const est = infEstadoTrimestre(anio, f);
    return '<div class="inf-resumen-trimestre' + (f.trimestre === destacado ? ' destacado' : '') + '" data-trimestre="' + f.trimestre + '">' +
      '<div class="inf-trimestre-cabecera">' +
        '<p class="inf-resumen-trimestre-titulo">' + f.trimestre + ' <small>' + anio + '</small></p>' +
        '<span class="pastilla ' + clasesPastilla[est] + '">' + etiquetas[est] + '</span>' +
      '</div>' +
      bloque('IVA', f.ivaEstimado, f.ivaReal, f.ivaPagado, f.ivaGuardado, f.ivaDesfasado) +
      bloque('IRPF', f.irpfEstimado, f.irpfReal, f.irpfPagado, f.irpfGuardado, f.irpfDesfasado) +
    '</div>';
  };

  const cerrados = 4 - resumen.trimestresPendientes;
  const tramos = resumen.filas.map(function (f) {
    return '<span class="inf-tramo ' + infEstadoTrimestre(anio, f) + '"></span>';
  }).join('');

  return '<div class="inf-resumen-anual">' +
    '<div class="inf-carrusel" id="inf-carrusel">' + resumen.filas.map(filaTrimestre).join('') + '</div>' +
    '<div class="inf-puntos" id="inf-puntos" aria-hidden="true">' +
      resumen.filas.map(function () { return '<span></span>'; }).join('') +
    '</div>' +
    '<div class="inf-anual-tarjeta">' +
      '<div class="inf-anual-cabecera">' +
        '<span class="inf-anual-titulo">Año ' + anio + '</span>' +
        '<span class="inf-anual-cerrados">' +
          (cerrados === 4 ? 'Los 4 trimestres cerrados' : cerrados + ' de 4 trimestres cerrados') +
        '</span>' +
      '</div>' +
      '<div class="inf-tramos">' + tramos + '</div>' +
      '<div class="inf-anual-cifras">' +
        '<div><small>Pagado en el año</small><strong class="grande">' + escaparHtml(dineroVisible(resumen.totalPagado)) + '</strong></div>' +
        '<div class="derecha"><small>Estimado del año</small><strong>' + escaparHtml(dineroVisible(resumen.totalEstimado)) + '</strong></div>' +
      '</div>' +
    '</div>' +
  '</div>';
}

// Estado de un trimestre para su pastilla y su tramo de la barra:
//   pagado    → IVA e IRPF marcados como pagados
//   pendiente → el trimestre ya terminó y falta algo por pagar
//   curso     → es el trimestre en el que estamos
//   futuro    → todavía no ha empezado
function infEstadoTrimestre(anio, f) {
  if (f.ivaPagado && f.irpfPagado) return 'pagado';
  const hoy = fechaHoyISO();
  const anioHoy = parseInt(String(hoy).slice(0, 4), 10);
  const idxHoy = IMP_TRIMESTRES.indexOf(fvTrimestreDeFecha(hoy));
  const idx = IMP_TRIMESTRES.indexOf(f.trimestre);
  if (anio < anioHoy || (anio === anioHoy && idx < idxHoy)) return 'pendiente';
  if (anio === anioHoy && idx === idxHoy) return 'curso';
  return 'futuro';
}

// Trimestre que se pone en el centro del carrusel: el que toca pagar
// (el mismo con el que se abre la pestaña Impuestos) si es de este año;
// si no, el trimestre en curso; y en años pasados, el último.
function infTrimestreDestacado(anio) {
  if (typeof impProximoPago === 'function') {
    const p = impProximoPago();
    if (p && p.anio === anio) return p.trimestre;
  }
  const hoy = fechaHoyISO();
  if (parseInt(String(hoy).slice(0, 4), 10) === anio) return fvTrimestreDeFecha(hoy);
  return IMP_TRIMESTRES[IMP_TRIMESTRES.length - 1];
}

// Carrusel del móvil: al abrir, centra el trimestre destacado; al
// deslizar, marca la tarjeta del centro y el punto que le corresponde.
// En PC las tarjetas no se deslizan (van en fila) y esto no hace nada
// visible.
function infPrepararCarrusel(zona) {
  const carrusel = zona.querySelector('#inf-carrusel');
  const puntos = zona.querySelector('#inf-puntos');
  if (!carrusel) return;
  const tarjetas = Array.prototype.slice.call(carrusel.children);

  function marcar() {
    const centro = carrusel.scrollLeft + carrusel.clientWidth / 2;
    let mejor = 0;
    let distancia = Infinity;
    tarjetas.forEach(function (t, i) {
      const d = Math.abs(t.offsetLeft + t.offsetWidth / 2 - centro);
      if (d < distancia) { distancia = d; mejor = i; }
    });
    tarjetas.forEach(function (t, i) { t.classList.toggle('centrada', i === mejor); });
    if (puntos) {
      Array.prototype.forEach.call(puntos.children, function (p, i) { p.classList.toggle('activo', i === mejor); });
    }
  }

  const destacada = carrusel.querySelector('.destacado') || tarjetas[0];
  if (destacada) {
    carrusel.scrollLeft = destacada.offsetLeft - (carrusel.clientWidth - destacada.offsetWidth) / 2;
  }
  marcar();
  let pendiente = false;
  carrusel.addEventListener('scroll', function () {
    if (pendiente) return;
    pendiente = true;
    requestAnimationFrame(function () { pendiente = false; marcar(); });
  });
}

// ============================================================
// 7.1 ESPACIO QUE OCUPAN TUS DATOS (28/09/2026)
// ============================================================
// Solo lee. La app guarda en el dispositivo una copia de todos tus
// datos para abrir al instante y funcionar sin conexión, y el navegador
// deja para eso unos 5 MB. Aquí se enseña cuánto ocupan, desde qué año
// hay contabilidad y si ya conviene archivar años antiguos (Configuración
// → Copias de seguridad). Cuenta caracteres guardados, que es lo que mide
// el navegador; es una cifra aproximada, de sobra para decidir.

const INF_ESPACIO_LIMITE = 5 * 1024 * 1024;

function infEspacioUsado() {
  let total = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || k.indexOf('cuentas_') !== 0) continue;
      total += k.length + String(localStorage.getItem(k) || '').length;
    }
  } catch (err) {
    console.error('No se pudo medir el espacio:', err);
    return null;
  }
  return total;
}

// Años con contabilidad (facturas, compras, apuntes o impuestos).
function infAniosConDatos() {
  const anios = {};
  const anotar = function (a) { if (a) anios[a] = true; };
  estado.ventas.forEach(function (f) { anotar(infAnioDe(f.fecha)); });
  estado.compras.forEach(function (f) { anotar(infAnioDe(f.fecha)); });
  estado.apuntes.forEach(function (a) { anotar(infAnioDe(a.fecha)); });
  estado.impuestos.forEach(function (r) {
    const a = parseInt(String(r['año'] || ''), 10);
    if (a > 1990) anotar(a);
  });
  return Object.keys(anios).map(Number).sort(function (a, b) { return a - b; });
}

function infTamanoLegible(caracteres) {
  if (caracteres < 1024 * 1024) {
    return Math.max(1, Math.round(caracteres / 1024)).toLocaleString('es-ES') + '\u00A0KB';
  }
  return (caracteres / (1024 * 1024)).toLocaleString('es-ES', { maximumFractionDigits: 1 }) + '\u00A0MB';
}

function infEspacioHtml() {
  const usado = infEspacioUsado();
  const anios = infAniosConDatos();
  const hoy = new Date().getFullYear();

  let lineaEspacio = 'No se ha podido medir.';
  let aviso = '';
  let claseAviso = 'rev-ok';
  if (usado !== null) {
    const pct = usado / INF_ESPACIO_LIMITE * 100;
    const pctTexto = pct < 1 ? 'menos del 1\u00A0%' : Math.round(pct) + '\u00A0%';
    lineaEspacio = infTamanoLegible(usado) + ' de unos 5\u00A0MB (' + pctTexto + ')';
    if (pct >= 80) {
      claseAviso = 'inf-espacio-aviso rojo';
      aviso = 'Queda poco espacio. Conviene archivar años antiguos en Configuración → Copias de seguridad.';
    } else if (pct >= 50) {
      claseAviso = 'inf-espacio-aviso';
      aviso = 'Empieza a llenarse. Cuando quieras, puedes archivar años antiguos en Configuración → Copias de seguridad.';
    } else {
      aviso = 'Hay espacio de sobra. No hace falta archivar nada.';
    }
  }

  const lineaAnios = anios.length
    ? (anios[0] === anios[anios.length - 1]
        ? 'Solo ' + anios[0]
        : 'Desde ' + anios[0] + ' (' + anios.length + ' años)')
    : 'Todavía no hay';

  return '<div class="inf-bloque inf-espacio">' +
    '<p class="inf-descarga-titulo">Datos en este dispositivo</p>' +
    '<div class="inf-espacio-linea"><span>Ocupan</span><strong>' + escaparHtml(lineaEspacio) + '</strong></div>' +
    '<div class="inf-espacio-linea"><span>Contabilidad</span><strong>' + escaparHtml(lineaAnios) + '</strong></div>' +
    '<div class="inf-espacio-linea"><span>Registros</span><strong>' +
      escaparHtml(estado.ventas.length + ' facturas · ' + estado.compras.length + ' compras · ' + estado.apuntes.length + ' apuntes') +
    '</strong></div>' +
    (aviso
      ? '<p class="' + claseAviso + '">' +
          '<i class="ti ' + (claseAviso === 'rev-ok' ? 'ti-circle-check' : 'ti-alert-triangle') + '" aria-hidden="true"></i> ' +
          escaparHtml(aviso) + '</p>'
      : '') +
    '<p class="inf-bloque-nota">Se conservan siempre el año en curso y los 5 anteriores (' + (hoy - 5) + '–' + hoy + '): ' +
      'esos años no se pueden archivar.</p>' +
  '</div>';
}

// ============================================================
// 8. IMPRESIÓN / PDF (mapa 15.1)
// ============================================================
// PAGINACIÓN NATURAL (rediseño 05/09/2026): ya no se fuerza @page en
// A4 apaisado ni se cortan tablas con reglas de salto fijas. El
// tamaño y la orientación del papel los elige el propietario en el
// propio diálogo de impresión, y el navegador reparte el contenido en
// tantas hojas como haga falta. Solo se evita partir una fila de
// tabla por la mitad (`break-inside: avoid`), y se repite la cabecera
// de cada tabla si continúa en la siguiente página.
//
// ANCHO DE COLUMNAS FIJO (arregla el descuadre de título/datos): cada
// tabla reserva un ancho fijo por columna con <colgroup>, en vez de
// dejar que lo decida el contenido más largo de cada celda. Antes, el
// "(21%)" añadido junto al IVA/IRPF alargaba esa celda más que su
// cabecera y desalineaba toda la columna.

// Anchos pensados para que quepa el contenido real sin apreturas:
// Dirección y Concepto son los que más texto llevan, y las columnas
// de cifras necesitan sitio para el importe más el porcentaje.
function infColgroupFacturas(conConcepto) {
  // Nº · Fecha · Nombre · NIF · Dirección · [Concepto] · Base · IVA · Retención IRPF · Total
  const anchos = conConcepto
    ? ['7%', '8%', '13%', '9%', '15%', '14%', '8%', '9%', '9%', '8%']
    : ['8%', '9%', '17%', '11%', '22%', '8%', '9%', '9%', '7%'];
  return '<colgroup>' + anchos.map(function (a) { return '<col style="width:' + a + '">'; }).join('') + '</colgroup>';
}

function infColgroupApuntes(conConcepto) {
  // Fecha · Ámbito · Tipo · Nombre · NIF · Dirección · [Concepto] · Base · IVA · Retención IRPF · Total
  const anchos = conConcepto
    ? ['8%', '7%', '6%', '12%', '9%', '13%', '15%', '8%', '8%', '8%', '6%']
    : ['9%', '8%', '7%', '15%', '10%', '17%', '9%', '9%', '9%', '7%'];
  return '<colgroup>' + anchos.map(function (a) { return '<col style="width:' + a + '">'; }).join('') + '</colgroup>';
}

// Inserta los <colgroup> en el HTML ya construido, justo tras la
// apertura de cada <table>, sin tener que rehacer las funciones de
// arriba (que ya estaban probadas).
function infInsertarColgroups(html) {
  return html
    .replace(/<table class="inf-tabla-doc inf-tabla-facturas con-concepto">/g,
      '<table class="inf-tabla-doc inf-tabla-facturas con-concepto">' + infColgroupFacturas(true))
    .replace(/<table class="inf-tabla-doc inf-tabla-facturas">/g,
      '<table class="inf-tabla-doc inf-tabla-facturas">' + infColgroupFacturas(false))
    .replace(/<table class="inf-tabla-doc inf-tabla-apuntes con-concepto">/g,
      '<table class="inf-tabla-doc inf-tabla-apuntes con-concepto">' + infColgroupApuntes(true))
    .replace(/<table class="inf-tabla-doc inf-tabla-apuntes">/g,
      '<table class="inf-tabla-doc inf-tabla-apuntes">' + infColgroupApuntes(false));
}

const INF_CSS_IMPRESION =
  '@page { margin: 12mm; }' +
  'body { font-family: Arial, Helvetica, sans-serif; color: #1A1A1A; font-size: 9.5px; margin: 0; }' +
  '.inf-doc-cabecera { display: flex; justify-content: space-between; align-items: flex-start;' +
    ' gap: 24px; border-bottom: 2px solid #1A1A1A; padding-bottom: 10px; margin-bottom: 14px; }' +
  '.inf-doc-emisor p { margin: 0 0 2px; font-size: 9.5px; color: #3A3A3A; }' +
  '.inf-doc-emisor-nombre { font-weight: bold; font-size: 12px; color: #1A1A1A; }' +
  '.inf-doc-titulo-zona { text-align: right; }' +
  '.inf-doc-titulo { margin: 0; font-size: 17px; font-weight: bold; }' +
  '.inf-doc-subtitulo { margin: 2px 0 0; font-size: 12px; color: #3A3A3A; }' +
  '.inf-doc-generado { margin: 2px 0 0; font-size: 8px; color: #6A6A6A; }' +
  '.inf-doc-seccion { font-size: 13px; font-weight: 800; margin: 18px 0 8px; padding-bottom: 4px;' +
    ' border-bottom: 2px solid #1A1A1A; break-after: avoid; }' +
  '.inf-doc-subseccion { font-size: 11px; font-weight: 800; margin: 12px 0 5px; break-after: avoid; }' +
  '.inf-doc-cuenta { font-weight: normal; color: #6A6A6A; font-size: 9px; }' +
  '.inf-doc-vacio { font-size: 9px; color: #6A6A6A; margin: 4px 0 10px; }' +
  'table.inf-tabla-doc { width: 100%; table-layout: fixed; border-collapse: collapse; margin-bottom: 10px; }' +
  'table.inf-tabla-doc th { background: #EAEAE6; text-align: left; font-size: 8px;' +
    ' text-transform: uppercase; padding: 4px 5px; border-bottom: 1px solid #C8C8C2;' +
    ' overflow: hidden; white-space: nowrap; }' +
  'table.inf-tabla-doc td { padding: 4px 5px; border-bottom: 1px solid #E8E8E2; font-size: 9.5px;' +
    ' overflow-wrap: break-word; word-break: break-word; }' +
  'table.inf-tabla-doc td.inf-num { white-space: nowrap; }' +
  'table.inf-tabla-doc tfoot td { font-weight: bold; border-top: 1px solid #1A1A1A; border-bottom: none; }' +
  // El pie sale UNA sola vez, al final. Sin esto el navegador lo
  // trata como pie fijo y repite la fila TOTAL en cada hoja cuando
  // la tabla se parte entre páginas (fallo detectado 05/09/2026).
  'table.inf-tabla-doc tfoot { display: table-row-group; }' +
  'table.inf-tabla-doc tr { break-inside: avoid; }' +
  'table.inf-tabla-doc thead { display: table-header-group; }' +
  // Todo a la izquierda, cifras incluidas (decisión 05/09/2026): con
  // las cifras a la derecha y los títulos a la izquierda las columnas
  // se veían descompensadas. Ahora título y dato arrancan en la
  // misma vertical.
  '.inf-num { text-align: left; }' +
  'th.inf-num, td.inf-num { text-align: left; }' +
  '.inf-negativo { color: #A3241F; }' +
  '.inf-nd { color: #9A9A94; }' +
  '.inf-pct { color: #6A6A6A; font-size: 7.5px; }' +
  '.inf-fila-destacada td { font-weight: bold; background: #F2F2EE; }' +
  '.inf-tabla-resumen td:first-child, .inf-tabla-resumen-simple td:first-child { white-space: normal; }' +
  '.inf-tabla-resumen-simple { max-width: 340px; }' +
  '.inf-doc-nota, .inf-doc-pie { font-size: 8px; color: #6A6A6A; margin-top: 8px; }';

function infImprimir() {
  const ventana = window.open('', '_blank');
  if (!ventana) {
    alert('El navegador ha bloqueado la ventana del informe.\n\nPermite las ventanas emergentes para esta página y vuelve a intentarlo.');
    return;
  }

  const titulo = infTituloActual();
  const documento = infInsertarColgroups(infDocumentoActual());

  ventana.document.open();
  ventana.document.write(
    '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">' +
    '<title>' + escaparHtml(titulo) + '</title>' +
    '<style>' + INF_CSS_IMPRESION + '</style>' +
    '</head><body>' + documento + '</body></html>'
  );
  ventana.document.close();
  ventana.focus();

  setTimeout(function () {
    try { ventana.print(); } catch (err) { console.error('No se pudo imprimir:', err); }
  }, 400);
}

// ============================================================
// 9. DESCARGA EN EXCEL PARA EL ASESOR (26/09/2026)
// ============================================================
// Mismo periodo que el PDF (el trimestre elegido, o el año entero) y
// los mismos datos: facturas emitidas, facturas recibidas y apuntes
// (de empresa en el trimestral; de empresa y personales en el anual).
// En el anual va además una hoja con el resumen del 347.
//
// Solo LEE lo que ya hay en el dispositivo: no escribe en Sheets ni
// cambia ningún cálculo. El archivo .xlsx se arma aquí mismo, sin
// librerías nuevas: un .xlsx es una carpeta de textos XML metida en un
// ZIP, y se empaqueta sin comprimir (es lo más simple y Excel lo abre
// igual). Los importes van como números de verdad, para que el asesor
// pueda sumar y filtrar; las fechas, como fechas.

function xlsEsc(v) {
  return String(v === null || v === undefined ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}

// Letra de columna de Excel: 0 → A, 25 → Z, 26 → AA.
function xlsColumna(i) {
  let s = '';
  i += 1;
  while (i > 0) { const r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); }
  return s;
}

// Número de serie de Excel para una fecha AAAA-MM-DD (días desde el
// 30/12/1899). Si no hay fecha válida, se deja la celda vacía.
function xlsFechaSerie(iso) {
  const f = normalizarFecha(iso);
  if (!f) return null;
  const p = f.split('-');
  return Math.round((Date.UTC(+p[0], p[1] - 1, +p[2]) - Date.UTC(1899, 11, 30)) / 86400000);
}

// Celdas: { t: 'texto' | 'numero' | 'dinero' | 'fecha', v: valor, negrita }
// Estilos (ver xlsEstilos): 0 normal, 1 cabecera en negrita, 2 dinero,
// 3 fecha, 4 dinero en negrita, 5 texto en negrita.
function xlsCelda(ref, c) {
  if (!c || c.v === null || c.v === undefined || c.v === '') return '';
  if (c.t === 'fecha') {
    const serie = xlsFechaSerie(c.v);
    return serie === null ? '' : '<c r="' + ref + '" s="3"><v>' + serie + '</v></c>';
  }
  if (c.t === 'dinero' || c.t === 'numero') {
    const n = Number(c.v);
    if (!isFinite(n)) return '';
    const estilo = c.t === 'dinero' ? (c.negrita ? 4 : 2) : 0;
    return '<c r="' + ref + '"' + (estilo ? ' s="' + estilo + '"' : '') + '><v>' + n + '</v></c>';
  }
  const estiloTexto = c.cabecera ? 1 : c.negrita ? 5 : 0;
  return '<c r="' + ref + '" t="inlineStr"' + (estiloTexto ? ' s="' + estiloTexto + '"' : '') +
    '><is><t xml:space="preserve">' + xlsEsc(c.v) + '</t></is></c>';
}

// hoja: { nombre, anchos: [..], filas: [[celda, celda...], ...] }
// La primera fila es la cabecera y queda fija al desplazarse, salvo en
// las hojas con `sinCabeceraFija` (la hoja «Resumen», 28/09/2026).
function xlsHojaXml(hoja) {
  const filas = hoja.filas.map(function (fila, i) {
    return '<row r="' + (i + 1) + '">' + fila.map(function (c, j) {
      return xlsCelda(xlsColumna(j) + (i + 1), c);
    }).join('') + '</row>';
  }).join('');
  const cols = (hoja.anchos || []).map(function (w, i) {
    return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>';
  }).join('');
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    (hoja.sinCabeceraFija
      ? '<sheetViews><sheetView workbookViewId="0"/></sheetViews>'
      : '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>') +
    (cols ? '<cols>' + cols + '</cols>' : '') +
    '<sheetData>' + filas + '</sheetData></worksheet>';
}

function xlsEstilos() {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0.00\\ &quot;€&quot;"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy"/></numFmts>' +
    '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
    '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
      '<fill><patternFill patternType="solid"><fgColor rgb="FFEAEAE6"/><bgColor indexed="64"/></patternFill></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="6">' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
      '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>' +
      '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
      '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
      '<xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>' +
      '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
    '</cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    '</styleSheet>';
}

// Libro completo como lista de archivos { nombre, texto }.
function xlsArchivosLibro(hojas) {
  const archivos = [];
  archivos.push({ nombre: '[Content_Types].xml', texto:
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    hojas.map(function (h, i) {
      return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
    }).join('') +
    '</Types>' });
  archivos.push({ nombre: '_rels/.rels', texto:
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    '</Relationships>' });
  archivos.push({ nombre: 'xl/workbook.xml', texto:
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<sheets>' + hojas.map(function (h, i) {
      return '<sheet name="' + xlsEsc(h.nombre) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>';
    }).join('') + '</sheets></workbook>' });
  archivos.push({ nombre: 'xl/_rels/workbook.xml.rels', texto:
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    hojas.map(function (h, i) {
      return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>';
    }).join('') +
    '<Relationship Id="rId' + (hojas.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
    '</Relationships>' });
  archivos.push({ nombre: 'xl/styles.xml', texto: xlsEstilos() });
  hojas.forEach(function (h, i) {
    archivos.push({ nombre: 'xl/worksheets/sheet' + (i + 1) + '.xml', texto: xlsHojaXml(h) });
  });
  return archivos;
}

// ---- ZIP sin compresión ----
let XLS_TABLA_CRC = null;
function xlsCrc32(bytes) {
  if (!XLS_TABLA_CRC) {
    XLS_TABLA_CRC = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      XLS_TABLA_CRC[n] = c >>> 0;
    }
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) crc = XLS_TABLA_CRC[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function xlsZip(archivos) {
  const codificador = new TextEncoder();
  const partes = [];
  const central = [];
  let desplazamiento = 0;

  const u16 = function (v) { return [v & 0xFF, (v >>> 8) & 0xFF]; };
  const u32 = function (v) { return [v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF]; };

  archivos.forEach(function (a) {
    const nombre = codificador.encode(a.nombre);
    const datos = codificador.encode(a.texto);
    const crc = xlsCrc32(datos);
    const cabecera = new Uint8Array([].concat(
      u32(0x04034B50), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21),
      u32(crc), u32(datos.length), u32(datos.length), u16(nombre.length), u16(0)
    ));
    partes.push(cabecera, nombre, datos);
    central.push(new Uint8Array([].concat(
      u32(0x02014B50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21),
      u32(crc), u32(datos.length), u32(datos.length), u16(nombre.length), u16(0), u16(0),
      u16(0), u16(0), u32(0), u32(desplazamiento)
    )), nombre);
    desplazamiento += cabecera.length + nombre.length + datos.length;
  });

  const tamCentral = central.reduce(function (s, p) { return s + p.length; }, 0);
  const fin = new Uint8Array([].concat(
    u32(0x06054B50), u16(0), u16(0), u16(archivos.length), u16(archivos.length),
    u32(tamCentral), u32(desplazamiento), u16(0)
  ));
  return new Blob(partes.concat(central, [fin]), { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// ---- Contenido de cada hoja ----

function xlsT(v) { return { t: 'texto', v: v }; }
function xlsCab(v) { return { t: 'texto', v: v, cabecera: true }; }
function xlsD(v) { return { t: 'dinero', v: roundMoney(parsearNumero(v)) }; }
function xlsN(v) { return { t: 'numero', v: parsearNumero(v) }; }
function xlsF(v) { return { t: 'fecha', v: v }; }

function xlsFilaTotal(etiqueta, columnaEtiqueta, totales) {
  // totales: { indiceColumna: valor }
  const fila = [];
  fila[columnaEtiqueta] = { t: 'texto', v: etiqueta, negrita: true };
  Object.keys(totales).forEach(function (i) { fila[i] = { t: 'dinero', v: roundMoney(totales[i]), negrita: true }; });
  return fila;
}

// Columna «Dirección» desde el 28/09/2026, como en el PDF.
function xlsHojaFacturas(nombre, lista, esVenta) {
  const filas = [[
    xlsCab('Fecha'), xlsCab('Número'), xlsCab(esVenta ? 'Cliente' : 'Proveedor'), xlsCab('NIF'),
    xlsCab('Dirección'), xlsCab('Concepto'), xlsCab('Base'), xlsCab('IVA %'), xlsCab('IVA'), xlsCab('IRPF %'),
    xlsCab('Retención IRPF'), xlsCab('Total'), xlsCab('Estado'), xlsCab(esVenta ? 'Fecha de cobro' : 'Fecha de pago')
  ]];
  const suma = { 6: 0, 8: 0, 10: 0, 11: 0 };
  lista.forEach(function (f) {
    const r = esVenta ? infFilaVenta(f) : infFilaCompra(f);
    const pagada = String(f.estado || '').toLowerCase() === 'pagada';
    filas.push([
      xlsF(f.fecha), xlsT(r.numero), xlsT(r.nombre), xlsT(r.nif), xlsT(r.direccion), xlsT(r.concepto),
      xlsD(r.base), xlsN(r.ivaPct), xlsD(r.iva), xlsN(r.irpfPct), xlsD(r.irpf), xlsD(r.total),
      xlsT(pagada ? (esVenta ? 'Cobrada' : 'Pagada') : 'Pendiente'),
      xlsF(esVenta ? f.fecha_cobro : f.fecha_pago)
    ]);
    suma[6] += r.base; suma[8] += r.iva; suma[10] += r.irpf; suma[11] += r.total;
  });
  if (lista.length) { filas.push([]); filas.push(xlsFilaTotal('TOTAL', 5, suma)); }
  return { nombre: nombre, anchos: [11, 14, 32, 13, 34, 38, 12, 7, 12, 7, 14, 12, 11, 14], filas: filas };
}

// Columna «Dirección» desde el 28/09/2026, como en el PDF.
function xlsHojaApuntes(nombre, lista) {
  const filas = [[
    xlsCab('Fecha'), xlsCab('Tipo'), xlsCab('Ámbito'), xlsCab('Contacto'), xlsCab('NIF'),
    xlsCab('Dirección'), xlsCab('Concepto'), xlsCab('Base'), xlsCab('IVA %'), xlsCab('IVA'), xlsCab('IRPF %'),
    xlsCab('Retención IRPF'), xlsCab('Total')
  ]];
  const suma = { 7: 0, 9: 0, 11: 0, 12: 0 };
  lista.forEach(function (a) {
    const r = infFilaApunte(a);
    const contacto = r.nombre !== '—' ? r.nombre : (infTexto(a.contacto_libre) || '—');
    filas.push([
      xlsF(a.fecha), xlsT(r.tipo), xlsT(r.ambito), xlsT(contacto), xlsT(r.nif), xlsT(r.direccion), xlsT(r.concepto),
      xlsD(r.base), xlsN(r.ivaPct), xlsD(r.iva), xlsN(r.irpfPct), xlsD(r.irpf), xlsD(r.total)
    ]);
    suma[7] += r.base; suma[9] += r.iva; suma[11] += r.irpf; suma[12] += r.total;
  });
  if (lista.length) { filas.push([]); filas.push(xlsFilaTotal('TOTAL (gastos en negativo)', 6, suma)); }
  return { nombre: nombre, anchos: [11, 9, 10, 30, 13, 34, 38, 12, 7, 12, 7, 14, 12], filas: filas };
}

function xlsHoja347(anio) {
  const r = inf347(anio);
  const filas = [[
    xlsCab('Tipo'), xlsCab('Nombre'), xlsCab('NIF'), xlsCab('Total año'),
    xlsCab('1T'), xlsCab('2T'), xlsCab('3T'), xlsCab('4T'), xlsCab('De ello, con retención IRPF')
  ]];
  const añadir = function (tipo, lista) {
    lista.forEach(function (c) {
      filas.push([xlsT(tipo), xlsT(c.nombre), xlsT(c.nif || '—'), xlsD(c.total),
        xlsD(c.trimestres[0]), xlsD(c.trimestres[1]), xlsD(c.trimestres[2]), xlsD(c.trimestres[3]),
        c.conRetencion ? xlsD(c.conRetencion) : xlsT('')]);
    });
  };
  añadir('Cliente', r.ventas);
  añadir('Proveedor', r.compras);
  filas.push([]);
  filas.push([xlsT('Contactos con más de ' + formatMoney(INF_347_LIMITE) + ' en el año. Importes con IVA, sin restar la retención, por fecha de factura. Revísalo con tu asesor.')]);
  return { nombre: '347', anchos: [11, 36, 13, 13, 12, 12, 12, 12, 16], filas: filas };
}

// ---- Hojas que lleva el PDF y antes no llevaba el Excel (28/09/2026) ----
// Mismas cifras que el PDF, sacadas de las mismas funciones
// (infDatosEmisor, infResumenAnual, impCalcular, impRegistroDe): aquí no
// se calcula nada nuevo. El PDF no cambia.

function xlsB(v) { return { t: 'texto', v: v, negrita: true }; }
function xlsDB(v) { return { t: 'dinero', v: roundMoney(parsearNumero(v)), negrita: true }; }

// Hoja «Resumen», la primera del libro: título, datos del emisor y, en el
// anual, las cuatro tablas del resumen del PDF.
function xlsHojaResumen(tipo, anio, trimestre) {
  const e = infDatosEmisor();
  const contacto = [e.telefono, e.email].filter(Boolean).join(' · ');
  const filas = [
    [xlsB(tipo === 'anual' ? 'Informe anual' : 'Informe trimestral')],
    [xlsT(tipo === 'anual' ? 'Ejercicio ' + anio : trimestre + ' · ' + anio)],
    [xlsT('Generado el ' + mostrarFecha(fechaHoyISO()))],
    [],
    [xlsB('Emisor')]
  ];
  if (e.nombre) filas.push([xlsT(e.nombre)]);
  if (e.nif) filas.push([xlsT('NIF ' + e.nif)]);
  if (e.direccion) filas.push([xlsT(e.direccion)]);
  if (contacto) filas.push([xlsT(contacto)]);

  if (tipo === 'anual') {
    const r = infResumenAnual(anio);
    const tres = function (etiqueta, valores, destacada) {
      return [destacada ? xlsB(etiqueta) : xlsT(etiqueta)].concat(valores.map(function (v) {
        if (v === null) return xlsT('—');
        return destacada ? xlsDB(v) : xlsD(v);
      }));
    };
    const cabecera = [xlsCab('Concepto'), xlsCab('Empresa'), xlsCab('Personal'), xlsCab('Conjunto')];

    filas.push([], [xlsB('Ingresos')], cabecera,
      tres('Facturación (base de ventas)', [r.facturacion, null, r.facturacion]),
      tres('Otros ingresos (apuntes)', [r.otrosIngresosEmpresa, r.otrosIngresosPersonal, roundMoney(r.otrosIngresosEmpresa + r.otrosIngresosPersonal)]),
      tres('TOTAL INGRESOS', [r.ingresosEmpresa, r.ingresosPersonal, r.ingresosConjunto], true));

    filas.push([], [xlsB('Gastos')], cabecera,
      tres('Compras (base de facturas)', [r.comprasBase, null, r.comprasBase]),
      tres('Otros gastos (apuntes)', [r.otrosGastosEmpresa, r.otrosGastosPersonal, roundMoney(r.otrosGastosEmpresa + r.otrosGastosPersonal)]),
      tres('TOTAL GASTOS', [r.gastosEmpresa, r.gastosPersonal, r.gastosConjunto], true));

    filas.push([], [xlsB('Resultado')], cabecera,
      tres('RESULTADO DEL AÑO', [r.resultadoEmpresa, r.resultadoPersonal, r.resultadoConjunto], true));

    filas.push([], [xlsB('Impuestos y otros datos del año (empresa)')],
      [xlsT('IVA repercutido (ventas)'), xlsD(r.ivaRepercutido)],
      [xlsT('IVA soportado (compras)'), xlsD(r.ivaSoportado)],
      [xlsT('IVA neto del año'), xlsD(r.ivaNeto)],
      [xlsT('IRPF retenido en tus facturas'), xlsD(r.irpfSoportado)],
      [xlsT('IRPF retenido por ti a terceros'), xlsD(r.irpfTerceros)],
      [xlsT('Impuestos pagados en el año'), xlsD(r.impuestosPagados)],
      [xlsT('Pendiente de cobro a fin de año'), xlsD(r.pendienteCobro)],
      [xlsT('Nº de facturas emitidas'), xlsN(r.numVentas)],
      [xlsT('Nº de facturas recibidas'), xlsN(r.numCompras)],
      [xlsT('Nº de apuntes de empresa'), xlsN(r.numApuntesEmpresa)],
      [xlsT('Nº de apuntes personales'), xlsN(r.numApuntesPersonal)],
      [xlsT('Nº de facturas sin cobrar'), xlsN(r.numSinCobrar)]);

    filas.push([], [xlsT('Copia de seguridad del ejercicio ' + anio + '. Los gastos figuran en negativo. ' +
      'No incluye presupuestos. Las hojas siguientes llevan las facturas, los apuntes, los impuestos y el 347.')]);
  } else {
    filas.push([], [xlsT('Los gastos figuran en negativo. Documento pensado para revisar con tu asesor: ' +
      'no incluye estimaciones internas de la aplicación, solo los datos con los que presentar el trimestre.')]);
  }

  return { nombre: 'Resumen', anchos: [46, 16, 16, 16], filas: filas, sinCabeceraFija: true };
}

// Hoja «Impuestos» del anual: los 4 trimestres, igual que la tabla
// «Impuestos del año» del PDF (estimación en vivo, real, estado y fecha).
function xlsHojaImpuestos(anio) {
  const filas = [[
    xlsCab('Trimestre'), xlsCab('IVA estimado'), xlsCab('IVA real'), xlsCab('Estado IVA'), xlsCab('Fecha pago IVA'),
    xlsCab('IRPF estimado'), xlsCab('IRPF real'), xlsCab('Estado IRPF'), xlsCab('Fecha pago IRPF')
  ]];
  IMP_TRIMESTRES.forEach(function (t) {
    const r = impRegistroDe(anio, t);
    const c = impCalcular(anio, t);
    const pagado = function (tipo) { return r && infTexto(r[tipo + '_estado']).toLowerCase() === 'pagado'; };
    filas.push([
      xlsT(t),
      xlsD(c.iva), xlsD(r ? r.iva_real : 0), xlsT(pagado('iva') ? 'Pagado' : 'Pendiente'), xlsF(r ? r.iva_fecha_pago : ''),
      xlsD(c.irpf), xlsD(r ? r.irpf_real : 0), xlsT(pagado('irpf') ? 'Pagado' : 'Pendiente'), xlsF(r ? r.irpf_fecha_pago : '')
    ]);
  });
  return { nombre: 'Impuestos', anchos: [11, 14, 14, 12, 15, 15, 14, 12, 15], filas: filas };
}

// Libro completo de un periodo, sin descargarlo: { hojas, nombre }.
// Lo usan el botón «Excel» de esta pantalla y el archivado de años
// antiguos de Configuración (que descarga antes el anual de cada año).
function infLibroExcel(tipo, anio, trimestre) {
  if (tipo === 'anual') {
    return {
      hojas: [
        xlsHojaResumen('anual', anio),
        xlsHojaFacturas('Emitidas', infVentasDelAnio(anio), true),
        xlsHojaFacturas('Recibidas', infComprasDelAnio(anio), false),
        xlsHojaApuntes('Apuntes', infApuntesDelAnio(anio)),
        xlsHojaImpuestos(anio),
        xlsHoja347(anio)
      ],
      nombre: 'Cuentas ' + anio + ' anual.xlsx'
    };
  }
  return {
    hojas: [
      xlsHojaResumen('trimestral', anio, trimestre),
      xlsHojaFacturas('Emitidas', infVentasDelTrimestre(anio, trimestre), true),
      xlsHojaFacturas('Recibidas', infComprasDelTrimestre(anio, trimestre), false),
      xlsHojaApuntes('Apuntes de empresa', infApuntesEmpresaDelTrimestre(anio, trimestre))
    ],
    nombre: 'Cuentas ' + anio + ' ' + trimestre + '.xlsx'
  };
}

// Descarga un libro. Devuelve true si se ha podido preparar y lanzar la
// descarga, false si algo ha fallado (y ya se ha avisado).
function infGuardarExcel(libro) {
  try {
    const blob = xlsZip(xlsArchivosLibro(libro.hojas));
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = libro.nombre;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
    return true;
  } catch (err) {
    console.error('No se pudo preparar el Excel:', err);
    alert('No se ha podido preparar el Excel. Vuelve a intentarlo.');
    return false;
  }
}

function infDescargarExcel() {
  try {
    infGuardarExcel(infLibroExcel(infPdfTipo, infAnio, infTrimestre));
  } catch (err) {
    console.error('No se pudo preparar el Excel:', err);
    alert('No se ha podido preparar el Excel. Vuelve a intentarlo.');
  }
}

// Excel anual de un año concreto, para Configuración → Copias de
// seguridad (archivar años antiguos). Devuelve true si se ha descargado.
function infDescargarExcelAnual(anio) {
  try {
    return infGuardarExcel(infLibroExcel('anual', anio));
  } catch (err) {
    console.error('No se pudo preparar el Excel anual de ' + anio + ':', err);
    alert('No se ha podido preparar el Excel de ' + anio + '.');
    return false;
  }
}

// ============================================================
// 10. RESUMEN PARA EL 347 (26/09/2026)
// ============================================================
// Operaciones con terceros: contactos con los que, en el año, se pasa
// de 3.005,06 €. Solo informativo, para cotejar con el asesor.
// - Cuenta base + IVA, SIN restar la retención (así se declara en el
//   347), por la fecha de la factura, trimestre a trimestre.
// - Entran las facturas activas y los apuntes MANUALES de empresa con
//   contacto (los automáticos de una factura ya van en la factura; los
//   personales y los pagos de impuestos no son operaciones con
//   terceros).
// - Se separa lo que llevó retención de IRPF: esas operaciones suelen
//   quedar fuera del 347, pero lo decide el asesor.

const INF_347_LIMITE = 3005.06;

function inf347(anio) {
  const grupos = { ventas: {}, compras: {} };

  const sumar = function (lado, idContacto, nombreDoc, nifDoc, fecha, base, iva, irpf) {
    const c = infContactoPorId(idContacto);
    const nif = infTexto(nifDoc) || infTexto(c && c.nif);
    const nombre = infNombreDe(c) || infTexto(nombreDoc) || '—';
    const clave = (idContacto || idContacto === 0) && c ? 'id:' + idContacto : 'nif:' + (nif || nombre).toUpperCase();
    const g = grupos[lado][clave] || (grupos[lado][clave] = { nombre: nombre, nif: nif, total: 0, trimestres: [0, 0, 0, 0], conRetencion: 0 });
    const importe = parsearNumero(base) + parsearNumero(iva);
    const t = IMP_TRIMESTRES.indexOf(fvTrimestreDeFecha(normalizarFecha(fecha)));
    g.total += importe;
    if (t !== -1) g.trimestres[t] += importe;
    if (parsearNumero(irpf) !== 0) g.conRetencion += importe;
  };

  infVentasDelAnio(anio).forEach(function (f) {
    sumar('ventas', f.id_cliente, f.cliente, f.nif, f.fecha, f.base, f.iva, f.irpf);
  });
  infComprasDelAnio(anio).forEach(function (f) {
    sumar('compras', f.id_proveedor, f.proveedor, f.nif, f.fecha, f.base, f.iva, f.irpf);
  });
  estado.apuntes.forEach(function (a) {
    if (String(a.ambito || '') !== 'empresa') return;
    if (a.id_factura_venta || a.id_factura_compra || a.id_impuesto) return;
    if (!a.id_contacto && a.id_contacto !== 0) return;
    if (infAnioDe(a.fecha) !== anio) return;
    sumar(infTexto(a.tipo) === 'ingreso' ? 'ventas' : 'compras', a.id_contacto, '', '', a.fecha, a.base, a.iva, a.irpf);
  });

  const separar = function (lado) {
    const todos = Object.keys(grupos[lado]).map(function (k) {
      const g = grupos[lado][k];
      g.total = roundMoney(g.total);
      g.trimestres = g.trimestres.map(roundMoney);
      g.conRetencion = roundMoney(g.conRetencion);
      return g;
    });
    return {
      encima: todos.filter(function (g) { return g.total > INF_347_LIMITE; })
        .sort(function (a, b) { return b.total - a.total; }),
      debajo: todos.filter(function (g) { return g.total <= INF_347_LIMITE; }).length
    };
  };

  const v = separar('ventas');
  const c = separar('compras');
  return { ventas: v.encima, compras: c.encima, debajoVentas: v.debajo, debajoCompras: c.debajo };
}

function inf347Html(anio) {
  const r = inf347(anio);

  const lista = function (titulo, filas) {
    if (!filas.length) {
      return '<p class="inf-347-subtitulo">' + titulo + '</p><p class="inf-347-vacio">Ninguno pasa del límite.</p>';
    }
    return '<p class="inf-347-subtitulo">' + titulo + '</p>' +
      filas.map(function (g) {
        return '<div class="inf-347-fila">' +
          '<div class="inf-347-cabeza">' +
            '<span class="inf-347-nombre">' + escaparHtml(g.nombre) + '</span>' +
            '<strong>' + escaparHtml(dineroVisible(g.total)) + '</strong>' +
          '</div>' +
          '<div class="inf-347-detalle">' +
            '<span>' + escaparHtml(g.nif || 'Sin NIF') + '</span>' +
            g.trimestres.map(function (t, i) {
              return '<span>' + (i + 1) + 'T ' + escaparHtml(dineroVisible(t)) + '</span>';
            }).join('') +
          '</div>' +
          (g.conRetencion
            ? '<p class="inf-347-retencion">' +
                (g.conRetencion >= g.total ? 'Todo con retención de IRPF' : 'Con retención de IRPF: ' + escaparHtml(dineroVisible(g.conRetencion))) +
              '</p>'
            : '') +
        '</div>';
      }).join('');
  };

  return '<div class="inf-bloque">' +
    '<p class="inf-descarga-titulo">Operaciones con terceros (347) · ' + anio + '</p>' +
    '<p class="inf-bloque-nota">Contactos con más de ' + escaparHtml(formatMoney(INF_347_LIMITE)) +
      ' en el año, con IVA y sin restar la retención, por fecha de factura. Las operaciones con retención ' +
      'de IRPF suelen quedar fuera del 347: confírmalo con tu asesor.</p>' +
    lista('Clientes', r.ventas) +
    lista('Proveedores', r.compras) +
  '</div>';
}
