/**
 * MÓDULO PDF DE DOCUMENTOS (Presupuesto y Factura de venta)
 * ------------------------------------------------------------
 * Genera el PDF de cliente para Presupuestos y Facturas de venta.
 * Compartido entre los dos módulos porque el diseño es casi idéntico
 * (mapa 15.1-15.6): mismo layout, cabecera y bloque de totales; solo
 * cambian el color de acento, cómo se obtienen las líneas de detalle,
 * y qué texto de pie se usa. Las facturas de compra NO generan PDF
 * (mapa 15.2), y eso no cambia.
 *
 * MECANISMO — igual que la app original, sin ninguna librería de PDF:
 * se abre una ventana nueva, se escribe un documento HTML con estilos
 * de impresión A4, y el propio navegador lo convierte a PDF al
 * imprimir. Si el navegador bloquea la ventana emergente, se avisa.
 *
 * TRES DIFERENCIAS REALES entre los dos documentos, verificadas contra
 * el HTML de la app original — todo lo demás es idéntico:
 *   1. Color de acento: presupuesto azul oscuro (#24364f),
 *      factura roja (#c93b3b).
 *   2. Líneas: la factura usa las líneas reales guardadas si existen
 *      (`ventas_detalle`); el presupuesto SIEMPRE es una sola línea
 *      con el concepto y el importe — nunca desglosa la calculadora.
 *   3. Observaciones: cada uno lee su propio texto de pie configurado
 *      (`texto_pie_presupuesto` / `texto_pie_factura`).
 *
 * TRES FALLOS DEL ORIGINAL, corregidos aquí (los dos primeros ya
 * señalados en el mapa, el tercero detectado al verificar el PDF real
 * contra el HTML original):
 *   - Nombre por defecto escrito a fuego si el campo está vacío
 *     ("Miguel Ángel Moyano Murillo"). Aquí, si no está relleno en
 *     Configuración, sale en blanco. No se inventa ningún dato.
 *   - Tabla de líneas fijada a 5 filas (con relleno de filas vacías y
 *     corte silencioso a partir de la sexta). Aquí crece lo que haga
 *     falta, sin límite ni relleno.
 *   - La marca grande de cabecera ("MIGUEL MOYANO") estaba también
 *     escrita a fuego, literal en el código — y el nombre completo se
 *     repetía justo debajo, en los datos del vendedor, dando la
 *     impresión de un error de maquetación. Aquí la marca grande usa
 *     el mismo `fiscal_nombre` de Configuración (sin inventar una
 *     versión corta que no existe como dato), y ya no se repite
 *     debajo: los datos del vendedor muestran solo NIF, dirección,
 *     teléfono y email — el nombre ya está arriba, en grande.
 *
 * "Forma de pago: Transferencia" (escrito a fuego en toda factura en
 * el original) DESAPARECE por completo — decisión del propietario,
 * 06/09/2026: si quiere mostrar la forma de pago, la escribe él mismo
 * en el texto de observaciones de Configuración.
 *
 * La imagen de cabecera (antes un hueco sin resolver, marcado como
 * "IMAGEN DE CABECERA" en el HTML original) se lee de
 * `pdf_imagen_cabecera` en Configuración → Datos Fiscales, donde el
 * propietario la sube una vez como cualquier otro campo.
 */

// ============================================================
// 1. DATOS DEL EMISOR Y DEL CLIENTE
// ============================================================

function pdfDocTexto(v) {
  return String(v === null || v === undefined ? '' : v).trim();
}

