/* Al Fursan — public booking, no account needed. Shares the same calendar
   and slot markup as the rider portal (js/student.js), driven by the public
   bootstrap() payload (schedule + seats + closures) instead of a session. */
(function () {
  const U = UI;
  let boot = null;              // bootstrap payload
  let myBookings = [];          // this device's own guest_bookings
  let pickedDate = null;

  const S = () => (boot && boot.settings) || {};
  const isClosed = (slotId, date) => (boot.closures || []).some(c =>
    c.date === date && (!c.slot_id || c.slot_id === slotId));
  const closureOf = (slotId, date) => (boot.closures || []).find(c =>
    c.date === date && (!c.slot_id || c.slot_id === slotId));
  const seatOf = (slotId, date) => (boot.seats && boot.seats[slotId + '|' + date]) || { taken: 0, pending: 0 };
  const bookingFor = (slotId, date) => myBookings.find(b =>
    b.slot_id === slotId && b.date === date && ['pending', 'approved', 'waitlist'].includes(b.status));

  const readLS = k => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };
  const writeLS = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

  function topbar() {
    return '<header class="topbar">' +
      '<div class="brand grow">' + U.logo('') +
      '<div><div class="brand-name">' + U.esc(t('academy')) + '</div>' +
      '<div class="brand-sub">' + U.esc(t('academySub')) + '</div></div></div>' +
      '<button class="btn sm ghost" id="langBtn">' + (I18N.lang === 'en' ? 'বাংলা' : 'EN') + '</button>' +
      '</header>';
  }

  function introCard() {
    return '<section class="panel view">' +
      '<p class="small muted">' + U.esc(t('guestIntro')) + '</p>' +
      '<button class="btn sm ghost block" id="toLogin" style="margin-top:10px">' +
        U.esc(t('signInInstead')) + '</button>' +
      '</section>';
  }

  function requestsCard() {
    const list = myBookings.filter(b => ['pending', 'approved', 'waitlist'].includes(b.status))
      .sort((a, b) => a.date.localeCompare(b.date));
    if (!list.length) return '';
    return '<section class="panel view"><div class="upper" style="margin-bottom:10px">' +
      U.esc(t('myRequests')) + '</div><div class="list">' +
      list.map(b =>
        '<div class="item" data-state="' + U.esc(b.status) + '">' +
        '<span class="avatar sm muted">' + U.esc(U.dayName(b.day, true).slice(0, 2)) + '</span>' +
        '<div class="grow"><div style="font-weight:700">' + U.esc(U.time12(b.time)) + ' · ' + U.esc(U.dateLabel(b.date)) + '</div>' +
        '<div class="tiny dim">' + U.esc(b.status === 'pending' ? t('pendingHint', { n: n(S().reply_hours || 24) })
          : b.status === 'waitlist' ? t('waitlist') : U.dateFull(b.date)) + '</div></div>' +
        U.statusBadge(b.status) +
        '<button class="btn icon sm ghost" data-cancel="' + U.esc(b.id) + '" aria-label="' +
        U.esc(t('cancelBooking')) + '">' + U.icon('x') + '</button></div>').join('') +
      '</div></section>';
  }

  /* ----------------------------------------------------------- book view --*/
  function calendar() {
    const today = U.todayISO();
    const start = U.addDaysISO(today, -U.dowOf(today));
    let html = '<div class="cal">';
    for (let i = 0; i < 7; i++) html += '<div class="dow">' + U.esc(U.dayName(i, true).slice(0, 2)) + '</div>';
    for (let i = 0; i < 35; i++) {
      const d = U.addDaysISO(start, i);
      const dow = U.dowOf(d);
      const slots = (boot.schedule || []).filter(s => s.day === dow);
      const past = d < today;
      const has = slots.length > 0 && !past;
      let free = 0, closedAll = slots.length > 0;
      slots.forEach(s => {
        if (isClosed(s.id, d)) return;
        closedAll = false;
        const seat = seatOf(s.id, d);
        free += Math.max(0, (s.capacity || 3) - seat.taken - seat.pending);
      });
      const state = !has ? '' : closedAll ? 'closed' : free === 0 ? 'full' : free <= 2 ? 'tight' : 'free';
      const label = U.parseISO(d).getDate();
      html += '<button type="button" data-date="' + d + '" ' + (has ? '' : 'disabled ') +
        (state ? 'data-state="' + state + '" ' : '') + (d === today ? 'class="today" ' : '') +
        'aria-pressed="' + (d === pickedDate) + '" aria-label="' + U.esc(U.dateFull(d)) +
        (has ? ' — ' + (closedAll ? t('classClosed') : t('seatsLeft', { n: n(free) })) : '') + '">' +
        '<span>' + n(label) + '</span>' +
        (has && !closedAll ? '<span class="free">' + n(free) + '</span>' : '') +
        '</button>';
    }
    return html + '</div>';
  }

  function slotCard(s, date) {
    const cap = s.capacity || 3;
    const seat = seatOf(s.id, date);
    const booked = bookingFor(s.id, date);
    const closure = closureOf(s.id, date);
    let seats = '';
    for (let i = 0; i < cap; i++)
      seats += '<span class="seat' + (i < seat.taken ? ' on' : (i < seat.taken + seat.pending ? ' wait' : '')) + '"></span>';

    const freeSeats = cap - seat.taken - seat.pending;
    let action = '';
    if (closure) action = '';
    else if (booked) action = '<button class="btn sm ghost" data-cancel="' + U.esc(booked.id) + '">' +
      U.esc(t('cancelBooking')) + '</button>';
    else if (freeSeats > 0) action = '<button class="btn sm primary" data-book="' + U.esc(s.id) +
      '" data-date="' + U.esc(date) + '">' + U.esc(t('book')) + '</button>';
    else action = '<button class="btn sm ghost" data-book="' + U.esc(s.id) + '" data-date="' + U.esc(date) +
      '" data-wait="1">' + U.esc(t('joinWaitlist')) + '</button>';

    const meta = [s.coach ? t('coach') + ': ' + s.coach : '', s.horse ? t('horse') + ': ' + s.horse : '']
      .filter(Boolean).join(' · ');

    const state = closure ? 'closed' : booked ? booked.status : freeSeats > 0 ? 'none' : 'full';

    return '<div class="slot' + (booked ? ' mine' : '') + (closure ? ' closed' : '') +
      '" data-state="' + state + '">' +
      '<div class="spread"><div><div class="slot-time">' + U.esc(U.time12(s.time)) + '</div>' +
      (meta ? '<div class="tiny dim">' + U.esc(meta) + '</div>' : '') + '</div>' +
      '<span class="seats" aria-hidden="true">' + seats + '</span></div>' +
      '<div class="row wrap" style="margin-top:10px;gap:8px">' +
        (closure
          ? U.badge(closure.reason ? t('closedReason', { r: closure.reason }) : t('classClosed'), 'bad', true)
          : U.badge(t('confirmedSeats', { n: n(seat.taken) }), seat.taken >= cap ? 'bad' : 'ok', true) +
            (seat.pending ? U.badge(t('waitingSeats', { n: n(seat.pending) }), 'wait') : '') +
            (freeSeats > 0 ? U.badge(freeSeats === 1 ? t('oneSeatLeft') : t('seatsLeft', { n: n(freeSeats) }), 'plain')
                           : U.badge(t('full'), 'bad', true))) +
        (booked ? U.statusBadge(booked.status) : '') +
        '<span class="grow"></span>' + action +
      '</div></div>';
  }

  function view() {
    const today = U.todayISO();
    if (!pickedDate || pickedDate < today) {
      const first = [];
      for (let i = 0; i < 14; i++) {
        const d = U.addDaysISO(today, i);
        if ((boot.schedule || []).some(s => s.day === U.dowOf(d))) { first.push(d); break; }
      }
      pickedDate = first[0] || today;
    }
    const slots = (boot.schedule || []).filter(s => s.day === U.dowOf(pickedDate))
      .sort((a, b) => a.time.localeCompare(b.time));

    return '<div class="stack">' +
      introCard() + requestsCard() +
      '<div class="panel"><div class="upper" style="margin-bottom:10px">' + U.esc(t('pickDate')) + '</div>' +
      calendar() + '</div>' +
      '<div class="spread"><h2>' + U.esc(U.dateFull(pickedDate)) + '</h2></div>' +
      (slots.length ? '<div class="stack sm">' + slots.map(s => slotCard(s, pickedDate)).join('') + '</div>'
                    : U.empty(t('nothingOn'))) +
      '</div>';
  }

  function render() {
    U.paint(topbar() +
      (API.online ? '' : '<div class="banner warn" style="margin-bottom:12px">' + U.icon('wifi') + U.esc(t('offline')) + '</div>') +
      view(), 'guest:' + pickedDate);
    document.getElementById('nav').hidden = true;
    document.querySelector('.shell').classList.remove('signed-in');
    U.animateRings();
    bind();
  }

  /* --------------------------------------------------------------- actions --*/
  async function refresh(silent) {
    try {
      const [freshBoot, mine] = await Promise.all([API.bootstrap(), API.guestBookings()]);
      if (freshBoot && freshBoot.ok) { boot = freshBoot; U.setTZ(S().timezone); }
      if (mine && mine.ok) myBookings = mine.bookings || [];
      render();
    } catch (e) { if (!silent) U.toast(t('netErr'), 'err'); }
  }

  function bookErr(res) {
    const e = res && res.error;
    return e === 'full' ? t('full')
      : e === 'exists' ? t('alreadyBooked')
      : e === 'past' ? t('pastDate')
      : e === 'closed' ? t('classClosed')
      : e === 'name' ? t('fillAll')
      : t('netErr');
  }

  function doBook(slotId, date, waitlist) {
    const slot = (boot.schedule || []).find(s => s.id === slotId) || {};
    U.dialog({
      title: waitlist ? t('joinWaitlist') : t('bookConfirm'),
      body: '<p class="muted">' + U.esc(U.dateFull(date)) + ' · ' + U.esc(U.time12(slot.time)) + '</p>' +
        U.field(t('name'), '<input class="input" id="g_name" value="' + U.esc(readLS('af_guest_name')) +
          '" autocomplete="name" autofocus>', t('guestNameHint')) +
        U.field(t('phone') + ' (' + t('optional') + ')',
          '<input class="input" id="g_phone" inputmode="tel" value="' + U.esc(readLS('af_guest_phone')) +
          '" autocomplete="tel">') +
        '<p class="tiny dim">' + U.esc(t('pendingHint', { n: n(S().reply_hours || 24) })) + '</p>',
      actions: '<button class="btn ghost grow" data-close>' + U.esc(t('cancel')) + '</button>' +
        '<button class="btn primary grow" id="go">' + U.esc(waitlist ? t('joinWaitlist') : t('book')) + '</button>',
      onMount(box) {
        box.querySelector('#go').addEventListener('click', async () => {
          const name = box.querySelector('#g_name').value.trim();
          const phone = box.querySelector('#g_phone').value.trim();
          if (!name) return U.toast(t('fillAll'), 'err');
          const btn = box.querySelector('#go');
          btn.disabled = true;
          try {
            const res = await API.guestBook(name, phone, slotId, date);
            U.closeDialog();
            if (!res || !res.ok) return U.toast(bookErr(res), 'err');
            writeLS('af_guest_name', name);
            if (phone) writeLS('af_guest_phone', phone);
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
            const res = await API.guestCancel(id, why);
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

  function bind() {
    const $ = s => document.querySelector(s);
    const $$ = s => document.querySelectorAll(s);

    $$('.cal button[data-date]').forEach(b => b.addEventListener('click', () => {
      pickedDate = b.dataset.date; render();
    }));
    $$('[data-book]').forEach(b => b.addEventListener('click', () =>
      doBook(b.dataset.book, b.dataset.date, !!b.dataset.wait)));
    $$('[data-cancel]').forEach(b => b.addEventListener('click', () => doCancel(b.dataset.cancel)));

    const lang = $('#langBtn');
    if (lang) lang.addEventListener('click', () => { I18N.toggle(); render(); });
    const toLogin = $('#toLogin');
    if (toLogin) toLogin.addEventListener('click', () => U.router.go('student'));
  }

  window.GUEST = {
    start(bootPayload, route) {
      boot = bootPayload || {};
      U.setTZ(S().timezone);
      pickedDate = null;
      myBookings = [];
      render();
      refresh(true);
      API.onConnection(on => { if (on) refresh(true); else render(); });
    },
    route(r) {
      if (!boot) return;
      render();
    }
  };
})();
