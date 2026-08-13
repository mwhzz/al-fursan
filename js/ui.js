/* Al Fursan — small UI toolkit (DOM helpers, toast, modal, formatters, icons) */
(function () {
  const app = () => document.getElementById('app');

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

  function time12(hhmm) {
    if (!hhmm) return '';
    const [h, m] = String(hhmm).split(':').map(Number);
    const ap = h >= 12 ? 'PM' : 'AM';
    const hr = h % 12 === 0 ? 12 : h % 12;
    return window.n(hr) + ':' + window.n(String(m).padStart(2, '0')) + ' ' + ap;
  }

  function dateLabel(d) {
    if (!d) return '—';
    const dt = new Date(d + 'T00:00:00');
    if (isNaN(dt)) return d;
    const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][dt.getMonth()];
    return window.n(dt.getDate()) + ' ' + mon + ' ' + window.n(dt.getFullYear());
  }

  const todayISO = () => {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
  };

  const initials = (name) => String(name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();

  const daysLeft = (end) => {
    if (!end) return null;
    return Math.ceil((new Date(end + 'T00:00:00') - new Date(todayISO() + 'T00:00:00')) / 864e5);
  };

  /* ---------- toast ---------- */
  let toastTimer;
  function toast(msg, kind) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = 'toast show ' + (kind || '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.className = 'toast ' + (kind || ''); }, 2600);
  }

  /* ---------- modal ---------- */
  function modal(html, onMount) {
    const wrap = document.getElementById('modal');
    const box = wrap.querySelector('.modal');
    box.innerHTML = html;
    wrap.hidden = false;
    document.body.style.overflow = 'hidden';
    wrap.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeModal));
    box.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeModal));
    if (onMount) onMount(box);
    return box;
  }
  function closeModal() {
    const wrap = document.getElementById('modal');
    wrap.hidden = true;
    wrap.querySelector('.modal').innerHTML = '';
    document.body.style.overflow = '';
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  function confirmBox(text, onYes) {
    modal(
      '<h2 style="margin-bottom:6px">' + esc(text) + '</h2>' +
      '<p class="muted small" style="margin-bottom:18px">' + esc(t('confirm')) + '</p>' +
      '<div class="row"><button class="btn ghost grow" data-close>' + esc(t('cancel')) + '</button>' +
      '<button class="btn danger grow" id="yes">' + esc(t('delete')) + '</button></div>',
      (box) => box.querySelector('#yes').addEventListener('click', () => { closeModal(); onYes(); })
    );
  }

  /* ---------- icons ---------- */
  const ICON = {
    home: '<svg viewBox="0 0 24 24"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
    calendar: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    users: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.2"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M17 11.2A3 3 0 0 0 17 5.3M18.5 20a5.6 5.6 0 0 0-3-5"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>',
    clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>',
    gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2 2 2 0 1 1-4 0 1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 15a2 2 0 1 1 0-4 1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 4.1a2 2 0 1 1 4 0 1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 21 11a2 2 0 1 1 0 4 1.7 1.7 0 0 0-1.6 0z"/></svg>',
    horse: '<svg viewBox="0 0 24 24"><path d="M4 20c0-4 2-6 5-7 1.4-.5 2-1.6 2-3V7l-2 1-1.5-2L11 3h3l4 4 2 3-2 1-1-1.5V13c0 4-2 7-6 7z"/></svg>',
    empty: '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 11h18M9 6V3h6v3"/></svg>'
  };

  /* ---------- logo ---------- */
  function logo(cls) {
    return '<img src="assets/logo.png" alt="Al Fursan" class="' + cls + '" ' +
      'onerror="this.onerror=null;this.src=\'assets/icon.svg\'">';
  }

  function topbar(rightHtml) {
    return '<header class="topbar">' +
      '<div class="brand grow">' + logo('brand-logo') +
      '<div><div class="brand-name chrome-text">AL FURSAN</div>' +
      '<div class="brand-sub">Equestrian Academy</div></div></div>' +
      (rightHtml || '') + '</header>';
  }

  function langBtn() {
    return '<button class="btn sm ghost" id="langBtn">' + (I18N.lang === 'en' ? 'বাংলা' : 'EN') + '</button>';
  }

  function ring(pct, centerHtml) {
    const r = 54, circ = 2 * Math.PI * r;
    const off = circ * (1 - Math.max(0, Math.min(1, pct)));
    return '<div class="ring"><svg viewBox="0 0 128 128">' +
      '<defs><linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0%" stop-color="#ffffff"/><stop offset="55%" stop-color="#cdd4dd"/>' +
      '<stop offset="100%" stop-color="#d9b872"/></linearGradient></defs>' +
      '<circle class="track" cx="64" cy="64" r="' + r + '" fill="none" stroke-width="10"/>' +
      '<circle class="bar" cx="64" cy="64" r="' + r + '" fill="none" stroke-width="10" ' +
      'stroke-dasharray="' + circ.toFixed(1) + '" stroke-dashoffset="' + circ.toFixed(1) + '" ' +
      'data-off="' + off.toFixed(1) + '"/></svg>' +
      '<div class="ring-mid">' + centerHtml + '</div></div>';
  }
  function animateRings(root) {
    (root || document).querySelectorAll('.ring .bar').forEach(c => {
      requestAnimationFrame(() => { c.style.strokeDashoffset = c.dataset.off; });
    });
  }

  function courseBadge(course) {
    return '<span class="badge ' + esc(course) + '">' + esc(t(course)) + '</span>';
  }

  function loading() {
    app().innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  }

  window.UI = {
    app, esc, time12, dateLabel, todayISO, initials, daysLeft, DAY_KEYS,
    toast, modal, closeModal, confirmBox, ICON, logo, topbar, langBtn,
    ring, animateRings, courseBadge, loading
  };
})();
