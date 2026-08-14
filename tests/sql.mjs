/* -----------------------------------------------------------------------
   Runs supabase/schema.sql inside a real PostgreSQL (PGlite / WASM) and
   exercises the RPCs the app actually calls.

   This exists because every other suite talks to the localStorage demo
   backend. Two bugs shipped that only existed in SQL — a seat-map key built
   from a timestamp, and a lockout counter that never reset — and no test
   could see them. This one runs the same scenarios against the real schema
   and checks the payload shapes the client depends on.
------------------------------------------------------------------------- */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const dir = fileURLToPath(new URL('../', import.meta.url));

let pass = 0, fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log('PASS - ' + label); }
  else { fail++; console.log('FAIL - ' + label + ' :: ' + JSON.stringify(extra ?? '').slice(0, 240)); }
};

const db = await PGlite.create();
// Supabase provides these roles; a bare PostgreSQL does not.
await db.exec(`
  do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  end $$;`);
try {
  await db.exec(fs.readFileSync(dir + 'supabase/schema.sql', 'utf8'));
  ok('schema.sql runs on PostgreSQL with no extensions', true);
} catch (e) {
  console.log('SCHEMA ERROR: ' + (e && e.message));
  if (e && e.hint) console.log('  hint: ' + e.hint);
  if (e && e.position) console.log('  position: ' + e.position);
  process.exit(1);
}

/** call an RPC the way PostgREST does: named args, single jsonb result */
async function call(fn, args) {
  const names = Object.keys(args || {});
  const params = names.map((k, i) => k + ' => $' + (i + 1));
  const values = names.map(k => {
    const v = args[k];
    if (Array.isArray(v)) return '{' + v.join(',') + '}';   // uuid[] literal, as PostgREST sends it
    return (v && typeof v === 'object') ? JSON.stringify(v) : v;
  });
  const res = await db.query('select public.' + fn + '(' + params.join(', ') + ') as out', values);
  return res.rows[0].out;
}

const one = async sql => (await db.query(sql)).rows[0];
const today = (await one('select _today() as d')).d;
const isoOf = d => (d instanceof Date
  ? new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10)
  : String(d).slice(0, 10));
const todayISO = isoOf(today);

/* ------------------------------------------------------------- seed data --*/
const admin = await call('admin_login', { p_user: 'owner', p_pass: 'alfursan', p_days: 7 });
ok('seeded owner account signs in', admin.ok && admin.admin.role === 'owner', admin);
const A = admin.token;

const mk = (name, pin, course, total) => call('admin_save_student', {
  p_token: A,
  p_data: { name, pin, course, total_classes: total, start_date: todayISO, tags: [], active: true }
});
const zawad = await mk('Zawad', '1111', 'basic', 8);
const arifa = await mk('Arifa', '2222', 'basic', 8);
const rahat = await mk('Rahat', '3333', 'advanced', 16);
const itrat = await mk('Itrat', '4444', 'basic', 8);
ok('riders created through the admin RPC', zawad.ok && arifa.ok && rahat.ok && itrat.ok);

const boot = await call('bootstrap', {});
ok('bootstrap exposes settings and the name list',
  boot.ok && boot.settings.academy_name && boot.directory.length === 4, boot.directory && boot.directory.length);
ok('bootstrap never leaks a PIN', JSON.stringify(boot).indexOf('1111') === -1);

/* ------------------------------------------------------------- rider auth --*/
const login = await call('student_login', { p_id: zawad.id, p_name: null, p_pin: '1111', p_days: 30 });
ok('rider signs in and gets a token', login.ok && login.token.length >= 32, login);
const Z = login.token;
ok('wrong PIN is refused', !(await call('student_login', { p_id: zawad.id, p_name: null, p_pin: '9999', p_days: 30 })).ok);

/* the lockout bug: after the lock expires, one more mistake must NOT relock */
for (let i = 0; i < 5; i++) await call('student_login', { p_id: arifa.id, p_name: null, p_pin: '0000', p_days: 30 });
const locked = await call('student_login', { p_id: arifa.id, p_name: null, p_pin: '0000', p_days: 30 });
ok('five wrong PINs lock the name', locked.error === 'locked' && locked.seconds > 0, locked);
await db.query("update login_attempts set locked_until = now() - interval '1 second' where key like 'stu:%'");
const afterLock = await call('student_login', { p_id: arifa.id, p_name: null, p_pin: '0000', p_days: 30 });
ok('one mistake after the lock expires does not relock', afterLock.error === 'login', afterLock);
await db.query('delete from login_attempts');

