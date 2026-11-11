import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {CONSENT_STORAGE_KEY, createAnalyticsController, installRouterGuard, sixMonthsFrom} from '../src/analytics/runtime.ts';
const require = createRequire(import.meta.url);
const {createMemoryHistory} = require('history');

function browser(saved, search = '?token=secret', clarityProjectId = '') {
  let clock = Date.UTC(2026, 0, 31, 12);
  const values = new Map(saved ? [[CONSENT_STORAGE_KEY, saved]] : []);
  const windowListeners = new Map();
  const documentListeners = new Map();
  const scripts = [];
  const cookies = [];
  const replacements = [];
  const masks = [];
  const timers = new Map();
  let timerId = 0;
  const localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
  const document = {
    referrer: 'https://example.com/private?email=hidden@example.com#secret',
    cookie: '',
    title: 'Private query must not be copied',
    documentElement: {setAttribute: (...args) => masks.push(args)},
    body: {setAttribute: (...args) => masks.push(args)},
    querySelectorAll: () => [],
    head: {appendChild: script => scripts.push(script)},
    createElement: () => ({remove() {}}),
    addEventListener: (name, fn, capture = false) => documentListeners.set(capture ? `${name}Capture` : name, fn),
    removeEventListener: (name, fn, capture = false) => documentListeners.delete(capture ? `${name}Capture` : name),
  };
  Object.defineProperty(document, 'cookie', {
    get: () => '_ga=abc; _ga_8PL054C7RH=def; _clck=one; _clsk=two; unrelated=value; _garden=other',
    set: value => cookies.push(value),
  });
  const win = {
    location: {origin: 'https://docs.gostoa.dev', protocol: 'https:', hostname: 'docs.gostoa.dev', pathname: '/docs/intro', search, hash: '#secret'},
    document, localStorage,
    addEventListener: (name, fn) => windowListeners.set(name, fn),
    removeEventListener: name => windowListeners.delete(name),
    setTimeout: (fn, delay) => { const id = ++timerId; timers.set(id, {fn, delay}); return id; },
    clearTimeout: id => timers.delete(id),
  };
  win.location.replace = url => replacements.push(url);
  win.history = {replaceState: () => { win.location.hash = ''; }};
  const controller = createAnalyticsController(win, 'G-DOCSTEST1', () => clock, clarityProjectId);
  const commands = () => (win.dataLayer ?? []).map(item => Array.from(item));
  const events = () => commands().filter(item => item[0] === 'event');
  return {win, controller, scripts, cookies, timers, values, replacements, masks, windowListeners, documentListeners, commands, events,
    now: () => clock, advance: ms => { clock += ms; }, load: () => scripts.at(-1).onload()};
}

test('no Google script or events before a choice, after refusal, or with an invalid ID', () => {
  const b = browser();
  b.controller.start(); b.controller.routeChanged('/docs/intro');
  assert.equal(b.scripts.length, 0);
  assert.equal(b.commands().length, 0);
  b.controller.choose('refused'); b.controller.routeChanged('/fr/docs/intro');
  assert.equal(b.scripts.length, 0);
  assert.equal(b.events().length, 0);
  assert.equal(b.win['ga-disable-G-DOCSTEST1'], true);
  const disabled = createAnalyticsController(b.win, '', b.now);
  disabled.start(); disabled.choose('accepted');
  assert.equal(b.scripts.length, 0);
});

test('acceptance loads one tag and emits one cleaned pageview after load', () => {
  const b = browser(); b.controller.start(); b.controller.choose('accepted');
  b.controller.routeChanged('/docs/current?credential=secret#fragment');
  assert.equal(b.scripts.length, 1);
  assert.equal(b.events().length, 0);
  b.load();
  assert.equal(b.events().length, 1);
  assert.equal(b.events()[0][1], 'page_view');
  assert.equal(b.events()[0][2].page_location, 'https://docs.gostoa.dev/docs/current');
  assert.equal(b.events()[0][2].page_referrer, 'https://example.com/');
  assert.equal(b.events()[0][2].page_title, 'STOA Docs');
  const config = b.commands().find(c => c[0] === 'config')[2];
  assert.equal(config.send_page_view, false);
  assert.equal(config.allow_google_signals, false);
  assert.equal(config.allow_ad_personalization_signals, false);
  assert.equal(config.site_section, 'docs');
  assert.equal(config.cookie_prefix, undefined);
  assert.equal(config.cookie_domain, undefined);
  assert.equal(config.cookie_update, false);
  assert.equal(JSON.stringify(b.events()).includes('secret'), false);
});

