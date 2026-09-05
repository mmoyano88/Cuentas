/**
 * MÓDULO IMPUESTOS
 * ------------------------------------------------------------
 * Estimación trimestral de IVA (modelo 303) e IRPF (modelo 130).
 *
 * ⚠️ ORIENTATIVO. Los trimestres oficiales los presenta el asesor.
 * Esta pantalla sirve para saber cuánto dinero conviene tener
 * apartado, no para liquidar con Hacienda.
 *
 * CAMBIO RESPECTO AL MAPA (decisión 05/09/2026, pedida por el
 * propietario): se elimina el arrastre de saldos entre trimestres,
 * tanto en IVA como en IRPF. Cada trimestre muestra su propio
 * resultado, positivo (a pagar) o negativo (a tu favor). Ya no
 * existen `ivaCarryAnterior`, `ivaACompensar` ni `pagosIrpfAnteriores`
 * dentro del cálculo principal.
 *
 * El IRPF acumulado del año (la fórmula original del mapa 12.4, que
 * es como funciona el modelo 130 de verdad) se sigue calculando y se
 * muestra como línea secundaria, para poder comparar con lo que
 * calcule el asesor.
 *
 * Al marcar un trimestre como pagado se escribe UNA sola vez en la
 * hoja de impuestos (decisión I10): primero se crea el apunte de
 * tesorería con su id ya conocido, y después se guarda el registro
 * fiscal con ese id dentro. No hace falta tocar el backend.
 *
 * Esta pantalla no tiene buscador ni botón "+": no hay nada que
 * crear a mano, los trimestres salen solos de las facturas.
 */

// ============================================================
// 0. ESTADO PROPIO DEL MÓDULO
// ============================================================

const IMP_TRIMESTRES = ['Q1', 'Q2', 'Q3', 'Q4'];

let impAnio = null;        // se decide al pintar por primera vez
let impTrimestre = null;

const impSyncEstados = {};
const impPendientes = {};

function impMarcarSync(id, valor) {
  if (!id) return;
  if (valor) impSyncEstados[String(id)] = valor;
  else delete impSyncEstados[String(id)];
}

function impEstadoSync(r) {
  const marcado = impSyncEstados[String(r.id)];
  if (marcado) return marcado;
  if (esDePrueba(r)) return 'prueba';
  return 'ok';
}

const IMP_PUNTOS = {
  ok:        { clase: 'ok',        titulo: 'Guardado en la base de datos' },
  guardando: { clase: 'guardando', titulo: 'Guardando...' },
  error:     { clase: 'error',     titulo: 'No se pudo guardar. Abre "Más opciones" y reintenta.' },
  prueba:    { clase: 'prueba',    titulo: 'Solo en este dispositivo (modo prueba)' }
};

function impPuntoEstado(r) {
  const info = IMP_PUNTOS[impEstadoSync(r)] || IMP_PUNTOS.ok;
  return '<span class="imp-punto ' + info.clase + '" title="' + escaparHtml(info.titulo) + '"></span>';
}

// ============================================================
// 1. UTILIDADES
// ============================================================

// El id del registro fiscal es determinista: imp-2026-Q2. En modo
// prueba lleva delante "test-" para que el núcleo lo reconozca como
// dato local y NO lo escriba en Google Sheets. Sigue siendo
// determinista, así que se localiza igual.
function impIdRegistro(anio, trimestre) {
  const base = 'imp-' + anio + '-' + trimestre;
  return estado.modoPrueba ? 'test-' + base : base;
}

function impNuevoIdApunte() {
  if (estado.modoPrueba) return generarIdPrueba('apu');
  return 'apu-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e9).toString(36);
}

// Los valores de Sheets pueden llegar como número (el año, sobre
// todo). Se comparan siempre en texto por los dos lados.
function impMismoPeriodo(registro, anio, trimestre) {
  return String(registro['año'] || '') === String(anio) &&
         String(registro.trimestre || '') === String(trimestre);
}

function impRegistroDe(anio, trimestre) {
  if (estado.modoPrueba) {
    const prueba = estado.impuestos.find(function (r) {
      return esDePrueba(r) && impMismoPeriodo(r, anio, trimestre);
    });
    if (prueba) return prueba;
  }
  return estado.impuestos.find(function (r) {
    return !esDePrueba(r) && impMismoPeriodo(r, anio, trimestre);
  }) || null;
}

function impVisible(registro) {
  if (!estado.modoPrueba && esDePrueba(registro)) return false;
  return true;
}

function impEnTrimestre(iso, anio, trimestre) {
  const fecha = normalizarFecha(iso);
  if (!fecha) return false;
  const partes = String(fecha).split('-');
  if (partes.length < 3) return false;
  if (String(parseInt(partes[0], 10)) !== String(anio)) return false;
  return fvTrimestreDeFecha(fecha) === trimestre;
}

function impSuma(lista, campo) {
  return roundMoney(lista.reduce(function (acumulado, r) {
    return acumulado + parsearNumero(r[campo]);
  }, 0));
}

// ============================================================
// 2. ÁMBITO DE DATOS 🔒 (mapa 12.1)
// ============================================================
// Ventas y compras ACTIVAS, y apuntes de ámbito EMPRESA. Los apuntes
// personales nunca entran en un cálculo fiscal.

