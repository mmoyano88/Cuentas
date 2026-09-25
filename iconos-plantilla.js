/**
 * ICONOS DE PLANTILLA — catálogo cerrado de 45 iconos (Tabler Icons,
 * estilo outline, licencia MIT), aparte del catálogo de contactos.
 * Pensado para reconocer de un vistazo cada plantilla de trabajo o de
 * pago recurrente (módulo Plantillas, 25/09/2026).
 *
 * Es puramente decorativo: al convertir una plantilla en presupuesto,
 * factura o apunte, este icono NO pasa al documento resultante.
 *
 * EL COLOR SALE DE LA CATEGORÍA (decisión del propietario, 25/09/2026):
 * no se elige aparte ni se guarda en la hoja. Al elegir el icono, el
 * círculo toma el color de su categoría, así todas las plantillas del
 * mismo tipo (bodas, prensa, cuotas...) se reconocen juntas. Se dejan
 * fuera a propósito el rojo y el verde, que en la app ya significan
 * gasto/ingreso y error/guardado.
 *
 * Los iconos se pintan con la fuente de Tabler que ya carga la app
 * (<i class="ti ti-...">), así que este archivo solo lleva datos.
 *
 * Debe cargarse ANTES que mod-plantillas.js en index.html.
 */

const CATEGORIAS_ICONOS_PLANTILLA = [
  { nombre: 'Fotografía', color: '#185FA5', iconos: [
    { id: 'camera', titulo: 'Cámara', buscar: 'fotografía, foto, reportaje, sesión' },
    { id: 'photo', titulo: 'Foto', buscar: 'imagen, fotografía, álbum' },
    { id: 'aperture', titulo: 'Objetivo', buscar: 'diafragma, lente, estudio' },
    { id: 'camera-selfie', titulo: 'Retrato', buscar: 'retrato, sesión, book, persona' },
    { id: 'drone', titulo: 'Dron', buscar: 'aéreo, dron, vuelo' }
  ]},
  { nombre: 'Vídeo y directos', color: '#534AB7', iconos: [
    { id: 'video', titulo: 'Vídeo', buscar: 'grabación, vídeo, rodaje' },
    { id: 'movie', titulo: 'Película', buscar: 'cine, corto, documental, película' },
    { id: 'cut', titulo: 'Montaje', buscar: 'edición, montaje, postproducción' },
    { id: 'player-record', titulo: 'Grabación', buscar: 'grabar, rec, grabación' },
    { id: 'broadcast', titulo: 'Directo', buscar: 'emisión, streaming, en directo, retransmisión' }
  ]},
  { nombre: 'Audio, podcast y entrevistas', color: '#0F6E56', iconos: [
    { id: 'microphone', titulo: 'Micrófono', buscar: 'voz, locución, entrevista' },
    { id: 'microphone-2', titulo: 'Podcast', buscar: 'podcast, programa, episodio' },
    { id: 'headphones', titulo: 'Auriculares', buscar: 'audio, sonido, mezcla' },
    { id: 'messages', titulo: 'Conversación', buscar: 'entrevista, charla, diálogo' },
    { id: 'radio', titulo: 'Radio', buscar: 'radio, cuña, emisora' }
  ]},
  { nombre: 'Prensa, publicidad y redes', color: '#D85A30', iconos: [
    { id: 'news', titulo: 'Prensa', buscar: 'periódico, nota de prensa, noticia' },
    { id: 'speakerphone', titulo: 'Publicidad', buscar: 'campaña, anuncio, megáfono, difusión' },
    { id: 'ad-2', titulo: 'Anuncio', buscar: 'publicidad, banner, cartel' },
    { id: 'share', titulo: 'Redes sociales', buscar: 'redes, compartir, facebook, instagram, gestión' },
    { id: 'hash', titulo: 'Hashtag', buscar: 'contenido, publicaciones, redes' },
    { id: 'device-mobile', titulo: 'Móvil', buscar: 'stories, reels, móvil, teléfono' }
  ]},
  { nombre: 'Bodas, familia e infantil', color: '#D4537E', iconos: [
    { id: 'heart', titulo: 'Boda', buscar: 'boda, novios, pareja, amor' },
    { id: 'diamond', titulo: 'Anillo', buscar: 'pedida, compromiso, anillos' },
    { id: 'building-church', titulo: 'Iglesia', buscar: 'ceremonia, comunión, bautizo, iglesia' },
    { id: 'users-group', titulo: 'Familia', buscar: 'familia, grupo, reportaje familiar' },
    { id: 'mood-kid', titulo: 'Infantil', buscar: 'niños, infantil, colegio' },
    { id: 'baby-carriage', titulo: 'Bebé', buscar: 'recién nacido, newborn, embarazo, bebé' },
    { id: 'cake', titulo: 'Celebración', buscar: 'cumpleaños, comunión, tarta, aniversario' }
  ]},
  { nombre: 'Eventos, empresas e instituciones', color: '#BA7517', iconos: [
    { id: 'confetti', titulo: 'Evento', buscar: 'fiesta, feria, evento, celebración' },
    { id: 'calendar-event', titulo: 'Fecha señalada', buscar: 'evento, agenda, jornada' },
    { id: 'presentation', titulo: 'Congreso', buscar: 'charla, conferencia, jornada, presentación' },
    { id: 'briefcase', titulo: 'Empresa', buscar: 'empresa, corporativo, negocio' },
    { id: 'building', titulo: 'Oficina', buscar: 'empresa, edificio, oficina' },
    { id: 'building-bank', titulo: 'Ayuntamiento', buscar: 'ayuntamiento, institución, administración, el viso' },
    { id: 'flag', titulo: 'Institución', buscar: 'bandera, institucional, oficial' }
  ]},
  { nombre: 'Cuotas, gastos y cobros', color: '#2C2C2A', iconos: [
    { id: 'repeat', titulo: 'Recurrente', buscar: 'mensual, cuota, repetir, suscripción' },
    { id: 'receipt', titulo: 'Recibo', buscar: 'recibo, cuota, pago' },
    { id: 'calculator', titulo: 'Asesoría', buscar: 'asesoría, gestoría, contabilidad, autónomo' },
    { id: 'credit-card', titulo: 'Tarjeta', buscar: 'tarjeta, suscripción, pago' },
    { id: 'shield-check', titulo: 'Seguro', buscar: 'seguro, póliza, responsabilidad' },
    { id: 'bolt', titulo: 'Luz', buscar: 'luz, electricidad, energía, suministros' },
    { id: 'wifi', titulo: 'Internet', buscar: 'internet, fibra, teléfono, móvil, suministros' },
    { id: 'car', titulo: 'Coche', buscar: 'coche, gasolina, combustible, vehículo, desplazamiento' },
    { id: 'cloud', titulo: 'Software', buscar: 'nube, software, adobe, programas, suscripción' },
    { id: 'home', titulo: 'Casa', buscar: 'alquiler, local, casa, oficina' }
  ]}
];

