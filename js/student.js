/* Al Fursan — rider portal */
(function () {
  const U = UI;
  let D = null;                 // student_session payload
  let tab = 'overview';
  let pickedDate = null;
  let lastSync = 0;

  const S = () => (D && D.settings) || {};
  const cur = () => S().currency || 'BDT';
  const seatOf = (slotId, date) => (D.seats && D.seats[slotId + '|' + date]) || { taken: 0, pending: 0 };
  const isClosed = (slotId, date) => (D.closures || []).some(c =>
    c.date === date && (!c.slot_id || c.slot_id === slotId));
  const closureOf = (slotId, date) => (D.closures || []).find(c =>
    c.date === date && (!c.slot_id || c.slot_id === slotId));

  const mySlots = () => (D.schedule || []).filter(s =>
    (s.students || []).some(x => x.id === D.student.id));

  const activeBookings = () => (D.bookings || [])
    .filter(b => ['pending', 'approved', 'waitlist'].includes(b.status) && b.date >= U.todayISO())
    .sort((a, b) => a.date.localeCompare(b.date));

  const bookingFor = (slotId, date) => (D.bookings || []).find(b =>
    b.slot_id === slotId && b.date === date && ['pending', 'approved', 'waitlist'].includes(b.status));

  const remaining = () => {
    const s = D.student;
    const upcoming = activeBookings().filter(b => b.status !== 'waitlist').length;
    return Math.max(0, s.total_classes - s.done - upcoming);
  };

  /* -------------------------------------------------------------- next up --*/
  function nextClass() {
    const out = [];
    activeBookings().filter(b => b.status === 'approved').forEach(b =>
      out.push({ date: b.date, time: b.time, slot_id: b.slot_id, booked: true }));
    mySlots().forEach(s => {
      for (let i = 0; i < 14; i++) {
        const d = U.addDaysISO(U.todayISO(), i);
        if (U.dowOf(d) !== s.day) continue;
        if (isClosed(s.id, d)) continue;
        const mins = U.minutesUntil(d, s.time);
        if (mins < -60) continue;
        out.push({ date: d, time: s.time, slot_id: s.id, booked: false });
        break;
      }
    });
    out.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    const first = out.find(x => U.minutesUntil(x.date, x.time) > -60);
    if (!first) return null;
    const slot = (D.schedule || []).find(s => s.id === first.slot_id) || {};
    return Object.assign({}, first, { coach: slot.coach, horse: slot.horse, day: slot.day });
  }

  function countdownText(date, time) {
    const mins = U.minutesUntil(date, time);
    if (mins == null) return '';
    if (mins < 0) return '';
    if (mins < 60 * 12) return t('countdown', { h: n(Math.floor(mins / 60)), m: n(mins % 60) });
    return U.relDate(date);
  }

  /* ------------------------------------------------------------- sections --*/
  function notificationsStrip() {
    const un = (D.notifications || []).filter(x => !x.read);
    if (!un.length) return '';
    return '<section class="panel view" style="border-color:var(--accent)">' +
      '<div class="spread" style="margin-bottom:10px"><span class="upper">' + U.esc(t('notifications')) + '</span>' +
      '<button class="btn sm ghost" id="readAll">' + U.esc(t('done')) + '</button></div>' +
      '<div class="list">' + un.slice(0, 5).map(x =>
        '<div class="item"><span class="avatar sm ' + (x.kind === 'approved' ? 'ok' : 'muted') + '">' +
        (x.kind === 'approved' ? '✓' : '!') + '</span>' +
        '<div class="grow"><div style="font-weight:650">' + U.esc(x.title) + '</div>' +
        '<div class="tiny dim">' + U.esc(x.body || '') + '</div></div></div>').join('') +
      '</div></section>';
  }

  function heroCard() {
    const s = D.student;
    const doneCycle = Math.min(s.cycle_done != null ? s.cycle_done : s.done, s.total_classes);
    const left = remaining();
    const pct = s.total_classes ? doneCycle / s.total_classes : 0;
    const dl = U.daysUntil(s.end_date);
    const expired = dl != null && dl < 0;

    const validTile = expired
      ? '<div class="stat bad"><b>' + U.esc(t('expired')) + '</b><span>' + U.esc(U.dateLabel(s.end_date)) + '</span></div>'
      : dl != null && dl <= 7
        ? '<div class="stat warn"><b>' + n(dl) + '</b><span>' + U.esc(t('validTill')) + ' · ' + U.esc(U.dateLabel(s.end_date)) + '</span></div>'
        : '<div class="stat"><b>' + (dl == null ? '—' : n(dl)) + '</b><span>' + U.esc(s.end_date ? U.dateLabel(s.end_date) : t('validTill')) + '</span></div>';

    return '<section class="panel view">' +
      '<div class="hero">' +
        U.ring(pct, '<b>' + n(doneCycle) + '<span class="dim" style="font-size:.95rem">/' + n(s.total_classes) + '</span></b>' +
          '<span class="tiny dim">' + U.esc(t('thisMonth')) + '</span>') +
        '<div class="grow stack sm">' +
          '<div><div class="upper">' + U.esc(t('welcomeBack')) + '</div>' +
          '<h1 class="display" style="font-size:1.7rem;line-height:1.15">' + U.esc(s.name) + '</h1></div>' +
          '<div class="row wrap">' + U.courseBadge(s.course) +
            (s.tags || []).map(x => U.badge(x, 'plain')).join('') + '</div>' +
          '<p class="small muted">' + (left === 0 ? U.esc(t('courseDone'))
            : left === 1 ? U.esc(t('oneClassToGo')) : U.esc(t('classesToGo', { n: n(left) }))) + '</p>' +
        '</div>' +
      '</div>' +
      '<div class="grid-3" style="margin-top:16px">' +
        '<div class="stat"><b>' + n(s.done) + '</b><span>' + U.esc(t('completed')) + '</span></div>' +
        '<div class="stat"><b>' + n(left) + '</b><span>' + U.esc(t('remaining')) + '</span></div>' +
        validTile +
      '</div>' +
      (expired || (dl != null && dl <= 7)
        ? '<div class="banner warn" style="margin-top:12px">' + U.icon('alert') + U.esc(t('renewNow')) + '</div>' : '') +
      (s.unpaid > 0
        ? '<div class="banner warn" style="margin-top:10px">' + U.icon('cash') +
          U.esc(t('unpaid')) + ': ' + U.esc(U.money(s.unpaid, cur())) + '</div>' : '') +
      '</section>';
  }

  function nextCard() {
    const nx = nextClass();
    if (!nx) {
      return '<section class="panel view"><div class="upper">' + U.esc(t('nextClass')) + '</div>' +
        '<p class="muted small" style="margin:8px 0 12px">' + U.esc(t('noNextClass')) + '</p>' +
        '<button class="btn primary" data-go="book">' + U.esc(t('bookFirst')) + '</button></section>';
    }
    const extras = [nx.coach ? t('coach') + ': ' + nx.coach : '', nx.horse ? t('horse') + ': ' + nx.horse : '']
      .filter(Boolean).join(' · ');
    return '<section class="panel view">' +
      '<div class="spread"><span class="upper">' + U.esc(t('nextClass')) + '</span>' +
      U.badge(U.relDate(nx.date), 'info') + '</div>' +
      '<div class="row" style="margin-top:12px;gap:14px">' +
        '<div class="avatar" style="width:46px;height:46px">' + U.icon('clock') + '</div>' +
        '<div class="grow"><div class="slot-time">' + U.esc(U.time12(nx.time)) + '</div>' +
        '<div class="tiny dim">' + U.esc(U.dateFull(nx.date)) +
          (countdownText(nx.date, nx.time) ? ' · ' + U.esc(countdownText(nx.date, nx.time)) : '') +
          (extras ? ' · ' + U.esc(extras) : '') + '</div></div>' +
      '</div>' +
      '<button class="btn ghost block" style="margin-top:12px" data-absent="' + U.esc(nx.slot_id) +
        '" data-date="' + U.esc(nx.date) + '">' + U.esc(t('cantAttend')) + '</button>' +
      '<p class="tiny dim" style="margin-top:6px">' + U.esc(t('cantAttendHint')) + '</p>' +
      '</section>';
  }

  function bookingsCard() {
    const list = activeBookings();
    if (!list.length) return '';
    return '<section class="panel view"><div class="upper" style="margin-bottom:10px">' +
      U.esc(t('myBookings')) + '</div><div class="list">' +
      list.map(b =>
        '<div class="item"><span class="avatar sm muted">' + U.esc(U.dayName(b.day, true).slice(0, 2)) + '</span>' +
        '<div class="grow"><div style="font-weight:650">' + U.esc(U.time12(b.time)) + ' · ' + U.esc(U.dateLabel(b.date)) + '</div>' +
        '<div class="tiny dim">' + U.esc(b.status === 'pending' ? t('pendingHint', { n: n(S().reply_hours || 24) })
          : b.status === 'waitlist' ? t('waitlist') : U.dateFull(b.date)) + '</div></div>' +
        U.badge(t(b.status), U.statusKind(b.status)) +
        '<button class="btn icon sm ghost" data-cancel="' + U.esc(b.id) + '" aria-label="' +
        U.esc(t('cancelBooking')) + '">' + U.icon('x') + '</button></div>').join('') +
      '</div></section>';
  }

  function regularCard() {
    const mine = mySlots();
    if (!mine.length) return '';
    const byDay = {};
    mine.forEach(s => (byDay[s.day] = byDay[s.day] || []).push(s));
    return '<section class="panel view"><div class="upper" style="margin-bottom:10px">' +
      U.esc(t('mySlots')) + '</div><div class="list">' +
      Object.keys(byDay).map(Number).sort().map(d =>
        '<div class="item"><span class="avatar sm muted">' + U.esc(U.dayName(d, true).slice(0, 2)) + '</span>' +
        '<div class="grow"><div style="font-weight:650">' + U.esc(U.dayName(d)) + '</div>' +
        '<div class="tiny dim">' + byDay[d].map(s => U.esc(U.time12(s.time))).join(' · ') + '</div></div></div>').join('') +
      '</div></section>';
  }

  /* ----------------------------------------------------------- book view --*/
  function calendar() {
    const today = U.todayISO();
    const start = U.addDaysISO(today, -U.dowOf(today));   // Sunday of this week
    let html = '<div class="cal">';
    for (let i = 0; i < 7; i++) html += '<div class="dow">' + U.esc(U.dayName(i, true).slice(0, 2)) + '</div>';
    for (let i = 0; i < 35; i++) {
      const d = U.addDaysISO(start, i);
      const dow = U.dowOf(d);
      const slots = (D.schedule || []).filter(s => s.day === dow);
      const past = d < today;
      const has = slots.length > 0 && !past;
      let free = 0, closedAll = slots.length > 0;
      slots.forEach(s => {
        if (isClosed(s.id, d)) return;
        closedAll = false;
        const seat = seatOf(s.id, d);
        if (seat.taken < (s.capacity || 3)) free++;
      });
      const label = U.parseISO(d).getDate();
      html += '<button type="button" data-date="' + d + '" ' + (has ? '' : 'disabled ') +
        'aria-pressed="' + (d === pickedDate) + '" aria-label="' + U.esc(U.dateFull(d)) + '">' +
        '<span>' + n(label) + '</span>' +
        (has ? '<span class="pips"><span class="pip' + (free && !closedAll ? '' : ' none') + '"></span></span>' : '') +
        '</button>';
    }
    return html + '</div>';
  }

  function slotCard(s, date) {
    const cap = s.capacity || 3;
    const seat = seatOf(s.id, date);
    const mine = (s.students || []).some(x => x.id === D.student.id);
    const booked = bookingFor(s.id, date);
    const closure = closureOf(s.id, date);
    let seats = '';
    for (let i = 0; i < cap; i++)
      seats += '<span class="seat' + (i < seat.taken ? ' on' : (i < seat.taken + seat.pending ? ' wait' : '')) + '"></span>';

    const freeSeats = cap - seat.taken;
    let action = '';
    if (closure) action = '';
    else if (mine) action = U.badge(t('youAreIn'), 'ok');
    else if (booked) action = '<button class="btn sm ghost" data-cancel="' + U.esc(booked.id) + '">' +
      U.esc(t('cancelBooking')) + '</button>';
    else if (freeSeats > 0) action = '<button class="btn sm primary" data-book="' + U.esc(s.id) +
      '" data-date="' + U.esc(date) + '">' + U.esc(t('book')) + '</button>';
    else action = '<button class="btn sm ghost" data-book="' + U.esc(s.id) + '" data-date="' + U.esc(date) +
      '" data-wait="1">' + U.esc(t('joinWaitlist')) + '</button>';

    const meta = [s.coach ? t('coach') + ': ' + s.coach : '', s.horse ? t('horse') + ': ' + s.horse : '']
      .filter(Boolean).join(' · ');

    return '<div class="slot' + (mine || booked ? ' mine' : '') + (closure ? ' closed' : '') + '">' +
      '<div class="spread"><div><div class="slot-time">' + U.esc(U.time12(s.time)) + '</div>' +
      (meta ? '<div class="tiny dim">' + U.esc(meta) + '</div>' : '') + '</div>' +
      '<span class="seats" aria-hidden="true">' + seats + '</span></div>' +
      '<div class="row wrap" style="margin-top:10px;gap:8px">' +
        (closure
          ? U.badge(closure.reason ? t('closedReason', { r: closure.reason }) : t('classClosed'), 'bad')
          : U.badge(t('confirmedSeats', { n: n(seat.taken) }), seat.taken >= cap ? 'bad' : 'ok') +
            (seat.pending ? U.badge(t('waitingSeats', { n: n(seat.pending) }), 'wait') : '') +
            (freeSeats > 0 ? U.badge(freeSeats === 1 ? t('oneSeatLeft') : t('seatsLeft', { n: n(freeSeats) }), 'plain')
                           : U.badge(t('full'), 'bad'))) +
        (booked ? U.badge(t(booked.status), U.statusKind(booked.status)) : '') +
        '<span class="grow"></span>' + action +
      '</div></div>';
  }

  function bookView() {
    const today = U.todayISO();
    if (!pickedDate || pickedDate < today) {
      const first = [];
      for (let i = 0; i < 14; i++) {
        const d = U.addDaysISO(today, i);
        if ((D.schedule || []).some(s => s.day === U.dowOf(d))) { first.push(d); break; }
      }
      pickedDate = first[0] || today;
    }
    const slots = (D.schedule || []).filter(s => s.day === U.dowOf(pickedDate))
      .sort((a, b) => a.time.localeCompare(b.time));
    const left = remaining();
    const expired = U.daysUntil(D.student.end_date) < 0;

    return '<section class="view stack">' +
      (expired ? '<div class="banner bad">' + U.icon('alert') + U.esc(t('courseExpired')) + '</div>'
        : left === 0 ? '<div class="banner warn">' + U.icon('alert') + U.esc(t('noBalance')) + '</div>' : '') +
      '<div class="panel"><div class="upper" style="margin-bottom:10px">' + U.esc(t('pickDate')) + '</div>' +
      calendar() + '</div>' +
      '<div class="spread"><h2>' + U.esc(U.dateFull(pickedDate)) + '</h2></div>' +
      (slots.length ? '<div class="stack sm">' + slots.map(s => slotCard(s, pickedDate)).join('') + '</div>'
                    : U.empty(t('nothingOn'))) +
      '</section>';
  }

  /* -------------------------------------------------------- history view --*/
  function historyView() {
    const a = (D.attendance || []).slice();
    const past = (D.bookings || []).filter(b => ['declined', 'cancelled'].includes(b.status));
    if (!a.length && !past.length) return U.empty(t('noHistory'),
      '<button class="btn primary" data-go="book">' + U.esc(t('bookFirst')) + '</button>');

    const byMonth = {};
    a.forEach(r => { const k = r.date.slice(0, 7); (byMonth[k] = byMonth[k] || []).push(r); });

    const months = Object.keys(byMonth).sort().reverse().map(k => {
      const rows = byMonth[k];
      const label = t('months')[+k.slice(5, 7) - 1] + ' ' + n(k.slice(0, 4));
      const present = rows.filter(r => r.status === 'present').length;
      return '<section class="panel view">' +
        '<div class="spread" style="margin-bottom:10px"><h3>' + U.esc(label) + '</h3>' +
        U.badge(n(present) + ' ' + t('present'), 'ok') + '</div>' +
        '<div class="list">' + rows.map(r =>
          '<div class="item"><span class="avatar sm ' + (r.status === 'present' ? 'ok' : 'muted') + '">' +
          (r.status === 'present' ? '✓' : r.status === 'absent' ? '–' : '↻') + '</span>' +
          '<div class="grow"><div style="font-weight:600">' + U.esc(U.dateFull(r.date)) + '</div>' +
          '<div class="tiny dim">' + U.esc(r.time ? U.time12(r.time) : '') + '</div></div>' +
          U.badge(t(r.status), U.statusKind(r.status)) + '</div>').join('') +
        '</div></section>';
    }).join('');

    const pastHtml = past.length
      ? '<section class="panel view"><div class="upper" style="margin-bottom:10px">' +
        U.esc(t('bookingHistory')) + '</div><div class="list">' + past.slice(0, 20).map(b =>
          '<div class="item"><span class="avatar sm muted">' + U.icon('x') + '</span>' +
          '<div class="grow"><div style="font-weight:600">' + U.esc(U.dateLabel(b.date)) + ' · ' +
          U.esc(U.time12(b.time)) + '</div>' +
          (b.reason ? '<div class="tiny dim">' + U.esc(b.reason) + '</div>' : '') + '</div>' +
          U.badge(t(b.status), U.statusKind(b.status)) + '</div>').join('') + '</div></section>'
      : '';

    return '<div class="stack">' + months + pastHtml + '</div>';
  }

  /* -------------------------------------------------------- profile view --*/
  function profileView() {
    const s = D.student;
    const pays = D.payments || [];
    return '<div class="stack view">' +
      '<section class="panel"><div class="upper" style="margin-bottom:12px">' + U.esc(t('myProfile')) + '</div>' +
        '<div class="stack">' +
          U.field(t('name'), '<input class="input" value="' + U.esc(s.name) + '" disabled>') +
          U.field(t('phone'), '<input class="input" id="p_phone" inputmode="tel" value="' + U.esc(s.phone || '') + '">') +
          U.field(t('newPin'), '<input class="input" id="p_pin" inputmode="numeric" maxlength="4" placeholder="••••">',
            t('changePin')) +
          '<button class="btn primary" id="saveProfile">' + U.esc(t('save')) + '</button>' +
        '</div></section>' +

      '<section class="panel"><div class="spread" style="margin-bottom:10px">' +
        '<span class="upper">' + U.esc(t('fees')) + '</span>' +
        (s.unpaid > 0 ? U.badge(t('due') + ' ' + U.money(s.unpaid, cur()), 'wait') : '') + '</div>' +
        (pays.length ? '<div class="list">' + pays.map(p =>
          '<div class="item"><span class="avatar sm ' + (p.paid_on ? 'ok' : 'muted') + '">' + U.icon('cash') + '</span>' +
          '<div class="grow"><div style="font-weight:650">' + U.esc(U.money(p.amount, cur())) + '</div>' +
          '<div class="tiny dim">' + U.esc(p.paid_on ? t('paidOn', { d: U.dateLabel(p.paid_on) })
            : p.due_date ? t('dueOn', { d: U.dateLabel(p.due_date) }) : '') + '</div></div>' +
          U.badge(p.paid_on ? t('paid') : t('unpaid'), p.paid_on ? 'ok' : 'wait') + '</div>').join('') + '</div>'
          : '<p class="small dim">' + U.esc(t('noFees')) + '</p>') +
      '</section>' +

      settingsPanel() +
      '</div>';
  }

  function settingsPanel() {
    const th = U.theme.get();
    const phone = S().contact_phone, wa = S().whatsapp;
    return '<section class="panel stack">' +
      '<div><div class="upper" style="margin-bottom:8px">' + U.esc(t('theme')) + '</div>' +
      '<div class="segmented">' + ['system', 'light', 'dark'].map(v =>
        '<button data-uitheme="' + v + '" aria-pressed="' + (th === v) + '">' + U.esc(t(v)) + '</button>').join('') +
      '</div></div>' +
      '<div><div class="upper" style="margin-bottom:8px">' + U.esc(t('language')) + '</div>' +
      '<div class="segmented">' +
        '<button data-uilang="en" aria-pressed="' + (I18N.lang === 'en') + '">English</button>' +
        '<button data-uilang="bn" aria-pressed="' + (I18N.lang === 'bn') + '">বাংলা</button>' +
      '</div></div>' +
      (phone ? '<a class="btn ghost block" href="tel:' + U.esc(phone) + '">' + U.esc(t('callAcademy')) + '</a>' : '') +
      (wa ? '<a class="btn ghost block" target="_blank" rel="noopener" href="https://wa.me/' +
        U.esc(String(wa).replace(/[^0-9]/g, '')) + '">' + U.esc(t('whatsappAcademy')) + '</a>' : '') +
      '<button class="btn ghost block" id="installBtn">' + U.esc(t('installApp')) + '</button>' +
      '<button class="btn ghost block" id="logout">' + U.esc(t('logout')) + '</button>' +
      '<p class="tiny dim center">' + U.esc(S().academy_name || 'Al Fursan') + ' · v' +
        U.esc((window.AF_CONFIG && AF_CONFIG.version) || '2.0.0') + '</p>' +
      '</section>';
  }

  /* ---------------------------------------------------------------- shell --*/
  function nav() {
    const items = [['overview', 'home'], ['book', 'calendar'], ['history', 'clock'], ['profile', 'user']];
    const el = document.getElementById('nav');
    el.hidden = false;
    el.innerHTML = items.map(([k, ic]) =>
      '<button data-tab="' + k + '" ' + (tab === k ? 'aria-current="page"' : '') + '>' +
      U.icon(ic) + '<span>' + U.esc(t(k)) + '</span></button>').join('');
  }

  function topbar() {
    const unread = (D.notifications || []).filter(x => !x.read).length;
    return '<header class="topbar">' +
      '<div class="brand grow">' + U.logo('') +
      '<div><div class="brand-name">' + U.esc(t('academy')) + '</div>' +
      '<div class="brand-sub">' + U.esc(t('academySub')) + '</div></div></div>' +
      (unread ? '<button class="btn icon ghost" id="bell" style="position:relative" aria-label="' +
        U.esc(t('notifications')) + '">' + U.icon('bell') +
        '<span class="dot-badge">' + n(unread) + '</span></button>' : '') +
      '<button class="btn sm ghost" id="langBtn">' + (I18N.lang === 'en' ? 'বাংলা' : 'EN') + '</button>' +
      '</header>';
  }

  function render() {
    const body =
      tab === 'book' ? bookView() :
      tab === 'history' ? historyView() :
      tab === 'profile' ? profileView() :
      '<div class="stack">' + notificationsStrip() + heroCard() + nextCard() + bookingsCard() + regularCard() + '</div>';

    U.paint(topbar() +
      (API.online ? '' : '<div class="banner warn" style="margin-bottom:12px">' + U.icon('wifi') + U.esc(t('offline')) + '</div>') +
      body, 'student:' + tab);
    nav();
    U.animateRings();
    bind();
  }

  /* --------------------------------------------------------------- actions --*/
  async function refresh(silent) {
    try {
      const fresh = await API.studentSession();
      if (fresh && fresh.ok) {
        D = fresh; lastSync = Date.now();
        API.cache.put('student', fresh);
        U.setTZ(S().timezone);
        render();
      } else if (fresh && fresh.error === 'auth') {
        API.session.clear();
        location.hash = '';
        location.reload();
      }
    } catch (e) {
      if (!silent) U.toast(t('netErr'), 'err');
    }
  }

  function bookErr(res) {
    const e = res && res.error;
    return e === 'full' ? t('full')
      : e === 'exists' ? t('alreadyBooked')
      : e === 'past' ? t('pastDate')
      : e === 'nobalance' ? t('noBalance')
      : e === 'expired' ? t('courseExpired')
      : e === 'closed' ? t('classClosed')
      : t('netErr');
  }

  function doBook(slotId, date, waitlist) {
    const slot = (D.schedule || []).find(s => s.id === slotId) || {};
    U.dialog({
      title: waitlist ? t('joinWaitlist') : t('bookConfirm'),
      body: '<p class="muted">' + U.esc(U.dateFull(date)) + ' · ' + U.esc(U.time12(slot.time)) + '</p>' +
        '<p class="tiny dim">' + U.esc(t('pendingHint', { n: n(S().reply_hours || 24) })) + '</p>',
      actions: '<button class="btn ghost grow" data-close>' + U.esc(t('cancel')) + '</button>' +
        '<button class="btn primary grow" id="go">' + U.esc(waitlist ? t('joinWaitlist') : t('book')) + '</button>',
      onMount(box) {
        box.querySelector('#go').addEventListener('click', async () => {
          const btn = box.querySelector('#go');
          btn.disabled = true;
          try {
            const res = await API.book(slotId, date);
            U.closeDialog();
            if (!res || !res.ok) return U.toast(bookErr(res), 'err');
            U.toast(res.status === 'waitlist' ? t('waitlistSent') : t('bookSent'), 'ok');
            await refresh(true);
          } catch (e) { U.closeDialog(); U.toast(t('netErr'), 'err'); }
        });
      }
    });
  }

  function doCancel(id) {
    U.dialog({
      title: t('cancelBooking'),
      body: U.field(t('cancelWhy'), '<input class="input" id="why" maxlength="120">'),
      actions: '<button class="btn ghost grow" data-close>' + U.esc(t('back')) + '</button>' +
        '<button class="btn danger grow" id="go">' + U.esc(t('cancelBooking')) + '</button>',
      onMount(box) {
        box.querySelector('#go').addEventListener('click', async () => {
          const why = box.querySelector('#why').value.trim();
          try {
            const res = await API.cancelBooking(id, why);
            U.closeDialog();
            if (!res.ok) {
              return U.toast(res.error === 'cutoff'
                ? t('cutoffBlocked', { n: n(res.hours || 3) }) : t('netErr'), 'err');
            }
            U.toast(t('cancelled'));
            await refresh(true);
          } catch (e) { U.closeDialog(); U.toast(t('netErr'), 'err'); }
        });
      }
    });
  }

  function doAbsence(slotId, date) {
    U.dialog({
      title: t('cantAttend'),
      body: '<p class="muted">' + U.esc(U.dateFull(date)) + '</p>' +
        U.field(t('cancelWhy'), '<input class="input" id="why" maxlength="120">') +
        '<p class="tiny dim">' + U.esc(t('cantAttendHint')) + '</p>',
      actions: '<button class="btn ghost grow" data-close>' + U.esc(t('cancel')) + '</button>' +
        '<button class="btn primary grow" id="go">' + U.esc(t('confirm')) + '</button>',
      onMount(box) {
        box.querySelector('#go').addEventListener('click', async () => {
          try {
            await API.absence(slotId, date, box.querySelector('#why').value.trim());
            U.closeDialog();
            U.toast(t('saved'), 'ok');
            await refresh(true);
          } catch (e) { U.closeDialog(); U.toast(t('netErr'), 'err'); }
        });
      }
    });
  }

  async function saveProfile() {
    const phone = document.getElementById('p_phone').value.trim();
    const pin = document.getElementById('p_pin').value.trim();
    if (pin && !/^\d{4}$/.test(pin)) return U.toast(t('pin4'), 'err');
    try {
      const res = await API.updateProfile(phone, pin);
      if (!res.ok) return U.toast(res.error === 'pin' ? t('pin4') : t('netErr'), 'err');
      U.toast(t('profileSaved'), 'ok');
      await refresh(true);
    } catch (e) { U.toast(t('netErr'), 'err'); }
  }

  function bind() {
    const $ = s => document.querySelector(s);
    const $$ = s => document.querySelectorAll(s);

    $$('[data-tab]').forEach(b => b.addEventListener('click', () => U.router.go('student', b.dataset.tab)));
    $$('[data-go]').forEach(b => b.addEventListener('click', () => U.router.go('student', b.dataset.go)));
    $$('.cal button[data-date]').forEach(b => b.addEventListener('click', () => {
      pickedDate = b.dataset.date; render();
    }));
    $$('[data-book]').forEach(b => b.addEventListener('click', () =>
      doBook(b.dataset.book, b.dataset.date, !!b.dataset.wait)));
    $$('[data-cancel]').forEach(b => b.addEventListener('click', () => doCancel(b.dataset.cancel)));
    $$('[data-absent]').forEach(b => b.addEventListener('click', () =>
      doAbsence(b.dataset.absent, b.dataset.date)));
    // NOTE: never bind on [data-theme]/[data-lang] — those attributes also sit on
    // <html>, which survives every render, so listeners would stack up forever.
    $$('[data-uitheme]').forEach(b => b.addEventListener('click', () => { U.theme.set(b.dataset.uitheme); render(); }));
    $$('[data-uilang]').forEach(b => b.addEventListener('click', () => { I18N.set(b.dataset.uilang); render(); }));

    const lang = $('#langBtn');
    if (lang) lang.addEventListener('click', () => { I18N.toggle(); render(); });
    const sp = $('#saveProfile'); if (sp) sp.addEventListener('click', saveProfile);
    const lo = $('#logout');
    if (lo) lo.addEventListener('click', async () => {
      await API.logout(); API.session.clear(); location.hash = ''; location.reload();
    });
    const ib = $('#installBtn'); if (ib) ib.addEventListener('click', () => window.AF_INSTALL && window.AF_INSTALL());
    const read = $('#readAll');
    if (read) read.addEventListener('click', async () => {
      await API.markNotificationsRead();
      (D.notifications || []).forEach(x => { x.read = true; });
      render();
    });
    const bell = $('#bell');
    if (bell) bell.addEventListener('click', async () => {
      await API.markNotificationsRead();
      (D.notifications || []).forEach(x => { x.read = true; });
      render();
    });
  }

  window.STUDENT = {
    async start(payload, route) {
      D = payload;
      U.setTZ(S().timezone);
      tab = route && route.tab ? route.tab : 'overview';
      render();
      refresh(true);
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && D && Date.now() - lastSync > 30000) refresh(true);
      });
      API.onConnection(on => { if (on) refresh(true); else render(); });
    },
    route(r) {
      if (!D) return;
      const wanted = r.tab || 'overview';
      if (wanted === tab) return;
      tab = wanted;
      render();
    }
  };
})();
