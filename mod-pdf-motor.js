/**
 * MOTOR DE PDF (Presupuesto y Factura de venta) — 29/09/2026
 * ------------------------------------------------------------
 * Crea el PDF como archivo REAL dentro de la propia aplicación, sin abrir
 * ventana ni diálogo de imprimir. Sustituye al método anterior (una
 * ventana con HTML que el navegador imprimía). Ventajas:
 *   - Tamaño A4 siempre (ya no depende de la impresora ni del navegador).
 *   - Texto real: se puede seleccionar y copiar.
 *   - Archivo ligero (~70 KB): fuentes recortadas y cabecera comprimida.
 *   - Produce un Blob, listo para descargarlo o enviarlo a Drive.
 *   - Dice con exactitud si la descripción no cabe en la hoja.
 *
 * Diseño elegido el 29/09/2026 (GUÍA sección 26): cabecera de imagen,
 * Archivo Black, rojo y negro, cliente con filete, descripción con barra
 * negra, totales en tarjeta negra y pie con franja. Una sola hoja A4.
 *
 * Necesita, del resto de la app: cfgTexto, roundMoney, mostrarFecha y
 * parsearNumero (app.js). La librería jsPDF (jspdf.umd.min.js) se carga
 * sola la primera vez que se genera un PDF, y las fuentes (pdf-*.ttf) y
 * la imagen de cabecera se leen del propio repositorio.
 */

// ============================================================
// 1. RECURSOS: FUENTES Y CABECERA
// ============================================================

const PDFM_URL_CABECERA = '20260906_145914_0000.png';

const PDFM_FUENTES = {
  i400: 'pdf-inter-400.ttf',
  i700: 'pdf-inter-700.ttf',
  i800: 'pdf-inter-800.ttf',
  i900: 'pdf-inter-900.ttf',
  ic400: 'pdf-inter-cursiva-400.ttf',
  ic700: 'pdf-inter-cursiva-700.ttf',
  archivo: 'pdf-archivo-black.ttf'
};

// Medidas verticales de cada tipografía (ascendente y descendente, en
// proporción del tamaño). Sirven para colocar el texto igual que lo
// hacía el navegador dentro de su renglón.
const PDFM_METRICA = {
  inter: { a: 1984 / 2048, d: 494 / 2048 },
  archivo: { a: 0.878, d: 0.210 }
};

// Caracteres que incluyen las fuentes recortadas. Cualquier otro se
// sustituye por «?» para no dejar huecos raros.
const PDFM_EXTRA = [0x2013, 0x2014, 0x2018, 0x2019, 0x201A, 0x201C, 0x201D, 0x201E, 0x2022, 0x2026,
  0x2212, 0x20AC, 0x2116, 0x2032, 0x2033, 0x2190, 0x2192, 0x2044, 0x2039, 0x203A];

const PDFM_PT = 25.4 / 72;           // 1 punto tipográfico en milímetros
const PDFM_COLOR_TEXTO = '#172033';
const PDFM_COLOR_CAJA = '#f4f5f7';
const PDFM_COLOR_NEGRO = '#161615';
const PDFM_COLOR_ROJO = '#D32F2F';
const PDFM_COLOR_SEP_NEGRO = '#737372';
const PDFM_COLOR_LINEA = '#e5e7eb';
const PDFM_COLOR_CABECERA_FONDO = '#e8e8e4';

let pdfMotorRecursos = null;

function pdfMotorABase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

// Recorta la imagen de cabecera como hacía «object-fit: cover» en una
// franja de 210 × 38 mm y la comprime a JPEG (mucho más ligera que el PNG).
async function pdfMotorCabeceraJpeg(url) {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = url;
  await img.decode();
  const relacion = 210 / 38;
  let sw = img.naturalWidth, sh = sw / relacion;
  if (sh > img.naturalHeight) { sh = img.naturalHeight; sw = sh * relacion; }
  const sx = (img.naturalWidth - sw) / 2, sy = (img.naturalHeight - sh) / 2;
  const lienzo = document.createElement('canvas');
  lienzo.width = Math.round(sw);
  lienzo.height = Math.round(sh);
  const c = lienzo.getContext('2d');
  c.fillStyle = PDFM_COLOR_CABECERA_FONDO;
  c.fillRect(0, 0, lienzo.width, lienzo.height);
  c.drawImage(img, sx, sy, sw, sh, 0, 0, lienzo.width, lienzo.height);
  return lienzo.toDataURL('image/jpeg', 0.82);
}

