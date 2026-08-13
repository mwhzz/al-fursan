/* Al Fursan — admin console */
(function () {
  const U = UI;
  let D = null;                    // overview payload
  let tab = 'today';
  let dayPick = null;
  let datePick = null;
  let query = '';
  let filter = 'active';

  const byId = (id) => (D.students || []).find(s => s.id === id);
  const attKey = (sid, date, time) => sid + '|' + date + '|' + (time || '');
  let attIndex = {};
  function reindex() {
    attIndex = {};
    (D.attendance || []).forEach(a => { attIndex[attKey(a.student_id, a.date, a.time)] = a; });
  }

  /** reload({poll:true}) skips the re-render while a modal/input is in use */
  async function reload(_legacy, opts) {
    opts = opts || {};
    try {
      const res = await API.overview();
      if (!res || !res.ok) { U.toast(t('wrongPass'), 'err'); API.session.clear(); location.reload(); return; }
      D = res; reindex(); checkNew();
      const ae = document.activeElement;
      const busy = !document.getElementById('modal').hidden ||
        (ae && ['INPUT', 'TEXTAREA', 'SELECT'].indexOf(ae.tagName) >= 0);
      if (!(opts.poll && busy)) render();
    } catch (e) {
      if (!opts.poll) U.toast(t('netErr'), 'err');
    }
  }

  /* ================= TODAY / ATTENDANCE ================= */
  function todayView() {
    if (!datePick) datePick = U.todayISO();
    const wd = new Date(datePick + 'T00:00:00').getDay();
    const slots = (D.schedule || []).filter(s => s.day === wd);
    const st = D.stats || {};
    const extrasFor = (slotId) => (D.bookings || [])
      .filter(b => b.date === datePick && b.slot_id === slotId && b.status === 'approved')
      .map(b => ({ id: b.student_id, name: b.student, booked: true }));

    const head =
      '<section class="glass hero view" style="padding:18px">' +
        '<div class="spread"><div><div class="upper">' + U.esc(t('todaysClasses')) + '</div>' +
        '<h1 class="display" style="font-size:1.5rem">' + U.esc(U.dateLabel(datePick)) + '</h1>' +
        '<div class="tiny dim">' + U.esc(t(U.DAY_KEYS[wd])) + '</div></div>' +
        '<input type="date" class="input" id="datePick" value="' + U.esc(datePick) + '" style="width:auto;padding:9px 12px"></div>' +
        '<div class="stat-grid" style="margin-top:16px">' +
          '<div class="stat"><b>' + n(st.students || 0) + '</b><span>' + U.esc(t('totalStudents')) + '</span></div>' +
          '<div class="stat"><b>' + n(st.week || 0) + '</b><span>' + U.esc(t('classesThisWeek')) + '</span></div>' +
          '<div class="stat"><b>' + n(slots.reduce((a, s) => a + (s.students || []).length, 0)) + '</b><span>' + U.esc(t('today')) + '</span></div>' +
        '</div></section>';

    if (!slots.length) return head + '<div class="glass card empty view">' + U.ICON.empty +
      '<div>' + U.esc(t('noClassToday')) + '</div></div>';

    const body = slots.map(s => {
      const cap = s.capacity || 3;
      const people = (s.students || []).concat(extrasFor(s.id));
      const riders = people.map(x => {
        const rec = attIndex[attKey(x.id, datePick, s.time)];
        const on = rec && rec.status !== 'absent';
        const stu = byId(x.id) || x;
        return '<div class="item clickable" data-mark="' + U.esc(x.id) + '" data-time="' + U.esc(s.time) + '"' +
          (rec ? ' data-rec="' + U.esc(rec.id) + '"' : '') + '>' +
          '<div class="avatar' + (on ? '' : ' dim') + '">' + U.esc(U.initials(x.name)) + '</div>' +
          '<div class="grow"><div style="font-weight:600">' + U.esc(x.name) + '</div>' +
          '<div class="tiny dim">' + n(stu.done || 0) + '/' + n(stu.total_classes || 0) + ' · ' + U.esc(t(stu.course || 'basic')) +
          (x.booked ? ' · ' + U.esc(t('booking')) : '') + '</div></div>' +
          (on ? '<span class="badge ok">' + U.ICON.check.replace('<svg', '<svg style="width:13px;height:13px;stroke:currentColor;fill:none;stroke-width:2.6"') + ' ' + U.esc(t('present')) + '</span>'
              : '<span class="badge">' + U.esc(t('markPresent')) + '</span>') + '</div>';
      }).join('');
      let seats = '';
      for (let i = 0; i < cap; i++) seats += '<span class="seat' + (i < people.length ? ' on' : '') + '"></span>';
      return '<section class="glass card view" style="padding:14px">' +
        '<div class="spread" style="margin-bottom:10px"><div class="slot-time">' + U.esc(U.time12(s.time)) + '</div>' +
        '<span class="seats">' + seats + '</span></div>' +
        (riders || '<div class="tiny dim" style="padding:6px 2px">' + U.esc(t('empty')) + '</div>') + '</section>';
    }).join('');

    return head + '<div class="stack">' + body + '</div>';
  }

  async function toggleMark(el) {
    const sid = el.dataset.mark, time = el.dataset.time, rec = el.dataset.rec;
    el.style.opacity = '.5';
    try {
      if (rec) { await API.unmark(rec); U.toast(t('unmarked')); }
      else { await API.mark(sid, datePick, time, 'present'); U.toast(t('marked'), 'ok'); }
      await reload(true);
    } catch (e) { U.toast(t('netErr'), 'err'); el.style.opacity = ''; }
  }

  /* ================= STUDENTS ================= */
  function studentsView() {
    const q = query.trim().toLowerCase();
    let list = (D.students || []).filter(s =>
      filter === 'all' ? true : filter === 'active' ? s.active !== false : s.active === false);
    if (q) list = list.filter(s =>
      s.name.toLowerCase().includes(q) ||
      (s.tags || []).join(' ').toLowerCase().includes(q) ||
      (s.phone || '').includes(q));

    const rows = list.map(s => {
      const left = Math.max(0, (s.total_classes || 0) - (s.done || 0));
      const pct = s.total_classes ? Math.min(1, s.done / s.total_classes) : 0;
      return '<div class="item clickable" data-edit="' + U.esc(s.id) + '">' +
        '<div class="avatar' + (s.active === false ? ' dim' : '') + '">' + U.esc(U.initials(s.name)) + '</div>' +
        '<div class="grow" style="display:grid;gap:5px">' +
          '<div class="spread"><span style="font-weight:650">' + U.esc(s.name) + '</span>' + U.courseBadge(s.course) + '</div>' +
          '<div class="progress-line"><i style="width:' + (pct * 100).toFixed(0) + '%"></i></div>' +
          '<div class="tiny dim">' + n(s.done || 0) + '/' + n(s.total_classes || 0) + ' · ' + n(left) + ' ' + U.esc(t('remaining')) +
          ((s.tags || []).length ? ' · ' + U.esc(s.tags.join(', ')) : '') + '</div>' +
        '</div></div>';
    }).join('');

    return '<section class="view stack">' +
      '<div class="row"><input class="input grow" id="q" placeholder="' + U.esc(t('search')) + '" value="' + U.esc(query) + '">' +
      '<button class="btn primary" id="addStudent">+</button></div>' +
      '<div class="segmented">' + [['active', 'activeOnly'], ['all', 'all'], ['off', 'archived']].map(([k, lbl]) =>
        '<button data-filter="' + k + '" class="' + (filter === k ? 'on' : '') + '">' + U.esc(t(lbl)) + '</button>').join('') + '</div>' +
      (rows ? '<div class="list">' + rows + '</div>'
            : '<div class="glass card empty">' + U.ICON.empty + '<div>' + U.esc(t('noStudents')) + '</div></div>') +
      '</section>';
  }

  function studentForm(s) {
    s = s || { course: 'basic', total_classes: 8, start_date: U.todayISO(), tags: [], active: true, pin: '' };
    const isNew = !s.id;
    const f = (label, html) => '<div class="field"><label>' + U.esc(label) + '</label>' + html + '</div>';
    U.modal(
      '<div class="spread" style="margin-bottom:16px"><h2>' + U.esc(isNew ? t('newStudent') : t('editStudent')) + '</h2>' +
      '<button class="btn icon ghost" data-close>✕</button></div>' +
      '<div class="stack">' +
        f(t('name'), '<input class="input" id="f_name" value="' + U.esc(s.name || '') + '" autocomplete="off">') +
        '<div class="grid-2">' +
          f(t('resetPin'), '<input class="input" id="f_pin" inputmode="numeric" maxlength="4" value="' + U.esc(s.pin || '') + '">') +
          f(t('phone'), '<input class="input" id="f_phone" inputmode="tel" value="' + U.esc(s.phone || '') + '">') +
        '</div>' +
        f(t('course'), '<select class="input" id="f_course">' +
          ['basic', 'advanced', 'private'].map(c =>
            '<option value="' + c + '"' + (s.course === c ? ' selected' : '') + '>' + U.esc(t(c)) + ' — ' + U.esc(t(c + 'Sub')) + '</option>').join('') +
          '</select>') +
        '<div class="grid-2">' +
          f(t('totalClasses'), '<input class="input" id="f_total" type="number" min="1" value="' + U.esc(s.total_classes || 8) + '">') +
          f(t('startDate'), '<input class="input" id="f_start" type="date" value="' + U.esc(s.start_date || U.todayISO()) + '">') +
        '</div>' +
        f(t('endDate'), '<input class="input" id="f_end" type="date" value="' + U.esc(s.end_date || '') + '">') +
        f(t('tags') + ' (' + t('tagsHint') + ')', '<input class="input" id="f_tags" value="' + U.esc((s.tags || []).join(', ')) + '">') +
        f(t('note'), '<textarea class="input" id="f_note">' + U.esc(s.note || '') + '</textarea>') +
        '<label class="row" style="gap:10px;cursor:pointer"><input type="checkbox" id="f_active"' + (s.active !== false ? ' checked' : '') + ' style="width:18px;height:18px;accent-color:#cdd4dd">' +
        '<span class="small">' + U.esc(t('active')) + '</span></label>' +
        '<div class="row" style="margin-top:6px">' +
          (isNew ? '' : '<button class="btn danger" id="del">' + U.esc(t('delete')) + '</button>') +
          '<button class="btn ghost grow" data-close>' + U.esc(t('cancel')) + '</button>' +
          '<button class="btn primary grow" id="save">' + U.esc(t('save')) + '</button>' +
        '</div>' +
      '</div>',
      (box) => {
        const courseSel = box.querySelector('#f_course');
        courseSel.addEventListener('change', () => {
          const map = { basic: 8, advanced: 16, private: 12 };
          box.querySelector('#f_total').value = map[courseSel.value] || 8;
          const months = courseSel.value === 'advanced' ? 2 : 1;
          const st = box.querySelector('#f_start').value || U.todayISO();
          const d = new Date(st + 'T00:00:00'); d.setMonth(d.getMonth() + months);
          box.querySelector('#f_end').value = d.toISOString().slice(0, 10);
        });
        box.querySelector('#f_pin').addEventListener('input', e => {
          e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4);
        });
        if (box.querySelector('#del')) box.querySelector('#del').addEventListener('click', () => {
          U.confirmBox(s.name, async () => {
            await API.deleteStudent(s.id); U.toast(t('deleted')); await reload(true);
          });
        });
        box.querySelector('#save').addEventListener('click', async () => {
          const payload = {
            id: s.id,
            name: box.querySelector('#f_name').value.trim(),
            pin: box.querySelector('#f_pin').value.trim(),
            phone: box.querySelector('#f_phone').value.trim(),
            course: courseSel.value,
            total_classes: +box.querySelector('#f_total').value,
            start_date: box.querySelector('#f_start').value || U.todayISO(),
            end_date: box.querySelector('#f_end').value || null,
            tags: box.querySelector('#f_tags').value.split(',').map(x => x.trim()).filter(Boolean),
            note: box.querySelector('#f_note').value.trim(),
            active: box.querySelector('#f_active').checked
          };
          if (!payload.name) return U.toast(t('fillAll'), 'err');
          if (!/^\d{4}$/.test(payload.pin)) return U.toast(t('pin4'), 'err');
          const res = await API.saveStudent(payload);
          if (!res.ok) return U.toast(res.error === 'duplicate' ? payload.name + ' — ' + t('alreadyIn') : t('netErr'), 'err');
          U.closeModal(); U.toast(t('saved'), 'ok'); await reload(true);
        });
      });
  }

  /* ================= SCHEDULE ================= */
  function scheduleView() {
    const days = [...new Set((D.schedule || []).map(s => s.day))]
      .sort((a, b) => AF_CONFIG.mainDays.indexOf(a) - AF_CONFIG.mainDays.indexOf(b));
    if (dayPick == null || !days.includes(dayPick)) dayPick = days.includes(new Date().getDay()) ? new Date().getDay() : days[0];

    const chips = days.map(d => '<button class="chip' + (d === dayPick ? ' on' : '') + '" data-day="' + d + '">' +
      U.esc(t(U.DAY_KEYS[d])) + '</button>').join('') +
      '<button class="chip" data-newslot="1">+ ' + U.esc(t('addSlot')) + '</button>';

    const slots = (D.schedule || []).filter(s => s.day === dayPick).map(s => {
      const cap = s.capacity || 3;
      const list = s.students || [];
      let seats = '';
      for (let i = 0; i < cap; i++) seats += '<span class="seat' + (i < list.length ? ' on' : '') + '"></span>';
      return '<div class="glass card" style="padding:14px">' +
        '<div class="spread"><div class="row" style="gap:10px">' +
          '<div class="slot-time">' + U.esc(U.time12(s.time)) + '</div>' +
          '<button class="btn sm ghost" data-editslot="' + U.esc(s.id) + '">⋯</button></div>' +
          '<div class="row" style="gap:8px"><span class="tiny dim">' + n(list.length) + '/' + n(cap) + '</span>' +
          '<span class="seats">' + seats + '</span></div></div>' +
        '<div class="riders">' +
          list.map(x => '<span class="rider"><span class="dot">' + U.esc(U.initials(x.name)) + '</span>' + U.esc(x.name) +
            '<button data-rm="' + U.esc(x.id) + '" data-slot="' + U.esc(s.id) + '" title="remove">×</button></span>').join('') +
          (list.length < cap ? '<button class="rider empty" data-add="' + U.esc(s.id) + '">+ ' + U.esc(t('addToSlot')) + '</button>'
                             : '<span class="rider empty">' + U.esc(t('full')) + '</span>') +
        '</div></div>';
    }).join('');

    return '<section class="view stack"><div class="chips">' + chips + '</div>' +
      '<div class="stack" style="gap:10px">' + (slots || '<div class="glass card empty">' + U.ICON.empty + '</div>') + '</div></section>';
  }

  function pickStudent(slotId) {
    const slot = (D.schedule || []).find(s => s.id === slotId);
    const taken = new Set((slot.students || []).map(x => x.id));
    const list = (D.students || []).filter(s => s.active !== false && !taken.has(s.id));
    U.modal(
      '<div class="spread" style="margin-bottom:14px"><h2>' + U.esc(t('pick')) + '</h2>' +
      '<button class="btn icon ghost" data-close>✕</button></div>' +
      '<input class="input" id="pq" placeholder="' + U.esc(t('search')) + '" style="margin-bottom:12px">' +
      '<div class="list" id="plist">' + list.map(s =>
        '<div class="item clickable" data-pick="' + U.esc(s.id) + '" data-name="' + U.esc(s.name.toLowerCase()) + '">' +
        '<div class="avatar">' + U.esc(U.initials(s.name)) + '</div>' +
        '<div class="grow"><div style="font-weight:600">' + U.esc(s.name) + '</div>' +
        '<div class="tiny dim">' + n(s.done || 0) + '/' + n(s.total_classes || 0) + '</div></div>' +
        U.courseBadge(s.course) + '</div>').join('') + '</div>',
      (box) => {
        box.querySelector('#pq').addEventListener('input', e => {
          const q = e.target.value.toLowerCase();
          box.querySelectorAll('[data-pick]').forEach(el =>
            el.classList.toggle('hide', !el.dataset.name.includes(q)));
        });
        box.querySelectorAll('[data-pick]').forEach(el => el.addEventListener('click', async () => {
          const res = await API.addToSlot(slotId, el.dataset.pick);
          if (!res.ok) return U.toast(res.error === 'full' ? t('slotFull', { n: n(res.capacity || 3) }) : t('alreadyIn'), 'err');
          U.closeModal(); await reload(true);
        }));
      });
  }

  function slotForm(slot) {
    const isNew = !slot;
    const s = slot || { day: dayPick != null ? dayPick : AF_CONFIG.mainDays[0], time: '16:00', capacity: AF_CONFIG.slotCapacity, active: true };
    U.modal(
      '<div class="spread" style="margin-bottom:16px"><h2>' + U.esc(isNew ? t('addSlot') : t('slotTimes')) + '</h2>' +
      '<button class="btn icon ghost" data-close>✕</button></div>' +
      '<div class="stack">' +
        '<div class="field"><label>' + U.esc(t('day')) + '</label><select class="input" id="s_day">' +
          U.DAY_KEYS.map((k, i) => '<option value="' + i + '"' + (i === s.day ? ' selected' : '') + '>' + U.esc(t(k)) + '</option>').join('') +
        '</select></div>' +
        '<div class="grid-2">' +
          '<div class="field"><label>' + U.esc(t('time')) + '</label><input class="input" id="s_time" type="time" value="' + U.esc(s.time) + '"></div>' +
          '<div class="field"><label>' + U.esc(t('capacity')) + '</label><input class="input" id="s_cap" type="number" min="1" max="10" value="' + U.esc(s.capacity || 3) + '"></div>' +
        '</div>' +
        '<div class="row" style="margin-top:4px">' +
          (isNew ? '' : '<button class="btn danger" id="sdel">' + U.esc(t('delete')) + '</button>') +
          '<button class="btn ghost grow" data-close>' + U.esc(t('cancel')) + '</button>' +
          '<button class="btn primary grow" id="ssave">' + U.esc(t('save')) + '</button>' +
        '</div></div>',
      (box) => {
        if (box.querySelector('#sdel')) box.querySelector('#sdel').addEventListener('click', () =>
          U.confirmBox(U.time12(s.time), async () => { await API.deleteSlot(s.id); U.toast(t('deleted')); await reload(true); }));
        box.querySelector('#ssave').addEventListener('click', async () => {
          const res = await API.saveSlot({
            id: s.id, day: +box.querySelector('#s_day').value,
            time: box.querySelector('#s_time').value,
            capacity: +box.querySelector('#s_cap').value || 3, active: true
          });
          if (!res.ok) return U.toast(t('netErr'), 'err');
          dayPick = +box.querySelector('#s_day').value;
          U.closeModal(); U.toast(t('saved'), 'ok'); await reload(true);
        });
      });
  }

  /* ================= BOOKING REQUESTS ================= */
  function requestsView() {
    const all = D.bookings || [];
    const pending = all.filter(b => b.status === 'pending');
    const rest = all.filter(b => b.status !== 'pending').slice(0, 40);

    const card = (b, withActions) =>
      '<div class="item"><div class="avatar' + (b.status === 'pending' ? '' : ' dim') + '">' +
        U.esc(U.initials(b.student)) + '</div>' +
      '<div class="grow"><div style="font-weight:650">' + U.esc(b.student) + '</div>' +
      '<div class="tiny dim">' + U.esc(U.dateLabel(b.date)) + ' · ' + U.esc(U.time12(b.time)) +
        ' · ' + U.esc(t(U.DAY_KEYS[b.day])) + '</div></div>' +
      (withActions
        ? '<div class="row" style="gap:6px">' +
            '<button class="btn sm ghost" data-bk="' + U.esc(b.id) + '" data-act="decline">✕</button>' +
            '<button class="btn sm primary" data-bk="' + U.esc(b.id) + '" data-act="approve">✓</button></div>'
        : '<span class="badge ' + (b.status === 'approved' ? 'ok' : 'warn') + '">' + U.esc(t(b.status)) + '</span>') +
      '</div>';

    const perm = (typeof Notification !== 'undefined') ? Notification.permission : 'unsupported';
    const notifyRow = perm === 'granted'
      ? '<div class="banner" style="border-color:rgba(78,201,138,.3);background:rgba(78,201,138,.08);color:#bfeed6">' +
        U.esc(t('notifyReady')) + '</div>'
      : perm === 'denied'
        ? '<div class="banner">' + U.esc(t('notifyBlocked')) + '</div>'
        : '<button class="btn ghost block" id="askNotify">🔔 ' + U.esc(t('notifyOn')) + '</button>';

    return '<section class="view stack">' + notifyRow +
      (pending.length
        ? '<div class="upper">' + U.esc(t('requests')) + ' · ' + n(pending.length) + '</div>' +
          '<div class="list">' + pending.map(b => card(b, true)).join('') + '</div>'
        : '<div class="glass card empty">' + U.ICON.empty + '<div>' + U.esc(t('noRequests')) + '</div></div>') +
      (rest.length ? '<div class="upper" style="margin-top:6px">' + U.esc(t('history')) + '</div>' +
        '<div class="list">' + rest.map(b => card(b, false)).join('') + '</div>' : '') +
      '</section>';
  }

  /* ---- browser notifications for new bookings ---- */
  let known = null;      // Set of booking ids already seen by this device
  let poller = null;

  function notify(title, body) {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const opts = { body, icon: 'assets/icon.svg', badge: 'assets/icon.svg', tag: 'af-booking', renotify: true };
    if (navigator.serviceWorker && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready.then(r => r.showNotification(title, opts)).catch(() => new Notification(title, opts));
    } else {
      new Notification(title, opts);
    }
  }

  function checkNew() {
    const pend = (D.bookings || []).filter(b => b.status === 'pending');
    if (known === null) { known = new Set(pend.map(b => b.id)); return; }
    const fresh = pend.filter(b => !known.has(b.id));
    fresh.forEach(b => {
      notify(t('newRequest'), b.student + ' — ' + U.dateLabel(b.date) + ' · ' + U.time12(b.time));
      U.toast('🔔 ' + t('newRequest') + ': ' + b.student, 'ok');
    });
    known = new Set(pend.map(b => b.id));
  }

  function startPolling() {
    if (poller) clearInterval(poller);
    poller = setInterval(() => { if (!document.hidden) reload(true, { poll: true }); }, 45000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) reload(true, { poll: true }); });
  }

  async function askNotify() {
    if (typeof Notification === 'undefined') return U.toast(t('notifyBlocked'), 'err');
    const p = await Notification.requestPermission();
    if (p === 'granted') { U.toast(t('notifyReady'), 'ok'); notify(t('notifyReady'), 'Al Fursan'); }
    else U.toast(t('notifyBlocked'), 'err');
    render();
  }

  /* ================= SETTINGS ================= */
  function settingsView() {
    return '<section class="view stack">' +
      '<div class="glass card"><div class="upper" style="margin-bottom:10px">' + U.esc(t('changePass')) + '</div>' +
        '<div class="row"><input class="input grow" id="np" type="password" placeholder="' + U.esc(t('newPass')) + '">' +
        '<button class="btn primary" id="savePass">' + U.esc(t('save')) + '</button></div></div>' +

      '<div class="glass card"><div class="upper" style="margin-bottom:10px">' + U.esc(t('language')) + '</div>' +
        '<div class="segmented"><button class="' + (I18N.lang === 'en' ? 'on' : '') + '" data-lang="en">English</button>' +
        '<button class="' + (I18N.lang === 'bn' ? 'on' : '') + '" data-lang="bn">বাংলা</button></div></div>' +

      '<div class="glass card stack">' +
        (typeof Notification !== 'undefined' && Notification.permission !== 'granted'
          ? '<button class="btn ghost block" id="askNotify">🔔 ' + U.esc(t('notifyOn')) + '</button>' : '') +
        '<button class="btn ghost block" id="exp">' + U.esc(t('exportData')) + '</button>' +
        '<button class="btn ghost block" id="installBtn">' + U.esc(t('installApp')) + '</button>' +
        '<button class="btn ghost block" id="alogout">' + U.esc(t('logout')) + '</button>' +
      '</div>' +
      (API.LIVE ? '' : '<div class="banner">' + U.esc(t('demoBanner')) + '</div>') +
      '<div class="center tiny dim" style="padding:8px">Al Fursan Equestrian Academy · v1.0</div></section>';
  }

  /* ================= SHELL ================= */
  function nav() {
    const pending = (D.bookings || []).filter(b => b.status === 'pending').length;
    const items = [['today', 'check'], ['requests', 'clock'], ['students', 'users'], ['schedule', 'calendar'], ['settings', 'gear']];
    return '<nav class="nav">' + items.map(([k, ic]) =>
      '<button data-tab="' + k + '" class="' + (tab === k ? 'on' : '') + '" style="position:relative">' + U.ICON[ic] +
      (k === 'requests' && pending
        ? '<span style="position:absolute;top:4px;right:8px;min-width:16px;height:16px;border-radius:9px;' +
          'background:linear-gradient(180deg,#f0d9a2,#d9b872);color:#1a1305;font-size:.6rem;font-weight:800;' +
          'display:grid;place-items:center;padding:0 4px">' + n(pending) + '</span>' : '') +
      '<span>' + U.esc(t(k)) + '</span></button>').join('') + '</nav>';
  }

  function render() {
    const body = tab === 'today' ? todayView()
      : tab === 'requests' ? requestsView()
      : tab === 'students' ? studentsView()
      : tab === 'schedule' ? scheduleView() : settingsView();

    const unseen = D.unseen || 0;
    const bell = '<button class="btn icon ghost" id="bell" style="position:relative">🔔' +
      (unseen ? '<span style="position:absolute;top:-2px;right:-2px;min-width:17px;height:17px;border-radius:9px;' +
        'background:linear-gradient(180deg,#f0d9a2,#d9b872);color:#1a1305;font-size:.62rem;font-weight:800;' +
        'display:grid;place-items:center;padding:0 4px">' + n(unseen) + '</span>' : '') + '</button>';

    U.app().innerHTML =
      U.topbar('<div class="row">' + bell +
        '<span class="badge" style="color:var(--gold);border-color:rgba(217,184,114,.35)">ADMIN</span>' +
        U.langBtn() + '</div>') + body + nav();
    U.animateRings();
    bind();
  }

  function bind() {
    const $ = (s) => document.querySelector(s);
    const $$ = (s) => document.querySelectorAll(s);

    $$('[data-tab]').forEach(b => b.addEventListener('click', () => { tab = b.dataset.tab; render(); }));
    $$('[data-day]').forEach(b => b.addEventListener('click', () => { dayPick = +b.dataset.day; render(); }));
    $$('[data-mark]').forEach(b => b.addEventListener('click', () => toggleMark(b)));
    $$('[data-edit]').forEach(b => b.addEventListener('click', () => studentForm(byId(b.dataset.edit))));
    $$('[data-add]').forEach(b => b.addEventListener('click', () => pickStudent(b.dataset.add)));
    $$('[data-newslot]').forEach(b => b.addEventListener('click', () => slotForm(null)));
    $$('[data-editslot]').forEach(b => b.addEventListener('click', () =>
      slotForm((D.schedule || []).find(s => s.id === b.dataset.editslot))));
    $$('[data-rm]').forEach(b => b.addEventListener('click', async () => {
      await API.removeFromSlot(b.dataset.slot, b.dataset.rm); await reload(true);
    }));
    $$('[data-filter]').forEach(b => b.addEventListener('click', () => { filter = b.dataset.filter; render(); }));
    $$('[data-lang]').forEach(b => b.addEventListener('click', () => { I18N.set(b.dataset.lang); render(); }));

    $$('[data-bk]').forEach(b => b.addEventListener('click', async () => {
      const res = await API.bookingAction(b.dataset.bk, b.dataset.act);
      if (!res.ok) return U.toast(t('netErr'), 'err');
      U.toast(t(b.dataset.act === 'approve' ? 'approved' : 'declined'), 'ok');
      await reload(true);
    }));
    const an = $('#askNotify'); if (an) an.addEventListener('click', askNotify);
    const bell = $('#bell');
    if (bell) bell.addEventListener('click', async () => {
      tab = 'requests'; render();
      if (D.unseen) { await API.bookingsSeen(); D.unseen = 0; await reload(true); }
    });

    const lb = $('#langBtn'); if (lb) lb.addEventListener('click', () => { I18N.toggle(); render(); });
    const add = $('#addStudent'); if (add) add.addEventListener('click', () => studentForm(null));

    const q = $('#q');
    if (q) {
      q.addEventListener('input', e => {
        query = e.target.value;
        const pos = e.target.selectionStart;
        render();
        const nq = document.getElementById('q');
        if (nq) { nq.focus(); nq.setSelectionRange(pos, pos); }
      });
    }
    const dp = $('#datePick');
    if (dp) dp.addEventListener('change', e => { datePick = e.target.value; render(); });

    const sp = $('#savePass');
    if (sp) sp.addEventListener('click', async () => {
      const v = $('#np').value.trim();
      if (v.length < 4) return U.toast(t('pin4'), 'err');
      const res = await API.setPassword(v);
      if (!res.ok) return U.toast(t('netErr'), 'err');
      API.session.setAdmin(v, !!localStorage.getItem('af_admin'));
      $('#np').value = ''; U.toast(t('saved'), 'ok');
    });

    const exp = $('#exp');
    if (exp) exp.addEventListener('click', async () => {
      const res = await API.exportAll();
      if (!res.ok) return U.toast(t('netErr'), 'err');
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'al-fursan-' + U.todayISO() + '.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    });

    const ib = $('#installBtn');
    if (ib) ib.addEventListener('click', () => window.AF_INSTALL && window.AF_INSTALL());
    const al = $('#alogout');
    if (al) al.addEventListener('click', () => { API.session.clear(); location.reload(); });
  }

  window.ADMIN = {
    async start(payload) {
      D = payload; reindex();
      tab = 'today'; datePick = U.todayISO();
      known = new Set((D.bookings || []).filter(b => b.status === 'pending').map(b => b.id));
      render();
      startPolling();
    }
  };
})();
