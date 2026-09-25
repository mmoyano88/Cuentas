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
 * hoja de impuestos (decisión I10): el id del apunte de tesorería se
 * genera aquí, así que el registro fiscal se guarda ya con ese id
 * dentro. No hace falta tocar el backend.
 *
 * Esta pantalla no tiene buscador ni botón "+": no hay nada que
 * crear a mano, los trimestres salen solos de las facturas.
 */

// ============================================================
// 0. ESTADO PROPIO DEL MÓDULO
// ============================================================

const IMP_TRIMESTRES = ['Q1', 'Q2', 'Q3', 'Q4'];

// Esta pantalla comparte la sección "Impuestos" con Informes
// (decisión de navegación del 31/08/2026), igual que Facturas comparte
// la suya entre Ventas y Compras.
let impArea = 'impuestos';   // 'impuestos' | 'informes'

let impAnio = null;        // se decide al pintar por primera vez
let impTrimestre = null;

// Punto de color del registro fiscal: lo decide el núcleo (estadoSyncDe).
const IMP_PUNTOS = {
  ok:        { clase: 'ok',        titulo: 'Guardado en la base de datos' },
  guardando: { clase: 'guardando', titulo: 'Guardando...' },
  error:     { clase: 'error',     titulo: 'No se pudo guardar. Pulsa el botón de sincronizar para reintentarlo.' }
};

function impPuntoEstado(r) {
  const info = IMP_PUNTOS[estadoSyncDe('impuestos', r)] || IMP_PUNTOS.ok;
  return '<span class="imp-punto ' + info.clase + '" title="' + escaparHtml(info.titulo) + '"></span>';
}

// ============================================================
// 1. UTILIDADES
// ============================================================

// El id del registro fiscal es determinista: imp-2026-Q2.
function impIdRegistro(anio, trimestre) {
  return 'imp-' + anio + '-' + trimestre;
}

function impNuevoIdApunte() {
  return 'apu-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e9).toString(36);
}

// Los valores de Sheets pueden llegar como número (el año, sobre
// todo). Se comparan siempre en texto por los dos lados.
function impMismoPeriodo(registro, anio, trimestre) {
  return String(registro['año'] || '') === String(anio) &&
         String(registro.trimestre || '') === String(trimestre);
}

function impRegistroDe(anio, trimestre) {
  return estado.impuestos.find(function (r) {
    return impMismoPeriodo(r, anio, trimestre);
  }) || null;
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
    return impEnTrimestre(f.fecha, anio, trimestre);
  });
}

function impComprasDelPeriodo(anio, trimestre) {
  return estado.compras.filter(function (f) {
    if (!fcEstaActiva(f)) return false;
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
    return impEnTrimestre(a.fecha, anio, trimestre);
  });
}

// ============================================================
// 3. CÁLCULO 🔒
// ============================================================
// Sin arrastre entre trimestres (decisión 05/09/2026). Cada trimestre
// se calcula solo con sus propios movimientos.
//
// `opciones.soloCobradas` (25/09/2026): hace el MISMO cálculo pero
// contando solo las facturas de venta ya cobradas. Lo usa la regla de
// "impuestos a adelantar" (sección 4) para saber cuánto pagarías si las
// facturas sin cobrar no existieran. Sin ese parámetro, el cálculo es
// exactamente el de siempre.