function impVentasDelPeriodo(anio, trimestre) {
  return estado.ventas.filter(function (f) {
    if (!fvEstaActiva(f)) return false;
    if (!impVisible(f)) return false;
    return impEnTrimestre(f.fecha, anio, trimestre);
  });
}

function impComprasDelPeriodo(anio, trimestre) {
  return estado.compras.filter(function (f) {
    if (!fcEstaActiva(f)) return false;
    if (!impVisible(f)) return false;
    return impEnTrimestre(f.fecha, anio, trimestre);
  });
}

// "Apuntes manuales" (mapa 12.4): de empresa, sin factura vinculada y
// sin ser un pago de impuestos. Un pago de IVA no es un gasto
// deducible del negocio.
function impApuntesManuales(anio, trimestre) {
  return estado.apuntes.filter(function (a) {
    if (String(a.ambito || '') !== 'empresa') return false;
    if (a.id_factura_venta || a.id_factura_compra || a.id_impuesto) return false;
    if (!impVisible(a)) return false;
    return impEnTrimestre(a.fecha, anio, trimestre);
  });
}

// ============================================================
// 3. CÁLCULO 🔒
// ============================================================
// Sin arrastre entre trimestres (decisión 05/09/2026). Cada trimestre
// se calcula solo con sus propios movimientos.

function impCalcular(anio, trimestre) {
  const ventas = impVentasDelPeriodo(anio, trimestre);
  const compras = impComprasDelPeriodo(anio, trimestre);
  const manuales = impApuntesManuales(anio, trimestre);

  const ingresosManuales = manuales.filter(function (a) { return a.tipo === 'ingreso'; });
  const gastosManuales = manuales.filter(function (a) { return a.tipo === 'gasto'; });

  // --- IVA (modelo 303) ---
  // Solo facturas, como en la aplicación original: el IVA de un
  // apunte manual no se considera deducible aquí.
  const ivaRepercutido = impSuma(ventas, 'iva');
  const ivaSoportado = impSuma(compras, 'iva');
  const iva = roundMoney(ivaRepercutido - ivaSoportado);

  // --- IRPF (modelo 130) ---
  const ingresos = roundMoney(impSuma(ventas, 'base') + impSuma(ingresosManuales, 'base'));
  const gastos = roundMoney(impSuma(compras, 'base') + impSuma(gastosManuales, 'base'));
  const rendimiento = roundMoney(ingresos - gastos);

  const pct = impPorcentajeIrpf();
  const irpfTeorico = roundMoney(Math.max(0, rendimiento) * pct / 100);

  const retencionesSoportadas = roundMoney(impSuma(ventas, 'irpf') + impSuma(ingresosManuales, 'irpf'));
  // Informativo: lo que TÚ has retenido a terceros. No entra en el
  // cálculo (mapa 12.4).
  const retencionesTerceros = roundMoney(impSuma(compras, 'irpf') + impSuma(gastosManuales, 'irpf'));

  const irpf = roundMoney(irpfTeorico - retencionesSoportadas);

  return {
    ivaRepercutido: ivaRepercutido,
    ivaSoportado: ivaSoportado,
    iva: iva,
    ingresos: ingresos,
    gastos: gastos,
    rendimiento: rendimiento,
    pct: pct,
    irpfTeorico: irpfTeorico,
    retencionesSoportadas: retencionesSoportadas,
    retencionesTerceros: retencionesTerceros,
    irpf: irpf,
    total: roundMoney(iva + irpf),
    numVentas: ventas.length,
    numCompras: compras.length,
    numManuales: manuales.length
  };
}

// Una sola clave de configuración para los dos usos (decisión B4):
// la compensación que se añade a los presupuestos y el porcentaje de
// estimación del IRPF son el mismo número.
function impPorcentajeIrpf() {
  const v = cfgNumero('compensacion_irpf');
  return v > 0 ? v : 20;
}

// Cálculo acumulado del año hasta el trimestre elegido. Es la fórmula
// original del mapa 12.4 y la que se parece a la del asesor: se
// conserva como línea de comparación, no como cifra principal.
function impIrpfAcumulado(anio, trimestre) {
  const hasta = IMP_TRIMESTRES.indexOf(trimestre);
  if (hasta < 0) return { rendimiento: 0, irpf: 0 };

  let ingresos = 0;
  let gastos = 0;
  let retenciones = 0;

  for (let i = 0; i <= hasta; i++) {
    const c = impCalcular(anio, IMP_TRIMESTRES[i]);
    ingresos += c.ingresos;
    gastos += c.gastos;
    retenciones += c.retencionesSoportadas;
  }

  // Trimestres anteriores del mismo año ya liquidados.
  let pagados = 0;
  for (let i = 0; i < hasta; i++) {
    const r = impRegistroDe(anio, IMP_TRIMESTRES[i]);
    if (r && String(r.irpf_estado || '').toLowerCase() === 'pagado') {
      pagados += parsearNumero(r.irpf_real);
    }
  }

  const rendimiento = roundMoney(ingresos - gastos);
  const teorico = roundMoney(Math.max(0, rendimiento) * impPorcentajeIrpf() / 100);

  return {
    rendimiento: rendimiento,
    irpf: roundMoney(teorico - retenciones - pagados)
  };
}

