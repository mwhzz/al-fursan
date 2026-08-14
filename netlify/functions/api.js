/* -----------------------------------------------------------------------
   Al Fursan — the whole backend, on Netlify.

   One endpoint that runs the same store as the browser (js/store.js) and keeps
   the data in Netlify Blobs. No external database and no second account:
   Blobs ships with the site.

   POST /api/rpc   { "fn": "student_login", "args": { ... } }  ->  { ... }
-------------------------------------------------------------------------*/
const { blank, createStore } = require('../../js/store.js');

const BLOB_STORE = 'al-fursan';
/* The database is created once, on the first ever request. To start over —
   before the academy has real data — set AF_DB_KEY in the Netlify site's
   environment variables to any new value (db2, db3…) and redeploy. */
const KEY = process.env.AF_DB_KEY || 'db';

/* Everything a signed-out visitor may call. Everything else needs a token, and
   the store checks the token itself. */
const PUBLIC = new Set(['bootstrap', 'student_login', 'admin_login', 'log_error', 'logout']);

const HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const reply = (status, body) => ({ statusCode: status, headers: HEADERS, body: JSON.stringify(body) });

/** the handler, with its storage injected so it can be tested without Netlify */
function makeHandler(openStore) {
  return async function handler(event) {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: HEADERS, body: '' };
    if (event.httpMethod !== 'POST') return reply(405, { ok: false, error: 'method' });

    let payload;
    try { payload = JSON.parse(event.body || '{}'); }
    catch (e) { return reply(400, { ok: false, error: 'body' }); }

    const fn = String(payload.fn || '');
    const args = payload.args || {};
    if (!/^[a-z_]{3,40}$/.test(fn)) return reply(400, { ok: false, error: 'fn' });
    if (!PUBLIC.has(fn) && !args.p_token) return reply(401, { ok: false, error: 'auth' });

    let store, db;
    try {
      store = await openStore(BLOB_STORE);
      db = await store.get(KEY, { type: 'json' });
    } catch (e) {
      return reply(503, { ok: false, error: 'storage', message: String(e && e.message || e) });
    }
    // First ever request: settings, class times and the owner account. This has
    // to be written straight away — a fresh blank() every time would hand out
    // different slot ids on every read.
    let created = false;
    if (!db) { db = blank(); created = true; }

    let dirty = false;
    const handlers = createStore(db, () => { dirty = true; });
    if (!handlers[fn]) return reply(404, { ok: false, error: 'unknown' });

    let out;
    try {
      out = handlers[fn](args) || { ok: false, error: 'empty' };
    } catch (e) {
      return reply(500, { ok: false, error: 'handler', message: String(e && e.message || e) });
    }

    if (dirty || created) {
      try { await store.setJSON(KEY, db); }
      catch (e) { return reply(503, { ok: false, error: 'storage', message: String(e && e.message || e) }); }
    }
    return reply(200, out);
  };
}

// Netlify Blobs is required lazily so the module can be loaded in tests
let openBlobs = null;
exports.handler = makeHandler(async name => {
  if (!openBlobs) openBlobs = require('@netlify/blobs').getStore;
  return openBlobs(name);
});

exports.makeHandler = makeHandler;
exports.PUBLIC = PUBLIC;
