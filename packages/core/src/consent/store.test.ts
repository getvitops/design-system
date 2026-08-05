/**
 * The consent store's guarantees.
 *
 * `@getvitops/core` has no DOM test environment, which is exactly why the store
 * is written as pure functions over a cookie string: the decisions that matter
 * legally — what an absent cookie means, what a corrupt one means, whether the
 * banner writes anything, whether a category can still be asked about — are all
 * decidable here. The DOM wiring in `runtime.ts` is verified by hand (see
 * index.html and the README's checklist).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CONSENT_EVENT,
  COOKIE_VERSION,
  cookieAttributes,
  decide,
  decideAll,
  decidedFor,
  granted,
  needed,
  OPTIONAL_CATEGORIES,
  parse,
  readCookie,
  revoked,
  serialize,
  undecided,
  undecidedCategories,
} from './store.ts';

const cookie = (value: unknown) => encodeURIComponent(JSON.stringify(value));

describe('CONSENT_EVENT', () => {
  it('matches the copy in WCColorSchemeToggle', () => {
    // The toggle mirrors this string instead of importing it — importing made
    // `store.ts` a shared chunk between `elements.js` and `consent.js`, so every
    // page with a theme toggle fetched an extra module for one string. The cost
    // of mirroring is this test; the cost of drifting is a colour-scheme choice
    // that is never persisted after consent is granted, with nothing logged.
    const src = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        '..',
        'web-components',
        'WCColorSchemeToggle.ts',
      ),
      'utf8',
    );
    expect(src).toContain(`const CONSENT_EVENT = '${CONSENT_EVENT}'`);
  });
});

describe('undecided', () => {
  it('denies every optional category', () => {
    const state = undecided();
    expect(granted(state, 'analytics')).toBe(false);
    expect(granted(state, 'marketing')).toBe(false);
    expect(granted(state, 'preferences')).toBe(false);
  });

  it('still grants `necessary` — it is not a choice', () => {
    expect(granted(undecided(), 'necessary')).toBe(true);
  });

  it('leaves every optional category open to being asked about', () => {
    expect(undecidedCategories(undecided())).toEqual([...OPTIONAL_CATEGORIES]);
  });

  it('is what a missing cookie parses to', () => {
    for (const value of [null, undefined, '']) {
      expect(undecidedCategories(parse(value))).toEqual([...OPTIONAL_CATEGORIES]);
    }
  });
});

describe('parse', () => {
  it('round-trips a serialized state', () => {
    const state = decide(undecided(), { analytics: true, marketing: false }, 1_700_000_000_000);
    const back = parse(serialize(state));
    expect(back).toEqual(state);
  });

  it('round-trips the never-asked third value rather than flattening it', () => {
    // The whole point of v2. If `preferences` came back as `false` the banner
    // could never ask about it, and a theme toggle would be permanently denied by
    // a visitor who only ever answered an analytics prompt.
    const state = decide(undecided(), { analytics: true }, 1);
    const back = parse(serialize(state));
    expect(back.choices.preferences).toBeNull();
    expect(decidedFor(back, 'preferences')).toBe(false);
    expect(decidedFor(back, 'analytics')).toBe(true);
  });

  /**
   * Every one of these could plausibly be treated as "close enough" and read
   * permissively. None is: a value we cannot fully understand is not evidence
   * that anyone agreed to anything.
   */
  it.each([
    ['not JSON at all', 'nonsense'],
    ['JSON that is not an object', cookie('yes')],
    ['null', cookie(null)],
    ['a future schema version', cookie({ v: COOKIE_VERSION + 1, ts: 1, c: { analytics: true } })],
    ['a v1 cookie', cookie({ v: 1, ts: 1, c: { analytics: true, marketing: true } })],
    ['a missing version', cookie({ ts: 1, c: { analytics: true } })],
    ['a missing choices object', cookie({ v: COOKIE_VERSION, ts: 1 })],
  ])('treats %s as undecided rather than granting anything', (_label, value) => {
    const state = parse(value);
    expect(undecidedCategories(state)).toEqual([...OPTIONAL_CATEGORIES]);
    expect(granted(state, 'analytics')).toBe(false);
  });

  it('only accepts a literal boolean — a truthy value is not consent', () => {
    const state = parse(
      cookie({ v: COOKIE_VERSION, ts: 1, c: { analytics: 'yes', marketing: 1 } }),
    );
    expect(granted(state, 'analytics')).toBe(false);
    expect(granted(state, 'marketing')).toBe(false);
    // Unreadable is never-asked, not declined — so it can still be put to them.
    expect(decidedFor(state, 'analytics')).toBe(false);
  });

  it('reads a stored `false` as a real decision, not as never-asked', () => {
    // The other half of the tri-state: someone who declined must not be re-asked
    // on every page load.
    const state = parse(cookie({ v: COOKIE_VERSION, ts: 1, c: { analytics: false } }));
    expect(granted(state, 'analytics')).toBe(false);
    expect(decidedFor(state, 'analytics')).toBe(true);
  });

  it('leaves a category the stored cookie never mentioned askable', () => {
    const state = parse(cookie({ v: COOKIE_VERSION, ts: 1, c: { analytics: true } }));
    expect(granted(state, 'analytics')).toBe(true);
    expect(granted(state, 'preferences')).toBe(false);
    expect(undecidedCategories(state)).toEqual(['marketing', 'preferences']);
  });
});

