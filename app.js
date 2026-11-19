/* Hinoki Learn — app ôn thẻ kiểu Anki (MVP)
 * Thuật toán: ts-fsrs 6.0.0 (MIT). Kho dữ liệu: Google Sheet qua Apps Script, hoặc DEMO (lưu trên máy).
 * Không lưu tên, email, SĐT, ảnh học viên. Chỉ mã HVxx, PIN (băm ở máy chủ), lịch sử ôn.
 */
'use strict';

const F = window.FSRS;
const scheduler = F.fsrs(F.generatorParameters({ enable_fuzz: true, request_retention: 0.9, maximum_interval: 365 }));
const FSRS_FIELDS = ['due', 'stability', 'difficulty', 'scheduled_days', 'learning_steps', 'reps', 'lapses', 'state', 'last_review'];
const MAX_SESSION = { teen: 40, kid: 15 };
const MAX_REPEAT_IN_SESSION = 3; // một thẻ quên lặp lại tối đa 3 lần trong 1 phiên
// Tên hiển thị cho bộ thẻ (cột bo_the). Không có trong bảng thì tự đổi: minna-03 -> "Minna Bài 3", kanji-03 -> "Kanji Bài 3".
const DECK_NAMES = { hiragana: 'Hiragana', katakana: 'Katakana', 'mau-sac': 'Màu sắc', 'con-vat': 'Con vật', 'tu-anime': 'Từ anime', kanji: 'Kanji' };
const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

// ---------- Tiện ích ----------
const $ = (id) => document.getElementById(id);
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* bộ nhớ đầy hoặc bị chặn */ } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* bỏ qua */ } }
};
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const truthy = (v) => v === true || String(v).trim().toUpperCase() === 'TRUE';

function fmtInterval(ms) {
  const m = Math.max(1, Math.round(ms / 60000));
  if (m < 60) return m + ' phút';
  const h = Math.round(m / 60);
  if (h < 24) return h + ' giờ';
  const d = Math.round(h / 24);
  if (d < 30) return d + ' ngày';
  return Math.round(d / 30) + ' tháng';
}

// Thẻ FSRS <-> JSON (chỉ giữ trường của FSRS, thêm first_review của app)
function toFsrs(o) {
  const c = {};
  FSRS_FIELDS.forEach((k) => { if (o[k] !== undefined && o[k] !== null) c[k] = o[k]; });
  c.due = new Date(c.due);
  if (c.last_review) c.last_review = new Date(c.last_review);
  return c;
}
function fromFsrs(card, firstReview) {
  const o = {};
  FSRS_FIELDS.forEach((k) => { if (card[k] !== undefined) o[k] = card[k]; });
  o.due = new Date(card.due).toISOString();
  if (card.last_review) o.last_review = new Date(card.last_review).toISOString();
  o.first_review = firstReview;
  return o;
}
function normCard(c) {
  return {
    the_id: String(c.the_id), ma_hv: String(c.ma_hv || ''), bo_the: String(c.bo_the || ''),
    mat_truoc: String(c.mat_truoc || ''), cach_doc: String(c.cach_doc || ''), mat_sau: String(c.mat_sau || ''),
    vi_du: String(c.vi_du || ''), hinh: String(c.hinh || ''), doc_tieng: String(c.doc_tieng || ''),
    tu_phat_am: truthy(c.tu_phat_am), buoi: Number(c.buoi) || 0
  };
}

// ---------- Kho dữ liệu: DEMO (trên máy) ----------
const Demo = {
  db() { return LS.get('hl_demo_db', { progress: {}, history: [] }); },
  async login(ma, pin) {
    const s = window.HINOKI_DEMO.students[ma];
    if (!s || s.pin !== pin) throw new Error('Sai mã học viên hoặc PIN.');
    return { token: 'demo.' + ma, hv: { ma_hv: ma, giao_dien: s.giao_dien, so_the_moi_ngay: s.so_the_moi_ngay } };
  },
  async load(token) {
    const ma = token.slice(5);
    const db = this.db();
    return {
      cards: window.HINOKI_DEMO.cards.filter((c) => c.ma_hv === ma || c.ma_hv === 'ALL'),
      progress: db.progress[ma] || {},
      days: [...new Set(db.history.filter((h) => h.ma_hv === ma).map((h) => h.ngay_hoc))]
    };
  },
  async sync(token, reviews) {
    const ma = token.slice(5);
    const db = this.db();
    const seen = new Set(db.history.map((h) => h.ma_on));
    db.progress[ma] = db.progress[ma] || {};
    reviews.forEach((r) => {
      if (seen.has(r.ma_on)) return;
      db.history.push({ thoi_gian: r.thoi_gian, ma_hv: ma, the_id: r.the_id, danh_gia: r.danh_gia, thoi_gian_tra_loi_ms: r.ms, ngay_hoc: r.ngay_hoc, ma_on: r.ma_on });
      db.progress[ma][r.the_id] = r.card;
    });
    LS.set('hl_demo_db', db);
    return { ok: true, saved: reviews.length };
  },
  async teacher(key) {
    if (key !== window.HINOKI_DEMO.teacherKey) throw new Error('Sai mã giáo viên.');
    const db = this.db();
    const progress = [];
    Object.keys(db.progress).forEach((ma) => Object.keys(db.progress[ma]).forEach((id) => progress.push({ ma_hv: ma, the_id: id, card: db.progress[ma][id] })));
    const students = Object.keys(window.HINOKI_DEMO.students).map((ma) => ({ ma_hv: ma, giao_dien: window.HINOKI_DEMO.students[ma].giao_dien, so_the_moi_ngay: window.HINOKI_DEMO.students[ma].so_the_moi_ngay }));
    return { students, cards: window.HINOKI_DEMO.cards, progress, history: db.history };
  }
};

