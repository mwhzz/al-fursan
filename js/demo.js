/* -----------------------------------------------------------------------
   Demo backend — the shared store in js/store.js, kept in localStorage.
   Used when no Netlify function and no Supabase project are configured, so the
   app (and the test suite) runs with nothing behind it.
-------------------------------------------------------------------------*/
(function () {
  const KEY = 'af_demo_db_v2';
  let db = null;
  let handlers = null;

  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} };

  function load() {
    try {
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
