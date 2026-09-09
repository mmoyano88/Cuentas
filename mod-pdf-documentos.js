/**
 * MÓDULO PDF DE DOCUMENTOS (Presupuesto y Factura de venta)
 * ------------------------------------------------------------
 * Genera el PDF de cliente para Presupuestos y Facturas de venta.
 * Compartido entre los dos módulos porque el diseño es casi idéntico:
 * solo cambian el color de acento y qué texto de pie se usa. Las
 * facturas de compra NO generan PDF (mapa 15.2), y eso no cambia.
 *
 * MECANISMO — sin ninguna librería de PDF (mapa 15.1): se abre una
 * ventana nueva, se escribe un documento HTML con estilos de
 * impresión A4, y el propio navegador lo convierte a PDF al imprimir.
 * Si el navegador bloquea la ventana emergente, se avisa.
 *
 * ⚠️ VERSIÓN SIMPLIFICADA (07/09/2026, GUÍA sección 20). Sustituye a
 * un diseño anterior mucho más complejo que daba problemas continuos.
 * Lo que se eliminó y por qué:
 *
 *   - PAGINACIÓN MÚLTIPLE. El documento ocupa SIEMPRE una sola hoja.
 *     Con ello desaparecen el script que medía el documento ya
 *     maquetado, el relleno calculado para empujar el pie al fondo de
 *     la última hoja, el recorte de la página fantasma final, la
 *     "named page" para que la cabecera tocara el borde y los ajustes
 *     de margen por página. Eran mecanismos correctos por separado,
 *     pero juntos formaban un sistema frágil donde cada cambio movía
 *     otra pieza.
 *   - REESCALADO DE LÍNEAS. Las facturas ya no tienen líneas de
 *     detalle: llevan un único importe que ES la base imponible, así
 *     que no hay dos cifras que cuadrar entre sí.
 *   - COLUMNAS "Cant." y "Precio". Siempre mostraban 1 y el importe
 *     repetido, porque no existen datos reales de cantidad ni de
 *     precio unitario. La tabla se queda con Descripción e Importe.
 *
 * Si la descripción no cabe en la hoja, se AVISA al propietario antes
 * de generar el PDF para que edite el documento. Nunca se recorta en
 * silencio: perder texto de una factura sin que se note es peor que
 * tener que acortarlo a mano.
 *
 * La imagen de cabecera es una URL fija en el repositorio de GitHub
 * del propietario (ver PDF_DOC_URL_CABECERA). Antes se guardaba en
 * base64 dentro de la configuración, pero no llegaba a guardarse de
 * forma fiable. Para cambiarla, se sube un archivo con el mismo
 * nombre a esa carpeta — no hace falta tocar la app.
 */

// ============================================================
// 1. CONSTANTES
// ============================================================

// La marca es el "logo de texto" del negocio: va escrita a fuego a
// propósito, igual que un logotipo no cambia porque cambien los datos
// fiscales. Convive con los datos fiscales reales de debajo, que sí
// salen de Configuración.
const PDF_DOC_MARCA_NOMBRE = 'MIGUEL MOYANO';
const PDF_DOC_MARCA_ACTIVIDAD = 'Comunicación Audiovisual';

// Se sirve desde raw.githubusercontent.com, que es la dirección de
// acceso directo al archivo (github.com/.../blob/... es la página que
// lo muestra, no el archivo). Verificado: 1240×260px.
const PDF_DOC_URL_CABECERA = 'https://raw.githubusercontent.com/mmoyano88/Cuentas/main/20260906_145914_0000.png';

// Alto máximo aproximado, en píxeles de pantalla, que puede ocupar el
// bloque de descripción sin que el documento se salga de una hoja A4.
// Se calcula restando al alto útil de la página lo que ocupan las
// piezas fijas (cabecera, datos, caja de cliente, tabla, totales y
// observaciones). Es una estimación con margen: si se supera, se
// avisa, y como el aviso no bloquea, el propietario decide.
const PDF_DOC_ALTO_MAX_DESCRIPCION = 330;