test('social attribution uses allowlisted landing parameters only after acceptance', () => {
  const landing = '?utm_source=linkedin&utm_medium=social&utm_campaign=docs&utm_content=company_profile&token=private';
  const b = browser(undefined, landing, 'testclarity12');
  b.win.location.hash = '';
  b.win.document.referrer = 'https://www.linkedin.com/';
  b.controller.start();
  assert.equal(b.scripts.length, 0);
  assert.equal(b.commands().length, 0);
  b.controller.choose('refused');
  assert.equal(b.scripts.length, 0);
  b.controller.choose('accepted');
  assert.deepEqual(b.scripts.map(script => script.id), ['stoa-docs-ga4']);
  b.load();
  const commands = b.commands();
  const index = commands.findIndex(command => command[0] === 'config');
  const config = commands[index][2];
  assert.deepEqual(Object.fromEntries(Object.entries(config).filter(([key]) => key.startsWith('campaign_'))), {
    campaign_source: 'linkedin', campaign_medium: 'social', campaign_name: 'docs', campaign_content: 'company_profile',
  });
  assert.equal(commands[index + 1][1], 'page_view');
  assert.equal(config.page_location, 'https://docs.gostoa.dev/docs/intro');
  assert.equal(config.page_referrer, 'https://www.linkedin.com/');
  assert.doesNotMatch(JSON.stringify(commands), /utm_|token|private/);
  b.win.location.search = '?utm_source=x&utm_medium=social&utm_campaign=docs';
  b.controller.routeChanged('/docs/next');
  assert.equal(b.commands().filter(command => command[0] === 'config').length, 1);
  assert.equal(b.events()[1][2].page_location, 'https://docs.gostoa.dev/docs/next');
});

test('unrecognised or ambiguous campaign fields do not transmit user-supplied values', () => {
  for (const [search, expected] of [
    ['?utm_source=x&utm_medium=social&utm_campaign=docs&utm_content=private', {campaign_source: 'x', campaign_medium: 'social', campaign_name: 'docs'}],
    ['?utm_source=private&utm_medium=social&utm_campaign=docs', {}],
    ['?utm_source=x&utm_medium=private&utm_campaign=docs', {}],
    ['?utm_source=x&utm_medium=social&utm_campaign=private', {}],
    ['?utm_source=x&utm_source=private&utm_medium=social&utm_campaign=docs', {}],
  ]) {
    const b = browser(undefined, search);
    b.controller.start(); b.controller.choose('accepted'); b.load();
    const config = b.commands().find(command => command[0] === 'config')[2];
    assert.deepEqual(Object.fromEntries(Object.entries(config).filter(([key]) => key.startsWith('campaign_'))), expected);
    assert.doesNotMatch(JSON.stringify(b.commands()), /utm_|private/);
  }
});

test('SPA pageviews deduplicate query/hash and repeated hooks but retain back navigation', () => {
  const b = browser(); b.controller.start(); b.controller.choose('accepted'); b.load();
  b.controller.routeChanged('/docs/intro');
  b.controller.routeChanged('/docs/intro?secret=yes');
  b.controller.routeChanged('/docs/intro#anchor');
  b.controller.routeChanged('/fr/docs/next');
  b.controller.routeChanged('/docs/intro');
  assert.deepEqual(b.events().map(c => c[2].page_location), [
    'https://docs.gostoa.dev/docs/intro', 'https://docs.gostoa.dev/fr/docs/next', 'https://docs.gostoa.dev/docs/intro',
  ]);
  assert.equal(b.events()[1][2].language, 'fr');
  assert.equal(b.scripts.length, 1);
});

test('withdrawal during loading sends no late page and reacceptance sends only the current page', () => {
  const b = browser(); b.controller.start(); b.controller.choose('accepted');
  b.controller.choose('refused'); b.load();
  assert.equal(b.events().length, 0);
  assert.equal(b.win['ga-disable-G-DOCSTEST1'], true);
  b.controller.routeChanged('/docs/after-refusal');
  b.controller.choose('accepted');
  assert.equal(b.events().length, 1);
  assert.equal(b.events()[0][2].page_location, 'https://docs.gostoa.dev/docs/after-refusal');
  assert.equal(b.scripts.length, 1);
});