function impCalcular(anio, trimestre, opciones) {
  const soloCobradas = !!(opciones && opciones.soloCobradas);
  const ventas = impVentasDelPeriodo(anio, trimestre).filter(function (f) {
    return !soloCobradas || impEsCobrada(f);
  });
  const compras = impComprasDelPeriodo(anio, trimestre);
  const manuales = impApuntesManuales(anio, trimestre);

  const ingresosManuales = manuales.filter(function (a) { return a.tipo === 'ingreso'; });
  const gastosManuales = manuales.filter(function (a) { return a.tipo === 'gasto'; });

  // --- IVA (modelo 303) ---
  // Facturas de venta y de compra, MÁS los apuntes de empresa que
  // lleven IVA marcado (decisión 05/09/2026). Un apunte sin IVA —la
  // cuota de autónomo, una subvención— suma cero y no altera nada; un
  // recibo de luz o de internet apuntado a mano sí se deduce.
  //
  // Lo que NO entra, y es deliberado: los apuntes personales (nunca
  // tributan), los que vienen de una factura (esa factura ya está
  // contada arriba y se duplicaría) y los pagos de impuestos (pagar el
  // IVA no genera más IVA). Los tres quedan fuera en el filtro de
  // `impApuntesManuales`, así que aquí ya no pueden colarse.
  const ivaRepercutido = roundMoney(impSuma(ventas, 'iva') + impSuma(ingresosManuales, 'iva'));
  const ivaSoportado = roundMoney(impSuma(compras, 'iva') + impSuma(gastosManuales, 'iva'));
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
// 4. IMPUESTOS A ADELANTAR (regla nueva, 25/09/2026)
// ============================================================
// Sustituye al mapa 12.6, a petición del propietario. La regla antigua
// sumaba el IVA y la RETENCIÓN de las facturas sin cobrar. La retención
// no la paga el autónomo (la ingresa el cliente), así que la cifra
// podía salir más alta que el propio pago del trimestre.
//
// Regla nueva, igual para el IVA y para el IRPF:
//   a adelantar = lo que pagas este trimestre
//               − lo que pagarías si las facturas sin cobrar no existieran
// Los dos pagos se cuentan a partir de 0 (un resultado a tu favor no se
// paga). Así nunca puede salir más de lo que se paga, y las compras
// cuentan, porque ya están dentro del pago.

function impEsCobrada(f) {
  return String(f.estado || '').toLowerCase() === 'pagada';
}

// Lo que de verdad se paga de un resultado: si sale a tu favor, 0.
function impLoQueSePaga(valor) {
  return roundMoney(Math.max(0, parsearNumero(valor)));
}

function impPagado(registro, tipo) {
  return !!registro && String(registro[tipo + '_estado'] || '').toLowerCase() === 'pagado';
}

function impAdelantar(anio, trimestre) {
  const c = impCalcular(anio, trimestre);
  const soloCobrado = impCalcular(anio, trimestre, { soloCobradas: true });
  const sinCobrar = impVentasDelPeriodo(anio, trimestre).filter(function (f) {
    return !impEsCobrada(f);
  });

  return {
    iva: roundMoney(Math.max(0, impLoQueSePaga(c.iva) - impLoQueSePaga(soloCobrado.iva))),
    irpf: roundMoney(Math.max(0, impLoQueSePaga(c.irpf) - impLoQueSePaga(soloCobrado.irpf))),
    numFacturas: sinCobrar.length
  };
}

// ---- Plazos de pago (modelos 303 y 130) ----
// Q1 hasta el 20 de abril, Q2 hasta el 20 de julio, Q3 hasta el 20 de
// octubre y Q4 hasta el 30 de enero del año siguiente. Si ese día cae
// en sábado o domingo, el plazo pasa al lunes. Los festivos no se
// tienen en cuenta: es una referencia, el plazo exacto lo sabe el asesor.

const IMP_MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function impFechaLocal(iso) {
  const p = String(normalizarFecha(iso) || '').split('-');
  if (p.length < 3) return null;
  return new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10), 12);
}

function impFechaLimite(anio, trimestre) {
  const i = IMP_TRIMESTRES.indexOf(trimestre);
  if (i < 0) return null;
  const d = i === 3 ? new Date(anio + 1, 0, 30, 12) : new Date(anio, [3, 6, 9][i], 20, 12);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return d;
}

function impDiasHasta(fecha) {
  const hoy = impFechaLocal(fechaHoyISO());
  if (!fecha || !hoy) return 0;
  return Math.round((fecha.getTime() - hoy.getTime()) / 86400000);
}

// "20 de octubre" (y el año solo si no es el actual).
function impTextoFecha(fecha) {
  const texto = fecha.getDate() + ' de ' + IMP_MESES[fecha.getMonth()];
  return fecha.getFullYear() === new Date().getFullYear() ? texto : texto + ' de ' + fecha.getFullYear();
}

// "20/10"
function impTextoFechaCorta(fecha) {
  return String(fecha.getDate()).padStart(2, '0') + '/' + String(fecha.getMonth() + 1).padStart(2, '0');
}

// ---- Próximo pago ----
// El trimestre que toca pagar: el último trimestre ya terminado si
// todavía tiene algo sin marcar como pagado (y tuvo movimientos); si
// no, el trimestre en curso. Así, el 5 de octubre sigue siendo el Q3
// hasta que se marque como pagado.

function impTrimestrePagado(anio, trimestre) {
  const r = impRegistroDe(anio, trimestre);
  return impPagado(r, 'iva') && impPagado(r, 'irpf');
}

function impProximoPago() {
  const anio = new Date().getFullYear();
  const actual = impTrimestreActual();
  const i = IMP_TRIMESTRES.indexOf(actual);
  const anterior = i === 0
    ? { anio: anio - 1, trimestre: 'Q4' }
    : { anio: anio, trimestre: IMP_TRIMESTRES[i - 1] };

  if (!impTrimestrePagado(anterior.anio, anterior.trimestre)) {
    const c = impCalcular(anterior.anio, anterior.trimestre);
    if (c.numVentas + c.numCompras + c.numManuales > 0) return anterior;
  }
  return { anio: anio, trimestre: actual };
}

// Lo que queda por pagar de un trimestre: cada impuesto sin marcar como
// pagado, contado a partir de 0.
function impPendienteDePago(anio, trimestre) {
  const c = impCalcular(anio, trimestre);
  const r = impRegistroDe(anio, trimestre);
  const iva = impPagado(r, 'iva') ? 0 : impLoQueSePaga(c.iva);
  const irpf = impPagado(r, 'irpf') ? 0 : impLoQueSePaga(c.irpf);
  return { iva: iva, irpf: irpf, total: roundMoney(iva + irpf) };
}

