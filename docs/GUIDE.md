# Al Fursan — how to use the app

Two apps in one. Riders sign in with their name and a 4-digit PIN. The academy signs in
under **Staff** with a username and password. The app walks you through this the first
time you sign in; you can reopen it any time from **Profile → Show the guide**
(riders) or **Settings → Show the guide** (academy).

---

# For riders

## Signing in

1. Open the app. Find your name in the list — start typing to filter it.
   If your name is not listed, tap **My name is not listed** and type it exactly.
2. Enter your 4-digit PIN. It is hidden as you type; tap **Show PIN** if you need to check.
3. **Keep me signed in** leaves you signed in on your own phone. Untick it on a shared one.

**Forgot your PIN?** Tap the link under the PIN boxes to call or WhatsApp the academy.
Five wrong attempts pause that name for a minute.

The first time you sign in the walkthrough appears and cannot be skipped — it is two
minutes and it covers everything below.

## Home

- The **ring** counts the classes you have completed this cycle.
- **Completed / Remaining / Valid till** sit under it. Remaining turns amber at two left
  and red at zero. Valid till turns amber in the last week and red once it has passed.
- **Next class** shows the day, time, coach and horse, with a live countdown on the day.
- **Updates** appear at the top when the academy confirms a booking, cancels a class or
  records a payment. Tap the tick to clear them.

## Booking a class

1. Open **Book**.
2. Pick a date. Each day shows how many seats are free: green means seats, amber means
   nearly full, red means full or cancelled. Past days and days without classes are greyed out.
3. Each time shows **confirmed** seats, how many are **waiting**, and how many are free.
4. Tap **Book**. The academy confirms it — the dialog tells you the usual reply time.
5. If the class is full, tap **Join waitlist**. When somebody cancels, the person who
   asked first is moved up automatically and told in the app.

**What you cannot book:** a class on a day you already ride, a date in the past, a
cancelled class, or anything once your course has run out of classes or expired. The app
says which of these it is.

## If you cannot come

On **Home**, under your next class, tap **Can't attend** and add a reason if you like.
This cancels your booking, frees your seat for somebody else and tells the academy
immediately. Please do this instead of simply not turning up.

To cancel a booking further ahead, use the ✕ on it under **My bookings**. Close to the
class the app will stop you — call the academy instead. The academy sets that window.

## History

Every class you have done, grouped by month with the month's total. Present, absent and
make-up classes each have their own colour and icon. Declined or cancelled requests are
listed underneath so there is always a record.

## Fees

Under **Profile**. Each fee shows the total, a bar for how much is paid, and what is
still to pay. **You can pay in parts** — every instalment appears with its date and
method, so the record always matches what you handed over. When a fee is fully paid it
turns green.

## Your details

- Change your **phone** or **PIN** from Profile, then tap Save.
- **Theme**: System, Light or Dark. **Language**: English or বাংলা.
- **Install app** puts Al Fursan on your home screen. On iPhone: Share → Add to Home Screen.
- **Sign out** clears the session from that device.

---

# For the academy

Sign in under **Staff**. The first account is `owner`. Change its password immediately
from Settings.

## Today — taking attendance

The default screen, and the one used most.

- **◀ ▶** step through days, **Today** jumps back, and the date box opens a calendar.
- The **search box** filters riders across every class of that day.
- Each class shows its time, coach, horse and seats. The stripe down the left tells you
  at a glance: grey nothing marked, amber partly marked, green everyone marked, red cancelled.
- Per rider: **✓ present**, **✕ absent**, **↻ make-up**. Tap the same button again to
  clear it. It saves as you tap, the row changes colour immediately, and the list does
  not jump — you can work down a class without losing your place.
- **All present** marks a whole class in one go.
- **Add a rider** puts somebody into today's class who is not on the roster — a walk-in
  or a make-up.
- **Cancel classes** closes one class or the whole day, with a reason. Everyone booked is
  told automatically, and their bookings are cancelled. If attendance is already marked
  for that day the app warns you first. **Reopen** undoes it.
- The **printer icon** prints a clean day sheet.

Marking somebody absent hands their seat back, so anyone on the waitlist moves up.

## Requests

