/**
 * MÓDULO NAVEGACIÓN
 * ------------------------------------------------------------
 * Estructura general de la app: barra lateral en PC, barra inferior
 * + panel "Más" en Android. Registra las 7 secciones con un
 * "próximamente" por defecto; cuando el módulo real de cada sección
 * se cargue (mod-clientes.js, mod-facturas.js...), su propio
 * registro sustituye a este placeholder.
 *
 * ⚠️ Debe cargarse ANTES que los módulos de pantalla en index.html,
 * para que el registro real de cada uno pueda sustituir al
 * placeholder y no al revés.
 */

const MENU = [
  { id: 'dashboard', titulo: 'Inicio', icono: 'ti-home' },
  { id: 'clientes', titulo: 'Clientes', icono: 'ti-users' },
  { id: 'presupuestos', titulo: 'Presupuestos', icono: 'ti-file-text' },
  { id: 'facturas', titulo: 'Facturas', icono: 'ti-receipt-2' },
  { id: 'contabilidad', titulo: 'Contabilidad', icono: 'ti-report-money' },
  { id: 'impuestos', titulo: 'Impuestos', icono: 'ti-percentage' },
  { id: 'configuracion', titulo: 'Configuración', icono: 'ti-settings' }
];

// Móvil: 4 accesos directos en la barra inferior + "Más" con el resto.
const MOVIL_DIRECTOS = ['dashboard', 'presupuestos', 'facturas', 'contabilidad'];
const MOVIL_MAS = MENU.map(function (m) { return m.id; })
  .filter(function (id) { return MOVIL_DIRECTOS.indexOf(id) === -1; });

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

  nav.innerHTML = MENU.map(function (item) {
    return botonMenu(item, item.id === 'configuracion' ? 'nav-separador' : '');
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
  const masActivo = MOVIL_MAS.indexOf(vistaActiva) !== -1;

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

  const items = MOVIL_MAS.map(function (id) {
    return MENU.find(function (m) { return m.id === id; });
  });

  panel.innerHTML =
    '<div class="panel-mas-fondo"></div>' +
    '<div class="panel-mas-hoja">' +
      items.map(function (item) {
        return '<button type="button" class="panel-mas-item" data-vista="' + item.id + '">' +
          '<i class="ti ' + item.icono + '" aria-hidden="true"></i>' + escaparHtml(item.titulo) + '</button>';
      }).join('') +
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
