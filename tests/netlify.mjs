/* -----------------------------------------------------------------------
   The Netlify function that backs the hosted site: same store as the browser,
   data in Netlify Blobs. Storage is faked here so the endpoint can be tested
   without deploying.
------------------------------------------------------------------------- */
import { makeHandler, PUBLIC } from '../netlify/functions/api.mjs';

let pass = 0, fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log('PASS - ' + label); }
  else { fail++; console.log('FAIL - ' + label + ' :: ' + JSON.stringify(extra ?? '').slice(0, 220)); }
};

/* a Blobs stand-in: one JSON value, held in memory */
let blob = null;
let writes = 0;
const fakeStore = {
  async get() { return blob; },
  async setJSON(key, value) { writes++; blob = JSON.parse(JSON.stringify(value)); }
};
const handler = makeHandler(async () => fakeStore);

const URL_ = 'https://academy.test/api/rpc';
const req = (method, body) => new Request(URL_, {
  method, headers: { 'Content-Type': 'application/json' },
  body: method === 'POST' ? body : undefined
});
const post = async (fn, args) => {
  const res = await handler(req('POST', JSON.stringify({ fn, args: args || {} })));
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : {} };
};

/* ---------------------------------------------------------- the endpoint --*/
ok('OPTIONS is answered for CORS', (await handler(req('OPTIONS'))).status === 204);
ok('GET is refused', (await handler(req('GET'))).status === 405);
ok('a broken body is refused', (await handler(req('POST', '{oops'))).status === 400);
ok('an unknown function name is refused',
  (await handler(req('POST', JSON.stringify({ fn: 'DROP TABLE' })))).status === 400);
ok('a private call without a token is refused',
  (await post('admin_session', {})).status === 401);
ok('a function that does not exist is a 404',
  (await post('not_a_real_function', { p_token: 'x' })).status === 404);

/* ------------------------------------------------------ a fresh academy --*/
const boot = await post('bootstrap', {});
ok('the first request creates the academy', boot.status === 200 && boot.body.ok, boot.body);
ok('it starts with no riders', boot.body.directory.length === 0, boot.body.directory);
ok('and with the class times already set up', blob && blob.slots.length === 20, blob && blob.slots.length);
ok('the fresh academy is saved immediately', writes === 1, writes);

/* slot ids must be stable, or a rider books against an id that no longer exists */
const boot2 = await post('bootstrap', {});
ok('a second read does not rewrite it', writes === 1, writes);
ok('the class times keep the same ids across requests',
  JSON.stringify(boot2.body.settings) === JSON.stringify(boot.body.settings), boot2.body.settings);
const idsA = blob.slots.map(s => s.id).join();
await post('bootstrap', {});
ok('and again after another request', blob.slots.map(s => s.id).join() === idsA);

const admin = await post('admin_login', { p_user: 'tahiya', p_pass: 'Tahiya#Fursan26', p_days: 7 });
ok('an owner account works', admin.body.ok && admin.body.token, admin.body);
ok('signing in is persisted', writes === 2, writes);
const A = admin.body.token;

ok('a wrong password is refused', !(await post('admin_login', { p_user: 'tahiya', p_pass: 'nope' })).body.ok);
ok('both owners exist on a live site',
  (await post('admin_login', { p_user: 'fahim', p_pass: 'Fahim#Fursan26', p_days: 7 })).body.ok);

/* the demo account's password is published in this repository, so it must not
   exist on a real academy */
ok('the demo account does not exist live',
  !(await post('admin_login', { p_user: 'owner', p_pass: 'alfursan' })).body.ok);
ok('only the two owners are seeded', blob.admins.length === 2,
  blob.admins.map(a => a.username));

/* --------------------------------------------------- a real day of use --*/
const rider = await post('admin_save_student', {
  p_token: A,
  p_data: { name: 'Zawad', pin: '1111', course: 'basic', total_classes: 8,
            start_date: blob.settings.timezone ? new Date().toISOString().slice(0, 10) : null,
            tags: [], active: true }
});
ok('the owner can add a rider', rider.body.ok, rider.body);

const dir2 = await post('bootstrap', {});
ok('the rider appears in the sign-in list', dir2.body.directory.length === 1, dir2.body.directory);

