/* ═══════════════════════════════════════════════════════════════════
   VESSEL GAMES · Service worker

   Su único trabajo es que la app abra rápido y no se caiga si el
   teléfono pierde señal un momento. NO cachea la tienda de forma
   agresiva a propósito:

   · La página (index.html) va SIEMPRE a la red primero. Si se sirviera
     de caché, un cliente podría quedarse días con precios viejos, y
     cada vez que subimos un cambio tendría que borrar datos del
     navegador para verlo. Solo si no hay señal se le da la copia
     guardada, para que al menos vea algo.

   · Los iconos y las imágenes fijas sí van de caché primero: no
     cambian y ahorran datos.

   · Supabase, imgur, bing y cualquier otro dominio NO se tocan. Los
     pedidos, el chat y los precios tienen que ser siempre en vivo.

   Para forzar que todos los clientes reciban una versión nueva del
   propio service worker, sube el número de VERSION.
   ═══════════════════════════════════════════════════════════════════ */

const VERSION = 'vg-v1';
const CACHE_PAGINA  = VERSION + '-pagina';
const CACHE_ESTATIC = VERSION + '-estaticos';

/* Lo mínimo para que la app abra sin señal */
const BASICOS = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/logo.png'
];

self.addEventListener('install', (ev) => {
  ev.waitUntil(
    caches.open(CACHE_ESTATIC)
      .then((c) => c.addAll(BASICOS).catch(() => {}))
      /* No esperar a que se cierren las pestañas viejas */
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(
        claves.filter((k) => !k.startsWith(VERSION))
              .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

function esEstatico(url) {
  return /\.(png|jpg|jpeg|webp|gif|svg|ico|woff2?)$/i.test(url.pathname);
}

self.addEventListener('fetch', (ev) => {
  const req = ev.request;

  /* Solo GET del mismo sitio. Todo lo demás (Supabase, imgur, bing,
     y cualquier POST) pasa de largo sin que el service worker opine. */
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;

  /* ── La página: red primero ── */
  if (req.mode === 'navigate' || req.destination === 'document') {
    ev.respondWith(
      fetch(req)
        .then((resp) => {
          const copia = resp.clone();
          caches.open(CACHE_PAGINA).then((c) => c.put('/', copia)).catch(() => {});
          return resp;
        })
        .catch(() => caches.match('/').then((r) => r || caches.match(req)))
    );
    return;
  }

  /* ── Imágenes y fuentes propias: caché primero ── */
  if (esEstatico(url)) {
    ev.respondWith(
      caches.match(req).then((guardada) => {
        if (guardada) return guardada;
        return fetch(req).then((resp) => {
          if (resp && resp.status === 200) {
            const copia = resp.clone();
            caches.open(CACHE_ESTATIC).then((c) => c.put(req, copia)).catch(() => {});
          }
          return resp;
        });
      })
    );
    return;
  }

  /* El resto, directo a la red */
});

/* Permite que la página pida activar de inmediato una versión nueva */
self.addEventListener('message', (ev) => {
  if (ev.data === 'vg-actualizar') self.skipWaiting();
});
