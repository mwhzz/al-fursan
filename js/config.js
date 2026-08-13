/* -----------------------------------------------------------------------
   Al Fursan — configuration
   -----------------------------------------------------------------------
   Supabase connect korte:
     1) supabase.com e free project banao
     2) supabase/schema.sql file ta SQL Editor e paste kore Run koro
     3) Project Settings > API theke URL ar "anon public" key niye niche boshao
   Ei duita field khali thakle app "Demo mode" e cholbe (data browser er
   vitorei thakbe, onno device e jabe na).
-------------------------------------------------------------------------*/
window.AF_CONFIG = {
  url: '',      // e.g. 'https://abcdefgh.supabase.co'
  anonKey: '',  // e.g. 'eyJhbGciOi...'

  academy: 'Al Fursan Equestrian Academy',
  // Main class days: 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat
  mainDays: [5, 6, 1, 3],
  mainTimes: ['16:00', '16:50', '17:40', '18:30', '19:20'],
  slotCapacity: 3
};