async function pdfMotorCargarRecursos(urlCabecera) {
  if (pdfMotorRecursos) return pdfMotorRecursos;
  const fuentes = {};
  await Promise.all(Object.keys(PDFM_FUENTES).map(async function (clave) {
    const r = await fetch(PDFM_FUENTES[clave]);
    if (!r.ok) throw new Error('No se pudo cargar la fuente ' + PDFM_FUENTES[clave]);
    fuentes[clave] = pdfMotorABase64(await r.arrayBuffer());
  }));
  const cabecera = await pdfMotorCabeceraJpeg(urlCabecera);
  pdfMotorRecursos = { fuentes: fuentes, cabecera: cabecera };
  return pdfMotorRecursos;
}

// ============================================================
// 2. PRIMITIVAS DE DIBUJO
// ============================================================

function pdfMotorTextoLimpio(v) {
  return String(v === null || v === undefined ? '' : v)
    .replace(/\r\n?/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '')
    .replace(/[​-‍﻿]/g, '')
    .split('').join('').replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '?').split('').map(function (ch) {
      const n = ch.charCodeAt(0);
      if (ch === '\n' || (n >= 0x20 && n <= 0x7E) || (n >= 0xA0 && n <= 0x17F) || PDFM_EXTRA.indexOf(n) !== -1) return ch;
      return '?';
    }).join('');
}

// Registra una fuente en el documento solo cuando se usa: así el PDF
// no arrastra tipografías que no aparecen.
function pdfMotorFuente(doc, rec, clave) {
  if (!doc.__fuentes) doc.__fuentes = {};
  const nombre = 'PDFM_' + clave;
  if (!doc.__fuentes[clave]) {
    doc.addFileToVFS(nombre + '.ttf', rec.fuentes[clave]);
    doc.addFont(nombre + '.ttf', nombre, 'normal', undefined, 'Identity-H');
    doc.__fuentes[clave] = true;
  }
  doc.setFont(nombre, 'normal');
}

function pdfMotorMetrica(clave) {
  return clave === 'archivo' ? PDFM_METRICA.archivo : PDFM_METRICA.inter;
}

// Contexto de dibujo: agrupa el documento y los recursos.
function pdfMotorCtx(doc, rec) {
  return { doc: doc, rec: rec };
}

function pdfMotorAncho(ctx, texto, fs, fuente) {
  pdfMotorFuente(ctx.doc, ctx.rec, fuente);
  ctx.doc.setFontSize(fs);
  return ctx.doc.getTextWidth(texto);
}

// Dibuja UNA línea de texto dentro de un renglón de alto `alto` (mm),
// que empieza en `top`. Reparte el hueco sobrante arriba y abajo igual
// que el navegador (medio interlineado a cada lado).
function pdfMotorLinea(ctx, texto, x, top, fs, alto, fuente, color, alinear) {
  if (texto === '') return;
  const m = pdfMotorMetrica(fuente), fsMm = fs * PDFM_PT;
  const base = top + (alto - (m.a + m.d) * fsMm) / 2 + m.a * fsMm;
  pdfMotorFuente(ctx.doc, ctx.rec, fuente);
  ctx.doc.setFontSize(fs);
  ctx.doc.setTextColor(color);
  ctx.doc.text(texto, x, base, { align: alinear || 'left', baseline: 'alphabetic' });
}

// Parte un texto en renglones que caben en `ancho` mm. Respeta los
// saltos de línea escritos (como «white-space: pre-line»).
function pdfMotorEnvolver(ctx, texto, ancho, fs, fuente) {
  pdfMotorFuente(ctx.doc, ctx.rec, fuente);
  ctx.doc.setFontSize(fs);
  const salida = [];
  pdfMotorTextoLimpio(texto).split('\n').forEach(function (parrafo) {
    const palabras = parrafo.split(/ +/).filter(Boolean);
    if (!palabras.length) { salida.push(''); return; }
    let actual = '';
    palabras.forEach(function (p) {
      let prueba = actual ? actual + ' ' + p : p;
      if (ctx.doc.getTextWidth(prueba) <= ancho) { actual = prueba; return; }
      if (actual) { salida.push(actual); actual = ''; }
      // Palabra más larga que el renglón: se parte por letras.
      while (ctx.doc.getTextWidth(p) > ancho && p.length > 1) {
        let n = p.length - 1;
        while (n > 1 && ctx.doc.getTextWidth(p.slice(0, n)) > ancho) n--;
        salida.push(p.slice(0, n));
        p = p.slice(n);
      }
      actual = p;
    });
    salida.push(actual);
  });
  return salida;
}