/* --------------------------------------------------------------- session --*/
const sess = await call('student_session', { p_token: Z });
ok('session carries every section the app reads',
  sess.ok && sess.student && sess.schedule.length === 20 && sess.seats &&
  Array.isArray(sess.attendance) && Array.isArray(sess.bookings) &&
  Array.isArray(sess.invoices) && Array.isArray(sess.notifications) && Array.isArray(sess.closures),
  Object.keys(sess));
ok('rider payload hides PINs', sess.student.pin === undefined && JSON.stringify(sess.schedule).indexOf('"pin"') === -1);

/* the seat-map key bug: keys must be "<uuid>|YYYY-MM-DD", nothing else */
const seatKeys = Object.keys(sess.seats);
ok('seat map is not empty', seatKeys.length > 0, seatKeys.length);
ok('every seat key is "<uuid>|YYYY-MM-DD"',
  seatKeys.every(k => /^[0-9a-f-]{36}\|\d{4}-\d{2}-\d{2}$/.test(k)), seatKeys[0]);

/* and the client must actually find a slot it looks up */
const monSlot = sess.schedule.find(s => s.day === 1 && s.time === '18:30');
const nextMon = isoOf((await one(
  "select (_today() + ((1 - extract(dow from _today())::int + 7) % 7))::date as d")).d);
ok('the key the client builds resolves', !!sess.seats[monSlot.id + '|' + nextMon],
  monSlot.id + '|' + nextMon);

/* ------------------------------------------------------------- booking --*/
const b1 = await call('student_book', { p_token: Z, p_slot: monSlot.id, p_date: nextMon, p_note: '' });
ok('booking is accepted as pending', b1.ok && b1.status === 'pending', b1);
ok('the same slot cannot be booked twice',
  (await call('student_book', { p_token: Z, p_slot: monSlot.id, p_date: nextMon, p_note: '' })).error === 'exists');
ok('the weekday must match the slot',
  (await call('student_book', { p_token: Z, p_slot: monSlot.id, p_date: isoOf(new Date(Date.parse(nextMon) + 864e5)), p_note: '' })).error === 'day');

const sess2 = await call('student_session', { p_token: Z });
const seat = sess2.seats[monSlot.id + '|' + nextMon];
ok('a pending request does not fill a seat', seat.taken === 0 && seat.pending === 1, seat);

/* --------------------------------------------------------------- admin --*/
let ov = await call('admin_session', { p_token: A });
ok('console payload is complete',
  ov.ok && ov.students.length === 4 && ov.schedule.length === 20 && ov.alerts && ov.stats && ov.activity,
  Object.keys(ov));
ok('console sees rider PINs', ov.students.every(s => typeof s.pin === 'string'));
ok('unseen request counter works', ov.unseen === 1, ov.unseen);
ok('request rows carry the rider name and time',
  ov.bookings[0].student === 'Zawad' && ov.bookings[0].time === '18:30', ov.bookings[0]);

await call('admin_booking_action', { p_token: A, p_ids: [ov.bookings[0].id], p_action: 'approve', p_reason: '' });
const sess3 = await call('student_session', { p_token: Z });
ok('approving fills the seat', sess3.seats[monSlot.id + '|' + nextMon].taken === 1);
ok('the rider is notified', sess3.notifications.some(x => x.kind === 'approved'), sess3.notifications);