const login = await post('student_login', { p_id: rider.body.id, p_name: null, p_pin: '1111', p_days: 30 });
ok('the rider can sign in', login.body.ok && login.body.token, login.body);
const Z = login.body.token;

const sess = await post('student_session', { p_token: Z });
ok('the rider gets their card', sess.body.ok && sess.body.student.name === 'Zawad', sess.body.student);
ok('and no PIN is sent to the browser', JSON.stringify(sess.body).indexOf('"1111"') === -1);

const slot = sess.body.schedule.find(s => s.time === '16:00');
const d = new Date();
d.setDate(d.getDate() + ((slot.day - d.getDay() + 7) % 7));
const date = new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);

const booked = await post('student_book', { p_token: Z, p_slot: slot.id, p_date: date, p_note: '' });
ok('the rider can book a class', booked.body.ok && booked.body.status === 'pending', booked.body);

const con = await post('admin_session', { p_token: A });
ok('the booking reaches the console', con.body.bookings.length === 1 && con.body.bookings[0].student === 'Zawad',
  con.body.bookings);

const approved = await post('admin_booking_action', {
  p_token: A, p_ids: [con.body.bookings[0].id], p_action: 'approve', p_reason: ''
});
ok('the owner can confirm it', approved.body.ok && approved.body.count === 1, approved.body);

const after = await post('student_session', { p_token: Z });
ok('the rider sees it confirmed', after.body.bookings[0].status === 'approved', after.body.bookings);
ok('and is notified', after.body.notifications.some(x => x.kind === 'approved'));

/* ------------------------------------------- notifications with app closed --*/
ok('push signing keys are created automatically',
  !!blob.settings.vapid_public && !!blob.settings.vapid_private, Object.keys(blob.settings).length);
ok('only the public key reaches the browser',
  (await post('bootstrap', {})).body.settings.vapid_public === blob.settings.vapid_public &&
  (await post('bootstrap', {})).body.settings.vapid_private === undefined);

const sub = {
  endpoint: 'https://push.example/endpoint-1',
  keys: { p256dh: 'BJ' + 'x'.repeat(85), auth: 'y'.repeat(22) }
};
ok('a phone can register for push', (await post('push_subscribe', { p_token: A, p_sub: sub })).body.ok);
ok('the subscription is stored once', blob.pushSubs.length === 1, blob.pushSubs);
await post('push_subscribe', { p_token: A, p_sub: sub });
ok('registering twice does not duplicate it', blob.pushSubs.length === 1, blob.pushSubs.length);
ok('a rider cannot register for the console alerts',
  !(await post('push_subscribe', { p_token: Z, p_sub: sub })).body.ok);

/* A booking must try to deliver. The endpoint is fake, so the push service
   rejects it — what matters is that the attempt happens and the request still
   succeeds for the rider. */
const slot2 = sess.body.schedule.find(s => s.time === '16:50');
const d2 = new Date();
d2.setDate(d2.getDate() + ((slot2.day - d2.getDay() + 7) % 7));
const date2 = new Date(d2.getTime() - d2.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const booked2 = await post('student_book', { p_token: Z, p_slot: slot2.id, p_date: date2, p_note: '' });
ok('a booking still succeeds when push delivery fails', booked2.body.ok, booked2.body);

ok('the test alert reports how many phones are registered',
  (await post('admin_notify_test', { p_token: A })).body.devices >= 0);
ok('a phone can unregister',
  (await post('push_unsubscribe', { p_token: A, p_endpoint: sub.endpoint })).body.ok &&
  blob.pushSubs.length === 0, blob.pushSubs);

/* everything survives a cold start, because it lives in the blob */
const revived = makeHandler(async () => fakeStore);
const cold = await revived(req('POST', JSON.stringify({ fn: 'student_session', args: { p_token: Z } })));
ok('a new function instance still knows the session', (await cold.json()).ok);

ok('the public surface is the sign-in path plus guest booking',
  [...PUBLIC].sort().join(',') ===
    'admin_login,bootstrap,guest_book,guest_bookings,guest_cancel,log_error,logout,student_login',
  [...PUBLIC]);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
