import {socialLinks} from '../social-links.mjs';

export type ConsentChoice = 'accepted' | 'refused' | 'unknown';
type SavedChoice = {version: 2; choice: 'accepted' | 'refused'; expiresAt: number};
type Gtag = (...args: unknown[]) => void;
type Clarity = ((...args: unknown[]) => void) & {q?: unknown[][]};
type AnalyticsWindow = Window & {dataLayer?: unknown[]; gtag?: Gtag; clarity?: Clarity};

export const CONSENT_STORAGE_KEY = 'stoa.docs.analytics-consent.v2';
const REFUSAL_FRAGMENT = '#stoa-privacy-optout';
const MAX_TIMER_DELAY = 2_147_483_647;
const AD_CONSENT = {
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
};

// React Router/history runs this callback before its native pushState/replaceState.
// Returning undefined always permits navigation: this is an observation guard.
export function installRouterGuard(history: {block: (prompt: () => undefined) => () => void}, beforeNavigation: () => void) {
  return history.block(() => { beforeNavigation(); return undefined; });
}

export function sixMonthsFrom(timestamp: number): number {
  const date = new Date(timestamp);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + 6);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date.getTime();
}

function socialCampaign(search: string) {
  const params = new URLSearchParams(search);
  if (['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'].some(name => params.getAll(name).length > 1)) return {};
  const source = params.get('utm_source');
  if ((source !== 'linkedin' && source !== 'x') ||
      params.get('utm_medium') !== 'social' || params.get('utm_campaign') !== 'docs') return {};

  const content = params.get('utm_content');
  return {
    campaign_source: source,
    campaign_medium: 'social',
    campaign_name: 'docs',
    ...(content === 'company_profile' || content === 'personal_profile' || content === 'post'
      ? {campaign_content: content} : {}),
  };
}