Every booking riders have asked for. Each card shows their classes left, whether the
course has expired, whether they already ride that day, and whether the class is full.

- **✓** confirms, **✕** declines with a reason the rider sees.
- Tick several and use **Approve** to do them together, or **Approve all**.
- The seat limit is enforced: nothing is confirmed past it even through Approve all, and
  seats go to whoever asked first. Anything that will not fit is reported back to you.
- A declined request can be undone.

Turn on **Alert me on new bookings** for notifications while the console is open. For
alerts with the app closed, set up Telegram (below).

## Riders

Search, or filter by Active / All / Archived. Tap anyone to open their card:

- Classes done, remaining and outstanding fees at the top.
- **Edit** — name, PIN, phone, course, total classes, dates, tags, notes. **Random PIN**
  generates one. Course changes fill in the usual class count and end date.
- **Add a fee** — pre-filled with that course's price from Settings.
- **Renew course** — starts a new cycle from today, adds a fresh set of classes, extends
  the end date and raises the fee at the course price. One tap instead of five edits.
- **Send login details** — opens WhatsApp to the rider with their name and PIN.
- **Archive** hides a rider without deleting anything. **Delete** is permanent, needs the
  name typed to confirm, and tells you how many records will go.
- Their attendance, bookings and fees are listed underneath.

## Fees and part payments

1. Set the price of each course once, in **Settings → Course prices**.
2. On a rider, **Add a fee** — the price is filled in for you.
3. As money comes in, tap **Record a payment** and enter the amount, date and method
   (cash, bKash…). **Pay the rest** settles the remainder in one tap.
4. The bar shows how much is in. The app refuses anything above what is owed, and tells
   you what is left. The rider is notified each time and sees the same list.
5. **Needs attention** on Today lists everyone with an outstanding balance, plus courses
   expiring within a week and riders with no classes left.

## Schedule

Class times, per weekday.

- **Add time** — day, time, how many riders fit, coach, horse.
- **⚙** on a time edits it, including **Open for booking** — untick to pause a slot
  without losing its history. Paused times disappear for riders.
- Add or remove riders from the recurring roster. The roster is who rides every week;
  bookings are one-off.

## Settings

- **Academy** — name, contact number, WhatsApp, timezone, currency, default seats per
  class, how fast you promise to confirm, and the cancellation cut-off.
- **Course prices** — Basic, Advanced, Private.
- **Telegram alerts** — alerts that arrive with the app closed:
  1. Telegram → **@BotFather** → `/newbot` → copy the token
  2. Send your bot a message, open `https://api.telegram.org/bot<TOKEN>/getUpdates`,
     copy the `chat.id`
  3. Paste both here, Save, then **Send test message**
- **Password** — current, new, confirm. Changing it signs out your other devices.
- **Staff accounts** — owners can add staff. Staff can run the day; only owners manage
  accounts.
- **Export backup** downloads everything as one file. **Restore from backup** shows what
  will change before writing, then merges or replaces. Do this monthly.
- **Activity** — who did what, most recent first.

---

## Rules the app enforces

| Rule | What happens |
| --- | --- |
| Seats per class | Never exceeded, not even by Approve all. Extra riders go to the waitlist. |
| First come, first served | Approvals are processed oldest request first. |
| Classes left | A rider with none cannot book. |
| Course expiry | An expired course cannot book. |
| One booking per class | The same rider cannot double-book a class. |
| Cancellation cut-off | Close to the class, riders must call instead. |
| Cancelled days | Bookings are cancelled and everyone is told. |
| Absence | Frees the seat and moves the waitlist up. |
| Fees | No payment can exceed what is owed. |
| Wrong PINs | Five wrong tries pause that name for a minute. |

## If something goes wrong

- **A rider cannot sign in** — check the name in Riders, and read them the PIN from their
  card, or send it over WhatsApp.
- **The app looks out of date** — a "New version" prompt appears after a deploy; tap
  Reload. Otherwise close and reopen it.
- **Offline** — the app shows the last saved data with a banner. Changes need a
  connection; nothing is lost, but a booking made offline will not go through.
- **Something is wrong with the data** — Settings → Restore from backup.
