// The client may only read REACT_APP_* variables that are always defined at
// build time. If code reads an unset one (or process.env dynamically), CRA's
// DefinePlugin substitutes the ENTIRE process.env object, which on Vercel
// includes the commit message, author, branch URL and repo metadata.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const SRC = path.join(__dirname, '..', 'src');
// Set in Vercel (all environments) and in .env.local, or by the build script.
const ALWAYS_DEFINED = new Set([
  'NODE_ENV',
  'REACT_APP_SUPABASE_URL', 'REACT_APP_SUPABASE_ANON_KEY',
  'REACT_APP_SENTRY_DSN', 'REACT_APP_RECAPTCHA_SITE_KEY',
  'REACT_APP_RELEASE', // package.json build script
]);

function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? files(p) : /\.(jsx?|tsx?)$/.test(e.name) ? [p] : [];
  });
}

test('client code reads only always-defined env vars, and never process.env as a whole', () => {
  const problems = [];
  for (const f of files(SRC)) {
    const src = fs.readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '');
    for (const m of src.matchAll(/process\.env(\.([A-Za-z0-9_]+)|\s*\[|(?![.\w]))/g)) {
      const name = m[2];
      if (!name) problems.push(`${path.relative(SRC, f)}: dynamic process.env access`);
      else if (!ALWAYS_DEFINED.has(name)) problems.push(`${path.relative(SRC, f)}: process.env.${name} may be unset`);
    }
  }
  assert.deepStrictEqual(problems, []);
});

test('the build script always defines REACT_APP_RELEASE as a short SHA (or "dev")', () => {
  const build = require('../package.json').scripts.build;
  assert.match(build, /^REACT_APP_RELEASE=\$\(printf %\.7s "\$\{VERCEL_GIT_COMMIT_SHA:-dev\}"\) react-scripts build/);
  assert.ok(!/COMMIT_MESSAGE/.test(build));
});

test('Sentry session replay masks all text and blocks all media', () => {
  const index = fs.readFileSync(path.join(SRC, 'index.js'), 'utf8');
  assert.match(index, /replayIntegration\(\{\s*maskAllText:\s*true,\s*blockAllMedia:\s*true\s*\}\)/);
  assert.ok(!/maskAllText:\s*false|blockAllMedia:\s*false/.test(index));
});
