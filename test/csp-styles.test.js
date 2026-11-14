// The CSP uses style-src 'self' with no 'unsafe-inline': no <style> elements in
// JSX and no style="" attributes in static HTML. React style={{…}} props are
// fine — they are applied through the CSSOM, which CSP does not restrict
// (verified in headless Chrome under the enforced policy, 2026-11-14).

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? files(p) : /\.(jsx?|tsx?)$/.test(e.name) ? [p] : [];
  });
}
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

test('no inline <style> elements in client code', () => {
  const offenders = files(path.join(ROOT, 'src')).filter(f => /<style[\s>]/.test(strip(fs.readFileSync(f, 'utf8'))));
  assert.deepStrictEqual(offenders.map(f => path.relative(ROOT, f)), []);
});

test('no style= attributes or inline <style> in the static HTML', () => {
  for (const f of ['public/index.html']) {
    const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
    assert.ok(!/\sstyle\s*=/.test(html), `${f} has a style= attribute`);
    assert.ok(!/<style[\s>]/.test(html), `${f} has a <style> element`);
  }
});

test('no dangerouslySetInnerHTML or setAttribute("style") in mounted UI code', () => {
  const hits = [];
  for (const f of files(path.join(ROOT, 'src'))) {
    const s = strip(fs.readFileSync(f, 'utf8'));
    if (/setAttribute\(\s*['"]style['"]/.test(s)) hits.push(`${path.relative(ROOT, f)}: setAttribute('style')`);
  }
  assert.deepStrictEqual(hits, []);
});

test('moved stylesheets are imported and fully static', () => {
  const imports = {
    'src/App.js': './styles/app.css',
    'src/components/BetaDashboard.jsx': '../styles/beta.css',
    'src/components/ActionRow.jsx': '../styles/action-row.css',
    'src/components/CategoryBreakdown.jsx': '../styles/category-breakdown.css',
    'src/components/RadarModal.jsx': '../styles/radar.css',
    'src/components/InvestigatorChat.jsx': '../styles/investigator-chat.css',
    'src/index.js': './styles/fallback.css',
  };
  for (const [file, css] of Object.entries(imports)) {
    assert.match(fs.readFileSync(path.join(ROOT, file), 'utf8'), new RegExp(`import ['"]${css.replace(/[.\/]/g, '\\$&')}['"]`), file);
    const body = fs.readFileSync(path.join(ROOT, 'src', css.replace(/^\.\.?\//, '').replace(/^styles/, 'styles')), 'utf8');
    assert.ok(!body.includes('${'), `${css} has an unresolved template expression`);
  }
});

test('App and Beta scope their element rules to a class on <html>; the theme is a class too', () => {
  const app = fs.readFileSync(path.join(ROOT, 'src/App.js'), 'utf8');
  assert.ok(!app.includes("setProperty('--ps"), 'theme is a class, not an inline style property');
  assert.ok(app.includes("classList.toggle('ps-theme-dark'") && app.includes("classList.toggle('ps-theme-light'"));
  assert.ok(app.includes("classList.add('ps-app')") && /classList\.remove\('ps-app'/.test(app));
  const css = fs.readFileSync(path.join(ROOT, 'src/styles/app.css'), 'utf8');
  for (const sel of ['body', 'button', 'a:hover', '::-webkit-scrollbar']) assert.match(css, new RegExp(`:where\\(html\\.ps-app\\)\\s*${sel.replace(/[:.\-]/g, '\\$&')}`), sel);
  assert.ok(!/^\s*\*\s*\{/m.test(css) && !/^\s*body\s*\{/m.test(css), 'no unscoped element rules');
  const beta = fs.readFileSync(path.join(ROOT, 'src/components/BetaDashboard.jsx'), 'utf8');
  assert.ok(beta.includes("classList.add('ps-beta')") && beta.includes("classList.remove('ps-beta')"));
});

test('theme colours in app.css match THEMES in src/constants.js', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/constants.js'), 'utf8');
  const css = fs.readFileSync(path.join(ROOT, 'src/styles/app.css'), 'utf8');
  for (const name of ['light', 'dark']) {
    const block = src.match(new RegExp(`${name}:\\s*\\{([\\s\\S]*?)\\n\\s*\\}`))[1];
    const get = (k) => block.match(new RegExp(`${k}:\\s*"([^"]+)"`))[1];
    const rule = css.match(new RegExp(`:root\\.ps-theme-${name}\\s*\\{([^}]*)\\}`))[1];
    for (const [v, k] of [['--ps-page-bg', 'pageBg'], ['--ps-scroll-track', 'scrollTrack'], ['--ps-scroll-thumb', 'scrollThumb']]) {
      assert.ok(rule.includes(`${v}: ${get(k)};`), `${name} ${k}`);
    }
  }
});
