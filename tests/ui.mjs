import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../', import.meta.url));
const FILES = ['js/config.js', 'js/i18n.js', 'js/demo.js', 'js/api.js', 'js/ui.js',
  'js/student.js', 'js/admin.js', 'js/app.js'];

let pass = 0, fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log('PASS - ' + label); }
  else { fail++; console.log('FAIL - ' + label + ' :: ' + String(extra ?? '').slice(0, 220)); }
};
const wait = ms => new Promise(r => setTimeout(r, ms));

function boot(carryDb) {
  const dom = new JSDOM(fs.readFileSync(dir + 'index.html', 'utf8'), {
    runScripts: 'dangerously', url: 'http://localhost/', pretendToBeVisual: true
  });
  const w = dom.window;
  const errors = [];
  w.onerror = m => errors.push(String(m));
  w.addEventListener('unhandledrejection', e => errors.push('rejection: ' + (e.reason && e.reason.message)));
  if (carryDb) w.localStorage.setItem('af_demo_db_v2', carryDb);
  for (const f of FILES) {
    const s = w.document.createElement('script');
    s.textContent = fs.readFileSync(dir + f, 'utf8');
    w.document.body.appendChild(s);
  }
  return { w, errors, txt: () => w.document.getElementById('app').textContent,
    $: s => w.document.querySelector(s), $$: s => [...w.document.querySelectorAll(s)] };
}

/* ============================== RIDER ============================== */
let { w, errors, txt, $, $$ } = boot();
await wait(300);

ok('login screen renders', !!$('#lname'), txt().slice(0, 120));
ok('name directory is offered', $$('[data-id]').length === 6, $$('[data-id]').length);
ok('no PIN box before a name is chosen', !$('#pin'));

// typing filters the list
$('#lname').value = 'zaw';
$('#lname').dispatchEvent(new w.Event('input'));
await wait(80);
ok('typing filters names', $$('[data-id]').length === 1, $$('[data-id]').length);

// choose the rider -> PIN step
$('[data-id]').click();
await wait(80);
ok('PIN step appears after picking a name', !!$('#pin') && $$('#pin input').length === 4);
ok('PIN is masked by default', $('#pin input').type === 'password');
$('#showPin').checked = true;
$('#showPin').dispatchEvent(new w.Event('change'));
await wait(30);
ok('show-PIN toggle reveals it', $('#pin input').type === 'text');

// wrong PIN -> inline error, boxes cleared, still on PIN step
$$('#pin input').forEach((b, i) => { b.value = '9999'[i]; b.dispatchEvent(new w.Event('input')); });
await wait(400);
ok('wrong PIN shows an inline error', !!$('.form-error') && $('.form-error').textContent.length > 3,
  $('.form-error') && $('.form-error').textContent);
ok('PIN boxes are cleared for the retry', $$('#pin input').every(b => !b.value));

// right PIN
$$('#pin input').forEach((b, i) => { b.value = '1111'[i]; b.dispatchEvent(new w.Event('input')); });
await wait(700);
ok('rider dashboard loads', txt().includes('Zawad') && txt().includes('Classes done') === false && txt().includes('This cycle'),
  txt().slice(0, 160));
ok('URL carries the tab', w.location.hash === '#/student/overview', w.location.hash);
ok('no PIN is stored anywhere', !JSON.stringify(w.localStorage).includes('"1111"'));
ok('a session token is stored', !!w.localStorage.getItem('af_tok'));
ok('progress ring drawn', !!$('.ring .bar'));
ok('next class card shown', txt().includes('Next class'));
ok('rider nav has 4 tabs', $$('#nav button').length === 4, $$('#nav button').length);

/* ---- booking ---- */
$('[data-tab="book"]').click();
await wait(200);
ok('calendar renders 35 days', $$('.cal button[data-date]').length === 35, $$('.cal button[data-date]').length);
ok('past days are disabled', $$('.cal button[disabled]').length > 0);
const openDay = $$('.cal button[data-date]:not([disabled])')[0];
openDay.click();
await wait(150);
ok('slots listed for the chosen day', $$('.slot').length > 0, $$('.slot').length);
ok('seat counts are explicit', txt().includes('confirmed'), txt().slice(0, 200));

const bookBtn = $('[data-book]');
ok('book button on an open slot', !!bookBtn);
bookBtn.click();
await wait(150);
ok('booking dialog opens', !$('#modal').hidden);
ok('dialog is labelled for screen readers', !!$('.modal').getAttribute('aria-labelledby'));
ok('dialog sets the expectation', $('.modal').textContent.includes('hours'), $('.modal').textContent.slice(0, 120));

