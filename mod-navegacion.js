/**
 * MÓDULO NAVEGACIÓN
 * ------------------------------------------------------------
 * Estructura general de la app: barra lateral en PC, barra inferior
 * + panel "Más" en Android. Registra las 8 secciones con un
 * "próximamente" por defecto; cuando el módulo real de cada sección
 * se cargue (mod-clientes.js, mod-facturas.js...), su propio
 * registro sustituye a este placeholder.
 *
 * ⚠️ Debe cargarse ANTES que los módulos de pantalla en index.html,
 * para que el registro real de cada uno pueda sustituir al
 * placeholder y no al revés.
 */

// MENÚ REORGANIZADO (26/09/2026, elección del propietario):
// - Orden según el camino del dinero: Presupuestos → Facturas →
//   Contabilidad → Impuestos; después Clientes y Plantillas, que son de
//   apoyo. Mis datos y Configuración, abajo y más pequeños.
// - Iconos con formas distintas entre sí, para reconocer cada sección
//   sin leer: solo Facturas parece un documento (el recibo con € del
//   icono de la app); monedas, edificio de Hacienda, capas...
// - `grupo` decide dónde va la línea divisoria en el PC: se pinta una
//   línea cada vez que cambia el grupo. `abajo` = zona inferior pequeña.
const MENU = [
  { id: 'dashboard', titulo: 'Inicio', icono: 'ti-home', grupo: 1 },
  { id: 'presupuestos', titulo: 'Presupuestos', icono: 'ti-file-text', grupo: 2 },
  { id: 'facturas', titulo: 'Facturas', icono: 'ti-receipt-euro', grupo: 2 },
  { id: 'contabilidad', titulo: 'Contabilidad', icono: 'ti-coins', grupo: 2 },
  { id: 'impuestos', titulo: 'Impuestos', icono: 'ti-building-bank', grupo: 2 },
  { id: 'clientes', titulo: 'Clientes', icono: 'ti-users', grupo: 3 },
  { id: 'plantillas', titulo: 'Plantillas', icono: 'ti-stack-2', grupo: 3 },
  { id: 'misdatos', titulo: 'Mis datos', icono: 'ti-user-circle', abajo: true },
  { id: 'configuracion', titulo: 'Configuración', icono: 'ti-adjustments-horizontal', abajo: true }
];

// Móvil: 4 accesos directos en la barra inferior + "Más" con el resto.
// Panel "Más" (26/09/2026): baldosas grandes para las secciones de uso
// normal y, debajo, una línea pequeña para Mis datos y Configuración.
const MOVIL_DIRECTOS = ['dashboard', 'presupuestos', 'facturas', 'contabilidad'];
const MOVIL_MAS = ['impuestos', 'clientes', 'plantillas'];
const MOVIL_MAS_PIE = ['misdatos', 'configuracion'];

// ============================================================
// 1. PLACEHOLDER PARA SECCIONES TODAVÍA NO CONSTRUIDAS
// ============================================================

MENU.forEach(function (item) {
  registrarVista(item.id, {
    titulo: item.titulo,
    pintar: function () { pintarProximamente(item.titulo); }
  });
});

function pintarProximamente(titulo) {
  document.getElementById('contenido').innerHTML =
    '<div class="proximamente"><i class="ti ti-tools"></i>' +
    '<p>' + escaparHtml(titulo) + ' todavía no está construido.</p></div>';
}

// ============================================================
// 2. PINTADO DE LA NAVEGACIÓN
// ============================================================

function pintarNavegacion() {
  pintarNavPc();
  pintarNavMovil();
}

function botonMenu(item, clases) {
  return '<button type="button" class="nav-item' +
    (item.id === vistaActiva ? ' activa' : '') +
    (clases ? ' ' + clases : '') +
    '" data-vista="' + item.id + '">' +
    '<i class="ti ' + item.icono + '" aria-hidden="true"></i><span>' + escaparHtml(item.titulo) + '</span></button>';
}