test('withdrawal blocks loaded tracking and removes only accessible Google Analytics cookies', () => {
  const b = browser(); b.controller.start(); b.controller.choose('accepted'); b.load();
  b.controller.choose('refused'); b.controller.routeChanged('/docs/no');
  assert.equal(b.events().length, 1);
  assert.equal(b.win['ga-disable-G-DOCSTEST1'], true);
  assert.equal(b.cookies.some(c => c.startsWith('_ga=;') && c.includes('Domain=.gostoa.dev')), true);
  assert.equal(b.cookies.some(c => c.startsWith('_ga_8PL054C7RH=;') && c.includes('Domain=docs.gostoa.dev')), true);
  assert.equal(b.cookies.some(c => /^(unrelated|_garden)=/.test(c)), false);
});

test('six calendar months, expiry and corrupted storage fail closed', () => {
  assert.equal(new Date(sixMonthsFrom(Date.UTC(2025, 7, 31))).toISOString(), '2026-02-28T00:00:00.000Z');
  const b = browser(); b.controller.start(); b.controller.choose('accepted'); b.load();
  const saved = JSON.parse(b.values.get(CONSENT_STORAGE_KEY));
  assert.equal(saved.expiresAt, sixMonthsFrom(b.now()));
  b.advance(saved.expiresAt - b.now() + 1);
  b.controller.routeChanged('/expired');
  assert.equal(b.controller.getChoice(), 'unknown');
  assert.equal(b.events().length, 1);
  assert.equal(b.win['ga-disable-G-DOCSTEST1'], true);
  b.values.set(CONSENT_STORAGE_KEY, '{broken');
  b.windowListeners.get('storage')({key: CONSENT_STORAGE_KEY});
  assert.equal(b.controller.getChoice(), 'unknown');
  assert.equal(b.scripts.length, 1);
});

test('saved refusal persists; saved acceptance loads; unavailable storage remains session-only', () => {
  for (const choice of ['accepted', 'refused']) {
    const b = browser(JSON.stringify({version: 2, choice, expiresAt: Date.UTC(2026, 6, 31)}));
    b.controller.start();
    assert.equal(b.controller.getChoice(), choice);
    assert.equal(b.scripts.length, choice === 'accepted' ? 1 : 0);
  }
  const b = browser();
  b.win.localStorage = {getItem() {throw Error('blocked');}, setItem() {throw Error('blocked');}, removeItem() {throw Error('blocked');}};
  b.controller.start(); b.controller.choose('accepted'); b.load();
  assert.equal(b.controller.getChoice(), 'accepted');
  assert.equal(b.events().length, 1);
});

test('useful clicks send fixed names only; other links and refused clicks do not send', () => {
  const b = browser(); b.controller.start(); b.controller.choose('accepted'); b.load();
  const click = href => b.documentListeners.get('click')({button: 0, target: {closest: () => ({href})}});
  click('https://docs.gostoa.dev/fr/docs/guides/quickstart?email=private@example.com#secret');
  click('https://github.com/stoa-platform/stoa?token=private');
  click('https://github.com/another-user/private');
  assert.deepEqual(b.events().map(c => c[1]), ['page_view', 'quickstart_click', 'github_click']);
  assert.equal(JSON.stringify(b.events()).includes('private'), false);
  b.controller.choose('refused'); click('https://github.com/stoa-platform/stoa');
  assert.equal(b.events().length, 3);
});

test('only exact approved social links emit fixed events and only with consent', () => {
  const b = browser();
  const company = 'https://www.linkedin.com/company/10041472/';
  const profile = 'https://www.linkedin.com/in/christophe-aboulicam/';
  const x = 'https://x.com/caboulicam';
  b.controller.start();
  const click = href => b.documentListeners.get('click')({button: 0, target: {closest: () => ({href})}});
  click(company);
  assert.equal(b.events().length, 0);
  b.controller.choose('accepted'); b.load();
  click(company); click(profile); click(x);
  click(`${company}?token=private`);
  click(`${profile}#private`);
  click('https://www.linkedin.com/company/other/');
  click('https://x.com/other');
  assert.deepEqual(b.events().map(c => c[1]), [
    'page_view', 'social_linkedin_company_click', 'social_linkedin_profile_click', 'social_x_profile_click',
  ]);
  assert.doesNotMatch(JSON.stringify(b.events()), /www\.linkedin\.com|x\.com|caboulicam|private/);
  b.controller.choose('refused'); click(x);
  assert.equal(b.events().length, 4);
});

test('cross-tab refusal disables a loaded tag and expiry timers stay within browser limits', () => {
  const b = browser(); b.controller.start(); b.controller.choose('accepted'); b.load();
  assert.equal([...b.timers.values()].every(t => t.delay <= 2_147_483_647), true);
  b.values.set(CONSENT_STORAGE_KEY, JSON.stringify({version: 2, choice: 'refused', expiresAt: sixMonthsFrom(b.now())}));
  b.windowListeners.get('storage')({key: CONSENT_STORAGE_KEY});
  assert.equal(b.controller.getChoice(), 'refused');
  assert.equal(b.win['ga-disable-G-DOCSTEST1'], true);
  b.controller.destroy();
  assert.equal(b.windowListeners.size, 0);
  assert.equal(b.documentListeners.size, 0);
});

