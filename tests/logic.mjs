import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../', import.meta.url));
const store = new Map();
const localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k)
};
const ctx = { console, crypto, localStorage, setTimeout, Date, Math, JSON, Promise, Number, String, Object, Array, Intl };
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['js/store.js', 'js/demo.js']) vm.runInContext(fs.readFileSync(dir + f, 'utf8'), ctx, { filename: f });

const call = (fn, args) => ctx.DEMO.call(fn, args);
let pass = 0, fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log('PASS — ' + label); }
  else { fail++; console.log('FAIL — ' + label + ' :: ' + JSON.stringify(extra ?? '')); }
};

const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const today = iso(new Date());
const nextDow = dow => {
  const d = new Date();
  d.setDate(d.getDate() + ((dow - d.getDay() + 7) % 7));
  return iso(d);
};

/* ------------------------------------------------ bootstrap + rider login */
const bs = await call('bootstrap', {});
ok('bootstrap returns settings', bs.ok && bs.settings.academy_name.includes('Al Fursan'));
ok('name directory listed', bs.directory.length === 6, bs.directory.length);
const zawad = bs.directory.find(x => x.name === 'Zawad');

ok('login by id works', (await call('student_login', { p_id: zawad.id, p_pin: '1111' })).ok);
ok('login by typed name works', (await call('student_login', { p_name: '  zawad ', p_pin: '1111' })).ok);
ok('wrong pin rejected', !(await call('student_login', { p_id: zawad.id, p_pin: '9999' })).ok);

// lockout after 5 fails
for (let i = 0; i < 4; i++) await call('student_login', { p_id: zawad.id, p_pin: '0000' });
const locked = await call('student_login', { p_id: zawad.id, p_pin: '0000' });
ok('locks out after 5 wrong PINs', locked.error === 'locked' && locked.seconds > 0, locked);

// clear the lock for the rest of the run
const db = () => JSON.parse(localStorage.getItem('af_demo_db_v3'));
const raw = db(); raw.attempts = {}; localStorage.setItem('af_demo_db_v3', JSON.stringify(raw));
ctx.DEMO.reset();
const bs2 = await call('bootstrap', {});
const zid = bs2.directory.find(x => x.name === 'Zawad').id;
const login = await call('student_login', { p_id: zid, p_pin: '1111' });
ok('fresh login issues a token', login.ok && login.token.length > 20);
const TOK = login.token;

const sess = await call('student_session', { p_token: TOK });
ok('session payload complete', sess.ok && sess.student && sess.schedule.length === 20 &&
  sess.seats && sess.notifications && sess.invoices.length === 1, Object.keys(sess));
ok('session rejects a bad token', !(await call('student_session', { p_token: 'nope' })).ok);
ok('other riders PINs are not exposed', sess.student.pin === undefined &&
  JSON.stringify(sess.schedule).indexOf('"pin"') === -1);

/* -------------------------------------------------------------- booking */
const monSlot = sess.schedule.find(s => s.day === 1 && s.time === '18:30');
const monDate = nextDow(1);
const b1 = await call('student_book', { p_token: TOK, p_slot: monSlot.id, p_date: monDate });
ok('booking created as pending', b1.ok && b1.status === 'pending', b1);
ok('double booking blocked', (await call('student_book', { p_token: TOK, p_slot: monSlot.id, p_date: monDate })).error === 'exists');
ok('wrong weekday blocked', (await call('student_book', { p_token: TOK, p_slot: monSlot.id, p_date: nextDow(2) })).error === 'day');
ok('past date blocked', (await call('student_book', { p_token: TOK, p_slot: monSlot.id, p_date: '2020-01-06' })).error === 'past');

const s2 = await call('student_session', { p_token: TOK });
const seat = s2.seats[monSlot.id + '|' + monDate];
ok('pending does NOT consume a confirmed seat', seat.taken === 0 && seat.pending === 1, seat);

/* --------------------------------------------------------------- admin */
ok('admin bad password rejected', !(await call('admin_login', { p_user: 'owner', p_pass: 'x' })).ok);
const al = await call('admin_login', { p_user: 'owner', p_pass: 'alfursan' });
ok('admin login issues token', al.ok && al.admin.role === 'owner', al);
const A = al.token;

let ov = await call('admin_session', { p_token: A });
ok('admin session complete', ov.ok && ov.students.length === 6 && ov.alerts && ov.activity, Object.keys(ov));
ok('admin sees rider PINs', ov.students[0].pin !== undefined);
ok('unseen counter', ov.unseen === 1, ov.unseen);
ok('booking carries rider name', ov.bookings[0].student === 'Zawad');