// ============================================================
// 4. IMPUESTOS A ADELANTAR 🔒 (mapa 12.6)
// ============================================================
// Dinero de impuestos que toca pagar sin haberlo cobrado todavía.

function impAdelantar(anio, trimestre) {
  const registro = impRegistroDe(anio, trimestre);
  const ivaPagado = registro && String(registro.iva_estado || '').toLowerCase() === 'pagado';
  const irpfPagado = registro && String(registro.irpf_estado || '').toLowerCase() === 'pagado';

  const delTrimestre = impVentasDelPeriodo(anio, trimestre).filter(function (f) {
    return String(f.estado || '').toLowerCase() !== 'pagada';
  });

  const todas = estado.ventas.filter(function (f) {
    if (!fvEstaActiva(f)) return false;
    if (!impVisible(f)) return false;
    return String(f.estado || '').toLowerCase() !== 'pagada';
  });

  return {
    iva: ivaPagado ? 0 : impSuma(delTrimestre, 'iva'),
    irpf: irpfPagado ? 0 : impSuma(delTrimestre, 'irpf'),
    numTrimestre: delTrimestre.length,
    ivaTotal: impSuma(todas, 'iva'),
    irpfTotal: impSuma(todas, 'irpf'),
    numTotal: todas.length
  };
}

// ============================================================
// 5. PERIODOS DISPONIBLES (mapa 12.2)
// ============================================================

function impAniosDisponibles() {
  const anios = {};

  function anotar(iso) {
    const fecha = normalizarFecha(iso);
    if (!fecha) return;
    const anio = parseInt(String(fecha).split('-')[0], 10);
    if (anio > 1990) anios[anio] = true;
  }

  estado.ventas.forEach(function (f) { if (impVisible(f)) anotar(f.fecha); });
  estado.compras.forEach(function (f) { if (impVisible(f)) anotar(f.fecha); });
  estado.apuntes.forEach(function (a) {
    if (String(a.ambito || '') === 'empresa' && impVisible(a)) anotar(a.fecha);
  });
  estado.impuestos.forEach(function (r) {
    if (!impVisible(r)) return;
    const anio = parseInt(String(r['año'] || ''), 10);
    if (anio > 1990) anios[anio] = true;
  });

  anios[new Date().getFullYear()] = true;

  return Object.keys(anios)
    .map(function (a) { return parseInt(a, 10); })
    .sort(function (a, b) { return b - a; });
}

function impTrimestreActual() {
  return fvTrimestreDeFecha(fechaHoyISO());
}

// Al abrir por primera vez se coloca en el trimestre más reciente que
// todavía no esté liquidado del todo, sin pasar del actual.
function impPeriodoPorDefecto() {
  const anioActual = new Date().getFullYear();
  const trimestreActual = impTrimestreActual();
  const anios = impAniosDisponibles();

  for (const anio of anios) {
    if (anio > anioActual) continue;
    for (let i = IMP_TRIMESTRES.length - 1; i >= 0; i--) {
      const t = IMP_TRIMESTRES[i];
      if (anio === anioActual && IMP_TRIMESTRES.indexOf(t) > IMP_TRIMESTRES.indexOf(trimestreActual)) continue;
      const r = impRegistroDe(anio, t);
      const completo = r &&
        String(r.iva_estado || '').toLowerCase() === 'pagado' &&
        String(r.irpf_estado || '').toLowerCase() === 'pagado';
      if (!completo) return { anio: anio, trimestre: t };
    }
  }

  return { anio: anioActual, trimestre: trimestreActual };
}

// ============================================================
// 6. PINTADO PRINCIPAL
// ============================================================

function pintarImpuestos() {
  const contenido = document.getElementById('contenido');
  if (!contenido) return;

  const anios = impAniosDisponibles();

  if (impAnio === null || anios.indexOf(impAnio) === -1) {
    const porDefecto = impPeriodoPorDefecto();
    impAnio = porDefecto.anio;
    impTrimestre = porDefecto.trimestre;
  }
  if (IMP_TRIMESTRES.indexOf(impTrimestre) === -1) impTrimestre = impTrimestreActual();

  contenido.innerHTML =
    '<div class="imp-periodo">' +
      '<select class="campo imp-select-anio" id="imp-anio">' +
        anios.map(function (a) {
          return '<option value="' + a + '"' + (a === impAnio ? ' selected' : '') + '>' + a + '</option>';
        }).join('') +
      '</select>' +
      '<div class="imp-selector" id="imp-trimestres">' +
        IMP_TRIMESTRES.map(function (t) {
          return '<button type="button" data-trimestre="' + t + '"' +
            (t === impTrimestre ? ' class="activa"' : '') + '>' + t + '</button>';
        }).join('') +
      '</div>' +
    '</div>' +
    '<p class="imp-nota-cabecera">Estimación orientativa para saber cuánto apartar. Los trimestres oficiales los presenta tu asesor.</p>' +
    '<div id="imp-detalle"></div>' +
    '<div id="imp-historico"></div>';

  document.getElementById('imp-anio').addEventListener('change', function (ev) {
    impAnio = parseInt(ev.target.value, 10);
    pintarImpuestos();
  });

  document.getElementById('imp-trimestres').querySelectorAll('[data-trimestre]').forEach(function (b) {
    b.addEventListener('click', function () {
      impTrimestre = b.dataset.trimestre;
      pintarImpuestos();
    });
  });

  impRepintarDetalle();
  impRepintarHistorico();
}

