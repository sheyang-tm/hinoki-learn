// Hinoki Learn — "Cách viết": xem thứ tự nét và tự tô chữ kana bằng ngón tay.
// Chỉ dùng cho thẻ bảng chữ cái: 1-2 chữ kana (vd あ, ア, きゃ). Từ dài hơn không hiện nút.
// Dữ liệu nét: kana-strokes.js (KanjiVG, CC BY-SA 3.0).
'use strict';
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const MAX_CHARS = 2;
  let timers = [];
  let dlg = null;
  let curText = '';

  function chars(text) { return Array.from(String(text || '').trim()); }

  function canWrite(text) {
    const cs = chars(text);
    const data = window.KANA_STROKES || {};
    return cs.length >= 1 && cs.length <= MAX_CHARS && cs.every((c) => data[c]);
  }

  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach((k) => e.setAttribute(k, attrs[k]));
    if (parent) parent.appendChild(e);
    return e;
  }

  function stopAll() { timers.forEach(clearTimeout); timers = []; }

  // Một ô chữ: lưới ô vuông + chữ mờ để tô + lớp nét chạy + số nét + lớp tô tay (canvas)
  function buildBox(ch) {
    const d = window.KANA_STROKES[ch];
    const box = document.createElement('div');
    box.className = 'w-box';
    const svg = el('svg', { viewBox: '0 0 109 109', 'aria-label': 'Thứ tự nét chữ ' + ch, role: 'img' });
    el('rect', { x: 1, y: 1, width: 107, height: 107, rx: 6, class: 'w-frame' }, svg);
    el('line', { x1: 54.5, y1: 4, x2: 54.5, y2: 105, class: 'w-guide' }, svg);
    el('line', { x1: 4, y1: 54.5, x2: 105, y2: 54.5, class: 'w-guide' }, svg);
    const ghost = el('g', { class: 'w-ghost' }, svg);
    const live = el('g', { class: 'w-live' }, svg);
    const nums = el('g', { class: 'w-nums' }, svg);
    const paths = d.s.map((p) => {
      el('path', { d: p }, ghost);
      return el('path', { d: p }, live);
    });
    const labels = d.n.map((xy, i) => {
      const t = el('text', { x: xy[0], y: xy[1] }, nums);
      t.textContent = String(i + 1);
      return t;
    });
    const cv = document.createElement('canvas');
    cv.className = 'w-pad';
    box.appendChild(svg);
    box.appendChild(cv);
    bindPad(cv);
    return { box, paths, labels, cv };
  }

  // Chạy từng nét theo thứ tự, ô này xong mới sang ô sau
  function animate(boxes) {
    stopAll();
    let t = 300;
    boxes.forEach((b) => {
      b.paths.forEach((p) => {
        const len = p.getTotalLength();
        p.style.transition = 'none';
        p.style.strokeDasharray = len + ' ' + len;
        p.style.strokeDashoffset = String(len);
        p.style.visibility = 'hidden'; // đầu nét bo tròn vẫn hiện 1 chấm dù nét dài 0 → ẩn tới lượt
      });
      b.labels.forEach((l) => l.classList.remove('on'));
    });
    boxes.forEach((b) => {
      b.paths.forEach((p, i) => {
        const len = p.getTotalLength();
        const dur = Math.max(350, Math.min(1100, len * 9));
        timers.push(setTimeout(() => {
          b.labels[i] && b.labels[i].classList.add('on');
          p.style.visibility = 'visible';
          p.getBoundingClientRect(); // ép trình duyệt áp trạng thái đầu trước khi chạy
          p.style.transition = `stroke-dashoffset ${dur}ms ease-in-out`;
          p.style.strokeDashoffset = '0';
        }, t));
        t += dur + 250;
      });
    });
    timers.push(setTimeout(() => { const h = dlg && dlg.querySelector('.w-hint'); if (h) h.textContent = 'Giờ tự tô theo chữ mờ nhé. Nhớ đúng thứ tự nét.'; }, t));
  }

  function sizePad(cv) {
    const r = cv.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(r.width * dpr);
    cv.height = Math.round(r.height * dpr);
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.lineWidth = Math.max(6, r.width / 20);
    g.strokeStyle = getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#c0392b';
  }

  function bindPad(cv) {
    let last = null;
    const pt = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    cv.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      cv.setPointerCapture(e.pointerId);
      last = pt(e);
      const g = cv.getContext('2d');
      g.beginPath(); g.arc(last[0], last[1], g.lineWidth / 2, 0, Math.PI * 2); g.fillStyle = g.strokeStyle; g.fill();
    });
    cv.addEventListener('pointermove', (e) => {
      if (!last) return;
      const p = pt(e), g = cv.getContext('2d');
      g.beginPath(); g.moveTo(last[0], last[1]); g.lineTo(p[0], p[1]); g.stroke();
      last = p;
    });
    const end = () => { last = null; };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
  }

  function ensureDialog() {
    if (dlg) return dlg;
    dlg = document.createElement('dialog');
    dlg.id = 'dlg-write';
    dlg.innerHTML = '<div class="w-head"><b>Cách viết</b><button type="button" class="btn ghost small w-close">Xong</button></div>'
      + '<div class="w-boxes"></div>'
      + '<p class="w-hint small muted"></p>'
      + '<div class="w-acts"><button type="button" class="btn ghost w-replay">Xem lại nét</button><button type="button" class="btn ghost w-clear">Xóa chỗ tô</button></div>'
      + '<p class="w-src small muted">Nét chữ: KanjiVG (CC BY-SA 3.0)</p>';
    document.body.appendChild(dlg);
    dlg.querySelector('.w-close').addEventListener('click', () => dlg.close());
    dlg.addEventListener('close', stopAll);
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); }); // chạm ra ngoài để đóng
    dlg.querySelector('.w-replay').addEventListener('click', () => { clearPads(); render(curText); });
    dlg.querySelector('.w-clear').addEventListener('click', clearPads);
    return dlg;
  }

  function clearPads() { dlg.querySelectorAll('.w-pad').forEach((cv) => cv.getContext('2d').clearRect(0, 0, cv.width, cv.height)); }

  function render(text) {
    const wrap = dlg.querySelector('.w-boxes');
    wrap.innerHTML = '';
    const boxes = chars(text).map(buildBox);
    wrap.classList.toggle('two', boxes.length > 1);
    boxes.forEach((b) => wrap.appendChild(b.box));
    boxes.forEach((b) => sizePad(b.cv));
    dlg.querySelector('.w-hint').textContent = 'Xem thứ tự nét. Số nhỏ = nét thứ mấy.';
    animate(boxes);
  }

  function open(text) {
    if (!canWrite(text)) return;
    curText = String(text).trim();
    ensureDialog();
    if (!dlg.open) dlg.showModal();
    render(curText);
  }

  window.HinokiWrite = { canWrite, open, isOpen: () => !!(dlg && dlg.open) };
})();