// approve -> seat consumed, rider notified
await call('admin_booking_action', { p_token: A, p_ids: [ov.bookings[0].id], p_action: 'approve' });
const s3 = await call('student_session', { p_token: TOK });
ok('approved consumes a seat', s3.seats[monSlot.id + '|' + monDate].taken === 1);
ok('rider is notified of approval', s3.notifications.some(x => x.kind === 'approved'));

/* ------------------------------------------------------------- waitlist */
const others = bs2.directory.filter(x => x.name !== 'Zawad').slice(0, 3);
const toks = [];
for (const o of others) {
  const r = await call('student_login', { p_id: o.id, p_pin: { Arifa: '2222', Rahat: '3333', Itrat: '4444', Abaan: '5555', Zaraan: '6666' }[o.name] });
  toks.push({ name: o.name, token: r.token });
}
const r1 = await call('student_book', { p_token: toks[0].token, p_slot: monSlot.id, p_date: monDate });
const r2 = await call('student_book', { p_token: toks[1].token, p_slot: monSlot.id, p_date: monDate });
ov = await call('admin_session', { p_token: A });
const pend = ov.bookings.filter(b => b.status === 'pending').map(b => b.id);
await call('admin_booking_action', { p_token: A, p_ids: pend, p_action: 'approve' });
const r3 = await call('student_book', { p_token: toks[2].token, p_slot: monSlot.id, p_date: monDate });
ok('4th rider goes to waitlist when full', r3.ok && r3.status === 'waitlist', r3);

// cancel an approved one -> waitlist promoted
ov = await call('admin_session', { p_token: A });
const approved = ov.bookings.find(b => b.status === 'approved' && b.student === toks[0].name);
await call('student_cancel', { p_token: toks[0].token, p_id: approved.id, p_reason: 'sick' });
ov = await call('admin_session', { p_token: A });
const promoted = ov.bookings.find(b => b.student === toks[2].name);
ok('waitlist auto-promotes to pending', promoted.status === 'pending', promoted && promoted.status);

/* the seat limit must hold through "approve all" here too */
// 18:30 has nobody on the recurring roster, so the seat maths starts from zero
const capSlot = sess.schedule.find(s => s.day === 3 && s.time === '18:30');
const capDate = nextDow(3);
const capStatus = [];
for (const [nm, pin] of [['Zawad', '1111'], ['Arifa', '2222'], ['Rahat', '3333'], ['Itrat', '4444'], ['Abaan', '5555']]) {
  const s = bs2.directory.find(x => x.name === nm);
  const lr = await call('student_login', { p_id: s.id, p_pin: pin });
  if (!lr.ok) continue;
  const bk = await call('student_book', { p_token: lr.token, p_slot: capSlot.id, p_date: capDate });
  if (bk.ok) capStatus.push(bk.status);
}
ok('demo waitlists past the seat limit',
  capStatus.filter(x => x === 'pending').length === 3 && capStatus.filter(x => x === 'waitlist').length >= 1,
  capStatus);
ov = await call('admin_session', { p_token: A });
const capIds = ov.bookings.filter(b => b.slot_id === capSlot.id && b.date === capDate).map(b => b.id);
const capRes = await call('admin_booking_action', { p_token: A, p_ids: capIds, p_action: 'approve' });
ov = await call('admin_session', { p_token: A });
const approvedHere = ov.bookings.filter(b => b.slot_id === capSlot.id && b.date === capDate && b.status === 'approved').length;
ok('demo approve-all never exceeds the seat limit', approvedHere === 3, { approvedHere, capRes });
ok('demo reports the overflow', capRes.skipped >= 1, capRes);

/* ------------------------------------------------ balance + expiry rules */
const rahat = ov.students.find(s => s.name === 'Rahat');
await call('admin_save_student', { p_token: A, p_data: Object.assign({}, rahat, { total_classes: rahat.done }) });
const rt = toks.find(x => x.name === 'Rahat');
if (rt) {
  const nb = await call('student_book', { p_token: rt.token, p_slot: sess.schedule.find(s => s.day === 3 && s.time === '19:20').id, p_date: nextDow(3) });
  ok('no classes left blocks booking', nb.error === 'nobalance', nb);
}
const arifa = ov.students.find(s => s.name === 'Arifa');
await call('admin_save_student', { p_token: A, p_data: Object.assign({}, arifa, { end_date: iso(addDays(new Date(), -1)) }) });
const at = toks.find(x => x.name === 'Arifa');
const eb = await call('student_book', { p_token: at.token, p_slot: sess.schedule.find(s => s.day === 3 && s.time === '19:20').id, p_date: nextDow(3) });
ok('expired course blocks booking', eb.error === 'expired', eb);