// Estado del plazo de un trimestre, en texto corto y largo.
//   estado: 'pagado' | 'vencido' | 'pronto' (7 días o menos) | 'normal'
function impEstadoPlazo(anio, trimestre) {
  const limite = impFechaLimite(anio, trimestre);
  const dias = impDiasHasta(limite);
  if (impTrimestrePagado(anio, trimestre)) {
    return { estado: 'pagado', limite: limite, dias: dias, corto: 'Pagado', largo: 'Pagado' };
  }
  if (dias < 0) {
    return {
      estado: 'vencido', limite: limite, dias: dias,
      corto: 'Venció el ' + impTextoFechaCorta(limite),
      largo: 'El plazo acabó el ' + impTextoFecha(limite)
    };
  }
  const cuenta = dias === 0 ? 'hoy es el último día' : (dias === 1 ? 'falta 1 día' : 'faltan ' + dias + ' días');
  const cuentaCorta = dias === 0 ? 'último día' : (dias === 1 ? '1 día' : dias + ' días');
  return {
    estado: dias <= 7 ? 'pronto' : 'normal', limite: limite, dias: dias,
    corto: 'Hasta ' + impTextoFechaCorta(limite) + ' · ' + cuentaCorta,
    largo: 'Plazo hasta el ' + impTextoFecha(limite) + ' · ' + cuenta
  };
}

// ---- Facturas sin cobrar ----
// Lo que te deben y, de eso, cuántos impuestos has adelantado o vas a
// adelantar a Hacienda. Se reparte por trimestres con la regla de
// arriba:
//   · ya adelantados: trimestres con ese impuesto marcado como pagado
//     (nunca más de lo que se pagó de verdad: 0,01 € es 0,01 €);
//   · en el próximo pago: el trimestre que toca pagar, y cualquier
//     trimestre anterior que siga sin marcar;
//   · más adelante: trimestres posteriores (facturas del trimestre en
//     curso cuando todavía se está pagando el anterior).

