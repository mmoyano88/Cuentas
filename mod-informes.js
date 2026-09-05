/**
 * MÓDULO INFORMES
 * ------------------------------------------------------------
 * Vive dentro de la sección Impuestos, en la pestaña «Informes»
 * (decisión de navegación del 31/08/2026). El selector lo pinta
 * `mod-impuestos.js`, que llama aquí a `pintarInformes()`.
 *
 * Dos informes:
 *
 * - TRIMESTRAL (mapa 13): ventas y compras del trimestre, otros
 *   movimientos, y la comparativa entre lo estimado y lo realmente
 *   pagado. Es el informe de trabajo.
 *
 * - ANUAL (decisión 05/09/2026): todos los registros del año como
 *   copia de seguridad para guardar a principios del año siguiente.
 *   Incluye ventas, compras, apuntes (de empresa Y personales) e
 *   impuestos, más un resumen con las cifras del año separadas en
 *   tres columnas: empresa, personal y conjunto.
 *   No incluye presupuestos, ni líneas de detalle, ni el concepto de
 *   las facturas.
 *
 * PDF: igual que en la aplicación original (mapa 15.1). No hay
 * librería de PDF. Se abre una ventana nueva con el documento
 * maquetado en A4 y se imprime a PDF desde el navegador. Funciona
 * igual en el PC y en Android, y sigue funcionando sin conexión.
 *
 * Los apuntes que se listan son solo los MANUALES: los que vienen de
 * una factura son la contrapartida de una factura ya listada arriba, y
 * saldrían dos veces; los pagos de impuestos tienen su propia tabla.
 */

// ============================================================
// 0. ESTADO PROPIO DEL MÓDULO
// ============================================================

let infTipo = 'anual';        // 'anual' | 'trimestral'
let infAnio = null;
let infTrimestre = null;

// ============================================================
// 1. UTILIDADES
// ============================================================

// Todo lo que llega de Sheets puede venir como número. Se pasa por
// String() antes de tocarlo (regla del núcleo, 04/09/2026).
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

// «Calle Número, CP Población, Provincia», saltándose lo que falte.
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

// Fila normalizada para las tablas del informe. Cada origen (venta,
// compra, apunte) se reduce a la misma forma.
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

// Un apunte no tiene número: esa casilla va vacía. El nombre, el NIF y
// la dirección se completan desde el contacto si el apunte tiene uno.
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
// Se reutilizan los filtros ya construidos en mod-impuestos.js
// (`impVisible`, `impEnTrimestre`, `impRegistroDe`, `impCalcular`),
// para que ambos módulos vean exactamente los mismos datos.

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

// Apuntes manuales (sin factura vinculada y sin ser un pago de
// impuestos), de los dos ámbitos: empresa y personal.
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

function infApuntesDelTrimestre(anio, trimestre) {
  return infOrdenarPorFecha(estado.apuntes.filter(function (a) {
    if (a.id_factura_venta || a.id_factura_compra || a.id_impuesto) return false;
    if (!impVisible(a)) return false;
    return impEnTrimestre(a.fecha, anio, trimestre);
  }));
}

// ============================================================
// 3. RESUMEN ANUAL — tres columnas: empresa, personal y conjunto
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

  // Impuestos realmente pagados durante el año (los cuatro trimestres
  // marcados como pagados). Un importe negativo es una devolución.
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

    numVentas: ventas.length,
    numCompras: compras.length,
    numApuntesEmpresa: apEmpresa.length,
    numApuntesPersonal: apPersonal.length,

    numSinCobrar: sinCobrar.length,
    pendienteCobro: impSuma(sinCobrar, 'total')
  };
}

// ============================================================
// 4. COMPARATIVA ESTIMADO / REAL 🔒 (mapa 13.3)
// ============================================================
// Informativa: no modifica ninguna estimación.

function infComparativaFila(etiqueta, estimado, real, estadoTexto) {
  const pagado = infTexto(estadoTexto).toLowerCase() === 'pagado';
  const tieneReal = parsearNumero(real) !== 0;
  const diferencia = roundMoney(parsearNumero(real) - parsearNumero(estimado));
  const base = Math.abs(parsearNumero(estimado));
  const desviacion = base > 0 ? Math.round((diferencia / base) * 1000) / 10 : null;

  return {
    etiqueta: etiqueta,
    estimado: parsearNumero(estimado),
    real: parsearNumero(real),
    diferencia: diferencia,
    desviacion: desviacion,
    estado: pagado ? 'Pagado' : (tieneReal ? 'Real indicado · pendiente de pago' : 'Pendiente'),
    clase: pagado ? 'ok' : (tieneReal ? 'aviso' : 'neutro')
  };
}