// ============================================================
// 2. DATOS DEL EMISOR Y DEL CLIENTE
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
    email: pdfDocTexto(cfgTexto('perfil_email'))
  };
}

function pdfDocDireccionContacto(contacto) {
  if (!contacto) return '';
  const calle = [pdfDocTexto(contacto.calle), pdfDocTexto(contacto.numero)].filter(Boolean).join(' ');
  const poblacion = [pdfDocTexto(contacto.codigo_postal), pdfDocTexto(contacto.poblacion)].filter(Boolean).join(' ');
  const primera = [calle, poblacion].filter(Boolean).join(' · ');
  return contacto.provincia ? primera + (primera ? ', ' : '') + pdfDocTexto(contacto.provincia) : primera;
}

// El texto de observaciones ya se guarda saneado desde Configuración
// (solo b/strong/i/em/u/br/p/div/ul/ol/li/span, sin atributos
// peligrosos), así que aquí se usa tal cual.
function pdfDocObservaciones(clave) {
  const html = pdfDocTexto(cfgTexto(clave));
  return html || '<span class="muted">Sin observaciones.</span>';
}

// ============================================================
// 3. CONTENIDO DEL DOCUMENTO
// ============================================================
// Presupuestos y facturas tienen ya la misma forma: concepto,
// descripción y un único importe que ES la base imponible. Por eso
// una sola función sirve para los dos.

function pdfDocDatosDocumento(registro) {
  return {
    concepto: pdfDocTexto(registro.concepto),
    descripcion: pdfDocTexto(registro.descripcion),
    base: parsearNumero(registro.base)
  };
}

