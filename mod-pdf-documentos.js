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
// Lleva Cant. y Precio además de Descripción e Importe (mapa 15.4,
// confirmado contra el HTML original): la cantidad es siempre 1 y el
// precio unitario coincide con el importe, porque no existe un campo
// real de cantidad/precio unitario en los datos — es la misma
// convención que ya usaba la app original.
function pdfDocLineasFactura(f) {
  const lineas = fvLineasDe(f.id);
  if (lineas.length) {
    return lineas.map(function (l) {
      return {
        descripcion: pdfDocTexto(l.descripcion) || pdfDocTexto(f.concepto) || 'Servicio',
        cantidad: 1,
        precio: parsearNumero(l.importe),
        importe: parsearNumero(l.importe)
      };
    });
  }
  const importe = parsearNumero(f.subtotal ?? f.base);
  return [{
    descripcion: pdfDocTexto(f.concepto) || 'Servicio',
    cantidad: 1,
    precio: importe,
    importe: importe
  }];
}

// Presupuesto: el importe va siempre en una sola fila (nunca desglosa
// la calculadora, mapa 15.4), pero la DESCRIPCIÓN puede ocupar varias
// líneas: se escribe en el campo `descripcion` del presupuesto, una
// línea por punto, y se respetan los saltos tal cual (columna nueva
// añadida por el propietario el 06/09/2026). Si ese campo está vacío
// —presupuestos antiguos, anteriores a la columna— se usa el concepto,
// como se venía haciendo.
function pdfDocLineasPresupuesto(p) {
  const descripcion = pdfDocTexto(p.descripcion) || pdfDocTexto(p.concepto) || 'Servicio';
  return [{
    descripcion: descripcion,
    importe: parsearNumero(p.subtotal ?? p.base)
  }];
}