/* ------------------------------------------------------- 3-state marking */
const wedSlot = sess.schedule.find(s => s.day === 3 && s.time === '17:40');
const m1 = await call('admin_mark', { p_token: A, p_student: zid, p_date: today, p_time: '17:40', p_status: 'present' });
ok('mark present', m1.ok && m1.status === 'present');
const m2 = await call('admin_mark', { p_token: A, p_student: zid, p_date: today, p_time: '17:40', p_status: 'absent' });
ok('switch to absent', m2.ok && m2.status === 'absent');
ov = await call('admin_session', { p_token: A });
ok('absent does not count as done', ov.students.find(s => s.id === zid).done === 3,
  ov.students.find(s => s.id === zid).done);
ok('absent counter tracked', ov.students.find(s => s.id === zid).absent === 1);
await call('admin_mark', { p_token: A, p_student: zid, p_date: today, p_time: '17:40', p_status: 'none' });
ov = await call('admin_session', { p_token: A });
ok('clearing a mark removes the record', !ov.attendance.some(a => a.student_id === zid && a.date === today && a.time === '17:40'));

const wedRoster = (sess.schedule.find(s => s.id === wedSlot.id).students || []).length;
const bulk = await call('admin_mark_bulk', { p_token: A, p_slot: wedSlot.id, p_date: nextDow(3), p_status: 'present' });
ok('bulk mark covers everyone in the slot', bulk.ok && bulk.count === wedRoster,
  { count: bulk.count, roster: wedRoster });

/* ------------------------------------------------------- day closure */
const cd = await call('admin_close_day', { p_token: A, p_date: monDate, p_slot: null, p_reason: 'Rain' });
ok('close day works', cd.ok);
ov = await call('admin_session', { p_token: A });
ok('closing cancels that day\'s bookings',
  !ov.bookings.some(b => b.date === monDate && ['pending', 'approved', 'waitlist'].includes(b.status)));
const zs = await call('student_session', { p_token: TOK });
ok('riders are told the class was cancelled', zs.notifications.some(x => x.kind === 'closed'));
const blocked = await call('student_book', { p_token: TOK, p_slot: monSlot.id, p_date: monDate });
ok('closed day blocks new bookings', blocked.error === 'closed', blocked);
await call('admin_open_day', { p_token: A, p_id: ov.closures[0].id });
ov = await call('admin_session', { p_token: A });
ok('reopen removes the closure', ov.closures.length === 0);

/* --------------------------------------------------------- slot pausing */
const slot = ov.schedule.find(s => s.time === '19:20' && s.day === 5);
await call('admin_save_slot', { p_token: A, p_data: Object.assign({}, slot, { active: false, coach: 'Rakib', horse: 'Storm' }) });
ov = await call('admin_session', { p_token: A });
const paused = ov.schedule.find(s => s.id === slot.id);
ok('slot can be paused', paused.active === false, paused.active);
ok('coach and horse saved', paused.coach === 'Rakib' && paused.horse === 'Storm');
const zs2 = await call('student_session', { p_token: TOK });
ok('paused slot hidden from riders', !zs2.schedule.some(s => s.id === slot.id));

/* ------------------------------------------- fees, paid in instalments */
const owedBy = o => Number(o.students.find(s => s.id === zid).unpaid);
ov = await call('admin_session', { p_token: A });
ok('the seeded fee shows what is still owed', owedBy(ov) === 3500, owedBy(ov));

const inv2 = await call('admin_save_invoice', {
  p_token: A, p_data: { student_id: zid, title: 'Extra', total: 2000, due_date: today }
});
ov = await call('admin_session', { p_token: A });
ok('a second fee adds to what is owed', inv2.ok && owedBy(ov) === 5500, owedBy(ov));

const part = await call('admin_save_payment', { p_token: A, p_data: { invoice_id: inv2.id, amount: 500 } });
ok('a part payment reports the remainder', part.ok && Number(part.remaining) === 1500, part);
ov = await call('admin_session', { p_token: A });
ok('the balance drops by the amount received', owedBy(ov) === 5000, owedBy(ov));

const tooMuch = await call('admin_save_payment', { p_token: A, p_data: { invoice_id: inv2.id, amount: 9999 } });
ok('more than owed is refused', tooMuch.error === 'over' && Number(tooMuch.remaining) === 1500, tooMuch);