// Sin valor por defecto escrito a fuego (corrige mapa 15.3): si el
// campo está vacío en Configuración, sale vacío en el PDF.
function pdfDocDatosEmisor() {
  const calle = [pdfDocTexto(cfgTexto('fiscal_calle')), pdfDocTexto(cfgTexto('fiscal_numero'))].filter(Boolean).join(' ');
  const poblacion = [pdfDocTexto(cfgTexto('fiscal_codigo_postal')), pdfDocTexto(cfgTexto('fiscal_poblacion'))].filter(Boolean).join(' ');
  const direccion = [calle, poblacion].filter(Boolean).join(' · ') +
    (poblacion && pdfDocTexto(cfgTexto('fiscal_provincia')) ? ', ' + pdfDocTexto(cfgTexto('fiscal_provincia')) : '');

  return {
    nombre: pdfDocTexto(cfgTexto('fiscal_nombre')),
    nif: pdfDocTexto(cfgTexto('fiscal_nif')),
    direccion: direccion,
    telefono: pdfDocTexto(cfgTexto('perfil_telefono')),
    email: pdfDocTexto(cfgTexto('perfil_email')),
    imagenCabecera: pdfDocTexto(cfgTexto('pdf_imagen_cabecera'))
  };
}

function pdfDocDireccionContacto(contacto) {
  if (!contacto) return '';
  const calle = [pdfDocTexto(contacto.calle), pdfDocTexto(contacto.numero)].filter(Boolean).join(' ');
  const poblacion = [pdfDocTexto(contacto.codigo_postal), pdfDocTexto(contacto.poblacion)].filter(Boolean).join(' ');
  const primera = [calle, poblacion].filter(Boolean).join(' · ');
  return contacto.provincia ? primera + (primera ? ', ' : '') + pdfDocTexto(contacto.provincia) : primera;
}

// ============================================================
// 2. OBSERVACIONES (texto enriquecido de Configuración)
// ============================================================
// El texto ya se guarda saneado desde Configuración (solo
// b/strong/i/em/u/br/p/div/ul/ol/li/span, sin atributos peligrosos),
// así que aquí se usa tal cual, sin volver a limpiarlo.

function pdfDocObservaciones(clave) {
  const html = pdfDocTexto(cfgTexto(clave));
  return html || '<span class="muted">Sin observaciones.</span>';
}

// ============================================================
// 3. LÍNEAS DEL DOCUMENTO
// ============================================================

// Factura: usa las líneas reales de ventas_detalle si existen.
// Si no hay ninguna, una sola línea con el concepto y la base.
function pdfDocLineasFactura(f) {
  const lineas = fvLineasDe(f.id);
  if (lineas.length) {
    return lineas.map(function (l) {
      return {
        descripcion: pdfDocTexto(l.descripcion) || pdfDocTexto(f.concepto) || 'Servicio',
        importe: parsearNumero(l.importe)
      };
    });
  }
  return [{
    descripcion: pdfDocTexto(f.concepto) || 'Servicio',
    importe: parsearNumero(f.subtotal ?? f.base)
  }];
}

// Presupuesto: SIEMPRE una sola línea con el concepto y el subtotal.
// Nunca desglosa la calculadora (mapa 15.4, sin cambios).
function pdfDocLineasPresupuesto(p) {
  return [{
    descripcion: pdfDocTexto(p.concepto) || 'Servicio',
    importe: parsearNumero(p.subtotal ?? p.base)
  }];
}

// Tabla de altura VARIABLE (corrige mapa 15.4): antes se fijaban 5
// filas exactas, rellenando con filas vacías si sobraban y cortando
// en silencio a partir de la sexta línea si faltaban. Aquí se pintan
// solo las filas que hay, cuantas sean.
function pdfDocFilasHtml(lineas) {
  return lineas.map(function (l) {
    return '<div class="detail-row">' +
      '<div class="detail-desc">' + escaparHtml(l.descripcion) + '</div>' +
      '<div class="detail-amount">' + escaparHtml(formatMoney(l.importe)) + '</div>' +
    '</div>';
  }).join('');
}

// ============================================================
// 4. BLOQUE DE TOTALES
// ============================================================
// Base imponible · Descuento (solo si > 0) · IVA (con %) ·
// Retención IRPF (solo si > 0, con %) · TOTAL. Igual que mapa 15.5.

