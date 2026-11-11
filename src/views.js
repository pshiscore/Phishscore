// Top-level views of the SPA and the URL path each one lives at.
//
// `activeView` used to be React state only: no view had a URL, the back button
// did nothing, and nothing could deep-link to Radar or the Glossary — even
// though public/llms.txt already pointed agents at /glossary. Paths follow the
// convention index.js already uses for /beta and /devs (rewritten to index.html
// in vercel.json). /beta, /devs and /report are owned elsewhere and are never
// treated as views.
//
// CommonJS so `node --test` can require it directly; CRA imports it fine.

const VIEW_PATHS = Object.freeze({
  dashboard: '/',
  faq: '/faq',
  radar: '/radar',
  news: '/news',
  'deep-intel': '/deep-intel',
  glossary: '/glossary',
  scanner: '/scanner',
});

const VIEWS = Object.freeze(Object.keys(VIEW_PATHS));
const DEFAULT_VIEW = 'dashboard';

// Paths that are real routes but not views of <App />.
const RESERVED_PATHS = Object.freeze(['/beta', '/devs', '/report']);

const PATH_VIEWS = Object.freeze(
  Object.fromEntries(Object.entries(VIEW_PATHS).map(([view, path]) => [path, view]))
);

function normalizePath(pathname) {
  const p = String(pathname || '/').split('?')[0].split('#')[0].replace(/\/+$/, '');
  return p === '' ? '/' : p.toLowerCase();
}

function isView(view) {
  return VIEWS.includes(view);
}

function viewFromPath(pathname) {
  return PATH_VIEWS[normalizePath(pathname)] || DEFAULT_VIEW;
}

function pathForView(view) {
  return VIEW_PATHS[view] || VIEW_PATHS[DEFAULT_VIEW];
}

module.exports = { VIEWS, VIEW_PATHS, DEFAULT_VIEW, RESERVED_PATHS, isView, viewFromPath, pathForView, normalizePath };
