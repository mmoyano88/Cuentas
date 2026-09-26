/**
 * REVISIÓN DE DATOS (26/09/2026)
 * ------------------------------------------------------------
 * Bloque al final de Impuestos → Informes. Busca cosas raras en los
 * datos y AVISA; nunca corrige nada por su cuenta ni escribe en
 * Sheets. Cada arreglo lo haces tú, a mano, como siempre.
 *
 * Qué revisa:
 *   1. Numeración de las facturas de venta del año elegido: números
 *      que faltan (huecos) y números repetidos entre facturas activas.
 *   2. Facturas de compra repetidas: mismo proveedor y mismo número.
 *   3. Clientes de facturas de venta del año sin NIF o sin dirección.
 *   4. Facturas (venta o compra) con base imponible negativa.
 *   5. Facturas (venta o compra) con fecha posterior a hoy.
 *   6. Presupuestos aceptados que todavía no tienen factura.
 *
 * Se carga después de mod-informes.js; Informes lo pinta si existe.
 */

function revTexto(v) {
  return String(v === null || v === undefined ? '' : v).trim();
}

function revNombreContacto(id, nombreDoc) {
  const c = estado.clientes.find(function (x) { return String(x.id) === String(id); });
  return (c && (revTexto(c.nombre_contacto) || revTexto(c.nombre_fiscal))) || revTexto(nombreDoc) || 'Sin contacto';
}

// ---- 1. Numeración de ventas ----
function revNumeracion(anio) {
  const avisos = [];
  const patron = new RegExp('^' + FV_PREFIJO_SERIE + anio + '\\/(\\d{4})$');
  const activas = {};
  const inactivas = {};
  let mayor = 0;
  estado.ventas.forEach(function (f) {
    const m = revTexto(f.numero).match(patron);
    if (!m) return;
    const n = parseInt(m[1], 10);
    if (fvEstaActiva(f)) {
      activas[n] = (activas[n] || 0) + 1;
      mayor = Math.max(mayor, n);
    } else {
      inactivas[n] = true;
    }
  });
  const numero = function (n) { return FV_PREFIJO_SERIE + anio + '/' + String(n).padStart(4, '0'); };
  for (let n = 1; n <= mayor; n++) {
    if (!activas[n]) {
      avisos.push('Falta el número ' + numero(n) + ' en las facturas de venta' +
        (inactivas[n] ? ' (lo tiene una factura desactivada).' : '.'));
    } else if (activas[n] > 1) {
      avisos.push('El número ' + numero(n) + ' está repetido en ' + activas[n] + ' facturas de venta activas.');
    }
  }
  return avisos;
}

// ---- 2. Compras repetidas ----
function revComprasRepetidas() {
  const grupos = {};
  estado.compras.forEach(function (f) {
    if (!fcEstaActiva(f)) return;
    const num = revTexto(f.numero).toUpperCase().replace(/\s+/g, '');
    if (!num) return;
    const clave = revTexto(f.id_proveedor || f.proveedor).toUpperCase() + '|' + num;
    (grupos[clave] = grupos[clave] || []).push(f);
  });
  return Object.keys(grupos).filter(function (k) { return grupos[k].length > 1; }).map(function (k) {
    const f = grupos[k][0];
    return 'La factura de compra ' + revTexto(f.numero) + ' de ' + revNombreContacto(f.id_proveedor, f.proveedor) +
      ' está registrada ' + grupos[k].length + ' veces.';
  });
}

// ---- 3. Clientes sin NIF o sin dirección ----
function revClientesIncompletos(anio) {
  const porCliente = {};
  estado.ventas.forEach(function (f) {
    if (!fvEstaActiva(f)) return;
    if (!revTexto(normalizarFecha(f.fecha)).startsWith(String(anio))) return;
    const c = estado.clientes.find(function (x) { return String(x.id) === String(f.id_cliente); });
    const sinNif = !revTexto(f.nif) && !revTexto(c && c.nif);
    const sinDireccion = !c || (!revTexto(c.calle) && !revTexto(c.poblacion));
    if (!sinNif && !sinDireccion) return;
    const clave = String(f.id_cliente || f.cliente);
    const g = porCliente[clave] || (porCliente[clave] = {
      nombre: revNombreContacto(f.id_cliente, f.cliente), sinNif: sinNif, sinDireccion: sinDireccion, facturas: 0
    });
    g.facturas += 1;
  });
  return Object.keys(porCliente).map(function (k) {
    const g = porCliente[k];
    const falta = [g.sinNif ? 'el NIF' : '', g.sinDireccion ? 'la dirección' : ''].filter(Boolean).join(' y ');
    return 'A ' + g.nombre + ' le falta ' + falta + ' (' + g.facturas +
      (g.facturas === 1 ? ' factura' : ' facturas') + ' de ' + anio + ').';
  });
}

