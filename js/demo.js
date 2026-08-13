/* -----------------------------------------------------------------------
   Demo store — runs the exact same RPC contract as Supabase, but backed by
   localStorage. Used automatically when js/config.js has no Supabase keys,
   so the app is fully usable (and demo-able on Vercel) before any setup.
-------------------------------------------------------------------------*/
(function () {
  const KEY = 'af_demo_db_v1';
  const uid = () => (crypto.randomUUID ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16);
      }));
  const iso = d => new Date(d).toISOString().slice(0, 10);
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

  function seed() {
    const C = window.AF_CONFIG;
    const today = new Date();
    const start = iso(addDays(today, -12));
    const mk = (name, pin, course, total, tags) => ({
      id: uid(), name, pin, phone: '', course, total_classes: total,
      start_date: start, end_date: iso(addDays(today, course === 'advanced' ? 48 : 18)),
      tags: tags || [], note: '', active: true
    });
    const students = [
      mk('Zawad', '1111', 'basic', 8, ['junior']),
      mk('Arifa', '2222', 'basic', 8, ['junior']),
      mk('Rahat', '3333', 'advanced', 16, ['jumping']),
      mk('Itrat', '4444', 'basic', 8, []),
      mk('Abaan', '5555', 'advanced', 16, ['jumping']),
      mk('Zaraan', '6666', 'private', 12, ['private'])
    ];
    const slots = [];
    C.mainDays.forEach(day => C.mainTimes.forEach(time => {
      slots.push({ id: uid(), day, time, capacity: C.slotCapacity, active: true });
    }));
    const at = (t) => slots.filter(s => s.time === t).map(s => s.id);
    const link = [];
    const put = (time, names) => at(time).forEach(sid =>
      names.forEach(nm => link.push({ slot_id: sid, student_id: students.find(s => s.name === nm).id })));
    put('16:00', ['Zawad', 'Arifa']);
    put('16:50', ['Rahat']);
    put('17:40', ['Itrat', 'Abaan', 'Zaraan']);

    // a little attendance history
    const attendance = [];
    students.forEach((s, i) => {
      const done = [3, 2, 5, 1, 4, 2][i];
      for (let k = done; k > 0; k--) {
        attendance.push({
          id: uid(), student_id: s.id, date: iso(addDays(today, -k * 2)),
          time: ['16:00', '16:00', '16:50', '17:40', '17:40', '17:40'][i],
          status: 'present', note: ''
        });
      }
    });
    return { students, slots, link, attendance, bookings: [], settings: { admin_password: 'alfursan' } };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* fall through */ }
    const db = seed();
    save(db);
    return db;
  }
  function save(db) { localStorage.setItem(KEY, JSON.stringify(db)); }

  let db = null;
  const DB = () => (db || (db = load()));
  const commit = () => save(db);

  const doneCount = (id) => DB().attendance.filter(a => a.student_id === id && a.status !== 'absent').length;
  const riders = (slotId) => DB().link.filter(l => l.slot_id === slotId)
    .map(l => DB().students.find(s => s.id === l.student_id))
    .filter(Boolean).map(s => ({ id: s.id, name: s.name, course: s.course }));

  const slotsFull = () => DB().slots
    .filter(s => s.active !== false)
    .sort((a, b) => a.day - b.day || a.time.localeCompare(b.time))
    .map(s => Object.assign({}, s, { students: riders(s.id) }));

  /** withPin = admin view only; students never receive other people's PINs */
  const pub = (s, withPin) => {
    const o = {
      id: s.id, name: s.name, phone: s.phone, course: s.course, total_classes: s.total_classes,
      start_date: s.start_date, end_date: s.end_date, tags: s.tags || [], note: s.note,
      active: s.active !== false, done: doneCount(s.id)
    };
    if (withPin) o.pin = s.pin;
    return o;
  };

  const okPass = (p) => String(p || '') === String(DB().settings.admin_password);
  const DENY = { ok: false, error: 'auth' };

  const bookingsOf = (sid) => (DB().bookings || [])
    .filter(b => b.student_id === sid && ['pending', 'approved'].includes(b.status))
    .map(b => {
      const s = DB().slots.find(x => x.id === b.slot_id) || {};
      return Object.assign({}, b, { time: s.time, day: s.day });
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  const slotUsed = (slotId, date) => riders(slotId).length +
    (DB().bookings || []).filter(b => b.slot_id === slotId && b.date === date &&
      ['pending', 'approved'].includes(b.status)).length;

  const findStudent = (name, pin) => DB().students.find(x =>
    x.name.trim().toLowerCase() === String(name || '').trim().toLowerCase() && String(x.pin) === String(pin));

  const H = {
    student_login({ p_name, p_pin }) {
      const s = findStudent(p_name, p_pin);
      if (!s) return { ok: false, error: 'login' };
      return {
        ok: true,
        student: pub(s),
        attendance: DB().attendance.filter(a => a.student_id === s.id)
          .sort((a, b) => b.date.localeCompare(a.date)),
        bookings: bookingsOf(s.id),
        schedule: slotsFull()
      };
    },

    student_book({ p_name, p_pin, p_slot, p_date, p_note }) {
      const s = findStudent(p_name, p_pin);
      if (!s) return { ok: false, error: 'login' };
      if (p_date < iso(new Date())) return { ok: false, error: 'past' };
      const slot = DB().slots.find(x => x.id === p_slot && x.active !== false);
      if (!slot) return { ok: false, error: 'missing' };
      if (new Date(p_date + 'T00:00:00').getDay() !== slot.day) return { ok: false, error: 'day' };
      if (DB().link.some(l => l.slot_id === p_slot && l.student_id === s.id) ||
          (DB().bookings || []).some(b => b.slot_id === p_slot && b.student_id === s.id &&
            b.date === p_date && ['pending', 'approved'].includes(b.status)))
        return { ok: false, error: 'exists' };
      if (slotUsed(p_slot, p_date) >= (slot.capacity || 3))
        return { ok: false, error: 'full', capacity: slot.capacity || 3 };
      DB().bookings.push({
        id: uid(), student_id: s.id, slot_id: p_slot, date: p_date,
        status: 'pending', note: p_note || '', seen: false, created_at: new Date().toISOString()
      });
      commit();
      return { ok: true };
    },

    student_cancel_booking({ p_name, p_pin, p_id }) {
      const s = findStudent(p_name, p_pin);
      if (!s) return { ok: false, error: 'login' };
      const b = (DB().bookings || []).find(x => x.id === p_id && x.student_id === s.id);
      if (b) { b.status = 'cancelled'; commit(); }
      return { ok: true };
    },

    admin_login({ p_pass }) { return okPass(p_pass) ? { ok: true } : { ok: false, error: 'auth' }; },

    admin_overview({ p_pass }) {
      if (!okPass(p_pass)) return DENY;
      const week = iso(addDays(new Date(), -7));
      return {
        ok: true,
        students: DB().students.map(s => pub(s, true)).sort((a, b) => a.name.localeCompare(b.name)),
        schedule: slotsFull(),
        attendance: DB().attendance.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 400),
        bookings: (DB().bookings || []).map(b => {
          const s = DB().slots.find(x => x.id === b.slot_id) || {};
          const st = DB().students.find(x => x.id === b.student_id) || {};
          return Object.assign({}, b, { time: s.time, day: s.day, student: st.name });
        }).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))),
        unseen: (DB().bookings || []).filter(b => !b.seen && b.status === 'pending').length,
        stats: {
          students: DB().students.filter(s => s.active !== false).length,
          week: DB().attendance.filter(a => a.date >= week && a.status !== 'absent').length,
          slots: DB().slots.filter(s => s.active !== false).length
        }
      };
    },

    admin_save_student({ p_pass, p_data }) {
      if (!okPass(p_pass)) return DENY;
      const d = p_data;
      const clash = DB().students.find(s =>
        s.name.trim().toLowerCase() === String(d.name).trim().toLowerCase() && s.id !== d.id);
      if (clash) return { ok: false, error: 'duplicate' };
      let s = DB().students.find(x => x.id === d.id);
      if (!s) { s = { id: uid() }; DB().students.push(s); }
      Object.assign(s, {
        name: d.name, pin: d.pin, phone: d.phone || '', course: d.course,
        total_classes: +d.total_classes || 8, start_date: d.start_date,
        end_date: d.end_date || null, tags: d.tags || [], note: d.note || '',
        active: d.active !== false
      });
      commit();
      return { ok: true, id: s.id };
    },

    admin_delete_student({ p_pass, p_id }) {
      if (!okPass(p_pass)) return DENY;
      db.students = DB().students.filter(s => s.id !== p_id);
      db.link = DB().link.filter(l => l.student_id !== p_id);
      db.attendance = DB().attendance.filter(a => a.student_id !== p_id);
      commit();
      return { ok: true };
    },

    admin_add_to_slot({ p_pass, p_slot, p_student }) {
      if (!okPass(p_pass)) return DENY;
      const slot = DB().slots.find(s => s.id === p_slot);
      if (!slot) return { ok: false, error: 'missing' };
      if (DB().link.some(l => l.slot_id === p_slot && l.student_id === p_student))
        return { ok: false, error: 'exists' };
      if (riders(p_slot).length >= (slot.capacity || 3))
        return { ok: false, error: 'full', capacity: slot.capacity || 3 };
      DB().link.push({ slot_id: p_slot, student_id: p_student });
      commit();
      return { ok: true };
    },

    admin_remove_from_slot({ p_pass, p_slot, p_student }) {
      if (!okPass(p_pass)) return DENY;
      db.link = DB().link.filter(l => !(l.slot_id === p_slot && l.student_id === p_student));
      commit();
      return { ok: true };
    },

    admin_mark({ p_pass, p_student, p_date, p_time, p_status }) {
      if (!okPass(p_pass)) return DENY;
      const found = DB().attendance.find(a =>
        a.student_id === p_student && a.date === p_date && (a.time || '') === (p_time || ''));
      if (found) { found.status = p_status || 'present'; commit(); return { ok: true, id: found.id }; }
      const row = { id: uid(), student_id: p_student, date: p_date, time: p_time || null, status: p_status || 'present', note: '' };
      DB().attendance.push(row);
      commit();
      return { ok: true, id: row.id };
    },

    admin_unmark({ p_pass, p_id }) {
      if (!okPass(p_pass)) return DENY;
      db.attendance = DB().attendance.filter(a => a.id !== p_id);
      commit();
      return { ok: true };
    },

    admin_save_slot({ p_pass, p_data }) {
      if (!okPass(p_pass)) return DENY;
      const d = p_data;
      if (DB().slots.some(s => s.day === +d.day && s.time === d.time && s.id !== d.id))
        return { ok: false, error: 'duplicate' };
      let s = DB().slots.find(x => x.id === d.id);
      if (!s) { s = { id: uid() }; DB().slots.push(s); }
      Object.assign(s, { day: +d.day, time: d.time, capacity: +d.capacity || 3, active: d.active !== false });
      commit();
      return { ok: true, id: s.id };
    },

    admin_delete_slot({ p_pass, p_id }) {
      if (!okPass(p_pass)) return DENY;
      db.slots = DB().slots.filter(s => s.id !== p_id);
      db.link = DB().link.filter(l => l.slot_id !== p_id);
      commit();
      return { ok: true };
    },

    admin_set_password({ p_pass, p_new }) {
      if (!okPass(p_pass)) return DENY;
      if (!p_new || String(p_new).length < 4) return { ok: false, error: 'short' };
      DB().settings.admin_password = String(p_new);
      commit();
      return { ok: true };
    },

    admin_bookings_seen({ p_pass }) {
      if (!okPass(p_pass)) return DENY;
      (DB().bookings || []).forEach(b => { b.seen = true; });
      commit();
      return { ok: true };
    },

    admin_booking_action({ p_pass, p_id, p_action }) {
      if (!okPass(p_pass)) return DENY;
      const b = (DB().bookings || []).find(x => x.id === p_id);
      if (!b) return { ok: false, error: 'missing' };
      if (p_action === 'delete') db.bookings = DB().bookings.filter(x => x.id !== p_id);
      else if (p_action === 'approve') { b.status = 'approved'; b.seen = true; }
      else if (p_action === 'decline') { b.status = 'declined'; b.seen = true; }
      else return { ok: false, error: 'action' };
      commit();
      return { ok: true };
    },

    admin_export({ p_pass }) {
      if (!okPass(p_pass)) return DENY;
      return { ok: true, data: DB() };
    }
  };

  window.DEMO = {
    reset() { localStorage.removeItem(KEY); db = null; },
    call(fn, args) {
      const h = H[fn];
      if (!h) return Promise.reject(new Error('Unknown function ' + fn));
      // small delay so the UI's loading states behave like the real thing
      return new Promise(res => setTimeout(() => res(h(args || {})), 140));
    }
  };
})();
