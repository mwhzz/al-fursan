# Al Fursan — UX Audit (v1.0)

> **Status: all 62 findings were fixed in v2.0.0.** This document is kept as the record of
> what was wrong and why each change was made. See `README.md` for how v2 works.
>
> Headline changes: name-picker sign-in with PIN recovery · rider gets notified back ·
> calendar booking with waitlists and absence notices · three-state attendance that never
> loses your scroll position · rider detail, bulk actions and day closures for the owner ·
> fees · backup **restore** · light theme · working back button · Telegram alerts that
> arrive with the app closed · session tokens instead of stored PINs.

End-to-end review of the shipped PWA: every screen a rider or the owner touches, from the
sign-in box to the attendance tap. **62 findings**, grouped by flow.

| Priority | Count | Meaning |
| --- | --- | --- |
| **P0** | 12 | People get stuck, lose data, or can't do the thing the app exists for |
| **P1** | 27 | Works, but costs time, trust, or a phone call to the academy |
| **P2** | 23 | Rough edges and missing affordances — fix in batches |

Nothing below has been implemented. Each finding is written as **Now** (what happens today)
→ **Change** (what it should do).

---

## A. Getting in

The sign-in box is the app's front door and the most brittle part of it. A rider who can't
get past it has no second option inside the app.

### A1 · P0 — Login demands the name spelled exactly as the admin typed it
- **Now:** A rider saved as "Zawad Khan" cannot sign in as "Zawad". A trailing space, a nickname, an English/Bangla spelling difference — all fail with the same "Name or PIN is incorrect".
- **Change:** Replace free text with a searchable name list (public endpoint returning display names only), then the PIN. Tap your name, type four digits.

### A2 · P0 — No way to recover a forgotten PIN
- **Now:** Nothing on the login screen tells a rider what to do. Dead end until they meet the owner in person.
- **Change:** "Forgot PIN?" opening a WhatsApp / call link to the academy number, set once in config.

### A3 · P1 — Failed login leaves the form in a broken state
- **Now:** The error is a toast that disappears in 2.6s. The four PIN boxes stay filled with wrong digits, focus stays put, so the next attempt needs manual deleting.
- **Change:** Persistent inline error, PIN auto-cleared, focus returned to the first box.

### A4 · P1 — PIN is typed in the open
- **Now:** Digits render at 1.5rem in plain view. At a stable, phones are held in groups.
- **Change:** Mask each digit to a dot shortly after entry, with a show/hide toggle.

### A5 · P1 — One "Keep me signed in" box governs both riders and the admin password
- **Now:** Checked by default. On a shared tablet the last rider stays signed in — and when the owner logs in, the admin password itself is written to that device's storage.
- **Change:** Separate the two. Default off for admin; offer "this is a shared device" which keeps nothing.

### A6 · P1 — Admin login is offered to riders as an equal choice
- **Now:** The segmented control puts "Admin login" beside "Student login". Children tap it and get stuck at a password box.
- **Change:** Hide behind a long-press on the logo or an `#admin` URL.

### A7 · P2 — Unlimited PIN attempts
- **Now:** 10,000 combinations, no backoff. Anyone who knows a rider's name can grind it.
- **Change:** Five wrong tries → 60s cooldown, enforced server-side.

### A8 · P2 — Offline sign-in fails as a generic connection error
- **Now:** It's an installable app with an offline cache, but login never says "you're offline". The `offline` string in `js/i18n.js` is rendered nowhere.
- **Change:** Detect offline, show a banner, let a previously signed-in rider open their cached card.

---

## B. The rider's app

Answers "how many classes have I done" well, and almost nothing else a rider or parent asks.

### B1 · P0 — Nothing ever reaches the rider
- **Now:** Approved, declined, class cancelled, course expiring — the rider only finds out by opening the app and noticing. All notification plumbing points one way, to the admin.
- **Change:** Push status changes back (web push, or WhatsApp/SMS from the approve action). At minimum a "what changed since you last looked" strip.

### B2 · P0 — "Valid till" shows a bare number and never says expired
- **Now:** The third stat tile reads e.g. `18` under a tiny label — 18 of what isn't clear. Past the end date it clamps to `0` forever, with no renewal prompt.
- **Change:** Show the actual date plus "18 days left"; under 7 days a renew prompt; expired gets its own state and colour.

### B3 · P1 — Every rider sees every other rider's full name and weekly timetable
- **Now:** The schedule tab lists all riders in all slots to anyone with any student PIN. Most are children.
- **Change:** Show "2 of 3 booked" and the rider's own name. First name + initial at most. Full rosters admin-only.

### B4 · P1 — No way to refresh
- **Now:** Data is fetched once at app start; no pull-to-refresh, no refresh control, no "updated 2 min ago".
- **Change:** Pull-to-refresh, refresh on app resume, last-updated timestamp.

