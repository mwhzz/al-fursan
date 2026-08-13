/* Al Fursan — bilingual strings (English / বাংলা) */
(function () {
  const S = {
    en: {
      academy: 'Al Fursan', academySub: 'Equestrian Academy',
      welcome: 'Welcome back, rider', loginHint: 'Enter your name and 4-digit PIN',
      name: 'Name', pin: 'PIN', login: 'Sign in', logout: 'Sign out',
      adminLogin: 'Admin login', studentLogin: 'Student login', password: 'Password',
      adminPassHint: 'Enter the academy admin password',
      wrongLogin: 'Name or PIN is incorrect', wrongPass: 'Wrong password', fillAll: 'Please fill in everything',
      pin4: 'PIN must be 4 digits', welcomeBack: 'Welcome back',

      overview: 'Overview', schedule: 'Schedule', history: 'History', students: 'Students',
      attendance: 'Attendance', settings: 'Settings', today: 'Today',

      classesDone: 'Classes done', remaining: 'Remaining', completed: 'Completed',
      total: 'Total', course: 'Course', started: 'Started', ends: 'Ends', validTill: 'Valid till',
      nextClass: 'Next class', noNextClass: 'No fixed slot yet', progress: 'Progress',
      courseDone: 'Course complete! 🏆', keepGoing: 'classes to go',
      basic: 'Basic', advanced: 'Advanced', private: 'Private',
      basicSub: '8 classes · 1 month', advancedSub: '16 classes · 2 months', privateSub: 'Custom',

      mySlots: 'My riding slots', weekly: 'Weekly schedule', allSlots: 'All slots',
      seatsLeft: 'seats left', full: 'Full', empty: 'Empty', open: 'Open slot',
      noHistory: 'No classes recorded yet', noStudents: 'No students yet',
      present: 'Present', absent: 'Absent', makeup: 'Make-up',

      addStudent: 'Add student', editStudent: 'Edit student', newStudent: 'New student',
      search: 'Search name or tag…', phone: 'Phone', tags: 'Tags', tagsHint: 'comma separated',
      note: 'Note', totalClasses: 'Total classes', startDate: 'Start date', endDate: 'End date',
      save: 'Save', cancel: 'Cancel', delete: 'Delete', close: 'Close', confirm: 'Are you sure?',
      active: 'Active', inactive: 'Inactive', saved: 'Saved', deleted: 'Deleted',
      resetPin: 'PIN (4 digits)', addToSlot: 'Add rider', pick: 'Pick a student',
      slotFull: 'This slot is full (max {n})', alreadyIn: 'Already in this slot',
      markPresent: 'Mark present', undo: 'Undo', marked: 'Marked present', unmarked: 'Removed',
      todaysClasses: "Today's classes", noClassToday: 'No scheduled class today',
      pickDate: 'Date', all: 'All', activeOnly: 'Active', archived: 'Archived',

      changePass: 'Change admin password', newPass: 'New password', slotTimes: 'Slot times',
      capacity: 'Max riders per slot', addSlot: 'Add slot', day: 'Day', time: 'Time',
      exportData: 'Export data (JSON)', demoBanner: 'Demo mode — data stays on this device only. Add your Supabase keys in js/config.js to sync across phones.',
      offline: 'Offline — showing last saved data', netErr: 'Connection problem. Try again.',
      language: 'ভাষা', installApp: 'Install app', installed: 'Installed',
      sun: 'Sun', mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat',
      stats: 'Stats', totalStudents: 'Students', classesThisWeek: 'This week', activeCourses: 'Active',

      book: 'Book', booking: 'Booking', requests: 'Requests', myBookings: 'My bookings',
      bookThis: 'Book this slot', bookConfirm: 'Request this class?', bookSent: 'Request sent to the academy',
      pending: 'Pending', approved: 'Approved', declined: 'Declined', cancelled: 'Cancelled',
      approve: 'Approve', decline: 'Decline', cancelBooking: 'Cancel request',
      noRequests: 'No booking requests', newRequest: 'New booking request',
      alreadyBooked: 'Already booked', pastDate: 'That date has passed',
      notifyOn: 'Notify me on new bookings', notifyBlocked: 'Notifications are blocked in browser settings',
      notifyReady: 'Notifications on', bookedBy: 'booked by'
    },
    bn: {
      academy: 'আল ফুরসান', academySub: 'ইকুয়েস্ট্রিয়ান একাডেমি',
      welcome: 'স্বাগতম, রাইডার', loginHint: 'নাম আর ৪ সংখ্যার পিন দিন',
      name: 'নাম', pin: 'পিন', login: 'লগইন', logout: 'লগআউট',
      adminLogin: 'অ্যাডমিন লগইন', studentLogin: 'স্টুডেন্ট লগইন', password: 'পাসওয়ার্ড',
      adminPassHint: 'একাডেমির অ্যাডমিন পাসওয়ার্ড দিন',
      wrongLogin: 'নাম বা পিন ভুল', wrongPass: 'পাসওয়ার্ড ভুল', fillAll: 'সব ঘর পূরণ করুন',
      pin4: 'পিন ৪ সংখ্যার হতে হবে', welcomeBack: 'আবার স্বাগতম',

      overview: 'হোম', schedule: 'শিডিউল', history: 'হিস্ট্রি', students: 'স্টুডেন্ট',
      attendance: 'হাজিরা', settings: 'সেটিংস', today: 'আজ',

      classesDone: 'ক্লাস হয়েছে', remaining: 'বাকি আছে', completed: 'সম্পন্ন',
      total: 'মোট', course: 'কোর্স', started: 'শুরু', ends: 'শেষ', validTill: 'মেয়াদ',
      nextClass: 'পরের ক্লাস', noNextClass: 'এখনো সময় ঠিক হয়নি', progress: 'অগ্রগতি',
      courseDone: 'কোর্স শেষ! 🏆', keepGoing: 'টি ক্লাস বাকি',
      basic: 'বেসিক', advanced: 'অ্যাডভান্স', private: 'প্রাইভেট',
      basicSub: '৮ ক্লাস · ১ মাস', advancedSub: '১৬ ক্লাস · ২ মাস', privateSub: 'কাস্টম',

      mySlots: 'আমার ক্লাসের সময়', weekly: 'সাপ্তাহিক শিডিউল', allSlots: 'সব স্লট',
      seatsLeft: 'সিট খালি', full: 'পূর্ণ', empty: 'খালি', open: 'খালি স্লট',
      noHistory: 'এখনো কোনো ক্লাস হয়নি', noStudents: 'কোনো স্টুডেন্ট নেই',
      present: 'উপস্থিত', absent: 'অনুপস্থিত', makeup: 'মেকআপ',

      addStudent: 'স্টুডেন্ট যোগ', editStudent: 'তথ্য এডিট', newStudent: 'নতুন স্টুডেন্ট',
      search: 'নাম বা ট্যাগ খুঁজুন…', phone: 'ফোন', tags: 'ট্যাগ', tagsHint: 'কমা দিয়ে আলাদা',
      note: 'নোট', totalClasses: 'মোট ক্লাস', startDate: 'শুরুর তারিখ', endDate: 'শেষ তারিখ',
      save: 'সেভ', cancel: 'বাতিল', delete: 'ডিলিট', close: 'বন্ধ', confirm: 'আপনি কি নিশ্চিত?',
      active: 'চালু', inactive: 'বন্ধ', saved: 'সেভ হয়েছে', deleted: 'ডিলিট হয়েছে',
      resetPin: 'পিন (৪ সংখ্যা)', addToSlot: 'রাইডার যোগ', pick: 'স্টুডেন্ট বাছুন',
      slotFull: 'এই স্লট পূর্ণ (সর্বোচ্চ {n})', alreadyIn: 'ইতিমধ্যে এই স্লটে আছে',
      markPresent: 'উপস্থিত দিন', undo: 'ফিরিয়ে নিন', marked: 'উপস্থিতি দেওয়া হলো', unmarked: 'বাদ দেওয়া হলো',
      todaysClasses: 'আজকের ক্লাস', noClassToday: 'আজ কোনো ক্লাস নেই',
      pickDate: 'তারিখ', all: 'সব', activeOnly: 'চালু', archived: 'আর্কাইভ',

      changePass: 'অ্যাডমিন পাসওয়ার্ড বদলান', newPass: 'নতুন পাসওয়ার্ড', slotTimes: 'ক্লাসের সময়',
      capacity: 'প্রতি স্লটে সর্বোচ্চ রাইডার', addSlot: 'স্লট যোগ', day: 'দিন', time: 'সময়',
      exportData: 'ডেটা এক্সপোর্ট (JSON)', demoBanner: 'ডেমো মোড — ডেটা শুধু এই ডিভাইসে থাকবে। সব ফোনে সিঙ্ক করতে js/config.js এ Supabase key বসান।',
      offline: 'অফলাইন — শেষ সেভ করা তথ্য দেখাচ্ছে', netErr: 'কানেকশন সমস্যা। আবার চেষ্টা করুন।',
      language: 'Language', installApp: 'অ্যাপ ইনস্টল', installed: 'ইনস্টল হয়েছে',
      sun: 'রবি', mon: 'সোম', tue: 'মঙ্গল', wed: 'বুধ', thu: 'বৃহঃ', fri: 'শুক্র', sat: 'শনি',
      stats: 'পরিসংখ্যান', totalStudents: 'স্টুডেন্ট', classesThisWeek: 'এ সপ্তাহে', activeCourses: 'চালু',

      book: 'বুক', booking: 'বুকিং', requests: 'রিকোয়েস্ট', myBookings: 'আমার বুকিং',
      bookThis: 'এই স্লট বুক করুন', bookConfirm: 'এই ক্লাসটি বুক করবেন?', bookSent: 'রিকোয়েস্ট পাঠানো হয়েছে',
      pending: 'অপেক্ষমাণ', approved: 'অনুমোদিত', declined: 'বাতিল', cancelled: 'বাতিল',
      approve: 'অনুমোদন', decline: 'নাকচ', cancelBooking: 'রিকোয়েস্ট বাতিল',
      noRequests: 'কোনো বুকিং রিকোয়েস্ট নেই', newRequest: 'নতুন বুকিং রিকোয়েস্ট',
      alreadyBooked: 'ইতিমধ্যে বুক করা আছে', pastDate: 'তারিখটি পার হয়ে গেছে',
      notifyOn: 'নতুন বুকিংয়ে নোটিফিকেশন', notifyBlocked: 'ব্রাউজার সেটিংসে নোটিফিকেশন বন্ধ আছে',
      notifyReady: 'নোটিফিকেশন চালু', bookedBy: 'বুক করেছে'
    }
  };

  let lang = localStorage.getItem('af_lang') || 'en';

  window.I18N = {
    get lang() { return lang; },
    set(l) {
      lang = S[l] ? l : 'en';
      localStorage.setItem('af_lang', lang);
      document.documentElement.setAttribute('data-lang', lang);
      document.documentElement.lang = lang;
    },
    toggle() { this.set(lang === 'en' ? 'bn' : 'en'); },
    init() { this.set(lang); }
  };

  /** t('key', {n: 3}) */
  window.t = function (key, vars) {
    let s = (S[lang] && S[lang][key]) || S.en[key] || key;
    if (vars) for (const k in vars) s = s.replace('{' + k + '}', vars[k]);
    return s;
  };

  /** Bangla numerals when lang = bn */
  window.n = function (v) {
    if (lang !== 'bn') return String(v);
    const bn = '০১২৩৪৫৬৭৮৯';
    return String(v).replace(/\d/g, d => bn[+d]);
  };
})();
