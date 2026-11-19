// Service worker: lưu khung app để mở được khi mất mạng.
// Đổi VERSION mỗi lần cập nhật code để máy học viên nhận bản mới.
const VERSION = 'hinoki-learn-v4';
const FILES = ['./', 'index.html', 'style.css', 'app.js', 'demo-cards.js', 'kana-strokes.js', 'viet-chu.js', 'vendor/ts-fsrs-6.0.0.umd.js', 'manifest.json', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Ưu tiên mạng (luôn lấy bản mới nhất), mất mạng thì dùng bản đã lưu.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req).then((res) => {
      if (res.status === 200) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('index.html')))
  );
});