/* ------------------------------------------------------------ waitlist --*/
const tok = {};
for (const [name, id, pin] of [['Arifa', arifa.id, '2222'], ['Rahat', rahat.id, '3333'], ['Itrat', itrat.id, '4444']]) {
  tok[name] = (await call('student_login', { p_id: id, p_name: null, p_pin: pin, p_days: 30 })).token;
}
await call('student_book', { p_token: tok.Arifa, p_slot: monSlot.id, p_date: nextMon, p_note: '' });
await call('student_book', { p_token: tok.Rahat, p_slot: monSlot.id, p_date: nextMon, p_note: '' });
ov = await call('admin_session', { p_token: A });
await call('admin_booking_action', {
  p_token: A, p_ids: ov.bookings.filter(b => b.status === 'pending').map(b => b.id),
  p_action: 'approve', p_reason: ''
});
const w = await call('student_book', { p_token: tok.Itrat, p_slot: monSlot.id, p_date: nextMon, p_note: '' });
ok('a full slot puts the next rider on the waitlist', w.ok && w.status === 'waitlist', w);

ov = await call('admin_session', { p_token: A });
const arifaBooking = ov.bookings.find(b => b.student === 'Arifa' && b.status === 'approved');
await call('student_cancel', { p_token: tok.Arifa, p_id: arifaBooking.id, p_reason: 'sick' });
ov = await call('admin_session', { p_token: A });
ok('a cancellation promotes the waitlist',
  ov.bookings.find(b => b.student === 'Itrat').status === 'pending',
  ov.bookings.find(b => b.student === 'Itrat'));

/* The seat limit is the academy's core rule. It must survive five riders all
   requesting the same class and the owner pressing "approve all". */
const capSlot = sess.schedule.find(s => s.day === 3 && s.time === '17:40');
const capDate = isoOf((await one(
  "select (_today() + ((3 - extract(dow from _today())::int + 7) % 7))::date as d")).d);
const capIds = [];
for (const [nm, pin] of [['C1', '1101'], ['C2', '1102'], ['C3', '1103'], ['C4', '1104'], ['C5', '1105']]) {
  const r = await call('admin_save_student', {
    p_token: A, p_data: { name: nm, pin, course: 'basic', total_classes: 8, start_date: todayISO, tags: [], active: true }
  });
  const tk = (await call('student_login', { p_id: r.id, p_name: null, p_pin: pin, p_days: 30 })).token;
  const bk = await call('student_book', { p_token: tk, p_slot: capSlot.id, p_date: capDate, p_note: '' });
  capIds.push({ nm, status: bk.status });
}
ok('past the seat limit riders are waitlisted, not queued as pending',
  capIds.filter(x => x.status === 'pending').length === 3 &&
  capIds.filter(x => x.status === 'waitlist').length === 2, capIds);

ov = await call('admin_session', { p_token: A });
const capBookings = ov.bookings.filter(b => b.slot_id === capSlot.id && isoOf(b.date) === capDate).map(b => b.id);
const approveAll = await call('admin_booking_action', { p_token: A, p_ids: capBookings, p_action: 'approve', p_reason: '' });
const confirmed = (await one(`select _slot_taken('${capSlot.id}'::uuid, '${capDate}'::date) t`)).t;
ok('approve-all never confirms past the seat limit',
  confirmed === capSlot.capacity, { confirmed, capacity: capSlot.capacity, approveAll });
ok('the overflow is reported back to the owner', approveAll.skipped >= 1, approveAll);

ov = await call('admin_session', { p_token: A });
const capApproved = ov.bookings
  .filter(b => b.slot_id === capSlot.id && isoOf(b.date) === capDate && b.status === 'approved')
  .map(b => b.student).sort();
ok('seats go to whoever asked first', JSON.stringify(capApproved) === JSON.stringify(['C1', 'C2', 'C3']),
  capApproved);

/* "can't attend" has to actually hand the seat back */
const absentSlot = capSlot, absentDate = capDate;
const beforeAbsent = (await one(`select _slot_taken('${absentSlot.id}'::uuid, '${absentDate}'::date) t`)).t;
const c1 = ov.students.find(s => s.name === 'C1');
const c1tok = (await call('student_login', { p_id: c1.id, p_name: null, p_pin: '1101', p_days: 30 })).token;
const abs = await call('student_absence', {
  p_token: c1tok, p_slot: absentSlot.id, p_date: absentDate, p_reason: 'fever'
});
const afterAbsent = (await one(`select _slot_taken('${absentSlot.id}'::uuid, '${absentDate}'::date) t`)).t;
ok('an absence notice frees the seat', abs.ok && afterAbsent === beforeAbsent - 1,
  { beforeAbsent, afterAbsent, abs });
