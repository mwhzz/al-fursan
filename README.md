# Al Fursan Equestrian Academy — PWA

Rider portal + academy console. Installable PWA, works offline for reading,
English / বাংলা, light and dark themes, no build step (plain HTML/CSS/JS).

**v2.1.0** — rebuilt end to end against [docs/UX-AUDIT.md](docs/UX-AUDIT.md) (all 62 findings fixed).

📖 **[docs/GUIDE.md](docs/GUIDE.md) — what riders and the academy can do, and how.**
The app also walks you through it on first sign-in.

---

## Quick start

```bash
npx serve .        # or: python -m http.server 8080
```

Demo logins (no backend needed — data stays in that browser):

| Role  | Login |
| ----- | ----- |
| Rider | pick **Zawad** from the list, PIN `1111` |
| Staff | tap **Staff**, `owner` / `alfursan` |

## Deploy to Vercel

```bash
npm i -g vercel && vercel --prod
```

Or push to GitHub → vercel.com → **Add New Project** → Framework Preset **Other**,
no build command.

## Connect Supabase (so every phone shares the same data)

1. Create a free project at [supabase.com](https://supabase.com).
2. **SQL Editor** → paste all of `supabase/schema.sql` → **Run**. No extensions needed.
   Creates the tables, RLS, all RPCs, the Fri/Sat/Mon/Wed × 4:00–7:20 PM slots,
   and one admin account: **owner / alfursan** — change it on first sign-in.
3. **Project Settings → API** → copy `Project URL` and the `anon public` key into `js/config.js`:

```js
window.AF_CONFIG = { url: 'https://xxxx.supabase.co', anonKey: 'eyJhbGciOi...' };
```

4. Redeploy. Everything else — academy name, days, times, capacity, contact number,
   timezone, currency, Telegram — is edited inside the app under **Settings**.

### Security model

Every table has RLS on and the anon key can't touch any of them directly. All access
goes through `security definer` functions:

- riders sign in with name + 4-digit PIN and get a **session token** — the PIN is never stored on the device
- five wrong tries locks that name for 60 seconds
- riders only ever receive their own record; other riders' PINs are never sent to the client
- staff have named accounts with roles, and every change is written to an activity log

## Notifications

| Where | What arrives | When |
| ----- | ------------ | ---- |
| Rider's app | booking confirmed / declined, class cancelled, waitlist moved up, payment received | in-app, badge on the bell |
| Console | new booking request | badge + browser notification **while the app is open** |
| **Telegram** | every booking, cancellation and absence notice | **even with the app closed** |

Telegram setup (2 minutes, once):

1. Telegram → **@BotFather** → `/newbot` → copy the token
2. Send your bot any message, then open
   `https://api.telegram.org/bot<TOKEN>/getUpdates` and copy `"chat":{"id": …}`
3. App → **Settings → Telegram alerts** → paste both → **Save** → **Send test message**

## What each role can do

**Rider** — see cycle progress and classes left · next class with countdown, coach and horse ·
book any date from a 5-week calendar with live seat counts · join a waitlist when full ·
report "can't attend" · cancel (up to the cut-off) · month-grouped history · fees with
every instalment listed · change own phone and PIN · install the app.

**Owner / staff** — mark present / absent / make-up with one tap and no scroll jump ·
"all present" per slot · add a walk-in to today's class · search the whole day ·
step through days with arrows · print the day sheet · approve, decline (with a reason) or
bulk-approve requests, each shown with the rider's balance, expiry, clashes and whether
the class is full · full rider detail: history, bookings, fees, share PIN over WhatsApp ·
**renew a course in one tap** · **fees paid in instalments**, priced per course ·
add / pause / delete class times with coach and horse · cancel a single day or a single
slot (everyone booked is told) · attention list for expiring courses, exhausted balances
and unpaid fees · export **and restore** backups · named staff accounts, password change,
activity log.

## Fees

Course prices are set once in Settings — Basic ৳5,500, Advanced ৳12,000, Private ৳15,000
by default. A fee is raised per cycle and **paid in as many instalments as the rider
needs**: each payment is recorded with its date and method, the app refuses anything above
what is owed, and both sides see the same running balance.

## Structure

```text
index.html              app shell
css/styles.css          light + dark themes, one token set
js/config.js            Supabase keys + logo path      ← the only file you edit
js/i18n.js              English / বাংলা
js/api.js               RPC layer, session tokens, offline + error reporting
js/demo.js              localStorage backend with the identical contract
js/ui.js                router, dialogs, theme, timezone-aware dates
js/student.js           rider app
js/admin.js             academy console
js/app.js               sign-in, boot, PWA
supabase/schema.sql     tables, RLS, RPCs, seed, Telegram relay
sw.js                   offline cache + "new version" prompt
docs/UX-AUDIT.md        the 62-point audit this version was built from
```

## Courses

| Course   | Classes | Duration |
| -------- | ------- | -------- |
| Basic    | 8       | 1 month  |
| Advanced | 16      | 2 months |
| Private  | custom  | custom   |

Slot capacity defaults to 3 riders and is set per slot. Only **confirmed** bookings fill a
seat — pending requests are shown separately so a slot never looks full before you decide.

## Your logo

The app ships with its own mark (`assets/icon.svg`). To use the academy logo, drop
`assets/logo.png` in and point `js/config.js` at it:

```js
logo: 'assets/logo.png'
```

## Tests

```bash
cd tests && npm i
node sql.mjs     # 64 checks against real PostgreSQL (schema.sql in PGlite)
node logic.mjs   # 67 checks on the demo backend
node ui.mjs      # 88 checks driving both apps through jsdom
```

- **`sql.mjs`** loads `supabase/schema.sql` into an actual PostgreSQL (PGlite/WASM) and
  calls the RPCs the way PostgREST does. It exists because everything else talks to the
  demo backend, and three bugs once shipped that only existed in SQL. It also asserts the
  privilege model: no table readable by `anon`, RLS on everywhere, internal helpers
  unreachable, every API function reachable.
- **`logic.mjs`** runs the same journeys against the localStorage backend, so the two
  stay interchangeable.
- **`ui.mjs`** drives the real screens: sign-in, booking, back-button behaviour,
  attendance marking, approvals, rider editing, settings.
