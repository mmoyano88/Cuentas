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
    return fvEstaActiva(f) && impVisible(f) && infAnioDe(f.fecha) === anio;
  }));
}

function infComprasDelAnio(anio) {
  return infOrdenarPorFecha(estado.compras.filter(function (f) {
    return fcEstaActiva(f) && impVisible(f) && infAnioDe(f.fecha) === anio;
  }));
}

function infApuntesDelAnio(anio) {
  return infOrdenarPorFecha(estado.apuntes.filter(function (a) {
    if (a.id_factura_venta || a.id_factura_compra || a.id_impuesto) return false;
    if (!impVisible(a)) return false;
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
    if (!impVisible(a)) return false;
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

function infTablaImpuestos(anio) {
  const filas = IMP_TRIMESTRES.map(function (t) {
    const r = impRegistroDe(anio, t);
    const c = impCalcular(anio, t);
    return {
      trimestre: t,
      ivaEstimado: r && parsearNumero(r.iva_estimado) !== 0 ? parsearNumero(r.iva_estimado) : c.iva,
      ivaReal: r ? parsearNumero(r.iva_real) : 0,
      ivaEstado: r && infTexto(r.iva_estado).toLowerCase() === 'pagado' ? 'Pagado' : 'Pendiente',
      ivaFecha: r ? mostrarFecha(r.iva_fecha_pago) : '—',
      irpfEstimado: r && parsearNumero(r.irpf_estimado) !== 0 ? parsearNumero(r.irpf_estimado) : c.irpf,
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

    infResumenPantallaHtml(resumen) +

    '<div class="inf-descarga">' +
      '<p class="inf-descarga-titulo">Descargar un informe en PDF</p>' +
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
      '<button type="button" class="boton-principal inf-btn-pdf" id="inf-btn-pdf">' +
        '<i class="ti ti-file-type-pdf"></i> Descargar PDF' +
      '</button>' +
      '<p class="inf-descarga-nota">' +
        (infPdfTipo === 'trimestral'
          ? 'Facturas, apuntes de empresa y el resumen de facturación del trimestre, para tu asesor.'
          : 'Copia de seguridad completa del año: facturas, apuntes (empresa y personal) e impuestos.') +
      '</p>' +
    '</div>';

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
}

function infResumenPantallaHtml(resumen) {
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
        '<span class="inf-resumen-dato"><small>Estimado</small>' + escaparHtml(formatMoney(estimado)) + '</span>' +
        '<span class="inf-resumen-dato"><small>Pagado</small>' +
          (pagado ? escaparHtml(formatMoney(real)) : '—') + '</span>' +
      '</div>' +
      // La cifra que se congeló al pagar ya no coincide con la de hoy:
      // se han añadido facturas o apuntes de ese trimestre después de
      // marcarlo como pagado. Se enseñan las dos para que no parezca
      // un error.
      (desfasado
        ? '<p class="inf-resumen-desfase">Al pagar se estimó ' + escaparHtml(formatMoney(guardado)) + '</p>'
        : '') +
    '</div>';
  };

  const filaTrimestre = function (f) {
    return '<div class="inf-resumen-trimestre">' +
      '<p class="inf-resumen-trimestre-titulo">' + f.trimestre + '</p>' +
      bloque('IVA', f.ivaEstimado, f.ivaReal, f.ivaPagado, f.ivaGuardado, f.ivaDesfasado) +
      bloque('IRPF', f.irpfEstimado, f.irpfReal, f.irpfPagado, f.irpfGuardado, f.irpfDesfasado) +
    '</div>';
  };

  return '<div class="inf-resumen-anual">' +
    '<div class="inf-resumen-trimestres">' + resumen.filas.map(filaTrimestre).join('') + '</div>' +
    '<div class="inf-resumen-total">' +
      '<div class="inf-resumen-total-linea"><span>Pagado en el año</span><strong>' + escaparHtml(formatMoney(resumen.totalPagado)) + '</strong></div>' +
      '<div class="inf-resumen-total-linea"><span>Estimado total del año</span><strong>' + escaparHtml(formatMoney(resumen.totalEstimado)) + '</strong></div>' +
      (resumen.trimestresPendientes > 0
        ? '<p class="inf-resumen-pendiente">' + resumen.trimestresPendientes + ' de 4 trimestres pendientes de cerrar</p>'
        : '<p class="inf-resumen-pendiente ok">Los 4 trimestres del año están cerrados</p>') +
    '</div>' +
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