ov = await call('admin_session', { p_token: A });
ok('the absence cancels that booking',
  !ov.bookings.some(b => b.student_id === c1.id && isoOf(b.date) === absentDate &&
    ['pending', 'approved', 'waitlist'].includes(b.status)));
ok('and the freed seat promotes someone from the waitlist',
  ov.bookings.some(b => b.slot_id === absentSlot.id && isoOf(b.date) === absentDate && b.status === 'pending'),
  ov.bookings.filter(b => b.slot_id === absentSlot.id).map(b => b.student + ':' + b.status));

/* --------------------------------------------------- balance and expiry --*/
const exhausted = ov.students.find(s => s.name === 'Rahat');
await call('admin_save_student', { p_token: A, p_data: Object.assign({}, exhausted, { total_classes: 0 }) });
ok('a rider with nothing left cannot book',
  (await call('student_book', { p_token: tok.Rahat, p_slot: monSlot.id, p_date: isoOf(new Date(Date.parse(nextMon) + 7 * 864e5)), p_note: '' })).error === 'nobalance');
const expiring = ov.students.find(s => s.name === 'Itrat');
await call('admin_save_student', {
  p_token: A, p_data: Object.assign({}, expiring, { end_date: isoOf(new Date(Date.parse(todayISO) - 864e5)) })
});
ok('an expired course cannot book',
  (await call('student_book', { p_token: tok.Itrat, p_slot: monSlot.id, p_date: isoOf(new Date(Date.parse(nextMon) + 7 * 864e5)), p_note: '' })).error === 'expired');

/* ----------------------------------------------------------- attendance --*/
ok('present is recorded',
  (await call('admin_mark', { p_token: A, p_student: zawad.id, p_date: todayISO, p_time: '16:00', p_status: 'present' })).ok);
ok('the same class can be switched to absent',
  (await call('admin_mark', { p_token: A, p_student: zawad.id, p_date: todayISO, p_time: '16:00', p_status: 'absent' })).ok);
ov = await call('admin_session', { p_token: A });
const z = ov.students.find(s => s.name === 'Zawad');
ok('absent does not count towards done', z.done === 0 && z.absent === 1, { done: z.done, absent: z.absent });
await call('admin_mark', { p_token: A, p_student: zawad.id, p_date: todayISO, p_time: '16:00', p_status: 'none' });
ov = await call('admin_session', { p_token: A });
ok('clearing removes the record',
  !ov.attendance.some(a => a.student_id === zawad.id && a.time === '16:00'));

const bulk = await call('admin_mark_bulk', { p_token: A, p_slot: monSlot.id, p_date: nextMon, p_status: 'present' });
ok('mark-all-present covers roster and approved bookings', bulk.ok && bulk.count >= 1, bulk);

/* -------------------------------------------------------------- closure --*/
await call('admin_close_day', { p_token: A, p_date: nextMon, p_slot: null, p_reason: 'Rain' });
ov = await call('admin_session', { p_token: A });
ok('closing a day cancels its bookings',
  !ov.bookings.some(b => isoOf(b.date) === nextMon && ['pending', 'approved', 'waitlist'].includes(b.status)));
ok('closing a day blocks new bookings',
  (await call('student_book', { p_token: Z, p_slot: monSlot.id, p_date: nextMon, p_note: '' })).error === 'closed');
await call('admin_open_day', { p_token: A, p_id: ov.closures[0].id });
ok('reopening clears the closure', (await call('admin_session', { p_token: A })).closures.length === 0);

/* ------------------------------------------------------- slots and fees --*/
const slot = ov.schedule.find(s => s.time === '19:20' && s.day === 5);
await call('admin_save_slot', {
  p_token: A, p_data: Object.assign({}, slot, { active: false, coach: 'Rakib', horse: 'Storm' })
});
ov = await call('admin_session', { p_token: A });
const paused = ov.schedule.find(s => s.id === slot.id);
ok('a slot can be paused and keeps coach and horse',
  paused.active === false && paused.coach === 'Rakib' && paused.horse === 'Storm', paused);