await call('admin_save_payment', { p_token: A, p_data: { invoice_id: inv2.id, amount: 1500 } });
ov = await call('admin_session', { p_token: A });
ok('the fee clears when fully paid', owedBy(ov) === 3500, owedBy(ov));

const zSess = await call('student_session', { p_token: TOK });
const extra = zSess.invoices.find(i => i.title === 'Extra');
ok('the rider sees every instalment', extra && extra.entries.length === 2 && Number(extra.paid) === 2000, extra);

/* renewal starts a cycle and bills it */
const beforeRenew = ov.students.find(s => s.id === zid).total_classes;
const rn = await call('admin_renew', { p_token: A, p_student: zid });
ov = await call('admin_session', { p_token: A });
ok('renewing adds classes and a fee at the course price',
  rn.ok && ov.students.find(s => s.id === zid).total_classes === beforeRenew + 8 && owedBy(ov) === 3500 + 5500,
  { before: beforeRenew, owed: owedBy(ov) });

/* the guide flag */
ok('a rider starts without having seen the guide', zSess.student.guide === 0, zSess.student.guide);
await call('set_guide', { p_token: TOK, p_value: 2 });
ok('muting the guide sticks', (await call('student_session', { p_token: TOK })).student.guide === 2);

/* ---------------------------------------------------- profile self-serve */
const up = await call('student_update', { p_token: TOK, p_phone: '01700000000', p_pin: '4321' });
ok('rider updates own phone + PIN', up.ok);
ok('old PIN no longer works', !(await call('student_login', { p_id: zid, p_pin: '1111' })).ok);
ok('new PIN works', (await call('student_login', { p_id: zid, p_pin: '4321' })).ok);
ok('bad PIN format rejected', (await call('student_update', { p_token: TOK, p_pin: '12' })).error === 'pin');

/* ------------------------------------------------------------- settings */
const sv = await call('admin_save_settings', { p_token: A, p_data: { contact_phone: '01711', capacity: '4', currency: 'BDT', nope: 'x' } });
ok('settings saved', sv.ok && sv.settings.contact_phone === '01711');
const bs3 = await call('bootstrap', {});
ok('public settings reflect the change', bs3.settings.contact_phone === '01711');
await call('admin_save_settings', { p_token: A, p_data: { directory: 'off' } });
ok('directory can be turned off', (await call('bootstrap', {})).directory.length === 0);
await call('admin_save_settings', { p_token: A, p_data: { directory: 'on' } });

/* --------------------------------------------------- password + staff */
ok('wrong current password rejected',
  (await call('admin_change_password', { p_token: A, p_current: 'nope', p_new: 'longenough' })).error === 'current');
ok('short password rejected',
  (await call('admin_change_password', { p_token: A, p_current: 'alfursan', p_new: '123' })).error === 'short');
ok('password change works',
  (await call('admin_change_password', { p_token: A, p_current: 'alfursan', p_new: 'newpass123' })).ok);
ok('old admin password stops working', !(await call('admin_login', { p_user: 'owner', p_pass: 'alfursan' })).ok);
ok('current session survives its own password change', (await call('admin_session', { p_token: A })).ok);

const su = await call('admin_save_user', { p_token: A, p_data: { username: 'coach', pass: 'coachpass', display: 'Coach', role: 'staff' } });
ok('staff account created', su.ok);
const cl = await call('admin_login', { p_user: 'coach', p_pass: 'coachpass' });
ok('staff can sign in', cl.ok && cl.admin.role === 'staff');
ok('staff cannot manage staff', !(await call('admin_save_user', { p_token: cl.token, p_data: { username: 'x', pass: 'yyyyyy' } })).ok);

/* ------------------------------------------------------- delete + backup */
ov = await call('admin_session', { p_token: A });
const itrat = ov.students.find(s => s.name === 'Itrat');
ok('delete needs the typed name',
  (await call('admin_delete_student', { p_token: A, p_id: itrat.id, p_confirm: 'wrong' })).error === 'confirm');
ok('delete works with the right name',
  (await call('admin_delete_student', { p_token: A, p_id: itrat.id, p_confirm: 'itrat' })).ok);

const exp = await call('admin_export', { p_token: A });
ok('export has every table', exp.ok && exp.data.students && exp.data.payments && exp.data.bookings);
const pv = await call('admin_import', { p_token: A, p_data: exp.data, p_mode: 'preview' });
ok('import preview counts without writing', pv.ok && pv.preview && pv.students === 5 && pv.current.students === 5, pv);
ov = await call('admin_session', { p_token: A });
const beforeCount = ov.students.length;
const imp = await call('admin_import', { p_token: A, p_data: exp.data, p_mode: 'merge' });
ov = await call('admin_session', { p_token: A });
ok('merge import does not duplicate', imp.ok && ov.students.length === beforeCount, ov.students.length);

