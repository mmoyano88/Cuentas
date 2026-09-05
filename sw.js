/**
 * SERVICE WORKER — permite que la app abra al instante y funcione
 * sin conexión.
 *
 * Estrategia: se intenta siempre traer la versión más reciente de
 * cada archivo; si no hay conexión, se usa la copia guardada. Así la
 * app nunca se queda "pillada" en una versión antigua tras una
 * actualización, y sigue abriendo aunque no haya cobertura.
 *
 * ⚠️ Al cambiar cualquier archivo de la app, subir también este con
 * el número de VERSION aumentado (v2, v3...). Eso obliga al móvil a
 * tirar la copia vieja.
 */

const VERSION = 'cuentas-v20';

const ARCHIVOS = [
  './',
  './index.html',
  './app.css',
  './app.js',
  './iconos-contacto.js',
  './mod-navegacion.css',
  './mod-navegacion.js',
  './mod-configuracion.css',
  './mod-configuracion.js',
  './mod-clientes.css',
  './mod-clientes.js',
  './mod-presupuestos.css',
  './mod-presupuestos.js',
  './mod-facturas-venta.css',
  './mod-facturas-venta.js',
  './mod-facturas-compra.css',
  './mod-facturas-compra.js',
  './mod-contabilidad.css',
  './mod-contabilidad.js',
  './mod-impuestos.css',
  './mod-impuestos.js',
  './mod-informes.css',
  './mod-informes.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.46.0/dist/tabler-icons.min.css'
];

self.addEventListener('install', function (evento) {
  evento.waitUntil(
    caches.open(VERSION)
      .then(function (cache) {
        // Se añaden de uno en uno para que un fallo puntual (por
        // ejemplo el CDN de iconos) no impida instalar el resto.
        return Promise.all(ARCHIVOS.map(function (url) {
          return cache.add(url).catch(function () { /* se ignora */ });
        }));
      })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (evento) {
  evento.waitUntil(
    caches.keys()
      .then(function (nombres) {
        return Promise.all(nombres
          .filter(function (n) { return n !== VERSION; })
          .map(function (n) { return caches.delete(n); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (evento) {
  const peticion = evento.request;

  // Las llamadas al backend (Apps Script) nunca se guardan en caché:
  // los datos deben venir siempre frescos de Google Sheets.
  if (peticion.method !== 'GET') return;
  if (peticion.url.indexOf('script.google.com') !== -1) return;

  evento.respondWith(
    fetch(peticion)
      .then(function (respuesta) {
        const copia = respuesta.clone();
        caches.open(VERSION).then(function (cache) {
          cache.put(peticion, copia).catch(function () { /* se ignora */ });
        });
        return respuesta;
      })
      .catch(function () {
        return caches.match(peticion).then(function (guardada) {
          return guardada || caches.match('./index.html');
        });
      })
  );
});
