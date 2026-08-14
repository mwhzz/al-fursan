/* -----------------------------------------------------------------------
   Run the whole site locally, exactly as Netlify serves it: the built files
   from dist/ plus the function on /api/rpc. No Netlify CLI needed.

     node tests/serve.mjs            -> http://localhost:8787
     node tests/serve.mjs 3000 fresh -> another port, empty database

   The database is a JSON file (tests/.local-db.json), standing in for Blobs.
------------------------------------------------------------------------- */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../', import.meta.url));
const port = Number(process.argv[2]) || 8787;
const fresh = process.argv.includes('fresh');

const DB_FILE = path.join(root, 'tests', '.local-db.json');
if (fresh && fs.existsSync(DB_FILE)) fs.unlinkSync(DB_FILE);

execFileSync(process.execPath, [path.join(root, 'build.js')], { stdio: 'inherit' });
const dist = path.join(root, 'dist');

const { makeHandler } = require(path.join(root, 'netlify/functions/api.js'));
const fileStore = {
  async get() {
    try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch (e) { return null; }
  },
  async setJSON(key, value) { fs.writeFileSync(DB_FILE, JSON.stringify(value, null, 2)); }
};
const handler = makeHandler(async () => fileStore);

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname === '/api/rpc') {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const out = await handler({ httpMethod: req.method, body: Buffer.concat(chunks).toString() });
    res.writeHead(out.statusCode, out.headers || {});
    res.end(out.body || '');
    return;
  }

  let file = path.join(dist, url.pathname === '/' ? 'index.html' : url.pathname.slice(1));
  if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    file = path.join(dist, 'index.html');          // the catch-all rewrite
  }
  const body = fs.readFileSync(file);
  res.writeHead(200, {
    'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
    'Cache-Control': 'no-store'
  });
  res.end(body);
});

server.listen(port, () => {
  console.log('Al Fursan on http://localhost:' + port);
  console.log('database: ' + DB_FILE + (fresh ? '  (started fresh)' : ''));
});
