/* Al Fursan — data layer. Supabase RPC when configured, demo store otherwise. */
(function () {
  const C = window.AF_CONFIG || {};
  const SUPABASE = !!(C.url && C.anonKey && !/YOUR|example/i.test(C.url));
  const API_URL = C.api || '/api/rpc';

  /* Which backend answers. 'auto' asks the Netlify function once; if the site
     is not on Netlify (or it is opened from a file), it falls back to this
     browser for the session. */
  let mode = C.backend === 'supabase' || (C.backend === 'auto' && SUPABASE) ? 'supabase'
    : C.backend === 'netlify' ? 'netlify'
    : C.backend === 'demo' ? 'demo'
    : 'auto';

  const LIVE = mode !== 'demo';

  async function netlifyCall(fn, args) {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fn, args: args || {} })
    });
    if (res.status === 404 || res.status === 405) throw Object.assign(new Error('no function'), { missing: true });
    const text = await res.text();
    let out;
    try { out = JSON.parse(text); }
    catch (e) { throw Object.assign(new Error('bad response'), { missing: res.status >= 500 }); }
    if (!res.ok && out && out.ok === undefined) throw new Error('rpc ' + fn + ' ' + res.status);
    return out;
  }

  let online = navigator.onLine !== false;
  const listeners = [];
  function setOnline(v) {
    if (online === v) return;
    online = v;
    listeners.forEach(fn => { try { fn(v); } catch (e) {} });
  }
  window.addEventListener('online', () => setOnline(true));
  window.addEventListener('offline', () => setOnline(false));

  async function rpc(fn, args) {
    if (mode === 'demo') {
      const out = await window.DEMO.call(fn, args);
      setOnline(true);
      return out;
    }

    if (mode === 'auto' || mode === 'netlify') {
      try {
        const out = await netlifyCall(fn, args);
        if (mode === 'auto') mode = 'netlify';        // it answered: stay with it
        setOnline(true);
        return out;
      } catch (e) {
        /* Still deciding, we are online, and the endpoint is not answering:
           this site has no function (opened from a file, a plain static host,
           a browser without fetch). Run in this browser instead of failing.
           Once a call has succeeded the mode is fixed and we never fall back,
           so a blip on the real site cannot quietly strand a rider on local
           data. Offline is not a reason to switch either. */
        const noEndpoint = e.missing || e instanceof TypeError || typeof fetch !== 'function';
        if (mode === 'auto' && noEndpoint && navigator.onLine !== false) {
          mode = 'demo';
          return window.DEMO.call(fn, args);
        }
        if (!navigator.onLine) setOnline(false);
        throw e;
      }
    }

    try {
      const res = await fetch(C.url.replace(/\/$/, '') + '/rest/v1/rpc/' + fn, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: C.anonKey,
          Authorization: 'Bearer ' + C.anonKey
        },
        body: JSON.stringify(args || {})
      });
      setOnline(true);
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        const err = new Error('rpc ' + fn + ' ' + res.status);
        err.detail = txt.slice(0, 300);
        throw err;
      }
      return res.json();
    } catch (e) {
      if (!navigator.onLine) setOnline(false);
      throw e;
    }
  }

  /* fire-and-forget error reporting so the owner can see failures */
  let reported = 0;
  function report(kind, message, context) {
    if (reported++ > 20) return;
    try { rpc('log_error', { p_kind: kind, p_message: String(message), p_context: String(context || '') }); }
    catch (e) { /* reporting must never throw */ }
  }
  window.addEventListener('error', e => report('js', e.message, (e.filename || '') + ':' + (e.lineno || '')));
  window.addEventListener('unhandledrejection', e =>
    report('promise', (e.reason && e.reason.message) || String(e.reason), ''));

  const cache = {
    put(k, v) { try { localStorage.setItem('af_c_' + k, JSON.stringify({ t: Date.now(), v })); } catch (e) {} },
    get(k) {
      try {
        const r = JSON.parse(localStorage.getItem('af_c_' + k) || 'null');
        return r ? r.v : null;
      } catch (e) { return null; }
    },
    at(k) {
      try {
        const r = JSON.parse(localStorage.getItem('af_c_' + k) || 'null');
        return r ? r.t : 0;
      } catch (e) { return 0; }
    },
    drop(k) { try { localStorage.removeItem('af_c_' + k); } catch (e) {} }
  };

  /* ---- session: a token only. No PIN, no password is ever stored. ---- */
  const session = {
    get token() { return sessionStorage.getItem('af_tok') || localStorage.getItem('af_tok') || null; },
    get role() { return sessionStorage.getItem('af_role') || localStorage.getItem('af_role') || null; },
    set(role, token, remember) {
      sessionStorage.setItem('af_tok', token);
      sessionStorage.setItem('af_role', role);
      if (remember) { localStorage.setItem('af_tok', token); localStorage.setItem('af_role', role); }
      else { localStorage.removeItem('af_tok'); localStorage.removeItem('af_role'); }
    },
    clear() {
      ['af_tok', 'af_role'].forEach(k => { sessionStorage.removeItem(k); localStorage.removeItem(k); });
      cache.drop('student'); cache.drop('admin');
    }
  };

  const T = () => session.token;

  window.API = {
    LIVE, rpc, cache, session, report,
    get backend() { return mode; },
    get online() { return online; },
    onConnection(fn) { listeners.push(fn); },

    bootstrap: () => rpc('bootstrap', {}),

    /* rider */
    studentLogin: (id, name, pin, days) =>
      rpc('student_login', { p_id: id || null, p_name: name || null, p_pin: pin, p_days: days || 30 }),
    studentSession: () => rpc('student_session', { p_token: T() }),
    book: (slot, date, note) => rpc('student_book', { p_token: T(), p_slot: slot, p_date: date, p_note: note || '' }),
    cancelBooking: (id, reason) => rpc('student_cancel', { p_token: T(), p_id: id, p_reason: reason || '' }),
    absence: (slot, date, reason) => rpc('student_absence', { p_token: T(), p_slot: slot, p_date: date, p_reason: reason || '' }),
    updateProfile: (phone, pin) => rpc('student_update', { p_token: T(), p_phone: phone, p_pin: pin || '' }),
    markNotificationsRead: () => rpc('student_seen', { p_token: T() }),

    /* admin */
    adminLogin: (user, pass, days) => rpc('admin_login', { p_user: user, p_pass: pass, p_days: days || 7 }),
    adminSession: () => rpc('admin_session', { p_token: T() }),
    studentDetail: id => rpc('admin_student_detail', { p_token: T(), p_id: id }),
    saveStudent: data => rpc('admin_save_student', { p_token: T(), p_data: data }),
    deleteStudent: (id, confirm) => rpc('admin_delete_student', { p_token: T(), p_id: id, p_confirm: confirm }),
    mark: (student, date, time, status) =>
      rpc('admin_mark', { p_token: T(), p_student: student, p_date: date, p_time: time, p_status: status }),
    markBulk: (slot, date, status) =>
      rpc('admin_mark_bulk', { p_token: T(), p_slot: slot, p_date: date, p_status: status }),
    bookingAction: (ids, action, reason) =>
      rpc('admin_booking_action', { p_token: T(), p_ids: ids, p_action: action, p_reason: reason || '' }),
    bookingsSeen: () => rpc('admin_bookings_seen', { p_token: T() }),
    closeDay: (date, slot, reason) =>
      rpc('admin_close_day', { p_token: T(), p_date: date, p_slot: slot || null, p_reason: reason || '' }),
    openDay: id => rpc('admin_open_day', { p_token: T(), p_id: id }),
    saveSlot: data => rpc('admin_save_slot', { p_token: T(), p_data: data }),
    deleteSlot: id => rpc('admin_delete_slot', { p_token: T(), p_id: id }),
    addToSlot: (slot, student) => rpc('admin_add_to_slot', { p_token: T(), p_slot: slot, p_student: student }),
    removeFromSlot: (slot, student) => rpc('admin_remove_from_slot', { p_token: T(), p_slot: slot, p_student: student }),
    saveInvoice: data => rpc('admin_save_invoice', { p_token: T(), p_data: data }),
    deleteInvoice: id => rpc('admin_delete_invoice', { p_token: T(), p_id: id }),
    savePayment: data => rpc('admin_save_payment', { p_token: T(), p_data: data }),
    deletePayment: id => rpc('admin_delete_payment', { p_token: T(), p_id: id }),
    renew: (student, amount) => rpc('admin_renew', { p_token: T(), p_student: student, p_amount: amount == null ? null : amount }),
    setGuide: value => rpc('set_guide', { p_token: T(), p_value: value }),
    saveSettings: data => rpc('admin_save_settings', { p_token: T(), p_data: data }),
    changePassword: (cur, next) => rpc('admin_change_password', { p_token: T(), p_current: cur, p_new: next }),
    saveUser: data => rpc('admin_save_user', { p_token: T(), p_data: data }),
    deleteUser: id => rpc('admin_delete_user', { p_token: T(), p_id: id }),
    notifyTest: () => rpc('admin_notify_test', { p_token: T() }),
    pushSubscribe: sub => rpc('push_subscribe', { p_token: T(), p_sub: sub }),
    pushUnsubscribe: endpoint => rpc('push_unsubscribe', { p_token: T(), p_endpoint: endpoint }),
    exportAll: () => rpc('admin_export', { p_token: T() }),
    importAll: (data, mode) => rpc('admin_import', { p_token: T(), p_data: data, p_mode: mode || 'preview' }),

    logout: () => rpc('logout', { p_token: T() }).catch(() => ({ ok: true }))
  };
})();
