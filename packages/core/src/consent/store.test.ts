/**
 * The consent store's guarantees.
 *
 * `@getvitops/core` has no DOM test environment, which is exactly why the store
 * is written as pure functions over a cookie string: the decisions that matter
 * legally — what an absent cookie means, what a corrupt one means, whether the
 * banner writes anything — are all decidable here. The DOM wiring in
 * `runtime.ts` is verified by hand (see index.html and the README's checklist).
 */
import { describe, expect, it } from 'vitest';
import {
  COOKIE_VERSION,
  cookieAttributes,
  decide,
  decideAll,
  granted,
  parse,
  readCookie,
  revoked,
  serialize,
  undecided,
} from './store.ts';

const cookie = (value: unknown) => encodeURIComponent(JSON.stringify(value));

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

  it('is what a missing cookie parses to', () => {
    expect(parse(null).decided).toBe(false);
    expect(parse(undefined).decided).toBe(false);
    expect(parse('').decided).toBe(false);
  });
});

describe('parse', () => {
  it('round-trips a serialized state', () => {
    const state = decide(undecided(), { analytics: true, marketing: false }, 1_700_000_000_000);
    const back = parse(serialize(state));
    expect(back).toEqual(state);
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
    ['a missing version', cookie({ ts: 1, c: { analytics: true } })],
    ['a missing choices object', cookie({ v: COOKIE_VERSION, ts: 1 })],
  ])('treats %s as undecided rather than granting anything', (_label, value) => {
    const state = parse(value);
    expect(state.decided).toBe(false);
    expect(granted(state, 'analytics')).toBe(false);
  });

  it('only accepts a literal true — a truthy value is not consent', () => {
    const state = parse(
      cookie({ v: COOKIE_VERSION, ts: 1, c: { analytics: 'yes', marketing: 1 } }),
    );
    expect(granted(state, 'analytics')).toBe(false);
    expect(granted(state, 'marketing')).toBe(false);
  });

  it('defaults a category the stored cookie never mentioned to denied', () => {
    const state = parse(cookie({ v: COOKIE_VERSION, ts: 1, c: { analytics: true } }));
    expect(granted(state, 'analytics')).toBe(true);
    expect(granted(state, 'preferences')).toBe(false);
  });
});

describe('decide', () => {
  it('leaves categories the patch omits untouched', () => {
    const start = decideAll(true, 1);
    const next = decide(start, { analytics: false }, 2);
    expect(granted(next, 'analytics')).toBe(false);
    expect(granted(next, 'marketing')).toBe(true);
  });

  it('marks the state decided even when every category is refused', () => {
    // Rejecting is a decision. If this returned an undecided state the banner
    // would reappear on the next page and keep asking until told yes.
    const next = decideAll(false, 1);
    expect(next.decided).toBe(true);
    expect(granted(next, 'analytics')).toBe(false);
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
