/* Service worker — fórmula app-um-so (peça 2: cache:'reload' ao buscar o app). */
const VER = 'vetig-0.5.0';
const ARQ = ['./', 'index.html', 'app.js', 'dados.js', 'icones.js', 'config.js', 'auth.js', 'nuvem.js', 'simbolo.png', 'icon-192.png', 'manifest.webmanifest'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VER).then(c => Promise.all(ARQ.map(u => fetch(u, { cache: 'reload' }).then(r => c.put(u, r))))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('vetig-') && k !== VER).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request, { cache: 'reload' }).then(r => { const c = r.clone(); caches.open(VER).then(k => k.put(e.request, c)); return r; })
    .catch(() => caches.match(e.request).then(r => r || caches.match('index.html'))));
});