test('a failed refusal write takes precedence over the old readable acceptance', () => {
  const b = browser(); b.controller.start(); b.controller.choose('accepted'); b.load();
  b.win.localStorage.setItem = () => { throw Error('quota'); };
  b.controller.choose('refused');
  assert.equal(b.controller.getChoice(), 'refused');
  assert.equal(b.win['ga-disable-G-DOCSTEST1'], true);
  b.controller.routeChanged('/must-not-send');
  assert.equal(b.events().length, 1);
});

test('localhost, preview and lookalike hosts keep choice functional but never load Google', () => {
  for (const hostname of ['localhost', '127.0.0.1', 'preview.vercel.app', 'docs.gostoa.dev.evil.example']) {
    const b = browser();
    b.win.location.hostname = hostname;
    b.win.location.origin = `https://${hostname}`;
    b.win.location.search = ''; b.win.location.hash = '';
    b.win.document.referrer = 'https://example.com/';
    const local = createAnalyticsController(b.win, 'G-DOCSTEST1', b.now, 'testclarity12');
    local.start(); local.choose('accepted'); local.routeChanged('/docs/intro');
    assert.equal(local.getChoice(), 'accepted');
    assert.equal(b.scripts.length, 0);
    assert.equal(b.events().length, 0);
    local.choose('refused');
    assert.equal(local.getChoice(), 'refused');
    assert.equal(b.cookies.length, 0, 'an unrelated preview origin must not lose its cookies');
  }
});

test('a returning visit with an expired saved acceptance purges Google cookies without loading', () => {
  const b = browser(JSON.stringify({version: 2, choice: 'accepted', expiresAt: Date.UTC(2025, 6, 31)}));
  b.controller.start();
  assert.equal(b.controller.getChoice(), 'unknown');
  assert.equal(b.scripts.length, 0);
  assert.equal(b.win['ga-disable-G-DOCSTEST1'], true);
  assert.equal(b.cookies.some(c => c.startsWith('_ga=;') && c.includes('Domain=.gostoa.dev')), true);
  assert.equal(b.values.has(CONSENT_STORAGE_KEY), false);
});

function clarityBrowser(projectId = 'testclarity12') {
  const b = browser();
  b.win.location.search = ''; b.win.location.hash = '';
  b.win.document.referrer = 'https://example.com/';
  b.recorder = createAnalyticsController(b.win, 'G-DOCSTEST1', b.now, projectId);
  b.recorder.start();
  return b;
}

test('optional Clarity stays absent without an ID or consent; masking precedes its script', () => {
  const empty = clarityBrowser(''); empty.recorder.choose('accepted');
  assert.equal(empty.scripts.some(s => s.id === 'stoa-docs-clarity'), false);
  const b = clarityBrowser();
  assert.equal(b.scripts.length, 0);
  b.recorder.choose('accepted');
  const script = b.scripts.find(s => s.id === 'stoa-docs-clarity');
  assert.ok(script);
  assert.deepEqual(b.masks, [['data-clarity-mask', 'true'], ['data-clarity-mask', 'true']]);
  script.onload();
  assert.deepEqual(b.win.clarity.q, [
    ['consentv2', {ad_Storage: 'denied', analytics_Storage: 'granted'}],
    ['set', 'site_section', 'docs'],
  ]);
});

test('Clarity refuses dirty initial URL/referrer and remains stopped after input focus', () => {
  const dirty = clarityBrowser(); dirty.win.document.referrer = 'https://example.com/?private=yes';
  dirty.recorder.choose('accepted');
  assert.equal(dirty.scripts.some(s => s.id === 'stoa-docs-clarity'), false);
  const b = clarityBrowser(); b.recorder.choose('accepted');
  const script = b.scripts.find(s => s.id === 'stoa-docs-clarity'); script.onload();
  const field = {closest: () => ({}), setAttribute: (...args) => b.masks.push(args)};
  b.documentListeners.get('focusinCapture')({target: field});
  assert.equal(b.win.clarity.q.some(c => c[0] === 'stop'), true);
  b.recorder.routeChanged('/docs/another');
  assert.equal(b.scripts.filter(s => s.id === 'stoa-docs-clarity').length, 1);
  assert.equal(b.replacements.length, 0, 'typing must not reload the page');
});

