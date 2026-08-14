/* -----------------------------------------------------------------------
   Al Fursan — build configuration
   -----------------------------------------------------------------------
   Supabase connect korte:
     1) supabase.com e free project banao
     2) supabase/schema.sql file ta SQL Editor e paste kore Run koro
     3) Project Settings > API theke URL ar "anon public" key niche boshao
   Ei duita khali thakle app "Demo mode" e cholbe (data ei browser er
   vitorei thake, onno device e jay na).

   Baki shob setting — academy name, class days/times, capacity, contact
   number, timezone, Telegram — app er vitor Admin > Settings theke bodlano
   jay, redeploy chhara.
-------------------------------------------------------------------------*/
window.AF_CONFIG = {
  /* Where the data lives.
       'auto'     try the Netlify function, fall back to this browser  (default)
       'netlify'  always the Netlify function at /api/rpc
       'supabase' use the url + anonKey below
       'demo'     this browser only, nothing shared
     On Netlify nothing needs changing: the site ships with its own backend
     (netlify/functions/api.js + Netlify Blobs), so riders on their own phones
     all see the same data. */
  backend: 'auto',
  api: '/api/rpc',

  url: '',      // Supabase only — e.g. 'https://abcdefgh.supabase.co'
  anonKey: '',  // Supabase only — e.g. 'eyJhbGciOi...'

  // Logo file. Default mark ta assets/icon.svg — nijer logo dile
  // assets/logo.png rekhe niche path ta bodle dao.
  logo: 'assets/icon.svg',

  version: '2.2.0'
};
