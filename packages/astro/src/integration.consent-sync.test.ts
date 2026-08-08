/**
 * The consent/tracking facts live in two places and used to be hand-synced.
 *
 * `site.tracking` and `site.legal.cookieConsent` drive the **generated cookie
 * notice**; `vitops({ consent, tracking })` drove the **runtime**. Nothing
 * compared them, so a site could ship a notice naming categories its banner
 * never offered — or disclosing an `_ac` cookie no capture script ever wrote —
 * and the build was clean. That is a compliance defect, which is why a genuine
 * contradiction is an error and not a warning.
 *
 * The distinction these pin down: **absent is not a contradiction.** A config
 * that states a fact and an option that says nothing is the ordinary case, and
 * it must resolve silently, exactly as `css` / `fonts` / `favicon` / `ads` do.
 */
import { describe, expect, it } from 'vitest';
import { consentTrackingConflicts } from './integration.ts';

const at = (site: Parameters<typeof consentTrackingConflicts>[0], opts: Record<string, unknown>) =>
  consentTrackingConflicts(site, opts, 'company.json');

describe('consentTrackingConflicts', () => {
  it('is silent when the option is absent — the config is the default', () => {
    expect(at({ consentEnabled: true, tracking: { enabled: true } }, {})).toEqual([]);
  });

  it('is silent when the config is absent — the option stands alone', () => {
    expect(at({}, { consent: true, tracking: true })).toEqual([]);
  });

  it('is silent when the two agree', () => {
    expect(
      at({ consentEnabled: true, tracking: { enabled: true } }, { consent: true, tracking: true }),
    ).toEqual([]);
  });

  it('reports a consent contradiction, naming both sides', () => {
    const [msg] = at({ consentEnabled: true }, { consent: false });
    expect(msg).toContain('company.json');
    expect(msg).toContain('site.legal.cookieConsent.enabled: true');
    expect(msg).toContain('consent: false');
  });

  it('reports a tracking contradiction', () => {
    const [msg] = at({ tracking: { enabled: false } }, { tracking: true });
    expect(msg).toContain('site.tracking.enabled: false');
    // The consequence, not just the mismatch: this is what makes it a defect.
    expect(msg).toContain('disclose');
  });

  it('reads the object form of the tracking option', () => {
    expect(at({ tracking: { enabled: true } }, { tracking: { enabled: false } })).toHaveLength(1);
    expect(at({ tracking: { enabled: true } }, { tracking: { enabled: true } })).toEqual([]);
  });

  it('treats a bare tracking object as enabled', () => {
    // `tracking: { category: 'analytics' }` with no `enabled` means on — so it
    // does not contradict a config that says on.
    expect(at({ tracking: { enabled: true } }, { tracking: { category: 'analytics' } })).toEqual(
      [],
    );
  });

  it('reports both contradictions at once', () => {
    expect(
      at(
        { consentEnabled: false, tracking: { enabled: false } },
        { consent: true, tracking: true },
      ),
    ).toHaveLength(2);
  });

  it('treats a consent options object as enabled', () => {
    expect(at({ consentEnabled: true }, { consent: { categories: ['analytics'] } })).toEqual([]);
    expect(at({ consentEnabled: false }, { consent: { categories: ['analytics'] } })).toHaveLength(
      1,
    );
  });
});
