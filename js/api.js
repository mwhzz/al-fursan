/* Al Fursan — data layer. Talks to Supabase RPC, or the demo store. */
(function () {
  const C = window.AF_CONFIG || {};
  const LIVE = !!(C.url && C.anonKey && !/YOUR|example/i.test(C.url));

  async function rpc(fn, args) {
    if (!LIVE) return window.DEMO.call(fn, args);
    const res = await fetch(C.url.replace(/\/$/, '') + '/rest/v1/rpc/' + fn, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: C.anonKey,
        Authorization: 'Bearer ' + C.anonKey
      },
      body: JSON.stringify(args || {})
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error('rpc ' + fn + ' ' + res.status + ' ' + txt.slice(0, 200));
    }
    return res.json();
  }

  const cache = {
    put(k, v) { try { localStorage.setItem('af_cache_' + k, JSON.stringify({ t: Date.now(), v })); } catch (e) {} },
    get(k) {
      try {
        const r = JSON.parse(localStorage.getItem('af_cache_' + k) || 'null');
        return r ? r.v : null;
      } catch (e) { return null; }
    }
  };

  const session = {
    get student() { try { return JSON.parse(sessionStorage.getItem('af_student') || localStorage.getItem('af_student') || 'null'); } catch (e) { return null; } },
    setStudent(s, remember) {
      const raw = JSON.stringify(s);
      sessionStorage.setItem('af_student', raw);
      if (remember) localStorage.setItem('af_student', raw); else localStorage.removeItem('af_student');
    },
    get adminPass() { return sessionStorage.getItem('af_admin') || localStorage.getItem('af_admin') || null; },
    setAdmin(p, remember) {
      sessionStorage.setItem('af_admin', p);
      if (remember) localStorage.setItem('af_admin', p); else localStorage.removeItem('af_admin');
    },
    clear() {
      ['af_student', 'af_admin'].forEach(k => { sessionStorage.removeItem(k); localStorage.removeItem(k); });
    }
  };

  window.API = {
    LIVE, rpc, cache, session,

    studentLogin: (name, pin) => rpc('student_login', { p_name: name, p_pin: pin }),
    studentRefresh(cred) { return rpc('student_login', { p_name: cred.name, p_pin: cred.pin }); },

    book: (cred, slot, date, note) => rpc('student_book', { p_name: cred.name, p_pin: cred.pin, p_slot: slot, p_date: date, p_note: note || '' }),
    cancelBooking: (cred, id) => rpc('student_cancel_booking', { p_name: cred.name, p_pin: cred.pin, p_id: id }),

    adminLogin: (pass) => rpc('admin_login', { p_pass: pass }),
    bookingsSeen: () => rpc('admin_bookings_seen', { p_pass: session.adminPass }),
    bookingAction: (id, action) => rpc('admin_booking_action', { p_pass: session.adminPass, p_id: id, p_action: action }),
    overview: () => rpc('admin_overview', { p_pass: session.adminPass }),
    saveStudent: (data) => rpc('admin_save_student', { p_pass: session.adminPass, p_data: data }),
    deleteStudent: (id) => rpc('admin_delete_student', { p_pass: session.adminPass, p_id: id }),
    addToSlot: (slot, student) => rpc('admin_add_to_slot', { p_pass: session.adminPass, p_slot: slot, p_student: student }),
    removeFromSlot: (slot, student) => rpc('admin_remove_from_slot', { p_pass: session.adminPass, p_slot: slot, p_student: student }),
    mark: (student, date, time, status) => rpc('admin_mark', { p_pass: session.adminPass, p_student: student, p_date: date, p_time: time, p_status: status || 'present' }),
    unmark: (id) => rpc('admin_unmark', { p_pass: session.adminPass, p_id: id }),
    saveSlot: (data) => rpc('admin_save_slot', { p_pass: session.adminPass, p_data: data }),
    deleteSlot: (id) => rpc('admin_delete_slot', { p_pass: session.adminPass, p_id: id }),
    setPassword: (np) => rpc('admin_set_password', { p_pass: session.adminPass, p_new: np }),
    exportAll: () => rpc('admin_export', { p_pass: session.adminPass })
  };
})();