### B5 · P1 — History is a flat list, and two of its three states can never happen
- **Now:** No month grouping or totals. It renders Absent and Make-up badges, but the admin UI cannot produce either (see D1) — the legend describes states that don't exist.
- **Change:** Group by month with per-month counts; make the badges real by shipping D1.

### B6 · P1 — Nothing about fees
- **Now:** No amount, due date, paid/unpaid state or receipt anywhere. First question a parent asks; the app can't answer it.
- **Change:** A payment record per course cycle: amount, due date, paid on. Show state on the rider's card; admin marks paid.

### B7 · P1 — A rider can't say "I can't come today"
- **Now:** No absence notice. The seat is held, the owner waits, the class is marked blind afterwards.
- **Change:** "Can't attend" on the next class → frees the seat, notifies the admin.

### B8 · P2 — A rider can't see or change their own details
- **Now:** No profile screen. PIN, phone and name are admin-only, so every correction is a phone call.
- **Change:** A small profile page: change PIN, update phone, view course details.

### B9 · P2 — A class is only a time
- **Now:** No coach, horse, arena or lesson length.
- **Change:** Optional coach and horse per slot, shown on the next-class card.

### B10 · P2 — "Next class" gives a weekday but no date and no countdown
- **Now:** "Friday · 4:00 PM". Which Friday, and how far away, is left to the reader.
- **Change:** "Friday 16 Aug · in 2 days", switching to a live countdown on the day.

### B11 · P2 — Progress is course-total only, though courses are billed monthly
- **Now:** The ring counts every class ever. For an 8-class month, "what have I done this month" is the number that matters.
- **Change:** Ring for the current cycle, lifetime total as a secondary figure.

### B12 · P2 — Empty states offer no next step
- **Now:** A grey icon and one grey line. "No classes recorded yet" is where a new rider lands on day one.
- **Change:** Give each empty state an action — book your first class, contact the academy.

### B13 · P2 — Course, tags and status all look identical
- **Now:** Same pill, same size, so "Advanced", "jumping" and "Inactive" carry equal weight.
- **Change:** One prominent course chip; tags smaller and quieter; status only when abnormal.

### B14 · P2 — The clock icon means two different things
- **Now:** "History" in the rider tab bar, "Requests" in the admin one.
- **Change:** One icon per concept across both apps.

---

## C. Booking a class

The newest feature and the least finished. Works for "book me into the next Friday slot" and
breaks down for everything else a real week throws at it.

### C1 · P0 — Only the next occurrence of a weekday can be booked
- **Now:** Pick Friday and you get this coming Friday. No date picker, so booking a week or month ahead is impossible and availability beyond the next four dates is invisible.
- **Change:** A month / two-week calendar showing seats per slot per date, with the date as the primary choice.

### C2 · P0 — "Pending" sets no expectation
- **Now:** The rider sends a request and sees a grey chip. No "usually confirmed within a day", no submitted time, no nudge. If the owner doesn't open the app, it sits forever.
- **Change:** Show when it was sent and the expected reply window; auto-expire stale requests and tell the rider.

### C3 · P1 — Cancel is one unguarded tap
- **Now:** A bare ✕ cancels immediately — no confirmation, no cut-off rule, no reason, and the admin isn't told.
- **Change:** Confirm, block cancellation inside a set window before class, capture a reason, notify the admin.

### C4 · P1 — Unconfirmed requests make a slot look full
- **Now:** Seat counts include pending requests, so three unanswered requests show "Full" to everyone else — for a class that may end up empty.
- **Change:** "1 confirmed · 2 waiting". Only confirmed seats close a slot.

### C5 · P1 — A full slot is a dead end
- **Now:** No waitlist. If someone later cancels, the seat goes unfilled because nobody knows.
- **Change:** "Join waitlist"; offer the seat to the first in line automatically when one frees up.

### C6 · P1 — Booking ignores classes left and course expiry
- **Now:** A rider with zero classes remaining, or a course that ended last month, can still book; the admin catches it manually.
- **Change:** Check the balance before booking; when empty, say so and offer renewal instead of a silent request.

### C7 · P2 — No repeat booking
- **Now:** Eight classes means eight separate requests, each approved separately.
- **Change:** "Every Friday for a month" as one request, approved once.

### C8 · P2 — Declined and cancelled bookings vanish
- **Now:** The rider's list carries only pending and approved, so a decline disappears with no record.
- **Change:** Keep a booking history with the outcome and reason.

---

## D. Running the day

The owner's console, used standing in an arena with a phone in one hand. Speed matters most
here, and the current build fights back hardest.

### D1 · P0 — A no-show cannot be recorded
- **Now:** Tapping a rider toggles present or nothing. The database supports `absent` and `makeup`; no screen can produce them, so "didn't turn up" and "not marked yet" are the same thing.
- **Change:** Three-state control — present / absent / make-up — counted differently against the balance.