function pdfMotorRelleno(ctx, color, x, y, w, h, radio) {
  ctx.doc.setFillColor(color);
  if (radio) ctx.doc.roundedRect(x, y, w, h, radio, radio, 'F');
  else ctx.doc.rect(x, y, w, h, 'F');
}

// ============================================================
// 3. TEXTO ENRIQUECIDO (observaciones)
// ============================================================
// El texto de observaciones se guarda ya saneado desde Configuración
// (solo b/strong/i/em/u/br/p/div/ul/ol/li/span). Aquí se convierte en
// renglones con negrita, cursiva, subrayado y listas.

function pdfMotorRicoBloques(html) {
  const raiz = new DOMParser().parseFromString('<body>' + html + '</body>', 'text/html').body;
  const bloques = [];
  let actual = null;

  function abrir(indent, margen, marcador) {
    actual = { indent: indent, margen: margen, marcador: marcador || null, items: [] };
    bloques.push(actual);
  }
  function cerrarSiVacio() {
    if (actual && !actual.items.length && !actual.marcador) bloques.splice(bloques.indexOf(actual), 1);
    actual = null;
  }

  function visitar(nodo, estilo, ctxLista) {
    nodo.childNodes.forEach(function (n) {
      if (n.nodeType === 3) {
        const t = n.nodeValue.replace(/\s+/g, ' ');
        if (!t) return;
        if (!actual) { if (!t.trim()) return; abrir(ctxLista.indent, 0); }
        actual.items.push({ t: t, b: estilo.b, i: estilo.i, u: estilo.u });
        return;
      }
      if (n.nodeType !== 1) return;
      const tag = n.tagName;
      const nuevo = { b: estilo.b || tag === 'B' || tag === 'STRONG', i: estilo.i || tag === 'I' || tag === 'EM', u: estilo.u || tag === 'U' };
      if (tag === 'BR') {
        if (!actual) abrir(ctxLista.indent, 0);
        actual.items.push({ br: true });
        return;
      }
      if (tag === 'P' || tag === 'DIV') {
        cerrarSiVacio(); actual = null;
        abrir(ctxLista.indent, tag === 'P' ? 2.5 : 0);
        visitar(n, nuevo, ctxLista);
        actual = null;
        return;
      }
      if (tag === 'UL' || tag === 'OL') {
        actual = null;
        const anidada = ctxLista.nivel > 0;
        const antes = bloques.length;
        let contador = 0;
        Array.prototype.forEach.call(n.children, function (li) {
          if (li.tagName !== 'LI') return;
          contador++;
          const marcador = tag === 'OL' ? contador + '.' : '•';
          abrir(ctxLista.indent + 5, 0, marcador);
          visitar(li, nuevo, { indent: ctxLista.indent + 5, nivel: ctxLista.nivel + 1 });
          actual = null;
        });
        if (bloques.length > antes && !anidada) bloques[bloques.length - 1].margen = 2.5;
        return;
      }
      visitar(n, nuevo, ctxLista);
    });
  }
  visitar(raiz, { b: false, i: false, u: false }, { indent: 0, nivel: 0 });
  return bloques.filter(function (b) { return b.items.length || b.marcador; });
}

function pdfMotorFuenteRico(it) {
  if (it.b && it.i) return 'ic700';
  if (it.b) return 'i800';
  if (it.i) return 'ic400';
  return 'i400';
}

// Reparte los elementos de un bloque en renglones de `ancho` mm.
function pdfMotorRicoRenglones(ctx, bloque, ancho, fs) {
  const renglones = [];
  let linea = [], usado = 0;
  const cierre = function () {
    while (linea.length && linea[linea.length - 1].espacio) linea.pop();
    renglones.push(linea); linea = []; usado = 0;
  };
  bloque.items.forEach(function (it) {
    if (it.br) { cierre(); return; }
    const fuente = pdfMotorFuenteRico(it);
    const trozos = pdfMotorTextoLimpio(it.t).split(/( )/).filter(function (s) { return s !== ''; });
    trozos.forEach(function (trozo) {
      const espacio = trozo === ' ';
      if (espacio && !linea.length) return;
      const w = pdfMotorAncho(ctx, trozo, fs, fuente);
      if (!espacio && usado + w > ancho && linea.length) cierre();
      linea.push({ t: trozo, w: w, f: fuente, u: it.u, espacio: espacio });
      usado += w;
    });
  });
  if (linea.length || !renglones.length) cierre();
  return renglones;
}

