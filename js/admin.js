/* Al Fursan — academy console */
(function () {
  const U = UI;
  let D = null;                    // admin_session payload
  let tab = 'today';
  let datePick = null;
  let dayPick = null;
  let query = '';
  let filter = 'active';
  let picked = {};                 // selected booking ids
  let lastTouch = 0;
  let poller = null;
  let staleBanner = false;
  let knownPending = null;

  const S = () => (D && D.settings) || {};
  const cur = () => S().currency || 'BDT';
  const touch = () => { lastTouch = Date.now(); };
  const byId = id => (D.students || []).find(s => s.id === id);
  const slotById = id => (D.schedule || []).find(s => s.id === id);

  const attKey = (sid, date, time) => sid + '|' + date + '|' + (time || '');
  let attIndex = {};
  function reindex() {
    attIndex = {};
    (D.attendance || []).forEach(a => { attIndex[attKey(a.student_id, a.date, a.time)] = a; });
  }
  const attOf = (sid, date, time) => attIndex[attKey(sid, date, time)];

  const closureOf = (date, slotId) => (D.closures || []).find(c =>
    c.date === date && (!c.slot_id || c.slot_id === slotId));

  const pendingList = () => (D.bookings || []).filter(b => ['pending', 'waitlist'].includes(b.status));

  const balanceOf = s => Math.max(0, (s.total_classes || 0) - (s.done || 0));

  /* ------------------------------------------------------------ data sync --*/
  async function reload(opts) {
    opts = opts || {};
    try {
      const res = await API.adminSession();
      if (!res || !res.ok) {
        if (res && res.error === 'auth') { API.session.clear(); location.hash = ''; location.reload(); }
        return;
      }
      const before = JSON.stringify(pendingList().map(b => b.id));
      D = res; reindex();
      U.setTZ(S().timezone);
      API.cache.put('admin', res);

      if (opts.poll) {
        checkNew();
        const after = JSON.stringify(pendingList().map(b => b.id));
        const busy = !document.getElementById('modal').hidden || Date.now() - lastTouch < 8000;
        if (before !== after && busy) { staleBanner = true; renderBannerOnly(); return; }
        if (busy) return;
      }
      staleBanner = false;
      render();
    } catch (e) {
      if (!opts.poll) U.toast(t('netErr'), 'err');
    }
  }

  function renderBannerOnly() {
    const host = document.getElementById('staleHost');
    if (host) host.innerHTML = staleBanner
      ? '<button class="banner info" id="staleBtn" style="width:100%;cursor:pointer">' +
        U.icon('bell') + U.esc(t('newActivity')) + '</button>' : '';
    const b = document.getElementById('staleBtn');
    if (b) b.addEventListener('click', () => { staleBanner = false; render(); });
  }

  function startPolling() {
    if (poller) clearInterval(poller);
    poller = setInterval(() => { if (!document.hidden) reload({ poll: true }); }, 45000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) reload({ poll: true }); });
  }

  /* ---- browser alerts (only while open — Telegram covers app-closed) ---- */
  function notify(title, body) {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const opts = { body, icon: 'assets/icon.svg', tag: 'af-booking', renotify: true };
    if (navigator.serviceWorker && navigator.serviceWorker.ready)
      navigator.serviceWorker.ready.then(r => r.showNotification(title, opts))
        .catch(() => { try { new Notification(title, opts); } catch (e) {} });
    else { try { new Notification(title, opts); } catch (e) {} }
  }
  function checkNew() {
    const ids = pendingList().map(b => b.id);
    if (knownPending === null) { knownPending = new Set(ids); return; }
    pendingList().filter(b => !knownPending.has(b.id)).forEach(b => {
      notify(t('newRequest'), b.student + ' — ' + U.dateLabel(b.date) + ' · ' + U.time12(b.time));
      U.toast(t('newRequest') + ': ' + b.student, 'ok');
    });
    knownPending = new Set(ids);
  }
  async function askNotify() {
    if (typeof Notification === 'undefined') return U.toast(t('notifyBlocked'), 'err');
    const p = await Notification.requestPermission();
    U.toast(p === 'granted' ? t('notifyReady') : t('notifyBlocked'), p === 'granted' ? 'ok' : 'err');
    render();
  }

  /* ================================ TODAY ================================ */
  function alertsPanel() {
    const a = D.alerts || {};
    const groups = [
      ['expiring', a.expiring || [], 'warn'],
      ['exhausted', a.exhausted || [], 'warn'],
      ['unpaidFees', a.unpaid || [], 'bad']
    ].filter(g => g[1].length);
    if (!groups.length) return '';
    return '<section class="panel view"><div class="upper" style="margin-bottom:10px">' +
      U.esc(t('attention')) + '</div><div class="stack sm">' +
      groups.map(([key, list, kind]) =>
        '<div><div class="row wrap" style="gap:6px">' +
        '<span class="badge ' + kind + '">' + U.esc(t(key === 'unpaidFees' ? 'unpaidFees' : key)) +
        ' · ' + n(list.length) + '</span>' +
        list.slice(0, 8).map(x => '<button class="chip mini" data-open="' + U.esc(x.id) + '">' +
          U.esc(x.name) + (x.amount ? ' · ' + U.esc(U.money(x.amount, cur())) : '') +
          (x.end_date ? ' · ' + U.esc(U.dateLabel(x.end_date)) : '') + '</button>').join('') +
        '</div></div>').join('') +
      '</div></section>';
  }

  function riderRow(x, slot, date) {
    const stu = byId(x.id) || x;
    const rec = attOf(x.id, date, slot.time);
    const st = rec ? rec.status : 'none';
    return '<div class="item" data-state="' + st + '" data-row="' + U.esc(x.id) + '" ' +
      'data-slot="' + U.esc(slot.id) + '">' +
      U.avatar(x.name, st === 'present' ? 'ok' : st === 'absent' ? 'bad' : '',
        st === 'none' ? (stu.course || 'basic') : null, stu.course || 'basic') +
      '<div class="grow"><div style="font-weight:700">' + U.esc(x.name) +
        (x.booked ? ' ' + U.badge(t('approved'), 'info') : '') + '</div>' +
      '<div class="tiny dim"><span data-count>' + n(stu.done || 0) + '/' + n(stu.total_classes || 0) +
        '</span> · ' + U.esc(t(stu.course || 'basic')) +
        '<span data-note>' + (rec && rec.note ? ' · ' + U.esc(rec.note) : '') + '</span></div></div>' +
      '<div class="row" style="gap:6px">' +
        '<button class="btn icon sm ' + (st === 'present' ? 'ok' : 'ghost') + '" data-mark="present" ' +
          'aria-label="' + U.esc(t('present')) + '" aria-pressed="' + (st === 'present') + '">' + U.icon('check') + '</button>' +
        '<button class="btn icon sm ' + (st === 'absent' ? 'danger' : 'ghost') + '" data-mark="absent" ' +
          'aria-label="' + U.esc(t('absent')) + '" aria-pressed="' + (st === 'absent') + '">' + U.icon('x') + '</button>' +
      '</div></div>';
  }

  function todayView() {
    if (!datePick) datePick = U.todayISO();
    const wd = U.dowOf(datePick);
    const slots = (D.schedule || []).filter(s => s.day === wd && s.active !== false)
      .sort((a, b) => a.time.localeCompare(b.time));
    const st = D.stats || {};
    const dayClosure = (D.closures || []).find(c => c.date === datePick && !c.slot_id);

    const head = '<section class="panel lead view" data-state="' +
      (datePick === U.todayISO() ? 'today' : 'info') + '">' +
      '<div class="spread">' +
        '<button class="btn icon ghost" id="prevDay" aria-label="' + U.esc(t('back')) + '">' + U.icon('left') + '</button>' +
        '<div class="center grow"><div style="font-weight:700;font-size:1.05rem">' + U.esc(U.dateFull(datePick)) + '</div>' +
        '<div class="tiny dim">' + U.esc(U.relDate(datePick)) + '</div></div>' +
        '<button class="btn icon ghost" id="nextDay" aria-label="' + U.esc(t('add')) + '">' + U.icon('right') + '</button>' +
      '</div>' +
      '<div class="row" style="margin-top:12px;gap:8px">' +
        '<button class="btn sm ghost grow" id="todayBtn">' + U.esc(t('today')) + '</button>' +
        '<input type="date" class="input" id="datePick" value="' + U.esc(datePick) + '" style="min-height:36px;padding:6px 10px;width:auto">' +
        '<button class="btn sm ghost" id="printBtn" aria-label="' + U.esc(t('printSheet')) + '">' + U.icon('print') + '</button>' +
      '</div>' +
      '<div class="grid-3" style="margin-top:14px">' +
        '<div class="stat"><b>' + n(st.students || 0) + '</b><span>' + U.esc(t('students')) + '</span></div>' +
        '<div class="stat"><b>' + n(st.week || 0) + '</b><span>' + U.esc(t('present')) + ' · 7d</span></div>' +
        '<div class="stat"><b>' + U.esc(U.money(st.month_income || 0, cur())) + '</b><span>' + U.esc(t('income')) + '</span></div>' +
      '</div></section>';

    if (dayClosure) {
      return head + '<div class="banner bad view">' + U.icon('alert') +
        U.esc(t('dayClosed') + (dayClosure.reason ? ' — ' + dayClosure.reason : '')) +
        '<button class="btn sm ghost" data-reopen="' + U.esc(dayClosure.id) + '">' + U.esc(t('reopenDay')) + '</button></div>';
    }

    if (!slots.length) return head + U.empty(t('noClassToday'));

    const body = slots.map(s => {
      const closure = closureOf(datePick, s.id);
      const extras = (D.bookings || []).filter(b => b.date === datePick && b.slot_id === s.id && b.status === 'approved')
        .map(b => ({ id: b.student_id, name: b.student, booked: true }));
      const people = (s.students || []).concat(extras);
      const cap = s.capacity || 3;
      let seats = '';
      for (let i = 0; i < cap; i++) seats += '<span class="seat' + (i < people.length ? ' on' : '') + '"></span>';
      const meta = [s.coach, s.horse].filter(Boolean).join(' · ');

      // the card's stripe summarises the slot: all marked, part marked, nothing yet
      const marked = people.filter(x => attOf(x.id, datePick, s.time)).length;
      const state = closure ? 'closed' : !people.length ? 'none'
        : marked === people.length ? 'present' : marked ? 'partial' : 'none';

      return '<section class="panel view" data-state="' + state + '" data-slotcard="' + U.esc(s.id) + '">' +
        '<div class="spread"><div><div class="slot-time">' + U.esc(U.time12(s.time)) + '</div>' +
        (meta ? '<div class="tiny dim">' + U.esc(meta) + '</div>' : '') + '</div>' +
        '<div class="row" style="gap:8px"><span class="tiny dim num">' + n(people.length) + '/' + n(cap) + '</span>' +
        '<span class="seats" aria-hidden="true">' + seats + '</span></div></div>' +
        (closure ? '<div class="banner bad" style="margin-top:10px">' + U.icon('alert') +
          U.esc(closure.reason || t('classClosed')) +
          '<button class="btn sm ghost" data-reopen="' + U.esc(closure.id) + '">' + U.esc(t('reopenDay')) + '</button></div>' : '') +
        (people.length && !closure
          ? '<div class="list" style="margin-top:12px">' + people.map(x => riderRow(x, s, datePick)).join('') + '</div>' +
            '<div class="row" style="margin-top:10px;gap:8px">' +
            '<button class="btn sm ghost grow" data-allpresent="' + U.esc(s.id) + '">' + U.esc(t('markAllPresent')) + '</button>' +
            '<button class="btn sm ghost" data-close-slot="' + U.esc(s.id) + '">' + U.esc(t('closeDay')) + '</button></div>'
          : closure ? '' : '<p class="small dim" style="margin-top:10px">' + U.esc(t('nothingHere')) + '</p>') +
        '</section>';
    }).join('');

    return head + alertsPanel() + '<div class="stack">' + body + '</div>' +
      '<button class="btn ghost block" style="margin-top:14px" id="closeWholeDay">' + U.esc(t('closeDay')) + '</button>' +
      '<p class="tiny dim center" style="margin-top:6px">' + U.esc(t('closeDayHint')) + '</p>';
  }

  /** optimistic: paint the row first, then persist */
  async function mark(rowEl, status) {
    touch();
    const sid = rowEl.dataset.row;
    const slot = slotById(rowEl.dataset.slot) || {};
    const rec = attOf(sid, datePick, slot.time);
    const next = (rec && rec.status === status) ? 'none' : status;

    const prev = rec ? rec.status : 'none';
    applyRow(rowEl, next);
    U.buzz(next === 'none' ? 8 : 14);
    if (next === 'none') { if (rec) delete attIndex[attKey(sid, datePick, slot.time)]; }
    else attIndex[attKey(sid, datePick, slot.time)] = Object.assign(rec || {
      id: 'tmp', student_id: sid, date: datePick, time: slot.time }, { status: next });

    try {
      const res = await API.mark(sid, datePick, slot.time, next);
      if (!res || !res.ok) throw new Error('mark');
      if (res.id) attIndex[attKey(sid, datePick, slot.time)].id = res.id;
      const stu = byId(sid);
      if (stu) {
        if (next === 'present' && prev !== 'present') stu.done = (stu.done || 0) + 1;
        if (prev === 'present' && next !== 'present') stu.done = Math.max(0, (stu.done || 0) - 1);
        // only the count — rewriting the whole line would drop the rider's note
        const cnt = rowEl.querySelector('[data-count]');
        if (cnt) cnt.textContent = n(stu.done) + '/' + n(stu.total_classes);
      }
      refreshSlotState(rowEl.dataset.slot);
    } catch (e) {
      applyRow(rowEl, prev);
      if (prev === 'none') delete attIndex[attKey(sid, datePick, slot.time)];
      refreshSlotState(rowEl.dataset.slot);
      U.toast(t('netErr'), 'err');
    }
  }

  /** keep the slot card's summary stripe honest without a full re-render */
  function refreshSlotState(slotId) {
    const card = document.querySelector('[data-slotcard="' + slotId + '"]');
    if (!card) return;
    const rows = [...card.querySelectorAll('[data-row]')];
    if (!rows.length) return;
    const marked = rows.filter(r => r.dataset.state && r.dataset.state !== 'none').length;
    card.dataset.state = marked === rows.length ? 'present' : marked ? 'partial' : 'none';
  }

  function applyRow(rowEl, status) {
    rowEl.dataset.state = status;
    rowEl.classList.remove('pulse');
    void rowEl.offsetWidth;                       // restart the animation
    rowEl.classList.add('pulse');
    const av = rowEl.querySelector('.avatar');
    av.className = 'avatar' + (status === 'present' ? ' ok' : status === 'absent' ? ' bad' : '');
    // the course tint must step aside once a status is set, and come back when cleared
    if (status === 'none') { if (av.dataset.courseWas) av.dataset.course = av.dataset.courseWas; }
    else if (av.dataset.course) { av.dataset.courseWas = av.dataset.course; av.removeAttribute('data-course'); }
    const [pBtn, aBtn] = rowEl.querySelectorAll('[data-mark]');
    pBtn.classList.toggle('ok', status === 'present');
    pBtn.classList.toggle('ghost', status !== 'present');
    pBtn.setAttribute('aria-pressed', String(status === 'present'));
    aBtn.classList.toggle('danger', status === 'absent');
    aBtn.classList.toggle('ghost', status !== 'absent');
    aBtn.setAttribute('aria-pressed', String(status === 'absent'));
  }

  /* ============================== REQUESTS =============================== */
  function requestCard(b, selectable) {
    const s = byId(b.student_id) || {};
    const left = balanceOf(s);
    const expired = s.end_date && s.end_date < b.date;
    const conflict = (D.bookings || []).some(o => o.id !== b.id && o.student_id === b.student_id &&
      o.date === b.date && ['approved', 'pending'].includes(o.status));
    const flags = [
      left <= 0 ? U.badge(t('noBalance'), 'bad', true) : U.badge(t('classesLeftShort', { n: n(left) }),
        left <= 2 ? 'wait' : 'ok'),
      expired ? U.badge(t('expired'), 'bad', true) : '',
      conflict ? U.badge(t('conflict'), 'wait', true) : '',
      b.status === 'waitlist' ? U.badge(t('waitlist'), 'wait') : ''
    ].filter(Boolean).join('');

    return '<div class="item' + (picked[b.id] ? ' picked' : '') + '" data-state="' + U.esc(b.status) + '">' +
      (selectable ? '<label class="check" style="padding:0"><input type="checkbox" data-pick="' + U.esc(b.id) +
        '" ' + (picked[b.id] ? 'checked' : '') + ' aria-label="' + U.esc(b.student) + '"></label>' : '') +
      U.avatar(b.student, '', (s.course || 'basic')) +
      '<div class="grow"><div style="font-weight:700">' + U.esc(b.student) + '</div>' +
      '<div class="tiny dim">' + U.esc(U.dateFull(b.date)) + ' · ' + U.esc(U.time12(b.time)) + '</div>' +
      '<div class="row wrap" style="gap:4px;margin-top:5px">' + flags + '</div></div>' +
      (selectable
        ? '<div class="row" style="gap:6px">' +
          '<button class="btn icon sm ghost" data-decline="' + U.esc(b.id) + '" aria-label="' + U.esc(t('decline')) + '">' + U.icon('x') + '</button>' +
          '<button class="btn icon sm primary" data-approve="' + U.esc(b.id) + '" aria-label="' + U.esc(t('approve')) + '">' + U.icon('check') + '</button></div>'
        : U.statusBadge(b.status) +
          (b.status === 'declined' ? '<button class="btn sm ghost" data-undo="' + U.esc(b.id) + '">' + U.esc(t('undo')) + '</button>' : '')) +
      '</div>';
  }

  function requestsView() {
    const pending = pendingList();
    const decided = (D.bookings || []).filter(b => !['pending', 'waitlist'].includes(b.status)).slice(0, 30);
    const nPicked = Object.keys(picked).filter(k => picked[k]).length;

    const perm = typeof Notification !== 'undefined' ? Notification.permission : 'denied';
    const notifyRow = perm === 'granted'
      ? '<div class="banner ok">' + U.icon('check') + U.esc(t('notifyReady')) + '</div>'
      : perm === 'denied'
        ? '<div class="banner">' + U.icon('bell') + U.esc(t('notifyBlocked')) + '</div>'
        : '<button class="btn ghost block" id="askNotify">' + U.icon('bell') + U.esc(t('notifyOn')) + '</button>';

    return '<section class="view stack">' + notifyRow +
      '<p class="tiny dim">' + U.esc(t('notifyClosedHint')) + '</p>' +
      (pending.length
        ? '<div class="spread"><span class="upper">' + U.esc(t('requests')) + ' · ' + n(pending.length) + '</span>' +
          (nPicked
            ? '<div class="row" style="gap:6px"><span class="tiny dim">' + U.esc(t('selected', { n: n(nPicked) })) + '</span>' +
              '<button class="btn sm primary" id="approveSel">' + U.esc(t('approve')) + '</button></div>'
            : '<button class="btn sm ghost" id="approveAll">' + U.esc(t('approveAll')) + '</button>') + '</div>' +
          '<div class="list">' + pending.map(b => requestCard(b, true)).join('') + '</div>'
        : U.empty(t('noRequests'))) +
      (decided.length ? '<div class="upper" style="margin-top:8px">' + U.esc(t('history')) + '</div>' +
        '<div class="list">' + decided.map(b => requestCard(b, false)).join('') + '</div>' : '') +
      '</section>';
  }

  async function decide(ids, action, reason) {
    touch();
    try {
      const res = await API.bookingAction(ids, action, reason || '');
      if (!res.ok) return U.toast(t('netErr'), 'err');
      picked = {};
      U.toast(t(action === 'approve' ? 'approved' : action === 'decline' ? 'declined' : 'done'), 'ok');
      await reload({});
    } catch (e) { U.toast(t('netErr'), 'err'); }
  }

  function declineDialog(id) {
    U.dialog({
      title: t('decline'),
      body: U.field(t('declineWhy'), '<input class="input" id="why" maxlength="140">'),
      actions: '<button class="btn ghost grow" data-close>' + U.esc(t('cancel')) + '</button>' +
        '<button class="btn danger grow" id="go">' + U.esc(t('decline')) + '</button>',
      onMount(box) {
        box.querySelector('#go').addEventListener('click', () => {
          const why = box.querySelector('#why').value.trim();
          U.closeDialog();
          decide([id], 'decline', why);
        });
      }
    });
  }

  /* =============================== RIDERS ================================ */
  function ridersView() {
    const q = query.trim().toLowerCase();
    let list = (D.students || []).filter(s =>
      filter === 'all' ? true : filter === 'active' ? s.active !== false : s.active === false);
    if (q) list = list.filter(s => s.name.toLowerCase().includes(q) ||
      (s.tags || []).join(' ').toLowerCase().includes(q) || (s.phone || '').includes(q));

    return '<section class="view stack">' +
      '<div class="row"><input class="input grow" id="q" placeholder="' + U.esc(t('search')) +
        '" value="' + U.esc(query) + '" autocomplete="off">' +
      '<button class="btn primary icon" id="addStudent" aria-label="' + U.esc(t('addStudent')) + '">' + U.icon('plus') + '</button></div>' +
      '<div class="segmented">' + [['active', 'activeOnly'], ['all', 'all'], ['off', 'archived']].map(([k, lbl]) =>
        '<button data-filter="' + k + '" aria-pressed="' + (filter === k) + '">' + U.esc(t(lbl)) + '</button>').join('') + '</div>' +
      (list.length ? '<div class="list">' + list.map(s => {
        const left = balanceOf(s);
        const pct = s.total_classes ? Math.min(1, (s.done || 0) / s.total_classes) : 0;
        const tone = left === 0 ? 'bad' : left <= 2 ? 'warn' : 'ok';
        return '<button class="item" data-open="' + U.esc(s.id) + '"' +
          (s.active === false ? ' data-state="archived"' : s.unpaid > 0 ? ' data-state="due"' : '') + '>' +
          U.avatar(s.name, s.active === false ? 'muted' : '', s.active === false ? null : s.course) +
          '<span class="grow" style="display:grid;gap:5px">' +
            '<span class="spread"><b>' + U.esc(s.name) + '</b>' + U.courseBadge(s.course) + '</span>' +
            '<span class="progress ' + tone + '"><i style="width:' + (pct * 100).toFixed(0) + '%"></i></span>' +
            '<span class="tiny dim">' + n(s.done || 0) + '/' + n(s.total_classes || 0) + ' · ' +
              '<b class="' + U.qClass(left) + '">' + U.esc(t('classesLeftShort', { n: n(left) })) + '</b>' +
              (s.unpaid > 0 ? ' · <b class="q-low">' + U.esc(t('due')) + ' ' + U.esc(U.money(s.unpaid, cur())) + '</b>' : '') + '</span>' +
          '</span></button>';
      }).join('') + '</div>'
        : U.empty(t('noStudents'), '<button class="btn primary" id="addStudent2">' + U.esc(t('addFirst')) + '</button>')) +
      '</section>';
  }

  async function openRider(id) {
    touch();
    let det;
    try { det = await API.studentDetail(id); } catch (e) { return U.toast(t('netErr'), 'err'); }
    if (!det || !det.ok) return U.toast(t('netErr'), 'err');
    const s = det.student;
    const left = balanceOf(s);
    const wa = String(S().whatsapp || s.phone || '').replace(/[^0-9]/g, '');
    const msg = encodeURIComponent(S().academy_name + ' — ' + t('name') + ': ' + s.name + ' · ' + t('pin') + ': ' + s.pin);

    U.dialog({
      wide: true,
      title: s.name,
      body:
        '<div class="grid-3">' +
          '<div class="stat ok"><b>' + n(s.done) + '</b><span>' + U.esc(t('completed')) + '</span></div>' +
          '<div class="stat' + (left === 0 ? ' bad' : left <= 2 ? ' warn' : '') + '"><b>' + n(left) + '</b><span>' + U.esc(t('remaining')) + '</span></div>' +
          '<div class="stat' + (s.unpaid > 0 ? ' bad' : ' ok') + '"><b>' + U.esc(U.money(s.unpaid, cur())) + '</b><span>' + U.esc(t('due')) + '</span></div>' +
        '</div>' +
        '<div class="row wrap">' + U.courseBadge(s.course) +
          (s.tags || []).map(x => U.badge(x, 'plain')).join('') +
          (s.active === false ? U.badge(t('archived'), 'bad') : '') +
          U.badge(t('pin') + ' ' + s.pin, 'plain') + '</div>' +
        (s.note ? '<p class="small muted">' + U.esc(s.note) + '</p>' : '') +
        '<div class="row wrap" style="gap:8px">' +
          '<button class="btn sm ghost" id="editBtn">' + U.esc(t('edit')) + '</button>' +
          '<button class="btn sm ghost" id="payBtn">' + U.esc(t('addPayment')) + '</button>' +
          (wa ? '<a class="btn sm ghost" target="_blank" rel="noopener" href="https://wa.me/' + wa +
            '?text=' + msg + '">' + U.esc(t('sharePin')) + '</a>' : '') +
          '<button class="btn sm ghost" id="archBtn">' + U.esc(s.active === false ? t('unarchive') : t('archive')) + '</button>' +
        '</div>' +

        (det.payments.length ? '<div><div class="upper" style="margin:6px 0">' + U.esc(t('payments')) + '</div>' +
          '<div class="list">' + det.payments.map(p =>
            '<div class="item" data-state="' + (p.paid_on ? 'paid' : 'due') + '">' +
            '<span class="avatar sm ' + (p.paid_on ? 'ok' : 'muted') + '">' + U.icon('cash') + '</span>' +
            '<div class="grow"><div style="font-weight:700">' + U.esc(U.money(p.amount, cur())) + '</div>' +
            '<div class="tiny dim">' + U.esc(p.paid_on ? t('paidOn', { d: U.dateLabel(p.paid_on) })
              : p.due_date ? t('dueOn', { d: U.dateLabel(p.due_date) }) : '') + '</div></div>' +
            (p.paid_on ? U.badge(t('paid'), 'ok', true)
              : '<button class="btn sm primary" data-paid="' + U.esc(p.id) + '" data-amt="' + U.esc(p.amount) +
                '">' + U.esc(t('markPaid')) + '</button>') +
            '<button class="btn icon sm ghost" data-delpay="' + U.esc(p.id) + '" aria-label="' + U.esc(t('delete')) + '">' +
            U.icon('x') + '</button></div>').join('') + '</div></div>' : '') +

        '<div><div class="upper" style="margin:6px 0">' + U.esc(t('history')) + '</div>' +
        (det.attendance.length ? '<div class="list">' + det.attendance.slice(0, 25).map(r =>
          '<div class="item" data-state="' + U.esc(r.status) + '">' +
          '<span class="avatar sm ' + (r.status === 'present' ? 'ok' : r.status === 'absent' ? 'bad' : 'muted') + '">' +
          U.icon(U.statusIcon(r.status), 'ic') + '</span>' +
          '<div class="grow"><div style="font-weight:650">' + U.esc(U.dateFull(r.date)) + '</div>' +
          '<div class="tiny dim">' + U.esc(r.time ? U.time12(r.time) : '') + (r.note ? ' · ' + U.esc(r.note) : '') + '</div></div>' +
          U.statusBadge(r.status) + '</div>').join('') + '</div>'
          : '<p class="small dim">' + U.esc(t('noHistory')) + '</p>') + '</div>' +

        (det.bookings.length ? '<div><div class="upper" style="margin:6px 0">' + U.esc(t('myBookings')) + '</div>' +
          '<div class="list">' + det.bookings.slice(0, 12).map(b =>
            '<div class="item"><div class="grow"><div style="font-weight:600">' + U.esc(U.dateFull(b.date)) +
            ' · ' + U.esc(U.time12(b.time)) + '</div></div>' +
            U.badge(t(b.status), U.statusKind(b.status)) + '</div>').join('') + '</div></div>' : ''),
      actions: '<button class="btn ghost grow" data-close>' + U.esc(t('close')) + '</button>' +
        '<button class="btn danger" id="delBtn">' + U.esc(t('delete')) + '</button>',
      onMount(box) {
        // swap the dialog contents in place — closing first would let the browser's
        // popstate land on the newly opened form and shut it again
        box.querySelector('#editBtn').addEventListener('click', () => studentForm(s));
        box.querySelector('#payBtn').addEventListener('click', () => paymentForm(s));
        box.querySelector('#archBtn').addEventListener('click', async () => {
          await API.saveStudent(Object.assign({}, s, { active: s.active === false }));
          U.closeDialog(); U.toast(t('saved'), 'ok'); reload({});
        });
        box.querySelector('#delBtn').addEventListener('click', () => deleteRider(s, det));
        box.querySelectorAll('[data-paid]').forEach(b => b.addEventListener('click', async () => {
          await API.savePayment({ id: b.dataset.paid, student_id: s.id, amount: b.dataset.amt,
            paid_on: U.todayISO() });
          U.closeDialog(); U.toast(t('saved'), 'ok'); reload({});
        }));
        box.querySelectorAll('[data-delpay]').forEach(b => b.addEventListener('click', async () => {
          await API.deletePayment(b.dataset.delpay);
          U.closeDialog(); U.toast(t('deleted')); reload({});
        }));
      }
    });
  }

  function deleteRider(s, det) {
    const count = (det.attendance || []).length + (det.bookings || []).length + (det.payments || []).length;
    U.dialog({
      title: t('deleteRider'),
      body: '<p class="muted">' + U.esc(t('deleteWarn', { n: n(count), name: s.name })) + '</p>' +
        U.field(t('typeName'), '<input class="input" id="confirmName" autocomplete="off">'),
      actions: '<button class="btn ghost grow" data-close>' + U.esc(t('cancel')) + '</button>' +
        '<button class="btn danger grow" id="go">' + U.esc(t('delete')) + '</button>',
      onMount(box) {
        box.querySelector('#go').addEventListener('click', async () => {
          const v = box.querySelector('#confirmName').value.trim();
          const res = await API.deleteStudent(s.id, v);
          if (!res.ok) return U.toast(res.error === 'confirm' ? t('confirmMismatch') : t('netErr'), 'err');
          U.closeDialog(); U.toast(t('deleted')); reload({});
        });
      }
    });
  }

  function studentForm(s) {
    const isNew = !s || !s.id;
    s = s || { course: 'basic', total_classes: 8, start_date: U.todayISO(), tags: [], active: true, pin: '' };
    U.dialog({
      title: isNew ? t('newStudent') : t('editStudent'),
      body:
        U.field(t('name'), '<input class="input" id="f_name" value="' + U.esc(s.name || '') + '" autocomplete="off">') +
        '<div class="grid-2">' +
          U.field(t('resetPin'), '<div class="row"><input class="input grow" id="f_pin" inputmode="numeric" maxlength="4" value="' +
            U.esc(s.pin || '') + '"><button class="btn sm ghost" id="genPin" type="button">' + U.esc(t('generatePin')) + '</button></div>') +
          U.field(t('phone'), '<input class="input" id="f_phone" inputmode="tel" value="' + U.esc(s.phone || '') + '">') +
        '</div>' +
        U.field(t('course'), '<select class="input" id="f_course">' +
          ['basic', 'advanced', 'private'].map(c => '<option value="' + c + '"' + (s.course === c ? ' selected' : '') +
            '>' + U.esc(t(c)) + ' — ' + U.esc(t(c + 'Sub')) + '</option>').join('') + '</select>') +
        '<div class="grid-2">' +
          U.field(t('totalClasses'), '<input class="input" id="f_total" type="number" min="1" value="' + U.esc(s.total_classes || 8) + '">') +
          U.field(t('startDate'), '<input class="input" id="f_start" type="date" value="' + U.esc(s.start_date || U.todayISO()) + '">') +
        '</div>' +
        U.field(t('endDate'), '<input class="input" id="f_end" type="date" value="' + U.esc(s.end_date || '') + '">') +
        U.field(t('tags'), '<input class="input" id="f_tags" value="' + U.esc((s.tags || []).join(', ')) + '">', t('tagsHint')) +
        U.field(t('note'), '<textarea class="input" id="f_note">' + U.esc(s.note || '') + '</textarea>') +
        '<label class="check"><input type="checkbox" id="f_active"' + (s.active !== false ? ' checked' : '') + '>' +
        '<span>' + U.esc(t('activeOnly')) + '</span></label>' +
        '<p class="form-error hide" id="err"></p>',
      actions: '<button class="btn ghost grow" data-close>' + U.esc(t('cancel')) + '</button>' +
        '<button class="btn primary grow" id="save">' + U.esc(t('save')) + '</button>',
      onMount(box) {
        const $ = q => box.querySelector(q);
        $('#f_course').addEventListener('change', () => {
          const map = { basic: 8, advanced: 16, private: 12 };
          $('#f_total').value = map[$('#f_course').value] || 8;
          const months = $('#f_course').value === 'advanced' ? 2 : 1;
          const d = U.parseISO($('#f_start').value || U.todayISO());
          d.setMonth(d.getMonth() + months);
          $('#f_end').value = d.toISOString().slice(0, 10);
        });
        $('#f_pin').addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4); });
        $('#genPin').addEventListener('click', () => {
          $('#f_pin').value = String(Math.floor(1000 + Math.random() * 9000));
        });
        $('#save').addEventListener('click', async () => {
          const err = $('#err');
          const payload = {
            id: s.id, name: $('#f_name').value.trim(), pin: $('#f_pin').value.trim(),
            phone: $('#f_phone').value.trim(), course: $('#f_course').value,
            total_classes: +$('#f_total').value, start_date: $('#f_start').value || U.todayISO(),
            end_date: $('#f_end').value || null,
            tags: $('#f_tags').value.split(',').map(x => x.trim()).filter(Boolean),
            note: $('#f_note').value.trim(), active: $('#f_active').checked
          };
          const fail = m => { err.textContent = m; err.classList.remove('hide'); };
          if (!payload.name) return fail(t('fillAll'));
          if (!/^\d{4}$/.test(payload.pin)) return fail(t('pin4'));
          const res = await API.saveStudent(payload);
          if (!res.ok) return fail(res.error === 'duplicate' ? t('confirmMismatch') : t('netErr'));
          U.closeDialog(); U.toast(t('saved'), 'ok'); reload({});
        });
      }
    });
  }

  function paymentForm(s) {
    U.dialog({
      title: t('addPayment') + ' — ' + s.name,
      body: '<div class="grid-2">' +
          U.field(t('amount'), '<input class="input" id="p_amt" type="number" min="0" step="1" value="0">') +
          U.field(t('dueOn', { d: '' }).trim() || t('due'), '<input class="input" id="p_due" type="date" value="' + U.todayISO() + '">') +
        '</div>' +
        '<label class="check"><input type="checkbox" id="p_paid"><span>' + U.esc(t('markPaid')) + '</span></label>' +
        U.field(t('note'), '<input class="input" id="p_note">'),
      actions: '<button class="btn ghost grow" data-close>' + U.esc(t('cancel')) + '</button>' +
        '<button class="btn primary grow" id="save">' + U.esc(t('save')) + '</button>',
      onMount(box) {
        box.querySelector('#save').addEventListener('click', async () => {
          const res = await API.savePayment({
            student_id: s.id, amount: +box.querySelector('#p_amt').value || 0,
            due_date: box.querySelector('#p_due').value || null,
            paid_on: box.querySelector('#p_paid').checked ? U.todayISO() : null,
            note: box.querySelector('#p_note').value.trim()
          });
          if (!res.ok) return U.toast(t('netErr'), 'err');
          U.closeDialog(); U.toast(t('saved'), 'ok'); reload({});
        });
      }
    });
  }

  /* ============================== SCHEDULE =============================== */
  function scheduleView() {
    const days = [...new Set((D.schedule || []).map(s => s.day))].sort();
    if (dayPick == null || !days.includes(dayPick))
      dayPick = days.includes(U.dowOf(U.todayISO())) ? U.dowOf(U.todayISO()) : (days[0] != null ? days[0] : 5);

    const chips = days.map(d => '<button class="chip" data-day="' + d + '" aria-pressed="' + (d === dayPick) + '">' +
      U.esc(U.dayName(d, true)) + '</button>').join('') +
      '<button class="chip" id="newSlot">+ ' + U.esc(t('addSlot')) + '</button>';

    const slots = (D.schedule || []).filter(s => s.day === dayPick)
      .sort((a, b) => a.time.localeCompare(b.time)).map(s => {
      const cap = s.capacity || 3;
      const list = s.students || [];
      let seats = '';
      for (let i = 0; i < cap; i++) seats += '<span class="seat' + (i < list.length ? ' on' : '') + '"></span>';
      const meta = [s.coach, s.horse].filter(Boolean).join(' · ');
      return '<div class="panel' + (s.active === false ? ' flat' : '') + '">' +
        '<div class="spread"><div class="row" style="gap:10px">' +
          '<div><div class="slot-time">' + U.esc(U.time12(s.time)) + '</div>' +
          (meta ? '<div class="tiny dim">' + U.esc(meta) + '</div>' : '') + '</div>' +
          (s.active === false ? U.badge(t('slotPaused'), 'bad') : '') +
        '</div>' +
        '<div class="row" style="gap:8px"><span class="tiny dim num">' + n(list.length) + '/' + n(cap) + '</span>' +
        '<span class="seats" aria-hidden="true">' + seats + '</span>' +
        '<button class="btn icon sm ghost" data-editslot="' + U.esc(s.id) + '" aria-label="' + U.esc(t('edit')) + '">' +
        U.icon('gear') + '</button></div></div>' +
        '<div class="riders">' + list.map(x => '<span class="rider"><span class="avatar sm">' +
          U.esc(U.initials(x.name)) + '</span>' + U.esc(x.name) +
          '<button data-rm="' + U.esc(x.id) + '" data-slot="' + U.esc(s.id) + '" aria-label="' +
          U.esc(t('delete')) + '">' + U.icon('x') + '</button></span>').join('') +
          (list.length < cap ? '<button class="rider empty" data-add="' + U.esc(s.id) + '">+ ' +
            U.esc(t('addToSlot')) + '</button>' : U.badge(t('full'), 'bad')) +
        '</div></div>';
    }).join('');

    return '<section class="view stack"><div class="chips">' + chips + '</div>' +
      '<div class="stack sm">' + (slots || U.empty(t('nothingHere'))) + '</div></section>';
  }

  function slotForm(slot) {
    const isNew = !slot;
    const s = slot || { day: dayPick != null ? dayPick : 5, time: '16:00',
      capacity: +(S().capacity || 3), coach: '', horse: '', active: true };
    U.dialog({
      title: isNew ? t('addSlot') : t('slotTimes'),
      body:
        U.field(t('day'), '<select class="input" id="s_day">' + U.DAY.map((k, i) =>
          '<option value="' + i + '"' + (i === s.day ? ' selected' : '') + '>' + U.esc(U.dayName(i)) + '</option>').join('') + '</select>') +
        '<div class="grid-2">' +
          U.field(t('time'), '<input class="input" id="s_time" type="time" value="' + U.esc(s.time) + '">') +
          U.field(t('capacity'), '<input class="input" id="s_cap" type="number" min="1" max="12" value="' + U.esc(s.capacity || 3) + '">') +
        '</div>' +
        '<div class="grid-2">' +
          U.field(t('coach'), '<input class="input" id="s_coach" value="' + U.esc(s.coach || '') + '">') +
          U.field(t('horse'), '<input class="input" id="s_horse" value="' + U.esc(s.horse || '') + '">') +
        '</div>' +
        '<label class="check"><input type="checkbox" id="s_active"' + (s.active !== false ? ' checked' : '') + '>' +
        '<span>' + U.esc(t('slotActive')) + '</span></label>',
      actions: (isNew ? '' : '<button class="btn danger" id="sdel">' + U.esc(t('delete')) + '</button>') +
        '<button class="btn ghost grow" data-close>' + U.esc(t('cancel')) + '</button>' +
        '<button class="btn primary grow" id="ssave">' + U.esc(t('save')) + '</button>',
      onMount(box) {
        const del = box.querySelector('#sdel');
        if (del) del.addEventListener('click', async () => {
          const yes = await U.confirm({ title: U.time12(s.time), message: t('areYouSure'), danger: true, okText: t('delete') });
          if (!yes) { slotForm(s); return; }          // cancelling must return to the editor
          await API.deleteSlot(s.id); U.toast(t('deleted')); reload({});
        });
        box.querySelector('#ssave').addEventListener('click', async () => {
          const res = await API.saveSlot({
            id: s.id, day: +box.querySelector('#s_day').value, time: box.querySelector('#s_time').value,
            capacity: +box.querySelector('#s_cap').value || 3,
            coach: box.querySelector('#s_coach').value.trim(), horse: box.querySelector('#s_horse').value.trim(),
            active: box.querySelector('#s_active').checked
          });
          if (!res.ok) return U.toast(t('netErr'), 'err');
          dayPick = +box.querySelector('#s_day').value;
          U.closeDialog(); U.toast(t('saved'), 'ok'); reload({});
        });
      }
    });
  }

  function pickRider(slotId) {
    const slot = slotById(slotId);
    const taken = new Set((slot.students || []).map(x => x.id));
    const list = (D.students || []).filter(s => s.active !== false && !taken.has(s.id));
    U.dialog({
      title: t('pickStudent'),
      body: '<input class="input" id="pq" placeholder="' + U.esc(t('search')) + '">' +
        '<div class="list name-list" id="plist">' + list.map(s =>
          '<button class="item" data-pick="' + U.esc(s.id) + '" data-name="' + U.esc(s.name.toLowerCase()) + '">' +
          '<span class="avatar">' + U.esc(U.initials(s.name)) + '</span>' +
          '<span class="grow"><b>' + U.esc(s.name) + '</b><br><span class="tiny dim">' +
          n(s.done || 0) + '/' + n(s.total_classes || 0) + '</span></span>' +
          U.courseBadge(s.course) + '</button>').join('') + '</div>',
      onMount(box) {
        box.querySelector('#pq').addEventListener('input', e => {
          const q = e.target.value.toLowerCase();
          box.querySelectorAll('[data-pick]').forEach(el => el.classList.toggle('hide', !el.dataset.name.includes(q)));
        });
        box.querySelectorAll('[data-pick]').forEach(el => el.addEventListener('click', async () => {
          const res = await API.addToSlot(slotId, el.dataset.pick);
          if (!res.ok) return U.toast(res.error === 'full'
            ? t('slotFull', { n: n(res.capacity || 3) }) : t('alreadyBooked'), 'err');
          U.closeDialog(); reload({});
        }));
      }
    });
  }

  /* =============================== SETTINGS ============================== */
  function settingsView() {
    const s = S();
    const th = U.theme.get();
    const isOwner = D.admin && D.admin.role === 'owner';
    return '<section class="view stack">' +

      '<div class="panel stack"><div class="upper">' + U.esc(t('settings')) + '</div>' +
        U.field(t('academyName'), '<input class="input" id="st_name" value="' + U.esc(s.academy_name || '') + '">') +
        '<div class="grid-2">' +
          U.field(t('contactPhone'), '<input class="input" id="st_phone" inputmode="tel" value="' + U.esc(s.contact_phone || '') + '">') +
          U.field(t('whatsapp'), '<input class="input" id="st_wa" inputmode="tel" value="' + U.esc(s.whatsapp || '') + '">') +
        '</div>' +
        '<div class="grid-2">' +
          U.field(t('timezone'), '<input class="input" id="st_tz" value="' + U.esc(s.timezone || 'Asia/Dhaka') + '">') +
          U.field(t('currency'), '<input class="input" id="st_cur" value="' + U.esc(s.currency || 'BDT') + '">') +
        '</div>' +
        '<div class="grid-2">' +
          U.field(t('capacity'), '<input class="input" id="st_cap" type="number" min="1" max="12" value="' + U.esc(s.capacity || 3) + '">') +
          U.field(t('replyHours'), '<input class="input" id="st_reply" type="number" min="1" value="' + U.esc(s.reply_hours || 24) + '">') +
        '</div>' +
        U.field(t('cancelCutoff'), '<input class="input" id="st_cut" type="number" min="0" value="' + U.esc(s.cancel_cutoff_h || 3) + '">') +
        '<label class="check"><input type="checkbox" id="st_dir"' + (s.directory !== 'off' ? ' checked' : '') + '>' +
        '<span>' + U.esc(t('directory')) + '</span></label>' +
        '<button class="btn primary" id="saveSettings">' + U.esc(t('save')) + '</button>' +
      '</div>' +

      '<div class="panel stack"><div class="upper">' + U.esc(t('telegram')) + '</div>' +
        '<p class="tiny dim">' + U.esc(t('telegramHint')) + '</p>' +
        U.field(t('telegramToken'), '<input class="input" id="tg_token" value="' + U.esc(s.telegram_token || '') + '">') +
        U.field(t('telegramChat'), '<input class="input" id="tg_chat" value="' + U.esc(s.telegram_chat || '') + '">') +
        '<div class="row"><button class="btn ghost grow" id="saveTg">' + U.esc(t('save')) + '</button>' +
        '<button class="btn ghost grow" id="testTg">' + U.esc(t('testMessage')) + '</button></div>' +
      '</div>' +

      '<div class="panel stack"><div class="upper">' + U.esc(t('changePass')) + '</div>' +
        U.field(t('currentPass'), '<input class="input" id="pw_cur" type="password" autocomplete="current-password">') +
        '<div class="grid-2">' +
          U.field(t('newPass'), '<input class="input" id="pw_new" type="password" autocomplete="new-password">') +
          U.field(t('confirmPass'), '<input class="input" id="pw_c2" type="password" autocomplete="new-password">') +
        '</div>' +
        '<label class="check"><input type="checkbox" id="pw_show"><span>' + U.esc(t('showPin')) + '</span></label>' +
        '<button class="btn primary" id="savePass">' + U.esc(t('save')) + '</button>' +
      '</div>' +

      (isOwner ? '<div class="panel stack"><div class="spread"><span class="upper">' + U.esc(t('staff')) + '</span>' +
        '<button class="btn sm ghost" id="addStaff">' + U.esc(t('addStaff')) + '</button></div>' +
        '<div class="list">' + (D.admins || []).map(u =>
          '<div class="item"><span class="avatar' + (u.active ? '' : ' muted') + '">' + U.esc(U.initials(u.display || u.username)) + '</span>' +
          '<div class="grow"><div style="font-weight:650">' + U.esc(u.display || u.username) + '</div>' +
          '<div class="tiny dim">' + U.esc(u.username) + ' · ' + U.esc(t(u.role === 'owner' ? 'owner' : 'staff')) + '</div></div>' +
          (u.id !== D.admin.id ? '<button class="btn icon sm ghost" data-deluser="' + U.esc(u.id) +
            '" aria-label="' + U.esc(t('delete')) + '">' + U.icon('x') + '</button>' : '') + '</div>').join('') +
        '</div></div>' : '') +

      '<div class="panel stack"><div class="upper">' + U.esc(t('exportData')) + '</div>' +
        '<button class="btn ghost block" id="exportBtn">' + U.icon('down') + U.esc(t('exportData')) + '</button>' +
        '<button class="btn ghost block" id="importBtn">' + U.icon('up') + U.esc(t('importData')) + '</button>' +
        '<input type="file" id="importFile" accept="application/json,.json" class="hide">' +
      '</div>' +

      '<div class="panel stack">' +
        '<div><div class="upper" style="margin-bottom:8px">' + U.esc(t('theme')) + '</div>' +
        '<div class="segmented">' + ['system', 'light', 'dark'].map(v =>
          '<button data-uitheme="' + v + '" aria-pressed="' + (th === v) + '">' + U.esc(t(v)) + '</button>').join('') + '</div></div>' +
        '<div><div class="upper" style="margin-bottom:8px">' + U.esc(t('language')) + '</div>' +
        '<div class="segmented"><button data-uilang="en" aria-pressed="' + (I18N.lang === 'en') + '">English</button>' +
        '<button data-uilang="bn" aria-pressed="' + (I18N.lang === 'bn') + '">বাংলা</button></div></div>' +
        '<button class="btn ghost block" id="installBtn">' + U.esc(t('installApp')) + '</button>' +
        '<button class="btn ghost block" id="logout">' + U.esc(t('logout')) + '</button>' +
      '</div>' +

      '<div class="panel"><div class="upper" style="margin-bottom:10px">' + U.esc(t('activity')) + '</div>' +
        '<div class="scroll-x"><table class="table"><tbody>' + (D.activity || []).slice(0, 25).map(a =>
          '<tr><td>' + U.esc(a.actor) + '</td><td>' + U.esc(a.action) + '</td><td class="dim">' +
          U.esc(a.detail || '') + '</td></tr>').join('') + '</tbody></table></div></div>' +

      '<p class="tiny dim center">v' + U.esc((window.AF_CONFIG && AF_CONFIG.version) || '2.0.0') +
        (API.LIVE ? '' : ' · demo mode') + '</p>' +
      '</section>';
  }

  function staffForm() {
    U.dialog({
      title: t('addStaff'),
      body: U.field(t('username'), '<input class="input" id="u_name" autocomplete="off">') +
        U.field(t('name'), '<input class="input" id="u_disp">') +
        U.field(t('password'), '<input class="input" id="u_pass" type="password">') +
        U.field(t('role'), '<select class="input" id="u_role"><option value="staff">' + U.esc(t('staff')) +
          '</option><option value="owner">' + U.esc(t('owner')) + '</option></select>'),
      actions: '<button class="btn ghost grow" data-close>' + U.esc(t('cancel')) + '</button>' +
        '<button class="btn primary grow" id="go">' + U.esc(t('save')) + '</button>',
      onMount(box) {
        box.querySelector('#go').addEventListener('click', async () => {
          const pass = box.querySelector('#u_pass').value;
          if (pass.length < 6) return U.toast(t('passShort'), 'err');
          const res = await API.saveUser({
            username: box.querySelector('#u_name').value.trim(), display: box.querySelector('#u_disp').value.trim(),
            pass, role: box.querySelector('#u_role').value });
          if (!res.ok) return U.toast(t('netErr'), 'err');
          U.closeDialog(); U.toast(t('saved'), 'ok'); reload({});
        });
      }
    });
  }

  function importFlow(file) {
    const reader = new FileReader();
    reader.onload = async () => {
      let data;
      try { data = JSON.parse(reader.result); } catch (e) { return U.toast(t('netErr'), 'err'); }
      const pv = await API.importAll(data, 'preview');
      if (!pv.ok) return U.toast(t('netErr'), 'err');
      U.dialog({
        title: t('importData'),
        body: '<p class="muted">' + U.esc(t('importPreview', {
            s: n(pv.students), a: n(pv.attendance), cs: n(pv.current.students), ca: n(pv.current.attendance)
          })) + '</p>' +
          '<div class="banner warn">' + U.icon('alert') + U.esc(t('areYouSure')) + '</div>',
        actions: '<button class="btn ghost grow" data-close>' + U.esc(t('cancel')) + '</button>' +
          '<button class="btn ghost grow" id="merge">' + U.esc(t('importMerge')) + '</button>' +
          '<button class="btn danger grow" id="replace">' + U.esc(t('importReplace')) + '</button>',
        onMount(box) {
          const run = async mode => {
            const res = await API.importAll(data, mode);
            U.closeDialog();
            if (!res.ok) return U.toast(t('netErr'), 'err');
            U.toast(t('importDone'), 'ok');
            reload({});
          };
          box.querySelector('#merge').addEventListener('click', () => run('merge'));
          box.querySelector('#replace').addEventListener('click', () => run('replace'));
        }
      });
    };
    reader.readAsText(file);
  }

  /* ================================ SHELL ================================ */
  function nav() {
    const pending = pendingList().length;
    const items = [['today', 'check'], ['requests', 'bell'], ['students', 'users'],
                   ['schedule', 'calendar'], ['settings', 'gear']];
    const el = document.getElementById('nav');
    el.hidden = false;
    el.innerHTML = items.map(([k, ic]) =>
      '<button data-tab="' + k + '" ' + (tab === k ? 'aria-current="page"' : '') + ' style="position:relative">' +
      U.icon(ic) + '<span>' + U.esc(t(k === 'students' ? 'students' : k)) + '</span>' +
      (k === 'requests' && pending ? '<span class="dot-badge">' + n(pending) + '</span>' : '') +
      '</button>').join('');
  }

  function topbar() {
    const unseen = D.unseen || 0;
    return '<header class="topbar">' +
      '<div class="brand grow">' + U.logo('') +
      '<div><div class="brand-name">' + U.esc(S().academy_name || t('academy')) + '</div>' +
      '<div class="brand-sub">' + U.esc(t('console')) + '</div></div></div>' +
      '<button class="btn icon ghost" id="bell" style="position:relative" aria-label="' + U.esc(t('requests')) + '">' +
      U.icon('bell') + (unseen ? '<span class="dot-badge">' + n(unseen) + '</span>' : '') + '</button>' +
      '<button class="btn sm ghost" id="langBtn">' + (I18N.lang === 'en' ? 'বাংলা' : 'EN') + '</button>' +
      '</header>';
  }

  function render() {
    const body = tab === 'requests' ? requestsView()
      : tab === 'students' ? ridersView()
      : tab === 'schedule' ? scheduleView()
      : tab === 'settings' ? settingsView()
      : todayView();

    U.paint(topbar() +
      '<div id="staleHost"></div>' +
      (API.online ? '' : '<div class="banner warn" style="margin-bottom:12px">' + U.icon('wifi') + U.esc(t('offline')) + '</div>') +
      '<div class="print-only print-head"><b>' + U.esc(S().academy_name || 'Al Fursan') + '</b> — ' +
        U.esc(U.dateFull(datePick || U.todayISO())) + '</div>' +
      body, 'admin:' + tab);
    nav();
    renderBannerOnly();
    bind();
  }

  function bind() {
    const $ = s => document.querySelector(s);
    const $$ = s => document.querySelectorAll(s);
    const wire = (sel, ev, fn) => $$(sel).forEach(el => el.addEventListener(ev, e => { touch(); fn(el, e); }));

    wire('[data-tab]', 'click', el => U.router.go('admin', el.dataset.tab));
    wire('[data-day]', 'click', el => { dayPick = +el.dataset.day; render(); });
    wire('[data-filter]', 'click', el => { filter = el.dataset.filter; render(); });
    // NOTE: never bind on [data-theme]/[data-lang] — those attributes also sit on
    // <html>, which survives every render, so listeners would stack up forever.
    wire('[data-uitheme]', 'click', el => { U.theme.set(el.dataset.uitheme); render(); });
    wire('[data-uilang]', 'click', el => { I18N.set(el.dataset.uilang); render(); });

    /* today */
    wire('#prevDay', 'click', () => { datePick = U.addDaysISO(datePick, -1); render(); });
    wire('#nextDay', 'click', () => { datePick = U.addDaysISO(datePick, 1); render(); });
    wire('#todayBtn', 'click', () => { datePick = U.todayISO(); render(); });
    wire('#datePick', 'change', el => { datePick = el.value; render(); });
    wire('#printBtn', 'click', () => window.print());
    wire('[data-mark]', 'click', el => mark(el.closest('[data-row]'), el.dataset.mark));
    wire('[data-allpresent]', 'click', async el => {
      const res = await API.markBulk(el.dataset.allpresent, datePick, 'present');
      if (!res.ok) return U.toast(t('netErr'), 'err');
      U.toast(t('marked'), 'ok'); reload({});
    });
    wire('[data-reopen]', 'click', async el => { await API.openDay(el.dataset.reopen); reload({}); });
    wire('[data-close-slot]', 'click', el => closeDayDialog(el.dataset.closeSlot));
    wire('#closeWholeDay', 'click', () => closeDayDialog(null));

    /* requests */
    wire('[data-pick]', 'change', el => { picked[el.dataset.pick] = el.checked; render(); });
    wire('[data-approve]', 'click', el => decide([el.dataset.approve], 'approve'));
    wire('[data-decline]', 'click', el => declineDialog(el.dataset.decline));
    wire('[data-undo]', 'click', el => decide([el.dataset.undo], 'undo'));
    wire('#approveAll', 'click', () => decide(pendingList().map(b => b.id), 'approve'));
    wire('#approveSel', 'click', () => decide(Object.keys(picked).filter(k => picked[k]), 'approve'));
    wire('#askNotify', 'click', askNotify);

    /* riders */
    wire('[data-open]', 'click', el => openRider(el.dataset.open));
    wire('#addStudent', 'click', () => studentForm(null));
    wire('#addStudent2', 'click', () => studentForm(null));
    const q = $('#q');
    if (q) q.addEventListener('input', e => {
      touch();
      query = e.target.value;
      const pos = e.target.selectionStart;
      render();
      const nq = document.getElementById('q');
      if (nq) { nq.focus(); nq.setSelectionRange(pos, pos); }
    });

    /* schedule */
    wire('#newSlot', 'click', () => slotForm(null));
    wire('[data-editslot]', 'click', el => slotForm(slotById(el.dataset.editslot)));
    wire('[data-add]', 'click', el => pickRider(el.dataset.add));
    wire('[data-rm]', 'click', async el => {
      await API.removeFromSlot(el.dataset.slot, el.dataset.rm); reload({});
    });

    /* settings */
    wire('#saveSettings', 'click', async () => {
      const res = await API.saveSettings({
        academy_name: $('#st_name').value.trim(), contact_phone: $('#st_phone').value.trim(),
        whatsapp: $('#st_wa').value.trim(), timezone: $('#st_tz').value.trim() || 'Asia/Dhaka',
        currency: $('#st_cur').value.trim() || 'BDT', capacity: String(+$('#st_cap').value || 3),
        reply_hours: String(+$('#st_reply').value || 24), cancel_cutoff_h: String(+$('#st_cut').value || 0),
        directory: $('#st_dir').checked ? 'on' : 'off'
      });
      if (!res.ok) return U.toast(t('netErr'), 'err');
      U.toast(t('saved'), 'ok'); reload({});
    });
    wire('#saveTg', 'click', async () => {
      const res = await API.saveSettings({ telegram_token: $('#tg_token').value.trim(),
        telegram_chat: $('#tg_chat').value.trim() });
      if (!res.ok) return U.toast(t('netErr'), 'err');
      U.toast(t('saved'), 'ok'); reload({});
    });
    wire('#testTg', 'click', async () => {
      const res = await API.notifyTest();
      U.toast(res.ok ? t('telegramSent') : t('telegramUnset'), res.ok ? 'ok' : 'err');
    });
    wire('#pw_show', 'change', el => {
      ['#pw_cur', '#pw_new', '#pw_c2'].forEach(s => { $(s).type = el.checked ? 'text' : 'password'; });
    });
    wire('#savePass', 'click', async () => {
      const curPass = $('#pw_cur').value, np = $('#pw_new').value, c2 = $('#pw_c2').value;
      if (np.length < 6) return U.toast(t('passShort'), 'err');
      if (np !== c2) return U.toast(t('passMismatch'), 'err');
      const res = await API.changePassword(curPass, np);
      if (!res.ok) return U.toast(res.error === 'current' ? t('wrongCurrent')
        : res.error === 'short' ? t('passShort') : t('netErr'), 'err');
      $('#pw_cur').value = $('#pw_new').value = $('#pw_c2').value = '';
      U.toast(t('saved'), 'ok');
    });
    wire('#addStaff', 'click', staffForm);
    wire('[data-deluser]', 'click', async el => {
      const yes = await U.confirm({ title: t('delete'), danger: true, okText: t('delete') });
      if (!yes) return;
      await API.deleteUser(el.dataset.deluser); reload({});
    });
    wire('#exportBtn', 'click', async () => {
      const res = await API.exportAll();
      if (!res.ok) return U.toast(t('netErr'), 'err');
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'al-fursan-' + U.todayISO() + '.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    });
    wire('#importBtn', 'click', () => $('#importFile').click());
    wire('#importFile', 'change', el => { if (el.files && el.files[0]) importFlow(el.files[0]); });
    wire('#installBtn', 'click', () => window.AF_INSTALL && window.AF_INSTALL());
    wire('#logout', 'click', async () => {
      await API.logout(); API.session.clear(); location.hash = ''; location.reload();
    });

    /* chrome */
    wire('#langBtn', 'click', () => { I18N.toggle(); render(); });
    wire('#bell', 'click', async () => {
      U.router.go('admin', 'requests');
      if (D.unseen) { await API.bookingsSeen(); D.unseen = 0; reload({}); }
    });
  }

  function closeDayDialog(slotId) {
    U.dialog({
      title: t('closeDay'),
      body: '<p class="muted">' + U.esc(U.dateFull(datePick)) +
        (slotId ? ' · ' + U.esc(U.time12((slotById(slotId) || {}).time)) : ' · ' + U.esc(t('wholeDay'))) + '</p>' +
        U.field(t('reason'), '<input class="input" id="why" maxlength="140">') +
        '<p class="tiny dim">' + U.esc(t('closeDayHint')) + '</p>',
      actions: '<button class="btn ghost grow" data-close>' + U.esc(t('cancel')) + '</button>' +
        '<button class="btn danger grow" id="go">' + U.esc(t('closeDay')) + '</button>',
      onMount(box) {
        box.querySelector('#go').addEventListener('click', async () => {
          const why = box.querySelector('#why').value.trim();
          const res = await API.closeDay(datePick, slotId, why);
          U.closeDialog();
          if (!res.ok) return U.toast(t('netErr'), 'err');
          U.toast(t('saved'), 'ok'); reload({});
        });
      }
    });
  }

  window.ADMIN = {
    async start(payload, route) {
      D = payload; reindex();
      U.setTZ(S().timezone);
      datePick = U.todayISO();
      const TABS = ['today', 'requests', 'students', 'schedule', 'settings'];
      const want = route && route.tab;
      tab = TABS.indexOf(want) >= 0 ? want : 'today';
      knownPending = new Set(pendingList().map(b => b.id));
      render();
      startPolling();
      API.onConnection(on => { if (on) reload({ poll: true }); else render(); });
    },
    route(r) {
      if (!D) return;
      const TABS = ['today', 'requests', 'students', 'schedule', 'settings'];
      let wanted = r.tab || 'today';
      if (TABS.indexOf(wanted) < 0) {          // unknown tab in the URL: normalise it
        wanted = 'today';
        U.router.go('admin', wanted, '', true);
        if (wanted === tab) { render(); return; }
      }
      if (wanted === tab) return;
      tab = wanted;
      render();
    }
  };
})();