ok('a paused slot disappears for riders',
  !(await call('student_session', { p_token: Z })).schedule.some(s => s.id === slot.id));

/* Fees are paid in parts: raise one invoice, then pay it off gradually. */
const owed = s => Number(s.students.find(x => x.id === zawad.id).unpaid);
const inv = await call('admin_save_invoice', {
  p_token: A, p_data: { student_id: zawad.id, title: 'Basic', course: 'basic', total: 5500, due_date: todayISO }
});
ok('an invoice can be raised', inv.ok, inv);
ov = await call('admin_session', { p_token: A });
ok('the full amount shows as owed and raises an alert',
  owed(ov) === 5500 && ov.alerts.unpaid.some(x => x.id === zawad.id), ov.alerts.unpaid);

const p1 = await call('admin_save_payment', { p_token: A, p_data: { invoice_id: inv.id, amount: 2000 } });
ok('a part payment is accepted and reports what is left',
  p1.ok && Number(p1.remaining) === 3500, p1);
ov = await call('admin_session', { p_token: A });
ok('only the remainder is still owed', owed(ov) === 3500, owed(ov));

const over = await call('admin_save_payment', { p_token: A, p_data: { invoice_id: inv.id, amount: 99999 } });
ok('paying more than is owed is refused', over.error === 'over' && Number(over.remaining) === 3500, over);

const p2 = await call('admin_save_payment', { p_token: A, p_data: { invoice_id: inv.id, amount: 3500 } });
ok('the last instalment clears the invoice', p2.ok && Number(p2.remaining) === 0, p2);
ov = await call('admin_session', { p_token: A });
ok('nothing is owed and both instalments count as income',
  owed(ov) === 0 && Number(ov.stats.month_income) === 5500, ov.stats);

const paidSess = await call('student_session', { p_token: Z });
ok('the rider sees the invoice with every instalment',
  paidSess.invoices.length === 1 && Number(paidSess.invoices[0].paid) === 5500 &&
  paidSess.invoices[0].entries.length === 2, paidSess.invoices);
ok('the rider is told about each payment',
  paidSess.notifications.filter(x => x.kind === 'payment').length === 2);

/* Renewing starts the next cycle and bills it at the course price. */
const beforeRenew = ov.students.find(s => s.id === zawad.id).total_classes;
const renew = await call('admin_renew', { p_token: A, p_student: zawad.id, p_amount: null });
ok('renewing extends the course and raises the next invoice', renew.ok && renew.invoice, renew);
ov = await call('admin_session', { p_token: A });
const renewed = ov.students.find(s => s.id === zawad.id);
ok('the renewal adds a fresh set of classes', renewed.total_classes === beforeRenew + 8,
  { before: beforeRenew, after: renewed.total_classes });
ok('the renewal is billed at the configured price', owed(ov) === 5500, owed(ov));

/* The guide: 0 never seen, 1 seen, 2 muted. */
ok('a new rider has not seen the guide', paidSess.student.guide === 0, paidSess.student.guide);
ok('the guide state can be stored', (await call('set_guide', { p_token: Z, p_value: 2 })).ok);
ok('and it is remembered',
  (await call('student_session', { p_token: Z })).student.guide === 2);

/* ------------------------------------------------------ self-service --*/
ok('a rider can change their own phone and PIN',
  (await call('student_update', { p_token: Z, p_phone: '01700000000', p_pin: '4321' })).ok);
ok('the old PIN stops working',
  !(await call('student_login', { p_id: zawad.id, p_name: null, p_pin: '1111', p_days: 30 })).ok);
ok('the new PIN works',
  (await call('student_login', { p_id: zawad.id, p_name: null, p_pin: '4321', p_days: 30 })).ok);

/* ------------------------------------------------ settings, staff, data --*/
const sv = await call('admin_save_settings', { p_token: A, p_data: { contact_phone: '01711', directory: 'off' } });
ok('settings save and reach the public payload', sv.ok && sv.settings.contact_phone === '01711');
ok('the name list can be switched off', (await call('bootstrap', {})).directory.length === 0);
await call('admin_save_settings', { p_token: A, p_data: { directory: 'on' } });

