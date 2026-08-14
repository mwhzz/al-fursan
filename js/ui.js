/* Al Fursan — UI core: router, dialogs, theme, dates, toasts, icons */
(function () {
  const app = () => document.getElementById('app');

  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const DAY = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

  /* ---------------------------------------------------------------- dates --
     Everything is computed in the academy's timezone, never the device's.   */
  let TZ = 'Asia/Dhaka';
  const setTZ = tz => { if (tz) TZ = tz; };

  function todayISO() {
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'
      }).format(new Date());
    } catch (e) {
      const d = new Date();
      return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
    }
  }
  function nowParts() {
    try {
      const f = new Intl.DateTimeFormat('en-GB', {
        timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false
      }).formatToParts(new Date());
      const g = k => +(f.find(p => p.type === k) || {}).value;
      return { h: g('hour'), m: g('minute') };
    } catch (e) { const d = new Date(); return { h: d.getHours(), m: d.getMinutes() }; }
  }
  const parseISO = s => new Date(s + 'T00:00:00');
  const addDaysISO = (iso, n) => {
    const d = parseISO(iso); d.setDate(d.getDate() + n);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };
  const dowOf = iso => parseISO(iso).getDay();
  const dayKey = d => DAY[d];
  const dayName = (d, short) => t(DAY[d] + (short ? 'S' : ''));

  function dateLabel(iso, withYear) {
    if (!iso) return '—';
    const d = parseISO(iso);
    if (isNaN(d)) return String(iso);
    const months = t('months');
    return n(d.getDate()) + ' ' + months[d.getMonth()] + (withYear ? ' ' + n(d.getFullYear()) : '');
  }
  function dateFull(iso) {
    if (!iso) return '—';
    return dayName(dowOf(iso), true) + ', ' + dateLabel(iso, true);
  }
  function time12(hhmm) {
    if (!hhmm) return '';
    const [h, m] = String(hhmm).split(':').map(Number);
    const ap = h >= 12 ? t('pm') : t('am');
    const hr = h % 12 === 0 ? 12 : h % 12;
    return n(hr) + ':' + n(String(m).padStart(2, '0')) + ' ' + ap;
  }
  function relDate(iso) {
    const diff = Math.round((parseISO(iso) - parseISO(todayISO())) / 864e5);
    if (diff === 0) return t('todayAt');
    if (diff === 1) return t('tomorrow');
    if (diff > 1) return t('inDays', { n: n(diff) });
    return dateLabel(iso);
  }
  function daysUntil(iso) {
    if (!iso) return null;
    return Math.round((parseISO(iso) - parseISO(todayISO())) / 864e5);
  }
  /** minutes from now (academy tz) to a date+time */
  function minutesUntil(iso, hhmm) {
    const d = daysUntil(iso);
    if (d == null) return null;
    const [h, m] = String(hhmm || '00:00').split(':').map(Number);
    const now = nowParts();
    return d * 1440 + (h * 60 + m) - (now.h * 60 + now.m);
  }
  const initials = name => String(name || '?').trim().split(/\s+/).slice(0, 2)
    .map(w => w[0]).join('').toUpperCase();

  const SYMBOL = { BDT: '৳', USD: '$', EUR: '€', GBP: '£', INR: '₹', AED: 'د.إ', PKR: '₨' };
  const money = (v, cur) => {
    const c = cur || 'BDT';
    const sym = SYMBOL[c] || (c + ' ');
    return sym + n(Number(v || 0).toLocaleString('en-US'));
  };

  /* ---------------------------------------------------------------- theme --*/
  const theme = {
    get() { return localStorage.getItem('af_theme') || 'system'; },
    set(v) {
      localStorage.setItem('af_theme', v);
      this.apply();
    },
    apply() {
      const v = this.get();
      const root = document.documentElement;
      if (v === 'system') root.removeAttribute('data-theme');
      else root.setAttribute('data-theme', v);
      const dark = v === 'dark' || (v === 'system' &&
        window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', dark ? '#0b0e13' : '#f2f3f6');
    }
  };

  /* --------------------------------------------------------------- router --
     Tabs live in the URL, so the back button steps back through the app
     instead of leaving it, and a reload lands where you were.               */
  const routeHandlers = [];
  const router = {
    parse() {
      const raw = (location.hash || '').replace(/^#\/?/, '');
      const [role, tab, arg] = raw.split('/');
      return { role: role || '', tab: tab || '', arg: arg || '' };
    },
    go(role, tab, arg, replace) {
      const h = '#/' + role + (tab ? '/' + tab : '') + (arg ? '/' + arg : '');
      if (location.hash === h) { this.emit(); return; }
      if (replace) history.replaceState({}, '', h);
      else history.pushState({}, '', h);
      this.emit();
    },
    on(fn) { routeHandlers.push(fn); },
    emit() { const r = this.parse(); routeHandlers.forEach(fn => { try { fn(r); } catch (e) {} }); }
  };

  /* ---------------------------------------------------------------- toast --*/
  let toastTimer;
  function toast(msg, kind) {
    const el = document.getElementById('toast');
    if (!el) return;
    const mark = kind === 'ok' ? 'check' : kind === 'err' ? 'alert' : 'info';
    el.innerHTML = icon(mark) + '<span></span>';
    el.querySelector('span').textContent = msg;
    el.className = 'toast show ' + (kind || '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.className = 'toast ' + (kind || ''); }, kind === 'err' ? 4200 : 2600);
  }

  /** short vibration for a confirmed physical action (no-op where unsupported) */
  function buzz(ms) {
    try { if (navigator.vibrate) navigator.vibrate(ms || 12); } catch (e) {}
  }

  /* --------------------------------------------------------------- dialog --*/
  let dlgOpen = false, pushedState = false, lastFocus = null, onCloseCb = null, backPending = false;
  let dlgLocked = false;   // a locked dialog cannot be dismissed: no close button,
                           // no Escape, no backdrop, and Back keeps it open

  // the backdrop lives outside .modal and is never re-rendered, so bind it once
  function bindBackdrop() {
    const bd = document.querySelector('#modal .modal-backdrop');
    if (bd) bd.addEventListener('click', () => { if (!dlgLocked) closeDialog(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindBackdrop);
  else bindBackdrop();

  function focusables(box) {
    return [...box.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])')]
      .filter(el => el.offsetParent !== null || el === document.activeElement);
  }

  function trap(e) {
    if (!dlgOpen) return;
    const box = document.querySelector('#modal .modal');
    if (!box) return;
    if (e.key === 'Escape') { e.preventDefault(); if (!dlgLocked) closeDialog(); return; }
    if (e.key !== 'Tab') return;
    const f = focusables(box);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /**
   * dialog({ title, body, actions, onMount, onClose, wide })
   * Focus-trapped, labelled, and registered with history so Back closes it.
   */
  function dialog(opts) {
    const wrap = document.getElementById('modal');
    const box = wrap.querySelector('.modal');
    const id = 'dlg-title';

    dlgLocked = !!opts.locked;
    box.innerHTML =
      '<div class="modal-head"><h2 id="' + id + '">' + esc(opts.title || '') + '</h2>' +
      (dlgLocked ? '' :
        '<button class="btn icon ghost" data-close aria-label="' + esc(t('close')) + '">' + ICON.x + '</button>') +
      '</div>' +
      '<div class="modal-body">' + (opts.body || '') + '</div>' +
      (opts.actions ? '<div class="modal-foot">' + opts.actions + '</div>' : '');

    box.setAttribute('aria-labelledby', id);
    box.classList.toggle('wide', !!opts.wide);
    wrap.hidden = false;
    document.body.classList.add('locked');

    // Opening a dialog while one is already open SWAPS its contents. It must not
    // touch history: pushing/popping between two dialogs makes the browser's
    // popstate arrive after the new dialog opened and close it again.
    const swapping = dlgOpen;
    if (swapping && onCloseCb) { const prev = onCloseCb; onCloseCb = null; prev(); }
    if (!swapping) lastFocus = document.activeElement;
    dlgOpen = true;
    onCloseCb = opts.onClose || null;

    if (!pushedState) { history.pushState({ afDialog: 1 }, '', location.href); pushedState = true; }

    box.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => closeDialog()));
    document.addEventListener('keydown', trap, true);

    if (opts.onMount) opts.onMount(box);

    const f = focusables(box);
    const auto = box.querySelector('[autofocus]') || f.find(el => el.tagName === 'INPUT') || f[0];
    if (auto) setTimeout(() => auto.focus(), 30);
    return box;
  }

  function closeDialog(fromPop) {
    if (!dlgOpen) return;
    dlgOpen = false;
    dlgLocked = false;
    const wrap = document.getElementById('modal');
    wrap.hidden = true;
    wrap.querySelector('.modal').innerHTML = '';
    document.body.classList.remove('locked');
    document.removeEventListener('keydown', trap, true);
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
    lastFocus = null;
    const cb = onCloseCb; onCloseCb = null;
    if (!fromPop && pushedState) { pushedState = false; backPending = true; history.back(); }
    else pushedState = false;
    if (cb) cb();
  }

  window.addEventListener('popstate', () => {
    // our own history.back() from closeDialog: already handled, and it must not
    // close whatever dialog may have opened in the meantime
    if (backPending) { backPending = false; return; }
    // a locked dialog holds the app: put the entry back and stay put
    if (dlgOpen && dlgLocked) { history.pushState({ afDialog: 1 }, '', location.href); return; }
    if (dlgOpen) { closeDialog(true); return; }
    pushedState = false;
    router.emit();
  });

  /** confirm(...) -> Promise<boolean> */
  function confirmDialog(opts) {
    return new Promise(resolve => {
      let answered = false;
      dialog({
        title: opts.title,
        body: '<p class="muted">' + esc(opts.message || t('areYouSure')) + '</p>' +
          (opts.extra || ''),
        actions:
          '<button class="btn ghost grow" data-close>' + esc(opts.cancelText || t('cancel')) + '</button>' +
          '<button class="btn ' + (opts.danger ? 'danger' : 'primary') + ' grow" id="dlgYes">' +
          esc(opts.okText || t('confirm')) + '</button>',
        onMount(box) {
          box.querySelector('#dlgYes').addEventListener('click', () => {
            answered = true;
            const extraVal = box.querySelector('#dlgInput');
            closeDialog();
            resolve(extraVal ? extraVal.value : true);
          });
        },
        onClose() { if (!answered) resolve(false); }
      });
    });
  }

  /* ------------------------------------------------------------- rendering --*/
  let lastKey = '';
  /** paint(html, key) — keeps scroll position when the view identity is unchanged */
  function paint(html, key) {
    const same = key && key === lastKey;
    const y = window.scrollY;
    app().innerHTML = html;
    try { window.scrollTo(0, same ? y : 0); } catch (e) { /* not every host implements it */ }
    lastKey = key || '';
  }

  function loading() {
    app().innerHTML = '<div class="loading"><div class="spinner" role="status" aria-label="' +
      esc(t('loading')) + '"></div></div>';
  }

  /* ----------------------------------------------------------------- bits --*/
  const ICON = {
    home: '<svg viewBox="0 0 24 24"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
    calendar: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>',
    users: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.2"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M17 11.2A3 3 0 0 0 17 5.3M18.5 20a5.6 5.6 0 0 0-3-5"/></svg>',
    gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2"/><path d="M19.6 13.4a1.7 1.7 0 0 0 .4 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2 2 2 0 1 1-4 0 1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9 2 2 0 1 1 0-4 1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 2.9-1.2 2 2 0 1 1 4 0 1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 .4 1.8z"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>',
    x: '<svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    left: '<svg viewBox="0 0 24 24"><path d="m15 5-7 7 7 7"/></svg>',
    right: '<svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg>',
    bell: '<svg viewBox="0 0 24 24"><path d="M18 9a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7M13.7 20a2 2 0 0 1-3.4 0"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    minus: '<svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg>',
    cash: '<svg viewBox="0 0 24 24"><rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/></svg>',
    alert: '<svg viewBox="0 0 24 24"><path d="M12 3 2.5 20h19z"/><path d="M12 10v4M12 17.2v.1"/></svg>',
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></svg>',
    print: '<svg viewBox="0 0 24 24"><path d="M7 9V3h10v6M7 19H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><rect x="7" y="15" width="10" height="6"/></svg>',
    down: '<svg viewBox="0 0 24 24"><path d="M12 3v13m0 0 5-5m-5 5-5-5M4 21h16"/></svg>',
    up: '<svg viewBox="0 0 24 24"><path d="M12 21V8m0 0 5 5M12 8 7 13M4 3h16"/></svg>',
    user: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.6"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/></svg>',
    empty: '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 11h18M9 6V3h6v3"/></svg>',
    wifi: '<svg viewBox="0 0 24 24"><path d="M2 8.5a15 15 0 0 1 20 0M5.5 12a10 10 0 0 1 13 0M9 15.5a5 5 0 0 1 6 0M12 19.5v.1"/></svg>',
    info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.1"/></svg>',
    seat: '<svg viewBox="0 0 24 24"><path d="M6 4h12v7a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4zM8 15v5M16 15v5"/></svg>'
  };

  const icon = (k, cls) => (ICON[k] || '').replace('<svg', '<svg class="' + (cls || 'ic') + '" aria-hidden="true"');

  function logo(cls) {
    const src = (window.AF_CONFIG && AF_CONFIG.logo) || 'assets/icon.svg';
    return '<img src="' + esc(src) + '" alt="" class="' + cls + '">';
  }

  /** avatar(name, cls, course, courseWas) — courseWas remembers the hue to
      restore when a status class is later cleared */
  function avatar(name, cls, course, courseWas) {
    return '<span class="avatar ' + (cls || '') + '"' +
      (course ? ' data-course="' + esc(course) + '"' : '') +
      (courseWas ? ' data-course-was="' + esc(courseWas) + '"' : '') +
      ' aria-hidden="true">' + esc(initials(name)) + '</span>';
  }

  /** colour a quantity: plenty / running low / none left */
  function qClass(value, lowAt) {
    const v = Number(value) || 0;
    if (v <= 0) return 'q-none';
    return v <= (lowAt == null ? 2 : lowAt) ? 'q-low' : 'q-ok';
  }
  const qty = (value, lowAt) => '<b class="' + qClass(value, lowAt) + '">' + n(value) + '</b>';

  function ring(pct, centerHtml) {
    const r = 52, circ = 2 * Math.PI * r;
    const off = circ * (1 - Math.max(0, Math.min(1, pct || 0)));
    return '<div class="ring"><svg viewBox="0 0 128 128" aria-hidden="true">' +
      '<defs><linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0%" stop-color="var(--ring-1)"/><stop offset="100%" stop-color="var(--ring-2)"/>' +
      '</linearGradient></defs>' +
      '<circle class="track" cx="64" cy="64" r="' + r + '" fill="none" stroke-width="11"/>' +
      '<circle class="bar" cx="64" cy="64" r="' + r + '" fill="none" stroke-width="11" ' +
      'stroke-dasharray="' + circ.toFixed(1) + '" stroke-dashoffset="' + circ.toFixed(1) + '" ' +
      'data-off="' + off.toFixed(1) + '"/></svg>' +
      '<div class="ring-mid">' + centerHtml + '</div></div>';
  }
  function animateRings(root) {
    (root || document).querySelectorAll('.ring .bar').forEach(c => {
      requestAnimationFrame(() => { c.style.strokeDashoffset = c.dataset.off; });
    });
  }

  /** badge(text, kind, solid) — solid = a fact, soft = a label */
  const badge = (text, kind, solid) =>
    '<span class="badge ' + (kind || '') + (solid ? ' solid' : '') + '">' + esc(text) + '</span>';
  const courseBadge = c => badge(t(c || 'basic'), c || 'basic');
  /** a status badge always carries an icon too, so colour is never the only signal */
  const statusBadge = s => '<span class="badge ' + statusKind(s) + ' solid">' +
    icon(statusIcon(s)) + esc(t(s)) + '</span>';
  const statusIcon = s => ({
    present: 'check', approved: 'check', paid: 'check',
    pending: 'clock', waitlist: 'clock',
    absent: 'x', declined: 'x', cancelled: 'x', expired: 'x',
    makeup: 'right'
  })[s] || 'info';

  const statusKind = s => ({
    approved: 'ok', present: 'ok', pending: 'wait', waitlist: 'wait',
    declined: 'bad', cancelled: 'bad', absent: 'bad', makeup: 'info', expired: 'bad'
  })[s] || '';

  function empty(msg, actionHtml) {
    return '<div class="panel empty">' + icon('empty', 'ic-lg') +
      '<p>' + esc(msg) + '</p>' + (actionHtml || '') + '</div>';
  }

  function field(label, inner, hint) {
    return '<label class="field"><span class="field-label">' + esc(label) + '</span>' + inner +
      (hint ? '<span class="field-hint">' + esc(hint) + '</span>' : '') + '</label>';
  }

  /* delegated events: survives re-render, no listener bookkeeping */
  const delegates = [];
  function on(selector, event, handler) {
    delegates.push({ selector, event, handler });
  }
  ['click', 'change', 'input', 'submit'].forEach(evt => {
    document.addEventListener(evt, e => {
      delegates.filter(d => d.event === evt).forEach(d => {
        const el = e.target.closest(d.selector);
        if (el && document.contains(el)) d.handler(el, e);
      });
    }, evt === 'submit');
  });

  window.UI = {
    app, esc, DAY, dayKey, dayName, setTZ, todayISO, nowParts, addDaysISO, dowOf, parseISO,
    dateLabel, dateFull, time12, relDate, daysUntil, minutesUntil, initials, money,
    theme, router, toast, buzz, dialog, closeDialog, confirm: confirmDialog,
    paint, loading, ICON, icon, logo, avatar, ring, animateRings, qClass, qty,
    badge, courseBadge, statusBadge, statusIcon, statusKind, empty, field, on
  };
})();