// Calcula (y, si `dibujar`, pinta) el cuerpo de observaciones. Devuelve
// su alto total, contando el margen final del último bloque.
function pdfMotorRico(ctx, html, x, top, ancho, dibujar) {
  const fs = 9, alto = fs * PDFM_PT * 1.3;
  let y = top;
  pdfMotorRicoBloques(html).forEach(function (bloque) {
    const ax = x + bloque.indent, aw = ancho - bloque.indent;
    const renglones = pdfMotorRicoRenglones(ctx, bloque, aw, fs);
    renglones.forEach(function (linea, idx) {
      if (dibujar) {
        if (idx === 0 && bloque.marcador) {
          const m = pdfMotorMetrica('i400'), fsMm = fs * PDFM_PT;
          const base = y + (alto - (m.a + m.d) * fsMm) / 2 + m.a * fsMm;
          ctx.doc.setTextColor(PDFM_COLOR_TEXTO);
          if (bloque.marcador === '•') {
            ctx.doc.setFillColor(PDFM_COLOR_TEXTO);
            ctx.doc.circle(ax - 3.57, base - 0.95, 0.5, "F");
          } else {
            pdfMotorLinea(ctx, bloque.marcador, ax - 1.2, y, fs, alto, 'i400', PDFM_COLOR_TEXTO, 'right');
          }
        }
        // Se agrupan los trozos seguidos del mismo estilo en un solo texto,
        // para que al copiar salgan frases y no palabras sueltas.
        let cx = ax, i = 0;
        while (i < linea.length) {
          let j = i, txt = '', w = 0;
          while (j < linea.length && linea[j].f === linea[i].f && linea[j].u === linea[i].u) { txt += linea[j].t; w += linea[j].w; j++; }
          pdfMotorLinea(ctx, txt, cx, y, fs, alto, linea[i].f, PDFM_COLOR_TEXTO, 'left');
          if (linea[i].u && txt.trim()) {
            const m = pdfMotorMetrica('i400'), fsMm = fs * PDFM_PT;
            const base = y + (alto - (m.a + m.d) * fsMm) / 2 + m.a * fsMm;
            ctx.doc.setDrawColor(PDFM_COLOR_TEXTO);
            ctx.doc.setLineWidth(0.2);
            ctx.doc.line(cx, base + 0.4, cx + w, base + 0.4);
          }
          cx += w; i = j;
        }
      }
      y += alto;
    });
    y += bloque.margen;
  });
  return y - top;
}

// ============================================================
// 4. DATOS (mismas reglas que mod-pdf-documentos.js)
// ============================================================

function pdfMotorDatosEmisor() {
  const t = function (k) { return String(cfgTexto(k) || '').trim(); };
  const calle = [t('fiscal_calle'), t('fiscal_numero')].filter(Boolean).join(' ');
  const poblacion = [t('fiscal_codigo_postal'), t('fiscal_poblacion')].filter(Boolean).join(' ');
  const direccion = [calle, poblacion].filter(Boolean).join(' · ') +
    (poblacion && t('fiscal_provincia') ? ', ' + t('fiscal_provincia') : '');
  return {
    nombre: t('fiscal_nombre'), nif: t('fiscal_nif'), direccion: direccion,
    telefono: t('perfil_telefono'), email: t('perfil_email')
  };
}

function pdfMotorDireccionContacto(c) {
  if (!c) return '';
  const s = function (v) { return String(v === null || v === undefined ? '' : v).trim(); };
  const calle = [s(c.calle), s(c.numero)].filter(Boolean).join(' ');
  const poblacion = [s(c.codigo_postal), s(c.poblacion)].filter(Boolean).join(' ');
  const primera = [calle, poblacion].filter(Boolean).join(' · ');
  return c.provincia ? primera + (primera ? ', ' : '') + s(c.provincia) : primera;
}

