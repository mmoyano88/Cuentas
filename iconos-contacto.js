/**
 * ICONOS DE CONTACTO — catálogo cerrado de 108 iconos (Tabler Icons,
 * licencia MIT), elegido a mano para cubrir cualquier tipo de cliente o
 * proveedor, agrupados por categoría con etiquetas de búsqueda en español.
 * No editar a mano salvo para añadir/quitar iconos — ver diario del proyecto.
 */

const CATEGORIAS_ICONOS_CONTACTO = [
  { nombre: "Personas", iconos: [
    { id: "user", titulo: "User", buscar: "persona" },
    { id: "users", titulo: "Users", buscar: "personas, grupo" },
  ]},
  { nombre: "Administración / ayuntamientos", iconos: [
    { id: "building-bank", titulo: "Building bank", buscar: "banco, ayuntamiento" },
    { id: "building-community", titulo: "Building community", buscar: "administración pública" },
    { id: "flag", titulo: "Flag", buscar: "bandera, gobierno" },
    { id: "gavel", titulo: "Gavel", buscar: "justicia, notaría, abogacía" },
    { id: "building-hospital", titulo: "Building hospital", buscar: "hospital, sanidad pública" },
  ]},
  { nombre: "Fotografía / vídeo / comunicación", iconos: [
    { id: "camera", titulo: "Camera", buscar: "fotografía, fotógrafo" },
    { id: "device-camera-phone", titulo: "Device camera phone", buscar: "móvil, cámara" },
    { id: "video", titulo: "Video", buscar: "vídeo, grabación" },
    { id: "movie", titulo: "Movie", buscar: "cine, película" },
    { id: "photo", titulo: "Photo", buscar: "foto, imagen" },
    { id: "brush", titulo: "Brush", buscar: "edición, retoque" },
    { id: "microphone", titulo: "Microphone", buscar: "micrófono, audio" },
    { id: "microphone-2", titulo: "Microphone", buscar: "podcast, locución" },
  ]},
  { nombre: "Marketing / eventos", iconos: [
    { id: "speakerphone", titulo: "Speakerphone", buscar: "publicidad, anuncios" },
    { id: "presentation", titulo: "Presentation", buscar: "presentación, charla" },
    { id: "chart-dots", titulo: "Chart dots", buscar: "estadísticas, análisis" },
    { id: "confetti", titulo: "Confetti", buscar: "evento, celebración" },
    { id: "guitar-pick", titulo: "Guitar pick", buscar: "música, guitarra" },
    { id: "piano", titulo: "Piano", buscar: "música, piano" },
    { id: "mask", titulo: "Mask", buscar: "teatro, espectáculo" },
    { id: "trophy", titulo: "Trophy", buscar: "premio, competición" },
  ]},
  { nombre: "Educación / oficina", iconos: [
    { id: "school", titulo: "School", buscar: "colegio, formación" },
    { id: "briefcase-2", titulo: "Briefcase", buscar: "oficina, negocio" },
    { id: "calculator", titulo: "Calculator", buscar: "contabilidad, gestoría" },
    { id: "device-laptop", titulo: "Device laptop", buscar: "informática, tecnología" },
    { id: "writing", titulo: "Writing", buscar: "escritura, redacción" },
    { id: "pencil", titulo: "Pencil", buscar: "diseño, dibujo" },
    { id: "palette", titulo: "Palette", buscar: "arte, pintura" },
    { id: "book-2", titulo: "Book", buscar: "librería, editorial" },
  ]},
  { nombre: "Otros negocios (variedad)", iconos: [
    { id: "tools", titulo: "Tools", buscar: "taller, reparación" },
    { id: "car", titulo: "Car", buscar: "coche, automoción" },
    { id: "shirt", titulo: "Shirt", buscar: "ropa, textil" },
    { id: "scissors", titulo: "Scissors", buscar: "peluquería, costura" },
    { id: "chef-hat", titulo: "Chef hat", buscar: "restaurante, cocina" },
    { id: "coffee", titulo: "Coffee", buscar: "cafetería, bar" },
    { id: "pizza", titulo: "Pizza", buscar: "pizzería, comida" },
    { id: "carrot", titulo: "Carrot", buscar: "verdulería, alimentación" },
    { id: "apple", titulo: "Apple", buscar: "frutería" },
    { id: "stethoscope", titulo: "Stethoscope", buscar: "médico, clínica" },
    { id: "first-aid-kit", titulo: "First aid kit", buscar: "farmacia, urgencias" },
    { id: "tractor", titulo: "Tractor", buscar: "agricultura, campo" },
    { id: "paw", titulo: "Paw", buscar: "mascotas, animales" },
    { id: "fish", titulo: "Fish", buscar: "pescadería, pesca" },
    { id: "sailboat", titulo: "Sailboat", buscar: "barco, náutica, vela" },
    { id: "anchor", titulo: "Anchor", buscar: "puerto, náutica" },
    { id: "bulldozer", titulo: "Bulldozer", buscar: "obra, construcción" },
    { id: "road", titulo: "Road", buscar: "carretera, obra pública" },
    { id: "sofa", titulo: "Sofa", buscar: "muebles, decoración" },
    { id: "plant", titulo: "Plant", buscar: "jardinería, plantas" },
    { id: "solar-panel", titulo: "Solar panel", buscar: "energía solar" },
    { id: "recycle", titulo: "Recycle", buscar: "reciclaje, ecología" },
    { id: "swimming", titulo: "Swimming", buscar: "piscina, natación" },
    { id: "tent", titulo: "Tent", buscar: "camping, aire libre" },
    { id: "luggage", titulo: "Luggage", buscar: "viajes, maletas" },
    { id: "compass", titulo: "Compass", buscar: "turismo, aventura" },
    { id: "building-store", titulo: "Building store", buscar: "tienda, comercio" },
    { id: "building-warehouse", titulo: "Building warehouse", buscar: "almacén, distribución" },
    { id: "dog-bowl", titulo: "Dog bowl", buscar: "veterinaria, mascotas" },
    { id: "cat", titulo: "Cat", buscar: "gato, veterinaria" },
    { id: "horse", titulo: "Horse", buscar: "caballos, hípica" },
    { id: "bread", titulo: "Bread", buscar: "panadería" },
    { id: "milk", titulo: "Milk", buscar: "lácteos, granja" },
    { id: "soup", titulo: "Soup", buscar: "comida casera, catering" },
    { id: "device-gamepad-2", titulo: "Device gamepad", buscar: "videojuegos, ocio" },
    { id: "puzzle", titulo: "Puzzle", buscar: "juguetería, ocio" },
    { id: "brain", titulo: "Brain", buscar: "psicología, terapia" },
    { id: "heart-handshake", titulo: "Heart handshake", buscar: "ayuda, ONG" },
    { id: "yoga", titulo: "Yoga", buscar: "yoga, bienestar" },
    { id: "hanger", titulo: "Hanger", buscar: "moda, tienda de ropa" },
    { id: "door", titulo: "Door", buscar: "cerrajería, puertas" },
    { id: "home-2", titulo: "Home", buscar: "inmobiliaria, hogar" },
    { id: "tools-kitchen-2", titulo: "Tools kitchen", buscar: "cocina, menaje" },
    { id: "wall", titulo: "Wall", buscar: "albañilería, obra" },
    { id: "stairs", titulo: "Stairs", buscar: "reformas, construcción" },
    { id: "plug", titulo: "Plug", buscar: "electricidad, electricista" },
    { id: "battery-2", titulo: "Battery", buscar: "energía, baterías" },
    { id: "grain", titulo: "Grain", buscar: "cereales, agricultura" },
    { id: "flower", titulo: "Flower", buscar: "floristería" },
    { id: "leaf", titulo: "Leaf", buscar: "ecología, naturaleza" },
    { id: "umbrella-2", titulo: "Umbrella", buscar: "playa, exterior" },
    { id: "sun-wind", titulo: "Sun wind", buscar: "clima, exterior" },
    { id: "car-4wd", titulo: "Car 4wd", buscar: "todoterreno, automoción" },
    { id: "motorbike", titulo: "Motorbike", buscar: "moto, motorista" },
    { id: "bike", titulo: "Bike", buscar: "bicicleta, ciclismo" },
    { id: "bus", titulo: "Bus", buscar: "transporte, autobús" },
    { id: "train", titulo: "Train", buscar: "transporte, tren" },
    { id: "helicopter", titulo: "Helicopter", buscar: "aviación, transporte aéreo" },
    { id: "fish-hook", titulo: "Fish hook", buscar: "pesca" },
    { id: "feather", titulo: "Feather", buscar: "artesanía, escritura" },
    { id: "golf", titulo: "Golf", buscar: "golf, deporte" },
    { id: "run", titulo: "Run", buscar: "deporte, running" },
    { id: "walk", titulo: "Walk", buscar: "senderismo" },
    { id: "backpack", titulo: "Backpack", buscar: "mochila, viajes" },
    { id: "world", titulo: "World", buscar: "internacional, turismo" },
    { id: "map", titulo: "Map", buscar: "mapas, turismo" },
    { id: "gift", titulo: "Gift", buscar: "regalos, tienda" },
    { id: "thermometer", titulo: "Thermometer", buscar: "salud, clínica" },
    { id: "pill", titulo: "Pill", buscar: "farmacia, medicina" },
    { id: "vaccine", titulo: "Vaccine", buscar: "sanidad, veterinaria" },
    { id: "bandage", titulo: "Bandage", buscar: "sanidad, primeros auxilios" },
    { id: "ballpen", titulo: "Ballpen", buscar: "papelería" },
    { id: "printer", titulo: "Printer", buscar: "imprenta, papelería" },
    { id: "archive", titulo: "Archive", buscar: "gestoría, archivo" },
    { id: "shield-check", titulo: "Shield check", buscar: "seguros, protección" },
    { id: "currency-dollar", titulo: "Currency dollar", buscar: "finanzas, banca" },
    { id: "wallet", titulo: "Wallet", buscar: "finanzas, asesoría" },
  ]},
];

