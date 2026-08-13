# Al Fursan Equestrian Academy — PWA

Student portal + admin console for the academy. Installable PWA, works offline for
reading, English / বাংলা toggle, no build step (plain HTML/CSS/JS).

---

## 1. Logo boshao (30 second)

Attached logo ta save koro ekhane:

```
assets/logo.png     (square PNG, 512×512 hole best)
```

Logo na thakle app ta built-in `assets/icon.svg` mark use korbe — kichu bhangbe na.

## 2. Local e cholao

```bash
npx serve .
# or
python -m http.server 8080
```

Browser: `http://localhost:8080`

**Demo login** (Supabase setup na korle):

| Role    | Login                   |
| ------- | ----------------------- |
| Student | `Zawad` / PIN `1111`    |
| Student | `Rahat` / PIN `3333`    |
| Admin   | password `alfursan`     |

Demo mode e sob data **shudhu oi browser er vitor** thake.

## 3. Vercel e deploy

```bash
npm i -g vercel
vercel        # preview
vercel --prod # live
```

Othoba: GitHub e push kore vercel.com > **Add New Project** > repo select > Deploy.
Kono framework/build command lagbe na (Framework Preset: **Other**).

## 4. Supabase connect (sob phone e sync korar jonno)

1. [supabase.com](https://supabase.com) e free project banao.
2. **SQL Editor** > New query > `supabase/schema.sql` er purota paste kore **Run**.
   - 4 din (Fri/Sat/Mon/Wed) × 5 ta slot (4:00, 4:50, 5:40, 6:30, 7:20 PM) auto toiri hoye jabe
   - default admin password: `alfursan` → login kore Settings theke **change koro**
3. **Project Settings > API** theke `Project URL` ar `anon public` key copy koro.
4. `js/config.js` e boshao:

```js
window.AF_CONFIG = {
  url: 'https://xxxxxxxx.supabase.co',
  anonKey: 'eyJhbGciOi...'
};
```

5. Abar deploy koro. Ekhon student ra nijeder phone theke login korbe.

### Security

Prottekta table e RLS on ebong anon key diye **kono table e direct access nei**.
Sob kaj hoy `security definer` RPC function diye — student shudhu nijer data pay,
admin function gulo password check kore. Admin password 8+ character rakho.

## 5. Notification (booking alert)

Student jokhon kono slot **Book** kore:

- admin app e bell ⏰ badge + bottom nav e **Requests** count bare
- admin app khola thakle (background tab o chole) browser notification ashe —
  Settings > 🔔 *Notify me on new bookings* ekbar allow korte hobe
- Requests tab theke ✓ approve / ✕ decline

**App purapuri bondho thakleo alert chao?** `supabase/schema.sql` er nichey
commented Telegram block ta ache — BotFather diye bot banao, token + chat id
boshiye run koro. Tarpor protita booking direct Telegram e chole ashbe.

---

## Structure

```
index.html              app shell
css/styles.css          theme (dark chrome, matches the logo)
js/config.js            Supabase keys + academy days/times   ← edit this
js/i18n.js              English / বাংলা strings
js/api.js               RPC layer
js/demo.js              localStorage fallback (same contract)
js/ui.js                DOM helpers, toast, modal, icons
js/student.js           student portal
js/admin.js             admin console
js/app.js               login + boot + PWA install
supabase/schema.sql     tables, RLS, RPC functions, seed data
sw.js                   offline cache
```

## Courses

| Course   | Classes | Duration |
| -------- | ------- | -------- |
| Basic    | 8       | 1 month  |
| Advanced | 16      | 2 months |
| Private  | custom  | custom   |

Admin protita student er total class, date, tag customize korte pare.
Slot capacity default **3 jon**, per-slot change kora jay.