function pdfDocFilasTotales(registro) {
  const descuento = parsearNumero(registro.descuento_especial_importe);
  const irpf = parsearNumero(registro.irpf);

  return '<div class="summary-row"><span>Base imponible</span><span>' + escaparHtml(formatMoney(registro.base)) + '</span></div>' +
    (descuento > 0
      ? '<div class="summary-row"><span>Descuento</span><span>−' + escaparHtml(formatMoney(descuento)) + '</span></div>'
      : '') +
    '<div class="summary-row"><span>IVA (' + parsearNumero(registro.iva_pct) + '%)</span><span>' + escaparHtml(formatMoney(registro.iva)) + '</span></div>' +
    (irpf > 0
      ? '<div class="summary-row"><span>Retención IRPF (' + parsearNumero(registro.irpf_pct) + '%)</span><span>−' + escaparHtml(formatMoney(irpf)) + '</span></div>'
      : '') +
    '<div class="summary-separator"></div>' +
    '<div class="summary-total"><span>TOTAL</span><span>' + escaparHtml(formatMoney(registro.total)) + '</span></div>';
}

// ============================================================
// 5. CONSTRUCCIÓN DEL DOCUMENTO
// ============================================================

// tipo: 'presupuesto' | 'factura'
function pdfDocConstruir(registro, contacto, tipo) {
  const esFactura = tipo === 'factura';
  const acento = esFactura ? '#c93b3b' : '#24364f';
  const titulo = esFactura ? 'FACTURA' : 'PRESUPUESTO';
  const emisor = pdfDocDatosEmisor();

  const lineas = esFactura ? pdfDocLineasFactura(registro) : pdfDocLineasPresupuesto(registro);
  const observaciones = pdfDocObservaciones(esFactura ? 'texto_pie_factura' : 'texto_pie_presupuesto');

  const nombreCliente = pdfDocTexto(registro.cliente) || pdfDocTexto(contacto && (contacto.nombre_fiscal || contacto.nombre_contacto)) || 'Cliente';
  const nifCliente = pdfDocTexto(registro.nif) || pdfDocTexto(contacto && contacto.nif);
  const direccionCliente = pdfDocDireccionContacto(contacto);

  const lineaContactoEmisor2 = [emisor.nif, emisor.direccion].filter(Boolean).join(' · ');
  const lineaContactoEmisor3 = [emisor.telefono, emisor.email].filter(Boolean).join(' · ');

  const numeroDoc = pdfDocTexto(registro.numero);
  const fileTitle = (esFactura ? 'Fra.' : 'Ptto.') + ' ' + numeroDoc + ' - ' + nombreCliente;

  return '<!doctype html><html lang="es"><head><meta charset="utf-8">' +
    '<title>' + escaparHtml(fileTitle) + '</title>' +
    '<link rel="preconnect" href="https://fonts.googleapis.com">' +
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
    '<link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Inter:wght@400;500;700;800;900&display=swap" rel="stylesheet">' +
    '<style>' + pdfDocCss(acento) + '</style>' +
    '</head><body>' +
    '<div class="page">' +
      (emisor.imagenCabecera
        ? '<div class="header"><img src="' + escaparHtml(emisor.imagenCabecera) + '" alt=""></div>'
        : '<div class="header header-vacio"></div>') +
      '<div class="content">' +
        '<div class="red-line"></div>' +
        '<div class="brand">' + escaparHtml(emisor.nombre) + '</div>' +
        '<div class="doc-title">' + titulo + '</div>' +
        (emisor.nombre ? '<div class="subtitle"></div>' : '') +
        '<div class="seller-data">' +
          (lineaContactoEmisor2 ? '<div>' + escaparHtml(lineaContactoEmisor2) + '</div>' : '') +
          (lineaContactoEmisor3 ? '<div>' + escaparHtml(lineaContactoEmisor3) + '</div>' : '') +
        '</div>' +
        '<div class="doc-data">' +
          '<div class="doc-number">' + escaparHtml(numeroDoc) + '</div>' +
          '<div>Fecha: ' + escaparHtml(mostrarFecha(registro.fecha)) + '</div>' +
        '</div>' +
        '<div class="client-box">' +
          '<div class="client-inner">' +
            '<div class="client-label">Cliente</div>' +
            '<div class="client-name">' + escaparHtml(nombreCliente) + '</div>' +
            (nifCliente ? '<div>' + escaparHtml(nifCliente) + '</div>' : '') +
            (direccionCliente ? '<div>' + escaparHtml(direccionCliente) + '</div>' : '') +
          '</div>' +
        '</div>' +
        '<div class="concept">' + escaparHtml(pdfDocTexto(registro.concepto) || 'Servicio') + '</div>' +
        '<div class="desc-wrap">' +
          '<div class="desc-head"><div>Descripción</div><div>Importe</div></div>' +
          '<div class="desc-body">' + pdfDocFilasHtml(lineas) + '</div>' +
        '</div>' +
        '<div class="summary-box">' + pdfDocFilasTotales(registro) + '</div>' +
        '<div class="observations">' +
          '<div class="observations-title">OBSERVACIONES</div>' +
          '<div class="observations-body">' + observaciones + '</div>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<script>window.addEventListener("load",function(){setTimeout(function(){window.print();},250);});<\/script>' +
    '</body></html>';
}