test('Clarity withdrawal purges only tracker cookies and reloads with a fail-closed refusal', () => {
  const b = clarityBrowser(); b.recorder.choose('accepted');
  b.win.localStorage.setItem = () => { throw Error('quota'); };
  b.recorder.choose('refused');
  assert.equal(b.recorder.getChoice(), 'refused');
  assert.equal(b.cookies.some(c => c.startsWith('_clck=;')), true);
  assert.equal(b.cookies.some(c => c.startsWith('_clsk=;')), true);
  assert.equal(b.cookies.some(c => c.startsWith('unrelated=')), false);
  assert.equal(b.replacements[0], 'https://docs.gostoa.dev/docs/intro#stoa-privacy-optout');
  const after = browser(JSON.stringify({version: 2, choice: 'accepted', expiresAt: Date.UTC(2026, 6, 31)}));
  after.win.location.hash = '#stoa-privacy-optout';
  const controller = createAnalyticsController(after.win, 'G-DOCSTEST1', after.now, 'testclarity12');
  controller.start();
  assert.equal(controller.getChoice(), 'refused');
  assert.equal(after.scripts.length, 0);
  after.win.location.hash = '';
  controller.routeChanged('/docs/next');
  assert.equal(controller.getChoice(), 'refused', 'SPA navigation must not revive old stored acceptance');
  assert.equal(after.scripts.length, 0);
});

test('a previous Google-only consent is not extended to replay recording', () => {
  const b = browser(JSON.stringify({version: 1, choice: 'accepted', expiresAt: Date.UTC(2026, 6, 31)}));
  const controller = createAnalyticsController(b.win, 'G-DOCSTEST1', b.now, 'testclarity12');
  controller.start();
  assert.equal(controller.getChoice(), 'unknown');
  assert.equal(b.scripts.length, 0);
});

test('Clarity stops before internal navigation and restarts only after the Docusaurus route', () => {
  const b = clarityBrowser(); b.recorder.choose('accepted');
  b.scripts.find(s => s.id === 'stoa-docs-clarity').onload();
  const commands = b.win.clarity.q;
  const cookieWrites = b.cookies.length;
  b.documentListeners.get('clickCapture')({target: {closest: () => ({href: 'https://docs.gostoa.dev/docs/next'})}});
  assert.equal(commands.at(-1)[0], 'stop');
  b.recorder.beforeRouteChange();
  assert.equal(commands.filter(c => c[0] === 'stop').length, 1, 'duplicate hooks do not add queued stops');
  b.win.location.pathname = '/docs/next';
  b.recorder.routeChanged('/docs/next');
  assert.equal(commands.filter(c => c[0] === 'start').length, 1);
  assert.equal(b.scripts.filter(s => s.id === 'stoa-docs-clarity').length, 1);
  assert.equal(b.cookies.length, cookieWrites, 'ordinary navigation preserves the consented session');
  b.windowListeners.get('popstate')();
  assert.equal(commands.at(-1)[0], 'stop');
});

test('dedicated search, feedback and demo routes never initialise Clarity', () => {
  for (const pathname of ['/search', '/feedback', '/demo', '/fr/search', '/fr/feedback', '/fr/demo']) {
    const b = clarityBrowser(); b.win.location.pathname = pathname;
    b.recorder.routeChanged(pathname); b.recorder.choose('accepted');
    assert.equal(b.scripts.some(s => s.id === 'stoa-docs-clarity'), false, pathname);
  }
});

test('router guard runs before programmatic push/replace and never blocks navigation', () => {
  const history = createMemoryHistory({initialEntries: ['/docs/intro']});
  const order = [];
  const dispose = installRouterGuard(history, () => order.push('stop'));
  history.listen(location => order.push(location.pathname));
  history.push('/docs/next'); history.replace('/docs/replaced');
  assert.deepEqual(order, ['stop', '/docs/next', 'stop', '/docs/replaced']);
  dispose(); history.push('/docs/after-dispose');
  assert.equal(order.at(-1), '/docs/after-dispose');
});

test('same-page anchors stop Clarity before the URL fragment can be recorded', () => {
  const b = clarityBrowser(); b.recorder.choose('accepted');
  b.scripts.find(s => s.id === 'stoa-docs-clarity').onload();
  const commands = b.win.clarity.q;
  b.documentListeners.get('clickCapture')({target: {closest: () => ({href: 'https://docs.gostoa.dev/docs/intro#section'})}});
  assert.equal(commands.at(-1)[0], 'stop');
});
