/**
 * The consent store — pure, DOM-free, and therefore the only part of the consent
 * runtime that is unit-tested (`store.test.ts`; `@getvitops/core` has no DOM test
 * environment). Everything here is a function of a cookie string.
 *
 * Two invariants are load-bearing and easy to break:
 *
 *  - **Undecided denies everything but `necessary`.** The absence of a cookie is a
 *    meaningful state, not a missing one. A parse failure, an unknown schema
 *    version and a tampered value all collapse to the same undecided state rather
 *    than to a permissive default — the failure mode of guessing wrong is running
 *    a tracker the visitor never agreed to.
 *  - **Nothing is written until the visitor chooses.** Showing the banner must not
 *    itself set a cookie, or the banner becomes the thing it asks permission for.
 *    `serialize()` is only ever called from an explicit accept/reject/save.
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

export type ConsentChoices = Record<OptionalCategory, boolean>;

export interface ConsentState {
  /** Has the visitor made a choice at all? False means "no cookie yet". */
  decided: boolean;
  /** When the choice was made (epoch ms), or null while undecided. */
  ts: number | null;
  choices: ConsentChoices;
}

export const COOKIE_NAME = 'vitops_consent';

/**
 * Bumping this invalidates every stored choice, which re-prompts every visitor.
 * That is the intended behaviour when the *meaning* of a category changes — a
 * choice made about a different set of categories isn't consent to this one.
 */
export const COOKIE_VERSION = 1;

/** 180 days. Longer than a year is hard to defend as "freely given". */
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 180;

export const OPTIONAL_CATEGORIES: readonly OptionalCategory[] = [
  'analytics',
  'marketing',
  'preferences',
];

function choices(value: boolean): ConsentChoices {
  return { analytics: value, marketing: value, preferences: value };
}

/** The state before any choice: everything optional denied. */
export function undecided(): ConsentState {
  return { decided: false, ts: null, choices: choices(false) };
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

  const result = choices(false);
  for (const category of OPTIONAL_CATEGORIES) result[category] = flags[category] === true;
  return {
    decided: true,
    ts: typeof record['ts'] === 'number' ? record['ts'] : null,
    choices: result,
  };
}

/** State → cookie value (not the full `Set-Cookie` — see `cookieAttributes`). */
export function serialize(state: ConsentState): string {
  return encodeURIComponent(
    JSON.stringify({ v: COOKIE_VERSION, ts: state.ts ?? 0, c: state.choices }),
  );
}

/**
 * The one question the rest of the runtime asks. `necessary` is unconditional;
 * everything else requires an explicit, recorded choice.
 */
export function granted(state: ConsentState, category: ConsentCategory): boolean {
  if (category === 'necessary') return true;
  return state.decided && state.choices[category] === true;
}

/** A decided state with every optional category set the same way. */
export function decideAll(value: boolean, now: number): ConsentState {
  return { decided: true, ts: now, choices: choices(value) };
}

/** Apply a partial choice, marking the result decided. */
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
  return { decided: true, ts: now, choices: next };
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