// ============================================================
// 4. BLOQUE DE TOTALES
// ============================================================
// Base imponible · Descuento (solo si lo hay) · IVA (con %) ·
// Retención IRPF (solo si la hay) · TOTAL.

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
  const doc = pdfDocDatosDocumento(registro);
  const observaciones = pdfDocObservaciones(esFactura ? 'texto_pie_factura' : 'texto_pie_presupuesto');

  const nombreCliente = pdfDocTexto(registro.cliente) || pdfDocTexto(contacto && (contacto.nombre_fiscal || contacto.nombre_contacto)) || 'Cliente';
  const nifCliente = pdfDocTexto(registro.nif) || pdfDocTexto(contacto && contacto.nif);
  const direccionCliente = pdfDocDireccionContacto(contacto);

  const numeroDoc = pdfDocTexto(registro.numero);
  const fileTitle = (esFactura ? 'Fra.' : 'Ptto.') + ' ' + numeroDoc + ' - ' + nombreCliente;

  // Datos fiscales del emisor, en tres líneas. Se alinean, fila a
  // fila, con el título / número / fecha de la derecha.
  const lineaEmisor1 = emisor.nombre;
  const lineaEmisor2 = [emisor.nif, emisor.direccion].filter(Boolean).join(' · ');
  const lineaEmisor3 = [emisor.telefono, emisor.email].filter(Boolean).join(' · ');

  return '<!doctype html><html lang="es"><head><meta charset="utf-8">' +
    '<title>' + escaparHtml(fileTitle) + '</title>' +
    '<link rel="preconnect" href="https://fonts.googleapis.com">' +
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
    '<link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Inter:wght@400;500;700;800;900&display=swap" rel="stylesheet">' +
    '<style>' + pdfDocCss(acento) + '</style>' +
    '</head><body>' +
    '<div class="page">' +
      '<div class="header"><img src="' + escaparHtml(PDF_DOC_URL_CABECERA) + '" alt=""></div>' +
      '<div class="content">' +
        // Cabecera en FILAS alineadas: cada dato de la izquierda tiene
        // su pareja exacta a la derecha en la misma línea horizontal,
        // sea cual sea el largo del nombre.
        '<table class="cabecera-doc"><tbody>' +
          '<tr>' +
            '<td class="cab-izq">' +
              '<div class="red-line"></div>' +
              '<div class="brand">' + PDF_DOC_MARCA_NOMBRE + '</div>' +
              '<div class="activity">' + PDF_DOC_MARCA_ACTIVIDAD + '</div>' +
            '</td>' +
            '<td class="cab-der"><div class="doc-title">' + titulo + '</div></td>' +
          '</tr>' +
          '<tr>' +
            '<td class="cab-izq seller-line">' + escaparHtml(lineaEmisor1) + '</td>' +
            '<td class="cab-der doc-number">' + escaparHtml(numeroDoc) + '</td>' +
          '</tr>' +
          '<tr>' +
            '<td class="cab-izq">' + escaparHtml(lineaEmisor2) + '</td>' +
            '<td class="cab-der">Fecha: ' + escaparHtml(mostrarFecha(registro.fecha)) + '</td>' +
          '</tr>' +
          (lineaEmisor3
            ? '<tr><td class="cab-izq">' + escaparHtml(lineaEmisor3) + '</td><td class="cab-der"></td></tr>'
            : '') +
        '</tbody></table>' +

        '<div class="client-box">' +
          '<div class="client-label">Cliente</div>' +
          '<div class="client-name">' + escaparHtml(nombreCliente) + '</div>' +
          (nifCliente ? '<div>' + escaparHtml(nifCliente) + '</div>' : '') +
          (direccionCliente ? '<div>' + escaparHtml(direccionCliente) + '</div>' : '') +
        '</div>' +

        (doc.concepto ? '<div class="concept">' + escaparHtml(doc.concepto) + '</div>' : '') +

        '<div class="desc-wrap">' +
          '<div class="desc-head"><div>Descripción</div><div>Importe</div></div>' +
          '<div class="detail-row" id="pdf-detalle">' +
            '<div class="detail-desc">' + escaparHtml(doc.descripcion || doc.concepto || 'Servicio') + '</div>' +
            '<div class="detail-amount">' + escaparHtml(formatMoney(doc.base)) + '</div>' +
          '</div>' +
        '</div>' +

        // El pie se pega al fondo de la hoja con margin-top:auto. Aquí
        // sí funciona sin más: al ser el documento de UNA sola página,
        // `.content` es una columna flexible de alto conocido y no hay
        // saltos de página que compliquen el cálculo.
        '<div class="pie-doc">' +
          '<div class="summary-box">' + pdfDocFilasTotales(registro) + '</div>' +
          '<div class="observations">' +
            '<div class="observations-title">OBSERVACIONES</div>' +
            '<div class="observations-body">' + observaciones + '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<script>window.addEventListener("load",function(){' +
      'if(document.fonts&&document.fonts.ready){document.fonts.ready.then(function(){setTimeout(function(){window.print();},200);});}' +
      'else{setTimeout(function(){window.print();},400);}' +
    '});<\/script>' +
    '</body></html>';
}

// ============================================================
// 6. HOJA DE ESTILOS DEL DOCUMENTO
// ============================================================

