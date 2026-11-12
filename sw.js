/* Service worker — fórmula app-um-so (peça 2: cache:'reload' ao buscar o app). */
const VER = 'vetig-0.15.0';
const ARQ = ['./', 'index.html', 'app.js', 'dados.js', 'icones.js', 'config.js', 'auth.js', 'nuvem.js', 'arquivos.js', 'rt.js', 'avisos-vet.js', 'lib/jszip.min.js', 'simbolo.png', 'icon-192.png', 'manifest.webmanifest'];
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

/* ---------- avisos no celular (push) ----------
   Quem manda é o servidor (função vet-agenda), chamado pelo banco quando chega
   pedido de horário e pelo relógio 30 min antes de cada visita. */
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { title: 'Dra. Ingrid', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Dra. Ingrid', {
    body: d.body || '', tag: d.tag || 'aviso', renotify: true,
    icon: 'icon-192.png', badge: 'icon-192.png', vibrate: [120, 80, 120],
    data: { url: d.url || './#/' },
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const alvo = new URL((e.notification.data && e.notification.data.url) || './#/', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(abertas => {
    for (const c of abertas) if (c.url.startsWith(self.registration.scope)) { c.navigate(alvo).catch(() => { }); return c.focus(); }
    return self.clients.openWindow(alvo);
  }));
});
