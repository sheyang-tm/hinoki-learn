// Service worker: lưu khung app để mở được khi mất mạng.
// Đổi VERSION mỗi lần cập nhật code để máy học viên nhận bản mới.
const VERSION = 'hinoki-learn-v13';
const FONT_CACHE = 'hinoki-fonts-v1'; // không xóa khi đổi VERSION
// Giọng đọc: tên file mp3 = mã băm của chữ (tools/tao-giong.js) -> file không đổi, lưu luôn, không hỏi lại mạng.
// Tạo lại 1 file cùng tên (vd sửa file câm) thì đổi số AUDIO_CACHE để máy học viên tải lại.
const AUDIO_CACHE = 'hinoki-audio-v2';
const FILES = ['./', 'index.html', 'style.css', 'app.js', 'demo-cards.js', 'kana-strokes.js', 'viet-chu.js', 'vendor/ts-fsrs-6.0.0.umd.js', 'manifest.json', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION && k !== FONT_CACHE && k !== AUDIO_CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
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
  if (url.pathname.includes('/audio/')) {
    if (req.headers.has('range')) return; // thẻ <audio> xin từng đoạn (206) -> để trình duyệt tự xử lý
    // index.json: trả ngay bản đã lưu, cập nhật ở nền (lần mở sau có bản mới). mp3: đã lưu thì dùng luôn.
    const isIndex = url.pathname.endsWith('/index.json');
    e.respondWith(caches.open(AUDIO_CACHE).then((c) => c.match(req, { ignoreSearch: true }).then((hit) => {
      const net = () => fetch(req, { cache: 'no-cache' }).then((res) => { if (res.status === 200) c.put(req, res.clone()); return res; });
      if (!hit) return net();
      if (isIndex) e.waitUntil(net().catch(() => {}));
      return hit;
    })));
    return;
  }
  e.respondWith(
    // cache: 'no-cache' = luôn hỏi máy chủ bản mới, không dùng bản trình duyệt lưu đệm (GitHub Pages đệm 10 phút)
    fetch(req, { cache: 'no-cache' }).then((res) => {
      if (res.status === 200) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('index.html')))
  );
});