// Importe con punto de millar (1.000,00 €). La app muestra 1000,00 € en
// pantalla; en el PDF se escribe como en una factura española.
function pdfMotorDinero(v) {
  const n = roundMoney(v), neg = n < 0;
  const p = Math.abs(n).toFixed(2).split('.');
  return (neg ? '−' : '') + p[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + p[1] + ' €';
}

// Filas del bloque de totales: mismo orden y mismos textos que antes.
function pdfMotorFilasTotales(reg) {
  const descuento = parsearNumero(reg.descuento_especial_importe);
  const irpf = parsearNumero(reg.irpf);
  const importe = roundMoney(parsearNumero(reg.base) + descuento);
  const etiquetaDescuento = String(reg.descuento_especial_tipo) === 'fixed'
    ? 'Descuento' : 'Descuento (' + parsearNumero(reg.descuento_especial_valor) + '%)';
  const filas = [];
  if (descuento > 0) {
    filas.push({ e: 'Importe', v: pdfMotorDinero(importe), fuerte: false });
    filas.push({ e: etiquetaDescuento, v: '−' + pdfMotorDinero(descuento), fuerte: false });
  }
  filas.push({ e: 'Base imponible', v: pdfMotorDinero(reg.base), fuerte: true });
  filas.push({ e: 'IVA (' + parsearNumero(reg.iva_pct) + '%)', v: pdfMotorDinero(reg.iva), fuerte: true });
  if (irpf > 0) filas.push({ e: 'Retención IRPF (' + parsearNumero(reg.irpf_pct) + '%)', v: '−' + pdfMotorDinero(irpf), fuerte: true });
  return filas;
}

function pdfMotorNombreCliente(registro, contacto) {
  const txt = function (v) { return String(v === null || v === undefined ? '' : v).trim(); };
  return txt(registro.cliente) || txt(contacto && (contacto.nombre_fiscal || contacto.nombre_contacto)) || 'Cliente';
}

// Año de la carpeta de Drive: el de la fecha de emisión del documento.
function pdfMotorAnio(registro) {
  const m = /^(\d{4})-/.exec(String(registro.fecha || ''));
  return m ? m[1] : String(new Date().getFullYear());
}

// Nombre del archivo: «F2026-0007 - Cliente.pdf». Las barras del número
// se cambian por guiones porque Drive y Windows no las admiten.
function pdfMotorNombreDe(registro, contacto) {
  return pdfMotorNombreArchivo(registro, pdfMotorNombreCliente(registro, contacto));
}

function pdfMotorNombreArchivo(registro, cliente) {
  const limpio = function (s) {
    return String(s || '').replace(/[\\\/:*?"<>|\u0000-\u001F]+/g, '-').replace(/\s+/g, ' ').replace(/^[\s.\-]+|[\s.\-]+$/g, '');
  };
  const numero = limpio(registro.numero) || 'Documento';
  const nombre = limpio(cliente);
  return (nombre ? numero + ' - ' + nombre : numero).slice(0, 120) + '.pdf';
}

// ============================================================
// 5. CONSTRUCCIÓN DEL DOCUMENTO
// ============================================================
// Diseño elegido el 29/09/2026: cabecera de imagen (38 mm), Archivo Black,
// rojo y negro, títulos de bloque en color, cliente con filete lateral,
// descripción con barra negra, totales en tarjeta negra y pie con franja.
// Un solo margen interior (6 mm) en cliente, descripción y totales, y todo
// se apoya en los mismos márgenes laterales (16,8 mm).

const PDFM_X = 16.8;              // margen izquierdo (8 % de 210 mm)
const PDFM_ANCHO = 176.4;         // ancho útil
const PDFM_FIN_CONTENIDO = 285;   // 297 mm − 12 mm de margen inferior
const PDFM_PAD = 6;               // margen interior común de las cajas

// Texto colocado por su línea base (dos textos con la misma línea base
// quedan alineados aunque tengan distinto tamaño).
function pdfMotorBase(ctx, texto, x, base, fs, fuente, color, alinear) {
  if (texto === '') return;
  pdfMotorFuente(ctx.doc, ctx.rec, fuente);
  ctx.doc.setFontSize(fs);
  ctx.doc.setTextColor(color);
  ctx.doc.text(texto, x, base, { align: alinear || 'left', baseline: 'alphabetic' });
}

// Línea base de una caja de línea única con interlineado 1 (como
// «line-height: 1» en la hoja de estilos).
function pdfMotorBaseCaja(top, fs, fuente) {
  const m = pdfMotorMetrica(fuente), fsMm = fs * PDFM_PT;
  return top + (fsMm - (m.a + m.d) * fsMm) / 2 + m.a * fsMm;
}

// tipo: 'presupuesto' | 'factura'
function pdfMotorConstruir(registro, contacto, tipo, rec) {
  const esFactura = tipo === 'factura';
  const acento = esFactura ? PDFM_COLOR_ROJO : PDFM_COLOR_NEGRO;
  const acentoSobreNegro = esFactura ? '#FF6B60' : '#FFFFFF';
  const titulo = esFactura ? 'FACTURA' : 'PRESUPUESTO';
  const txt = function (v) { return String(v === null || v === undefined ? '' : v).trim(); };

  const emisor = pdfMotorDatosEmisor();
  const numeroDoc = txt(registro.numero);
  const nombreCliente = pdfMotorNombreCliente(registro, contacto);
  const nifCliente = txt(registro.nif) || txt(contacto && contacto.nif);
  const direccionCliente = pdfMotorDireccionContacto(contacto);
  const concepto = txt(registro.concepto);
  const descripcion = txt(registro.descripcion) || concepto || 'Servicio';
  const observaciones = txt(cfgTexto(esFactura ? 'texto_pie_factura' : 'texto_pie_presupuesto'));

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  const ctx = pdfMotorCtx(doc, rec);
  doc.setProperties({ title: (esFactura ? 'Fra. ' : 'Ptto. ') + numeroDoc + ' - ' + nombreCliente, author: emisor.nombre, creator: 'Cuentas' });

  // --- Cabecera de imagen (38 mm) ---
  doc.addImage(rec.cabecera, 'JPEG', 0, 0, 210, 38, undefined, 'FAST');

  // --- Marca y título: mismo tamaño y misma línea base ---
  let y = 45;
  const xDer = PDFM_X + PDFM_ANCHO;
  pdfMotorRelleno(ctx, acento, PDFM_X, y, 26, 1.1);
  y += 1.1 + 2.5;
  const altoMarca = 20 * PDFM_PT * 1.05;
  pdfMotorLinea(ctx, 'MIGUEL MOYANO', PDFM_X, y, 20, altoMarca, 'archivo', PDFM_COLOR_TEXTO);
  pdfMotorLinea(ctx, titulo, xDer, y, 20, altoMarca, 'archivo', acento, 'right');
  y += altoMarca + 0.5;
  const altoActividad = 10 * PDFM_PT * 1.3;
  pdfMotorLinea(ctx, 'Comunicación Audiovisual', PDFM_X, y, 10, altoActividad, 'i800', PDFM_COLOR_TEXTO);
  y += altoActividad + 3.5;

  // --- Datos del emisor (izquierda) y número / fecha (derecha) ---
  const alto = 5.2;                       // interlineado fijo de estas filas
  const textoFecha = 'Fecha: ' + mostrarFecha(registro.fecha);
  const anchoDerecho = Math.max(pdfMotorAncho(ctx, numeroDoc, 9.5, 'i800'), pdfMotorAncho(ctx, textoFecha, 9.5, 'i400'));
  const anchoIzq = PDFM_ANCHO - anchoDerecho - 6;
  const filaDatos = function (izq, der, fuenteDer) {
    const lineas = pdfMotorEnvolver(ctx, izq, anchoIzq, 9.5, 'i400');
    lineas.forEach(function (l, i) { pdfMotorLinea(ctx, l, PDFM_X, y + i * alto, 9.5, alto, 'i400', PDFM_COLOR_TEXTO); });
    if (der) pdfMotorLinea(ctx, der, xDer, y, 9.5, alto, fuenteDer, PDFM_COLOR_TEXTO, 'right');
    y += Math.max(lineas.length, 1) * alto;
  };
  // Fila del nombre: más grande; el número comparte su línea base.
  const fsNombre = 11.5, altoNombre = 6.4;
  const anchoIzqNombre = PDFM_ANCHO - anchoDerecho - 6;
  const lineasNombre = pdfMotorEnvolver(ctx, emisor.nombre, anchoIzqNombre, fsNombre, 'i800');
  const mN = pdfMotorMetrica('i800'), fsNmm = fsNombre * PDFM_PT;
  const baseNombre = y + (altoNombre - (mN.a + mN.d) * fsNmm) / 2 + mN.a * fsNmm;
  lineasNombre.forEach(function (l, i) { pdfMotorBase(ctx, l, PDFM_X, baseNombre + i * altoNombre, fsNombre, 'i800', PDFM_COLOR_TEXTO); });
  pdfMotorBase(ctx, numeroDoc, xDer, baseNombre, 9.5, 'i800', PDFM_COLOR_TEXTO, 'right');
  y += Math.max(lineasNombre.length, 1) * altoNombre;
  filaDatos([emisor.nif, emisor.direccion].filter(Boolean).join(' · '), textoFecha, 'i400');
  const linea3 = [emisor.telefono, emisor.email].filter(Boolean).join(' · ');
  if (linea3) filaDatos(linea3, '', 'i400');

  // --- Cliente: caja con filete de color a la izquierda ---
  y += 7;
  const anchoTxt = PDFM_ANCHO - 2 * PDFM_PAD;
  const altoCli = 9.4 * PDFM_PT * 1.35;
  const lNombre = pdfMotorEnvolver(ctx, nombreCliente, anchoTxt, 9.4, 'i800');
  const lNif = nifCliente ? pdfMotorEnvolver(ctx, 'NIF: ' + nifCliente, anchoTxt, 9.4, 'i400') : [];
  const lDir = direccionCliente ? pdfMotorEnvolver(ctx, direccionCliente, anchoTxt, 9.4, 'i400') : [];
  const altoLabel = 12.2 * PDFM_PT;
  const altoCaja = 4 + altoLabel + 2 + (lNombre.length + lNif.length + lDir.length) * altoCli + 4;
  pdfMotorRelleno(ctx, PDFM_COLOR_CAJA, PDFM_X, y, PDFM_ANCHO, altoCaja, 1.5);
  pdfMotorRelleno(ctx, PDFM_COLOR_CAJA, PDFM_X, y, 4, altoCaja);          // esquinas izquierdas rectas
  pdfMotorRelleno(ctx, acento, PDFM_X, y, 1.4, altoCaja);                 // filete
  const xc = PDFM_X + PDFM_PAD;
  pdfMotorLinea(ctx, 'Cliente', xc, y + 4, 12.2, altoLabel, 'archivo', acento);
  let yc = y + 4 + altoLabel + 2;
  lNombre.forEach(function (l) { pdfMotorLinea(ctx, l, xc, yc, 9.4, altoCli, 'i800', PDFM_COLOR_TEXTO); yc += altoCli; });
  lNif.forEach(function (l) { pdfMotorLinea(ctx, l, xc, yc, 9.4, altoCli, 'i400', PDFM_COLOR_TEXTO); yc += altoCli; });
  lDir.forEach(function (l) { pdfMotorLinea(ctx, l, xc, yc, 9.4, altoCli, 'i400', PDFM_COLOR_TEXTO); yc += altoCli; });
  y += altoCaja;

  // --- Concepto ---
  if (concepto) {
    y += 6;
    const altoConcepto = 10.5 * PDFM_PT * 1.3;
    pdfMotorEnvolver(ctx, concepto, PDFM_ANCHO, 10.5, 'i800').forEach(function (l) {
      pdfMotorLinea(ctx, l, PDFM_X, y, 10.5, altoConcepto, 'i800', PDFM_COLOR_TEXTO);
      y += altoConcepto;
    });
  }

  // --- Totales y observaciones (se calculan primero: van pegados al fondo) ---
  const filas = pdfMotorFilasTotales(registro);
  const altoFila = 8.9 * PDFM_PT * 1.3;
  const altoTotalFila = 14 * PDFM_PT;
  const altoResumen = 3 + 1 + (filas.length * altoFila + (filas.length - 1) * 1) + 2 + 0.35 + 2 + altoTotalFila + 4;
  const altoTituloObs = 12.2 * PDFM_PT;
  const altoObs = observaciones ? pdfMotorRico(ctx, observaciones, PDFM_X, 0, PDFM_ANCHO, false) : 0;
  const altoPie = 8 + altoResumen + 8 + altoTituloObs + 3 + (observaciones ? altoObs : 4.13);
  const topPie = PDFM_FIN_CONTENIDO - altoPie;

  // --- Descripción: barra negra ---
  y += 3;
  const altoCabTxt = 9.1 * PDFM_PT * 1.2;
  const altoCab = 3 + altoCabTxt + 3;
  pdfMotorRelleno(ctx, PDFM_COLOR_NEGRO, PDFM_X, y, PDFM_ANCHO, altoCab, 1.5);
  pdfMotorRelleno(ctx, PDFM_COLOR_NEGRO, PDFM_X, y + altoCab / 2, PDFM_ANCHO, altoCab / 2);
  pdfMotorLinea(ctx, 'Descripción', PDFM_X + PDFM_PAD, y + 3, 9.1, altoCabTxt, 'i800', '#FFFFFF');
  y += altoCab;

  const altoDesc = 8.9 * PDFM_PT * 1.35;
  const lineasDesc = pdfMotorEnvolver(ctx, descripcion, PDFM_ANCHO - 2 * PDFM_PAD, 8.9, 'i400');
  const hueco = topPie - (y + 2.8);
  const caben = Math.max(0, Math.floor((hueco - 2.8 - 0.25) / altoDesc));
  const recortado = lineasDesc.length > caben;
  const visibles = recortado ? lineasDesc.slice(0, caben) : lineasDesc;
  visibles.forEach(function (l, i) {
    pdfMotorLinea(ctx, l, PDFM_X + PDFM_PAD, y + 2.8 + i * altoDesc, 8.9, altoDesc, 'i400', PDFM_COLOR_TEXTO);
  });
  const yLinea = y + 2.8 * 2 + visibles.length * altoDesc + 0.125;
  doc.setDrawColor(PDFM_COLOR_LINEA); doc.setLineWidth(0.25);
  doc.line(PDFM_X, yLinea, PDFM_X + PDFM_ANCHO, yLinea);

  // --- Pie: tarjeta negra de totales ---
  const xCaja = PDFM_X + PDFM_ANCHO * 0.5, anchoResumen = PDFM_ANCHO * 0.5;
  const yCaja = topPie + 8;
  pdfMotorRelleno(ctx, PDFM_COLOR_NEGRO, xCaja, yCaja, anchoResumen, altoResumen, 4);
  const xi = xCaja + PDFM_PAD, xd = xCaja + anchoResumen - PDFM_PAD;
  let yr = yCaja + 3 + 1;
  filas.forEach(function (f) {
    const fuente = f.fuerte ? 'i700' : 'i400';
    pdfMotorLinea(ctx, f.e, xi, yr, 8.9, altoFila, fuente, '#FFFFFF');
    pdfMotorLinea(ctx, f.v, xd, yr, 8.9, altoFila, fuente, '#FFFFFF', 'right');
    yr += altoFila + 1;
  });
  yr += 1;            // el margen de la última fila se une al de la raya (2 mm en total)
  pdfMotorRelleno(ctx, PDFM_COLOR_SEP_NEGRO, xi, yr, anchoResumen - 2 * PDFM_PAD, 0.35);
  yr += 0.35 + 2;
  // TOTAL y su cifra comparten línea base (la de la cifra, que es la mayor).
  const baseTotal = pdfMotorBaseCaja(yr, 14, 'i900');
  pdfMotorBase(ctx, 'TOTAL', xi, baseTotal, 11, 'i800', acentoSobreNegro);
  pdfMotorBase(ctx, pdfMotorDinero(registro.total), xd, baseTotal, 14, 'i900', acentoSobreNegro, 'right');

  // --- Pie: observaciones ---
  const yObs = yCaja + altoResumen + 8;
  pdfMotorLinea(ctx, 'OBSERVACIONES', PDFM_X, yObs, 12.2, altoTituloObs, 'archivo', acento);
  if (observaciones) {
    pdfMotorRico(ctx, observaciones, PDFM_X, yObs + altoTituloObs + 3, PDFM_ANCHO, true);
  } else {
    pdfMotorLinea(ctx, 'Sin observaciones.', PDFM_X, yObs + altoTituloObs + 3, 9, 9 * PDFM_PT * 1.3, 'i400', '#64748b');
  }

  // --- Franja negra del pie con tramo rojo ---
  pdfMotorRelleno(ctx, PDFM_COLOR_NEGRO, 0, 292, 210, 5);
  pdfMotorRelleno(ctx, PDFM_COLOR_ROJO, PDFM_X, 292, 26, 5);

  return { doc: doc, recortado: recortado, nombre: pdfMotorNombreArchivo(registro, nombreCliente) };
}

// Carga jsPDF solo la primera vez que hace falta (pesa unos 360 KB), para
// no retrasar la apertura de la app.
let pdfMotorLibreria = null;
function pdfMotorCargarLibreria() {
  if (window.jspdf && window.jspdf.jsPDF) return Promise.resolve();
  if (!pdfMotorLibreria) {
    pdfMotorLibreria = new Promise(function (ok, ko) {
      const s = document.createElement('script');
      s.src = 'jspdf.umd.min.js';
      s.onload = function () { ok(); };
      s.onerror = function () { pdfMotorLibreria = null; ko(new Error('No se pudo cargar la librería de PDF.')); };
      document.head.appendChild(s);
    });
  }
  return pdfMotorLibreria;
}

// Punto de entrada: devuelve { blob, nombre, recortado, anio }.
async function pdfMotorGenerar(registro, contacto, tipo) {
  await pdfMotorCargarLibreria();
  const rec = await pdfMotorCargarRecursos(PDFM_URL_CABECERA);
  const r = pdfMotorConstruir(registro, contacto, tipo, rec);
  return { blob: r.doc.output('blob'), nombre: r.nombre, recortado: r.recortado, anio: pdfMotorAnio(registro) };
}
