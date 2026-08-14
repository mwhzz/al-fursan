/* -----------------------------------------------------------------------
   Al Fursan — the whole backend, on Netlify.

   One endpoint running the same store as the browser (js/store.js), with the
   data in Netlify Blobs. No external database and no second account.

   Written in the Functions v2 format (a Request in, a Response out). That
   matters: the v1 `exports.handler` style does not receive the Blobs context,
   so getStore() failed with "the environment has not been configured".

   POST /api/rpc   { "fn": "student_login", "args": { ... } }  ->  { ... }
-------------------------------------------------------------------------*/
import { getStore } from '@netlify/blobs';
import storeModule from '../../js/store.js';

const { blank, createStore } = storeModule;

const BLOB_STORE = 'al-fursan';
/* The database is created once, on the first request. To start over — before
   the academy has real data — set AF_DB_KEY in the site's environment
   variables to a new value (db2, db3…) and redeploy. */
const KEY = process.env.AF_DB_KEY || 'db';

/* Everything a signed-out visitor may call. Everything else needs a token, and
   the store checks the token itself. */
export const PUBLIC = new Set(['bootstrap', 'student_login', 'admin_login', 'log_error', 'logout']);

const HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const reply = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: HEADERS });

/** the handler, with its storage injected so it can be tested without Netlify */
export function makeHandler(openStore) {
  return async function handler(request) {
    // 204 must carry no body at all
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: HEADERS });
    if (request.method !== 'POST') return reply(405, { ok: false, error: 'method' });

    let payload;
    try { payload = await request.json(); }
    catch (e) { return reply(400, { ok: false, error: 'body' }); }

    const fn = String((payload && payload.fn) || '');
    const args = (payload && payload.args) || {};
    if (!/^[a-z_]{3,40}$/.test(fn)) return reply(400, { ok: false, error: 'fn' });
    if (!PUBLIC.has(fn) && !args.p_token) return reply(401, { ok: false, error: 'auth' });

    let store, db;
    try {
      store = await openStore(BLOB_STORE);
      db = await store.get(KEY, { type: 'json' });
    } catch (e) {
      return reply(503, { ok: false, error: 'storage', message: String((e && e.message) || e) });
    }

    // First ever request: settings, class times and the owner accounts. This is
    // written straight away — a fresh blank() on every read would hand out
    // different slot ids each time.
    let created = false;
    if (!db) { db = blank(); created = true; }

    let dirty = false;
    const handlers = createStore(db, () => { dirty = true; });
    if (!handlers[fn]) return reply(404, { ok: false, error: 'unknown' });

    let out;
    try {
      out = handlers[fn](args) || { ok: false, error: 'empty' };
    } catch (e) {
      return reply(500, { ok: false, error: 'handler', message: String((e && e.message) || e) });
    }

    if (dirty || created) {
      try { await store.setJSON(KEY, db); }
      catch (e) { return reply(503, { ok: false, error: 'storage', message: String((e && e.message) || e) }); }
    }
    return reply(200, out);
  };
}

/* Blobs configures itself on Netlify. If a site somehow lacks that context, it
   can be supplied through environment variables instead.

   consistency: 'strong' is not optional here. By default a blob read may serve
   a slightly stale copy, and this app writes a session then reads it back on
   the very next request — with the default, signing in returned "auth" for a
   second or two afterwards and the app reported that it could not reach the
   academy. */
const OPTS = { consistency: 'strong' };

function openBlobs(name) {
  try {
    return getStore({ name, ...OPTS });
  } catch (e) {
    const siteID = process.env.NETLIFY_SITE_ID || process.env.SITE_ID;
    const token = process.env.NETLIFY_API_TOKEN || process.env.NETLIFY_AUTH_TOKEN;
    if (siteID && token) return getStore({ name, siteID, token, ...OPTS });
    throw e;
  }
}

export default makeHandler(async name => openBlobs(name));

export const config = { path: '/api/rpc' };