function impRepintarDetalle() {
  const zona = document.getElementById('imp-detalle');
  if (!zona) return;

  const c = impCalcular(impAnio, impTrimestre);
  const acumulado = impIrpfAcumulado(impAnio, impTrimestre);
  const adelantar = impAdelantar(impAnio, impTrimestre);
  const registro = impRegistroDe(impAnio, impTrimestre);

  zona.innerHTML =
    impTarjetaIva(c, registro) +
    impTarjetaIrpf(c, acumulado, registro) +
    impTarjetaTotal(c) +
    impTarjetaAdelantar(adelantar);

  impCablearDetalle(zona);
}

// Resultado de un trimestre: positivo es a pagar, negativo es a tu
// favor. Se muestra siempre el importe en positivo, con la etiqueta
// diciendo de qué lado cae.
function impBloqueResultado(valor, etiquetaPagar, etiquetaFavor) {
  const aFavor = valor < 0;
  return '<div class="imp-resultado">' +
    '<span>' + escaparHtml(aFavor ? etiquetaFavor : etiquetaPagar) + '</span>' +
    '<strong class="' + (aFavor ? 'favor' : 'pagar') + '">' +
      escaparHtml(formatMoney(Math.abs(valor))) +
    '</strong>' +
  '</div>';
}

function impTarjetaIva(c, registro) {
  const pagado = registro && String(registro.iva_estado || '').toLowerCase() === 'pagado';

  return '<div class="imp-tarjeta">' +
    '<div class="imp-tarjeta-cabecera">' +
      '<p class="imp-tarjeta-titulo">IVA · Modelo 303</p>' +
      (pagado
        ? '<span class="pastilla ind-verde">Pagado</span>'
        : '<span class="pastilla ind-ambar">Pendiente</span>') +
    '</div>' +

    '<div class="imp-linea"><span>IVA repercutido (ventas)</span><strong>+' + escaparHtml(formatMoney(c.ivaRepercutido)) + '</strong></div>' +
    '<div class="imp-linea"><span>IVA soportado (compras)</span><strong>−' + escaparHtml(formatMoney(c.ivaSoportado)) + '</strong></div>' +

    impBloqueResultado(c.iva, 'A pagar este trimestre', 'A tu favor este trimestre') +

    impBloquePago('iva', registro, pagado) +
  '</div>';
}

function impTarjetaIrpf(c, acumulado, registro) {
  const pagado = registro && String(registro.irpf_estado || '').toLowerCase() === 'pagado';

  return '<div class="imp-tarjeta">' +
    '<div class="imp-tarjeta-cabecera">' +
      '<p class="imp-tarjeta-titulo">IRPF · Modelo 130</p>' +
      (pagado
        ? '<span class="pastilla ind-verde">Pagado</span>'
        : '<span class="pastilla ind-ambar">Pendiente</span>') +
    '</div>' +

    '<div class="imp-linea"><span>Ingresos del trimestre (base)</span><strong>+' + escaparHtml(formatMoney(c.ingresos)) + '</strong></div>' +
    '<div class="imp-linea"><span>Gastos del trimestre (base)</span><strong>−' + escaparHtml(formatMoney(c.gastos)) + '</strong></div>' +
    '<div class="imp-linea destacada"><span>Rendimiento neto</span><strong>' + escaparHtml(formatMoney(c.rendimiento)) + '</strong></div>' +
    '<div class="imp-linea"><span>' + c.pct + '% sobre el rendimiento</span><strong>' + escaparHtml(formatMoney(c.irpfTeorico)) + '</strong></div>' +
    '<div class="imp-linea"><span>Retenciones ya soportadas</span><strong>−' + escaparHtml(formatMoney(c.retencionesSoportadas)) + '</strong></div>' +

    impBloqueResultado(c.irpf, 'A pagar este trimestre', 'A tu favor este trimestre') +

    '<p class="imp-nota">Acumulado del año hasta ' + escaparHtml(impTrimestre) + ': ' +
      escaparHtml(formatMoney(acumulado.irpf)) + ' sobre un rendimiento de ' +
      escaparHtml(formatMoney(acumulado.rendimiento)) + '. Es la forma en que se calcula el 130 oficial, ' +
      'por si quieres comparar con tu asesor.</p>' +

    (c.retencionesTerceros > 0
      ? '<p class="imp-nota">Además, has retenido ' + escaparHtml(formatMoney(c.retencionesTerceros)) +
        ' de IRPF a terceros este trimestre (informativo, no entra en el cálculo).</p>'
      : '') +

    impBloquePago('irpf', registro, pagado) +
  '</div>';
}

