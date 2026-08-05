/**
 * The consent store — pure, DOM-free, and therefore the only part of the consent
 * runtime that is unit-tested (`store.test.ts`; `@getvitops/core` has no DOM test
 * environment). Everything here is a function of a cookie string.
 *
 * Three invariants are load-bearing and easy to break:
 *
 *  - **Undecided denies everything but `necessary`.** The absence of a cookie is a
 *    meaningful state, not a missing one. A parse failure, an unknown schema
 *    version and a tampered value all collapse to the same undecided state rather
 *    than to a permissive default — the failure mode of guessing wrong is running
 *    a tracker the visitor never agreed to.
 *  - **Nothing is written until the visitor chooses.** Showing the banner must not
 *    itself set a cookie, or the banner becomes the thing it asks permission for.
 *    `serialize()` is only ever called from an explicit accept/reject/save.
 *  - **"Not asked" is not "declined".** Consent is tracked per category as
 *    `true` / `false` / `null`, and the third value is the whole point of the
 *    demand-driven banner: a visitor who was shown an analytics prompt and
 *    accepted it has said nothing about preferences, so a later preferences
 *    demand must be able to ask. Collapsing `null` into `false` would silently
 *    foreclose every category the first prompt didn't happen to offer.
 */

/**
 * The consent vocabulary. Deliberately closed and deliberately small — these four
 * are what a cookie notice can describe in a sentence a visitor understands, and
 * every extra category is one more choice that gets clicked through.
 *
 * `necessary` is not a choice: it covers what the site cannot function without
 * (session, CSRF, the consent cookie itself) and is always granted.
 */
export const CATEGORIES = ['necessary', 'analytics', 'marketing', 'preferences'] as const;

export type ConsentCategory = (typeof CATEGORIES)[number];

/** The categories a visitor actually decides. */
export type OptionalCategory = Exclude<ConsentCategory, 'necessary'>;

/**
 * Per-category state. `null` means *not yet asked* — distinct from `false`, which
 * means asked and declined. Only `null` can be re-prompted.
 */
export type ConsentChoices = Record<OptionalCategory, boolean | null>;

export interface ConsentState {
  /** When the most recent choice was made (epoch ms), or null while untouched. */
  ts: number | null;
  choices: ConsentChoices;
}

/**
 * Fired on `document` once at startup and on every change.
 *
 * Here rather than in `runtime.ts` so that a consumer can listen for it without
 * importing the runtime. That matters inside this package: `elements.js` and
 * `consent.js` are separate bundles, and `<color-scheme-toggle>` needs the name
 * to know when its `preferences` grant arrived. Importing it from `runtime.ts`
 * would drag the whole gate — and its top-level `scan()` — into every page with a
 * theme toggle. This module has no side effects, so the string tree-shakes out
 * alone.
 */
export const CONSENT_EVENT = 'vitops:consent';
/** Fired on `document` when something asks for the banner to be shown again. */
export const CONSENT_OPEN_EVENT = 'vitops:consent-open';

export const COOKIE_NAME = 'vitops_consent';

/**
 * Bumping this invalidates every stored choice, which re-prompts every visitor.
 * That is the intended behaviour when the *meaning* of a category changes — a
 * choice made about a different set of categories isn't consent to this one.
 *
 * v2 introduced the tri-state above. A v1 cookie recorded every category as a
 * definite boolean even though only some were ever put to the visitor, so reading
 * one forward would assert decisions they were never shown.
 */
export const COOKIE_VERSION = 2;

/** 180 days. Longer than a year is hard to defend as "freely given". */
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 180;

export const OPTIONAL_CATEGORIES: readonly OptionalCategory[] = [
  'analytics',
  'marketing',
  'preferences',
];

function choices(value: boolean | null): ConsentChoices {
  return { analytics: value, marketing: value, preferences: value };
}

/** The state before any choice: nothing asked, nothing granted. */
export function undecided(): ConsentState {
  return { ts: null, choices: choices(null) };
}

/** Read one cookie out of a `document.cookie`-shaped string. */
export function readCookie(cookieString: string, name: string): string | null {
  for (const part of cookieString.split(';')) {
    const raw = part.trim();
    if (raw.slice(0, name.length + 1) === `${name}=`) return raw.slice(name.length + 1);
  }
  return null;
}

/**
 * Cookie value → state. Anything unrecognised is undecided, never a partial or a
 * permissive read: a value we can't fully understand is not evidence of consent.
 *
 * Within a well-formed cookie the same rule applies per category: only a literal
 * `true` or `false` is a decision, and anything else — absent, a string, a number
 * — reads as never-asked and stays askable.
 */