export function createAnalyticsController(win: AnalyticsWindow, measurementId: string, now = Date.now, clarityProjectId = '') {
  const configured = /^G-[A-Z0-9]+$/.test(measurementId);
  const clarityConfigured = /^[a-z0-9]{6,20}$/i.test(clarityProjectId);
  const productionHost = win.location.hostname === 'docs.gostoa.dev' && win.location.protocol === 'https:';
  const listeners = new Set<() => void>();
  let choice: ConsentChoice = 'unknown';
  let forcedRefusal = win.location.hash === REFUSAL_FRAGMENT;
  let memoryChoice: SavedChoice | null = forcedRefusal
    ? {version: 2, choice: 'refused', expiresAt: sixMonthsFrom(now())} : null;
  let storageAvailable = true;
  let started = false;
  let loaded = false;
  let loading = false;
  let googleConfigured = false;
  let lastPage: string | null = null;
  let currentPath = win.location.pathname;
  const landingCampaign = socialCampaign(win.location.search);
  let expiryTimer: number | undefined;
  let clarityLoading = false;
  let clarityLoaded = false;
  let clarityRunning = false;
  let clarityBlocked = false;
  let claritySensitive = false;
  let clarityScript: HTMLScriptElement | undefined;
  let reloading = false;

  function disable(disabled: boolean) {
    (win as unknown as Record<string, unknown>)[`ga-disable-${measurementId}`] = disabled;
  }

  function readChoice(): SavedChoice | null {
    // An explicit fallback refusal survives a reload even when browser storage fails.
    if (forcedRefusal) return memoryChoice && memoryChoice.expiresAt > now() ? memoryChoice : null;
    let saved: unknown = memoryChoice;
    // A failed write must never restore an older saved acceptance over a new refusal.
    if (storageAvailable) {
      try {
        const raw = win.localStorage.getItem(CONSENT_STORAGE_KEY);
        if (raw) {
          try { saved = JSON.parse(raw); } catch { saved = null; }
        } else saved = null;
      } catch { storageAvailable = false; }
    }
    const record = saved as SavedChoice | null;
    if (record?.version === 2 && (record.choice === 'accepted' || record.choice === 'refused') &&
        Number.isFinite(record.expiresAt) && record.expiresAt > now()) return record;
    if (record?.version === 2 && Number.isFinite(record.expiresAt) && record.expiresAt <= now()) {
      // On a later visit the initial state is already unknown, so refresh's
      // state-change branch alone would miss the expiry cookie cleanup.
      disable(true);
      clearGoogleCookies();
    }
    memoryChoice = null;
    try { win.localStorage.removeItem(CONSENT_STORAGE_KEY); } catch { /* Preference remains session-only. */ }
    return null;
  }

  function clearGoogleCookies(clarityOnly = false) {
    if ((!configured && !clarityConfigured) || !productionHost) return;
    // Only Google Analytics names; never touch login, session or preference cookies.
    let names: string[];
    try {
      names = win.document.cookie.split(';').map(item => item.trim().split('=')[0])
        .filter(name => /^(?:_clck|_clsk)$/.test(name) || (!clarityOnly && /^_ga(?:_[A-Za-z0-9_]+)?$/.test(name)));
    } catch { return; }
    const domains = ['', win.location.hostname];
    if (win.location.hostname === 'gostoa.dev' || win.location.hostname.endsWith('.gostoa.dev')) domains.push('.gostoa.dev');
    const paths = new Set(['/']);
    const segments = win.location.pathname.split('/').filter(Boolean);
    for (let i = 1; i <= segments.length; i++) {
      const path = `/${segments.slice(0, i).join('/')}`;
      paths.add(path); paths.add(`${path}/`);
    }
    for (const name of names) for (const domain of domains) for (const path of paths) {
      try {
        win.document.cookie = `${name}=; Max-Age=0; Path=${path}; SameSite=Lax${domain ? `; Domain=${domain}` : ''}`;
      } catch { /* A browser may block cookie access; the tag remains disabled. */ }
    }
  }

  function stopClarity(permanent = true) {
    const hadRecorder = clarityLoading || clarityLoaded;
    if (permanent) clarityBlocked = true;
    if (clarityRunning || (clarityLoading && permanent)) win.clarity?.('stop');
    clarityRunning = false;
    if (permanent) {
      clarityScript?.remove();
      clearGoogleCookies(true);
    }
    return hadRecorder;
  }

  function reloadWithoutTrackers() {
    if (reloading) return;
    reloading = true;
    // A new document is necessary: Clarity can restart internally after stop().
    // The refusal fragment is a fail-closed fallback if local storage is blocked.
    win.location.replace(`${win.location.origin}${win.location.pathname}${win.location.search}${REFUSAL_FRAGMENT}`);
  }

  function startClarity() {
    if (!clarityConfigured || !productionHost || clarityBlocked || clarityLoading || clarityRunning || choice !== 'accepted') return;
    try {
      const referrer = win.document.referrer ? new URL(win.document.referrer) : null;
      if (/^(?:\/fr)?\/(?:search|feedback|demo)(?:\/|$)/.test(currentPath) ||
          win.location.search || win.location.hash || referrer?.search || referrer?.hash) {
        clarityBlocked = true;
        claritySensitive = true;
        return;
      }
    } catch { clarityBlocked = true; return; }
    // Whole-page masking covers current and future descendants, including search.
    win.document.documentElement.setAttribute('data-clarity-mask', 'true');
    win.document.body.setAttribute('data-clarity-mask', 'true');
    win.document.querySelectorAll('input, textarea, select, [contenteditable], form').forEach(element => {
      element.setAttribute('data-clarity-mask', 'true');
    });
    if (clarityLoaded) {
      // stop() leaves the SDK queue available. Only this lifecycle path restarts it.
      win.clarity?.('start');
      clarityRunning = true;
      win.clarity?.('consentv2', {ad_Storage: 'denied', analytics_Storage: 'granted'});
      win.clarity?.('set', 'site_section', 'docs');
      return;
    }
    if (!win.clarity) {
      const queue: Clarity = (...args) => { (queue.q = queue.q || []).push(args); };
      win.clarity = queue;
    }
    clarityLoading = true;
    clarityScript = win.document.createElement('script');
    clarityScript.id = 'stoa-docs-clarity';
    clarityScript.async = true;
    clarityScript.src = `https://www.clarity.ms/tag/${clarityProjectId}`;
    clarityScript.onload = () => {
      clarityLoading = false;
      clarityLoaded = true;
      clarityRunning = true;
      if (refresh()?.choice !== 'accepted' || clarityBlocked) { stopClarity(); return; }
      win.clarity?.('consentv2', {ad_Storage: 'denied', analytics_Storage: 'granted'});
      win.clarity?.('set', 'site_section', 'docs');
    };
    clarityScript.onerror = () => { clarityLoading = false; clarityScript?.remove(); };
    win.document.head.appendChild(clarityScript);
  }

  function onSensitiveFocus(event: FocusEvent) {
    const element = event.target as Element | null;
    if (!element?.closest?.('input, textarea, select, [contenteditable]')) return;
    element.setAttribute('data-clarity-mask', 'true');
    claritySensitive = true;
    // Never restart Clarity for this document once typing can begin.
    stopClarity();
  }

  function onInternalNavigation(event: MouseEvent) {
    const element = event.target as Element | null;
    const anchor = element?.closest?.('a[href]') as HTMLAnchorElement | null;
    if (!anchor) return;
    try {
      const destination = new URL(anchor.href, win.location.origin);
      if (destination.origin === win.location.origin &&
          (destination.pathname !== currentPath || destination.search !== win.location.search ||
           destination.hash !== win.location.hash)) stopClarity(false);
    } catch { /* Non-URL links are not a navigation target. */ }
  }

  function beforeRouteChange() { stopClarity(false); }

  function refresh(): SavedChoice | null {
    const saved = readChoice();
    const next = saved?.choice ?? 'unknown';
    if (choice !== next) {
      choice = next;
      if (next !== 'accepted') {
        disable(true);
        lastPage = null;
        // ga-disable blocks the already loaded tag, including automatic engagement.
        if (loaded) win.gtag?.('consent', 'update', {...AD_CONSENT, analytics_storage: 'denied'});
        const hadRecorder = stopClarity();
        clearGoogleCookies();
        if (hadRecorder) reloadWithoutTrackers();
      }
      listeners.forEach(listener => listener());
    }
    if (expiryTimer !== undefined) win.clearTimeout(expiryTimer);
    expiryTimer = saved ? win.setTimeout(() => { refresh(); }, Math.min(saved.expiresAt - now(), MAX_TIMER_DELAY)) : undefined;
    return saved;
  }

  function pageLocation(path = currentPath): string {
    const url = new URL(path, win.location.origin);
    return `${win.location.origin}${url.pathname}`;
  }

  function cleanReferrer(): string {
    try {
      const url = new URL(win.document.referrer);
      if (!['https:', 'http:'].includes(url.protocol)) return '';
      return url.origin === win.location.origin ? `${url.origin}${url.pathname}` : `${url.origin}/`;
    } catch { return ''; }
  }

  function pageParameters() {
    return {
      send_to: measurementId,
      page_location: pageLocation(),
      page_referrer: lastPage ?? cleanReferrer(),
      page_title: 'STOA Docs',
      site_section: 'docs',
      language: /^\/fr(?:\/|$)/.test(currentPath) ? 'fr' : 'en',
    };
  }

  function sendPage() {
    if (!refresh() || choice !== 'accepted' || !loaded || !googleConfigured) return;
    const page = pageLocation();
    if (lastPage === page) return;
    win.gtag?.('event', 'page_view', pageParameters());
    lastPage = page;
  }

  function activate() {
    const saved = refresh();
    if (!configured || !productionHost || saved?.choice !== 'accepted') return;
    disable(false);
    if (loaded) {
      win.gtag?.('consent', 'update', {...AD_CONSENT, analytics_storage: 'granted'});
      if (!googleConfigured) {
        win.gtag?.('js', new Date(now()));
        win.gtag?.('config', measurementId, {
          ...pageParameters(), ...landingCampaign, send_page_view: false,
          allow_google_signals: false, allow_ad_personalization_signals: false,
          cookie_expires: Math.ceil((saved.expiresAt - now()) / 1000), cookie_update: false,
        });
        googleConfigured = true;
      }
      sendPage();
      return;
    }
    if (loading) return;
    loading = true;
    win.dataLayer = win.dataLayer || [];
    win.gtag = win.gtag || function () { win.dataLayer!.push(arguments); };
    win.gtag('consent', 'default', {...AD_CONSENT, analytics_storage: 'denied'});
    win.gtag('set', 'ads_data_redaction', true);
    win.gtag('set', 'url_passthrough', false);
    const script = win.document.createElement('script');
    script.id = 'stoa-docs-ga4';
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    script.onload = () => {
      loading = false;
      loaded = true;
      // Re-read the choice: it may have changed during the network request.
      activate();
    };
    script.onerror = () => { loading = false; script.remove(); };
    win.document.head.appendChild(script);
  }

  function trackUsefulClick(event: MouseEvent) {
    if (!productionHost || event.button !== 0 || choice !== 'accepted' || !loaded || !googleConfigured || refresh()?.choice !== 'accepted') return;
    const element = event.target as Element | null;
    const anchor = element?.closest?.('a[href]') as HTMLAnchorElement | null;
    if (!anchor) return;
    let target: URL;
    try { target = new URL(anchor.href, win.location.origin); } catch { return; }
    let name: string | undefined;
    if (target.origin === win.location.origin && /^(?:\/fr)?\/docs\/guides\/(?:quickstart|stoactl-quickstart)\/?$/.test(target.pathname)) name = 'quickstart_click';
    if (target.origin === 'https://github.com' && /^\/stoa-platform(?:\/|$)/.test(target.pathname)) name = 'github_click';
    const social = socialLinks.find(link => link.href === target.href);
    if (social) name = `social_${social.category}_click`;
    if (name) win.gtag?.('event', name, pageParameters());
  }

  function onStorage(event: StorageEvent) {
    if (event.key !== CONSENT_STORAGE_KEY && event.key !== null) return;
    memoryChoice = null;
    forcedRefusal = false;
    storageAvailable = true;
    refresh();
    if (choice === 'accepted') { activate(); startClarity(); }
  }

  function onActivity() {
    refresh();
    if (choice === 'accepted') {
      if (!claritySensitive && !clarityLoaded && !clarityLoading) clarityBlocked = false;
      activate(); startClarity();
    }
  }

  return {
    configured,
    getChoice: () => choice,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    start() {
      if (started || (!configured && !clarityConfigured)) return;
      started = true;
      disable(true);
      win.addEventListener('storage', onStorage);
      win.addEventListener('focus', onActivity);
      win.document.addEventListener('visibilitychange', onActivity);
      win.document.addEventListener('click', trackUsefulClick);
      // These run before the SDK can observe history mutation and arm its restart timer.
      win.document.addEventListener('click', onInternalNavigation, true);
      win.addEventListener('popstate', beforeRouteChange, true);
      win.document.addEventListener('focusin', onSensitiveFocus, true);
      onActivity();
    },
    beforeRouteChange,
    routeChanged(pathname: string) {
      currentPath = pathname;
      if (/^(?:\/fr)?\/(?:search|feedback|demo)(?:\/|$)/.test(pathname)) {
        claritySensitive = true;
        stopClarity();
      }
      onActivity();
    },
    choose(next: 'accepted' | 'refused') {
      if (next === 'refused') { disable(true); clearGoogleCookies(); }
      forcedRefusal = false;
      if (next === 'accepted' && win.location.hash === REFUSAL_FRAGMENT) {
        win.history.replaceState(null, '', `${win.location.pathname}${win.location.search}`);
      }
      memoryChoice = {version: 2, choice: next, expiresAt: sixMonthsFrom(now())};
      try {
        win.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(memoryChoice));
        storageAvailable = true;
      } catch {
        storageAvailable = false;
        if (next === 'refused') {
          forcedRefusal = true;
          try { win.localStorage.removeItem(CONSENT_STORAGE_KEY); } catch { /* Refusal fragment protects a Clarity reload. */ }
        }
      }
      onActivity();
    },
    destroy() {
      if (expiryTimer !== undefined) win.clearTimeout(expiryTimer);
      win.removeEventListener('storage', onStorage);
      win.removeEventListener('focus', onActivity);
      win.document.removeEventListener('visibilitychange', onActivity);
      win.document.removeEventListener('click', trackUsefulClick);
      win.document.removeEventListener('click', onInternalNavigation, true);
      win.removeEventListener('popstate', beforeRouteChange, true);
      win.document.removeEventListener('focusin', onSensitiveFocus, true);
      listeners.clear();
    },
  };
}
