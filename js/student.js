/* Al Fursan — student portal */
(function () {
  const U = UI;
  let data = null;      // { student, attendance, schedule, bookings }
  let cred = null;
  let tab = 'overview';
  let dayPick = null;

  /** next calendar date (YYYY-MM-DD) that falls on weekday `day`, today included */
  function nextDateFor(day) {
    const d = new Date();
    d.setDate(d.getDate() + ((day - d.getDay() + 7) % 7));
    return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
  }

  const bookingFor = (slotId, date) => (data.bookings || [])
    .find(b => b.slot_id === slotId && b.date === date && ['pending', 'approved'].includes(b.status));

  function mySlots() {
    const id = data.student.id;
    return data.schedule.filter(s => (s.students || []).some(x => x.id === id));
  }

  /** next occurrence of one of my slots */
  function nextClass() {
    const mine = mySlots();
    if (!mine.length) return null;
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    let best = null;
    mine.forEach(s => {
      const [h, m] = s.time.split(':').map(Number);
      let delta = (s.day - now.getDay() + 7) % 7;
      if (delta === 0 && h * 60 + m <= nowMin) delta = 7;
      const score = delta * 1440 + h * 60 + m;
      if (!best || score < best.score) best = { slot: s, score, delta };
    });
    return best;
  }

  function heroCard() {
    const s = data.student;
    const done = Math.min(s.done, s.total_classes);
    const left = Math.max(0, s.total_classes - s.done);
    const pct = s.total_classes ? done / s.total_classes : 0;
    const dl = U.daysLeft(s.end_date);

    return '<section class="glass hero view">' +
      '<div class="hero-grid">' +
        U.ring(pct, '<b>' + n(done) + '<span class="muted" style="font-size:.95rem">/' + n(s.total_classes) + '</span></b>' +
                    '<span class="tiny dim" style="letter-spacing:.1em;text-transform:uppercase">' + U.esc(t('classesDone')) + '</span>') +
        '<div class="grow stack" style="gap:10px">' +
          '<div><div class="upper">' + U.esc(t('welcomeBack')) + '</div>' +
          '<h1 class="display" style="font-size:1.75rem;line-height:1.1">' + U.esc(s.name) + '</h1></div>' +
          '<div class="row wrap">' + U.courseBadge(s.course) +
            (s.tags || []).map(x => '<span class="badge tag">' + U.esc(x) + '</span>').join('') +
            (s.active === false ? '<span class="badge warn">' + U.esc(t('inactive')) + '</span>' : '') +
          '</div>' +
          '<div class="small muted">' + (left === 0
              ? U.esc(t('courseDone'))
              : '<b style="color:var(--txt)">' + n(left) + '</b> ' + U.esc(t('keepGoing'))) + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="stat-grid" style="margin-top:18px">' +
        '<div class="stat"><b>' + n(done) + '</b><span>' + U.esc(t('completed')) + '</span></div>' +
        '<div class="stat"><b>' + n(left) + '</b><span>' + U.esc(t('remaining')) + '</span></div>' +
        '<div class="stat"><b>' + (dl == null ? '—' : n(Math.max(0, dl))) + '</b><span>' + U.esc(t('validTill')) + '</span></div>' +
      '</div></section>';
  }

  function nextCard() {
    const nx = nextClass();
    if (!nx) return '<section class="glass card view"><div class="upper">' + U.esc(t('nextClass')) + '</div>' +
      '<div class="muted small" style="margin-top:6px">' + U.esc(t('noNextClass')) + '</div></section>';
    const s = nx.slot;
    const mates = (s.students || []).filter(x => x.id !== data.student.id);
    return '<section class="glass card view">' +
      '<div class="spread"><div class="upper">' + U.esc(t('nextClass')) + '</div>' +
      '<span class="badge ok">' + U.esc(nx.delta === 0 ? t('today') : t(U.DAY_KEYS[s.day])) + '</span></div>' +
      '<div class="row" style="margin-top:10px;gap:14px">' +
        '<div class="avatar" style="width:46px;height:46px">' + U.ICON.clock.replace('<svg', '<svg style="width:22px;height:22px;stroke:#0b0e13;fill:none;stroke-width:1.8"') + '</div>' +
        '<div class="grow"><div class="slot-time">' + U.esc(U.time12(s.time)) + '</div>' +
        '<div class="tiny dim">' + U.esc(t(U.DAY_KEYS[s.day])) + ' · ' +
        (mates.length ? U.esc(mates.map(m => m.name).join(', ')) : U.esc(t('empty'))) + '</div></div>' +
      '</div></section>';
  }

  function slotRow(s, date) {
    const cap = s.capacity || 3;
    const list = s.students || [];
    const mine = list.some(x => x.id === data.student.id);
    const booked = bookingFor(s.id, date);
    const used = list.length + ((data.bookings || [])
      .filter(b => b.slot_id === s.id && b.date === date && ['pending', 'approved'].includes(b.status)).length);
    let seats = '';
    for (let i = 0; i < cap; i++) seats += '<span class="seat' + (i < used ? ' on' : '') + '"></span>';

    const action = mine ? ''
      : booked ? '<button class="btn sm ghost" data-cancelb="' + U.esc(booked.id) + '">' +
                 U.esc(t('cancelBooking')) + '</button>'
      : used >= cap ? ''
      : '<button class="btn sm primary" data-book="' + U.esc(s.id) + '" data-date="' + U.esc(date) + '" ' +
        'data-time="' + U.esc(s.time) + '">' + U.esc(t('book')) + '</button>';

    return '<div class="slot' + (mine || booked ? ' mine' : '') + '">' +
      '<div class="spread"><div class="slot-time">' + U.esc(U.time12(s.time)) + '</div>' +
      '<div class="row" style="gap:8px"><span class="tiny dim">' +
        (used >= cap ? U.esc(t('full')) : n(cap - used) + ' ' + U.esc(t('seatsLeft'))) +
      '</span><span class="seats">' + seats + '</span></div></div>' +
      '<div class="riders">' + (list.length
        ? list.map(x => '<span class="rider"><span class="dot">' + U.esc(U.initials(x.name)) + '</span>' +
            U.esc(x.name) + '</span>').join('')
        : '<span class="rider empty">' + U.esc(t('open')) + '</span>') +
        (booked ? '<span class="badge ' + (booked.status === 'approved' ? 'ok' : '') + '">' +
          U.esc(t(booked.status)) + '</span>' : '') +
      '</div>' +
      (action ? '<div class="row" style="margin-top:10px;justify-content:flex-end">' + action + '</div>' : '') +
      '</div>';
  }

  function scheduleView() {
    const days = [...new Set(data.schedule.map(s => s.day))]
      .sort((a, b) => AF_CONFIG.mainDays.indexOf(a) - AF_CONFIG.mainDays.indexOf(b));
    if (!days.length) return emptyBox(t('noNextClass'));
    if (dayPick == null || !days.includes(dayPick)) {
      const today = new Date().getDay();
      dayPick = days.includes(today) ? today : days[0];
    }
    const date = nextDateFor(dayPick);
    const chips = days.map(d =>
      '<button class="chip' + (d === dayPick ? ' on' : '') + '" data-day="' + d + '">' + U.esc(t(U.DAY_KEYS[d])) + '</button>').join('');
    const slots = data.schedule.filter(s => s.day === dayPick).map(s => slotRow(s, date)).join('');
    return '<section class="view stack">' +
      '<div class="chips">' + chips + '</div>' +
      '<div class="spread" style="padding:0 4px"><span class="upper">' + U.esc(t('schedule')) + '</span>' +
      '<span class="tiny dim">' + U.esc(U.dateLabel(date)) + '</span></div>' +
      '<div class="stack" style="gap:10px">' + slots + '</div></section>';
  }

  function bookingsCard() {
    const b = (data.bookings || []).filter(x => x.date >= U.todayISO());
    if (!b.length) return '';
    return '<section class="glass card view"><div class="upper" style="margin-bottom:10px">' + U.esc(t('myBookings')) + '</div>' +
      '<div class="list">' + b.map(x =>
        '<div class="item"><div class="avatar' + (x.status === 'approved' ? '' : ' dim') + '" style="font-size:.7rem">' +
        U.esc(t(U.DAY_KEYS[x.day]).slice(0, 3)) + '</div>' +
        '<div class="grow"><div style="font-weight:600">' + U.esc(U.time12(x.time)) + '</div>' +
        '<div class="tiny dim">' + U.esc(U.dateLabel(x.date)) + '</div></div>' +
        '<span class="badge ' + (x.status === 'approved' ? 'ok' : '') + '">' + U.esc(t(x.status)) + '</span>' +
        '<button class="btn sm ghost" data-cancelb="' + U.esc(x.id) + '">✕</button></div>').join('') +
      '</div></section>';
  }

  function historyView() {
    const a = data.attendance || [];
    if (!a.length) return emptyBox(t('noHistory'));
    return '<section class="view stack"><div class="upper">' + U.esc(t('history')) + ' · ' + n(a.length) + '</div>' +
      '<div class="list">' + a.map((r, i) => {
        const cls = r.status === 'absent' ? 'warn' : r.status === 'makeup' ? 'tag' : 'ok';
        return '<div class="item"><div class="avatar' + (r.status === 'absent' ? ' dim' : '') + '">' + n(a.length - i) + '</div>' +
          '<div class="grow"><div style="font-weight:600">' + U.esc(U.dateLabel(r.date)) + '</div>' +
          '<div class="tiny dim">' + U.esc(r.time ? U.time12(r.time) : '') + (r.note ? ' · ' + U.esc(r.note) : '') + '</div></div>' +
          '<span class="badge ' + cls + '">' + U.esc(t(r.status)) + '</span></div>';
      }).join('') + '</div></section>';
  }

  function emptyBox(msg) {
    return '<div class="glass card empty view">' + UI.ICON.empty + '<div>' + U.esc(msg) + '</div></div>';
  }

  function nav() {
    const items = [['overview', 'home'], ['schedule', 'calendar'], ['history', 'clock']];
    return '<nav class="nav">' + items.map(([k, ic]) =>
      '<button data-tab="' + k + '" class="' + (tab === k ? 'on' : '') + '">' + U.ICON[ic] +
      '<span>' + U.esc(t(k)) + '</span></button>').join('') + '</nav>';
  }

  function render() {
    const body =
      tab === 'overview' ? '<div class="stack">' + heroCard() + nextCard() + bookingsCard() + mySlotsCard() + '</div>' :
      tab === 'schedule' ? scheduleView() : historyView();

    U.app().innerHTML =
      U.topbar('<div class="row">' + U.langBtn() +
        '<button class="btn sm ghost" id="logout">' + U.esc(t('logout')) + '</button></div>') +
      (API.LIVE ? '' : '<div class="banner" style="margin-bottom:12px">' + U.esc(t('demoBanner')) + '</div>') +
      body + nav();

    U.animateRings();
    bind();
  }

  function mySlotsCard() {
    const mine = mySlots();
    if (!mine.length) return '';
    const byDay = {};
    mine.forEach(s => (byDay[s.day] = byDay[s.day] || []).push(s));
    const order = Object.keys(byDay).map(Number)
      .sort((a, b) => AF_CONFIG.mainDays.indexOf(a) - AF_CONFIG.mainDays.indexOf(b));
    return '<section class="glass card view"><div class="upper" style="margin-bottom:10px">' + U.esc(t('mySlots')) + '</div>' +
      '<div class="list">' + order.map(d =>
        '<div class="item"><div class="avatar dim" style="font-size:.7rem">' + U.esc(t(U.DAY_KEYS[d]).slice(0, 3)) + '</div>' +
        '<div class="grow"><div style="font-weight:600">' + U.esc(t(U.DAY_KEYS[d])) + '</div>' +
        '<div class="tiny dim">' + byDay[d].map(s => U.esc(U.time12(s.time))).join(' · ') + '</div></div>' +
        '</div>').join('') + '</div></section>';
  }

  async function refresh() {
    if (!cred) return;
    try {
      const fresh = await API.studentRefresh(cred);
      if (fresh && fresh.ok) { data = fresh; API.cache.put('student', fresh); render(); }
    } catch (e) { U.toast(t('netErr'), 'err'); }
  }

  function doBook(btn) {
    if (!cred) return U.toast(t('netErr'), 'err');
    const slot = btn.dataset.book, date = btn.dataset.date, time = btn.dataset.time;
    U.modal(
      '<h2 style="margin-bottom:6px">' + U.esc(t('bookConfirm')) + '</h2>' +
      '<p class="muted small" style="margin-bottom:18px">' + U.esc(U.dateLabel(date)) + ' · ' + U.esc(U.time12(time)) + '</p>' +
      '<div class="row"><button class="btn ghost grow" data-close>' + U.esc(t('cancel')) + '</button>' +
      '<button class="btn primary grow" id="yes">' + U.esc(t('book')) + '</button></div>',
      (box) => box.querySelector('#yes').addEventListener('click', async () => {
        const res = await API.book(cred, slot, date);
        U.closeModal();
        if (!res || !res.ok) {
          const msg = res && res.error === 'full' ? t('slotFull', { n: n(res.capacity || 3) })
            : res && res.error === 'exists' ? t('alreadyBooked')
            : res && res.error === 'past' ? t('pastDate') : t('netErr');
          return U.toast(msg, 'err');
        }
        U.toast(t('bookSent'), 'ok');
        await refresh();
      }));
  }

  function bind() {
    document.querySelectorAll('[data-tab]').forEach(b =>
      b.addEventListener('click', () => { tab = b.dataset.tab; render(); }));
    document.querySelectorAll('[data-day]').forEach(b =>
      b.addEventListener('click', () => { dayPick = +b.dataset.day; render(); }));
    document.querySelectorAll('[data-book]').forEach(b =>
      b.addEventListener('click', () => doBook(b)));
    document.querySelectorAll('[data-cancelb]').forEach(b =>
      b.addEventListener('click', async () => {
        await API.cancelBooking(cred, b.dataset.cancelb);
        U.toast(t('cancelled'));
        await refresh();
      }));
    const lb = document.getElementById('langBtn');
    if (lb) lb.addEventListener('click', () => { I18N.toggle(); render(); });
    const lo = document.getElementById('logout');
    if (lo) lo.addEventListener('click', () => { API.session.clear(); location.reload(); });
  }

  window.STUDENT = {
    async start(payload, credentials) {
      data = payload;
      cred = credentials || API.session.student;
      tab = 'overview';
      render();
      refresh();   // silent re-fetch so counts stay current
    }
  };
})();