// ---- 4. Base negativa ----
function revBasesNegativas() {
  const avisos = [];
  estado.ventas.forEach(function (f) {
    if (fvEstaActiva(f) && parsearNumero(f.base) < 0) {
      avisos.push('La factura de venta ' + (revTexto(f.numero) || '—') + ' tiene la base en negativo (¿descuento mayor que el importe?).');
    }
  });
  estado.compras.forEach(function (f) {
    if (fcEstaActiva(f) && parsearNumero(f.base) < 0) {
      avisos.push('La factura de compra ' + (revTexto(f.numero) || '—') + ' de ' +
        revNombreContacto(f.id_proveedor, f.proveedor) + ' tiene la base en negativo.');
    }
  });
  return avisos;
}

// ---- 5. Fecha futura ----
function revFechasFuturas() {
  const hoy = fechaHoyISO();
  const avisos = [];
  estado.ventas.forEach(function (f) {
    const fecha = normalizarFecha(f.fecha);
    if (fvEstaActiva(f) && fecha && fecha > hoy) {
      avisos.push('La factura de venta ' + (revTexto(f.numero) || '—') + ' tiene fecha futura (' + mostrarFecha(fecha) + ').');
    }
  });
  estado.compras.forEach(function (f) {
    const fecha = normalizarFecha(f.fecha);
    if (fcEstaActiva(f) && fecha && fecha > hoy) {
      avisos.push('La factura de compra ' + (revTexto(f.numero) || '—') + ' de ' +
        revNombreContacto(f.id_proveedor, f.proveedor) + ' tiene fecha futura (' + mostrarFecha(fecha) + ').');
    }
  });
  return avisos;
}

// ---- 6. Presupuestos aceptados sin factura ----
function revPresupuestosSinFacturar() {
  return estado.presupuestos.filter(function (p) {
    return String(p.estado) === 'aceptado' && !preTieneFactura(p.id);
  }).map(function (p) {
    return 'El presupuesto ' + (revTexto(p.numero) || '—') + ' de ' + revNombreContacto(p.id_cliente, p.cliente) +
      ' está aceptado y todavía no tiene factura.';
  });
}

function revGrupos(anio) {
  // Cada comprobación va protegida: si una falla por un dato raro,
  // las demás se siguen mostrando.
  const seguro = function (fn) {
    try { return fn(); } catch (err) { console.error('Revisión de datos:', err); return []; }
  };
  return [
    { titulo: 'Numeración de facturas de ' + anio, avisos: seguro(function () { return revNumeracion(anio); }) },
    { titulo: 'Facturas de compra repetidas', avisos: seguro(revComprasRepetidas) },
    { titulo: 'Clientes con datos incompletos', avisos: seguro(function () { return revClientesIncompletos(anio); }) },
    { titulo: 'Bases en negativo', avisos: seguro(revBasesNegativas) },
    { titulo: 'Fechas futuras', avisos: seguro(revFechasFuturas) },
    { titulo: 'Presupuestos aceptados sin facturar', avisos: seguro(revPresupuestosSinFacturar) }
  ];
}

function revHtml(anio) {
  const grupos = revGrupos(anio).filter(function (g) { return g.avisos.length > 0; });
  return '<div class="inf-bloque">' +
    '<p class="inf-descarga-titulo">Revisión de datos</p>' +
    '<p class="inf-bloque-nota">Solo avisa: no cambia nada. Los arreglos se hacen a mano en cada sección.</p>' +
    (grupos.length === 0
      ? '<p class="rev-ok"><i class="ti ti-circle-check" aria-hidden="true"></i> Todo en orden.</p>'
      : grupos.map(function (g) {
          return '<p class="inf-347-subtitulo">' + escaparHtml(g.titulo) + '</p>' +
            '<ul class="rev-lista">' + g.avisos.map(function (a) {
              return '<li><i class="ti ti-alert-triangle" aria-hidden="true"></i><span>' + escaparHtml(a) + '</span></li>';
            }).join('') + '</ul>';
        }).join('')) +
  '</div>';
}