### D2 · P0 — Every tap rebuilds the whole screen and throws you back to the top
- **Now:** Each action refetches everything and replaces the page. Marking the seventh rider scrolls you back to the first; a full evening means scrolling back down a dozen times.
- **Change:** Update the tapped row optimistically, patch just that node, keep scroll position.

### D3 · P0 — The 45-second poll redraws the page under your hands
- **Now:** Background refresh triggers the same full redraw. It skips the redraw while a field is focused, but not while you're scrolling or mid-tap.
- **Change:** Diff and patch instead of redrawing; surface changes as a quiet "new request" chip.

### D4 · P1 — No per-rider view for the admin
- **Now:** Tapping a rider opens the edit form. Nowhere to see their attendance, bookings, gaps, or when they last rode.
- **Change:** A rider detail screen — history, upcoming bookings, balance — with Edit as one action on it.

### D5 · P1 — Changing the day takes a native date picker every time
- **Now:** Checking yesterday means opening the OS calendar. No prev/next arrows, no "Today".
- **Change:** ◀ ▶ arrows with the date between them, a Today button, swipe between days.

### D6 · P1 — No bulk actions
- **Now:** Everyone showed up: three taps per slot × five slots. Six requests waiting: six approve taps, each with a full reload.
- **Change:** "Mark all present" per slot; multi-select approve on requests.

### D7 · P1 — Requests carry no context to decide on
- **Now:** Name, date, time. Not how many classes they have left, whether the course expired, or whether they already ride that day.
- **Change:** Show balance, expiry and same-day conflicts on the request card; flag the ones needing a second look.

### D8 · P1 — Decline is final, silent and unexplained
- **Now:** No reason captured, no undo, and the rider sees a bare "Declined" with no alternative.
- **Change:** Optional reason plus a suggested alternative slot; undo for a short window.

### D9 · P2 — A single day can't be closed
- **Now:** Rain, a holiday, a sick horse — no way to cancel one day. The only tool is deleting the slot, which removes it from every week and drops its roster.
- **Change:** Close a date (with a note), cancelling its bookings and telling those riders.

### D10 · P2 — Slots can be deleted but never paused
- **Now:** The schema has an `active` flag, but the slot form always saves `active: true` (`js/admin.js:290`), so retiring a time means deleting it and losing its roster.
- **Change:** An on/off switch in the slot form; inactive slots hidden from riders but keep their history.

### D11 · P2 — No search on the day view
- **Now:** Finding one rider among five slots means scrolling and reading.
- **Change:** Type a name to jump straight to their row.

### D12 · P2 — Marking gives no physical confirmation
- **Now:** A toast at the bottom of the screen, easy to miss when you're watching the arena.
- **Change:** A short vibration and an immediate state change on the row itself.

---

## E. Records & settings

Everything the academy's data depends on long-term: backups, destructive actions, and the
numbers the owner should be steering by.

### E1 · P0 — Export exists, import doesn't
- **Now:** Settings downloads a JSON file nothing can read back. A backup you can't restore isn't a backup — the button implies safety it doesn't provide.
- **Change:** An import that previews what will change before writing, plus a CSV export for spreadsheets.

### E2 · P1 — Deleting a rider erases their entire history behind one confirm
- **Now:** Delete sits in the edit form and cascades away every attendance record and booking. The safe option — the Active toggle — is a small checkbox further down the same form.
- **Change:** Make Archive the obvious action; put Delete behind typing the name, and warn how many records will go.

### E3 · P1 — Changing the admin password is a single unverified field
- **Now:** One masked box, no current-password check, no confirmation, no reveal. A typo locks the academy out of its own console with no reset path.
- **Change:** Current / new / confirm with a reveal toggle, and a recovery route that doesn't require the SQL editor.

### E4 · P1 — No way to hand a rider their PIN
- **Now:** The PIN sits in a text field in the edit form. Telling a new rider means reading digits aloud or retyping them elsewhere.
- **Change:** "Send login details" composing a WhatsApp/SMS message, plus copy-to-clipboard and generate-random-PIN.

### E5 · P1 — The stats don't tell the owner what needs doing
- **Now:** Three counters: students, classes this week, classes today. Nothing surfaces courses expiring this week, riders at zero classes left, repeat no-shows, or empty slots.
- **Change:** Replace the counters with an attention list — expiring, exhausted, unpaid, empty — each linking to the fix.

### E6 · P2 — Academy defaults live only in code
- **Now:** Default capacity, class days and times sit in `js/config.js`. Changing "max 3 riders" needs a redeploy.
- **Change:** Move them into Settings, backed by the settings table.

