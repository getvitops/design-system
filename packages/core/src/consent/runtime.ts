/**
 * The consent runtime — the DOM half of the store.
 *
 * This is deliberately a *general* gate rather than an analytics feature. Anything
 * that needs permission before it runs — a third-party tag, an A/B assignment, a
 * personalisation cookie, an embedded map — declares its category on the markup
 * and this activates it when the category is granted:
 *
 * ```html
 * <script type="text/plain" data-vitops-tag data-consent="analytics"
 *         data-strategy="idle" data-src="https://…"
 *         data-consent-cookies="_ga,_ga_*,_gid">…bootstrap…</script>
 * <iframe data-consent="marketing" data-consent-src="https://…"></iframe>
 * ```
 *
 * `type="text/plain"` is what makes the gate real: the browser never parses the
 * body as script, so an ungated visitor's page issues no request and runs no code.
 * A gate implemented by *asking* a third-party script not to track is a promise;
 * this one is a fact about the document.
 *
 * **Provider knowledge stays out of here.** The cookie names to clear on revoke
 * ride on `data-consent-cookies`, written by whoever emitted the tag. A table of
 * providers in this file would be a second place to keep in sync with
 * `@getvitops/generator`'s processor table, and the two would drift.
 */
import {
  type ConsentCategory,
  type ConsentChoices,
  type ConsentState,
  COOKIE_NAME,
  cookieAttributes,
  CATEGORIES,
  decide,
  decideAll,
  granted as isGranted,
  parse,
  readCookie,
  revoked,
  serialize,
  undecided,
} from './store.js';

/** Fired on `document` once at startup and on every change. */
export const CONSENT_EVENT = 'vitops:consent';
/** Fired on `document` when something asks for the banner to be shown again. */
export const CONSENT_OPEN_EVENT = 'vitops:consent-open';

export type ConsentStrategy = 'idle' | 'async' | 'interaction';

export interface ConsentApi {
  /** The category vocabulary, so a consumer doesn't hard-code it. */
  readonly categories: readonly ConsentCategory[];
  get(): ConsentState;
  granted(category: ConsentCategory): boolean;
  /** Is a prompt still needed? (i.e. no choice recorded yet) */
  needed(): boolean;
  set(patch: Partial<ConsentChoices>): void;
  acceptAll(): void;
  rejectAll(): void;
  /** Forget the recorded choice entirely and re-prompt. */
  reset(): void;
  /** Ask the banner to show itself again without discarding the current choice. */
  open(): void;
  subscribe(fn: (state: ConsentState) => void): () => void;
  /**
   * Reload after a revoke (default true). An already-executing tracker cannot be
   * unloaded — clearing its cookies stops it identifying the visitor next time,
   * but the running instance keeps reporting until the document goes away. Set
   * false and revocation only takes full effect on the next navigation.
   */
  reloadOnRevoke: boolean;
}

const SECURE = location.protocol === 'https:';

let state = parse(readCookie(document.cookie, COOKIE_NAME));
const subscribers = new Set<(state: ConsentState) => void>();

/** Tags already activated, so a re-scan never double-runs one. */
const activated = new WeakSet<Element>();
/** Categories that had at least one tag activated this page view. */
const live = new Set<ConsentCategory>();

// ── Scheduling ─────────────────────────────────────────────────────────────
//
// Third-party analytics is never worth a millisecond of the critical path, so a
// tag waits for its strategy *and* its consent, whichever lands last. `idle` is
// the default: it puts every tag after `load`, where it cannot compete with LCP.

const pending: Record<ConsentStrategy, (() => void)[]> = { idle: [], async: [], interaction: [] };
const fired: Record<ConsentStrategy, boolean> = { idle: false, async: true, interaction: false };

function fire(strategy: ConsentStrategy): void {
  if (fired[strategy]) return;
  fired[strategy] = true;
  const queue = pending[strategy];
  pending[strategy] = [];
  for (const fn of queue) fn();
}

function when(strategy: ConsentStrategy, fn: () => void): void {
  if (fired[strategy]) fn();
  else pending[strategy].push(fn);
}

function afterLoad(fn: () => void): void {
  if (document.readyState === 'complete') fn();
  else addEventListener('load', fn, { once: true });
}

afterLoad(() => {
  const idle = (globalThis as { requestIdleCallback?: (cb: () => void, o?: object) => void })
    .requestIdleCallback;
  // Safari shipped requestIdleCallback late; the timeout fallback keeps the
  // strategy meaningful there rather than silently degrading to `async`.
  if (idle) idle(() => fire('idle'), { timeout: 3000 });
  else setTimeout(() => fire('idle'), 1);
});

{
  const events = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const;
  const onInteract = (): void => {
    for (const type of events) removeEventListener(type, onInteract);
    fire('interaction');
  };
  for (const type of events) addEventListener(type, onInteract, { once: true, passive: true });
  // Without this a visitor who reads the page and leaves is never counted at all,
  // which quietly biases every metric the site collects toward engaged sessions.
  afterLoad(() => setTimeout(() => fire('interaction'), 8000));
}

// ── Activation ─────────────────────────────────────────────────────────────

/** Attributes that are gate bookkeeping and must not survive onto the live tag. */
const GATE_ATTRS = new Set([
  'type',
  'src',
  'data-vitops-tag',
  'data-src',
  'data-strategy',
  'data-consent',
  'data-consent-src',
  'data-consent-cookies',
]);

