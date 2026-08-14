/* -----------------------------------------------------------------------
   Al Fursan — the walkthrough.

   guide state on the account:  0 never seen · 1 seen at least once · 2 muted
   First run cannot be dismissed — a rider has to see how booking works once.
   After that it opens skippable, with "don't show again".
------------------------------------------------------------------------- */
(function () {
  const U = UI;

  const STEPS = {
    student: {
      en: [
        { icon: 'horse', title: 'Welcome to Al Fursan',
          body: 'This is your rider card. It keeps your classes, your bookings and your fees in one place — no more asking at the gate.' },
        { icon: 'home', title: 'Your progress',
          body: 'The ring on the home screen counts the classes you have completed this cycle. Under it you get how many are left and how many days your course still runs. When it turns amber or red, it is time to renew.' },
        { icon: 'calendar', title: 'Booking a class',
          body: 'Open <b>Book</b>, pick a date on the calendar, and you will see each time with its free seats. Green means seats are open, red means the class is full. Tap <b>Book</b> and the academy confirms it — usually the same day.' },
        { icon: 'clock', title: 'When a class is full',
          body: 'Join the waitlist instead. If somebody cancels, the first person waiting is moved up automatically and you get an update in the app.' },
        { icon: 'x', title: 'If you cannot come',
          body: 'Open the class on your home screen and tap <b>Can\'t attend</b>. That frees your seat for someone else and tells the academy straight away — much better than not turning up.' },
        { icon: 'cash', title: 'Fees',
          body: 'Under <b>Profile</b> you can see what your course costs, what you have paid and what is still owed. You can pay in parts: every instalment is listed with its date, so there is never a dispute.' },
        { icon: 'user', title: 'Your details',
          body: 'Change your phone number or your 4-digit PIN any time from <b>Profile</b>. Forgot your PIN? Use the link on the sign-in screen to call or message the academy.' },
        { icon: 'down', title: 'Keep it handy',
          body: 'Tap <b>Install app</b> in Profile to put Al Fursan on your home screen. It then opens like a normal app and works even with a weak signal.' }
      ],
      bn: [
        { icon: 'horse', title: 'আল ফুরসানে স্বাগতম',
          body: 'এটাই আপনার রাইডার কার্ড। ক্লাস, বুকিং আর ফি — সব এক জায়গায়। গেটে গিয়ে আর জিজ্ঞেস করতে হবে না।' },
        { icon: 'home', title: 'আপনার অগ্রগতি',
          body: 'হোম স্ক্রিনের রিং-টা এই সাইকেলে আপনার কতটা ক্লাস হয়েছে দেখায়। নিচে থাকে কতটা বাকি আর কোর্সের মেয়াদ আর কত দিন। হলুদ বা লাল হলে নবায়নের সময় হয়েছে।' },
        { icon: 'calendar', title: 'ক্লাস বুক করা',
          body: '<b>বুক</b>-এ গিয়ে ক্যালেন্ডার থেকে তারিখ বাছুন — প্রতিটা সময়ের খালি সিট দেখতে পাবেন। সবুজ মানে সিট আছে, লাল মানে পূর্ণ। <b>বুক</b> চাপলে একাডেমি কনফার্ম করবে, সাধারণত সেদিনই।' },
        { icon: 'clock', title: 'ক্লাস পূর্ণ থাকলে',
          body: 'ওয়েটলিস্টে যোগ দিন। কেউ বাতিল করলে সবার আগে যিনি অপেক্ষায় ছিলেন তিনি নিজে থেকেই উঠে আসেন, আর অ্যাপে জানিয়ে দেওয়া হয়।' },
        { icon: 'x', title: 'আসতে না পারলে',
          body: 'হোম স্ক্রিনে ক্লাসটার নিচে <b>আসতে পারব না</b> চাপুন। এতে আপনার সিট অন্য কেউ পাবে আর একাডেমি সাথে সাথে জেনে যাবে — না জানিয়ে অনুপস্থিত থাকার চেয়ে অনেক ভালো।' },
        { icon: 'cash', title: 'ফি',
          body: '<b>প্রোফাইল</b>-এ কোর্সের ফি, কত জমা দিয়েছেন আর কত বাকি — সব দেখা যায়। কিস্তিতে দিতে পারবেন; প্রতিটা জমার তারিখসহ হিসাব থাকে, তাই ভুল বোঝাবুঝির সুযোগ নেই।' },
        { icon: 'user', title: 'আপনার তথ্য',
          body: '<b>প্রোফাইল</b> থেকে যেকোনো সময় ফোন নম্বর বা ৪ সংখ্যার পিন বদলাতে পারবেন। পিন ভুলে গেলে লগইন স্ক্রিনের লিংক দিয়ে একাডেমিতে ফোন বা মেসেজ করুন।' },
        { icon: 'down', title: 'হাতের কাছে রাখুন',
          body: 'প্রোফাইল থেকে <b>অ্যাপ ইনস্টল</b> চাপলে আল ফুরসান আপনার হোম স্ক্রিনে বসে যাবে। তখন সাধারণ অ্যাপের মতোই খুলবে, নেট দুর্বল হলেও চলবে।' }
      ]
    },

    admin: {
      en: [
        { icon: 'gear', title: 'The academy console',
          body: 'Everything the academy runs on: attendance, booking requests, riders, class times, fees and backups. Five sections along the bottom (or down the side on a laptop).' },
        { icon: 'check', title: 'Taking attendance',
          body: '<b>Today</b> lists every class for the day with its riders. Tap ✓ for present, ✕ for absent, and tap again to clear it. It saves as you tap and never loses your place in the list. <b>All present</b> marks a whole slot at once, and the arrows step through days.' },
        { icon: 'bell', title: 'Booking requests',
          body: '<b>Requests</b> shows what riders have asked for, each with their classes left, course expiry and any clash that day. Approve, or decline with a reason the rider will see. The seat limit is enforced: nothing gets confirmed past it, even through Approve all, and seats go to whoever asked first.' },
        { icon: 'users', title: 'Riders',
          body: 'Tap any rider for their full history, bookings and fees. From there you can edit them, send their login details over WhatsApp, record a payment, or <b>renew</b> — which starts a fresh cycle from today and bills it at the course price.' },
        { icon: 'cash', title: 'Fees, paid in parts',
          body: 'Add a fee for a rider, then record each instalment as it comes in. The app tracks what is still owed, refuses anything above it, and tells the rider each time. Course prices live in Settings so you never type them twice.' },
        { icon: 'calendar', title: 'Class times',
          body: '<b>Schedule</b> is where times live — add one, set how many riders fit, put a coach and a horse on it, or pause it without losing its history. Raining? Cancel a single class or the whole day from Today; everyone booked is told automatically.' },
        { icon: 'wifi', title: 'Alerts when the app is closed',
          body: 'Browser alerts only arrive while the app is open. For alerts that reach you with the app closed, set up Telegram in Settings — it takes two minutes and every booking then lands on your phone.' },
        { icon: 'down', title: 'Backups',
          body: 'Settings → Export downloads everything as one file. Restore takes it back, showing you what will change before it writes. Do it once a month and the academy can never lose a year of records.' }
      ],
      bn: [
        { icon: 'gear', title: 'একাডেমি কনসোল',
          body: 'একাডেমি চালানোর সবকিছু: হাজিরা, বুকিং রিকোয়েস্ট, রাইডার, ক্লাসের সময়, ফি আর ব্যাকআপ। নিচে (ল্যাপটপে পাশে) পাঁচটা অংশ।' },
        { icon: 'check', title: 'হাজিরা নেওয়া',
          body: '<b>আজ</b>-এ দিনের প্রতিটা ক্লাস আর তার রাইডাররা থাকে। উপস্থিত হলে ✓, অনুপস্থিত হলে ✕, আবার চাপলে মুছে যায়। চাপার সাথে সাথেই সেভ হয় আর তালিকায় আপনার জায়গা হারায় না। <b>সবাই উপস্থিত</b> দিয়ে পুরো স্লট একবারে, আর তীরচিহ্ন দিয়ে দিন বদলান।' },
        { icon: 'bell', title: 'বুকিং রিকোয়েস্ট',
          body: '<b>রিকোয়েস্ট</b>-এ কে কী চেয়েছে, তার কত ক্লাস বাকি, মেয়াদ আছে কিনা, ঐ দিনে আরেক ক্লাস আছে কিনা — সব দেখায়। অনুমোদন করুন, বা কারণ লিখে নাকচ করুন (রাইডার কারণটা দেখবে)। সিটের সীমা কড়াভাবে মানা হয় — "সব অনুমোদন" চাপলেও সীমার বেশি কনফার্ম হবে না, আর যে আগে চেয়েছে সে আগে সিট পাবে।' },
        { icon: 'users', title: 'রাইডার',
          body: 'যেকোনো রাইডারে চাপলে তার পুরো হিস্ট্রি, বুকিং আর ফি দেখা যায়। ওখান থেকেই এডিট, হোয়াটসঅ্যাপে লগইন তথ্য পাঠানো, টাকা জমা লেখা, বা <b>নবায়ন</b> — যা আজ থেকে নতুন সাইকেল শুরু করে কোর্সের ফি বসিয়ে দেয়।' },
        { icon: 'cash', title: 'কিস্তিতে ফি',
          body: 'রাইডারের জন্য ফি যোগ করুন, তারপর যত টাকা আসে ততবার জমা লিখুন। কত বাকি অ্যাপ নিজেই হিসাব রাখে, বাকির বেশি নিতে দেয় না, আর প্রতিবার রাইডারকে জানিয়ে দেয়। কোর্সের দাম সেটিংসে রাখা, তাই বারবার টাইপ করতে হয় না।' },
        { icon: 'calendar', title: 'ক্লাসের সময়',
          body: '<b>শিডিউল</b>-এ সময় যোগ করুন, কতজন রাইডার আঁটবে ঠিক করুন, কোচ ও ঘোড়া বসান, বা হিস্ট্রি না হারিয়ে সাময়িক বন্ধ রাখুন। বৃষ্টি? আজ থেকে একটা ক্লাস বা পুরো দিন বাতিল করুন — যারা বুক করেছে সবাই নিজে থেকেই জেনে যাবে।' },
        { icon: 'wifi', title: 'অ্যাপ বন্ধ থাকলেও অ্যালার্ট',
          body: 'ব্রাউজার অ্যালার্ট শুধু অ্যাপ খোলা থাকলে আসে। বন্ধ থাকলেও পেতে সেটিংসে টেলিগ্রাম সেট করুন — দুই মিনিটের কাজ, তারপর প্রতিটা বুকিং সরাসরি ফোনে আসবে।' },
        { icon: 'down', title: 'ব্যাকআপ',
          body: 'সেটিংস → এক্সপোর্ট দিয়ে পুরো ডেটা এক ফাইলে নামান। রিস্টোর সেটা ফিরিয়ে আনে, লেখার আগে কী বদলাবে দেখিয়ে নেয়। মাসে একবার করলে এক বছরের রেকর্ড কখনো হারাবে না।' }
      ]
    }
  };

  let role = 'student';
  let step = 0;
  let locked = false;

  function steps() {
    const set = STEPS[role] || STEPS.student;
    return set[I18N.lang] || set.en;
  }

  function render() {
    const all = steps();
    const s = all[step];
    const last = step === all.length - 1;

    const dots = all.map((_, i) =>
      '<span style="width:' + (i === step ? '20px' : '7px') + ';height:7px;border-radius:99px;background:' +
      (i === step ? 'var(--accent)' : 'var(--line-2)') + ';transition:.25s"></span>').join('');

    U.dialog({
      locked,
      title: s.title,
      body:
        '<div class="row" style="justify-content:center;margin-bottom:4px">' +
          '<span class="avatar guide-mark">' + U.icon(s.icon, 'ic-guide') + '</span></div>' +
        '<p class="muted" style="line-height:1.65">' + s.body + '</p>' +
        '<div class="row" style="justify-content:center;gap:5px;margin-top:6px">' + dots + '</div>' +
        '<p class="tiny dim center">' + U.esc(t('step', { a: n(step + 1), b: n(all.length) })) + '</p>' +
        // in the normal flow, not floating over the step counter
        (locked ? '' : '<div class="row" style="justify-content:center">' +
          '<button class="btn sm ghost" id="gNever">' + U.esc(t('guideNever')) + '</button></div>'),
      actions:
        (step > 0
          ? '<button class="btn ghost" id="gBack">' + U.esc(t('guideBack')) + '</button>'
          : (locked ? '' : '<button class="btn ghost" id="gSkip">' + U.esc(t('guideSkip')) + '</button>')) +
        '<button class="btn primary grow" id="gNext">' +
          U.esc(last ? (role === 'admin' ? t('guideDoneAdmin') : t('guideDone')) : t('guideNext')) + '</button>',
      onMount(box) {
        const back = box.querySelector('#gBack');
        if (back) back.addEventListener('click', () => { step--; render(); });
        const skip = box.querySelector('#gSkip');
        if (skip) skip.addEventListener('click', () => finish(1));
        const never = box.querySelector('#gNever');
        if (never) never.addEventListener('click', () => finish(2));
        box.querySelector('#gNext').addEventListener('click', () => {
          if (last) finish(1); else { step++; render(); }
        });
      }
    });
  }

  async function finish(value) {
    U.closeDialog();
    try { await API.setGuide(value); } catch (e) { /* the walkthrough is not worth an error */ }
    if (window.AF_ON_GUIDE_DONE) window.AF_ON_GUIDE_DONE(value);
  }

  window.GUIDE = {
    /** open it explicitly, always skippable */
    open(forRole) {
      role = forRole || 'student';
      step = 0;
      locked = false;
      render();
    },
    /** called after sign-in: 0 forces it, 1 offers it, 2 stays quiet */
    maybeShow(forRole, state) {
      const v = Number(state) || 0;
      if (v >= 2) return false;
      role = forRole || 'student';
      step = 0;
      locked = v === 0;            // the very first time it cannot be skipped
      render();
      return true;
    }
  };
})();