/* --------------------------------------------------------- guest booking --
   A visitor with no account gets a hidden row in students (is_guest, keyed
   by a device id) instead of a null student_id on bookings, specifically so
   the seat-counting rules above never have to treat two different guests as
   the same "nobody" — the regression checked below. */
const guestSlot = sess.schedule.find(s => s.day === 6 && s.time === '16:00');
const guestDate = nextDow(6);
const gKey1 = 'guest-device-1', gKey2 = 'guest-device-2';

const g1 = await call('guest_book', { p_key: gKey1, p_name: 'Nadia', p_phone: '01700000000',
  p_slot: guestSlot.id, p_date: guestDate });
ok('a guest can book with no account', g1.ok && g1.status === 'pending', g1);
const g1again = await call('guest_book', { p_key: gKey1, p_name: 'Nadia', p_phone: '01700000000',
  p_slot: guestSlot.id, p_date: guestDate });
ok('the same device cannot double-book the same class', g1again.error === 'exists', g1again);
const g2 = await call('guest_book', { p_key: gKey2, p_name: 'Rafi', p_phone: '',
  p_slot: guestSlot.id, p_date: guestDate });
ok('a second guest can book the same class', g2.ok && g2.status === 'pending', g2);
ok('booking with no name is refused',
  (await call('guest_book', { p_key: 'guest-device-3', p_name: '', p_phone: '',
    p_slot: guestSlot.id, p_date: guestDate })).error === 'name');

ov = await call('admin_session', { p_token: A });
const guestBookingIds = ov.bookings.filter(b => b.slot_id === guestSlot.id && b.date === guestDate).map(b => b.id);
ok('both guest requests reach the console', guestBookingIds.length === 2, guestBookingIds);
await call('admin_booking_action', { p_token: A, p_ids: guestBookingIds, p_action: 'approve', p_reason: '' });
const bootAfterApprove = await call('bootstrap', {});
const guestSeat = bootAfterApprove.seats[guestSlot.id + '|' + guestDate];
ok('two different guests approved into one slot occupy two distinct seats',
  !!guestSeat && guestSeat.taken === 2, guestSeat);

const mine1 = await call('guest_bookings', { p_key: gKey1 });
ok('a guest can see their own booking by device key',
  mine1.ok && mine1.name === 'Nadia' && mine1.bookings.length === 1 &&
  mine1.bookings[0].slot_id === guestSlot.id, mine1);
const mine2 = await call('guest_bookings', { p_key: gKey2 });
ok('a different device sees only its own booking',
  mine2.ok && mine2.bookings.length === 1 && mine2.bookings[0].id !== mine1.bookings[0].id,
  { mine1, mine2 });
ok('an unknown device key has nothing to see',
  (await call('guest_bookings', { p_key: 'never-booked' })).bookings.length === 0);

const cancel1 = await call('guest_cancel', { p_key: gKey1, p_id: mine1.bookings[0].id, p_reason: 'plans changed' });
ok('a guest can cancel their own booking', cancel1.ok, cancel1);
const wrongCancel = await call('guest_cancel', { p_key: gKey2, p_id: mine1.bookings[0].id, p_reason: '' });
ok('a guest cannot cancel a booking that is not theirs', wrongCancel.error === 'missing', wrongCancel);

const bootAfterGuests = await call('bootstrap', {});
ok('a guest never appears in the public name directory',
  !bootAfterGuests.directory.some(d => d.name === 'Nadia' || d.name === 'Rafi'), bootAfterGuests.directory);
ok('a guest cannot log in as a rider — no PIN was ever set for them',
  !(await call('student_login', { p_name: 'Rafi', p_pin: '0000' })).ok);

ov = await call('admin_session', { p_token: A });
const guestRow = ov.students.find(s => s.name === 'Rafi');
ok('the console can tell a guest apart from a rider', !!guestRow && guestRow.is_guest === true, guestRow);
ok('a guest raises no course alerts — there is no course to expire or pay for',
  !ov.alerts.exhausted.some(x => x.name === 'Rafi') && !ov.alerts.unpaid.some(x => x.name === 'Rafi'));

/* --------------------------------------------------------------- logout */
await call('logout', { p_token: TOK });
ok('logout invalidates the token', !(await call('student_session', { p_token: TOK })).ok);
ok('error logging accepted', (await call('log_error', { p_kind: 'test', p_message: 'hello' })).ok);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);

