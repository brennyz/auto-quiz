// Bij elke wijziging versie verhogen zodat iedereen de nieuwste app krijgt
const CACHE = 'auto-quiz-v6';

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(['/', 'index.html', 'styles.css', 'app.js', 'manifest.json', '/bg.png', 'data/questions.json']);
    }).then(function () { return self.skipWaiting(); }).catch(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return k !== CACHE ? caches.delete(k) : Promise.resolve();
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

function isAppShell(url) {
  try {
    var path = new URL(url).pathname;
    return path === '/' || path === '/index.html' || path.endsWith('app.js') || path.endsWith('styles.css') || path.endsWith('manifest.json');
  } catch (_) { return false; }
}

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  if (isAppShell(e.request.url)) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' })
        .then(function (r) {
          if (!r || r.status !== 200 || r.type !== 'basic') return r;
          var clone = r.clone();
          caches.open(CACHE).then(function (cache) { cache.put(e.request, clone); });
          return r;
        })
        .catch(function () { return caches.match(e.request); })
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(function (r) {
      return r || fetch(e.request);
    })
  );
});
