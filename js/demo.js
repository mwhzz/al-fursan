/* -----------------------------------------------------------------------
   Demo backend — the shared store in js/store.js, kept in localStorage.
   Used when no Netlify function and no Supabase project are configured, so the
   app (and the test suite) runs with nothing behind it.
-------------------------------------------------------------------------*/
(function () {
  /* Bump this whenever the seed changes. A browser that kept an older copy
     would otherwise keep signing people in against stale accounts and data. */
  const KEY = 'af_demo_db_v3';
  let db = null;
  let handlers = null;

  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} };

  function load() {
    try {
      // drop databases from earlier seeds so nobody is stuck on old accounts
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.indexOf('af_demo_db_') === 0 && k !== KEY) { localStorage.removeItem(k); i--; }
      }
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* corrupt or unavailable: start fresh */ }
    const fresh = AF_STORE.seed();
    try { localStorage.setItem(KEY, JSON.stringify(fresh)); } catch (e) {}
    return fresh;
  }

  function ready() {
    if (!handlers) { db = load(); handlers = AF_STORE.createStore(db, save); }
    return handlers;
  }

  window.DEMO = {
    reset() { try { localStorage.removeItem(KEY); } catch (e) {} db = null; handlers = null; },
    call(fn, args) {
      const H = ready();
      const h = H[fn];
      if (!h) return Promise.reject(new Error('Unknown function ' + fn));
      // a small delay so loading states behave like a real network
      return new Promise(res => setTimeout(() => {
        let out;
        try { out = h(args || {}); }
        catch (e) { out = { ok: false, error: 'demo', message: String(e && e.message || e) }; }
        res(out);
      }, 60));
    }
  };
})();