// Zona de "lo que ha pasado de verdad": importe real y fecha. El campo
// admite negativos a propósito (una devolución), así que NO lleva
// data-numero="1" — ese ayudante borra el signo menos mientras se
// escribe. Se limpia igual al guardar con parsearNumero().
function impBloquePago(tipo, registro, pagado) {
  const etiqueta = tipo === 'iva' ? 'IVA' : 'IRPF';
  const real = registro ? parsearNumero(registro[tipo + '_real']) : 0;
  const fecha = registro ? normalizarFecha(registro[tipo + '_fecha_pago']) : '';

  return '<div class="imp-pago">' +
    '<div class="imp-pago-campos">' +
      '<div class="imp-campo-grupo">' +
        '<label for="imp-real-' + tipo + '">Importe real de ' + etiqueta + '</label>' +
        '<input class="campo" type="text" inputmode="decimal" id="imp-real-' + tipo + '"' +
          ' value="' + escaparHtml(real ? String(real) : '') + '"' +
          (pagado ? ' disabled' : '') + ' placeholder="0,00">' +
      '</div>' +
      '<div class="imp-campo-grupo">' +
        '<label for="imp-fecha-' + tipo + '">Fecha</label>' +
        '<input class="campo" type="date" id="imp-fecha-' + tipo + '"' +
          ' value="' + escaparHtml(fecha || fechaHoyISO()) + '"' +
          (pagado ? ' disabled' : '') + '>' +
      '</div>' +
    '</div>' +
    '<button type="button" class="' + (pagado ? 'boton-secundario' : 'boton-principal') + '" data-pago="' + tipo + '">' +
      (pagado ? 'Marcar como pendiente' : 'Marcar como pagado') +
    '</button>' +
    '<p class="imp-mensaje-error" data-error-de="' + tipo + '" hidden></p>' +
  '</div>';
}

function impTarjetaTotal(c) {
  const aFavor = c.total < 0;
  return '<div class="imp-tarjeta imp-tarjeta-total">' +
    '<p class="imp-tarjeta-titulo">Total estimado del trimestre</p>' +
    '<div class="imp-linea"><span>IVA</span><strong>' + escaparHtml(formatMoney(c.iva)) + '</strong></div>' +
    '<div class="imp-linea"><span>IRPF</span><strong>' + escaparHtml(formatMoney(c.irpf)) + '</strong></div>' +
    '<div class="imp-total-final">' +
      '<span>' + (aFavor ? 'A TU FAVOR' : 'A APARTAR') + '</span>' +
      '<strong class="' + (aFavor ? 'favor' : '') + '">' + escaparHtml(formatMoney(Math.abs(c.total))) + '</strong>' +
    '</div>' +
  '</div>';
}

function impTarjetaAdelantar(a) {
  if (a.numTrimestre === 0 && a.numTotal === 0) return '';

  return '<div class="imp-tarjeta">' +
    '<p class="imp-tarjeta-titulo">Impuestos a adelantar</p>' +
    '<p class="imp-nota">Impuestos de facturas que todavía no has cobrado: ese dinero sale de tu bolsillo antes de entrar.</p>' +

    '<div class="imp-linea destacada"><span>De este trimestre (' + a.numTrimestre + ' factura' + (a.numTrimestre === 1 ? '' : 's') + ')</span><strong>' +
      escaparHtml(formatMoney(roundMoney(a.iva + a.irpf))) + '</strong></div>' +
    '<div class="imp-linea"><span>· IVA</span><strong>' + escaparHtml(formatMoney(a.iva)) + '</strong></div>' +
    '<div class="imp-linea"><span>· IRPF</span><strong>' + escaparHtml(formatMoney(a.irpf)) + '</strong></div>' +

    '<div class="imp-linea destacada"><span>Todas las pendientes (' + a.numTotal + ' factura' + (a.numTotal === 1 ? '' : 's') + ')</span><strong>' +
      escaparHtml(formatMoney(roundMoney(a.ivaTotal + a.irpfTotal))) + '</strong></div>' +
    '<div class="imp-linea"><span>· IVA</span><strong>' + escaparHtml(formatMoney(a.ivaTotal)) + '</strong></div>' +
    '<div class="imp-linea"><span>· IRPF</span><strong>' + escaparHtml(formatMoney(a.irpfTotal)) + '</strong></div>' +
  '</div>';
}

function impCablearDetalle(zona) {
  zona.querySelectorAll('[data-pago]').forEach(function (b) {
    b.addEventListener('click', function () { impAlternarPago(b.dataset.pago); });
  });
}

// ============================================================
// 7. HISTÓRICO DE PERIODOS
// ============================================================

function impRepintarHistorico() {
  const zona = document.getElementById('imp-historico');
  if (!zona) return;

  const registros = estado.impuestos
    .filter(impVisible)
    .slice()
    .sort(function (a, b) {
      const anioA = parseInt(String(a['año'] || '0'), 10);
      const anioB = parseInt(String(b['año'] || '0'), 10);
      if (anioA !== anioB) return anioB - anioA;
      return IMP_TRIMESTRES.indexOf(String(b.trimestre)) - IMP_TRIMESTRES.indexOf(String(a.trimestre));
    });

  if (registros.length === 0) {
    zona.innerHTML = '<p class="imp-vacio">Todavía no has cerrado ningún trimestre. En cuanto marques uno como pagado, aparecerá aquí el histórico.</p>';
    return;
  }

  zona.innerHTML =
    '<p class="imp-seccion-titulo">Trimestres registrados</p>' +
    '<div class="imp-lista-movil">' + registros.map(impRenderFilaMovil).join('') + '</div>' +
    '<div class="imp-tabla-wrap"><table class="imp-tabla"><thead><tr>' +
      '<th>Periodo</th>' +
      '<th class="imp-celda-derecha">IVA estimado</th><th class="imp-celda-derecha">IVA real</th><th>Estado IVA</th>' +
      '<th class="imp-celda-derecha">IRPF estimado</th><th class="imp-celda-derecha">IRPF real</th><th>Estado IRPF</th>' +
      '<th></th>' +
    '</tr></thead><tbody>' + registros.map(impRenderFilaTabla).join('') + '</tbody></table></div>' +
    '<p class="imp-pista-tabla">Desliza para ver más</p>';

  impCablearHistorico(zona);
}