// Icono y color cuando todavía no se ha elegido ninguno.
const ICONO_PLANTILLA_DEFECTO = 'template';
const COLOR_PLANTILLA_DEFECTO = '#5F5E5A';

// Busca un icono del catálogo. Devuelve { icono, categoria } o null.
function buscarIconoPlantilla(id) {
  for (const cat of CATEGORIAS_ICONOS_PLANTILLA) {
    const icono = cat.iconos.find(function (i) { return i.id === String(id || ''); });
    if (icono) return { icono: icono, categoria: cat };
  }
  return null;
}

function colorIconoPlantilla(id) {
  const r = buscarIconoPlantilla(id);
  return r ? r.categoria.color : COLOR_PLANTILLA_DEFECTO;
}

function tituloIconoPlantilla(id) {
  const r = buscarIconoPlantilla(id);
  return r ? r.icono.titulo : 'Plantilla';
}

// Círculo de color con el icono en blanco, listo para insertar.
function htmlIconoPlantilla(id, tamanoPx) {
  const encontrado = buscarIconoPlantilla(id);
  const idReal = encontrado ? encontrado.icono.id : ICONO_PLANTILLA_DEFECTO;
  const tam = tamanoPx || 44;
  return '<div class="icono-plantilla" style="width:' + tam + 'px;height:' + tam + 'px;font-size:' +
    Math.round(tam * 0.5) + 'px;background:' + colorIconoPlantilla(idReal) + '">' +
    '<i class="ti ti-' + idReal + '" aria-hidden="true"></i></div>';
}

// Para el selector de iconos del núcleo (abrirSelectorIcono): cómo se
// dibuja cada opción de este catálogo.
const CATALOGO_ICONOS_PLANTILLA = {
  categorias: CATEGORIAS_ICONOS_PLANTILLA,
  dibujar: function (id) { return '<i class="ti ti-' + id + '" aria-hidden="true"></i>'; }
};