ok('the current admin password is required',
  (await call('admin_change_password', { p_token: A, p_current: 'nope', p_new: 'longenough' })).error === 'current');
ok('the password changes',
  (await call('admin_change_password', { p_token: A, p_current: 'alfursan', p_new: 'newpass123' })).ok);
ok('the old password stops working',
  !(await call('admin_login', { p_user: 'owner', p_pass: 'alfursan', p_days: 7 })).ok);
ok('the session that changed it survives', (await call('admin_session', { p_token: A })).ok);

const staff = await call('admin_save_user', {
  p_token: A, p_data: { username: 'coach', pass: 'coachpass', display: 'Coach', role: 'staff' }
});
ok('a staff account can be added', staff.ok);
const coach = await call('admin_login', { p_user: 'coach', p_pass: 'coachpass', p_days: 7 });
ok('staff can sign in', coach.ok && coach.admin.role === 'staff');
ok('staff cannot manage accounts',
  !(await call('admin_save_user', { p_token: coach.token, p_data: { username: 'x', pass: 'yyyyyy' } })).ok);

ok('deleting a rider needs the typed name',
  (await call('admin_delete_student', { p_token: A, p_id: itrat.id, p_confirm: 'wrong' })).error === 'confirm');
ok('deleting works with the right name',
  (await call('admin_delete_student', { p_token: A, p_id: itrat.id, p_confirm: 'itrat' })).ok);

const exp = await call('admin_export', { p_token: A });
ok('the backup contains every table',
  exp.ok && exp.data.students && exp.data.slots && exp.data.attendance && exp.data.payments && exp.data.bookings);
const liveCount = (await one('select count(*)::int c from students')).c;
const pv = await call('admin_import', { p_token: A, p_data: exp.data, p_mode: 'preview' });
ok('import previews without writing',
  pv.ok && pv.preview && pv.students === liveCount && pv.current.students === liveCount, pv);
const before = (await call('admin_session', { p_token: A })).students.length;
await call('admin_import', { p_token: A, p_data: exp.data, p_mode: 'merge' });
ok('a merge import creates no duplicates',
  (await call('admin_session', { p_token: A })).students.length === before);

/* ------------------------------------------------------------- security --*/
ok('a bogus token is refused everywhere',
  !(await call('student_session', { p_token: 'nope' })).ok &&
  !(await call('admin_session', { p_token: 'nope' })).ok &&
  !(await call('admin_save_student', { p_token: 'nope', p_data: { name: 'X', pin: '0000' } })).ok);
await call('logout', { p_token: Z });
ok('logout invalidates the token', !(await call('student_session', { p_token: Z })).ok);

/* The anon key is public. It must reach the API surface and nothing else —
   PUBLIC-by-default execute rights on helpers would expose the Telegram token
   and every rider's PIN. */
const grants = await db.query(`
  select p.proname from pg_proc p
  join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public' and p.proname like '\\_%'
    and has_function_privilege('anon', p.oid, 'execute')`).catch(() => ({ rows: [] }));
ok('internal helpers are not callable by the anon role', grants.rows.length === 0,
  grants.rows.map(r => r.proname));

const api = await db.query(`
  select p.proname from pg_proc p
  join pg_namespace ns on ns.oid = p.pronamespace
  where ns.nspname = 'public' and p.proname not like '\\_%'
    and not has_function_privilege('anon', p.oid, 'execute')`);
ok('every API function stays callable by anon', api.rows.length === 0, api.rows.map(r => r.proname));

const tables = await db.query(`
  select c.relname from pg_class c
  join pg_namespace ns on ns.oid = c.relnamespace
  where ns.nspname = 'public' and c.relkind = 'r'
    and (has_table_privilege('anon', c.oid, 'select') or not c.relrowsecurity)`);
ok('no table is directly readable by anon, and RLS is on everywhere',
  tables.rows.length === 0, tables.rows.map(r => r.relname));

/* Telegram is optional: with no token configured it must stay silent, and a
   missing pg_net must never break the booking that triggered it. */
const errs = await db.query('select count(*)::int c from error_log');
ok('a missing Telegram relay does not break anything', errs.rows[0].c === 0, errs.rows[0]);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
await db.close();
process.exit(fail ? 1 : 0);