function impPastilla(valor) {
  return String(valor || '').toLowerCase() === 'pagado'
    ? '<span class="pastilla ind-verde">Pagado</span>'
    : '<span class="pastilla ind-ambar">Pendiente</span>';
}

function impEtiquetaPeriodo(r) {
  return String(r['año'] || '—') + ' · ' + String(r.trimestre || '—');
}

function impRenderFilaMovil(r) {
  return '<div class="imp-fila" data-id="' + escaparHtml(r.id) + '">' +
    '<div class="imp-info">' +
      '<p class="imp-nombre">' + escaparHtml(impEtiquetaPeriodo(r)) + '</p>' +
      '<p class="imp-meta">IVA ' + escaparHtml(formatMoney(parsearNumero(r.iva_real))) +
        ' · IRPF ' + escaparHtml(formatMoney(parsearNumero(r.irpf_real))) + '</p>' +
      '<div class="imp-pastillas">' + impPastilla(r.iva_estado) + impPastilla(r.irpf_estado) + '</div>' +
    '</div>' +
    '<div class="imp-control">' +
      '<button type="button" class="imp-btn-icono" data-mas="' + escaparHtml(r.id) + '" aria-label="Más opciones"><i class="ti ti-dots-vertical"></i></button>' +
      impPuntoEstado(r) +
    '</div>' +
  '</div>';
}

function impRenderFilaTabla(r) {
  return '<tr class="imp-fila-tabla" data-id="' + escaparHtml(r.id) + '">' +
    '<td>' + escaparHtml(impEtiquetaPeriodo(r)) + '</td>' +
    '<td class="imp-celda-derecha">' + escaparHtml(formatMoney(parsearNumero(r.iva_estimado))) + '</td>' +
    '<td class="imp-celda-derecha">' + escaparHtml(formatMoney(parsearNumero(r.iva_real))) + '</td>' +
    '<td>' + impPastilla(r.iva_estado) + '</td>' +
    '<td class="imp-celda-derecha">' + escaparHtml(formatMoney(parsearNumero(r.irpf_estimado))) + '</td>' +
    '<td class="imp-celda-derecha">' + escaparHtml(formatMoney(parsearNumero(r.irpf_real))) + '</td>' +
    '<td>' + impPastilla(r.irpf_estado) + '</td>' +
    '<td><div class="imp-control">' +
      '<button type="button" class="imp-btn-icono" data-mas="' + escaparHtml(r.id) + '" aria-label="Más opciones"><i class="ti ti-dots-vertical"></i></button>' +
      impPuntoEstado(r) +
    '</div></td>' +
  '</tr>';
}

function impCablearHistorico(zona) {
  zona.querySelectorAll('.imp-fila, .imp-fila-tabla').forEach(function (fila) {
    fila.addEventListener('click', function (ev) {
      if (ev.target.closest('.imp-control')) return;
      impIrAlPeriodoDe(fila.dataset.id);
    });
  });

  zona.querySelectorAll('[data-mas]').forEach(function (b) {
    b.addEventListener('click', function (ev) {
      ev.stopPropagation();
      impAbrirMenuMas(b, b.dataset.mas);
    });
  });
}