### E7 · P2 — No record of who changed what
- **Now:** Everyone shares one admin password, so approvals, edits and deletions are anonymous.
- **Change:** Named admin accounts and a simple activity log.

### E8 · P2 — Nothing can be printed
- **Now:** No paper attendance sheet, no monthly summary for a parent.
- **Change:** A print stylesheet for the day sheet and a per-rider monthly report.

---

## F. Platform & access

How the app behaves as an installed application, and whether everyone can actually use it —
in daylight, on an old phone, with a screen reader.

### F1 · P0 — The back button closes the app
- **Now:** Tabs and modals don't touch browser history. On Android, back from any screen — even an open dialog — exits. Reloading always lands on the default tab.
- **Change:** Push history state per tab and per modal so back closes the dialog, then steps back a tab, then leaves.

### F2 · P0 — Notifications only work while the app is open
- **Now:** Alerts come from a 45-second poll in an open tab. Close the app — which is what people do — and booking requests arrive silently. That's the opposite of what "notify me" promised.
- **Change:** Real Web Push, or make the Telegram/WhatsApp relay a first-class setup step rather than a commented block in `supabase/schema.sql`.

### F3 · P1 — Updates arrive a visit late, with no notice
- **Now:** The service worker serves cache-first, so after a deploy people keep running the old app until they open it a second time — and are never told.
- **Change:** Detect the waiting worker and show "New version available — reload".

### F4 · P1 — The logo 404s on every screen
- **Now:** `assets/logo.png` isn't in the repo yet, so every render requests a missing file and falls back to the placeholder mark. Install icons use the placeholder too.
- **Change:** Add the real logo and generate 192/512 PNG icons plus an iOS touch icon.

### F5 · P1 — Dialogs and icon buttons are unusable with a screen reader
- **Now:** Modals don't trap focus, aren't labelled, and don't restore focus on close. Icon-only buttons (✕, ⋯, ✓, 🔔) have no accessible names.
- **Change:** Focus trap and `aria-labelledby` on every dialog; a text label on every icon button.

### F6 · P1 — The smallest text is also the lowest contrast
- **Now:** Dates, times, counts and slot details use the dimmest grey at ~12px — below the accessible contrast minimum, in an app used outdoors.
- **Change:** Raise the secondary text colour, lift the minimum size to 13px.

### F7 · P1 — Dark theme only, in a daylight sport
- **Now:** Dark everywhere with no alternative. Marking attendance in an arena at 4 PM in full sun is the hardest case, and the theme suits it least.
- **Change:** A light theme following the system setting, with a manual override in Settings.

### F8 · P2 — Bangla numerals sit next to English month names
- **Now:** In Bangla, digits convert but months stay "Aug", so one line mixes two scripts.
- **Change:** Translate month and weekday names, or use platform date formatting per language.

### F9 · P2 — Dates come from whatever the phone's clock says
- **Now:** Every date is computed from device local time with no academy timezone. A phone set wrong books the wrong day; near midnight "today" differs between devices.
- **Change:** Fix the academy timezone server-side and derive dates from it.

### F10 · P2 — "Install app" does nothing on iPhone
- **Now:** iOS never fires the install event, so the button always falls through to a toast telling people to find a browser menu.
- **Change:** Detect iOS and show the actual Share → Add to Home Screen steps.

### F11 · P2 — Failures are invisible
- **Now:** No error reporting. A rider who can't sign in produces a toast on their phone and nothing anywhere else.
- **Change:** Log failed logins and failed writes so the owner can see them.

### F12 · P2 — The desk layout is a phone layout
- **Now:** One 940px column everywhere with a floating phone-style tab bar. On a laptop — where the monthly admin happens — most of the screen is empty.
- **Change:** Above tablet width, a sidebar with list and detail side by side.

---

## Suggested order

Three passes. The first makes the app trustworthy to hand to a rider; the second makes it
genuinely faster than a notebook; the third is finish.

**Pass 1 — Nobody gets stuck**
`A1 A2 A3 D1 D2 D3 F1 F2 E1 F4`
Sign-in that can't fail on a spelling, notifications that arrive when the app is closed, a
back button that behaves, and attendance that can record a no-show without throwing you up
the page.

**Pass 2 — Booking that survives contact with a schedule**
`B1 B2 B7 C1 C2 C4 C5 C6 D4 D5 D6 D7 D8 E5`
A calendar instead of "next Friday", confirmed and pending counted separately, waitlists,
absence notices, balance checks, status travelling back to the rider — plus the rider detail
screen and bulk actions the owner needs daily.

**Pass 3 — Privacy, daylight and the long run**
`B3 B6 E2 E3 E4 F5 F6 F7 F12` + all remaining P2
Stop showing children's timetables to everyone, add the light theme, fix contrast and
screen-reader access, protect destructive actions, and give the app fees, printing and a
desk layout.