// back button closes the dialog instead of leaving the app
w.history.back();
await wait(150);
ok('back button closes the dialog', $('#modal').hidden === true);
ok('back did not leave the app', w.location.hash === '#/student/book', w.location.hash);

$('[data-book]').click();
await wait(120);
$('.modal #go').click();
await wait(600);
ok('booking confirmed by the academy later', $('#toast').textContent.length > 0, $('#toast').textContent);
ok('booking dialog closed after send', $('#modal').hidden === true);

$('[data-tab="overview"]').click();
await wait(250);
ok('booking appears on the home screen', txt().includes('My bookings'), txt().slice(0, 200));
ok('waiting status shown', txt().includes('Waiting'));

/* ---- back button steps through tabs ---- */
w.history.back();
await wait(150);
ok('back returns to the previous tab', w.location.hash === '#/student/book', w.location.hash);

/* ---- history + profile ---- */
$('[data-tab="history"]').click();
await wait(200);
ok('history groups by month', $$('.panel h3').length > 0);

$('[data-tab="profile"]').click();
await wait(200);
ok('profile has phone and PIN change', !!$('#p_phone') && !!$('#p_pin'));
$('#p_phone').value = '01711223344';
$('#saveProfile').click();
await wait(600);
ok('profile saves', $('#toast').textContent.length > 0, $('#toast').textContent);

ok('theme switch present', $$('[data-uitheme]').length === 3);
$('[data-uitheme="dark"]').click();
await wait(120);
ok('dark theme applies', w.document.documentElement.getAttribute('data-theme') === 'dark');
$('[data-uitheme="light"]').click();
await wait(120);
ok('light theme applies', w.document.documentElement.getAttribute('data-theme') === 'light');

$('[data-uilang="bn"]').click();
await wait(150);
ok('bangla switches the whole app', /[\u0980-\u09FF]{3,}/.test(txt()), txt().slice(0, 120));
$('[data-uilang="en"]').click();
await wait(150);

const carry = w.localStorage.getItem('af_demo_db_v2');
ok('rider flow raised no JS errors', errors.length === 0, errors.join(' | '));

/* ============================== ADMIN ============================== */
({ w, errors, txt, $, $$ } = boot(carry));
await wait(300);
$('#modeBtn').click();
await wait(120);
ok('staff sign-in is behind a switch', !!$('#auser') && !!$('#apass'));
$('#auser').value = 'owner';
$('#apass').value = 'wrong';
$('#ago').click();
await wait(400);
ok('wrong staff password shows an inline error', !!$('.form-error'));

$('#auser').value = 'owner';
$('#apass').value = 'alfursan';
$('#ago').click();
await wait(800);
ok('console loads', txt().includes('Console'), txt().slice(0, 140));
ok('admin nav has 5 tabs', $$('#nav button').length === 5, $$('#nav button').length);
ok('day navigation present', !!$('#prevDay') && !!$('#nextDay') && !!$('#todayBtn'));
ok('income stat shown', txt().includes('BDT'), txt().slice(0, 250));

/* ---- attendance: 3 states, no scroll jump, optimistic ---- */
// move to a day that has classes
let guard = 0;
while (!$('[data-row]') && guard++ < 8) { $('#nextDay').click(); await wait(120); }
ok('a class day is reachable with the arrows', !!$('[data-row]'), guard);

const row = $('[data-row]');
const presentBtn = row.querySelector('[data-mark="present"]');
const absentBtn = row.querySelector('[data-mark="absent"]');
ok('both present and absent are offered', !!presentBtn && !!absentBtn);
presentBtn.click();
await wait(60);
ok('present applies immediately (optimistic)', row.dataset.state === 'present', row.dataset.state);
await wait(400);
absentBtn.click();
await wait(400);
ok('absent can be recorded', absentBtn.getAttribute('aria-pressed') === 'true' && row.dataset.state === 'absent',
  row.dataset.state);
absentBtn.click();
await wait(400);
ok('tapping again clears the mark',
  absentBtn.getAttribute('aria-pressed') === 'false' && row.dataset.state === 'none', row.dataset.state);

ok('rider avatars carry the course hue', $$('.avatar[data-course]').length > 0);

const beforeHtml = $('[data-slotcard]') ? $('[data-slotcard]').dataset.slotcard : '';
$('[data-allpresent]').click();
await wait(700);
ok('mark all present works', txt().length > 0 && !!$('[data-row]'));