export function parse(value: string | null | undefined): ConsentState {
  if (!value) return undecided();
  let data: unknown;
  try {
    data = JSON.parse(decodeURIComponent(value));
  } catch {
    return undecided();
  }
  if (typeof data !== 'object' || data === null) return undecided();
  const record = data as Record<string, unknown>;
  if (record['v'] !== COOKIE_VERSION) return undecided();
  // A right-version cookie with no choices object is still a cookie we can't
  // read. Accepting it as "decided, all denied" would be *safe* — nothing would
  // track — but it would also stop the banner ever reappearing, stranding a
  // visitor who wants to opt in with no way to say so. Re-ask instead.
  if (typeof record['c'] !== 'object' || record['c'] === null) return undecided();
  const flags = record['c'] as Record<string, unknown>;

  const result = choices(null);
  for (const category of OPTIONAL_CATEGORIES) {
    const flag = flags[category];
    if (typeof flag === 'boolean') result[category] = flag;
  }
  return { ts: typeof record['ts'] === 'number' ? record['ts'] : null, choices: result };
}

/**
 * State → cookie value (not the full `Set-Cookie` — see `cookieAttributes`).
 *
 * Undecided categories are omitted rather than written as `null`: `parse` already
 * reads an absent key as never-asked, so the two are equivalent and the shorter
 * one keeps the cookie small on a site that only ever prompts for one category.
 */
export function serialize(state: ConsentState): string {
  const flags: Record<string, boolean> = {};
  for (const category of OPTIONAL_CATEGORIES) {
    const value = state.choices[category];
    if (typeof value === 'boolean') flags[category] = value;
  }
  return encodeURIComponent(JSON.stringify({ v: COOKIE_VERSION, ts: state.ts ?? 0, c: flags }));
}

/**
 * The one question the activation half asks. `necessary` is unconditional;
 * everything else requires an explicit, recorded `true`.
 */
export function granted(state: ConsentState, category: ConsentCategory): boolean {
  if (category === 'necessary') return true;
  return state.choices[category] === true;
}

/**
 * Has this category been put to the visitor and answered? `necessary` is never a
 * question, so it counts as settled.
 */
export function decidedFor(state: ConsentState, category: ConsentCategory): boolean {
  if (category === 'necessary') return true;
  return state.choices[category] !== null;
}

/** The categories still open to being asked about. */
export function undecidedCategories(state: ConsentState): OptionalCategory[] {
  return OPTIONAL_CATEGORIES.filter((c) => !decidedFor(state, c));
}

/**
 * Is a prompt warranted right now?
 *
 * This is the whole demand-driven banner in one line, and the reason it takes
 * `demanded` rather than reading it off the state: whether to ask is a function of
 * what something on the page has actually requested, not of what the site could
 * conceivably use. A site whose only tag is cookieless demands nothing and is
 * never asked; a site whose theme toggle demands `preferences` is asked at the
 * moment of the click and not before.
 */
export function needed(state: ConsentState, demanded: Iterable<ConsentCategory>): boolean {
  for (const category of demanded) {
    if (!decidedFor(state, category)) return true;
  }
  return false;
}

/** A state with every optional category answered the same way. */
export function decideAll(value: boolean, now: number): ConsentState {
  return { ts: now, choices: choices(value) };
}

/**
 * Apply a partial choice.
 *
 * A category the patch omits keeps whatever it had — including `null`. That is
 * what lets a preferences-only prompt record preferences without asserting
 * anything about analytics, and what lets analytics be asked about later.
 */
export function decide(
  state: ConsentState,
  patch: Partial<ConsentChoices>,
  now: number,
): ConsentState {
  const next = { ...state.choices };
  for (const category of OPTIONAL_CATEGORIES) {
    const value = patch[category];
    if (typeof value === 'boolean') next[category] = value;
  }
  return { ts: now, choices: next };
}

/** Which categories lost consent between two states — what needs cleaning up. */
export function revoked(before: ConsentState, after: ConsentState): OptionalCategory[] {
  return OPTIONAL_CATEGORIES.filter((c) => granted(before, c) && !granted(after, c));
}

/**
 * Cookie attributes for the consent cookie itself.
 *
 * `Secure` is conditional because it would make the cookie unwritable on a plain
 * `http://localhost` dev server — the choice would silently never persist, which
 * is the kind of bug that only shows up when someone tests the banner locally and
 * concludes it's broken.
 */
export function cookieAttributes(secure: boolean): string {
  return `; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax${secure ? '; Secure' : ''}`;
}
