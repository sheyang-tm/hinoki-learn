// Service worker: lưu khung app để mở được khi mất mạng.
// Đổi VERSION mỗi lần cập nhật code để máy học viên nhận bản mới.
const VERSION = 'hinoki-learn-v6';
const FONT_CACHE = 'hinoki-fonts-v1'; // không xóa khi đổi VERSION
const FILES = ['./', 'index.html', 'style.css', 'app.js', 'demo-cards.js', 'kana-strokes.js', 'viet-chu.js', 'vendor/ts-fsrs-6.0.0.umd.js', 'manifest.json', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION && k !== FONT_CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Ưu tiên mạng (luôn lấy bản mới nhất), mất mạng thì dùng bản đã lưu.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Font Google (chữ trên thẻ): lưu lần đầu, sau đó dùng bản đã lưu để chạy được khi mất mạng
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONT_CACHE).then((c) => c.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok || res.type === 'opaque') c.put(req, res.clone());
      return res;
    }))));
    return;
  }
  if (url.origin !== location.origin) return;
  e.respondWith(
    // cache: 'no-cache' = luôn hỏi máy chủ bản mới, không dùng bản trình duyệt lưu đệm (GitHub Pages đệm 10 phút)
    fetch(req, { cache: 'no-cache' }).then((res) => {
      if (res.status === 200) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('index.html')))
  );
});