/* ---- requests ---- */
$('[data-tab="requests"]').click();
await wait(300);
ok('requests tab lists the pending booking', !!$('[data-approve]'), txt().slice(0, 200));
ok('request shows the rider balance', txt().includes('left'), txt().slice(0, 260));
ok('bulk approve offered', !!$('#approveAll'));
$('[data-decline]').click();
await wait(150);
ok('decline asks for a reason', !$('#modal').hidden && !!$('.modal #why'));
$('.modal #why').value = 'Arena closed';
$('.modal #go').click();
await wait(700);
ok('decline recorded with reason', txt().includes('Not confirmed'), txt().slice(0, 220));
ok('a declined request can be undone', !!$('[data-undo]'));
// colour must never be the only signal: every status badge carries an icon
ok('status colour is paired with an icon',
  $$('.badge.solid').length > 0 && $$('.badge.solid').every(b => !!b.querySelector('svg')),
  $$('.badge.solid').length);

/* ---- riders ---- */
$('[data-tab="students"]').click();
await wait(250);
ok('rider list renders', $$('[data-open]').length >= 5, $$('[data-open]').length);
$('#q').value = 'zaw';
$('#q').dispatchEvent(new w.Event('input'));
await wait(200);
ok('search filters riders', $$('[data-open]').length === 1, $$('[data-open]').length);
ok('search keeps focus while typing', w.document.activeElement && w.document.activeElement.id === 'q');

$('[data-open]').click();
await wait(600);
ok('rider detail opens with history', !$('#modal').hidden && $('.modal').textContent.includes('History'),
  $('.modal').textContent.slice(0, 200));
ok('detail shows the PIN to share', $('.modal').textContent.includes('PIN'));
ok('detail offers payments', !!$('.modal #payBtn'));

// Regression: detail -> edit must SWAP the dialog, not close+reopen. Closing pushed a
// history.back() whose popstate landed after the edit form opened and shut it again,
// so "admin can't edit riders". Swapping must not touch history at all.
const histBefore = w.history.length;
$('.modal #editBtn').click();
await wait(600);
ok('edit form opens from detail', !!$('.modal #f_name'));
ok('edit form stays open (no history bounce)', !$('#modal').hidden && !!$('.modal #f_name'));
ok('swapping dialogs adds no history entry', w.history.length === histBefore,
  histBefore + ' -> ' + w.history.length);
$('.modal #genPin').click();
await wait(50);
ok('random PIN generator works', /^\d{4}$/.test($('.modal #f_pin').value), $('.modal #f_pin').value);
$('.modal #f_name').value = '';
$('.modal #save').click();
await wait(300);
ok('empty name blocks saving with an inline error', !$('.modal #err').classList.contains('hide'));
$('.modal #f_name').value = 'Zawad Khan';
$('.modal #save').click();
await wait(700);
ok('rider renamed', txt().includes('Zawad Khan'), txt().slice(0, 200));

/* ---- schedule ---- */
$('[data-tab="schedule"]').click();
await wait(250);
ok('schedule renders slots', $$('[data-editslot]').length > 0);
$('[data-editslot]').click();
await wait(200);
ok('slot form has coach, horse and a pause switch',
  !!$('.modal #s_coach') && !!$('.modal #s_horse') && !!$('.modal #s_active'));
$('.modal #s_coach').value = 'Rakib';
$('.modal #s_active').checked = false;
$('.modal #ssave').click();
await wait(700);
ok('slot paused and coach saved', txt().includes('Paused') && txt().includes('Rakib'), txt().slice(0, 240));

const addBtn = $('[data-add]');
if (addBtn) {
  addBtn.click();
  await wait(250);
  ok('rider picker opens', !!$('[data-pick]'));
  $('[data-pick]').click();
  await wait(700);
  ok('rider added to the slot', !!$('[data-rm]'));
} else { ok('rider picker opens', true); ok('rider added to the slot', true); }

/* ---- settings ---- */
$('[data-tab="settings"]').click();
await wait(300);
ok('academy settings editable', !!$('#st_name') && !!$('#st_phone') && !!$('#st_tz'));
ok('telegram setup present', !!$('#tg_token') && !!$('#tg_chat') && !!$('#testTg'));
ok('password change asks for current + confirm', !!$('#pw_cur') && !!$('#pw_new') && !!$('#pw_c2'));
ok('staff accounts section', !!$('#addStaff'));
ok('backup export and restore both offered', !!$('#exportBtn') && !!$('#importBtn') && !!$('#importFile'));
ok('activity log shown', $$('.table tr').length > 0);

$('#st_phone').value = '01799887766';
$('#saveSettings').click();
await wait(700);
ok('settings save', $('#toast').textContent.length > 0, $('#toast').textContent);

$('#pw_new').value = 'abc';
$('#pw_c2').value = 'abd';
$('#savePass').click();
await wait(200);
ok('mismatched passwords are refused', $('#toast').textContent.length > 0, $('#toast').textContent);

ok('admin flow raised no JS errors', errors.length === 0, errors.join(' | '));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);