// ---------- Kho dữ liệu: Google Sheet qua Apps Script ----------
const Sheet = {
  async call(action, payload) {
    // Gửi text/plain để tránh lỗi CORS với Apps Script
    const res = await fetch(App.api, { method: 'POST', body: JSON.stringify(Object.assign({ action }, payload)), redirect: 'follow' });
    if (!res.ok) throw new Error('Máy chủ lỗi (' + res.status + ').');
    let j;
    try { j = await res.json(); } catch (e) {
      // Apps Script trả trang HTML khi deploy sai quyền truy cập hoặc chưa cấp quyền
      throw new Error('Máy chủ chưa sẵn sàng (Apps Script trả về trang lỗi). Kiểm tra bước deploy: "Ai có quyền truy cập: Bất kỳ ai".');
    }
    if (!j.ok) throw new Error(j.error || 'Máy chủ báo lỗi.');
    return j;
  },
  login(ma, pin) { return this.call('login', { ma_hv: ma, pin }); },
  load(token) { return this.call('load', { token }); },
  sync(token, reviews) { return this.call('sync', { token, reviews }); },
  teacher(key) { return this.call('teacher', { key }); }
};

// ---------- Trạng thái app ----------
const App = {
  api: '', backend: Demo,
  hv: null, token: null,
  cards: [], progress: {}, days: [],
  queue: [], cur: null, shownAt: 0, flipped: false,
  session: { done: 0, again: 0, total: 0, repeats: {} }
};

function initServer() {
  const params = new URLSearchParams(location.search);
  const p = params.get('api');
  if (p !== null) {
    const cur = LS.get('hl_api', '');
    // Link cài đặt chỉ đổi máy chủ khi người dùng xác nhận (chống link giả thu PIN)
    if ((p === '' || p === 'demo') && cur) { if (confirm('Chuyển app về chế độ DEMO?')) LS.del('hl_api'); }
    else if (/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(p) && p !== cur) {
      if (confirm('Kết nối app với máy chủ:\n' + p + '\n\nChỉ bấm OK nếu link này do giáo viên Hinoki gửi trực tiếp.')) { LS.set('hl_api', p); LS.del('hl_session'); }
    }
    params.delete('api');
    const q = params.toString();
    history.replaceState(null, '', location.pathname + (q ? '?' + q : '') + location.hash);
  }
  App.api = LS.get('hl_api', '');
  App.backend = App.api ? Sheet : Demo;
  const b = $('banner');
  if (!App.api) { b.textContent = 'Chế độ DEMO — dữ liệu giả, chỉ lưu trên máy này. HV01 / PIN 1111 · HV02 / PIN 2222'; b.hidden = false; } else b.hidden = true;
}

function show(view) {
  document.querySelectorAll('.view').forEach((v) => { v.hidden = v.id !== 'v-' + view; });
  document.body.dataset.view = view;
  window.scrollTo(0, 0);
}
function setTheme(mode) { document.body.classList.toggle('kid', mode === 'kid'); document.body.classList.toggle('teen', mode === 'teen'); }

// ---------- Đăng nhập ----------
async function doLogin(ev) {
  ev.preventDefault();
  const ma = $('in-ma').value.trim().toUpperCase();
  const pin = $('in-pin').value.trim();
  const err = $('login-err');
  err.textContent = '';
  if (!/^HV\d{2,3}$/.test(ma)) { err.textContent = 'Mã học viên có dạng HV01.'; return; }
  if (!/^\d{4}$/.test(pin)) { err.textContent = 'PIN gồm 4 chữ số.'; return; }
  const btn = ev.submitter || $('f-login').querySelector('button');
  btn.disabled = true;
  try {
    const r = await App.backend.login(ma, pin);
    App.token = r.token; App.hv = r.hv;
    LS.set('hl_session', { token: r.token, hv: r.hv, api: App.api });
    $('in-pin').value = '';
    speakWarmup();
    await openHome();
  } catch (e) {
    err.textContent = e.message === 'Failed to fetch' ? 'Không kết nối được máy chủ. Kiểm tra mạng.' : e.message;
  } finally { btn.disabled = false; }
}

