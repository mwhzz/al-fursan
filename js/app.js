/* Al Fursan — boot, sign-in, routing, PWA */
(function () {
  const U = UI;
  let boot = null;          // bootstrap payload (settings + name directory)
  let mode = 'student';
  let step = 'name';        // name -> pin
  let chosen = null;        // {id, name}
  let typed = '';
  let staffUser = '';
  let errorMsg = '';

  const S = () => (boot && boot.settings) || {};

  /* ------------------------------------------------------------- sign in --*/
  function nameStep() {
    const dir = (boot && boot.directory) || [];
    const q = typed.trim().toLowerCase();
    const list = q ? dir.filter(x => x.name.toLowerCase().includes(q)) : dir;

    return '<div class="stack">' +
      '<p class="small muted">' + U.esc(t('loginHint')) + '</p>' +
      '<input class="input" id="lname" placeholder="' + U.esc(t('typeName')) + '" value="' + U.esc(typed) +
        '" autocomplete="name" autocapitalize="words" autofocus>' +
      (dir.length
        ? '<div class="list name-list">' + list.slice(0, 40).map(x =>
            '<button class="item" data-id="' + U.esc(x.id) + '" data-name="' + U.esc(x.name) + '">' +
            '<span class="avatar">' + U.esc(U.initials(x.name)) + '</span>' +
            '<span class="grow"><b>' + U.esc(x.name) + '</b></span>' + U.icon('right') + '</button>').join('') +
          (list.length ? '' : '<p class="small dim center" style="padding:10px">' + U.esc(t('nothingHere')) + '</p>') +
          '</div>'
        : '') +
      (dir.length ? '' : '<button class="btn primary block" id="toPin">' + U.esc(t('login')) + '</button>') +
      (dir.length ? '<button class="btn ghost block" id="typeInstead">' + U.esc(t('otherName')) + '</button>' : '') +
      '</div>';
  }

  function pinStep() {
    return '<div class="stack">' +
      '<button class="btn sm ghost" id="backName" style="justify-self:start">' + U.icon('left') +
        U.esc(chosen && chosen.name ? chosen.name : t('back')) + '</button>' +
      '<p class="small muted">' + U.esc(t('pin')) + '</p>' +
      '<div class="pin' + (errorMsg ? ' err' : '') + '" id="pin">' + [0, 1, 2, 3].map(i =>
        '<input inputmode="numeric" type="password" maxlength="1" data-i="' + i +
        '" aria-label="' + U.esc(t('pin')) + ' ' + (i + 1) + '">').join('') + '</div>' +
      '<label class="check" style="justify-content:center"><input type="checkbox" id="showPin">' +
        '<span class="tiny">' + U.esc(t('showPin')) + '</span></label>' +
      (errorMsg ? '<p class="form-error center">' + U.esc(errorMsg) + '</p>' : '') +
      '<button class="btn primary block" id="go">' + U.esc(t('login')) + '</button>' +
      forgotBlock() +
      '</div>';
  }

  function forgotBlock() {
    const phone = S().contact_phone, wa = S().whatsapp;
    if (!phone && !wa) return '<p class="tiny dim center">' + U.esc(t('forgotHelp')) + '</p>';
    return '<details class="tiny dim" style="text-align:center">' +
      '<summary style="cursor:pointer;padding:6px">' + U.esc(t('forgotPin')) + '</summary>' +
      '<div class="stack sm" style="margin-top:8px">' +
      (phone ? '<a class="btn sm ghost block" href="tel:' + U.esc(phone) + '">' + U.esc(t('callAcademy')) + '</a>' : '') +
      (wa ? '<a class="btn sm ghost block" target="_blank" rel="noopener" href="https://wa.me/' +
        U.esc(String(wa).replace(/[^0-9]/g, '')) + '">' + U.esc(t('whatsappAcademy')) + '</a>' : '') +
      '</div></details>';
  }

  function staffStep() {
    return '<div class="stack">' +
      '<p class="small muted">' + U.esc(t('adminPassHint')) + '</p>' +
      /* Never guess a username, but keep the one that was typed: a failed
         attempt used to wipe the field and make you start over. */
      '<input class="input" id="auser" placeholder="' + U.esc(t('username')) +
        '" autocomplete="username" autocapitalize="none" autocorrect="off"' +
        ' value="' + U.esc(staffUser) + '">' +
      '<input class="input" id="apass" type="password" placeholder="' + U.esc(t('password')) + '" autocomplete="current-password">' +
      (errorMsg ? '<p class="form-error">' + U.esc(errorMsg) + '</p>' : '') +
      '<button class="btn primary block" id="ago">' + U.esc(t('login')) + '</button>' +
      '</div>';
  }

  function loginView() {
    const isStaff = mode === 'admin';
    U.app().innerHTML =
      '<div class="login-wrap"><div class="panel login view">' +
        U.logo('mark') +
        (function () {
          const name = S().academy_name || 'Al Fursan Equestrian Academy';
          // don't print "Equestrian Academy" twice when it is already in the name
          const sub = name.toLowerCase().indexOf(t('academySub').toLowerCase()) >= 0 ? '' : t('academySub');
          return '<h1 style="text-wrap:balance">' + U.esc(name) + '</h1>' +
            (sub ? '<div class="brand-sub">' + U.esc(sub) + '</div>' : '');
        })() +
        '<div style="height:18px"></div>' +

        (isStaff ? staffStep() : (step === 'pin' ? pinStep() : nameStep())) +

        '<label class="check" style="justify-content:center;margin-top:14px">' +
          '<input type="checkbox" id="remember"' + (isStaff ? '' : ' checked') + '>' +
          '<span class="tiny dim">' + U.esc(t('keepSignedIn')) + '</span></label>' +

        '<div class="row" style="justify-content:center;gap:8px;margin-top:12px">' +
          '<button class="btn sm ghost" id="langBtn">' + (I18N.lang === 'en' ? 'বাংলা' : 'EN') + '</button>' +
          // says where it takes you, not "Sign in" a second time
          '<button class="btn sm ghost" id="modeBtn">' +
            U.esc(isStaff ? t('riderLogin') : t('staffLogin')) + '</button>' +
        '</div>' +

        /* Say plainly which backend answered. Without this, a site that cannot
           reach its function looks identical to one that can — and the accounts
           are different, so "the password is wrong" is all you see. */
        (API.backend === 'demo'
          ? '<div class="banner warn" style="margin-top:16px;text-align:left">' + U.icon('alert') +
            '<span>' + U.esc(t('demoMode')) + '<br><b>Zawad / 1111</b> · staff <b>owner / alfursan</b></span></div>'
          : '') +
      '</div></div>';

    document.getElementById('nav').hidden = true;
    document.querySelector('.shell').classList.remove('signed-in');
    bindLogin();
  }

  function bindLogin() {
    const $ = s => document.querySelector(s);
    const $$ = s => document.querySelectorAll(s);

    const lname = $('#lname');
    if (lname) {
      lname.addEventListener('input', e => {
        typed = e.target.value;
        const pos = e.target.selectionStart;
        loginView();
        const el = document.getElementById('lname');
        if (el) { el.focus(); el.setSelectionRange(pos, pos); }
      });
      lname.addEventListener('keydown', e => {
        if (e.key === 'Enter' && typed.trim()) { chosen = { id: null, name: typed.trim() }; step = 'pin'; loginView(); }
      });
    }
    $$('[data-id]').forEach(b => b.addEventListener('click', () => {
      chosen = { id: b.dataset.id, name: b.dataset.name };
      step = 'pin'; errorMsg = ''; loginView();
    }));
    const ti = $('#typeInstead');
    if (ti) ti.addEventListener('click', () => {
      if (!typed.trim()) { U.toast(t('typeName')); return; }
      chosen = { id: null, name: typed.trim() }; step = 'pin'; loginView();
    });
    const toPin = $('#toPin');
    if (toPin) toPin.addEventListener('click', () => {
      if (!typed.trim()) return U.toast(t('fillAll'), 'err');
      chosen = { id: null, name: typed.trim() }; step = 'pin'; loginView();
    });
    const back = $('#backName');
    if (back) back.addEventListener('click', () => { step = 'name'; errorMsg = ''; loginView(); });

    const pin = $('#pin');
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
          if (txt.length === 4) { e.preventDefault(); boxes.forEach((x, k) => x.value = txt[k]); doStudentLogin(); }
        });
      });
      setTimeout(() => boxes[0] && boxes[0].focus(), 40);
      $('#showPin').addEventListener('change', e =>
        boxes.forEach(b => { b.type = e.target.checked ? 'text' : 'password'; }));
      $('#go').addEventListener('click', doStudentLogin);
    }

    const ago = $('#ago');
    if (ago) {
      ago.addEventListener('click', doAdminLogin);
      $('#apass').addEventListener('keydown', e => { if (e.key === 'Enter') doAdminLogin(); });
    }
    $('#langBtn').addEventListener('click', () => { I18N.toggle(); loginView(); });
    $('#modeBtn').addEventListener('click', () => {
      mode = mode === 'admin' ? 'student' : 'admin';
      step = 'name'; errorMsg = ''; loginView();
    });
  }

  function busy(sel, on, label) {
    const b = document.querySelector(sel);
    if (!b) return;
    b.disabled = on;
    b.innerHTML = on ? '<span class="spinner"></span>' : UI.esc(label || t('login'));
  }

  async function doStudentLogin() {
    const boxes = [...document.querySelectorAll('#pin input')];
    const pin = boxes.map(x => x.value).join('');
    if (pin.length !== 4) { errorMsg = t('pin4'); return loginView(); }
    busy('#go', true);
    try {
      const days = document.getElementById('remember').checked ? 60 : 1;
      const res = await API.studentLogin(chosen && chosen.id, chosen && chosen.name, pin, days);
      if (!res || !res.ok) {
        errorMsg = res && res.error === 'locked' ? t('lockedOut', { n: n(res.seconds || 60) }) : t('wrongLogin');
        loginView();
        return;
      }
      API.session.set('student', res.token, document.getElementById('remember').checked);
      const data = await API.studentSession();
      if (!data.ok) throw new Error('session');
      API.cache.put('student', data);
      started = 'student';
      U.router.go('student', 'overview', '', true);
      STUDENT.start(data, U.router.parse());
    } catch (e) {
      busy('#go', false);
      U.toast(t('netErr'), 'err');
    }
  }

  async function doAdminLogin() {
    const user = document.getElementById('auser').value.trim();
    const pass = document.getElementById('apass').value;
    staffUser = user;                       // survives the re-render on failure
    if (!user || !pass) { errorMsg = t('fillAll'); return loginView(); }
    busy('#ago', true);
    try {
      const remember = document.getElementById('remember').checked;
      const res = await API.adminLogin(user, pass, remember ? 14 : 1);
      if (!res || !res.ok) {
        errorMsg = res && res.error === 'locked' ? t('lockedOut', { n: n(res.seconds || 60) }) : t('wrongPass');
        loginView();
        return;
      }
      API.session.set('admin', res.token, remember);
      const data = await API.adminSession();
      if (!data.ok) throw new Error('session');
      API.cache.put('admin', data);
      started = 'admin';
      U.router.go('admin', 'today', '', true);
      ADMIN.start(data, U.router.parse());
    } catch (e) {
      busy('#ago', false);
      U.toast(t('netErr'), 'err');
    }
  }

  /* ---------------------------------------------------------------- start --*/
  let started = '';

  async function start() {
    I18N.init();
    U.theme.apply();

    try {
      boot = await API.bootstrap();
      if (boot && boot.settings) U.setTZ(boot.settings.timezone);
    } catch (e) {
      boot = API.cache.get('boot') || { settings: {}, directory: [] };
    }
    if (boot && boot.ok) API.cache.put('boot', boot);

    const role = API.session.role;
    const route = U.router.parse();

    if (role === 'admin') {
      U.loading();
      const cached = API.cache.get('admin');
      try {
        const data = await API.adminSession();
        if (data && data.ok) {
          API.cache.put('admin', data);
          started = 'admin';
          if (!route.role) U.router.go('admin', 'today', '', true);
          return ADMIN.start(data, U.router.parse());
        }
      } catch (e) {
        if (cached) { started = 'admin'; U.toast(t('offline')); return ADMIN.start(cached, route); }
      }
      API.session.clear();
    }

    if (role === 'student') {
      U.loading();
      const cached = API.cache.get('student');
      try {
        const data = await API.studentSession();
        if (data && data.ok) {
          API.cache.put('student', data);
          started = 'student';
          if (!route.role) U.router.go('student', 'overview', '', true);
          return STUDENT.start(data, U.router.parse());
        }
      } catch (e) {
        if (cached) { started = 'student'; U.toast(t('offline')); return STUDENT.start(cached, route); }
      }
      API.session.clear();
    }

    mode = route.role === 'admin' ? 'admin' : 'student';
    loginView();
  }

  U.router.on(r => {
    if (started === 'student' && r.role === 'student') STUDENT.route(r);
    else if (started === 'admin' && r.role === 'admin') ADMIN.route(r);
  });

  /* ------------------------------------------------------------------ PWA --*/
  let deferred = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; });
  window.AF_INSTALL = function () {
    if (deferred) { deferred.prompt(); deferred = null; return; }
    const iOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    U.dialog({
      title: t('installApp'),
      body: '<p class="muted">' + U.esc(iOS ? t('iosInstall')
        : 'Chrome: ⋮ → Add to Home screen') + '</p>' +
        (iOS ? '<ol class="small muted" style="padding-left:20px;display:grid;gap:6px">' +
          '<li>' + U.esc('Safari') + '</li><li>' + U.esc('Share') + '</li>' +
          '<li>' + U.esc('Add to Home Screen') + '</li></ol>' : ''),
      actions: '<button class="btn primary block" data-close>' + U.esc(t('close')) + '</button>'
    });
  };

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').then(reg => {
        reg.addEventListener('updatefound', () => {
          const w = reg.installing;
          if (!w) return;
          w.addEventListener('statechange', () => {
            if (w.state === 'installed' && navigator.serviceWorker.controller) showUpdate(w);
          });
        });
      }).catch(() => {});
      let reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloaded) return;
        reloaded = true;
        location.reload();
      });
    });
  }

  function showUpdate(worker) {
    if (document.getElementById('afUpdateBar')) return;
    U.toast(t('updateReady'));
    // must live outside #app — every render replaces that element's contents
    const host = document.body;
    const bar = document.createElement('div');
    bar.id = 'afUpdateBar';
    bar.className = 'banner info';
    bar.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(var(--nav-h) + 70px);z-index:95;width:min(92vw,420px)';
    bar.innerHTML = UI.icon('bell') + UI.esc(t('updateReady')) +
      '<button class="btn sm primary" id="doReload">' + UI.esc(t('reload')) + '</button>';
    host.appendChild(bar);
    bar.querySelector('#doReload').addEventListener('click', () => {
      worker.postMessage({ type: 'SKIP_WAITING' });
      setTimeout(() => location.reload(), 400);
    });
  }

  let booted = false;
  const once = () => { if (!booted) { booted = true; start(); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', once);
  else once();
})();
