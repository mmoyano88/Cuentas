/**
 * SERVICE WORKER — permite que la app abra al instante y funcione
 * sin conexión.
 *
 * Estrategia (09/09/2026, bloque de Rendimiento — ver diario):
 *   - Código propio de la app (JS/CSS/iconos/manifest) y las dos
 *     librerías del CDN: CACHÉ PRIMERO. Se sirven al instante desde
 *     la copia guardada sin esperar a la red; en paralelo se pide la
 *     versión más reciente para tenerla lista la próxima vez. Es
 *     seguro porque solo cambian cuando se sube un VERSION nuevo, y
 *     al hacerlo el caché entero se descarta (ver "activate" abajo).
 *   - Backend de Apps Script: SIEMPRE red, nunca caché — los datos
 *     deben venir frescos de Google Sheets. Sin cambios respecto a
 *     antes.
 *
 * ⚠️ Al cambiar cualquier archivo de la app, subir también este con
 * el número de VERSION aumentado (v2, v3...). Eso obliga al móvil a
 * tirar la copia vieja.
 */

const VERSION = 'cuentas-v23';

const ARCHIVOS = [
  './',
  './index.html',
  './app.css',
  './app.js',
  './iconos-contacto.js',
  './mod-navegacion.css',
  './mod-navegacion.js',
  './mod-dashboard.css',
  './mod-dashboard.js',
  './mod-configuracion.css',
  './mod-configuracion.js',
  './mod-pdf-documentos.js',
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
  'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.46.0/dist/tabler-icons.min.css',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js'
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

  // Código propio y CDNs: caché primero, con refresco en segundo
  // plano. Se sirve al instante lo guardado (si existe) y, sin hacer
  // esperar a la app, se pide igualmente la versión de red para
  // dejarla lista de cara a la próxima apertura.
  evento.respondWith(
    caches.match(peticion).then(function (guardada) {
      const actualizacionEnSegundoPlano = fetch(peticion)
        .then(function (respuesta) {
          const copia = respuesta.clone();
          caches.open(VERSION).then(function (cache) {
            cache.put(peticion, copia).catch(function () { /* se ignora */ });
          });
          return respuesta;
        })
        .catch(function () { return null; });

      // Si ya había copia guardada, se devuelve al instante (no se
      // espera a la red). Si no la había (primera vez, o archivo
      // nuevo que aún no se guardó), se espera a la red y, si
      // también falla, se cae a la portada como último recurso.
      return guardada || actualizacionEnSegundoPlano.then(function (resp) {
        return resp || caches.match('./index.html');
      });
    })
  );
});