async function logout() {
  if (App.hv && LS.get(queueKey(), []).length) {
    const ok = await trySync();
    if (!ok && !confirm('Còn lượt ôn chưa lưu lên máy chủ (mất mạng?). Kết quả vẫn giữ trên máy này và sẽ lưu khi ' + App.hv.ma_hv + ' đăng nhập lại. Vẫn đăng xuất?')) return;
  }
  LS.del('hl_session');
  App.hv = null; App.token = null;
  setTheme('');
  show('login');
}

// ---------- Tải dữ liệu, gộp với bản trên máy ----------
const cacheKey = () => 'hl_cache_' + App.hv.ma_hv + (App.api ? '' : '_demo');
const queueKey = () => 'hl_queue_' + App.hv.ma_hv + (App.api ? '' : '_demo');

async function loadData() {
  const cache = LS.get(cacheKey(), { cards: [], progress: {}, days: [] });
  let offline = false;
  try {
    await trySync();
    const r = await App.backend.load(App.token);
    const merged = Object.assign({}, r.progress || {});
    // Bản trên máy mới hơn (chưa kịp đồng bộ) thì giữ bản trên máy
    Object.keys(cache.progress).forEach((id) => {
      const a = cache.progress[id], b = merged[id];
      if (!b || (a.last_review && (!b.last_review || a.last_review > b.last_review))) merged[id] = a;
    });
    App.cards = (r.cards || []).map(normCard);
    App.progress = merged;
    App.days = [...new Set([...(r.days || []), ...cache.days])];
  } catch (e) {
    offline = true;
    App.cards = cache.cards; App.progress = cache.progress; App.days = cache.days;
    if (/PIN|token|đăng nhập/i.test(e.message)) { await logout(); $('login-err').textContent = e.message; throw e; }
  }
  saveCache();
  return offline;
}
function saveCache() { LS.set(cacheKey(), { cards: App.cards, progress: App.progress, days: App.days }); }

// ---------- Trang chủ ----------
// Loại thẻ kiểu Anki: new = chưa học, learn = đang học/vừa quên (FSRS state 1, 3), due = ôn (state 2)
function kindOf(c) {
  const p = App.progress[c.the_id];
  if (!p) return 'new';
  return Number(p.state) === 2 ? 'due' : 'learn';
}
function deckName(slug) {
  const k = String(slug || '').trim().toLowerCase();
  if (!k) return 'Khác';
  if (DECK_NAMES[k]) return DECK_NAMES[k];
  const m = k.match(/^(minna|kanji|kids)[-_ ]?0*(\d+)$/);
  if (m) return m[1][0].toUpperCase() + m[1].slice(1) + ' Bài ' + m[2];
  const t = k.replace(/[-_]+/g, ' ');
  return t[0].toUpperCase() + t.slice(1);
}
const isKanjiDeck = (c) => /kanji/i.test(c.bo_the);

function counts(deck) {
  const now = new Date(), today = ymd(now);
  const due = App.cards.filter((c) => App.progress[c.the_id] && new Date(App.progress[c.the_id].due) <= now);
  const newToday = Object.values(App.progress).filter((p) => p.first_review && ymd(new Date(p.first_review)) === today).length;
  const perDay = Number(App.hv.so_the_moi_ngay);
  const limit = Math.max(0, (Number.isFinite(perDay) ? perDay : 10) - newToday);
  // Giới hạn thẻ mới/ngày tính chung; bấm 1 bộ thì lấy thẻ mới của riêng bộ đó (như Anki)
  const fresh = App.cards.filter((c) => !App.progress[c.the_id] && (deck == null || c.bo_the === deck))
    .sort((a, b) => a.buoi - b.buoi || a.the_id.localeCompare(b.the_id)).slice(0, limit);
  due.sort((a, b) => new Date(App.progress[a.the_id].due) - new Date(App.progress[b.the_id].due));
  if (deck == null) return { due, fresh };
  return { due: due.filter((c) => c.bo_the === deck), fresh };
}

