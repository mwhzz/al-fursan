/* Al Fursan — boot, login screen, routing */
(function () {
  const U = UI;
  let mode = 'student';

  /* ---------------- login ---------------- */
  function loginView() {
    const isS = mode === 'student';
    U.app().innerHTML =
      '<div class="login-wrap"><div class="glass login view">' +
        U.logo('login-logo') +
        '<h1 class="chrome-text">AL FURSAN</h1>' +
        '<div class="brand-sub" style="margin-bottom:20px">Equestrian Academy</div>' +

        '<div class="segmented" style="margin-bottom:20px">' +
          '<button class="' + (isS ? 'on' : '') + '" data-mode="student">' + U.esc(t('studentLogin')) + '</button>' +
          '<button class="' + (!isS ? 'on' : '') + '" data-mode="admin">' + U.esc(t('adminLogin')) + '</button>' +
        '</div>' +

        (isS ? studentForm() : adminForm()) +

        '<label class="row" style="justify-content:center;gap:8px;margin-top:16px;cursor:pointer">' +
          '<input type="checkbox" id="remember" checked style="width:16px;height:16px;accent-color:#cdd4dd">' +
          '<span class="tiny dim">' + (I18N.lang === 'bn' ? 'মনে রাখুন' : 'Keep me signed in') + '</span></label>' +

        '<div class="row" style="justify-content:center;margin-top:14px">' + U.langBtn() + '</div>' +
        (API.LIVE ? '' : '<div class="banner" style="margin-top:16px;text-align:left">' + U.esc(t('demoBanner')) +
          '<br><b>Demo:</b> Zawad / 1111 · admin: alfursan</div>') +
      '</div></div>';
    bindLogin();
  }

  function studentForm() {
    return '<div class="stack" style="gap:16px">' +
      '<p class="small muted">' + U.esc(t('loginHint')) + '</p>' +
      '<input class="input" id="lname" placeholder="' + U.esc(t('name')) + '" autocomplete="name" autocapitalize="words">' +
      '<div class="pin" id="pin">' + [0, 1, 2, 3].map(i =>
        '<input inputmode="numeric" maxlength="1" data-i="' + i + '" aria-label="PIN ' + (i + 1) + '">').join('') + '</div>' +
      '<button class="btn primary block" id="go">' + U.esc(t('login')) + '</button></div>';
  }

  function adminForm() {
    return '<div class="stack" style="gap:16px">' +
      '<p class="small muted">' + U.esc(t('adminPassHint')) + '</p>' +
      '<input class="input" id="apass" type="password" placeholder="' + U.esc(t('password')) + '" autocomplete="current-password">' +
      '<button class="btn gold block" id="ago">' + U.esc(t('login')) + '</button></div>';
  }

  function bindLogin() {
    document.querySelectorAll('[data-mode]').forEach(b =>
      b.addEventListener('click', () => { mode = b.dataset.mode; loginView(); }));
    const lb = document.getElementById('langBtn');
    if (lb) lb.addEventListener('click', () => { I18N.toggle(); loginView(); });

    const pin = document.getElementById('pin');
    if (pin) {
      const boxes = [...pin.querySelectorAll('input')];
      boxes.forEach((b, i) => {
        b.addEventListener('input', () => {
          b.value = b.value.replace(/\D/g, '');
          pin.classList.remove('err');
          if (b.value && i < 3) boxes[i + 1].focus();
          if (i === 3 && b.value) doStudentLogin();
        });
        b.addEventListener('keydown', e => {
          if (e.key === 'Backspace' && !b.value && i > 0) boxes[i - 1].focus();
          if (e.key === 'Enter') doStudentLogin();
        });
        b.addEventListener('paste', e => {
          const txt = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 4);
          if (txt.length === 4) {
            e.preventDefault();
            boxes.forEach((x, k) => x.value = txt[k]);
            doStudentLogin();
          }
        });
      });
      document.getElementById('go').addEventListener('click', doStudentLogin);
      document.getElementById('lname').addEventListener('keydown', e => {
        if (e.key === 'Enter') boxes[0].focus();
      });
    }
    const ago = document.getElementById('ago');
    if (ago) {
      ago.addEventListener('click', doAdminLogin);
      document.getElementById('apass').addEventListener('keydown', e => { if (e.key === 'Enter') doAdminLogin(); });
    }
  }

  function busy(btn, on) {
    if (!btn) return;
    btn.disabled = on;
    btn.innerHTML = on ? '<span class="spinner"></span>' : U.esc(t('login'));
  }

  async function doStudentLogin() {
    const name = (document.getElementById('lname').value || '').trim();
    const pin = [...document.querySelectorAll('#pin input')].map(x => x.value).join('');
    const btn = document.getElementById('go');
    if (!name) return U.toast(t('fillAll'), 'err');
    if (pin.length !== 4) return U.toast(t('pin4'), 'err');
    busy(btn, true);
    try {
      const res = await API.studentLogin(name, pin);
      if (!res || !res.ok) {
        busy(btn, false);
        document.getElementById('pin').classList.add('err');
        return U.toast(t('wrongLogin'), 'err');
      }
      const remember = document.getElementById('remember').checked;
      API.session.setStudent({ name, pin }, remember);
      API.cache.put('student', res);
      STUDENT.start(res, { name, pin });
    } catch (e) {
      busy(btn, false);
      U.toast(t('netErr'), 'err');
    }
  }

  async function doAdminLogin() {
    const pass = document.getElementById('apass').value;
    const btn = document.getElementById('ago');
    if (!pass) return U.toast(t('fillAll'), 'err');
    busy(btn, true);
    try {
      const res = await API.adminLogin(pass);
      if (!res || !res.ok) { busy(btn, false); return U.toast(t('wrongPass'), 'err'); }
      API.session.setAdmin(pass, document.getElementById('remember').checked);
      const ov = await API.overview();
      if (!ov.ok) { busy(btn, false); return U.toast(t('netErr'), 'err'); }
      ADMIN.start(ov);
    } catch (e) {
      busy(btn, false);
      U.toast(t('netErr'), 'err');
    }
  }

  /* ---------------- boot ---------------- */
  async function boot() {
    I18N.init();

    const adminPass = API.session.adminPass;
    if (adminPass) {
      U.loading();
      try {
        const ov = await API.overview();
        if (ov && ov.ok) return ADMIN.start(ov);
      } catch (e) { /* fall through to login */ }
      API.session.clear();
    }

    const cred = API.session.student;
    if (cred && cred.name) {
      const cached = API.cache.get('student');
      if (cached) { STUDENT.start(cached, cred); return; }
      U.loading();
      try {
        const res = await API.studentRefresh(cred);
        if (res && res.ok) { API.cache.put('student', res); return STUDENT.start(res, cred); }
      } catch (e) { /* fall through */ }
      API.session.clear();
    }
    loginView();
  }

  /* ---------------- PWA ---------------- */
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; });
  window.AF_INSTALL = function () {
    if (!deferredPrompt) return U.toast(I18N.lang === 'bn'
      ? 'ব্রাউজার মেনু থেকে "Add to Home screen" দিন'
      : 'Use your browser menu → "Add to Home screen"');
    deferredPrompt.prompt();
    deferredPrompt = null;
  };

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  let booted = false;
  const once = () => { if (!booted) { booted = true; boot(); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', once);
  else once();
})();
