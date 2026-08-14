/* -----------------------------------------------------------------------
   Assemble the files that get served, and nothing else.

   Publishing the repository root would upload node_modules, the test suite and
   supabase/schema.sql along with the site. This copies just the app into dist/.
-------------------------------------------------------------------------*/
const fs = require('fs');
const path = require('path');

const root = __dirname;
const dist = path.join(root, 'dist');

const FILES = ['index.html', 'manifest.webmanifest', 'sw.js'];
const DIRS = ['css', 'js', 'assets'];
/* the original photograph is kept in the repo for regenerating icons, but there
   is no reason to serve it */
const SKIP = new Set(['icon-source.jpg']);

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(src, dst);
    else fs.copyFileSync(src, dst);
  }
}

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

for (const f of FILES) fs.copyFileSync(path.join(root, f), path.join(dist, f));
for (const d of DIRS) copyDir(path.join(root, d), path.join(dist, d));

let count = 0, bytes = 0;
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else { count++; bytes += fs.statSync(p).size; }
  }
})(dist);

console.log('dist: ' + count + ' files, ' + (bytes / 1024).toFixed(0) + ' kB');