function streak(days) {
  const set = new Set(days);
  const d = new Date();
  if (!set.has(ymd(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (set.has(ymd(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

async function openHome() {
  setTheme(App.hv.giao_dien);
  $('home-ma').textContent = App.hv.ma_hv;
  show('home');
  $('btn-start').disabled = true;
  $('home-note').textContent = 'Đang tải thẻ...';
  let offline = false;
  try { offline = await loadData(); } catch (e) { return; }
  renderHome(offline);
}

function renderHome(offline) {
  const kid = App.hv.giao_dien === 'kid';
  const { due, fresh } = counts();
  const st = streak(App.days);
  const total = Math.min(due.length + fresh.length, MAX_SESSION[kid ? 'kid' : 'teen']);
  // Thẻ mới thường hiện lại 1 lần trong phiên (bước học 10 phút) -> tính gấp đôi
  const reviews = Math.min(due.length, total) + Math.max(0, total - due.length) * 2;
  const mins = Math.max(1, Math.round(reviews * (kid ? 0.25 : 0.15)));
  const studiedToday = App.days.includes(ymd(new Date()));
  const daySet = new Set(App.days);
  if (kid) {
    // Con dấu 済 cho từng ngày đã học trong tuần này (Thứ 2 -> Chủ nhật)
    const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    let n = 0;
    const cells = WEEKDAYS.map((w) => { const on = daySet.has(ymd(d)); if (on) n++; d.setDate(d.getDate() + 1); return `<i class="${on ? 'on' : ''}" title="${w}">${on ? '済' : w}</i>`; }).join('');
    $('home-hero').innerHTML = `<div class="kid-hero"><div class="mascot">${studiedToday ? 'すごい!' : 'ねこ'}</div><p>${studiedToday ? 'Hôm nay bé đã học rồi. Giỏi lắm!' : (total ? `Hôm nay mình học ${total} thẻ nhé!` : 'Hôm nay bé nghỉ nhé!')}</p></div>
      <div class="today"><div class="today-row"><b>Tuần này của bé</b><span class="streak"><strong>${n}</strong>/7 ngày · tổng ${App.days.length} ngày</span></div><div class="stamps">${cells}</div></div>`;
    $('decks').hidden = true;
  } else {
    const cells = [];
    for (let i = 13; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); cells.push(`<i class="${daySet.has(ymd(d)) ? 'on' : ''}${i === 0 ? ' now' : ''}" title="${ymd(d)}"></i>`); }
    $('home-hero').innerHTML = `<div class="today"><div class="today-row"><b>${studiedToday ? 'Hôm nay đã ôn' : 'Hôm nay'}</b><span class="streak">${st ? `Chuỗi <strong>${st} ngày</strong>` : 'Ôn hôm nay để bắt đầu chuỗi'}</span></div><div class="heat" aria-label="14 ngày gần nhất">${cells.join('')}</div></div>`;
    renderDecks(due, fresh);
  }
  const btn = $('btn-start');
  btn.disabled = total === 0;
  btn.innerHTML = total === 0 ? 'Xong hết cho hôm nay' : (kid ? 'Bắt đầu!' : `Học ngay<small>${total} thẻ · khoảng ${mins} phút</small>`);
  const pend = LS.get(queueKey(), []).length;
  if (offline && !App.cards.length) {
    btn.textContent = 'Chưa tải được thẻ';
    $('home-note').textContent = 'Không kết nối được máy chủ và máy này chưa lưu thẻ nào. Bật mạng rồi mở lại app.';
    return;
  }
  $('home-note').textContent = (offline ? 'Đang ngoại tuyến — dùng dữ liệu đã lưu trên máy. ' : '') + (pend ? `${pend} lượt ôn chờ đồng bộ.` : '');
}

// Danh sách bộ thẻ kiểu Anki: 3 số Mới / Học / Ôn. Bấm 1 bộ = chỉ ôn bộ đó.
function renderDecks(due, fresh) {
  const box = $('decks');
  const decks = {};
  App.cards.forEach((c) => {
    const d = decks[c.bo_the] = decks[c.bo_the] || { slug: c.bo_the, n: [0, 0, 0], size: 0, buoi: Infinity };
    d.size++; d.buoi = Math.min(d.buoi, c.buoi || Infinity);
  });
  Object.values(decks).forEach((d) => { d.n[0] = counts(d.slug).fresh.length; });
  due.forEach((c) => { decks[c.bo_the].n[kindOf(c) === 'learn' ? 1 : 2]++; });
  const list = Object.values(decks).sort((a, b) => a.buoi - b.buoi || deckName(a.slug).localeCompare(deckName(b.slug), 'vi'));
  box.hidden = !list.length;
  box.innerHTML = '<div class="deck-head"><span>Bộ thẻ</span><span>Mới</span><span>Học</span><span>Ôn</span></div>' + list.map((d) => {
    const any = d.n[0] + d.n[1] + d.n[2];
    return `<button class="deck" type="button" data-deck="${esc(d.slug)}"${any ? '' : ' disabled'}><span class="deck-name"><b>${esc(deckName(d.slug))}</b><small>${d.size} thẻ</small></span>${d.n.map((x, k) => `<span class="n ${x ? ['new', 'learn', 'due'][k] : 'zero'}">${x}</span>`).join('')}</button>`;
  }).join('');
}

// ---------- Ôn thẻ ----------
function startSession(deck) {
  const kid = App.hv.giao_dien === 'kid';
  const { due, fresh } = counts(typeof deck === 'string' ? deck : null);
  App.queue = [...due, ...fresh].slice(0, MAX_SESSION[kid ? 'kid' : 'teen']);
  if (!App.queue.length) return;
  App.session = { done: 0, again: 0, total: App.queue.length, repeats: {}, startedAt: Date.now() };
  show('review');
  nextCard();
}

// 3 số trên đầu như Anki: mới / đang học / ôn của phần còn lại, số của thẻ đang hiện được gạch chân
function renderCounts(cur) {
  const el = $('counts');
  const left = [cur, ...App.queue];
  if (App.hv.giao_dien === 'kid') { el.innerHTML = `<span class="c-kid">Còn ${left.length} thẻ</span>`; return; }
  const n = { new: 0, learn: 0, due: 0 };
  left.forEach((c) => { n[kindOf(c)]++; });
  const k = kindOf(cur);
  el.innerHTML = ['new', 'learn', 'due'].map((t) => `<span class="c-${t}${t === k ? ' cur' : ''}">${n[t]}</span>`).join('');
}

function nextCard() {
  if (!App.queue.length) return finishSession();
  const c = App.queue.shift();
  App.cur = c; App.flipped = false; App.shownAt = Date.now();
  const kid = App.hv.giao_dien === 'kid';
  const kanji = isKanjiDeck(c);
  $('c-deck').textContent = deckName(c.bo_the);
  $('c-pic').textContent = c.hinh || '';
  $('c-pic').hidden = !c.hinh;
  const len = [...c.mat_truoc].length;
  $('c-front').textContent = c.mat_truoc;
  $('c-front').className = 'front' + (len > 8 ? ' longer' : len > 4 ? ' long' : '');
  // Thẻ Kanji: cach_doc = "On | Kun", mat_sau = "nghĩa | cách nhớ" (README mục Thẻ Kanji)
  const meanParts = kanji ? c.mat_sau.split('|').map((x) => x.trim()) : [c.mat_sau];
  $('c-mean').textContent = meanParts[0];
  if (kanji) {
    const rd = c.cach_doc.split('|').map((x) => x.trim());
    const rows = [['Âm On', rd[0] || '—', ''], ['Âm Kun', rd[1] || '—', '']];
    if (meanParts.length > 1) rows.push(['Cách nhớ', meanParts.slice(1).join(' | '), 'vi']);
    $('c-kanji').innerHTML = rows.map(([k, v, cls]) => `<dt>${k}</dt><dd class="${cls}">${esc(v)}</dd>`).join('');
    $('c-read').textContent = '';
  } else {
    $('c-kanji').innerHTML = '';
    $('c-read').textContent = c.cach_doc === c.mat_sau ? '' : c.cach_doc;
  }
  $('c-kanji').hidden = !kanji;
  $('c-read').hidden = !$('c-read').textContent;
  $('c-ex').textContent = c.vi_du;
  $('c-back').hidden = true;
  // "Cách viết": bộ hiragana/katakana/kanji và có dữ liệu nét (kana-strokes.js). Từ vựng như あか thì không.
  $('btn-write').hidden = !(window.HinokiWrite && /^(hiragana|katakana|kanji)/i.test(c.bo_the.trim()) && HinokiWrite.canWrite(c.mat_truoc));
  $('act-flip').hidden = false;
  $('act-rate4').hidden = true;
  $('act-rate2').hidden = true;
  $('flip-hint').hidden = kid;
  $('btn-flip').textContent = kid ? 'Xem đáp án' : 'Hiện đáp án';
  renderCounts(c);
  if (c.tu_phat_am) speak(c);
}

function flip() {
  if (App.flipped || !App.cur) return;
  App.flipped = true;
  const kid = App.hv.giao_dien === 'kid';
  $('c-back').hidden = false;
  $('act-flip').hidden = true;
  if (kid) { $('act-rate2').hidden = false; speak(App.cur); return; }
  $('act-rate4').hidden = false;
  // Hiện khoảng thời gian tới lần ôn sau trên mỗi nút
  try {
    const now = new Date();
    const prev = App.progress[App.cur.the_id];
    const base = prev ? toFsrs(prev) : F.createEmptyCard(now);
    const pv = scheduler.repeat(base, now);
    document.querySelectorAll('#act-rate4 button').forEach((b) => {
      const it = pv[Number(b.dataset.r)];
      b.querySelector('i').textContent = it ? fmtInterval(new Date(it.card.due) - now) : '';
    });
  } catch (e) { document.querySelectorAll('#act-rate4 i').forEach((i) => { i.textContent = ''; }); }
}

function rate(r) {
  if (!App.flipped || !App.cur) return;
  const c = App.cur;
  App.cur = null;
  const now = new Date();
  const prev = App.progress[c.the_id];
  const base = prev ? toFsrs(prev) : F.createEmptyCard(now);
  const rec = scheduler.next(base, now, r);
  const stored = fromFsrs(rec.card, (prev && prev.first_review) || now.toISOString());
  App.progress[c.the_id] = stored;
  const today = ymd(now);
  if (!App.days.includes(today)) App.days.push(today);
  const review = { ma_on: uid(), the_id: c.the_id, danh_gia: r, thoi_gian: now.toISOString(), ngay_hoc: today, ms: Math.min(Date.now() - App.shownAt, 120000), card: stored };
  const q = LS.get(queueKey(), []); q.push(review); LS.set(queueKey(), q);
  saveCache();
  App.session.done++;
  if (r === 1) App.session.again++;
  // Thẻ đến hạn lại trong 15 phút (đang học/quên) -> cho xuất hiện lại trong phiên này
  const reps = App.session.repeats[c.the_id] || 0;
  if (new Date(stored.due) - now < 15 * 60000 && reps < MAX_REPEAT_IN_SESSION) {
    App.session.repeats[c.the_id] = reps + 1;
    App.queue.splice(Math.min(3, App.queue.length), 0, c);
  }
  if (App.hv.giao_dien === 'kid' && r === 3) chime();
  if (q.length >= 5) trySync();
  nextCard();
}

async function finishSession() {
  const kid = App.hv.giao_dien === 'kid';
  const st = streak(App.days);
  const ses = App.session;
  show('done');
  // Đóng lại con dấu 済 (chạy lại hiệu ứng)
  const art = $('done-art');
  art.style.animation = 'none'; void art.offsetWidth; art.style.animation = '';
  art.hidden = ses.done === 0;
  $('done-title').textContent = ses.done === 0 ? 'Đã dừng' : (kid ? 'Giỏi lắm! Xong rồi!' : 'Xong phần hôm nay');
  const left = counts().due.length;
  $('done-txt').textContent = kid
    ? (ses.done ? `Bé đã ôn ${ses.done} lượt. Tuần này có thêm 1 con dấu.` : '')
    : (left ? `Còn ${left} thẻ đến hạn.` : `Chuỗi ${st} ngày. Hẹn mai ôn tiếp.`);
  const mins = Math.max(1, Math.round((Date.now() - (ses.startedAt || Date.now())) / 60000));
  $('done-sum').innerHTML = kid || !ses.done ? '' : `<div><b>${ses.done}</b><span>lượt ôn</span></div><div><b>${ses.again}</b><span>lần quên</span></div><div><b>${mins}</b><span>phút</span></div>`;
  if (kid && ses.done) chime(true);
  $('sync-txt').textContent = 'Đang lưu kết quả...';
  const ok = await trySync();
  $('sync-txt').textContent = ok ? 'Đã lưu kết quả cho giáo viên.' : 'Chưa lưu lên máy chủ (mất mạng?). App sẽ tự lưu lại sau.';
}

// Đồng bộ nối đuôi nhau: lần gọi sau chờ lần trước xong rồi gửi phần còn lại
let syncChain = Promise.resolve(true);
function trySync() {
  syncChain = syncChain.then(syncOnce, syncOnce);
  return syncChain;
}
async function syncOnce() {
  if (!App.hv || !App.token) return false;
  const key = queueKey();
  const q = LS.get(key, []);
  if (!q.length) return true;
  try {
    const batch = q.slice(0, 200);
    await App.backend.sync(App.token, batch);
    const ids = new Set(batch.map((x) => x.ma_on));
    LS.set(key, LS.get(key, []).filter((x) => !ids.has(x.ma_on)));
    return LS.get(key, []).length === 0;
  } catch (e) { return false; }
}

// ---------- Âm thanh ----------
// Ưu tiên 1: file âm thanh thu sẵn (audio/index.json: { "chữ": "audio/ja/xxx.mp3" }).
// Ưu tiên 2: giọng đọc của máy, chọn giọng tốt nhất có trên máy.
let audioMap = {};
let audioEl = null;
function loadAudioIndex() {
  fetch('audio/index.json', { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : {}))
    .then((m) => { audioMap = m && typeof m === 'object' ? m : {}; })
    .catch(() => { /* chưa có file âm thanh -> dùng giọng máy */ });
}

let jaVoice = null;
// Điểm cao = giọng tự nhiên hơn. Giọng "compact"/eSpeak nghe như robot -> điểm thấp.
function voiceScore(v) {
  const n = (v.name + ' ' + v.voiceURI).toLowerCase();
  let s = 0;
  if (/natural|neural|online/.test(n)) s += 50;          // Edge/Windows: Nanami, Keita (Online, Natural)
  if (/premium|enhanced|siri/.test(n)) s += 40;          // iPhone: giọng tải thêm chất lượng cao
  if (/google/.test(n)) s += 30;                         // Chrome/Android: Google 日本語
  if (/nanami|kyoko|o-ren|otoya|hattori|haruka|ayumi/.test(n)) s += 10;
  if (/compact|espeak|robot/.test(n)) s -= 40;
  if (v.localService === false) s += 5;
  return s;
}
function pickVoice() {
  if (!('speechSynthesis' in window)) return;
  const vs = speechSynthesis.getVoices().filter((v) => /^ja(-|_|$)/i.test(v.lang));
  vs.sort((a, b) => voiceScore(b) - voiceScore(a));
  jaVoice = vs[0] || null;
}
function speakWarmup() { try { if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.cancel(); } } catch (e) { /* bỏ qua */ } }
function speak(c) {
  const text = (c.doc_tieng || c.mat_truoc || '').trim();
  if (!text) return;
  const kid = App.hv && App.hv.giao_dien === 'kid';
  try { if ('speechSynthesis' in window) speechSynthesis.cancel(); } catch (e) { /* bỏ qua */ }
  if (audioEl) { audioEl.pause(); audioEl = null; }
  const file = audioMap[text];
  if (file) {
    audioEl = new Audio(file);
    audioEl.play().catch(() => speakTts(text, kid)); // không phát được file -> giọng máy
    return;
  }
  speakTts(text, kid);
}
function speakTts(text, kid) {
  if (!('speechSynthesis' in window)) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ja-JP';
    if (jaVoice) u.voice = jaVoice;
    // Đọc chậm quá làm giọng máy méo; giữ gần tốc độ thường
    u.rate = kid ? 0.85 : 0.95;
    speechSynthesis.speak(u);
  } catch (e) { /* máy không hỗ trợ */ }
}
let actx = null;
function chime(big) {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const notes = big ? [523, 659, 784, 1047] : [784, 1047];
    notes.forEach((f, i) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      const t = actx.currentTime + i * 0.09;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.15, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      o.connect(g).connect(actx.destination); o.start(t); o.stop(t + 0.3);
    });
  } catch (e) { /* bỏ qua */ }
}

// ---------- Trang giáo viên ----------
function teacherStats(data) {
  const now = new Date();
  const cardsById = {};
  data.cards.map(normCard).forEach((c) => { cardsById[c.the_id] = c; });
  const days14 = [];
  for (let i = 13; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days14.push(ymd(d)); }
  return data.students.map((s) => {
    const hist = data.history.filter((h) => h.ma_hv === s.ma_hv);
    const days = [...new Set(hist.map((h) => h.ngay_hoc))];
    const per = {};
    hist.forEach((h) => {
      // Đếm theo NGÀY: một thẻ quên nhiều lần trong cùng 1 ngày chỉ tính 1 lần quên
      const p = per[h.the_id] = per[h.the_id] || { the_id: h.the_id, n: 0, again: 0, ms: 0, seen: {}, lost: {} };
      p.ms += Number(h.thoi_gian_tra_loi_ms) || 0;
      if (!p.seen[h.ngay_hoc]) { p.seen[h.ngay_hoc] = 1; p.n++; }
      if (Number(h.danh_gia) === 1 && !p.lost[h.ngay_hoc]) { p.lost[h.ngay_hoc] = 1; p.again++; }
    });
    const weak = Object.values(per).filter((p) => p.again > 0)
      .sort((a, b) => b.again - a.again || b.again / b.n - a.again / a.n).slice(0, 10)
      .map((p) => Object.assign(p, { card: cardsById[p.the_id] || { mat_truoc: p.the_id, mat_sau: '(thẻ đã ẩn)' } }));
    const prog = data.progress.filter((p) => p.ma_hv === s.ma_hv);
    const myCards = Object.values(cardsById).filter((c) => c.ma_hv === s.ma_hv || c.ma_hv === 'ALL');
    const learned = new Set(prog.map((p) => p.the_id));
    const due = prog.filter((p) => cardsById[p.the_id] && new Date(p.card.due) <= now).length;
    return {
      ma_hv: s.ma_hv, giao_dien: s.giao_dien, total: hist.length, streak: streak(days),
      last: days.sort().slice(-1)[0] || '—',
      byDay: days14.map((d) => ({ d, n: hist.filter((h) => h.ngay_hoc === d).length })),
      weak, due, learned: learned.size, unseen: myCards.filter((c) => !learned.has(c.the_id)).length
    };
  });
}

function summaryText(stats) {
  const lines = [`# Kết quả ôn Hinoki Learn — ${ymd(new Date())}`];
  stats.forEach((s) => {
    lines.push('', `## ${s.ma_hv} (${s.giao_dien})`,
      `- Ngày ôn trong 14 ngày: ${s.byDay.filter((x) => x.n).length}/14 · chuỗi hiện tại ${s.streak} ngày · lần cuối ${s.last}`,
      `- Tổng lượt ôn: ${s.total} · thẻ đã học ${s.learned} · đến hạn ${s.due} · chưa học ${s.unseen}`,
      '- Thẻ quên nhiều nhất:');
    if (!s.weak.length) lines.push('  - (chưa có)');
    s.weak.forEach((w) => lines.push(`  - ${w.card.mat_truoc} (${w.card.mat_sau}) — quên ${w.again}/${w.n} ngày ôn [${w.the_id}]`));
  });
  return lines.join('\n');
}

async function doTeacher(ev) {
  ev.preventDefault();
  $('t-err').textContent = '';
  const out = $('t-out');
  out.innerHTML = '<p class="muted">Đang tải...</p>';
  try {
    const data = await App.backend.teacher($('in-tkey').value);
    const stats = teacherStats(data);
    out.innerHTML = stats.map((s) => {
      const max = Math.max(1, ...s.byDay.map((x) => x.n));
      const bars = s.byDay.map((x) => `<div class="bar" title="${x.d}: ${x.n} lượt"><span style="height:${Math.round((x.n / max) * 100)}%"></span><small>${x.d.slice(8)}</small></div>`).join('');
      const weak = s.weak.length
        ? `<table><thead><tr><th>Thẻ</th><th>Nghĩa</th><th>Ngày quên / ngày ôn</th></tr></thead><tbody>${s.weak.map((w) => `<tr><td class="jp">${esc(w.card.mat_truoc)}</td><td>${esc(w.card.mat_sau)}</td><td>${w.again}/${w.n}</td></tr>`).join('')}</tbody></table>`
        : '<p class="muted">Chưa có thẻ bị quên.</p>';
      return `<div class="card tcard"><h3>${esc(s.ma_hv)} <span class="chip">${esc(s.giao_dien)}</span></h3>
        <div class="stats"><div class="stat"><b>${s.byDay.filter((x) => x.n).length}/14</b><span>ngày ôn</span></div><div class="stat"><b>${s.streak}</b><span>chuỗi</span></div><div class="stat"><b>${s.due}</b><span>đến hạn</span></div><div class="stat"><b>${s.total}</b><span>lượt ôn</span></div></div>
        <p class="small muted">14 ngày gần nhất · lần ôn cuối: ${esc(s.last)} · đã học ${s.learned} thẻ, chưa học ${s.unseen}</p>
        <div class="bars">${bars}</div><h4>Thẻ quên nhiều nhất</h4>${weak}</div>`;
    }).join('') + '<button id="btn-copy" class="btn ghost">Sao chép tóm tắt (dán cho Claude)</button><pre id="t-sum" class="sum"></pre>';
    const txt = summaryText(stats);
    $('t-sum').textContent = txt;
    $('btn-copy').onclick = async () => {
      try { await navigator.clipboard.writeText(txt); $('btn-copy').textContent = 'Đã sao chép'; } catch (e) { $('btn-copy').textContent = 'Không sao chép được — bôi đen đoạn bên dưới'; }
    };
  } catch (e) {
    out.innerHTML = '';
    $('t-err').textContent = e.message === 'Failed to fetch' ? 'Không kết nối được máy chủ.' : e.message;
  }
}

// ---------- Điều hướng ----------
function route() {
  if (location.hash === '#giao-vien') { setTheme(''); show('teacher'); return; }
  const s = LS.get('hl_session', null);
  if (s && s.token && (s.api || '') === App.api) { App.token = s.token; App.hv = s.hv; openHome(); }
  else show('login');
}

function bind() {
  $('f-login').addEventListener('submit', doLogin);
  $('btn-logout').addEventListener('click', logout);
  $('btn-start').addEventListener('click', () => startSession());
  $('decks').addEventListener('click', (e) => { const b = e.target.closest('[data-deck]'); if (b && !b.disabled) startSession(b.dataset.deck); });
  $('btn-flip').addEventListener('click', flip);
  $('flash').addEventListener('click', (e) => { if (!e.target.closest('button')) flip(); });
  $('btn-write').addEventListener('click', () => App.cur && window.HinokiWrite && HinokiWrite.open(App.cur.mat_truoc));
  $('btn-speak').addEventListener('click', () => App.cur && speak(App.cur));
  document.querySelectorAll('#act-rate4 button, #act-rate2 button').forEach((b) => b.addEventListener('click', () => rate(Number(b.dataset.r))));
  $('btn-quit').addEventListener('click', () => { App.queue = []; App.cur = null; finishSession(); });
  $('btn-home').addEventListener('click', () => openHome());
  $('f-teacher').addEventListener('submit', doTeacher);
  // pushState không kích hoạt hashchange -> chỉ gọi route() 1 lần
  $('t-back').addEventListener('click', (e) => { e.preventDefault(); history.pushState(null, '', location.pathname + location.search); route(); });
  $('lnk-server').addEventListener('click', (e) => { e.preventDefault(); $('in-api').value = App.api; $('dlg-server').showModal(); });
  $('dlg-server').addEventListener('close', () => {
    if ($('dlg-server').returnValue !== 'ok') return;
    const v = $('in-api').value.trim();
    if (v && !/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(v)) { alert('Địa chỉ phải có dạng https://script.google.com/macros/s/.../exec'); return; }
    if (v) LS.set('hl_api', v); else LS.del('hl_api');
    LS.del('hl_session');
    initServer(); show('login');
  });
  window.addEventListener('hashchange', route);
  window.addEventListener('online', () => trySync());
  document.addEventListener('keydown', (e) => {
    if (document.body.dataset.view !== 'review') return;
    if (window.HinokiWrite && HinokiWrite.isOpen()) return; // đang mở "Cách viết"
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); return; }
    const kid = App.hv && App.hv.giao_dien === 'kid';
    if (App.flipped && /^[1-4]$/.test(e.key)) { const r = Number(e.key); if (!kid || r === 1 || r === 3) rate(r); }
  });
  if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
}

initServer();
loadAudioIndex();
bind();
route();
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => { /* không bắt buộc */ });
}