// ============================================================
// 6. HOJA DE ESTILOS DEL DOCUMENTO
// ============================================================
// Mismo layout absoluto en porcentajes que la app original, para que
// la posición de cada bloque quede fija en A4 sea cual sea el
// contenido. La tabla de líneas es la única zona de altura variable
// (corrige mapa 15.4): el resto de bloques por debajo se desplaza con
// margen normal en vez de posición absoluta fija a un porcentaje.

function pdfDocCss(acento) {
  return '' +
  '@page{size:A4 portrait;margin:0}' +
  '*{box-sizing:border-box}' +
  'html,body{margin:0;padding:0;width:210mm;background:#ffffff}' +
  'body{font-family:"Inter",Arial,sans-serif;color:#172033;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
  '.page{position:relative;width:210mm;min-height:297mm;background:#ffffff}' +

  // Cabecera: franja panorámica de la imagen subida en Configuración.
  // Ratio recomendado 1240×260 (≈4,77), mismo que el 13% de alto de
  // una A4 a lo ancho: se ve igual de encuadrada que en el original.
  '.header{width:100%;height:13%;overflow:hidden;background:#e8e8e4}' +
  '.header img{width:100%;height:100%;display:block;object-fit:cover}' +
  '.header-vacio{background:#f2f2ee}' +

  '.content{position:relative;padding:0 8% 12mm}' +
  '.red-line{width:16.2%;height:1.1mm;background:' + acento + ';margin-top:5mm}' +

  '.brand{display:inline-block;font-family:"Archivo Black","Arial Black",sans-serif;font-size:22pt;line-height:1;color:#172033;white-space:nowrap;margin-top:2.5mm}' +
  '.doc-title{position:absolute;right:8%;top:8.8mm;font-family:"Archivo Black","Arial Black",sans-serif;font-size:22pt;line-height:1;color:' + acento + ';white-space:nowrap}' +
  '.subtitle{height:0}' +

  '.seller-data{margin-top:2mm;font-size:9.7pt;line-height:1.3;font-weight:400}' +
  '.seller-data div:first-child{font-weight:500}' +

  '.doc-data{position:absolute;right:8%;top:23mm;text-align:right;font-size:9.3pt;line-height:1.4}' +
  '.doc-number{font-size:11pt;font-weight:800}' +

  '.client-box{margin-top:8mm;background:#eef1f4;border-radius:4mm;padding:4mm 4.5%}' +
  '.client-inner{font-size:9.4pt;line-height:1.35}' +
  '.client-label{font-family:"Archivo Black","Arial Black",sans-serif;font-size:12.2pt;line-height:1;color:' + acento + ';margin-bottom:2mm}' +
  '.client-name{font-weight:800}' +

  '.concept{margin-top:7mm;font-size:10.8pt;line-height:1.2;font-weight:900}' +

  // La única zona de altura variable: crece lo que haga falta según
  // el número de líneas, sin límite ni relleno (corrige mapa 15.4).
  '.desc-wrap{margin-top:3mm}' +
  '.desc-head{background:#172033;border-radius:1.5mm 1.5mm 0 0;display:grid;grid-template-columns:75% 25%;align-items:center;color:#fff;font-size:9.1pt;font-weight:800;padding:3mm 3%}' +
  '.desc-head div:last-child{text-align:right}' +
  '.detail-row{display:grid;grid-template-columns:75% 25%;align-items:center;font-size:8.9pt;line-height:1.3;padding:2.8mm 3%;border-bottom:.25mm solid #e5e7eb}' +
  '.detail-amount{text-align:right;white-space:nowrap}' +

  '.summary-box{margin-top:6mm;margin-left:50%;background:#eef1f4;border-radius:4mm;padding:4mm 4%}' +
  '.summary-row{display:flex;justify-content:space-between;align-items:center;font-size:8.9pt;line-height:1.3;margin:1mm 0}' +
  '.summary-row span:last-child{text-align:right;white-space:nowrap}' +
  '.summary-separator{height:.35mm;background:#172033;margin:2mm 0}' +
  '.summary-total{display:flex;justify-content:space-between;align-items:center;color:' + acento + ';font-weight:800;font-size:11pt;line-height:1}' +
  '.summary-total span:last-child{font-family:"Inter",Arial,sans-serif;font-size:14pt;font-weight:900;white-space:nowrap}' +

  '.observations{margin-top:8mm}' +
  '.observations-title{font-family:"Archivo Black","Arial Black",sans-serif;color:' + acento + ';font-size:12.2pt;line-height:1;margin-bottom:3mm}' +
  '.observations-body{font-size:9pt;line-height:1.3}' +
  '.observations-body p{margin:0 0 2.5mm}' +
  '.observations-body ul,.observations-body ol{margin:0 0 2.5mm;padding-left:5mm}' +
  '.observations-body strong,.observations-body b{font-weight:800}' +
  '.observations-body em,.observations-body i{font-style:italic}' +
  '.observations-body u{text-decoration:underline}' +
  '.muted{color:#64748b}' +

  // Que una fila de tabla o un párrafo de observaciones no se parta
  // por la mitad si el documento acaba ocupando más de una hoja
  // (líneas muy largas o muchas líneas): paginación natural, igual
  // que ya se decidió para los informes de Impuestos.
  '.detail-row,.observations-body p,.observations-body li{break-inside:avoid}';
}

