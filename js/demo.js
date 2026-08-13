/* -----------------------------------------------------------------------
   Demo store — implements the exact same RPC contract as supabase/schema.sql,
   backed by localStorage. Used when js/config.js has no Supabase keys, so the
   whole app (and the test suite) runs with no backend.
-------------------------------------------------------------------------*/
(function () {
  const KEY = 'af_demo_db_v2';

  const uid = () => (crypto.randomUUID ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16);
      }));
  const tok = () => uid().replace(/-/g, '') + uid().replace(/-/g, '').slice(0, 16);
  const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const today = () => iso(new Date());
  const nowISO = () => new Date().toISOString();

  function seed() {
    const t = new Date();
    const start = iso(addDays(t, -12));
    const mk = (name, pin, course, total, tags) => ({
      id: uid(), name, pin, phone: '', course, total_classes: total,
      start_date: start, end_date: iso(addDays(t, course === 'advanced' ? 48 : 18)),
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
    [5, 6, 1, 3].forEach(day => ['16:00', '16:50', '17:40', '18:30', '19:20'].forEach(time => {
      slots.push({ id: uid(), day, time, capacity: 3, coach: '', horse: '', active: true });
    }));
    const link = [];
    const put = (time, names) => slots.filter(s => s.time === time).forEach(s =>
      names.forEach(nm => link.push({ slot_id: s.id, student_id: students.find(x => x.name === nm).id })));
    put('16:00', ['Zawad', 'Arifa']);
    put('16:50', ['Rahat']);
    put('17:40', ['Itrat', 'Abaan', 'Zaraan']);

    const attendance = [];
    students.forEach((s, i) => {
      const done = [3, 2, 5, 1, 4, 2][i];
      const tm = ['16:00', '16:00', '16:50', '17:40', '17:40', '17:40'][i];
      for (let k = done; k > 0; k--) {
        attendance.push({ id: uid(), student_id: s.id, date: iso(addDays(t, -k * 2)), time: tm,
          status: 'present', note: '', created_at: nowISO() });
      }
    });

    const payments = [{
      id: uid(), student_id: students[0].id, amount: 4000, due_date: iso(addDays(t, 6)),
      paid_on: null, cycle_start: start, cycle_end: iso(addDays(t, 18)), method: '', note: ''
    }];

    return {
      settings: {
        academy_name: 'Al Fursan Equestrian Academy', timezone: 'Asia/Dhaka',
        contact_phone: '', whatsapp: '', currency: 'BDT', capacity: '3',
        reply_hours: '24', cancel_cutoff_h: '3', directory: 'on',
        telegram_token: '', telegram_chat: ''
      },
      students, slots, link, attendance, payments,
      bookings: [], closures: [], notifications: [],
      admins: [{ id: uid(), username: 'owner', pass: 'alfursan', display: 'Owner', role: 'owner', active: true }],
      sessions: {}, activity: [], errors: [], attempts: {}
    };
  }

  let db = null;
  function load() {
    try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw); } catch (e) {}
    const fresh = seed();
    try { localStorage.setItem(KEY, JSON.stringify(fresh)); } catch (e) {}
    return fresh;
  }
  const DB = () => (db || (db = load()));
  const commit = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} };

  /* ---------------- helpers mirroring the SQL ones ---------------- */
  const setting = (k, d) => { const v = DB().settings[k]; return (v === undefined || v === null) ? (d || '') : v; };
  const log = (actor, action, detail) => {
    DB().activity.unshift({ actor, action, detail: detail || '', at: nowISO() });
    DB().activity = DB().activity.slice(0, 200);
  };
  const notify = (sid, kind, title, body) =>
    DB().notifications.unshift({ id: uid(), student_id: sid, kind, title, body: body || '',
      read: false, created_at: nowISO() });

  const doneCount = id => DB().attendance.filter(a => a.student_id === id && a.status === 'present').length;
  const absentCount = id => DB().attendance.filter(a => a.student_id === id && a.status === 'absent').length;
  const unpaidOf = id => DB().payments.filter(p => p.student_id === id && !p.paid_on)
    .reduce((s, p) => s + Number(p.amount || 0), 0);

  const riders = slotId => DB().link.filter(l => l.slot_id === slotId)
    .map(l => DB().students.find(s => s.id === l.student_id)).filter(Boolean)
    .map(s => ({ id: s.id, name: s.name, course: s.course }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const closed = (slotId, date) => DB().closures.some(c =>
    c.date === date && (!c.slot_id || c.slot_id === slotId));

  const slotTaken = (slotId, date) => riders(slotId).length +
    DB().bookings.filter(b => b.slot_id === slotId && b.date === date && b.status === 'approved').length;
  const slotPending = (slotId, date) =>
    DB().bookings.filter(b => b.slot_id === slotId && b.date === date &&
      ['pending', 'waitlist'].includes(b.status)).length;

  const schedule = (forAdmin) => DB().slots
    .filter(s => forAdmin || s.active !== false)
    .sort((a, b) => a.day - b.day || a.time.localeCompare(b.time))
    .map(s => Object.assign({}, s, { students: riders(s.id) }));

  const studentJson = (s, forAdmin) => {
    const o = {
      id: s.id, name: s.name, phone: s.phone || '', course: s.course,
      total_classes: s.total_classes, start_date: s.start_date, end_date: s.end_date,
      tags: s.tags || [], note: s.note || '', active: s.active !== false,
      done: doneCount(s.id), absent: absentCount(s.id),
      cycle_done: DB().attendance.filter(a => a.student_id === s.id && a.status === 'present'
        && a.date >= s.start_date).length,
      unpaid: unpaidOf(s.id)
    };
    if (forAdmin) o.pin = s.pin;
    return o;
  };

  const publicSettings = () => ({
    academy_name: setting('academy_name', 'Al Fursan Equestrian Academy'),
    timezone: setting('timezone', 'Asia/Dhaka'),
    contact_phone: setting('contact_phone'), whatsapp: setting('whatsapp'),
    currency: setting('currency', 'BDT'), capacity: setting('capacity', '3'),
    reply_hours: setting('reply_hours', '24'), cancel_cutoff_h: setting('cancel_cutoff_h', '3'),
    directory: setting('directory', 'on'), today: today()
  });

  const DENY = { ok: false, error: 'auth' };
  const session = t => DB().sessions[t];
  const adminOf = t => {
    const s = session(t);
    if (!s || s.kind !== 'admin' || s.expires < Date.now()) return null;
    const a = DB().admins.find(x => x.id === s.subject && x.active !== false);
    return a || null;
  };
  const studentOf = t => {
    const s = session(t);
    if (!s || s.kind !== 'student' || s.expires < Date.now()) return null;
    return DB().students.find(x => x.id === s.subject) || null;
  };

  function attempt(key) {
    const a = DB().attempts[key] || { fails: 0, until: 0 };
    if (a.until > Date.now()) return { locked: true, seconds: Math.ceil((a.until - Date.now()) / 1000) };
    return { locked: false };
  }
  function attemptFail(key) {
    const a = DB().attempts[key] || { fails: 0, until: 0 };
    a.fails += 1;
    if (a.fails >= 5) { a.until = Date.now() + 60000; a.fails = 0; }
    DB().attempts[key] = a;
  }
  const attemptClear = key => { delete DB().attempts[key]; };

  function makeSession(kind, subject, days) {
    const t = tok();
    DB().sessions[t] = { kind, subject, expires: Date.now() + Math.max(1, days || 7) * 864e5 };
    return t;
  }

  function promoteWaitlist(slotId, date) {
    const slot = DB().slots.find(s => s.id === slotId);
    if (!slot) return;
    let guard = 0;
    while (slotTaken(slotId, date) < (slot.capacity || 3) && guard++ < 20) {
      const b = DB().bookings
        .filter(x => x.slot_id === slotId && x.date === date && x.status === 'waitlist')
        .sort((a, c) => String(a.created_at).localeCompare(String(c.created_at)))[0];
      if (!b) break;
      b.status = 'pending'; b.seen = false;
      notify(b.student_id, 'waitlist', 'A seat opened up',
        'Your waitlisted class on ' + b.date + ' is now waiting for approval.');
    }
  }

  /* ---------------- handlers ---------------- */
  const H = {
    bootstrap() {
      return {
        ok: true, settings: publicSettings(),
        directory: setting('directory', 'on') === 'on'
          ? DB().students.filter(s => s.active !== false)
              .map(s => ({ id: s.id, name: s.name }))
              .sort((a, b) => a.name.localeCompare(b.name))
          : []
      };
    },

    student_login({ p_id, p_name, p_pin, p_days }) {
      const key = 'stu:' + String(p_id || (p_name || '').trim()).toLowerCase();
      const lock = attempt(key);
      if (lock.locked) return { ok: false, error: 'locked', seconds: lock.seconds };
      const s = DB().students.find(x => x.active !== false && String(x.pin) === String(p_pin) &&
        (p_id ? x.id === p_id : x.name.trim().toLowerCase() === String(p_name || '').trim().toLowerCase()));
      if (!s) { attemptFail(key); commit(); return { ok: false, error: 'login' }; }
      attemptClear(key);
      const t = makeSession('student', s.id, p_days || 30);
      commit();
      return { ok: true, token: t };
    },

    student_session({ p_token }) {
      const s = studentOf(p_token);
      if (!s) return DENY;
      const seats = {};
      const start = new Date();
      for (let i = 0; i <= 34; i++) {
        const d = addDays(start, i), ds = iso(d), dow = d.getDay();
        DB().slots.filter(x => x.active !== false && x.day === dow).forEach(x => {
          seats[x.id + '|' + ds] = { taken: slotTaken(x.id, ds), pending: slotPending(x.id, ds) };
        });
      }
      return {
        ok: true,
        settings: publicSettings(),
        student: studentJson(s),
        attendance: DB().attendance.filter(a => a.student_id === s.id)
          .sort((a, b) => b.date.localeCompare(a.date)),
        bookings: DB().bookings.filter(b => b.student_id === s.id && b.date >= iso(addDays(new Date(), -60)))
          .map(b => {
            const sl = DB().slots.find(x => x.id === b.slot_id) || {};
            return Object.assign({}, b, { time: sl.time, day: sl.day });
          }).sort((a, b) => b.date.localeCompare(a.date)),
        payments: DB().payments.filter(p => p.student_id === s.id),
        notifications: DB().notifications.filter(x => x.student_id === s.id).slice(0, 40),
        closures: DB().closures.filter(c => c.date >= today()),
        seats,
        schedule: schedule(false)
      };
    },

    student_book({ p_token, p_slot, p_date, p_note }) {
      const s = studentOf(p_token);
      if (!s) return DENY;
      if (p_date < today()) return { ok: false, error: 'past' };
      if (closed(p_slot, p_date)) return { ok: false, error: 'closed' };
      const slot = DB().slots.find(x => x.id === p_slot && x.active !== false);
      if (!slot) return { ok: false, error: 'missing' };
      if (new Date(p_date + 'T00:00:00').getDay() !== slot.day) return { ok: false, error: 'day' };
      if (s.end_date && s.end_date < p_date) return { ok: false, error: 'expired' };

      const upcoming = DB().bookings.filter(b => b.student_id === s.id &&
        ['pending', 'approved'].includes(b.status) && b.date >= today()).length;
      if (s.total_classes - doneCount(s.id) - upcoming <= 0) return { ok: false, error: 'nobalance' };

      if (DB().link.some(l => l.slot_id === p_slot && l.student_id === s.id) ||
          DB().bookings.some(b => b.slot_id === p_slot && b.student_id === s.id && b.date === p_date &&
            ['pending', 'approved', 'waitlist'].includes(b.status)))
        return { ok: false, error: 'exists' };

      const status = slotTaken(p_slot, p_date) >= (slot.capacity || 3) ? 'waitlist' : 'pending';
      DB().bookings.push({ id: uid(), student_id: s.id, slot_id: p_slot, date: p_date,
        status, note: p_note || '', reason: '', seen: false, created_at: nowISO(), decided_at: null });
      log(s.name, 'booking.request', p_date);
      commit();
      return { ok: true, status };
    },

    student_cancel({ p_token, p_id, p_reason }) {
      const s = studentOf(p_token);
      if (!s) return DENY;
      const b = DB().bookings.find(x => x.id === p_id && x.student_id === s.id);
      if (!b) return { ok: false, error: 'missing' };
      const cutoff = Number(setting('cancel_cutoff_h', '3')) || 3;
      const slot = DB().slots.find(x => x.id === b.slot_id) || { time: '00:00' };
      const when = new Date(b.date + 'T' + slot.time + ':00');
      if (b.status === 'approved' && when - new Date() < cutoff * 3600e3 && when > new Date())
        return { ok: false, error: 'cutoff', hours: cutoff };
      b.status = 'cancelled'; b.reason = p_reason || ''; b.decided_at = nowISO();
      log(s.name, 'booking.cancel', p_reason || '');
      promoteWaitlist(b.slot_id, b.date);
      commit();
      return { ok: true };
    },

    student_absence({ p_token, p_slot, p_date, p_reason }) {
      const s = studentOf(p_token);
      if (!s) return DENY;
      const slot = DB().slots.find(x => x.id === p_slot) || {};
      const found = DB().attendance.find(a => a.student_id === s.id && a.date === p_date &&
        (a.time || '') === (slot.time || ''));
      const note = 'notified: ' + (p_reason || '');
      if (found) { found.status = 'absent'; found.note = note; }
      else DB().attendance.push({ id: uid(), student_id: s.id, date: p_date, time: slot.time || null,
        status: 'absent', note, created_at: nowISO() });
      DB().bookings.filter(b => b.student_id === s.id && b.slot_id === p_slot && b.date === p_date &&
        ['pending', 'approved', 'waitlist'].includes(b.status))
        .forEach(b => { b.status = 'cancelled'; b.reason = p_reason || ''; });
      log(s.name, 'absence.notice', p_date);
      promoteWaitlist(p_slot, p_date);
      commit();
      return { ok: true };
    },

    student_update({ p_token, p_phone, p_pin }) {
      const s = studentOf(p_token);
      if (!s) return DENY;
      if (p_pin && !/^\d{4}$/.test(p_pin)) return { ok: false, error: 'pin' };
      if (p_phone !== null && p_phone !== undefined) s.phone = p_phone;
      if (p_pin) s.pin = p_pin;
      log(s.name, 'profile.update', '');
      commit();
      return { ok: true };
    },

    student_seen({ p_token }) {
      const s = studentOf(p_token);
      if (!s) return DENY;
      DB().notifications.filter(x => x.student_id === s.id).forEach(x => { x.read = true; });
      commit();
      return { ok: true };
    },

    logout({ p_token }) { delete DB().sessions[p_token]; commit(); return { ok: true }; },

    log_error({ p_kind, p_message, p_context }) {
      DB().errors.unshift({ kind: p_kind || 'client', message: String(p_message).slice(0, 500),
        context: String(p_context || '').slice(0, 1000), at: nowISO() });
      DB().errors = DB().errors.slice(0, 100);
      commit();
      return { ok: true };
    },

    /* ------------------------- admin ------------------------- */
    admin_login({ p_user, p_pass, p_days }) {
      const key = 'adm:' + String(p_user || '').toLowerCase();
      const lock = attempt(key);
      if (lock.locked) return { ok: false, error: 'locked', seconds: lock.seconds };
      const a = DB().admins.find(x => x.active !== false &&
        x.username.toLowerCase() === String(p_user || '').trim().toLowerCase() && x.pass === p_pass);
      if (!a) { attemptFail(key); commit(); return { ok: false, error: 'login' }; }
      attemptClear(key);
      const t = makeSession('admin', a.id, p_days || 7);
      log(a.username, 'admin.login', '');
      commit();
      return { ok: true, token: t,
        admin: { id: a.id, username: a.username, display: a.display, role: a.role } };
    },

    admin_session({ p_token }) {
      const a = adminOf(p_token);
      if (!a) return DENY;
      const d = today();
      const students = DB().students.map(s => studentJson(s, true))
        .sort((x, y) => x.name.localeCompare(y.name));
      return {
        ok: true,
        admin: { id: a.id, username: a.username, display: a.display, role: a.role },
        settings: Object.assign(publicSettings(), {
          telegram_token: setting('telegram_token'), telegram_chat: setting('telegram_chat') }),
        students,
        schedule: schedule(true),
        attendance: DB().attendance.slice().sort((x, y) => y.date.localeCompare(x.date)).slice(0, 800),
        bookings: DB().bookings.filter(b => b.date >= iso(addDays(new Date(), -30))).map(b => {
          const sl = DB().slots.find(x => x.id === b.slot_id) || {};
          const st = DB().students.find(x => x.id === b.student_id) || {};
          return Object.assign({}, b, { time: sl.time, day: sl.day, student: st.name });
        }).sort((x, y) => String(y.created_at).localeCompare(String(x.created_at))),
        payments: DB().payments.slice(),
        closures: DB().closures.filter(c => c.date >= iso(addDays(new Date(), -30))),
        admins: DB().admins.map(u => ({ id: u.id, username: u.username, display: u.display,
          role: u.role, active: u.active !== false })),
        activity: DB().activity.slice(0, 60),
        unseen: DB().bookings.filter(b => !b.seen && ['pending', 'waitlist'].includes(b.status)).length,
        alerts: {
          expiring: students.filter(s => s.active && s.end_date && s.end_date >= d &&
            s.end_date <= iso(addDays(new Date(), 7))).map(s => ({ id: s.id, name: s.name, end_date: s.end_date })),
          exhausted: students.filter(s => s.active && s.done >= s.total_classes)
            .map(s => ({ id: s.id, name: s.name })),
          unpaid: students.filter(s => s.unpaid > 0).map(s => ({ id: s.id, name: s.name, amount: s.unpaid }))
        },
        stats: {
          students: DB().students.filter(s => s.active !== false).length,
          week: DB().attendance.filter(x => x.date >= iso(addDays(new Date(), -7)) && x.status === 'present').length,
          month_income: DB().payments.filter(p => p.paid_on && p.paid_on >= d.slice(0, 8) + '01')
            .reduce((s, p) => s + Number(p.amount || 0), 0)
        }
      };
    },

    admin_student_detail({ p_token, p_id }) {
      const a = adminOf(p_token);
      if (!a) return DENY;
      const s = DB().students.find(x => x.id === p_id);
      if (!s) return { ok: false, error: 'missing' };
      return {
        ok: true,
        student: studentJson(s, true),
        attendance: DB().attendance.filter(x => x.student_id === p_id)
          .sort((x, y) => y.date.localeCompare(x.date)),
        bookings: DB().bookings.filter(b => b.student_id === p_id).map(b => {
          const sl = DB().slots.find(x => x.id === b.slot_id) || {};
          return Object.assign({}, b, { time: sl.time });
        }).sort((x, y) => y.date.localeCompare(x.date)),
        payments: DB().payments.filter(p => p.student_id === p_id),
        slots: DB().link.filter(l => l.student_id === p_id)
          .map(l => DB().slots.find(s2 => s2.id === l.slot_id)).filter(Boolean)
          .map(s2 => ({ id: s2.id, day: s2.day, time: s2.time }))
      };
    },

    admin_save_student({ p_token, p_data }) {
      const a = adminOf(p_token);
      if (!a) return DENY;
      const d = p_data;
      if (DB().students.some(s => s.name.trim().toLowerCase() === String(d.name).trim().toLowerCase()
          && s.id !== d.id)) return { ok: false, error: 'duplicate' };
      let s = DB().students.find(x => x.id === d.id);
      const isNew = !s;
      if (!s) { s = { id: uid() }; DB().students.push(s); }
      Object.assign(s, {
        name: String(d.name).trim(), pin: d.pin, phone: d.phone || '', course: d.course,
        total_classes: +d.total_classes || 8, start_date: d.start_date, end_date: d.end_date || null,
        tags: d.tags || [], note: d.note || '', active: d.active !== false
      });
      log(a.username, isNew ? 'student.create' : 'student.update', s.name);
      commit();
      return { ok: true, id: s.id };
    },

    admin_delete_student({ p_token, p_id, p_confirm }) {
      const a = adminOf(p_token);
      if (!a) return DENY;
      const s = DB().students.find(x => x.id === p_id);
      if (!s) return { ok: false, error: 'missing' };
      if (String(p_confirm || '').trim().toLowerCase() !== s.name.toLowerCase())
        return { ok: false, error: 'confirm' };
      db.students = DB().students.filter(x => x.id !== p_id);
      db.link = DB().link.filter(l => l.student_id !== p_id);
      db.attendance = DB().attendance.filter(x => x.student_id !== p_id);
      db.bookings = DB().bookings.filter(x => x.student_id !== p_id);
      db.payments = DB().payments.filter(x => x.student_id !== p_id);
      db.notifications = DB().notifications.filter(x => x.student_id !== p_id);
      log(a.username, 'student.delete', s.name);
      commit();
      return { ok: true };
    },

    admin_mark({ p_token, p_student, p_date, p_time, p_status }) {
      const a = adminOf(p_token);
      if (!a) return DENY;
      const idx = DB().attendance.findIndex(x => x.student_id === p_student && x.date === p_date &&
        (x.time || '') === (p_time || ''));
      if (!p_status || p_status === 'none') {
        if (idx >= 0) DB().attendance.splice(idx, 1);
        commit();
        return { ok: true, status: 'none' };
      }
      if (idx >= 0) { DB().attendance[idx].status = p_status; commit();
        return { ok: true, id: DB().attendance[idx].id, status: p_status }; }
      const row = { id: uid(), student_id: p_student, date: p_date, time: p_time || null,
        status: p_status, note: '', created_at: nowISO() };
      DB().attendance.push(row);
      commit();
      return { ok: true, id: row.id, status: p_status };
    },

    admin_mark_bulk({ p_token, p_slot, p_date, p_status }) {
      const a = adminOf(p_token);
      if (!a) return DENY;
      const slot = DB().slots.find(x => x.id === p_slot) || {};
      const ids = new Set(riders(p_slot).map(r => r.id));
      DB().bookings.filter(b => b.slot_id === p_slot && b.date === p_date && b.status === 'approved')
        .forEach(b => ids.add(b.student_id));
      ids.forEach(id => H.admin_mark({ p_token, p_student: id, p_date, p_time: slot.time, p_status }));
      log(a.username, 'attendance.bulk', p_status + ' ×' + ids.size);
      commit();
      return { ok: true, count: ids.size };
    },

    admin_booking_action({ p_token, p_ids, p_action, p_reason }) {
      const a = adminOf(p_token);
      if (!a) return DENY;
      let n = 0;
      (p_ids || []).forEach(id => {
        const b = DB().bookings.find(x => x.id === id);
        if (!b) return;
        const st = DB().students.find(x => x.id === b.student_id) || {};
        if (p_action === 'approve') {
          b.status = 'approved'; b.seen = true; b.decided_at = nowISO();
          notify(b.student_id, 'approved', 'Class confirmed', b.date);
        } else if (p_action === 'decline') {
          b.status = 'declined'; b.seen = true; b.reason = p_reason || ''; b.decided_at = nowISO();
          notify(b.student_id, 'declined', 'Booking not confirmed',
            b.date + (p_reason ? ' — ' + p_reason : ''));
          promoteWaitlist(b.slot_id, b.date);
        } else if (p_action === 'undo') {
          b.status = 'pending'; b.decided_at = null; b.reason = '';
        } else if (p_action === 'delete') {
          db.bookings = DB().bookings.filter(x => x.id !== id);
        } else return;
        n++;
        log(a.username, 'booking.' + p_action, st.name || '');
      });
      commit();
      return { ok: true, count: n };
    },

    admin_bookings_seen({ p_token }) {
      const a = adminOf(p_token);
      if (!a) return DENY;
      DB().bookings.forEach(b => { b.seen = true; });
      commit();
      return { ok: true };
    },

    admin_close_day({ p_token, p_date, p_slot, p_reason }) {
      const a = adminOf(p_token);
      if (!a) return DENY;
      if (!DB().closures.some(c => c.date === p_date && (c.slot_id || null) === (p_slot || null)))
        DB().closures.push({ id: uid(), date: p_date, slot_id: p_slot || null,
          reason: p_reason || '', created_at: nowISO() });
      DB().bookings.filter(b => b.date === p_date && (!p_slot || b.slot_id === p_slot) &&
        ['pending', 'approved', 'waitlist'].includes(b.status)).forEach(b => {
          b.status = 'cancelled'; b.reason = 'Class cancelled: ' + (p_reason || '');
          notify(b.student_id, 'closed', 'Class cancelled', p_date + (p_reason ? ' — ' + p_reason : ''));
        });
      log(a.username, 'day.close', p_date + ' ' + (p_reason || ''));
      commit();
      return { ok: true };
    },

    admin_open_day({ p_token, p_id }) {
      const a = adminOf(p_token);
      if (!a) return DENY;
      db.closures = DB().closures.filter(c => c.id !== p_id);
      log(a.username, 'day.open', '');
      commit();
      return { ok: true };
    },

    admin_save_slot({ p_token, p_data }) {
      const a = adminOf(p_token);
      if (!a) return DENY;
      const d = p_data;
      if (DB().slots.some(s => s.day === +d.day && s.time === d.time && s.id !== d.id))
        return { ok: false, error: 'duplicate' };
      let s = DB().slots.find(x => x.id === d.id);
      if (!s) { s = { id: uid() }; DB().slots.push(s); }
      Object.assign(s, { day: +d.day, time: d.time, capacity: +d.capacity || 3,
        coach: d.coach || '', horse: d.horse || '', active: d.active !== false });
      log(a.username, 'slot.save', d.time);
      commit();
      return { ok: true, id: s.id };
    },

    admin_delete_slot({ p_token, p_id }) {
      const a = adminOf(p_token);
      if (!a) return DENY;
      db.slots = DB().slots.filter(s => s.id !== p_id);
      db.link = DB().link.filter(l => l.slot_id !== p_id);
      log(a.username, 'slot.delete', '');
      commit();
      return { ok: true };
    },

    admin_add_to_slot({ p_token, p_slot, p_student }) {
      const a = adminOf(p_token);
      if (!a) return DENY;
      const slot = DB().slots.find(s => s.id === p_slot);
      if (!slot) return { ok: false, error: 'missing' };
      if (DB().link.some(l => l.slot_id === p_slot && l.student_id === p_student))
        return { ok: false, error: 'exists' };
      if (riders(p_slot).length >= (slot.capacity || 3))
        return { ok: false, error: 'full', capacity: slot.capacity || 3 };
      DB().link.push({ slot_id: p_slot, student_id: p_student });
      log(a.username, 'roster.add', '');
      commit();
      return { ok: true };
    },

    admin_remove_from_slot({ p_token, p_slot, p_student }) {
      const a = adminOf(p_token);
      if (!a) return DENY;
      db.link = DB().link.filter(l => !(l.slot_id === p_slot && l.student_id === p_student));
      log(a.username, 'roster.remove', '');
      commit();
      return { ok: true };
    },

    admin_save_payment({ p_token, p_data }) {
      const a = adminOf(p_token);
      if (!a) return DENY;
      const d = p_data;
      let p = DB().payments.find(x => x.id === d.id);
      if (!p) { p = { id: uid(), created_at: nowISO() }; DB().payments.push(p); }
      Object.assign(p, { student_id: d.student_id, amount: Number(d.amount) || 0,
        due_date: d.due_date || null, paid_on: d.paid_on || null,
        cycle_start: d.cycle_start || null, cycle_end: d.cycle_end || null,
        method: d.method || '', note: d.note || '' });
      if (p.paid_on) notify(p.student_id, 'payment', 'Payment received',
        setting('currency', 'BDT') + ' ' + p.amount);
      log(a.username, 'payment.save', String(p.amount));
      commit();
      return { ok: true, id: p.id };
    },

    admin_delete_payment({ p_token, p_id }) {
      const a = adminOf(p_token);
      if (!a) return DENY;
      db.payments = DB().payments.filter(p => p.id !== p_id);
      log(a.username, 'payment.delete', '');
      commit();
      return { ok: true };
    },

    admin_save_settings({ p_token, p_data }) {
      const a = adminOf(p_token);
      if (!a) return DENY;
      const allowed = ['academy_name', 'timezone', 'contact_phone', 'whatsapp', 'currency',
        'capacity', 'reply_hours', 'cancel_cutoff_h', 'directory', 'telegram_token', 'telegram_chat'];
      Object.keys(p_data || {}).forEach(k => {
        if (allowed.includes(k)) DB().settings[k] = String(p_data[k]);
      });
      log(a.username, 'settings.save', '');
      commit();
      return { ok: true, settings: publicSettings() };
    },

    admin_change_password({ p_token, p_current, p_new }) {
      const a = adminOf(p_token);
      if (!a) return DENY;
      if (a.pass !== p_current) return { ok: false, error: 'current' };
      if (!p_new || p_new.length < 6) return { ok: false, error: 'short' };
      a.pass = p_new;
      Object.keys(DB().sessions).forEach(t => {
        const s = DB().sessions[t];
        if (s.kind === 'admin' && s.subject === a.id && t !== p_token) delete DB().sessions[t];
      });
      log(a.username, 'admin.password', '');
      commit();
      return { ok: true };
    },

    admin_save_user({ p_token, p_data }) {
      const a = adminOf(p_token);
      if (!a || a.role !== 'owner') return DENY;
      const d = p_data;
      let u = DB().admins.find(x => x.id === d.id);
      if (!u) {
        if (DB().admins.some(x => x.username.toLowerCase() === String(d.username).toLowerCase()))
          return { ok: false, error: 'duplicate' };
        u = { id: uid(), username: String(d.username).trim().toLowerCase(), pass: d.pass,
          display: d.display || '', role: d.role || 'staff', active: true };
        DB().admins.push(u);
      } else {
        Object.assign(u, { display: d.display !== undefined ? d.display : u.display,
          role: d.role || u.role, active: d.active !== undefined ? d.active : u.active,
          pass: d.pass ? d.pass : u.pass });
      }
      log(a.username, 'admin.user.save', u.username);
      commit();
      return { ok: true, id: u.id };
    },

    admin_delete_user({ p_token, p_id }) {
      const a = adminOf(p_token);
      if (!a || a.role !== 'owner') return DENY;
      if (a.id === p_id) return { ok: false, error: 'self' };
      db.admins = DB().admins.filter(u => u.id !== p_id);
      log(a.username, 'admin.user.delete', '');
      commit();
      return { ok: true };
    },

    admin_notify_test({ p_token }) {
      const a = adminOf(p_token);
      if (!a) return DENY;
      if (!setting('telegram_token') || !setting('telegram_chat')) return { ok: false, error: 'unset' };
      return { ok: true, demo: true };
    },

    admin_export({ p_token }) {
      const a = adminOf(p_token);
      if (!a) return DENY;
      return { ok: true, data: {
        version: 2, exported_at: nowISO(),
        students: DB().students, slots: DB().slots, roster: DB().link,
        attendance: DB().attendance, bookings: DB().bookings, payments: DB().payments,
        closures: DB().closures, settings: DB().settings } };
    },

    admin_import({ p_token, p_data, p_mode }) {
      const a = adminOf(p_token);
      if (!a) return DENY;
      if (!p_data) return { ok: false, error: 'empty' };
      const count = k => Array.isArray(p_data[k]) ? p_data[k].length : 0;
      if (!p_mode || p_mode === 'preview') {
        return { ok: true, preview: true,
          students: count('students'), slots: count('slots'),
          attendance: count('attendance'), payments: count('payments'),
          current: { students: DB().students.length, slots: DB().slots.length,
            attendance: DB().attendance.length, payments: DB().payments.length } };
      }
      if (p_mode === 'replace') {
        db.students = []; db.slots = []; db.link = []; db.attendance = [];
        db.bookings = []; db.payments = []; db.closures = [];
      }
      const upsert = (arr, key, rows) => (rows || []).forEach(r => {
        const i = arr.findIndex(x => x.id === r.id);
        if (i >= 0) arr[i] = Object.assign({}, arr[i], r); else arr.push(r);
      });
      upsert(DB().students, 'id', p_data.students);
      upsert(DB().slots, 'id', p_data.slots);
      (p_data.roster || []).forEach(r => {
        if (!DB().link.some(l => l.slot_id === r.slot_id && l.student_id === r.student_id))
          DB().link.push({ slot_id: r.slot_id, student_id: r.student_id });
      });
      upsert(DB().attendance, 'id', p_data.attendance);
      upsert(DB().payments, 'id', p_data.payments);
      upsert(DB().closures, 'id', p_data.closures);
      log(a.username, 'data.import', p_mode);
      commit();
      return { ok: true, students: count('students'), slots: count('slots'),
        attendance: count('attendance'), payments: count('payments') };
    }
  };

  window.DEMO = {
    reset() { localStorage.removeItem(KEY); db = null; },
    call(fn, args) {
      const h = H[fn];
      if (!h) return Promise.reject(new Error('Unknown function ' + fn));
      return new Promise(res => setTimeout(() => {
        let out;
        try { out = h(args || {}); }
        catch (e) { out = { ok: false, error: 'demo', message: String(e && e.message || e) }; }
        res(out);
      }, 60));
    }
  };
})();