function pdfDocCss(acento) {
  return '' +
  // Sin margen de página: la cabecera llega al borde real de la hoja.
  // El margen del contenido lo pone `.content` con su propio padding,
  // que basta porque el documento nunca pasa de una página.
  '@page{size:A4 portrait;margin:0}' +
  '*{box-sizing:border-box}' +
  'html,body{margin:0;padding:0;width:210mm;background:#ffffff}' +
  'body{font-family:"Inter",Arial,sans-serif;color:#172033;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
  '.page{width:210mm;height:297mm;background:#ffffff;display:flex;flex-direction:column;overflow:hidden}' +

  '.header{width:100%;height:38mm;overflow:hidden;background:#e8e8e4;flex:0 0 auto}' +
  '.header img{width:100%;height:100%;display:block;object-fit:cover}' +

  '.content{flex:1 1 auto;display:flex;flex-direction:column;padding:7mm 8% 12mm}' +

  '.cabecera-doc{width:100%;border-collapse:collapse}' +
  '.cab-izq{text-align:left;vertical-align:top;padding:0;font-size:9.5pt;line-height:1.5;font-weight:400}' +
  '.cab-der{text-align:right;vertical-align:top;padding:0;white-space:nowrap;font-size:9.3pt;line-height:1.5}' +
  '.red-line{width:26mm;height:1.1mm;background:' + acento + ';margin-bottom:2.5mm}' +
  '.brand{font-family:"Archivo Black","Arial Black",sans-serif;font-size:19pt;line-height:1.05;color:#172033;text-transform:uppercase}' +
  '.activity{font-size:10pt;font-weight:800;line-height:1.3;margin-top:.5mm}' +
  '.doc-title{font-family:"Archivo Black","Arial Black",sans-serif;font-size:21pt;line-height:1.05;color:' + acento + ';text-transform:uppercase}' +
  '.seller-line{padding-top:3.5mm}' +
  '.doc-number{font-size:11pt;font-weight:800;padding-top:3.5mm}' +

  '.client-box{margin-top:7mm;background:#eef1f4;border-radius:4mm;padding:4mm 4.5%;font-size:9.4pt;line-height:1.35}' +
  '.client-label{font-family:"Archivo Black","Arial Black",sans-serif;font-size:12.2pt;line-height:1;color:' + acento + ';margin-bottom:2mm}' +
  '.client-name{font-weight:800}' +

  '.concept{margin-top:6mm;font-size:10.5pt;line-height:1.3;font-weight:800}' +

  '.desc-wrap{margin-top:3mm}' +
  '.desc-head{background:#172033;border-radius:1.5mm 1.5mm 0 0;display:grid;grid-template-columns:75% 25%;align-items:center;color:#fff;font-size:9.1pt;font-weight:800;padding:3mm 3%}' +
  '.desc-head div:last-child{text-align:right}' +
  '.detail-row{display:grid;grid-template-columns:75% 25%;align-items:start;font-size:8.9pt;line-height:1.35;padding:2.8mm 3%;border-bottom:.25mm solid #e5e7eb}' +
  // Los saltos de línea de la descripción se respetan tal cual, para
  // que cada punto quede en su propio renglón.
  '.detail-desc{white-space:pre-line}' +
  '.detail-amount{text-align:right;white-space:nowrap}' +

  '.pie-doc{margin-top:auto;padding-top:8mm}' +
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
  '.muted{color:#64748b}';
}

// ============================================================
// 7. AVISO SI LA DESCRIPCIÓN NO CABE
// ============================================================
// El documento es de una sola hoja, así que una descripción muy larga
// se saldría del papel. En vez de recortarla en silencio (perder
// texto de una factura sin que se note es peor), se avisa antes de
// generar el PDF y el propietario decide: puede acortar el texto o
// seguir adelante igualmente.
//
// La estimación es deliberadamente sencilla: número de renglones que
// ocuparía la descripción, contando los saltos de línea que escribe
// el propietario y las líneas de más que provoca el ajuste automático
// del texto largo. No hace falta más precisión, porque el aviso no
// bloquea: solo advierte.

function pdfDocDescripcionSeSale(registro) {
  const texto = pdfDocTexto(registro.descripcion);
  if (!texto) return false;

  // ~95 caracteres por renglón en la columna de descripción.
  const CARACTERES_POR_RENGLON = 95;
  const ALTO_RENGLON = 15;      // px aproximados por renglón
  const ALTO_CONCEPTO = pdfDocTexto(registro.concepto) ? 30 : 0;

  const renglones = texto.split('\n').reduce(function (total, linea) {
    return total + Math.max(1, Math.ceil(linea.length / CARACTERES_POR_RENGLON));
  }, 0);

  return (renglones * ALTO_RENGLON + ALTO_CONCEPTO) > PDF_DOC_ALTO_MAX_DESCRIPCION;
}

// ============================================================
// 8. APERTURA DE LA VENTANA DE IMPRESIÓN
// ============================================================

function pdfDocAbrir(registro, contacto, tipo) {
  if (pdfDocDescripcionSeSale(registro)) {
    const seguir = confirm(
      'La descripción es larga y puede que no quepa entera en la hoja.\n\n' +
      'Los presupuestos y facturas se generan siempre en una sola página, así que ' +
      'el texto que sobre no se verá.\n\n' +
      '¿Quieres generar el PDF de todas formas?'
    );
    if (!seguir) return;
  }

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
// mod-facturas-venta.js.
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