function impIrAlPeriodoDe(id) {
  const r = estado.impuestos.find(function (x) { return String(x.id) === String(id); });
  if (!r) return;
  const anio = parseInt(String(r['año'] || ''), 10);
  if (anio > 1990) impAnio = anio;
  if (IMP_TRIMESTRES.indexOf(String(r.trimestre)) !== -1) impTrimestre = String(r.trimestre);
  pintarImpuestos();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================================
// 8. MENÚ "MÁS OPCIONES"
// ============================================================

function impAbrirMenuMas(boton, id) {
  document.querySelectorAll('.imp-menu-mas').forEach(function (m) { m.remove(); });

  const r = estado.impuestos.find(function (x) { return String(x.id) === String(id); });
  if (!r) return;

  const menu = document.createElement('div');
  menu.className = 'imp-menu-mas';
  menu.innerHTML =
    (impEstadoSync(r) === 'error'
      ? '<button type="button" class="destacado" data-accion="reintentar">Reintentar guardado</button>'
      : '') +
    '<button type="button" data-accion="ir">Ver este trimestre</button>';

  document.body.appendChild(menu);
  impPosicionarMenu(menu, boton);

  function cerrarMenu() {
    menu.remove();
    document.removeEventListener('click', cerrarSiFuera);
  }
  function cerrarSiFuera(ev) { if (!menu.contains(ev.target)) cerrarMenu(); }

  const btnReintentar = menu.querySelector('[data-accion="reintentar"]');
  if (btnReintentar) {
    btnReintentar.addEventListener('click', function () { cerrarMenu(); impReintentarGuardado(id); });
  }
  menu.querySelector('[data-accion="ir"]').addEventListener('click', function () {
    cerrarMenu();
    impIrAlPeriodoDe(id);
  });

  setTimeout(function () { document.addEventListener('click', cerrarSiFuera); }, 0);
}

function impPosicionarMenu(menu, boton) {
  const rect = boton.getBoundingClientRect();
  const alto = menu.offsetHeight;
  const espacioAbajo = window.innerHeight - rect.bottom;
  const arriba = espacioAbajo < alto + 12;

  menu.style.top = arriba ? (rect.top - alto - 4) + 'px' : (rect.bottom + 4) + 'px';
  menu.style.left = Math.max(8, rect.right - menu.offsetWidth) + 'px';
}

// ============================================================
// 9. MARCAR COMO PAGADO 🔒 (mapa 12.7, corregido por I10)
// ============================================================
// Una sola escritura en la hoja de impuestos: primero se crea el
// apunte de tesorería (su id lo genera esta pantalla, así que ya se
// conoce), y después se guarda el registro fiscal con ese id dentro.

function impMostrarError(tipo, mensaje) {
  const p = document.querySelector('[data-error-de="' + tipo + '"]');
  if (p) { p.textContent = mensaje; p.hidden = false; }
}

function impLimpiarErrores() {
  document.querySelectorAll('[data-error-de]').forEach(function (el) { el.hidden = true; });
}

function impRegistroBase(anio, trimestre) {
  const existente = impRegistroDe(anio, trimestre);
  if (existente) return Object.assign({}, existente);
  return {
    id: impIdRegistro(anio, trimestre),
    'año': anio,
    trimestre: trimestre,
    iva_estimado: 0,
    irpf_estimado: 0,
    iva_real: 0,
    irpf_real: 0,
    iva_estado: 'pendiente',
    irpf_estado: 'pendiente',
    iva_fecha_pago: '',
    irpf_fecha_pago: '',
    id_apunte_iva: '',
    id_apunte_irpf: ''
  };
}

// Concepto del apunte: «Pago IVA · Modelo 303 · Q2 2026». Si el
// importe es negativo (Hacienda te devuelve), el apunte es un ingreso
// y el concepto lo dice.
function impConceptoApunte(tipo, importe, anio, trimestre) {
  const modelo = tipo === 'iva' ? 'Modelo 303' : 'Modelo 130';
  const accion = importe < 0 ? 'Devolución' : 'Pago';
  return accion + ' ' + tipo.toUpperCase() + ' · ' + modelo + ' · ' + trimestre + ' ' + anio;
}

function impConstruirApunte(tipo, importe, fecha, idRegistro, anio, trimestre, idApunteExistente) {
  return {
    id: idApunteExistente || impNuevoIdApunte(),
    ambito: 'empresa',
    tipo: importe < 0 ? 'ingreso' : 'gasto',
    fecha: fecha,
    concepto: impConceptoApunte(tipo, importe, anio, trimestre),
    base: 0,
    iva_pct: 0,
    iva: 0,
    irpf_pct: 0,
    irpf: 0,
    total: roundMoney(Math.abs(importe)),
    impuesto_tipo: 'ninguno',
    impuesto_trimestre: trimestre,
    'impuesto_año': anio,
    id_factura_venta: '',
    id_factura_compra: '',
    id_impuesto: idRegistro,
    impuesto_pago: tipo,
    id_contacto: ''
  };
}

async function impAlternarPago(tipo) {
  impLimpiarErrores();
  if (!puedeEscribir()) return;

  const anio = impAnio;
  const trimestre = impTrimestre;
  const registro = impRegistroBase(anio, trimestre);
  const yaPagado = String(registro[tipo + '_estado'] || '').toLowerCase() === 'pagado';

  // --- Pasar a PENDIENTE: se borra el apunte y se libera el estado ---
  if (yaPagado) {
    const etiqueta = tipo === 'iva' ? 'IVA' : 'IRPF';
    if (!confirm('¿Marcar el ' + etiqueta + ' de ' + trimestre + ' ' + anio + ' como pendiente?\n\nSe borrará también su apunte de tesorería en Contabilidad.')) return;

    const idApunte = registro['id_apunte_' + tipo];

    impMarcarSync(registro.id, 'guardando');
    impRepintarHistorico();

    if (idApunte) {
      const borrado = await borrarRegistro('apuntes', idApunte, null, null);
      if (borrado.status !== 'success') {
        impMarcarSync(registro.id, 'error');
        impRepintarHistorico();
        impMostrarError(tipo, 'No se pudo borrar el apunte. Inténtalo otra vez.');
        return;
      }
    }

    registro[tipo + '_estado'] = 'pendiente';
    registro[tipo + '_fecha_pago'] = '';
    registro['id_apunte_' + tipo] = '';

    const guardado = await guardarRegistro('impuestos', registro, null, null);
    if (guardado.status !== 'success') {
      impMarcarSync(registro.id, 'error');
      impPendientes[String(registro.id)] = { registro: registro };
      impRepintarDetalle();
      impRepintarHistorico();
      return;
    }

    impMarcarSync(registro.id, null);
    delete impPendientes[String(registro.id)];
    impRepintarDetalle();
    impRepintarHistorico();
    return;
  }

  // --- Pasar a PAGADO ---
  const campoImporte = document.getElementById('imp-real-' + tipo);
  const campoFecha = document.getElementById('imp-fecha-' + tipo);
  const importe = roundMoney(parsearNumero(campoImporte ? campoImporte.value : 0));
  const fecha = normalizarFecha(campoFecha ? campoFecha.value : '') || fechaHoyISO();

  if (importe === 0) {
    impMostrarError(tipo, 'Indica primero el importe real de ' + (tipo === 'iva' ? 'IVA' : 'IRPF') + '. Puede ser negativo si te lo devuelven.');
    return;
  }

  // Las estimaciones vigentes quedan congeladas en el registro
  // (mapa 12.7, punto 4).
  const c = impCalcular(anio, trimestre);
  const idApunte = registro['id_apunte_' + tipo] || impNuevoIdApunte();
  const apunte = impConstruirApunte(tipo, importe, fecha, registro.id, anio, trimestre, idApunte);

  impMarcarSync(registro.id, 'guardando');
  impRepintarHistorico();

  // 1) Primero el apunte, con su id ya conocido.
  const apunteGuardado = await guardarRegistro('apuntes', apunte, null, null);
  if (apunteGuardado.status !== 'success') {
    impMarcarSync(registro.id, 'error');
    impRepintarHistorico();
    impMostrarError(tipo, 'No se pudo crear el apunte de tesorería. No se ha guardado nada.');
    return;
  }

  // 2) Y después el registro fiscal, ya completo. Una sola escritura.
  registro.iva_estimado = c.iva;
  registro.irpf_estimado = c.irpf;
  registro[tipo + '_real'] = importe;
  registro[tipo + '_estado'] = 'pagado';
  registro[tipo + '_fecha_pago'] = fecha;
  registro['id_apunte_' + tipo] = apunte.id;

  const guardado = await guardarRegistro('impuestos', registro, null, null);
  if (guardado.status !== 'success') {
    // Si falla, se deshace el apunte para no dejar un movimiento
    // huérfano en Contabilidad.
    await borrarRegistro('apuntes', apunte.id, null, null);
    impMarcarSync(registro.id, 'error');
    impPendientes[String(registro.id)] = { registro: registro };
    impRepintarDetalle();
    impRepintarHistorico();
    return;
  }

  impMarcarSync(registro.id, null);
  delete impPendientes[String(registro.id)];
  impRepintarDetalle();
  impRepintarHistorico();
}

function impReintentarGuardado(id) {
  const pendiente = impPendientes[String(id)];
  const registro = pendiente
    ? pendiente.registro
    : estado.impuestos.find(function (x) { return String(x.id) === String(id); });
  if (!registro) return;

  impMarcarSync(id, 'guardando');
  impRepintarHistorico();

  guardarRegistro('impuestos', registro, null, null).then(function (resultado) {
    if (resultado.status !== 'success') {
      impMarcarSync(id, 'error');
      impRepintarHistorico();
      return;
    }
    impMarcarSync(id, null);
    delete impPendientes[String(id)];
    impRepintarDetalle();
    impRepintarHistorico();
  });
}

// ============================================================
// 10. RED DE SEGURIDAD (reconciliador)
// ============================================================
// Si un trimestre quedó marcado como pagado pero su apunte de
// tesorería no llegó a escribirse, se vuelve a crear en la siguiente
// sincronización. Mismo mecanismo que usan las facturas.

async function impReconciliarApuntesPago() {
  for (const r of estado.impuestos) {
    if (!impVisible(r)) continue;

    for (const tipo of ['iva', 'irpf']) {
      if (String(r[tipo + '_estado'] || '').toLowerCase() !== 'pagado') continue;

      const importe = roundMoney(parsearNumero(r[tipo + '_real']));
      if (importe === 0) continue;

      const idApunte = r['id_apunte_' + tipo];
      const existe = idApunte && estado.apuntes.some(function (a) {
        return String(a.id) === String(idApunte);
      });
      if (existe) continue;

      const anio = parseInt(String(r['año'] || ''), 10);
      const trimestre = String(r.trimestre || '');
      if (!(anio > 1990) || IMP_TRIMESTRES.indexOf(trimestre) === -1) continue;

      const fecha = normalizarFecha(r[tipo + '_fecha_pago']) || fechaHoyISO();
      const apunte = impConstruirApunte(tipo, importe, fecha, r.id, anio, trimestre, idApunte || null);

      try {
        await guardarRegistro('apuntes', apunte, null, null);
        const actualizado = Object.assign({}, r);
        actualizado['id_apunte_' + tipo] = apunte.id;
        await guardarRegistro('impuestos', actualizado, null, null);
      } catch (err) {
        console.error('Reconciliación: no se pudo recrear el apunte de ' + tipo + ' de ' + trimestre + ' ' + anio, err);
      }
    }
  }
}

reconciliadores.push(impReconciliarApuntesPago);

// ============================================================
// 11. REGISTRO COMO VISTA
// ============================================================

registrarVista('impuestos', {
  titulo: 'Impuestos',
  pintar: pintarImpuestos
});