function pintarNavPc() {
  const nav = document.getElementById('nav-pc');
  if (!nav) return;

  let grupoAnterior = null;
  let primeroDeAbajo = true;
  nav.innerHTML = MENU.map(function (item) {
    if (item.abajo) {
      const clases = 'nav-pequeno' + (primeroDeAbajo ? ' nav-separador' : '');
      primeroDeAbajo = false;
      return botonMenu(item, clases);
    }
    const linea = grupoAnterior !== null && item.grupo !== grupoAnterior ? '<div class="nav-linea" aria-hidden="true"></div>' : '';
    grupoAnterior = item.grupo;
    return linea + botonMenu(item, '');
  }).join('');

  nav.querySelectorAll('[data-vista]').forEach(function (boton) {
    boton.addEventListener('click', function () { cambiarVista(boton.dataset.vista); });
  });
}

function pintarNavMovil() {
  const nav = document.getElementById('nav-movil');
  if (!nav) return;

  const directos = MOVIL_DIRECTOS.map(function (id) {
    return MENU.find(function (m) { return m.id === id; });
  });
  const masActivo = MOVIL_MAS.indexOf(vistaActiva) !== -1 || MOVIL_MAS_PIE.indexOf(vistaActiva) !== -1;

  nav.innerHTML = directos.map(function (item) { return botonMenu(item); }).join('') +
    '<button type="button" class="nav-item' + (masActivo ? ' activa' : '') + '" id="btn-mas">' +
    '<i class="ti ti-dots" aria-hidden="true"></i><span>Más</span></button>';

  nav.querySelectorAll('[data-vista]').forEach(function (boton) {
    boton.addEventListener('click', function () { cambiarVista(boton.dataset.vista); });
  });
  document.getElementById('btn-mas').addEventListener('click', abrirPanelMas);
}

// ============================================================
// 3. PANEL "MÁS" (solo móvil)
// ============================================================

function abrirPanelMas() {
  const panel = document.getElementById('panel-mas');
  if (!panel) return;

  const buscar = function (id) { return MENU.find(function (m) { return m.id === id; }); };

  panel.innerHTML =
    '<div class="panel-mas-fondo"></div>' +
    '<div class="panel-mas-hoja">' +
      '<div class="panel-mas-rejilla">' +
        MOVIL_MAS.map(buscar).map(function (item) {
          return '<button type="button" class="panel-mas-baldosa' + (item.id === vistaActiva ? ' activa' : '') + '" data-vista="' + item.id + '">' +
            '<i class="ti ' + item.icono + '" aria-hidden="true"></i><span>' + escaparHtml(item.titulo) + '</span></button>';
        }).join('') +
      '</div>' +
      '<div class="panel-mas-pie">' +
        MOVIL_MAS_PIE.map(buscar).map(function (item) {
          return '<button type="button" class="panel-mas-pequeno' + (item.id === vistaActiva ? ' activa' : '') + '" data-vista="' + item.id + '">' +
            '<i class="ti ' + item.icono + '" aria-hidden="true"></i>' + escaparHtml(item.titulo) + '</button>';
        }).join('') +
      '</div>' +
    '</div>';

  panel.classList.add('abierto');
  panel.querySelector('.panel-mas-fondo').addEventListener('click', cerrarPanelMas);
  panel.querySelectorAll('[data-vista]').forEach(function (boton) {
    boton.addEventListener('click', function () {
      cambiarVista(boton.dataset.vista);
      cerrarPanelMas();
    });
  });
}

function cerrarPanelMas() {
  const panel = document.getElementById('panel-mas');
  if (panel) panel.classList.remove('abierto');
}

// ============================================================
// 4. REGISTRO EN EL NÚCLEO
// ============================================================
// Se engancha como "pintador": se ejecuta al arrancar y tras cada
// sincronización, para mantener resaltada la sección activa.

pintadores.push(pintarNavegacion);