function infComparativa(anio, trimestre) {
  const registro = impRegistroDe(anio, trimestre);
  const calculo = impCalcular(anio, trimestre);

  const ivaEstimado = registro && parsearNumero(registro.iva_estimado) !== 0
    ? parsearNumero(registro.iva_estimado) : calculo.iva;
  const irpfEstimado = registro && parsearNumero(registro.irpf_estimado) !== 0
    ? parsearNumero(registro.irpf_estimado) : calculo.irpf;

  return [
    infComparativaFila('IVA · Modelo 303', ivaEstimado, registro ? registro.iva_real : 0, registro ? registro.iva_estado : ''),
    infComparativaFila('IRPF · Modelo 130', irpfEstimado, registro ? registro.irpf_real : 0, registro ? registro.irpf_estado : '')
  ];
}

// ============================================================
// 5. CONSTRUCCIÓN DEL DOCUMENTO
// ============================================================
// El mismo HTML se usa para la vista en pantalla y para la ventana de
// impresión, así que lo que ves es exactamente lo que se imprime.

function infDatosEmisor() {
  // Sin valores por defecto escritos a fuego (decisión M4): si un
  // campo está vacío, se queda vacío.
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

function infTablaTotales(filas) {
  return {
    base: roundMoney(filas.reduce(function (s, f) { return s + f.base; }, 0)),
    iva: roundMoney(filas.reduce(function (s, f) { return s + f.iva; }, 0)),
    irpf: roundMoney(filas.reduce(function (s, f) { return s + f.irpf; }, 0)),
    total: roundMoney(filas.reduce(function (s, f) { return s + f.total; }, 0))
  };
}

// Tabla de facturas. `conConcepto` solo se activa en el informe
// trimestral: el anual va sin concepto, a petición del propietario.
function infTablaFacturas(titulo, filas, conConcepto, vacio) {
  if (filas.length === 0) {
    return '<h2 class="inf-doc-seccion">' + escaparHtml(titulo) + '</h2>' +
           '<p class="inf-doc-vacio">' + escaparHtml(vacio) + '</p>';
  }

  const t = infTablaTotales(filas);

  return '<h2 class="inf-doc-seccion">' + escaparHtml(titulo) +
      ' <span class="inf-doc-cuenta">(' + filas.length + ')</span></h2>' +
    '<table class="inf-tabla-doc"><thead><tr>' +
      '<th>Nº</th><th>Fecha</th><th>Nombre</th><th>NIF</th><th>Dirección</th>' +
      (conConcepto ? '<th>Concepto</th>' : '') +
      '<th class="inf-num">Base</th><th class="inf-num">IVA</th>' +
      '<th class="inf-num">IRPF</th><th class="inf-num">Total</th>' +
    '</tr></thead><tbody>' +
    filas.map(function (f) {
      return '<tr>' +
        infCelda(f.numero) + infCelda(f.fecha) + infCelda(f.nombre) +
        infCelda(f.nif) + infCelda(f.direccion) +
        (conConcepto ? infCelda(f.concepto) : '') +
        infCeldaNum(f.base, true) +
        '<td class="inf-num">' + escaparHtml(formatMoney(f.iva)) +
          (f.ivaPct ? ' <span class="inf-pct">(' + f.ivaPct + '%)</span>' : '') + '</td>' +
        '<td class="inf-num">' + escaparHtml(formatMoney(f.irpf)) +
          (f.irpfPct ? ' <span class="inf-pct">(' + f.irpfPct + '%)</span>' : '') + '</td>' +
        infCeldaNum(f.total, true) +
      '</tr>';
    }).join('') +
    '</tbody><tfoot><tr>' +
      '<td colspan="' + (conConcepto ? 6 : 5) + '">TOTAL</td>' +
      infCeldaNum(t.base, true) + infCeldaNum(t.iva, true) +
      infCeldaNum(t.irpf, true) + infCeldaNum(t.total, true) +
    '</tr></tfoot></table>';
}

// Tabla de apuntes. Los gastos van en negativo (mapa 13.5), y se
// añaden dos columnas propias: ámbito y tipo.
function infTablaApuntes(titulo, filas, conConcepto, vacio) {
  if (filas.length === 0) {
    return '<h2 class="inf-doc-seccion">' + escaparHtml(titulo) + '</h2>' +
           '<p class="inf-doc-vacio">' + escaparHtml(vacio) + '</p>';
  }

  const t = infTablaTotales(filas);

  return '<h2 class="inf-doc-seccion">' + escaparHtml(titulo) +
      ' <span class="inf-doc-cuenta">(' + filas.length + ')</span></h2>' +
    '<table class="inf-tabla-doc"><thead><tr>' +
      '<th>Fecha</th><th>Ámbito</th><th>Tipo</th><th>Nombre</th><th>NIF</th><th>Dirección</th>' +
      (conConcepto ? '<th>Concepto</th>' : '') +
      '<th class="inf-num">Base</th><th class="inf-num">IVA</th>' +
      '<th class="inf-num">IRPF</th><th class="inf-num">Total</th>' +
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
    '<table class="inf-tabla-doc"><thead><tr>' +
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

// Resumen a tres columnas. Las filas que solo tienen sentido en la
// actividad (IVA, retenciones, impuestos) llevan «—» en personal.
function infTablaResumen(r) {
  const fila = function (etiqueta, empresa, personal, conjunto, destacada) {
    const celda = function (v) {
      if (v === null) return '<td class="inf-num inf-nd">—</td>';
      const n = parsearNumero(v);
      return '<td class="inf-num' + (n < 0 ? ' inf-negativo' : '') + '">' + escaparHtml(formatMoney(n)) + '</td>';
    };
    return '<tr' + (destacada ? ' class="inf-fila-destacada"' : '') + '>' +
      '<td>' + escaparHtml(etiqueta) + '</td>' +
      celda(empresa) + celda(personal) + celda(conjunto) +
    '</tr>';
  };

  const filaTexto = function (etiqueta, empresa, personal, conjunto) {
    return '<tr>' +
      '<td>' + escaparHtml(etiqueta) + '</td>' +
      '<td class="inf-num">' + escaparHtml(empresa) + '</td>' +
      '<td class="inf-num">' + escaparHtml(personal) + '</td>' +
      '<td class="inf-num">' + escaparHtml(conjunto) + '</td>' +
    '</tr>';
  };

  return '<h2 class="inf-doc-seccion">Resumen del año</h2>' +
    '<table class="inf-tabla-doc inf-tabla-resumen"><thead><tr>' +
      '<th>Concepto</th><th class="inf-num">Empresa</th><th class="inf-num">Personal</th><th class="inf-num">Conjunto</th>' +
    '</tr></thead><tbody>' +

    fila('Facturación (base de ventas)', r.facturacion, null, r.facturacion) +
    fila('Otros ingresos (apuntes)', r.otrosIngresosEmpresa, r.otrosIngresosPersonal,
         roundMoney(r.otrosIngresosEmpresa + r.otrosIngresosPersonal)) +
    fila('TOTAL INGRESOS', r.ingresosEmpresa, r.ingresosPersonal, r.ingresosConjunto, true) +

    fila('Compras (base de facturas)', r.comprasBase, null, r.comprasBase) +
    fila('Otros gastos (apuntes)', r.otrosGastosEmpresa, r.otrosGastosPersonal,
         roundMoney(r.otrosGastosEmpresa + r.otrosGastosPersonal)) +
    fila('TOTAL GASTOS', r.gastosEmpresa, r.gastosPersonal, r.gastosConjunto, true) +

    fila('RESULTADO DEL AÑO', r.resultadoEmpresa, r.resultadoPersonal, r.resultadoConjunto, true) +

    fila('IVA repercutido (ventas)', r.ivaRepercutido, null, r.ivaRepercutido) +
    fila('IVA soportado (compras)', r.ivaSoportado, null, r.ivaSoportado) +
    fila('IVA neto del año', r.ivaNeto, null, r.ivaNeto) +
    fila('IRPF retenido en tus facturas', r.irpfSoportado, null, r.irpfSoportado) +
    fila('IRPF retenido por ti a terceros', r.irpfTerceros, null, r.irpfTerceros) +
    fila('Impuestos pagados en el año', r.impuestosPagados, null, r.impuestosPagados) +

    fila('Pendiente de cobro a fin de año', r.pendienteCobro, null, r.pendienteCobro) +

    filaTexto('Nº de facturas emitidas', String(r.numVentas), '—', String(r.numVentas)) +
    filaTexto('Nº de facturas recibidas', String(r.numCompras), '—', String(r.numCompras)) +
    filaTexto('Nº de apuntes', String(r.numApuntesEmpresa), String(r.numApuntesPersonal),
              String(r.numApuntesEmpresa + r.numApuntesPersonal)) +
    filaTexto('Nº de facturas sin cobrar', String(r.numSinCobrar), '—', String(r.numSinCobrar)) +

    '</tbody></table>';
}

function infTablaComparativa(anio, trimestre) {
  const filas = infComparativa(anio, trimestre);

  return '<h2 class="inf-doc-seccion">Estimado frente a real</h2>' +
    '<table class="inf-tabla-doc"><thead><tr>' +
      '<th>Impuesto</th><th class="inf-num">Estimado</th><th class="inf-num">Real</th>' +
      '<th class="inf-num">Diferencia</th><th class="inf-num">Desviación</th><th>Estado</th>' +
    '</tr></thead><tbody>' +
    filas.map(function (f) {
      return '<tr>' +
        infCelda(f.etiqueta) +
        infCeldaNum(f.estimado, true) + infCeldaNum(f.real, true) + infCeldaNum(f.diferencia, true) +
        '<td class="inf-num">' + (f.desviacion === null ? '—' : escaparHtml(f.desviacion + ' %')) + '</td>' +
        '<td><span class="inf-estado ' + f.clase + '">' + escaparHtml(f.estado) + '</span></td>' +
      '</tr>';
    }).join('') +
    '</tbody></table>' +
    '<p class="inf-doc-nota">Informativo: comparar lo estimado por la aplicación con lo que se ha pagado de verdad. No modifica ninguna estimación.</p>';
}

// ---- Documento completo ----

function infDocumentoAnual(anio) {
  const ventas = infVentasDelAnio(anio).map(infFilaVenta);
  const compras = infComprasDelAnio(anio).map(infFilaCompra);
  const apuntes = infApuntesDelAnio(anio).map(infFilaApunte);
  const resumen = infResumenAnual(anio);

  return infCabeceraDoc('Informe anual', 'Ejercicio ' + anio) +
    infTablaResumen(resumen) +
    infTablaFacturas('Facturas de venta', ventas, false, 'No hay facturas de venta este año.') +
    infTablaFacturas('Facturas de compra', compras, false, 'No hay facturas de compra este año.') +
    infTablaApuntes('Apuntes de contabilidad', apuntes, false, 'No hay apuntes este año.') +
    infTablaImpuestos(anio) +
    '<p class="inf-doc-pie">Documento generado por Cuentas como copia de seguridad del ejercicio ' + anio +
      '. Los gastos figuran en negativo. No incluye presupuestos ni el detalle de líneas de las facturas.</p>';
}

function infDocumentoTrimestral(anio, trimestre) {
  const ventas = infVentasDelTrimestre(anio, trimestre).map(infFilaVenta);
  const compras = infComprasDelTrimestre(anio, trimestre).map(infFilaCompra);
  const apuntes = infApuntesDelTrimestre(anio, trimestre).map(infFilaApunte);

  return infCabeceraDoc('Informe trimestral', trimestre + ' · ' + anio) +
    infTablaComparativa(anio, trimestre) +
    infTablaFacturas('Facturas de venta', ventas, true, 'No hay facturas de venta en este trimestre.') +
    infTablaFacturas('Facturas de compra', compras, true, 'No hay facturas de compra en este trimestre.') +
    infTablaApuntes('Otros movimientos', apuntes, true, 'No hay otros movimientos en este trimestre.') +
    '<p class="inf-doc-pie">Los gastos figuran en negativo. Los movimientos que provienen de una factura no se repiten en «Otros movimientos».</p>';
}

function infDocumentoActual() {
  if (infTipo === 'trimestral') return infDocumentoTrimestral(infAnio, infTrimestre);
  return infDocumentoAnual(infAnio);
}

function infTituloActual() {
  if (infTipo === 'trimestral') return 'Informe trimestral ' + infTrimestre + ' ' + infAnio;
  return 'Informe anual ' + infAnio;
}

// ============================================================
// 6. PANTALLA
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

  zona.innerHTML =
    '<div class="inf-selector" id="inf-selector-tipo">' +
      '<button type="button" data-tipo="anual"' + (infTipo === 'anual' ? ' class="activa"' : '') + '>Anual</button>' +
      '<button type="button" data-tipo="trimestral"' + (infTipo === 'trimestral' ? ' class="activa"' : '') + '>Trimestral</button>' +
    '</div>' +

    '<div class="inf-periodo">' +
      '<select class="campo inf-select-anio" id="inf-anio">' +
        anios.map(function (a) {
          return '<option value="' + a + '"' + (a === infAnio ? ' selected' : '') + '>' + a + '</option>';
        }).join('') +
      '</select>' +
      (infTipo === 'trimestral'
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
    '</div>' +

    (infTipo === 'anual'
      ? '<p class="inf-nota-cabecera">Copia de seguridad del año completo: facturas, apuntes de empresa y personales, e impuestos.</p>'
      : '<p class="inf-nota-cabecera">Resumen del trimestre para revisar con tu asesor.</p>') +

    '<div class="inf-doc-wrap"><div class="inf-doc" id="inf-doc">' + infDocumentoActual() + '</div></div>' +
    '<p class="inf-pista-tabla">Desliza las tablas para ver todas las columnas</p>';

  zona.querySelector('#inf-selector-tipo').querySelectorAll('[data-tipo]').forEach(function (b) {
    b.addEventListener('click', function () {
      infTipo = b.dataset.tipo;
      pintarInformes();
    });
  });

  zona.querySelector('#inf-anio').addEventListener('change', function (ev) {
    infAnio = parseInt(ev.target.value, 10);
    pintarInformes();
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

// ============================================================
// 7. IMPRESIÓN / PDF (mapa 15.1)
// ============================================================
// Sin librería de PDF: se abre una ventana nueva con el documento
// maquetado en A4 apaisado y se imprime desde el navegador. En Android
// se hace desde Chrome → Imprimir → Guardar como PDF.

const INF_CSS_IMPRESION =
  '@page { size: A4 landscape; margin: 10mm; }' +
  'body { font-family: Arial, Helvetica, sans-serif; color: #1A1A1A; font-size: 9px; margin: 0; }' +
  '.inf-doc-cabecera { display: flex; justify-content: space-between; align-items: flex-start;' +
    ' gap: 24px; border-bottom: 2px solid #1A1A1A; padding-bottom: 10px; margin-bottom: 14px; }' +
  '.inf-doc-emisor p { margin: 0 0 2px; font-size: 9px; color: #3A3A3A; }' +
  '.inf-doc-emisor-nombre { font-weight: bold; font-size: 11px; color: #1A1A1A; }' +
  '.inf-doc-titulo-zona { text-align: right; }' +
  '.inf-doc-titulo { margin: 0; font-size: 16px; font-weight: bold; }' +
  '.inf-doc-subtitulo { margin: 2px 0 0; font-size: 11px; color: #3A3A3A; }' +
  '.inf-doc-generado { margin: 2px 0 0; font-size: 8px; color: #6A6A6A; }' +
  '.inf-doc-seccion { font-size: 11px; margin: 16px 0 6px; padding-bottom: 3px;' +
    ' border-bottom: 1px solid #C8C8C2; page-break-after: avoid; }' +
  '.inf-doc-cuenta { font-weight: normal; color: #6A6A6A; font-size: 9px; }' +
  '.inf-doc-vacio { font-size: 9px; color: #6A6A6A; margin: 4px 0 0; }' +
  'table.inf-tabla-doc { width: 100%; border-collapse: collapse; margin-bottom: 6px; }' +
  'table.inf-tabla-doc th { background: #EAEAE6; text-align: left; font-size: 8px;' +
    ' text-transform: uppercase; padding: 4px 5px; border-bottom: 1px solid #C8C8C2; }' +
  'table.inf-tabla-doc td { padding: 4px 5px; border-bottom: 1px solid #E8E8E2; font-size: 9px; }' +
  'table.inf-tabla-doc tfoot td { font-weight: bold; border-top: 1px solid #1A1A1A; border-bottom: none; }' +
  'table.inf-tabla-doc tr { page-break-inside: avoid; }' +
  'thead { display: table-header-group; }' +
  '.inf-num { text-align: right; white-space: nowrap; }' +
  'th.inf-num, td.inf-num { text-align: right; }' +
  '.inf-negativo { color: #A3241F; }' +
  '.inf-nd { color: #9A9A94; }' +
  '.inf-pct { color: #6A6A6A; font-size: 8px; }' +
  '.inf-fila-destacada td { font-weight: bold; background: #F2F2EE; }' +
  '.inf-estado { font-size: 8px; }' +
  '.inf-doc-nota, .inf-doc-pie { font-size: 8px; color: #6A6A6A; margin-top: 8px; }';

function infImprimir() {
  const ventana = window.open('', '_blank');
  if (!ventana) {
    alert('El navegador ha bloqueado la ventana del informe.\n\nPermite las ventanas emergentes para esta página y vuelve a intentarlo.');
    return;
  }

  const titulo = infTituloActual();

  ventana.document.open();
  ventana.document.write(
    '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">' +
    '<title>' + escaparHtml(titulo) + '</title>' +
    '<style>' + INF_CSS_IMPRESION + '</style>' +
    '</head><body>' + infDocumentoActual() + '</body></html>'
  );
  ventana.document.close();
  ventana.focus();

  // Se deja un momento para que la ventana termine de maquetar antes
  // de abrir el diálogo de impresión.
  setTimeout(function () {
    try { ventana.print(); } catch (err) { console.error('No se pudo imprimir:', err); }
  }, 400);
}