function categoryOf(el: Element): ConsentCategory {
  const value = el.getAttribute('data-consent');
  return (CATEGORIES as readonly string[]).includes(value ?? '')
    ? (value as ConsentCategory)
    : 'analytics';
}

function activateScript(el: HTMLScriptElement): void {
  const inline = el.textContent ?? '';
  const src = el.getAttribute('data-src');

  // A tag may carry both a bootstrap and a remote library (GA's dataLayer stub +
  // gtag.js). One <script> can't do both, so the bootstrap runs first — that way
  // the queue the library drains is already populated when it evaluates.
  const emit = (configure: (script: HTMLScriptElement) => void): void => {
    const script = document.createElement('script');
    for (const { name, value } of Array.from(el.attributes)) {
      if (!GATE_ATTRS.has(name)) script.setAttribute(name, value);
    }
    configure(script);
    el.parentNode?.insertBefore(script, el.nextSibling);
  };

  if (inline.trim()) emit((script) => (script.text = inline));
  if (src)
    emit((script) => {
      script.async = true;
      script.src = src;
    });
}

function activate(el: Element): void {
  if (activated.has(el)) return;
  activated.add(el);
  live.add(categoryOf(el));

  if (el instanceof HTMLScriptElement) activateScript(el);
  else {
    const src = el.getAttribute('data-consent-src');
    if (src) el.setAttribute('src', src);
  }
  el.setAttribute('data-vitops-activated', '');
}

function scan(): void {
  const gated = document.querySelectorAll(
    'script[data-vitops-tag]:not([data-vitops-activated]),[data-consent-src]:not([data-vitops-activated])',
  );
  for (const el of gated) {
    if (!isGranted(state, categoryOf(el))) continue;
    const strategy = el.getAttribute('data-strategy');
    when(strategy === 'async' || strategy === 'interaction' ? strategy : 'idle', () =>
      activate(el),
    );
  }
}

// ── Cleanup ────────────────────────────────────────────────────────────────

/**
 * Expire the cookies declared by the tags of a revoked category.
 *
 * Cookies are cleared across the host *and* its parent domain because a
 * third-party library commonly writes to `.example.com` while the page is on
 * `www.example.com`; deleting only the exact host leaves the identifier alive.
 * A trailing `*` matches a prefix — GA4's per-stream `_ga_XXXX` cookies have no
 * fixed name.
 */
function clearCookies(categories: ConsentCategory[]): void {
  const patterns = new Set<string>();
  for (const category of categories) {
    for (const el of document.querySelectorAll(`[data-consent="${category}"]`)) {
      for (const name of (el.getAttribute('data-consent-cookies') ?? '').split(',')) {
        if (name.trim()) patterns.add(name.trim());
      }
    }
  }
  if (!patterns.size) return;

  const present = document.cookie.split(';').map((c) => c.trim().split('=')[0] ?? '');
  const parent = location.hostname.split('.').slice(-2).join('.');
  const domains = ['', `; domain=${location.hostname}`, `; domain=.${parent}`];

  for (const name of present) {
    const matched = [...patterns].some((p) =>
      p.endsWith('*') ? name.startsWith(p.slice(0, -1)) : name === p,
    );
    if (!matched) continue;
    for (const domain of domains) {
      document.cookie = `${name}=; path=/; max-age=0${domain}`;
    }
  }
}

// ── State transitions ──────────────────────────────────────────────────────

function commit(next: ConsentState, persist: boolean): void {
  const gone = revoked(state, next);
  const previous = state;
  state = next;

  if (persist) document.cookie = `${COOKIE_NAME}=${serialize(next)}${cookieAttributes(SECURE)}`;
  else document.cookie = `${COOKIE_NAME}=; path=/; max-age=0`;

  publish();
  scan();

  if (!gone.length) return;
  clearCookies(gone);
  // Only reload if something actually ran — otherwise a visitor toggling a
  // category they never granted this page view gets a pointless page flash.
  const wasLive = gone.some((c) => live.has(c) && isGranted(previous, c));
  if (wasLive && api.reloadOnRevoke) location.reload();
}

function publish(): void {
  for (const fn of subscribers) fn(state);
  document.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: state }));
}

const api: ConsentApi = {
  categories: CATEGORIES,
  reloadOnRevoke: true,
  get: () => state,
  granted: (category) => isGranted(state, category),
  needed: () => !state.decided,
  set: (patch) => commit(decide(state, patch, Date.now()), true),
  acceptAll: () => commit(decideAll(true, Date.now()), true),
  rejectAll: () => commit(decideAll(false, Date.now()), true),
  reset: () => commit(undecided(), false),
  open: () => document.dispatchEvent(new CustomEvent(CONSENT_OPEN_EVENT)),
  subscribe(fn) {
    subscribers.add(fn);
    fn(state);
    return () => void subscribers.delete(fn);
  },
};

declare global {
  interface Window {
    vitopsConsent: ConsentApi;
  }
}

window.vitopsConsent = api;

// A "Cookie settings" control anywhere on the page — footer link, settings menu —
// needs no JS of its own. Delegated so it works for markup added after load.
document.addEventListener('click', (event) => {
  const target = (event.target as Element | null)?.closest?.('[data-consent-open]');
  if (!target) return;
  event.preventDefault();
  api.open();
});

// Astro's view transitions swap the document without a navigation, so tags in the
// incoming page would otherwise never be scanned.
document.addEventListener('astro:page-load', scan);

scan();
publish();

export { api };