// ============================================================
// 7. APERTURA DE LA VENTANA DE IMPRESIÓN
// ============================================================

function pdfDocAbrir(registro, contacto, tipo) {
  const ventana = window.open('', '_blank');
  if (!ventana) {
    alert('El navegador ha bloqueado la ventana del PDF.\n\nPermite las ventanas emergentes para esta página y vuelve a intentarlo.');
    return;
  }
  ventana.document.open();
  ventana.document.write(pdfDocConstruir(registro, contacto, tipo));
  ventana.document.close();
  ventana.focus();
}

// Puntos de entrada usados desde mod-presupuestos.js y
// mod-facturas-venta.js, sustituyendo a los antiguos
// preBotonDePrueba('Descargar PDF') / fvBotonDePrueba('Descargar PDF').
function pdfDocAbrirPresupuesto(id) {
  const p = estado.presupuestos.find(function (x) { return String(x.id) === String(id); });
  if (!p) { alert('No se ha encontrado el presupuesto.'); return; }
  pdfDocAbrir(p, preClienteDe(p), 'presupuesto');
}

function pdfDocAbrirFactura(id) {
  const f = estado.ventas.find(function (x) { return String(x.id) === String(id); });
  if (!f) { alert('No se ha encontrado la factura.'); return; }
  pdfDocAbrir(f, fvClienteDe(f), 'factura');
}
