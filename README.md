# Al Fursan Equestrian Academy — PWA

Rider portal + academy console. Installable PWA, works offline for reading,
English / বাংলা, light and dark themes, no build step (plain HTML/CSS/JS).

**v2.2.0** — rebuilt end to end against [docs/UX-AUDIT.md](docs/UX-AUDIT.md) (all 62 findings fixed).

📖 **[docs/GUIDE.md](docs/GUIDE.md) — what riders and the academy can do, and how.**
The app also walks you through it on first sign-in.

---

## Quick start

```bash
npx serve .        # or: python -m http.server 8080
```

This runs with no backend at all — sample riders, data kept in that browser only:

| Role  | Login |
| ----- | ----- |
| Rider | pick **Zawad** from the list, PIN `1111` |
| Staff | tap **Staff**, `owner` / `alfursan` |

The `owner` account is for looking around locally. A deployed site never has it —
it gets the real owner accounts below and no sample riders.

## Deploy to Netlify — nothing else to sign up for

The site ships with its own backend: one Netlify Function
(`netlify/functions/api.js`) storing everything in **Netlify Blobs**, which comes
with the site. No database account, no third party.

1. Push this repo to GitHub.
2. netlify.com → **Add new site → Import an existing project** → pick the repo.
3. Accept the defaults and deploy — `netlify.toml` already sets the build command
   (`node build.js`), the publish directory (`dist`) and the function directory.

That's it — riders on their own phones all see the same data. Every later push to
`main` redeploys.

**Check it is really running the backend** — open `https://<your-site>/api/rpc` in
a browser. It should answer `{"ok":false,"error":"method"}` (it only accepts POST).
If you get a 404, the function did not deploy.

`build.js` copies only the app into `dist/`, so `node_modules`, the test suite and
`supabase/schema.sql` are never published.

**On first load the site creates itself**: the class times (Fri/Sat/Mon/Wed at
4:00–7:20 PM), the course prices, and the two owner accounts:

| Staff sign-in | Password |
| --- | --- |
| `tahiya` | `Tahiya#Fursan26` |
| `fahim` | `Fahim#Fursan26` |

Change both from **Settings → Change password** on first sign-in — these are
written in this repository, so they are not secret. There are no sample riders on
a live site; add your own from **Riders → +**.

### Your own domain

Netlify → **Domain management → Add a domain**. Point your registrar at Netlify's
nameservers (or add the CNAME Netlify shows you). HTTPS is issued automatically;
the app needs it for install-to-home-screen and notifications.

### Running it locally

```bash
npm i -g netlify-cli
npm i          # once, for @netlify/blobs
netlify dev    # serves the site and the function together
```

Opening `index.html` without `netlify dev` still works — the app notices there is
no function and runs entirely in that browser, with sample riders, so you can look
around. Nothing is shared in that mode.

### Where the data lives

One JSON blob in the site's Blobs store, written only when something changes. Back
it up from **Settings → Export**; restore from the same screen. Reads never write,
so the id of a class time never changes underneath a booking.

One caveat: the function reads and writes the whole blob, so two people saving in
the same second could have one overwrite the other. At an academy's traffic that
does not come up; if it ever does, move to Supabase below, which does not have the
limitation.

## Or connect Supabase (Postgres, if you prefer)

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
index.html               app shell
netlify.toml             hosting, the /api/rpc route, cache headers
netlify/functions/api.js the backend on Netlify (Blobs)
css/styles.css           light + dark themes, one token set
js/config.js             backend choice + logo path      ← usually the only edit
js/i18n.js               English / বাংলা
js/store.js              the rules, shared by the browser and the function
js/demo.js               that store, kept in localStorage
js/api.js                picks a backend, session tokens, offline, error reports
js/ui.js                 router, dialogs, theme, timezone-aware dates
js/guide.js              the first-run walkthrough
js/student.js            rider app
js/admin.js              academy console
js/app.js                sign-in, boot, PWA
supabase/schema.sql      the same rules again, for Postgres
sw.js                    offline cache + "new version" prompt
docs/GUIDE.md            how to use both apps
docs/UX-AUDIT.md         the 62-point audit this version was built from
```

`js/store.js` is the single implementation of the rules for the browser and the
Netlify function, so those two can never drift. `supabase/schema.sql` is the same
rules in SQL, and `tests/sql.mjs` runs them against a real PostgreSQL to keep the
two honest.

## Courses

| Course   | Classes | Duration |
| -------- | ------- | -------- |
| Basic    | 8       | 1 month  |
| Advanced | 16      | 2 months |
| Private  | custom  | custom   |

Slot capacity defaults to 3 riders and is set per slot. Only **confirmed** bookings fill a
seat — pending requests are shown separately so a slot never looks full before you decide.

## Logos and icons

Two different images, on purpose.

**The app icon** — home screen, browser tab, notifications. Generated from
`assets/icon-source.jpg`, cropped square onto the galloping group so every horse
is in frame and centred:

```text
assets/icon-192.png          Android / PWA
assets/icon-512.png          PWA, splash
assets/icon-maskable.png     Android adaptive (head inside the safe circle)
assets/apple-touch-icon.png  iOS home screen
assets/favicon-16/32/48.png  browser tab
```

To change it, replace `assets/icon-source.jpg` and regenerate — crop square on the
subject, then export those seven sizes.

**The logo inside the app** — sign-in screen and top bar — is `assets/logo.png`,
the same crop. To use a different one, replace that file (`js/config.js` → `logo`
points at it). If it is ever missing the app falls back to `assets/logo.svg`, a
chrome horseshoe with an AF monogram.

**The sign-in backdrop** is the full photograph, `assets/hero.jpg`, behind a scrim
so the card stays readable in both themes.

## Tests

```bash
cd tests && npm i && npm test
```

| Suite | Checks | What it covers |
| --- | --- | --- |
| `sql.mjs` | 83 | `schema.sql` in a real PostgreSQL (PGlite), called the way PostgREST does |
| `logic.mjs` | 75 | the same journeys against the shared store |
| `netlify.mjs` | 28 | the hosted endpoint, with storage faked |
| `ui.mjs` | 101 | both apps driven through jsdom |

- **`sql.mjs`** loads `supabase/schema.sql` into an actual PostgreSQL (PGlite/WASM) and
  calls the RPCs the way PostgREST does. It exists because everything else talks to the
  demo backend, and three bugs once shipped that only existed in SQL. It also asserts the
  privilege model: no table readable by `anon`, RLS on everywhere, internal helpers
  unreachable, every API function reachable.
- **`logic.mjs`** runs the same journeys against the localStorage backend, so the two
  stay interchangeable.
- **`ui.mjs`** drives the real screens: sign-in, booking, back-button behaviour,
  attendance marking, approvals, rider editing, settings.