// Icono por defecto cuando el contacto no tiene ninguno elegido todavía
const ICONO_CONTACTO_DEFECTO = "user";
const SVG_ICONOS_CONTACTO = {
  "user": `<path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0" />
  <path d="M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" />`,
  "users": `<path d="M5 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" />
  <path d="M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" />
  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  <path d="M21 21v-2a4 4 0 0 0 -3 -3.85" />`,
  "building-bank": `<path d="M3 21l18 0" />
  <path d="M3 10l18 0" />
  <path d="M5 6l7 -3l7 3" />
  <path d="M4 10l0 11" />
  <path d="M20 10l0 11" />
  <path d="M8 14l0 3" />
  <path d="M12 14l0 3" />
  <path d="M16 14l0 3" />`,
  "building-community": `<path d="M8 9l5 5v7h-5v-4m0 4h-5v-7l5 -5m1 1v-6a1 1 0 0 1 1 -1h10a1 1 0 0 1 1 1v17h-8" />
  <path d="M13 7l0 .01" />
  <path d="M17 7l0 .01" />
  <path d="M17 11l0 .01" />
  <path d="M17 15l0 .01" />`,
  "flag": `<path d="M5 5a5 5 0 0 1 7 0a5 5 0 0 0 7 0v9a5 5 0 0 1 -7 0a5 5 0 0 0 -7 0v-9" />
  <path d="M5 21v-7" />`,
  "gavel": `<path d="M13 10l7.383 7.418c.823 .82 .823 2.148 0 2.967a2.11 2.11 0 0 1 -2.976 0l-7.407 -7.385" />
  <path d="M6 9l4 4" />
  <path d="M13 10l-4 -4" />
  <path d="M3 21h7" />
  <path d="M6.793 15.793l-3.586 -3.586a1 1 0 0 1 0 -1.414l2.293 -2.293l.5 .5l3 -3l-.5 -.5l2.293 -2.293a1 1 0 0 1 1.414 0l3.586 3.586a1 1 0 0 1 0 1.414l-2.293 2.293l-.5 -.5l-3 3l.5 .5l-2.293 2.293a1 1 0 0 1 -1.414 0" />`,
  "building-hospital": `<path d="M3 21l18 0" />
  <path d="M5 21v-16a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v16" />
  <path d="M9 21v-4a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v4" />
  <path d="M10 9l4 0" />
  <path d="M12 7l0 4" />`,
  "camera": `<path d="M5 7h1a2 2 0 0 0 2 -2a1 1 0 0 1 1 -1h6a1 1 0 0 1 1 1a2 2 0 0 0 2 2h1a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-9a2 2 0 0 1 2 -2" />
  <path d="M9 13a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" />`,
  "device-camera-phone": `<path d="M16 8.5a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0" />
  <path d="M13 7h-8a2 2 0 0 0 -2 2v7a2 2 0 0 0 2 2h13a2 2 0 0 0 2 -2v-2" />
  <path d="M17 15v-1" />`,
  "video": `<path d="M15 10l4.553 -2.276a1 1 0 0 1 1.447 .894v6.764a1 1 0 0 1 -1.447 .894l-4.553 -2.276v-4" />
  <path d="M3 8a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2l0 -8" />`,
  "movie": `<path d="M4 6a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2l0 -12" />
  <path d="M8 4l0 16" />
  <path d="M16 4l0 16" />
  <path d="M4 8l4 0" />
  <path d="M4 16l4 0" />
  <path d="M4 12l16 0" />
  <path d="M16 8l4 0" />
  <path d="M16 16l4 0" />`,
  "photo": `<path d="M15 8h.01" />
  <path d="M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12" />
  <path d="M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5" />
  <path d="M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3" />`,
  "brush": `<path d="M3 21v-4a4 4 0 1 1 4 4h-4" />
  <path d="M21 3a16 16 0 0 0 -12.8 10.2" />
  <path d="M21 3a16 16 0 0 1 -10.2 12.8" />
  <path d="M10.6 9a9 9 0 0 1 4.4 4.4" />`,
  "microphone": `<path d="M9 5a3 3 0 0 1 3 -3a3 3 0 0 1 3 3v5a3 3 0 0 1 -3 3a3 3 0 0 1 -3 -3l0 -5" />
  <path d="M5 10a7 7 0 0 0 14 0" />
  <path d="M8 21l8 0" />
  <path d="M12 17l0 4" />`,
  "microphone-2": `<path d="M15 12.9a5 5 0 1 0 -3.902 -3.9" />
  <path d="M15 12.9l-3.902 -3.899l-7.513 8.584a2 2 0 1 0 2.827 2.83l8.588 -7.515" />`,
  "speakerphone": `<path d="M18 8a3 3 0 0 1 0 6" />
  <path d="M10 8v11a1 1 0 0 1 -1 1h-1a1 1 0 0 1 -1 -1v-5" />
  <path d="M12 8l4.524 -3.77a.9 .9 0 0 1 1.476 .692v12.156a.9 .9 0 0 1 -1.476 .692l-4.524 -3.77h-8a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1h8" />`,
  "presentation": `<path d="M3 4l18 0" />
  <path d="M4 4v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-10" />
  <path d="M12 16l0 4" />
  <path d="M9 20l6 0" />
  <path d="M8 12l3 -3l2 2l3 -3" />`,
  "chart-dots": `<path d="M3 3v18h18" />
  <path d="M7 9a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
  <path d="M17 7a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
  <path d="M12 15a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
  <path d="M10.16 10.62l2.34 2.88" />
  <path d="M15.088 13.328l2.837 -4.586" />`,
  "confetti": `<path d="M4 5h2" />
  <path d="M5 4v2" />
  <path d="M11.5 4l-.5 2" />
  <path d="M18 5h2" />
  <path d="M19 4v2" />
  <path d="M15 9l-1 1" />
  <path d="M18 13l2 -.5" />
  <path d="M18 19h2" />
  <path d="M19 18v2" />
  <path d="M14 16.518l-6.518 -6.518l-4.39 9.58a1 1 0 0 0 1.329 1.329l9.579 -4.39" />`,
  "guitar-pick": `<path d="M16 18.5c2 -2.5 4 -6.5 4 -10.5c0 -2.946 -2.084 -4.157 -4.204 -4.654c-.864 -.23 -2.13 -.346 -3.796 -.346c-1.667 0 -2.932 .115 -3.796 .346c-2.12 .497 -4.204 1.708 -4.204 4.654c0 3.312 2 8 4 10.5c.297 .37 .618 .731 .963 1.081l.354 .347a3.9 3.9 0 0 0 5.364 0a14.05 14.05 0 0 0 1.319 -1.428" />`,
  "piano": `<path d="M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10" />
  <path d="M9 19v-6" />
  <path d="M8 5v8h2v-8" />
  <path d="M15 19v-6" />
  <path d="M14 5v8h2v-8" />`,
  "mask": `<path d="M9 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
  <path d="M4 6a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2l0 -12" />`,
  "trophy": `<path d="M8 21l8 0" />
  <path d="M12 17l0 4" />
  <path d="M7 4l10 0" />
  <path d="M17 4v8a5 5 0 0 1 -10 0v-8" />
  <path d="M3 9a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
  <path d="M17 9a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />`,
  "school": `<path d="M22 9l-10 -4l-10 4l10 4l10 -4v6" />
  <path d="M6 10.6v5.4a6 3 0 0 0 12 0v-5.4" />`,
  "briefcase-2": `<path d="M3 9a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-9" />
  <path d="M8 7v-2a2 2 0 0 1 2 -2h4a2 2 0 0 1 2 2v2" />`,
  "calculator": `<path d="M4 5a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2l0 -14" />
  <path d="M8 8a1 1 0 0 1 1 -1h6a1 1 0 0 1 1 1v1a1 1 0 0 1 -1 1h-6a1 1 0 0 1 -1 -1l0 -1" />
  <path d="M8 14l0 .01" />
  <path d="M12 14l0 .01" />
  <path d="M16 14l0 .01" />
  <path d="M8 17l0 .01" />
  <path d="M12 17l0 .01" />
  <path d="M16 17l0 .01" />`,
  "device-laptop": `<path d="M3 19l18 0" />
  <path d="M5 7a1 1 0 0 1 1 -1h12a1 1 0 0 1 1 1v8a1 1 0 0 1 -1 1h-12a1 1 0 0 1 -1 -1l0 -8" />`,
  "writing": `<path d="M20 17v-12c0 -1.121 -.879 -2 -2 -2s-2 .879 -2 2v12l2 2l2 -2" />
  <path d="M16 7h4" />
  <path d="M18 19h-13a2 2 0 1 1 0 -4h4a2 2 0 1 0 0 -4h-3" />`,
  "pencil": `<path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4" />
  <path d="M13.5 6.5l4 4" />`,
  "palette": `<path d="M12 21a9 9 0 0 1 0 -18c4.97 0 9 3.582 9 8c0 1.06 -.474 2.078 -1.318 2.828c-.844 .75 -1.989 1.172 -3.182 1.172h-2.5a2 2 0 0 0 -1 3.75a1.3 1.3 0 0 1 -1 2.25" />
  <path d="M7.5 10.5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
  <path d="M11.5 7.5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
  <path d="M15.5 10.5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />`,
  "book-2": `<path d="M19 4v16h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h12" />
  <path d="M19 16h-12a2 2 0 0 0 -2 2" />
  <path d="M9 8h6" />`,
  "tools": `<path d="M3 21h4l13 -13a1.5 1.5 0 0 0 -4 -4l-13 13v4" />
  <path d="M14.5 5.5l4 4" />
  <path d="M12 8l-5 -5l-4 4l5 5" />
  <path d="M7 8l-1.5 1.5" />
  <path d="M16 12l5 5l-4 4l-5 -5" />
  <path d="M16 17l-1.5 1.5" />`,
  "car": `<path d="M5 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
  <path d="M15 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
  <path d="M5 17h-2v-6l2 -5h9l4 5h1a2 2 0 0 1 2 2v4h-2m-4 0h-6m-6 -6h15m-6 0v-5" />`,
  "shirt": `<path d="M15 4l6 2v5h-3v8a1 1 0 0 1 -1 1h-10a1 1 0 0 1 -1 -1v-8h-3v-5l6 -2a3 3 0 0 0 6 0" />`,
  "scissors": `<path d="M3 7a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
  <path d="M3 17a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
  <path d="M8.6 8.6l10.4 10.4" />
  <path d="M8.6 15.4l10.4 -10.4" />`,
  "chef-hat": `<path d="M12 3c1.918 0 3.52 1.35 3.91 3.151a4 4 0 0 1 2.09 7.723l0 7.126h-12v-7.126a4 4 0 1 1 2.092 -7.723a4 4 0 0 1 3.908 -3.151" />
  <path d="M6.161 17.009l11.839 -.009" />`,
  "coffee": `<path d="M3 14c.83 .642 2.077 1.017 3.5 1c1.423 .017 2.67 -.358 3.5 -1c.83 -.642 2.077 -1.017 3.5 -1c1.423 -.017 2.67 .358 3.5 1" />
  <path d="M8 3a2.4 2.4 0 0 0 -1 2a2.4 2.4 0 0 0 1 2" />
  <path d="M12 3a2.4 2.4 0 0 0 -1 2a2.4 2.4 0 0 0 1 2" />
  <path d="M3 10h14v5a6 6 0 0 1 -6 6h-2a6 6 0 0 1 -6 -6v-5" />
  <path d="M16.746 16.726a3 3 0 1 0 .252 -5.555" />`,
  "pizza": `<path d="M12 21.5c-3.04 0 -5.952 -.714 -8.5 -1.983l8.5 -16.517l8.5 16.517a19.09 19.09 0 0 1 -8.5 1.983" />
  <path d="M5.38 15.866a14.94 14.94 0 0 0 6.815 1.634a14.944 14.944 0 0 0 6.502 -1.479" />
  <path d="M13 11.01v-.01" />
  <path d="M11 14v-.01" />`,
  "carrot": `<path d="M3 21s9.834 -3.489 12.684 -6.34a4.487 4.487 0 0 0 0 -6.344a4.483 4.483 0 0 0 -6.342 0c-2.86 2.861 -6.347 12.689 -6.347 12.689l.005 -.005" />
  <path d="M9 13l-1.5 -1.5" />
  <path d="M16 14l-2 -2" />
  <path d="M22 8s-1.14 -2 -3 -2c-1.406 0 -3 2 -3 2s1.14 2 3 2s3 -2 3 -2" />
  <path d="M16 2s-2 1.14 -2 3s2 3 2 3s2 -1.577 2 -3c0 -1.86 -2 -3 -2 -3" />`,
  "apple": `<path d="M4 11.319c0 3.102 .444 5.319 2.222 7.978c1.351 1.797 3.156 2.247 5.08 .988c.426 -.268 .97 -.268 1.397 0c1.923 1.26 3.728 .809 5.079 -.988c1.778 -2.66 2.222 -4.876 2.222 -7.977c0 -2.661 -1.99 -5.32 -4.444 -5.32c-1.267 0 -2.41 .693 -3.22 1.44a.5 .5 0 0 1 -.672 0c-.809 -.746 -1.953 -1.44 -3.22 -1.44c-2.454 0 -4.444 2.66 -4.444 5.319" />
  <path d="M7 12c0 -1.47 .454 -2.34 1.5 -3" />
  <path d="M12 7c0 -1.2 .867 -4 3 -4" />`,
  "stethoscope": `<path d="M6 4h-1a2 2 0 0 0 -2 2v3.5a5.5 5.5 0 0 0 11 0v-3.5a2 2 0 0 0 -2 -2h-1" />
  <path d="M8 15a6 6 0 1 0 12 0v-3" />
  <path d="M11 3v2" />
  <path d="M6 3v2" />
  <path d="M18 10a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />`,
  "first-aid-kit": `<path d="M8 8v-2a2 2 0 0 1 2 -2h4a2 2 0 0 1 2 2v2" />
  <path d="M4 10a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2l0 -8" />
  <path d="M10 14h4" />
  <path d="M12 12v4" />`,
  "tractor": `<path d="M3 15a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" />
  <path d="M7 15l0 .01" />
  <path d="M17 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
  <path d="M10.5 17l6.5 0" />
  <path d="M20 15.2v-4.2a1 1 0 0 0 -1 -1h-6l-2 -5h-6v6.5" />
  <path d="M18 5h-1a1 1 0 0 0 -1 1v4" />`,
  "paw": `<path d="M14.7 13.5c-1.1 -2 -1.441 -2.5 -2.7 -2.5c-1.259 0 -1.736 .755 -2.836 2.747c-.942 1.703 -2.846 1.845 -3.321 3.291c-.097 .265 -.145 .677 -.143 .962c0 1.176 .787 2 1.8 2c1.259 0 3 -1 4.5 -1s3.241 1 4.5 1c1.013 0 1.8 -.823 1.8 -2c0 -.285 -.049 -.697 -.146 -.962c-.475 -1.451 -2.512 -1.835 -3.454 -3.538" />
  <path d="M20.188 8.082a1.039 1.039 0 0 0 -.406 -.082h-.015c-.735 .012 -1.56 .75 -1.993 1.866c-.519 1.335 -.28 2.7 .538 3.052c.129 .055 .267 .082 .406 .082c.739 0 1.575 -.742 2.011 -1.866c.516 -1.335 .273 -2.7 -.54 -3.052l-.001 0" />
  <path d="M9.474 9c.055 0 .109 0 .163 -.011c.944 -.128 1.533 -1.346 1.32 -2.722c-.203 -1.297 -1.047 -2.267 -1.932 -2.267c-.055 0 -.109 0 -.163 .011c-.944 .128 -1.533 1.346 -1.32 2.722c.204 1.293 1.048 2.267 1.933 2.267" />
  <path d="M16.456 6.733c.214 -1.376 -.375 -2.594 -1.32 -2.722a1.164 1.164 0 0 0 -.162 -.011c-.885 0 -1.728 .97 -1.93 2.267c-.214 1.376 .375 2.594 1.32 2.722c.054 .007 .108 .011 .162 .011c.885 0 1.73 -.974 1.93 -2.267" />
  <path d="M5.69 12.918c.816 -.352 1.054 -1.719 .536 -3.052c-.436 -1.124 -1.271 -1.866 -2.009 -1.866c-.14 0 -.277 .027 -.407 .082c-.816 .352 -1.054 1.719 -.536 3.052c.436 1.124 1.271 1.866 2.009 1.866c.14 0 .277 -.027 .407 -.082" />`,
  "fish": `<path d="M16.69 7.44a6.973 6.973 0 0 0 -1.69 4.56c0 1.747 .64 3.345 1.699 4.571" />
  <path d="M2 9.504c7.715 8.647 14.75 10.265 20 2.498c-5.25 -7.761 -12.285 -6.142 -20 2.504" />
  <path d="M18 11v.01" />
  <path d="M11.5 10.5c-.667 1 -.667 2 0 3" />`,
  "sailboat": `<path d="M2 20a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 2 -1a2.4 2.4 0 0 1 2 -1a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 2 -1a2.4 2.4 0 0 1 2 -1a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 2 -1" />
  <path d="M4 18l-1 -3h18l-1 3" />
  <path d="M11 12h7l-7 -9v9" />
  <path d="M8 7l-2 5" />`,
  "anchor": `<path d="M12 9v12m-8 -8a8 8 0 0 0 16 0m1 0h-2m-14 0h-2" />
  <path d="M9 6a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />`,
  "bulldozer": `<path d="M2 17a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" />
  <path d="M12 17a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" />
  <path d="M19 13v4a2 2 0 0 0 2 2h1" />
  <path d="M14 19h-10" />
  <path d="M4 15h10" />
  <path d="M9 11v-5h2a3 3 0 0 1 3 3v6" />
  <path d="M5 15v-3a1 1 0 0 1 1 -1h8" />
  <path d="M19 17h-3" />`,
  "road": `<path d="M4 19l4 -14" />
  <path d="M16 5l4 14" />
  <path d="M12 8v-2" />
  <path d="M12 13v-2" />
  <path d="M12 18v-2" />`,
  "sofa": `<path d="M4 11a2 2 0 0 1 2 2v1h12v-1a2 2 0 1 1 4 0v5a1 1 0 0 1 -1 1h-18a1 1 0 0 1 -1 -1v-5a2 2 0 0 1 2 -2" />
  <path d="M4 11v-3a3 3 0 0 1 3 -3h10a3 3 0 0 1 3 3v3" />
  <path d="M12 5v9" />`,
  "plant": `<path d="M7 15h10v4a2 2 0 0 1 -2 2h-6a2 2 0 0 1 -2 -2v-4" />
  <path d="M12 9a6 6 0 0 0 -6 -6h-3v2a6 6 0 0 0 6 6h3" />
  <path d="M12 11a6 6 0 0 1 6 -6h3v1a6 6 0 0 1 -6 6h-3" />
  <path d="M12 15l0 -6" />`,
  "solar-panel": `<path d="M4.28 14h15.44a1 1 0 0 0 .97 -1.243l-1.5 -6a1 1 0 0 0 -.97 -.757h-12.44a1 1 0 0 0 -.97 .757l-1.5 6a1 1 0 0 0 .97 1.243" />
  <path d="M4 10h16" />
  <path d="M10 6l-1 8" />
  <path d="M14 6l1 8" />
  <path d="M12 14v4" />
  <path d="M7 18h10" />`,
  "recycle": `<path d="M12 17l-2 2l2 2" />
  <path d="M10 19h9a2 2 0 0 0 1.75 -2.75l-.55 -1" />
  <path d="M8.536 11l-.732 -2.732l-2.732 .732" />
  <path d="M7.804 8.268l-4.5 7.794a2 2 0 0 0 1.506 2.89l1.141 .024" />
  <path d="M15.464 11l2.732 .732l.732 -2.732" />
  <path d="M18.196 11.732l-4.5 -7.794a2 2 0 0 0 -3.256 -.14l-.591 .976" />`,
  "swimming": `<path d="M15 9a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
  <path d="M6 11l4 -2l3.5 3l-1.5 2" />
  <path d="M3 16.75a2.4 2.4 0 0 0 1 .25a2.4 2.4 0 0 0 2 -1a2.4 2.4 0 0 1 2 -1a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 2 -1a2.4 2.4 0 0 1 2 -1a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 1 -.25" />`,
  "tent": `<path d="M11 14l4 6h6l-9 -16l-9 16h6l4 -6" />`,
  "luggage": `<path d="M6 8a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2l0 -10" />
  <path d="M9 6v-1a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v1" />
  <path d="M6 10h12" />
  <path d="M6 16h12" />
  <path d="M9 20v1" />
  <path d="M15 20v1" />`,
  "compass": `<path d="M8 16l2 -6l6 -2l-2 6l-6 2" />
  <path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
  <path d="M12 3l0 2" />
  <path d="M12 19l0 2" />
  <path d="M3 12l2 0" />
  <path d="M19 12l2 0" />`,
  "building-store": `<path d="M3 21l18 0" />
  <path d="M3 7v1a3 3 0 0 0 6 0v-1m0 1a3 3 0 0 0 6 0v-1m0 1a3 3 0 0 0 6 0v-1h-18l2 -4h14l2 4" />
  <path d="M5 21l0 -10.15" />
  <path d="M19 21l0 -10.15" />
  <path d="M9 21v-4a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v4" />`,
  "building-warehouse": `<path d="M3 21v-13l9 -4l9 4v13" />
  <path d="M13 13h4v8h-10v-6h6" />
  <path d="M13 21v-9a1 1 0 0 0 -1 -1h-2a1 1 0 0 0 -1 1v3" />`,
  "dog-bowl": `<path d="M10 15l5.586 -5.585a2 2 0 1 1 3.414 -1.415a2 2 0 1 1 -1.413 3.414l-3.587 3.586" />
  <path d="M12 13l-3.586 -3.585a2 2 0 1 0 -3.414 -1.415a2 2 0 1 0 1.413 3.414l3.587 3.586" />
  <path d="M3 20h18c-.175 -1.671 -.046 -3.345 -2 -5h-14c-1.333 1 -2 2.667 -2 5" />`,
  "cat": `<path d="M20 3v10a8 8 0 1 1 -16 0v-10l3.432 3.432a7.963 7.963 0 0 1 4.568 -1.432c1.769 0 3.403 .574 4.728 1.546l3.272 -3.546" />
  <path d="M2 16h5l-4 4" />
  <path d="M22 16h-5l4 4" />
  <path d="M11 16a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
  <path d="M9 11v.01" />
  <path d="M15 11v.01" />`,
  "horse": `<path d="M7 10l-.85 8.507a1.357 1.357 0 0 0 1.35 1.493h.146a2 2 0 0 0 1.857 -1.257l.994 -2.486a2 2 0 0 1 1.857 -1.257h1.292a2 2 0 0 1 1.857 1.257l.994 2.486a2 2 0 0 0 1.857 1.257h.146a1.37 1.37 0 0 0 1.364 -1.494l-.864 -9.506h-8c0 -3 -3 -5 -6 -5l-3 6l2 2l3 -2" />
  <path d="M22 14v-2a3 3 0 0 0 -3 -3" />`,
  "bread": `<path d="M18 4a3 3 0 0 1 2 5.235v8.765a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-8.764a3 3 0 0 1 1.824 -5.231h12.176v-.005" />`,
  "milk": `<path d="M8 6h8v-2a1 1 0 0 0 -1 -1h-6a1 1 0 0 0 -1 1v2" />
  <path d="M16 6l1.094 1.759a6 6 0 0 1 .906 3.17v8.071a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2v-8.071a6 6 0 0 1 .906 -3.17l1.094 -1.759" />
  <path d="M10 16a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
  <path d="M10 10h4" />`,
  "soup": `<path d="M4 11h16a1 1 0 0 1 1 1v.5c0 1.5 -2.517 5.573 -4 6.5v1a1 1 0 0 1 -1 1h-8a1 1 0 0 1 -1 -1v-1c-1.687 -1.054 -4 -5 -4 -6.5v-.5a1 1 0 0 1 1 -1" />
  <path d="M12 4a2.4 2.4 0 0 0 -1 2a2.4 2.4 0 0 0 1 2" />
  <path d="M16 4a2.4 2.4 0 0 0 -1 2a2.4 2.4 0 0 0 1 2" />
  <path d="M8 4a2.4 2.4 0 0 0 -1 2a2.4 2.4 0 0 0 1 2" />`,
  "device-gamepad-2": `<path d="M12 5h3.5a5 5 0 0 1 0 10h-5.5l-4.015 4.227a2.3 2.3 0 0 1 -3.923 -2.035l1.634 -8.173a5 5 0 0 1 4.904 -4.019h3.4" />
  <path d="M14 15l4.07 4.284a2.3 2.3 0 0 0 3.925 -2.023l-1.6 -8.232" />
  <path d="M8 9v2" />
  <path d="M7 10h2" />
  <path d="M14 10h2" />`,
  "puzzle": `<path d="M4 7h3a1 1 0 0 0 1 -1v-1a2 2 0 0 1 4 0v1a1 1 0 0 0 1 1h3a1 1 0 0 1 1 1v3a1 1 0 0 0 1 1h1a2 2 0 0 1 0 4h-1a1 1 0 0 0 -1 1v3a1 1 0 0 1 -1 1h-3a1 1 0 0 1 -1 -1v-1a2 2 0 0 0 -4 0v1a1 1 0 0 1 -1 1h-3a1 1 0 0 1 -1 -1v-3a1 1 0 0 1 1 -1h1a2 2 0 0 0 0 -4h-1a1 1 0 0 1 -1 -1v-3a1 1 0 0 1 1 -1" />`,
  "brain": `<path d="M15.5 13a3.5 3.5 0 0 0 -3.5 3.5v1a3.5 3.5 0 0 0 7 0v-1.8" />
  <path d="M8.5 13a3.5 3.5 0 0 1 3.5 3.5v1a3.5 3.5 0 0 1 -7 0v-1.8" />
  <path d="M17.5 16a3.5 3.5 0 0 0 0 -7h-.5" />
  <path d="M19 9.3v-2.8a3.5 3.5 0 0 0 -7 0" />
  <path d="M6.5 16a3.5 3.5 0 0 1 0 -7h.5" />
  <path d="M5 9.3v-2.8a3.5 3.5 0 0 1 7 0v10" />`,
  "heart-handshake": `<path d="M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572" />
  <path d="M12 6l-3.293 3.293a1 1 0 0 0 0 1.414l.543 .543c.69 .69 1.81 .69 2.5 0l1 -1a3.182 3.182 0 0 1 4.5 0l2.25 2.25" />
  <path d="M12.5 15.5l2 2" />
  <path d="M15 13l2 2" />`,
  "yoga": `<path d="M4 20h4l1.5 -3" />
  <path d="M17 20l-1 -5h-5l1 -7" />
  <path d="M4 10l4 -1l4 -1l4 1.5l4 1.5" />
  <path d="M10.007 5a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />`,
  "hanger": `<path d="M14 6a2 2 0 1 0 -4 0c0 1.667 .67 3 2 4h-.008l7.971 4.428a2 2 0 0 1 1.029 1.749v.823a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-.823a2 2 0 0 1 1.029 -1.749l7.971 -4.428" />`,
  "door": `<path d="M14 12v.01" />
  <path d="M3 21h18" />
  <path d="M6 21v-16a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v16" />`,
  "home-2": `<path d="M5 12l-2 0l9 -9l9 9l-2 0" />
  <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7" />
  <path d="M10 12h4v4h-4l0 -4" />`,
  "tools-kitchen-2": `<path d="M19 3v12h-5c-.023 -3.681 .184 -7.406 5 -12m0 12v6h-1v-3m-10 -14v17m-3 -17v3a3 3 0 1 0 6 0v-3" />`,
  "wall": `<path d="M4 6a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2l0 -12" />
  <path d="M4 8h16" />
  <path d="M20 12h-16" />
  <path d="M4 16h16" />
  <path d="M9 4v4" />
  <path d="M14 8v4" />
  <path d="M8 12v4" />
  <path d="M16 12v4" />
  <path d="M11 16v4" />`,
  "stairs": `<path d="M22 5h-5v5h-5v5h-5v5h-5" />`,
  "plug": `<path d="M9.785 6l8.215 8.215l-2.054 2.054a5.81 5.81 0 1 1 -8.215 -8.215l2.054 -2.054" />
  <path d="M4 20l3.5 -3.5" />
  <path d="M15 4l-3.5 3.5" />
  <path d="M20 9l-3.5 3.5" />`,
  "battery-2": `<path d="M6 7h11a2 2 0 0 1 2 2v.5a.5 .5 0 0 0 .5 .5a.5 .5 0 0 1 .5 .5v3a.5 .5 0 0 1 -.5 .5a.5 .5 0 0 0 -.5 .5v.5a2 2 0 0 1 -2 2h-11a2 2 0 0 1 -2 -2v-6a2 2 0 0 1 2 -2" />
  <path d="M7 10l0 4" />
  <path d="M10 10l0 4" />`,
  "grain": `<path d="M3.5 9.5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
  <path d="M8.5 4.5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
  <path d="M8.5 14.5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
  <path d="M3.5 19.5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
  <path d="M13.5 9.5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
  <path d="M18.5 4.5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
  <path d="M13.5 19.5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
  <path d="M18.5 14.5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />`,
  "flower": `<path d="M9 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
  <path d="M12 2a3 3 0 0 1 3 3c0 .562 -.259 1.442 -.776 2.64l-.724 1.36l1.76 -1.893c.499 -.6 .922 -1 1.27 -1.205a2.968 2.968 0 0 1 4.07 1.099a3.011 3.011 0 0 1 -1.09 4.098c-.374 .217 -.99 .396 -1.846 .535l-2.664 .366l2.4 .326c1 .145 1.698 .337 2.11 .576a3.011 3.011 0 0 1 1.09 4.098a2.968 2.968 0 0 1 -4.07 1.098c-.348 -.202 -.771 -.604 -1.27 -1.205l-1.76 -1.893l.724 1.36c.516 1.199 .776 2.079 .776 2.64a3 3 0 0 1 -6 0c0 -.562 .259 -1.442 .776 -2.64l.724 -1.36l-1.76 1.893c-.499 .601 -.922 1 -1.27 1.205a2.968 2.968 0 0 1 -4.07 -1.098a3.011 3.011 0 0 1 1.09 -4.098c.374 -.218 .99 -.396 1.846 -.536l2.664 -.366l-2.4 -.325c-1 -.145 -1.698 -.337 -2.11 -.576a3.011 3.011 0 0 1 -1.09 -4.099a2.968 2.968 0 0 1 4.07 -1.099c.348 .203 .771 .604 1.27 1.205l1.76 1.894c-1 -2.292 -1.5 -3.625 -1.5 -4a3 3 0 0 1 3 -3" />`,
  "leaf": `<path d="M5 21c.5 -4.5 2.5 -8 7 -10" />
  <path d="M9 18c6.218 0 10.5 -3.288 11 -12v-2h-4.014c-9 0 -11.986 4 -12 9c0 1 0 3 2 5h3l.014 0" />`,
  "umbrella-2": `<path d="M5.343 7.343a8 8 0 1 1 11.314 11.314l-11.314 -11.314" />
  <path d="M10.828 13.34l-4.242 4.243a2 2 0 1 0 2.828 2.828" />`,
  "sun-wind": `<path d="M14.468 10a4 4 0 1 0 -5.466 5.46" />
  <path d="M2 12h1" />
  <path d="M11 3v1" />
  <path d="M11 20v1" />
  <path d="M4.6 5.6l.7 .7" />
  <path d="M17.4 5.6l-.7 .7" />
  <path d="M5.3 17.7l-.7 .7" />
  <path d="M15 13h5a2 2 0 1 0 0 -4" />
  <path d="M12 16h5.714l.253 0a2 2 0 0 1 2.033 2a2 2 0 0 1 -2 2h-.286" />`,
  "car-4wd": `<path d="M5 5a2 2 0 0 1 2 -2a2 2 0 0 1 2 2v2a2 2 0 0 1 -2 2a2 2 0 0 1 -2 -2l0 -2" />
  <path d="M5 17a2 2 0 0 1 2 -2a2 2 0 0 1 2 2v2a2 2 0 0 1 -2 2a2 2 0 0 1 -2 -2l0 -2" />
  <path d="M15 5a2 2 0 0 1 2 -2a2 2 0 0 1 2 2v2a2 2 0 0 1 -2 2a2 2 0 0 1 -2 -2l0 -2" />
  <path d="M15 17a2 2 0 0 1 2 -2a2 2 0 0 1 2 2v2a2 2 0 0 1 -2 2a2 2 0 0 1 -2 -2l0 -2" />
  <path d="M9 18h6" />
  <path d="M9 6h6" />
  <path d="M12 6.5v-.5v12" />`,
  "motorbike": `<path d="M2 16a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
  <path d="M16 16a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
  <path d="M7.5 14h5l4 -4h-10.5m1.5 4l4 -4" />
  <path d="M13 6h2l1.5 3l2 4" />`,
  "bike": `<path d="M2 18a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" />
  <path d="M16 18a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" />
  <path d="M12 19v-4l-3 -3l5 -4l2 3h3" />
  <path d="M13.007 5a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />`,
  "bus": `<path d="M4 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
  <path d="M16 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
  <path d="M4 17h-2v-11a1 1 0 0 1 1 -1h14a5 7 0 0 1 5 7v5h-2m-4 0h-8" />
  <path d="M16 5l1.5 7l4.5 0" />
  <path d="M2 10l15 0" />
  <path d="M7 5l0 5" />
  <path d="M12 5l0 5" />`,
  "train": `<path d="M21 13c0 -3.87 -3.37 -7 -10 -7h-8" />
  <path d="M3 15h16a2 2 0 0 0 2 -2" />
  <path d="M3 6v5h17.5" />
  <path d="M3 11v4" />
  <path d="M8 11v-5" />
  <path d="M13 11v-4.5" />
  <path d="M3 19h18" />`,
  "helicopter": `<path d="M3 10l1 2h6" />
  <path d="M12 9a2 2 0 0 0 -2 2v3c0 1.1 .9 2 2 2h7a2 2 0 0 0 2 -2c0 -3.31 -3.13 -5 -7 -5h-2" />
  <path d="M13 9l0 -3" />
  <path d="M5 6l15 0" />
  <path d="M15 9.1v3.9h5.5" />
  <path d="M15 19l0 -3" />
  <path d="M19 19l-8 0" />`,
  "fish-hook": `<path d="M16 9v6a5 5 0 0 1 -10 0v-4l3 3" />
  <path d="M14 7a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
  <path d="M16 5v-2" />`,
  "feather": `<path d="M4 20l10 -10m0 -5v5h5m-9 -1v5h5m-9 -1v5h5m-5 -5l4 -4l4 -4" />
  <path d="M19 10c.638 -.636 1 -1.515 1 -2.486a3.515 3.515 0 0 0 -3.517 -3.514c-.97 0 -1.847 .367 -2.483 1m-3 13l4 -4l4 -4" />`,
  "golf": `<path d="M12 18v-15l7 4l-7 4" />
  <path d="M9 17.67c-.62 .36 -1 .82 -1 1.33c0 1.1 1.8 2 4 2s4 -.9 4 -2c0 -.5 -.38 -.97 -1 -1.33" />`,
  "run": `<path d="M11.007 5a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
  <path d="M4 17l5 1l.75 -1.5" />
  <path d="M15 21v-4l-4 -3l1 -6" />
  <path d="M7 12v-3l5 -1l3 3l3 1" />`,
  "walk": `<path d="M12 4a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
  <path d="M7 21l3 -4" />
  <path d="M16 21l-2 -4l-3 -3l1 -6" />
  <path d="M6 12l2 -3l4 -1l3 3l3 1" />`,
  "backpack": `<path d="M5 18v-6a6 6 0 0 1 6 -6h2a6 6 0 0 1 6 6v6a3 3 0 0 1 -3 3h-8a3 3 0 0 1 -3 -3" />
  <path d="M10 6v-1a2 2 0 1 1 4 0v1" />
  <path d="M9 21v-4a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v4" />
  <path d="M11 10h2" />`,
  "world": `<path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" />
  <path d="M3.6 9h16.8" />
  <path d="M3.6 15h16.8" />
  <path d="M11.5 3a17 17 0 0 0 0 18" />
  <path d="M12.5 3a17 17 0 0 1 0 18" />`,
  "map": `<path d="M3 7l6 -3l6 3l6 -3v13l-6 3l-6 -3l-6 3v-13" />
  <path d="M9 4v13" />
  <path d="M15 7v13" />`,
  "gift": `<path d="M3 9a1 1 0 0 1 1 -1h16a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-16a1 1 0 0 1 -1 -1l0 -2" />
  <path d="M12 8l0 13" />
  <path d="M19 12v7a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-7" />
  <path d="M7.5 8a2.5 2.5 0 0 1 0 -5a4.8 8 0 0 1 4.5 5a4.8 8 0 0 1 4.5 -5a2.5 2.5 0 0 1 0 5" />`,
  "thermometer": `<path d="M19 5a2.828 2.828 0 0 1 0 4l-8 8h-4v-4l8 -8a2.828 2.828 0 0 1 4 0" />
  <path d="M16 7l-1.5 -1.5" />
  <path d="M13 10l-1.5 -1.5" />
  <path d="M10 13l-1.5 -1.5" />
  <path d="M7 17l-3 3" />`,
  "pill": `<path d="M4.5 12.5l8 -8a4.94 4.94 0 0 1 7 7l-8 8a4.94 4.94 0 0 1 -7 -7" />
  <path d="M8.5 8.5l7 7" />`,
  "vaccine": `<path d="M17 3l4 4" />
  <path d="M19 5l-4.5 4.5" />
  <path d="M11.5 6.5l6 6" />
  <path d="M16.5 11.5l-6.5 6.5h-4v-4l6.5 -6.5" />
  <path d="M7.5 12.5l1.5 1.5" />
  <path d="M10.5 9.5l1.5 1.5" />
  <path d="M3 21l3 -3" />`,
  "bandage": `<path d="M14 12l0 .01" />
  <path d="M10 12l0 .01" />
  <path d="M12 10l0 .01" />
  <path d="M12 14l0 .01" />
  <path d="M4.5 12.5l8 -8a4.94 4.94 0 0 1 7 7l-8 8a4.94 4.94 0 0 1 -7 -7" />`,
  "ballpen": `<path d="M14 6l7 7l-4 4" />
  <path d="M5.828 18.172a2.828 2.828 0 0 0 4 0l10.586 -10.586a2 2 0 0 0 0 -2.829l-1.171 -1.171a2 2 0 0 0 -2.829 0l-10.586 10.586a2.828 2.828 0 0 0 0 4" />
  <path d="M4 20l1.768 -1.768" />`,
  "printer": `<path d="M17 17h2a2 2 0 0 0 2 -2v-4a2 2 0 0 0 -2 -2h-14a2 2 0 0 0 -2 2v4a2 2 0 0 0 2 2h2" />
  <path d="M17 9v-4a2 2 0 0 0 -2 -2h-6a2 2 0 0 0 -2 2v4" />
  <path d="M7 15a2 2 0 0 1 2 -2h6a2 2 0 0 1 2 2v4a2 2 0 0 1 -2 2h-6a2 2 0 0 1 -2 -2l0 -4" />`,
  "archive": `<path d="M3 6a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2" />
  <path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-10" />
  <path d="M10 12l4 0" />`,
  "shield-check": `<path d="M11.46 20.846a12 12 0 0 1 -7.96 -14.846a12 12 0 0 0 8.5 -3a12 12 0 0 0 8.5 3a12 12 0 0 1 -.09 7.06" />
  <path d="M15 19l2 2l4 -4" />`,
  "currency-dollar": `<path d="M16.7 8a3 3 0 0 0 -2.7 -2h-4a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6h-4a3 3 0 0 1 -2.7 -2" />
  <path d="M12 3v3m0 12v3" />`,
  "wallet": `<path d="M17 8v-3a1 1 0 0 0 -1 -1h-10a2 2 0 0 0 0 4h12a1 1 0 0 1 1 1v3m0 4v3a1 1 0 0 1 -1 1h-12a2 2 0 0 1 -2 -2v-12" />
  <path d="M20 12v4h-4a2 2 0 0 1 0 -4h4" />`
};