// Tabla de altura VARIABLE (corrige mapa 15.4): antes se fijaban 5
// filas exactas, rellenando con filas vacías si sobraban y cortando
// en silencio a partir de la sexta línea si faltaban. Aquí se pintan
// solo las filas que hay, cuantas sean.
//
// Factura: 4 columnas (Descripción · Cant. · Precio · Importe).
// Presupuesto: 2 columnas (Descripción · Importe) — nunca lleva
// cantidad ni precio unitario, confirmado contra el original.
function pdfDocFilasHtml(lineas, esFactura) {
  return lineas.map(function (l) {
    return '<div class="detail-row' + (esFactura ? ' con-cant' : '') + '">' +
      '<div class="detail-desc">' + escaparHtml(l.descripcion) + '</div>' +
      (esFactura
        ? '<div class="detail-qty">' + escaparHtml(l.cantidad) + '</div>' +
          '<div class="detail-price">' + escaparHtml(formatMoney(l.precio)) + '</div>'
        : '') +
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
// La marca es el "logo de texto" del negocio — decisión del
// propietario, 06/09/2026: "MIGUEL MOYANO" y "Comunicación
// Audiovisual" van escritos a fuego, a propósito, igual que un
// logotipo no cambia solo porque cambien los datos fiscales. Es un
// caso distinto al fallo que se corrigió antes con el nombre por
// defecto: aquello rellenaba un campo de datos con un valor
// inventado si estaba vacío; esto es una marca fija, declarada como
// tal, que convive con los datos fiscales reales de debajo sin
// sustituirlos.
const PDF_DOC_MARCA_NOMBRE = 'MIGUEL MOYANO';
const PDF_DOC_MARCA_ACTIVIDAD = 'Comunicación Audiovisual';

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

  const lineaContactoEmisor1 = emisor.nombre; // fila que se alinea con el número de documento
  const lineaContactoEmisor2 = [emisor.nif, emisor.direccion].filter(Boolean).join(' · '); // fila que se alinea con la fecha
  const lineaContactoEmisor3 = [emisor.telefono, emisor.email].filter(Boolean).join(' · ');

  const numeroDoc = pdfDocTexto(registro.numero);
  // Concepto: rótulo que va ENCIMA de la tabla de descripción, igual
  // que en el diseño de referencia. En facturas con líneas propias es
  // el título del trabajo y las líneas van debajo, desglosadas. En
  // presupuestos hoy no existe un campo aparte y el concepto hace de
  // descripción, así que saldría repetido: en ese caso se omite el
  // rótulo y se deja solo la línea de la tabla.
  const conceptoDoc = pdfDocTexto(registro.concepto);
  const conceptoRepetido = lineas.length === 1 &&
    pdfDocTexto(lineas[0].descripcion) === conceptoDoc;
  const conceptoMostrado = conceptoRepetido ? '' : conceptoDoc;
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
        // Cabecera en FILAS alineadas, no en dos bloques sueltos: cada
        // dato de la izquierda tiene su pareja exacta a la derecha en
        // la misma línea horizontal (petición del propietario,
        // 06/09/2026). Con dos columnas independientes, un nombre de
        // una o dos líneas desalinea todo lo que viene después; con
        // una tabla de filas explícitas, cada fila se alinea sola.
        '<table class="cabecera-doc"><tbody>' +
          '<tr>' +
            '<td class="cab-izq"><div class="red-line"></div><div class="brand">' + PDF_DOC_MARCA_NOMBRE + '</div><div class="activity">' + PDF_DOC_MARCA_ACTIVIDAD + '</div></td>' +
            '<td class="cab-der"><div class="doc-title">' + titulo + '</div></td>' +
          '</tr>' +
          '<tr>' +
            '<td class="cab-izq seller-line">' + (lineaContactoEmisor1 ? escaparHtml(lineaContactoEmisor1) : '') + '</td>' +
            '<td class="cab-der doc-number">' + escaparHtml(numeroDoc) + '</td>' +
          '</tr>' +
          '<tr>' +
            '<td class="cab-izq">' + (lineaContactoEmisor2 ? escaparHtml(lineaContactoEmisor2) : '') + '</td>' +
            '<td class="cab-der doc-fecha">Fecha: ' + escaparHtml(mostrarFecha(registro.fecha)) + '</td>' +
          '</tr>' +
          (lineaContactoEmisor3
            ? '<tr><td class="cab-izq">' + escaparHtml(lineaContactoEmisor3) + '</td><td class="cab-der"></td></tr>'
            : '') +
        '</tbody></table>' +

        '<div class="client-box">' +
          '<div class="client-inner">' +
            '<div class="client-label">Cliente</div>' +
            '<div class="client-name">' + escaparHtml(nombreCliente) + '</div>' +
            (nifCliente ? '<div>' + escaparHtml(nifCliente) + '</div>' : '') +
            (direccionCliente ? '<div>' + escaparHtml(direccionCliente) + '</div>' : '') +
          '</div>' +
        '</div>' +

        (conceptoMostrado ? '<div class="concept">' + escaparHtml(conceptoMostrado) + '</div>' : '') +

        '<div class="desc-wrap">' +
          '<div class="desc-head' + (esFactura ? ' con-cant' : '') + '">' +
            '<div>Descripción</div>' +
            (esFactura ? '<div>Cant.</div><div>Precio</div>' : '') +
            '<div>Importe</div>' +
          '</div>' +
          '<div class="desc-body">' + pdfDocFilasHtml(lineas, esFactura) + '</div>' +
        '</div>' +

        // Totales y observaciones van SIEMPRE al fondo de la ÚLTIMA
        // hoja del documento (petición del propietario, 06/09/2026).
        // `margin-top:auto` solo funciona cuando el documento cabe en
        // una página: en cuanto la tabla obliga a una segunda hoja,
        // `@page` corta el flujo en páginas físicas independientes y
        // ya no hay ningún "contenedor de la última hoja" al que
        // aplicar ese margen — el pie se quedaba pegado justo debajo
        // de la tabla, en cualquier página que tocara. Por eso aquí no
        // se usa margin-top:auto: hay un DIV vacío justo antes del pie
        // (`#pdf-relleno`) cuya altura se calcula en JavaScript, una
        // vez que el navegador ya maquetó el documento entero y se
        // sabe cuánto sitio real sobra en la última hoja.
        '<div id="pdf-relleno"></div>' +
        '<div class="pie-doc" id="pdf-pie">' +
          '<div class="summary-box">' + pdfDocFilasTotales(registro) + '</div>' +
          '<div class="observations">' +
            '<div class="observations-title">OBSERVACIONES</div>' +
            '<div class="observations-body">' + observaciones + '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<script>' + pdfDocScriptRelleno() + '<\/script>' +
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
  // Margen superior e inferior en CADA hoja física, no solo al
  // principio y al final del documento entero: `@page { margin }`
  // se repite automáticamente en todas las páginas que el navegador
  // vaya generando, así ningún texto queda pegado al borde de una
  // página 2, 3... (fallo detectado por el propietario, 06/09/2026:
  // antes el padding vivía solo en `.content`, un bloque continuo que
  // el navegador corta a mitad sin repetir su margen en la hoja
  // siguiente). El lateral se queda igual, ya en el 8% pedido desde
  // el principio.
  '@page{size:A4 portrait;margin:10mm 0}' +
  '*{box-sizing:border-box}' +
  'html,body{margin:0;padding:0;width:210mm;background:#ffffff}' +
  'body{font-family:"Inter",Arial,sans-serif;color:#172033;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
  '.page{position:relative;width:210mm;min-height:277mm;background:#ffffff;display:flex;flex-direction:column}' +

  // Cabecera: sigue pegada al borde, a propósito — es la única pieza
  // que debe llegar hasta el filo de la hoja (confirmado por el
  // propietario). Como el margen ahora vive en `@page`, aquí se
  // compensa con un margen negativo igual para que la imagen sí toque
  // el borde real del papel.
  '.header{width:100%;height:38mm;overflow:hidden;background:#e8e8e4;flex:0 0 auto;margin:-10mm 0 0}' +
  '.header img{width:100%;height:100%;display:block;object-fit:cover}' +
  '.header-vacio{background:#f2f2ee;height:0;margin:0}' +

  '.content{flex:1 1 auto;display:flex;flex-direction:column;padding:7mm 8% 0}' +

  // Cabecera del documento en DOS COLUMNAS reales, no posiciones
  // absolutas: con un nombre fiscal largo, el título ("PRESUPUESTO")
  // se montaba encima del nombre. Ahora cada uno tiene su columna y no
  // pueden solaparse nunca, sea cual sea el largo del nombre.
  // Cabecera como TABLA de filas (sustituye al flex de dos columnas
  // sueltas): cada fila de la izquierda queda en la misma línea
  // horizontal que su pareja de la derecha, sin importar cuántas
  // líneas ocupe el nombre o si hay actividad o no.
  '.cabecera-doc{width:100%;border-collapse:collapse}' +
  '.cab-izq{text-align:left;vertical-align:top;padding:0;font-size:9.5pt;line-height:1.5;font-weight:400}' +
  '.cab-der{text-align:right;vertical-align:top;padding:0;white-space:nowrap;font-size:9.3pt;line-height:1.5}' +
  '.red-line{width:26mm;height:1.1mm;background:' + acento + ';margin-bottom:2.5mm}' +
  '.brand{font-family:"Archivo Black","Arial Black",sans-serif;font-size:19pt;line-height:1.05;color:#172033;text-transform:uppercase}' +
  '.activity{font-size:10pt;font-weight:800;line-height:1.3;margin-top:.5mm}' +
  '.doc-title{font-family:"Archivo Black","Arial Black",sans-serif;font-size:21pt;line-height:1.05;color:' + acento + ';text-transform:uppercase}' +
  // Fila 1 (nombre / FACTURA) queda algo separada de las filas de
  // datos que siguen debajo, para que no se lean como un bloque único.
  '.seller-line{padding-top:3.5mm}' +
  '.doc-number{font-size:11pt;font-weight:800;padding-top:3.5mm}' +

  '.client-box{margin-top:7mm;background:#eef1f4;border-radius:4mm;padding:4mm 4.5%}' +
  '.client-inner{font-size:9.4pt;line-height:1.35}' +
  '.client-label{font-family:"Archivo Black","Arial Black",sans-serif;font-size:12.2pt;line-height:1;color:' + acento + ';margin-bottom:2mm}' +
  '.client-name{font-weight:800}' +

  '.concept{margin-top:6mm;font-size:10.5pt;line-height:1.3;font-weight:800}' +

  // Única zona de altura variable: crece según el número de líneas,
  // sin límite ni relleno (corrige mapa 15.4).
  '.desc-wrap{margin-top:3mm}' +
  '.desc-head{background:#172033;border-radius:1.5mm 1.5mm 0 0;display:grid;grid-template-columns:75% 25%;align-items:center;color:#fff;font-size:9.1pt;font-weight:800;padding:3mm 3%}' +
  '.desc-head.con-cant{grid-template-columns:46% 14% 18% 22%}' +
  '.desc-head div:not(:first-child){text-align:right}' +
  '.detail-row{display:grid;grid-template-columns:75% 25%;align-items:start;font-size:8.9pt;line-height:1.35;padding:2.8mm 3%;border-bottom:.25mm solid #e5e7eb}' +
  '.detail-row.con-cant{grid-template-columns:46% 14% 18% 22%}' +
  // Los saltos de línea que el propietario escribe en la descripción
  // del presupuesto se respetan tal cual, para que cada punto quede
  // en su propia línea.
  '.detail-desc{white-space:pre-line}' +
  '.detail-qty,.detail-price,.detail-amount{text-align:right;white-space:nowrap}' +

  // El pie se pega al fondo de la hoja cuando sobra sitio.
  '#pdf-relleno{flex:0 0 auto}' +
  // Sin `break-inside: avoid` aquí a propósito: esa regla hace que el
  // MOTOR DE IMPRESIÓN reserve un salto de página completo por su
  // cuenta si decide que el bloque no cabe, ANTES de que el relleno
  // calculado en JavaScript se haya aplicado — así que el navegador
  // y el script de relleno acababan calculando posiciones distintas
  // y el pie caía una página más abajo de lo previsto, con una hoja
  // en blanco de por medio. El relleno medido ya garantiza que el
  // pie cabe entero en el hueco que le hemos dejado, así que esta
  // protección no hace falta y solo estorbaba.
  '.pie-doc{padding-top:8mm}' +
  '.summary-box{margin-left:50%;background:#eef1f4;border-radius:4mm;padding:4mm 4%}' +
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

// ============================================================
// 6bis. SCRIPT DE RELLENO — empuja el pie a la última hoja
// ============================================================
// Se ejecuta en el propio documento del PDF, después de que las
// fuentes y la imagen de cabecera hayan cargado y el navegador ya
// haya maquetado todo el contenido con su tamaño real. En ese
// momento (y no antes) se puede saber cuánto ocupa de verdad el
// contenido antes del pie, y por tanto cuánto hueco hay que dejar
// para que el pie caiga justo al fondo de la última hoja en vez de
// quedarse pegado a la tabla.
function pdfDocScriptRelleno() {
  return '' +
  'function rellenarYImprimir(){' +
    'var relleno=document.getElementById("pdf-relleno");' +
    'var pie=document.getElementById("pdf-pie");' +
    'if(relleno&&pie){' +
      // Alto útil de una hoja física: 297mm de A4 menos el margen que
      // fija @page (10mm arriba + 10mm abajo). Se convierte a los
      // mismos píxeles que usa el navegador para maquetar (96dpi).
      'var mmAPx=96/25.4;' +
      'var altoHoja=(297-20)*mmAPx;' +
      // Punto donde arranca el pie ahora mismo, y cuántas hojas hacen
      // falta hasta llegar ahí.
      'var topPie=pie.getBoundingClientRect().top+window.scrollY;' +
      'var altoPie=pie.getBoundingClientRect().height;' +
      'var hojasHastaPie=Math.ceil(topPie/altoHoja);' +
      'if(hojasHastaPie<1)hojasHastaPie=1;' +
      // Si el pie completo ya cabe en lo que resta de esa hoja, el
      // relleno es la diferencia entre el final de esa hoja y donde
      // arranca el pie. Si no cupiera (pie muy largo, caso raro), se
      // pasa a la hoja siguiente y se rellena hasta el final de esa.
      'var finHojaPie=hojasHastaPie*altoHoja;' +
      'if(finHojaPie-topPie<altoPie){' +
        'hojasHastaPie+=1;' +
        'finHojaPie=hojasHastaPie*altoHoja;' +
      '}' +
      // Un pequeño colchón de seguridad (5mm) resta del hueco
      // calculado: sin él, un pie cuya altura cambia una pizca entre
      // la medición y la impresión real (redondeos de fuente, por
      // ejemplo) puede desbordar un párrafo a una hoja más, dejándola
      // casi vacía.
      'var colchon=5*mmAPx;' +
      'var alturaRelleno=finHojaPie-altoPie-topPie-colchon;' +
      'if(alturaRelleno>0){relleno.style.height=alturaRelleno+"px";}' +
      // Tras aplicar el relleno, el documento puede quedar unos
      // píxeles por encima del múltiplo exacto de hoja, y esos pocos
      // píxeles generan una página final completamente en blanco. Se
      // recorta la altura de `.page` justo al final de la última hoja
      // con contenido para que esa hoja fantasma no llegue a existir.
      'var pagina=document.querySelector(".page");' +
      'if(pagina){' +
        'var finReal=pie.getBoundingClientRect().bottom+window.scrollY;' +
        'var hojasTotales=Math.ceil(finReal/altoHoja);' +
        'if(hojasTotales<1)hojasTotales=1;' +
        'pagina.style.minHeight="0";' +
        'pagina.style.height=(hojasTotales*altoHoja)+"px";' +
        'pagina.style.overflow="hidden";' +
      '}' +
    '}' +
    'setTimeout(function(){window.print();},80);' +
  '}' +
  'window.addEventListener("load",function(){' +
    // Doble margen de espera: primero a que carguen fuentes e imagen
    // (que pueden cambiar la altura del texto y de la cabecera),
    // después el cálculo en sí.
    'if(document.fonts&&document.fonts.ready){document.fonts.ready.then(function(){setTimeout(rellenarYImprimir,200);});}' +
    'else{setTimeout(rellenarYImprimir,300);}' +
  '});';
}

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