function impFacturasSinCobrar() {
  const facturas = estado.ventas.filter(function (f) {
    return fvEstaActiva(f) && !impEsCobrada(f);
  });

  const proximo = impProximoPago();
  const claveProximo = proximo.anio * 4 + IMP_TRIMESTRES.indexOf(proximo.trimestre);

  const periodos = {};
  facturas.forEach(function (f) {
    const fecha = normalizarFecha(f.fecha);
    if (!fecha) return;
    const anio = parseInt(String(fecha).split('-')[0], 10);
    const trimestre = fvTrimestreDeFecha(fecha);
    if (!(anio > 1990) || IMP_TRIMESTRES.indexOf(trimestre) === -1) return;
    periodos[anio + '-' + trimestre] = { anio: anio, trimestre: trimestre };
  });

  let yaAdelantado = 0;
  let enProximo = 0;
  let masAdelante = 0;

  Object.keys(periodos).forEach(function (k) {
    const p = periodos[k];
    const a = impAdelantar(p.anio, p.trimestre);
    const r = impRegistroDe(p.anio, p.trimestre);
    const clave = p.anio * 4 + IMP_TRIMESTRES.indexOf(p.trimestre);

    ['iva', 'irpf'].forEach(function (tipo) {
      if (impPagado(r, tipo)) {
        yaAdelantado += Math.min(a[tipo], Math.max(0, parsearNumero(r[tipo + '_real'])));
      } else if (clave <= claveProximo) {
        enProximo += a[tipo];
      } else {
        masAdelante += a[tipo];
      }
    });
  });

  const hoy = impFechaLocal(fechaHoyISO());
  const lista = facturas.map(function (f) {
    const emitida = impFechaLocal(f.fecha);
    return {
      factura: f,
      dias: emitida && hoy ? Math.max(0, Math.round((hoy.getTime() - emitida.getTime()) / 86400000)) : 0
    };
  }).sort(function (x, y) { return y.dias - x.dias; });

  return {
    total: impSuma(facturas, 'total'),
    num: facturas.length,
    yaAdelantado: roundMoney(yaAdelantado),
    enProximo: roundMoney(enProximo),
    masAdelante: roundMoney(masAdelante),
    proximo: proximo,
    lista: lista
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

  estado.ventas.forEach(function (f) { anotar(f.fecha); });
  estado.compras.forEach(function (f) { anotar(f.fecha); });
  estado.apuntes.forEach(function (a) {
    if (String(a.ambito || '') === 'empresa') anotar(a.fecha);
  });
  estado.impuestos.forEach(function (r) {
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
// 6. PINTADO PRINCIPAL (selector Impuestos / Informes)
// ============================================================
// El selector de la sección se pinta aquí; el contenido de cada área
// va dentro de #imp-zona. Informes vive en mod-informes.js, que se
// carga después de este archivo.

function pintarImpuestos() {
  const contenido = document.getElementById('contenido');
  if (!contenido) return;

  contenido.innerHTML =
    '<div class="imp-cabecera-seccion">' +
      '<div class="imp-selector imp-selector-area" id="imp-selector-area">' +
        '<button type="button" data-area="impuestos">Impuestos</button>' +
        '<button type="button" data-area="informes">Informes</button>' +
      '</div>' +
    '</div>' +
    '<div id="imp-zona"></div>';

  document.getElementById('imp-selector-area').querySelectorAll('[data-area]').forEach(function (b) {
    b.classList.toggle('activa', b.dataset.area === impArea);
    b.addEventListener('click', function () {
      if (b.dataset.area === 'informes' && typeof pintarInformes !== 'function') {
        alert('El módulo de Informes todavía no está construido.');
        return;
      }
      impArea = b.dataset.area;
      pintarImpuestos();
    });
  });

  if (impArea === 'informes' && typeof pintarInformes === 'function') {
    pintarInformes();
  } else {
    pintarPantallaImpuestos();
  }
}

function pintarPantallaImpuestos() {
  const zona = document.getElementById('imp-zona');
  if (!zona) return;

  const anios = impAniosDisponibles();

  // Al abrir, se coloca en el trimestre que toca pagar (25/09/2026):
  // el 5 de octubre abre el Q3, no el Q4, hasta que se marque pagado.
  if (impAnio === null || anios.indexOf(impAnio) === -1) {
    const porDefecto = impProximoPago();
    impAnio = porDefecto.anio;
    impTrimestre = porDefecto.trimestre;
    if (anios.indexOf(impAnio) === -1) {
      const otro = impPeriodoPorDefecto();
      impAnio = otro.anio;
      impTrimestre = otro.trimestre;
    }
  }
  if (IMP_TRIMESTRES.indexOf(impTrimestre) === -1) impTrimestre = impTrimestreActual();

  zona.innerHTML =
    '<div class="imp-periodo">' +
      '<select class="campo imp-select-anio" id="imp-anio">' +
        anios.map(function (a) {
          return '<option value="' + a + '"' + (a === impAnio ? ' selected' : '') + '>' + a + '</option>';
        }).join('') +
      '</select>' +
      '<div class="imp-selector imp-selector-periodo" id="imp-trimestres">' +
        IMP_TRIMESTRES.map(function (t) {
          return '<button type="button" data-trimestre="' + t + '"' +
            (t === impTrimestre ? ' class="activa"' : '') + '>' + t + '</button>';
        }).join('') +
      '</div>' +
    '</div>' +
    '<p class="imp-nota-cabecera">Estimación orientativa para saber cuánto apartar. Los trimestres oficiales los presenta tu asesor.</p>' +
    '<div id="imp-detalle"></div>';

  document.getElementById('imp-anio').addEventListener('change', function (ev) {
    impAnio = parseInt(ev.target.value, 10);
    pintarPantallaImpuestos();
  });

  document.getElementById('imp-trimestres').querySelectorAll('[data-trimestre]').forEach(function (b) {
    b.addEventListener('click', function () {
      impTrimestre = b.dataset.trimestre;
      pintarPantallaImpuestos();
    });
  });

  impRepintarDetalle();
}

function impRepintarDetalle() {
  const zona = document.getElementById('imp-detalle');
  if (!zona) return;

  const c = impCalcular(impAnio, impTrimestre);
  const acumulado = impIrpfAcumulado(impAnio, impTrimestre);
  const adelantar = impAdelantar(impAnio, impTrimestre);
  const registro = impRegistroDe(impAnio, impTrimestre);

  // IVA e IRPF van uno al lado del otro en PC y uno debajo del otro
  // en móvil (decisión 05/09/2026): en pantalla ancha ocupaban
  // demasiado alto puestos en vertical.
  zona.innerHTML =
    impBloquePlazo(impAnio, impTrimestre) +
    '<div class="imp-columnas">' +
      impTarjetaIva(c, registro) +
      impTarjetaIrpf(c, acumulado, registro) +
    '</div>' +
    impTarjetaTotal(c, registro, adelantar) +
    impTarjetaSinCobrar(impFacturasSinCobrar());

  impCablearDetalle(zona);
}

// Plazo del trimestre elegido, arriba del todo (25/09/2026).
// El aviso de plazo vencido solo sale en el trimestre que toca pagar;
// en trimestres antiguos sin marcar (por ejemplo, de antes de usar la
// app) se dice sin alarma.
function impBloquePlazo(anio, trimestre) {
  const p = impEstadoPlazo(anio, trimestre);
  const proximo = impProximoPago();
  const esProximo = proximo.anio === anio && proximo.trimestre === trimestre;
  if (p.estado === 'vencido' && !esProximo) {
    p.estado = 'normal';
    p.largo = 'sin marcar como pagado · el plazo era hasta el ' + impTextoFecha(p.limite);
  }
  const iconos = { pagado: 'ti-circle-check', vencido: 'ti-alert-triangle', pronto: 'ti-calendar-due', normal: 'ti-calendar-due' };
  const texto = p.estado === 'pagado'
    ? trimestre + ' ' + anio + ' · pagado'
    : trimestre + ' ' + anio + ' · ' + p.largo;
  return '<div class="imp-plazo ' + p.estado + '">' +
    '<i class="ti ' + iconos[p.estado] + '"></i>' +
    '<span>' + escaparHtml(texto) + '</span>' +
  '</div>';
}

// Resultado de un trimestre: positivo es a pagar, negativo es a tu
// favor. Se muestra siempre el importe en positivo, con la etiqueta
// diciendo de qué lado cae.
function impBloqueResultado(valor, etiquetaPagar, etiquetaFavor) {
  const aFavor = valor < 0;
  return '<div class="imp-resultado">' +
    '<span>' + escaparHtml(aFavor ? etiquetaFavor : etiquetaPagar) + '</span>' +
    '<strong class="' + (aFavor ? 'favor' : 'pagar') + '">' +
      escaparHtml(dineroVisible(Math.abs(valor))) +
    '</strong>' +
  '</div>';
}

function impTarjetaIva(c, registro) {
  const pagado = registro && String(registro.iva_estado || '').toLowerCase() === 'pagado';

  return '<div class="imp-tarjeta">' +
    '<div class="imp-tarjeta-cabecera">' +
      '<p class="imp-tarjeta-titulo">IVA · Modelo 303</p>' +
      '<span class="imp-cabecera-estado">' +
        (pagado
          ? '<span class="pastilla ind-verde">Pagado</span>'
          : '<span class="pastilla ind-ambar">Pendiente</span>') +
        (registro ? impPuntoEstado(registro) : '') +
      '</span>' +
    '</div>' +

    '<div class="imp-linea"><span>IVA repercutido (ventas)</span><strong>+' + escaparHtml(dineroVisible(c.ivaRepercutido)) + '</strong></div>' +
    '<div class="imp-linea"><span>IVA soportado (compras)</span><strong>−' + escaparHtml(dineroVisible(c.ivaSoportado)) + '</strong></div>' +

    impBloqueResultado(c.iva, 'A pagar este trimestre', 'A tu favor este trimestre') +

    impBloquePago('iva', registro, pagado, c.iva) +
  '</div>';
}

// Porcentaje de la facturación del AÑO que lleva retención de IRPF.
// Si supera el 70%, es probable que no haya obligación de presentar
// el modelo 130 (la retención ya la adelantan los clientes). No lo
// decide la aplicación: se muestra como aviso para consultarlo con el
// asesor. Ver GUÍA sección 13.
//
// Corregido el 25/09/2026: antes solo miraba las facturas y dejaba
// fuera los ingresos de empresa apuntados a mano en Contabilidad (sin
// factura), que casi nunca llevan retención. Con ingresos del año
// apuntados así, decía "100%" cuando la cifra real era mucho menor.
function impPorcentajeConRetencion(anio) {
  let conRetencion = 0;
  let total = 0;

  function contar(base, retencion) {
    if (base <= 0) return;
    total += base;
    if (retencion > 0) conRetencion += base;
  }

  IMP_TRIMESTRES.forEach(function (t) {
    impVentasDelPeriodo(anio, t).forEach(function (f) {
      contar(parsearNumero(f.base), parsearNumero(f.irpf));
    });
    impApuntesManuales(anio, t).forEach(function (a) {
      if (a.tipo !== 'ingreso') return;
      contar(parsearNumero(a.base), parsearNumero(a.irpf));
    });
  });

  if (total <= 0) return null;
  return Math.round((conRetencion / total) * 100);
}

function impTarjetaIrpf(c, acumulado, registro) {
  const pagado = registro && String(registro.irpf_estado || '').toLowerCase() === 'pagado';
  const pctRetencion = impPorcentajeConRetencion(impAnio);

  // Aviso del 70% (decisión 05/09/2026). Si la mayor parte de la
  // facturación ya lleva retención, puede no haber obligación de
  // presentar el 130 — pero el dinero hay que apartarlo igual, porque
  // entonces se liquida en la declaración de la renta. Por eso la
  // cifra principal no cambia: solo se avisa.
  let avisoRetencion = '';
  if (pctRetencion !== null) {
    avisoRetencion = pctRetencion >= 70
      ? '<p class="imp-nota destacada-ok">El ' + pctRetencion + '% de tus ingresos de ' + impAnio +
        ' lleva retención. Por encima del 70% es probable que no tengas que presentar el modelo 130 ' +
        '(el dinero se liquidaría en la declaración de la renta). Confírmalo con tu asesor.</p>'
      : '<p class="imp-nota">El ' + pctRetencion + '% de tus ingresos de ' + impAnio +
        ' lleva retención. Por debajo del 70% es probable que sí tengas que presentar el modelo 130.</p>';
  }

  return '<div class="imp-tarjeta">' +
    '<div class="imp-tarjeta-cabecera">' +
      '<p class="imp-tarjeta-titulo">IRPF · dinero a apartar</p>' +
      '<span class="imp-cabecera-estado">' +
        (pagado
          ? '<span class="pastilla ind-verde">Pagado</span>'
          : '<span class="pastilla ind-ambar">Pendiente</span>') +
        (registro ? impPuntoEstado(registro) : '') +
      '</span>' +
    '</div>' +
    '<p class="imp-tarjeta-subtitulo">Referencia: modelo 130</p>' +

    '<div class="imp-linea"><span>Ingresos del trimestre (base)</span><strong>+' + escaparHtml(dineroVisible(c.ingresos)) + '</strong></div>' +
    '<div class="imp-linea"><span>Gastos del trimestre (base)</span><strong>−' + escaparHtml(dineroVisible(c.gastos)) + '</strong></div>' +
    '<div class="imp-linea destacada"><span>Rendimiento neto</span><strong>' + escaparHtml(dineroVisible(c.rendimiento)) + '</strong></div>' +
    '<div class="imp-linea"><span>' + c.pct + '% sobre el rendimiento</span><strong>' + escaparHtml(dineroVisible(c.irpfTeorico)) + '</strong></div>' +
    '<div class="imp-linea"><span>Retenciones que ya te han hecho</span><strong>−' + escaparHtml(dineroVisible(c.retencionesSoportadas)) + '</strong></div>' +

    impBloqueResultado(c.irpf, 'A apartar este trimestre', 'A tu favor este trimestre') +

    avisoRetencion +

    '<p class="imp-nota">Acumulado del año hasta ' + escaparHtml(impTrimestre) + ': ' +
      escaparHtml(dineroVisible(acumulado.irpf)) + ' sobre un rendimiento de ' +
      escaparHtml(dineroVisible(acumulado.rendimiento)) + '. Es la forma en que se calcula el 130 oficial, ' +
      'por si quieres comparar con tu asesor.</p>' +

    (c.retencionesTerceros > 0
      ? '<p class="imp-nota aviso">Has retenido ' + escaparHtml(dineroVisible(c.retencionesTerceros)) +
        ' de IRPF a terceros este trimestre. Ese dinero se lo debes tú a Hacienda por otro modelo ' +
        '(111 o 115) y NO está incluido en la cifra de arriba. Consúltalo con tu asesor.</p>'
      : '') +

    impBloquePago('irpf', registro, pagado, c.irpf) +
  '</div>';
}

// Zona de "lo que ha pasado de verdad": importe real y fecha. El campo
// admite negativos a propósito (una devolución), así que NO lleva
// data-numero="1" — ese ayudante borra el signo menos mientras se
// escribe. Se limpia igual al guardar con parsearNumero().
//
// Desde el 25/09/2026, sin pagar, el campo viene ya relleno con la
// estimación (o con 0,01 si no hay nada que pagar), para no tener que
// escribirlo ni acordarse del 0,01. Con las cifras ocultas se deja
// vacío (así no enseña la cifra), y al marcar se usa la estimación.
function impBloquePago(tipo, registro, pagado, estimado) {
  const etiqueta = tipo === 'iva' ? 'IVA' : 'IRPF';
  const real = registro ? parsearNumero(registro[tipo + '_real']) : 0;
  const fecha = registro ? normalizarFecha(registro[tipo + '_fecha_pago']) : '';

  let valorCampo;
  if (pagado) valorCampo = cifrasOcultas ? '•••••' : (real ? impNumeroCampo(real) : '');
  else valorCampo = cifrasOcultas ? '' : impNumeroCampo(impImportePorDefecto(estimado));

  return '<div class="imp-pago">' +
    '<div class="imp-pago-campos">' +
      '<div class="imp-campo-grupo">' +
        '<label for="imp-real-' + tipo + '">Importe real de ' + etiqueta + '</label>' +
        '<input class="campo" type="text" inputmode="decimal" id="imp-real-' + tipo + '"' +
          ' value="' + escaparHtml(valorCampo) + '"' +
          (pagado ? ' disabled' : '') + ' placeholder="' + (cifrasOcultas ? '•••••' : '0,00') + '">' +
      '</div>' +
      '<div class="imp-campo-grupo">' +
        '<label for="imp-fecha-' + tipo + '">Fecha</label>' +
        '<input class="campo" type="date" id="imp-fecha-' + tipo + '"' +
          ' value="' + escaparHtml(fecha || fechaHoyISO()) + '"' +
          (pagado ? ' disabled' : '') + '>' +
      '</div>' +
    '</div>' +
    (pagado ? '' : '<p class="imp-nota imp-nota-pago">Viene con la estimación: cámbialo si tu asesor te da otra cifra. ' +
      'Si no hay nada que pagar, se guarda 0,01 €.</p>') +
    '<button type="button" class="' + (pagado ? 'boton-secundario' : 'boton-principal') + '" data-pago="' + tipo + '">' +
      (pagado ? 'Marcar como pendiente' : 'Marcar como pagado') +
    '</button>' +
    '<p class="imp-mensaje-error" data-error-de="' + tipo + '" hidden></p>' +
  '</div>';
}

// Importe que se propone al marcar como pagado: la estimación si hay
// algo que pagar; si no, 0,01 € (marcar con 0 daba fallos, ver diario
// 09/09/2026: el 0,01 es el valor que funciona).
function impImportePorDefecto(estimado) {
  const v = roundMoney(parsearNumero(estimado));
  return v > 0 ? v : 0.01;
}

// Número para un campo de texto, con coma y sin separador de miles
// (parsearNumero no entiende "1.234,56").
function impNumeroCampo(v) {
  return roundMoney(v).toFixed(2).replace('.', ',');
}

// Lee lo escrito en el campo de importe. Admite "1.234,56", "1234,56" y
// "1234.56". Devuelve null si está vacío y NaN si no es un número.
function impLeerImporte(texto) {
  let t = String(texto || '').trim().replace(/\s/g, '').replace('€', '');
  if (t === '') return null;
  if (t.indexOf(',') !== -1) t = t.replace(/\./g, '').replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(t)) return NaN;
  return roundMoney(parseFloat(t));
}

// Resumen del pago del trimestre (25/09/2026). Antes sumaba IVA e IRPF
// con signo, de modo que un IVA a tu favor "pagaba" el IRPF. No es así:
// son dos modelos distintos, y lo que sale a tu favor no se paga. Ahora
// cada impuesto cuenta a partir de 0, y si ya está pagado se enseña lo
// que se pagó de verdad.
function impTarjetaTotal(c, registro, adelantar) {
  const ivaPagado = impPagado(registro, 'iva');
  const irpfPagado = impPagado(registro, 'irpf');

  function linea(etiqueta, pagado, tipo, estimado) {
    if (pagado) {
      return '<div class="imp-linea"><span>' + etiqueta + ' · pagado</span><strong>' +
        escaparHtml(dineroVisible(parsearNumero(registro[tipo + '_real']))) + '</strong></div>';
    }
    return '<div class="imp-linea"><span>' + etiqueta + '</span><strong>' +
      escaparHtml(dineroVisible(impLoQueSePaga(estimado))) + '</strong></div>';
  }

  const pendiente = roundMoney((ivaPagado ? 0 : impLoQueSePaga(c.iva)) + (irpfPagado ? 0 : impLoQueSePaga(c.irpf)));
  const todoPagado = ivaPagado && irpfPagado;
  const algoPagado = ivaPagado || irpfPagado;

  let final;
  if (todoPagado) {
    const pagadoReal = roundMoney(parsearNumero(registro.iva_real) + parsearNumero(registro.irpf_real));
    final = '<div class="imp-total-final"><span>PAGADO</span><strong class="favor">' +
      escaparHtml(dineroVisible(pagadoReal)) + '</strong></div>';
  } else {
    final = '<div class="imp-total-final"><span>' + (algoPagado ? 'FALTA POR PAGAR' : 'TOTAL A PAGAR') + '</span><strong>' +
      escaparHtml(dineroVisible(pendiente)) + '</strong></div>';
  }

  // Lo que sale a tu favor no se paga: se explica en una línea.
  const aFavor = [];
  if (!ivaPagado && c.iva < 0) aFavor.push('el IVA (' + dineroVisible(Math.abs(c.iva)) + ')');
  if (!irpfPagado && c.irpf < 0) aFavor.push('el IRPF (' + dineroVisible(Math.abs(c.irpf)) + ')');
  const notaFavor = aFavor.length
    ? '<p class="imp-nota">Sale a tu favor ' + escaparHtml(aFavor.join(' y ')) +
      ': esa parte no se paga. Tu asesor la tendrá en cuenta en las próximas declaraciones.</p>'
    : '';

  // De este pago, la parte que viene de facturas que aún no has cobrado.
  const adelanto = roundMoney((ivaPagado ? 0 : adelantar.iva) + (irpfPagado ? 0 : adelantar.irpf));
  const notaAdelanto = (!todoPagado && adelanto > 0)
    ? '<p class="imp-nota aviso">De este pago, ' + escaparHtml(dineroVisible(adelanto)) +
      ' son de facturas que todavía no has cobrado: los adelantas tú.</p>'
    : '';

  return '<div class="imp-tarjeta imp-tarjeta-total">' +
    '<p class="imp-tarjeta-titulo">Pago del trimestre</p>' +
    linea('IVA (modelo 303)', ivaPagado, 'iva', c.iva) +
    linea('IRPF (modelo 130)', irpfPagado, 'irpf', c.irpf) +
    final +
    notaFavor +
    notaAdelanto +
  '</div>';
}

// Facturas sin cobrar (25/09/2026): sustituye al bloque "Impuestos a
// adelantar". No depende del trimestre elegido: es lo que te deben hoy.
function impTarjetaSinCobrar(s) {
  if (s.num === 0) {
    return '<div class="imp-tarjeta">' +
      '<p class="imp-tarjeta-titulo">Facturas sin cobrar</p>' +
      '<p class="imp-nota">No tienes facturas pendientes de cobro.</p>' +
    '</div>';
  }

  const filas = s.lista.map(function (x) {
    const f = x.factura;
    const nombre = typeof fvNombreMostrado === 'function' ? fvNombreMostrado(f) : String(f.cliente || '');
    const hace = x.dias === 0 ? 'hoy' : (x.dias === 1 ? 'hace 1 día' : 'hace ' + x.dias + ' días');
    return '<button type="button" class="imp-sincobrar-fila" data-factura="' + escaparHtml(f.id) + '">' +
      '<span class="imp-sincobrar-texto">' +
        '<span class="imp-sincobrar-nombre">' + escaparHtml(nombre || '—') + '</span>' +
        '<span class="imp-sincobrar-meta">' + escaparHtml((f.numero || '—') + ' · ' + hace) + '</span>' +
      '</span>' +
      '<strong>' + escaparHtml(dineroVisible(parsearNumero(f.total))) + '</strong>' +
    '</button>';
  }).join('');

  return '<div class="imp-tarjeta">' +
    '<p class="imp-tarjeta-titulo">Facturas sin cobrar</p>' +
    '<p class="imp-nota imp-nota-arriba">Lo que te deben y, de eso, los impuestos que pagas a Hacienda antes de cobrarlo.</p>' +

    '<div class="imp-linea destacada"><span>Te deben (' + s.num + ' factura' + (s.num === 1 ? '' : 's') + ')</span><strong>' +
      escaparHtml(dineroVisible(s.total)) + '</strong></div>' +
    '<div class="imp-linea"><span>Impuestos ya adelantados a Hacienda</span><strong>' +
      escaparHtml(dineroVisible(s.yaAdelantado)) + '</strong></div>' +
    '<div class="imp-linea"><span>A adelantar en el próximo pago (' + escaparHtml(s.proximo.trimestre) + ')</span><strong>' +
      escaparHtml(dineroVisible(s.enProximo)) + '</strong></div>' +
    (s.masAdelante > 0
      ? '<div class="imp-linea"><span>A adelantar en pagos siguientes</span><strong>' +
        escaparHtml(dineroVisible(s.masAdelante)) + '</strong></div>'
      : '') +

    '<div class="imp-sincobrar-lista">' + filas + '</div>' +
  '</div>';
}

function impCablearDetalle(zona) {
  zona.querySelectorAll('[data-pago]').forEach(function (b) {
    b.addEventListener('click', function () { impAlternarPago(b.dataset.pago); });
  });
  // Tocar una factura sin cobrar abre su ficha encima (igual que "Ver
  // factura" en Contabilidad).
  zona.querySelectorAll('[data-factura]').forEach(function (b) {
    b.addEventListener('click', function () {
      if (typeof abrirFichaFacturaVenta === 'function') abrirFichaFacturaVenta(b.dataset.factura);
    });
  });
}

// ============================================================
// 7. NAVEGACIÓN A UN PERIODO
// ============================================================
// El histórico de trimestres se movió a la pestaña Informes
// (decisión 05/09/2026): aquí solo se muestra el trimestre elegido.
// Se conserva `impIrAlPeriodoDe` porque la usa Contabilidad, desde el
// botón "Ver en Impuestos" de un apunte de pago de impuestos.

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
// 9. MARCAR COMO PAGADO 🔒 (mapa 12.7, corregido por I10)
// ============================================================
// Una sola escritura en la hoja de impuestos: el id del apunte de
// tesorería lo genera esta pantalla, así que ya se conoce y se guarda
// dentro del registro fiscal desde el principio.

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
    id_contacto: '',
    contacto_libre: ''
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

    // Deshacer un pago borra su apunte de tesorería: acción delicada,
    // pide el PIN, igual que deshacer el cobro de una factura (23/09/2026).
    if (!await confirmarConPin('Vas a marcar como PENDIENTE el ' + etiqueta + ' de ' + trimestre + ' ' + anio +
      '. Se borrará su apunte de tesorería.')) return;

    const idApunte = registro['id_apunte_' + tipo];

    registro[tipo + '_estado'] = 'pendiente';
    registro[tipo + '_fecha_pago'] = '';
    registro['id_apunte_' + tipo] = '';

    // El registro fiscal y el borrado del apunte van a la vez. Si algo
    // falla, queda en rojo y se reenvía solo al sincronizar.
    await Promise.all([
      guardarRegistro('impuestos', registro, impRepintarDetalle, null),
      idApunte ? borrarRegistro('apuntes', idApunte, null, null) : Promise.resolve(null)
    ]);
    impRepintarDetalle();
    return;
  }

  // --- Pasar a PAGADO ---
  const campoImporte = document.getElementById('imp-real-' + tipo);
  const campoFecha = document.getElementById('imp-fecha-' + tipo);
  const fecha = normalizarFecha(campoFecha ? campoFecha.value : '') || fechaHoyISO();

  // Las estimaciones vigentes quedan congeladas en el registro
  // (mapa 12.7, punto 4).
  const c = impCalcular(anio, trimestre);

  // Importe (25/09/2026): vacío → la estimación (o 0,01 si no hay nada
  // que pagar); 0 → 0,01, porque marcar con 0 daba fallos (diario
  // 09/09/2026). Puede ser negativo si Hacienda te devuelve.
  let importe = impLeerImporte(campoImporte ? campoImporte.value : '');
  if (importe === null) importe = impImportePorDefecto(c[tipo]);
  if (isNaN(importe)) {
    impMostrarError(tipo, 'Escribe el importe con números, por ejemplo 220,55.');
    return;
  }
  if (importe === 0) importe = 0.01;
  const idApunte = registro['id_apunte_' + tipo] || impNuevoIdApunte();
  const apunte = impConstruirApunte(tipo, importe, fecha, registro.id, anio, trimestre, idApunte);

  registro.iva_estimado = c.iva;
  registro.irpf_estimado = c.irpf;
  registro[tipo + '_real'] = importe;
  registro[tipo + '_estado'] = 'pagado';
  registro[tipo + '_fecha_pago'] = fecha;
  registro['id_apunte_' + tipo] = apunte.id;

  // El apunte y el registro fiscal se guardan a la vez: el id del apunte
  // lo genera esta pantalla, así que ya se conoce y el registro se
  // escribe una sola vez (decisión I10). Si alguno falla, queda en rojo
  // y se reenvía solo al sincronizar; ya no se deshace el otro, porque
  // el núcleo conserva los dos hasta que Google los confirme.
  await Promise.all([
    guardarRegistro('apuntes', apunte, null, null),
    guardarRegistro('impuestos', registro, impRepintarDetalle, null)
  ]);
  impRepintarDetalle();
}

// ============================================================
// 10. RED DE SEGURIDAD (reconciliador)
// ============================================================
// Si un trimestre quedó marcado como pagado pero su apunte de
// tesorería no llegó a escribirse, se vuelve a crear en la siguiente
// sincronización. Mismo mecanismo que usan las facturas.

async function impReconciliarApuntesPago() {
  for (const r of estado.impuestos) {
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
