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
  CONSENT_EVENT,
  CONSENT_OPEN_EVENT,
  decide,
  decideAll,
  decidedFor,
  granted as isGranted,
  needed as isNeeded,
  parse,
  readCookie,
  revoked,
  serialize,
  undecided,
} from './store.js';

// Defined in the pure half so listeners don't have to import this module — see
// the note on CONSENT_EVENT there. Re-exported because this is where consumers
// have always imported them from.
export { CONSENT_EVENT, CONSENT_OPEN_EVENT };

export type ConsentStrategy = 'idle' | 'async' | 'interaction';

export interface ConsentApi {
  /** The category vocabulary, so a consumer doesn't hard-code it. */
  readonly categories: readonly ConsentCategory[];
  get(): ConsentState;
  granted(category: ConsentCategory): boolean;
  /**
   * Is a prompt warranted? True only when something has actually **demanded** a
   * category the visitor hasn't answered — not merely because no cookie exists.
   * A site that gates nothing never asks.
   */
  needed(): boolean;
  /** Categories something has asked for this page view, in vocabulary order. */
  demanded(): readonly ConsentCategory[];
  /**
   * Declare that something needs this category *now*, and report whether it is
   * granted. Registering the demand is what reveals the banner if the visitor
   * hasn't answered yet, so this is the call that turns a page interaction into a
   * prompt — `<color-scheme-toggle>` uses it when a scheme is picked.
   *
   * Synchronous: it answers about the state as it stands, not about the choice
   * the visitor is being asked to make. Use `request()` to wait for that.
   */
  require(category: ConsentCategory): boolean;
  /**
   * `require()`, but resolving once the visitor has answered *this* category —
   * immediately if they already had. This is how a caller defers a side effect
   * (writing a preference) until it is actually permitted, without wiring up
   * `subscribe` and having to unsubscribe.
   */
  request(category: ConsentCategory): Promise<boolean>;
  set(patch: Partial<ConsentChoices>): void;
  /** Grant every optional category. Literally all of them — not just the demanded ones. */
  acceptAll(): void;
  /** Refuse every optional category. Literally all of them — not just the demanded ones. */
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

// ── Demand ─────────────────────────────────────────────────────────────────
//
// The banner is shown because something asked, never because a cookie is absent.
// `demanded` is that register: a gated element reaching its scheduling point adds
// to it, and so does an explicit `require()` — a theme toggle, an A/B assignment,
// anything that wants to store something. `needed()` is then a question about
// this set rather than about the visitor's silence, which is what stops a site
// with only cookieless analytics from interrupting anyone.
//
// Deliberately per page view and not persisted: demand is a fact about what this
// document does, and re-deriving it costs one `scan()`.
const demanded = new Set<ConsentCategory>();

/** Callers waiting on a specific category to be answered. */
const waiting = new Map<ConsentCategory, ((granted: boolean) => void)[]>();

function demand(category: ConsentCategory): void {
  if (demanded.has(category)) return;
  demanded.add(category);
  // Publish so `<wc-consent>`'s existing subscription re-evaluates `needed()`.
  // A new demand changes whether the banner should be up, and nothing else would
  // tell it.
  publish();
}

/** Resolve anything waiting on a category that has now been answered. */
function settle(): void {
  for (const [category, resolvers] of waiting) {
    if (!decidedFor(state, category)) continue;
    waiting.delete(category);
    for (const resolve of resolvers) resolve(isGranted(state, category));
  }
}

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

/**
 * Find every gated element and schedule it.
 *
 * The ungranted ones are scheduled too, and that is the point: reaching the
 * scheduling point is what registers *demand*. So the banner appears when a tag
 * would otherwise have run rather than at parse time — an `idle` tag asks after
 * `load`, where it cannot compete with LCP, and an `interaction` tag asks only
 * once the visitor has done something. A page whose gated tags never reach their
 * strategy never asks about them.
 */
function scan(): void {
  const gated = document.querySelectorAll(
    'script[data-vitops-tag]:not([data-vitops-activated]),[data-consent-src]:not([data-vitops-activated])',
  );
  for (const el of gated) {
    const strategy = el.getAttribute('data-strategy');
    when(strategy === 'async' || strategy === 'interaction' ? strategy : 'idle', () => {
      const category = categoryOf(el);
      // Re-checked here rather than at schedule time: consent may have been given
      // in between, in which case this runs instead of asking.
      if (isGranted(state, category)) activate(el);
      else demand(category);
    });
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
  settle();
  for (const fn of subscribers) fn(state);
  document.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: state }));
}

const api: ConsentApi = {
  categories: CATEGORIES,
  reloadOnRevoke: true,
  get: () => state,
  granted: (category) => isGranted(state, category),
  needed: () => isNeeded(state, demanded),
  demanded: () => CATEGORIES.filter((c) => demanded.has(c)),
  require(category) {
    demand(category);
    return isGranted(state, category);
  },
  request(category) {
    demand(category);
    if (decidedFor(state, category)) return Promise.resolve(isGranted(state, category));
    return new Promise((resolve) => {
      const queue = waiting.get(category);
      if (queue) queue.push(resolve);
      else waiting.set(category, [resolve]);
    });
  },
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

/**
 * The inline stub `<Head />` emits when the gate is enabled, and its queue.
 *
 * Both this module and `elements.js` are deferred, with no ordering guarantee
 * between them, so `<color-scheme-toggle>` can upgrade and be clicked before this
 * file evaluates. A caller probing for `window.vitopsConsent` in that window would
 * see nothing, conclude the site has no gate, and store — which is precisely the
 * leak the gate exists to prevent. The stub makes the gate's *existence* known
 * synchronously in `<head>`; this drains what it collected.
 */
interface ConsentStub {
  q?: [ConsentCategory, ((granted: boolean) => void)?][];
}

declare global {
  interface Window {
    /**
     * Optional because its absence is meaningful: a site that never enabled the
     * gate has no `consent.js` and no stub, and callers read that as "nothing to
     * ask permission from" rather than "denied".
     */
    vitopsConsent?: ConsentApi;
  }
}

const queued = (window.vitopsConsent as (ConsentApi & ConsentStub) | undefined)?.q;
window.vitopsConsent = api;
if (queued) {
  for (const [category, resolve] of queued) {
    if (resolve) void api.request(category).then(resolve);
    else api.require(category);
  }
}

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