describe('serialize', () => {
  it('omits undecided categories rather than writing a null', () => {
    const value = JSON.parse(
      decodeURIComponent(serialize(decide(undecided(), { analytics: true }, 1))),
    );
    expect(value.c).toEqual({ analytics: true });
  });
});

describe('needed', () => {
  it('is false when nothing has been demanded, however little is decided', () => {
    // The reported bug, as an assertion: a site whose only tag is cookieless
    // demands nothing, so a first-time visitor is never interrupted.
    expect(needed(undecided(), [])).toBe(false);
  });

  it('is true when a demanded category has not been answered', () => {
    expect(needed(undecided(), ['preferences'])).toBe(true);
  });

  it('is false once every demanded category is answered — including refused', () => {
    const state = decide(undecided(), { analytics: false }, 1);
    expect(needed(state, ['analytics'])).toBe(false);
  });

  it('re-prompts for a newly demanded category after an earlier decision', () => {
    // Accept an analytics prompt, then click a theme. The visitor said nothing
    // about preferences, so the banner is warranted a second time.
    const state = decide(undecided(), { analytics: true }, 1);
    expect(needed(state, ['analytics'])).toBe(false);
    expect(needed(state, ['analytics', 'preferences'])).toBe(true);
  });

  it('never asks about `necessary`', () => {
    expect(needed(undecided(), ['necessary'])).toBe(false);
  });
});

describe('decide', () => {
  it('leaves categories the patch omits untouched', () => {
    const start = decideAll(true, 1);
    const next = decide(start, { analytics: false }, 2);
    expect(granted(next, 'analytics')).toBe(false);
    expect(granted(next, 'marketing')).toBe(true);
  });

  it('leaves an omitted category askable rather than recording a refusal', () => {
    // A preferences-only prompt must assert nothing about analytics. If this
    // wrote `false`, accepting one prompt would silently decline every category
    // it didn't happen to show.
    const next = decide(undecided(), { preferences: true }, 1);
    expect(decidedFor(next, 'preferences')).toBe(true);
    expect(decidedFor(next, 'analytics')).toBe(false);
  });

  it('records a refusal as a decision', () => {
    // Rejecting is a decision. If this stayed undecided the banner would
    // reappear on the next page and keep asking until told yes.
    const next = decideAll(false, 1);
    expect(decidedFor(next, 'analytics')).toBe(true);
    expect(granted(next, 'analytics')).toBe(false);
    expect(needed(next, OPTIONAL_CATEGORIES)).toBe(false);
  });

  it('does not mutate the state it was given', () => {
    const start = decideAll(false, 1);
    decide(start, { analytics: true }, 2);
    expect(granted(start, 'analytics')).toBe(false);
  });
});

describe('revoked', () => {
  it('reports only categories that went from granted to denied', () => {
    const before = decide(undecided(), { analytics: true, marketing: true }, 1);
    const after = decide(before, { marketing: false, preferences: true }, 2);
    expect(revoked(before, after)).toEqual(['marketing']);
  });

  it('reports everything granted when the choice is reset', () => {
    const before = decideAll(true, 1);
    expect(revoked(before, undecided())).toEqual(['analytics', 'marketing', 'preferences']);
  });

  it('reports nothing when consent only widens', () => {
    const before = decide(undecided(), { analytics: true }, 1);
    expect(revoked(before, decideAll(true, 2))).toEqual([]);
  });

  it('treats a grant going back to never-asked as a revocation', () => {
    // Cleanup is driven off this list, so the cookies of a category that stopped
    // being granted must be cleared whichever way it stopped.
    const before = decide(undecided(), { preferences: true }, 1);
    expect(revoked(before, undecided())).toEqual(['preferences']);
  });
});

describe('readCookie', () => {
  it('finds a cookie among others without prefix-matching a longer name', () => {
    const jar = 'other=1; vitops_consent=abc; vitops_consent_extra=zzz';
    expect(readCookie(jar, 'vitops_consent')).toBe('abc');
  });

  it('returns null when absent', () => {
    expect(readCookie('a=1; b=2', 'vitops_consent')).toBeNull();
  });
});

describe('cookieAttributes', () => {
  it('omits Secure off https, so a choice actually persists on a local dev server', () => {
    expect(cookieAttributes(false)).not.toContain('Secure');
    expect(cookieAttributes(true)).toContain('; Secure');
  });

  it('is SameSite=Lax and site-wide', () => {
    expect(cookieAttributes(true)).toContain('SameSite=Lax');
    expect(cookieAttributes(true)).toContain('path=/');
  });
});
