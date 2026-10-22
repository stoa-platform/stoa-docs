import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, existsSync} from 'node:fs';
import {resolve, join, dirname, extname, posix} from 'node:path';
import {enrichSitemaps} from './enrich-sitemap-hreflang.mjs';
import {generateRedirects} from './generate-redirects.mjs';
import {normalizeInternalLinks} from './normalize-internal-links.mjs';
function fixture(run) {
  const dir = mkdtempSync(resolve('.static-hosting-test-'));
  const put = (path, value) => { mkdirSync(resolve(dir, path, '..'), {recursive: true}); writeFileSync(join(dir, path), value); };
  try { run(dir, put); } finally { rmSync(dir, {recursive: true, force: true}); }
}
const origin = 'https://docs.gostoa.dev';
const sitemap = (paths) => `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((path) => `<url><loc>${origin}${path}</loc></url>`).join('')}</urlset>`;
test('six redirects, canonical, noindex and sitemap exclusion', () => fixture((dir, put) => {
  const entries = JSON.parse(readFileSync(new URL('../redirects.json', import.meta.url)));
  for (const {destination} of entries) put(join(destination.slice(1), 'index.html'), 'destination');
  put('sitemap.xml', sitemap(entries.map(({source}) => source + '/').concat(['/'])));
  put('fr/sitemap.xml', sitemap(['/fr/']));
  assert.equal(generateRedirects(dir), entries.length);
  for (const {source, destination} of entries) {
    const html = readFileSync(join(dir, source.slice(1), 'index.html'), 'utf8');
    assert.match(html, /noindex, follow/);
    assert.match(html, /http-equiv="refresh" content="0; url=/);
    assert.ok(html.includes(`rel="canonical" href="${origin}${destination}"`));
    assert.ok(html.includes(`<a href="${origin}${destination}">`));
    assert.ok(!readFileSync(join(dir, 'sitemap.xml'), 'utf8').includes(source));
  }
}));
test('collision preflight preserves existing pages and writes nothing', () => fixture((dir, put) => {
  put('target/index.html', 'target'); put('existing/index.html', 'keep');
  assert.throws(() => generateRedirects(dir, [{source: '/fresh', destination: '/target/'}, {source: '/existing', destination: '/target/'}]), /overwrite/);
  assert.equal(existsSync(join(dir, 'fresh/index.html')), false);
  assert.equal(readFileSync(join(dir, 'existing/index.html'), 'utf8'), 'keep');
}));
test('missing destinations, traversal, loops and duplicates fail', () => fixture((dir, put) => {
  put('target/index.html', 'target');
  for (const entries of [[{source: '/old', destination: '/missing/'}], [{source: '/../escape', destination: '/target/'}], [{source: '/old', destination: '/old/'}], [{source: '/old', destination: '/target/'}, {source: '/old', destination: '/target/'}]]) assert.throws(() => generateRedirects(dir, entries));
}));
test('link normalization and security metadata ordering are idempotent', () => fixture((dir, put) => {
  put('docs/example/index.html', 'page');
  put('index.html', `<html><head><meta charset="utf-8"><script>bootstrap()</script><meta http-equiv="Content-Security-Policy" content="default-src 'self'"><meta name="referrer" content="strict-origin-when-cross-origin"><script src="/js/theme-cookie.js"></script></head><body><a href="/docs/example?q=x#section">A</a><a href="${origin}/docs/example">B</a><a href="/image.svg">C</a><a href="https://www.gostoa.dev/contact/">D</a><a href="#local">E</a></body></html>`);
  normalizeInternalLinks(dir);
  const html = readFileSync(join(dir, 'index.html'), 'utf8');
  assert.ok(html.includes('href="/docs/example/?q=x#section"'));
  assert.ok(html.includes(`href="${origin}/docs/example/"`));
  assert.ok(html.includes('href="/image.svg"')); assert.ok(html.includes('href="#local"'));
  assert.ok(html.indexOf('Content-Security-Policy') < html.indexOf('theme-cookie.js'));
  assert.ok(html.indexOf('theme-cookie.js') < html.indexOf('bootstrap()'));
  normalizeInternalLinks(dir); assert.equal(readFileSync(join(dir, 'index.html'), 'utf8'), html);
}));
test('hreflang pairs, exclusions and trailing slashes are idempotent', () => fixture((dir, put) => {
  put('sitemap.xml', sitemap(['/', '/docs/example', '/docs/english-only', '/mcp-servers/', '/404.html']));
  put('fr/sitemap.xml', sitemap(['/fr/', '/fr/docs/example', '/fr/404.html']));
  enrichSitemaps(dir);
  const first = readFileSync(join(dir, 'sitemap.xml'), 'utf8');
  assert.ok(first.includes(`hreflang="fr-FR" href="${origin}/fr/docs/example/"`));
  assert.ok(first.includes(`hreflang="fr-FR" href="${origin}/fr/"`));
  assert.ok(!first.includes('/mcp-servers')); assert.ok(!first.includes('/404.html'));
  assert.ok(!first.includes('/fr/docs/english-only'));
  enrichSitemaps(dir); assert.equal(readFileSync(join(dir, 'sitemap.xml'), 'utf8'), first);
}));

test('theme cookie bridge accepts only light/dark and tolerates blocked storage', async () => {
  const {runInNewContext} = await import('node:vm');
  const script = readFileSync(new URL('../static/js/theme-cookie.js', import.meta.url), 'utf8');
  for (const value of ['light', 'dark', 'invalid', '']) {
    const attributes = {}; const stored = {};
    const context = {document: {cookie: `stoa-theme=${value}`, documentElement: {setAttribute: (k, v) => attributes[k] = v}}, window: {localStorage: {setItem: (k, v) => stored[k] = v}}};
    runInNewContext(script, context);
    assert.equal(attributes['data-theme'], ['light', 'dark'].includes(value) ? value : undefined);
    assert.equal(stored.theme, attributes['data-theme']);
    context.window.localStorage.setItem = () => { throw new Error('blocked'); };
    assert.doesNotThrow(() => runInNewContext(script, context));
  }
});

test('theme changes write a bounded cookie on the correct domain', async () => {
  const {runInNewContext} = await import('node:vm');
  const root = readFileSync(new URL('../src/theme/Root.tsx', import.meta.url), 'utf8');
  const effect = root.match(/useEffect\(\(\) => \{([\s\S]*?)\n  \}, \[\]\);/)[1];
  for (const hostname of ['docs.gostoa.dev', 'gostoa.dev', 'preview.invalid', 'othergostoa.dev']) {
    let callback; let cookie = ''; let theme = 'dark';
    const document = {documentElement: {getAttribute: () => theme}};
    Object.defineProperty(document, 'cookie', {set: (value) => cookie = value});
    class Observer { constructor(fn) { callback = fn; } observe() {} disconnect() {} }
    runInNewContext(`(() => {${effect}})()`, {document, window: {location: {hostname}}, MutationObserver: Observer});
    callback();
    assert.ok(cookie.startsWith('stoa-theme=dark; Max-Age=31536000; Path=/; SameSite=Lax; Secure'));
    assert.equal(cookie.includes('; Domain=.gostoa.dev'), ['docs.gostoa.dev', 'gostoa.dev'].includes(hostname));
    theme = 'invalid'; cookie = ''; callback(); assert.equal(cookie, '');
  }
});

test('compiled Markdown/MDX directory links retain anchors and asset paths', async () => {
  const {default: directoryLinks} = await import('./remark-directory-links.mjs');
  const nodes = [
    {type: 'link', url: '/docs/intro#section'},
    {type: 'definition', url: origin + '/fr/docs/intro?q=x'},
    {type: 'link', url: '/docs/file.json'},
    {type: 'link', url: 'https://www.gostoa.dev/contact/'},
    {type: 'mdxJsxFlowElement', attributes: [{type: 'mdxJsxAttribute', name: 'to', value: '/blog/example'}]},
    {type: 'link', url: '../guides/console.md#gateway-adapters'},
    {type: 'definition', url: './ibm-webmethods.md'},
    {type: 'code', attributes: {language: 'text'}},
    {type: 'code', attributes: 'text'},
    {type: 'code', attributes: null},
  ];
  const tree = {type: 'root', children: nodes}; directoryLinks()(tree);
  assert.equal(nodes[0].url, '/docs/intro/#section');
  assert.equal(nodes[1].url, origin + '/fr/docs/intro/?q=x');
  assert.equal(nodes[2].url, '/docs/file.json');
  assert.equal(nodes[3].url, 'https://www.gostoa.dev/contact/');
  assert.equal(nodes[4].attributes[0].value, '/blog/example/');
  assert.equal(nodes[5].url, '../guides/console.md#gateway-adapters');
  assert.equal(nodes[6].url, './ibm-webmethods.md');
  const first = JSON.stringify(tree); directoryLinks()(tree); assert.equal(JSON.stringify(tree), first);
});

for (const locale of ['en', 'fr']) test(`relative documentation links resolve with directory permalinks (${locale})`, (t) => {
  const root = new URL('../', import.meta.url);
  function documents(directory) {
    return readdirSync(new URL(directory, root), {withFileTypes: true}).flatMap((entry) => {
      const path = directory + entry.name;
      return entry.isDirectory() ? documents(path + '/') : /\.mdx?$/.test(path) ? [path] : [];
    });
  }
  const englishRoot = 'docs/';
  const frenchRoot = 'i18n/fr/docusaurus-plugin-content-docs/current/';
  const english = documents(englishRoot).map((path) => path.slice(englishRoot.length));
  const french = documents(frenchRoot).map((path) => path.slice(frenchRoot.length));
  const prefix = locale === 'fr' ? '/fr' : '';
  const translated = locale === 'fr' ? french : [];
  // Docusaurus falls back to the English document when a translation is absent.
  const sources = new Map(english.map((path) => [path, englishRoot + path]));
  for (const path of translated) sources.set(path, frenchRoot + path);
  const contents = new Map([...sources].map(([path, source]) => [path, readFileSync(new URL(source, root), 'utf8')]));
  const permalinks = new Map([...contents].map(([path, source]) => {
    const slug = source.match(/^slug:\s*(\S+)/m)?.[1];
    const route = slug ? posix.resolve('/', dirname(path), slug) : '/' + path.replace(/\.mdx?$/, '').replace(/(?:^|\/)(?:index|README)$/, '');
    return [path, prefix + '/docs' + route.replace(/\/$/, '') + '/'];
  }));
  const routes = new Set(permalinks.values());
  let checked = 0;
  for (const [path, source] of contents) {
    // Ignore examples in fenced blocks and inline code; inspect Markdown links,
    // reference definitions and literal MDX href/to attributes.
    const prose = source.replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, '').replace(/(`+)[^`\n]*?\1/g, '');
    const links = prose.matchAll(/\]\(<?([^\s)>]+)>?(?:\s+[^)]*)?\)|^\s*\[[^\]]+\]:\s*<?([^\s>]+)>?|\b(?:href|to)=["']([^"']+)["']/gm);
    for (const match of links) {
      const value = match[1] ?? match[2] ?? match[3];
      if (/^(?:[a-z][a-z\d+.-]*:|\/|#|\?)/i.test(value)) continue;
      const target = value.split(/[?#]/)[0];
      const extension = extname(target);
      const label = `${sources.get(path)}: ${value}`;
      if (/^\.mdx?$/.test(extension)) {
        assert.ok(sources.has(posix.normalize(posix.join(dirname(path), target))), label);
        checked++;
      } else if (!extension) {
        assert.ok(routes.has(new URL(value, origin + permalinks.get(path)).pathname), label);
        checked++;
      }
    }
  }
  t.diagnostic(`${sources.size} documents, ${checked} relative documentation links checked`);
});

test('minified unquoted HTML receives the same early metadata and URLs', () => fixture((dir, put) => {
  put('docs/example/index.html', 'page');
  put('index.html', '<html><head><meta charset=UTF-8><script>bootstrap()</script><meta http-equiv=Content-Security-Policy content="default-src self"><meta name=referrer content=strict-origin-when-cross-origin><script src=/js/theme-cookie.js></script></head><body><a href=/docs/example#section>A</a></body></html>');
  normalizeInternalLinks(dir);
  const html = readFileSync(join(dir, 'index.html'), 'utf8');
  assert.ok(html.includes('href="/docs/example/#section"'));
  assert.ok(html.indexOf('Content-Security-Policy') < html.indexOf('theme-cookie.js'));
  assert.ok(html.indexOf('theme-cookie.js') < html.indexOf('bootstrap()'));
}));
