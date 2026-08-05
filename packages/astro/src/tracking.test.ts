import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CLICK_ID_PARAMS,
  TRACKING_COOKIE as UTILS_COOKIE,
  UTM_PARAMS,
} from '@getvitops/utils/tracking';
import { describe, expect, it } from 'vitest';
import { resolveTracking, TRACKING_COOKIE } from './tracking.ts';

describe('resolveTracking', () => {
  it('is off unless asked for', () => {
    expect(resolveTracking(undefined).enabled).toBe(false);
    expect(resolveTracking({}).enabled).toBe(false);
  });

  it('defaults to the marketing category', () => {
    // `_ac` is a 90-day identifier tying a visitor to the ad that brought them.
    expect(resolveTracking({ enabled: true }, { consent: true }).category).toBe('marketing');
  });

  it('lets a consumer file it under analytics instead', () => {
    const r = resolveTracking({ enabled: true, category: 'analytics' }, { consent: true });
    expect(r.category).toBe('analytics');
  });

  it('declares the cookie it writes, so revoke can clear it', () => {
    expect(resolveTracking({ enabled: true }, { consent: true }).cookies).toEqual([
      TRACKING_COOKIE,
    ]);
  });

  it('warns when tracking is on and the gate is off', () => {
    // A persistent identifier written for every visitor with no way to decline.
    const r = resolveTracking({ enabled: true }, { consent: false });
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toMatch(/consent/);
    expect(r.warnings[0]).toContain('_ac');
  });

  it('warns when the demanded category has no row in the banner', () => {
    // The script would raise a banner asking about something the form never
    // names — the visitor is asked a question they cannot see.
    const r = resolveTracking(
      { enabled: true },
      { consent: true, consentCategories: ['analytics', 'preferences'] },
    );
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toMatch(/marketing/);
  });

  it('is quiet when the offered categories cover the demand', () => {
    const r = resolveTracking(
      { enabled: true },
      { consent: true, consentCategories: ['analytics', 'preferences', 'marketing'] },
    );
    expect(r.warnings).toEqual([]);
  });

  it('says nothing at all when tracking is off, whatever consent is doing', () => {
    expect(resolveTracking({ enabled: false }, { consent: false }).warnings).toEqual([]);
  });
});

/**
 * The capture script inlines its own copy of the parameter tables.
 *
 * It has to: `<Tracking />` bundles it into the document, so it cannot import
 * from `@getvitops/utils` at runtime. The cost of the copy is this test — and the
 * cost of drift is a click ID that the capture writes but the notification cannot
 * attribute, or one the platform sends and we never record. Both are silent.
 */
describe('capture script mirrors @getvitops/utils/tracking', () => {
  const SRC = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), 'scripts', 'tracking.ts'),
    'utf8',
  );

  it('recognises every click-ID parameter the utils table knows', () => {
    for (const param of CLICK_ID_PARAMS) expect(SRC).toContain(`'${param}'`);
  });

  it('recognises every UTM parameter', () => {
    for (const param of UTM_PARAMS) expect(SRC).toContain(`'${param}'`);
  });

  it('writes the same cookie name both halves read', () => {
    expect(SRC).toContain(`const COOKIE_NAME = '${UTILS_COOKIE}'`);
    expect(TRACKING_COOKIE).toBe(UTILS_COOKIE);
  });

  it('asks for consent rather than only reading it', () => {
    // The whole point. A passive `granted()` check is a permanent no-op: nothing
    // else on a page demands `marketing`, so the banner never offers it, so it is
    // never granted, so `_ac` is never written — silently, on every gated site.
    expect(SRC).toMatch(/\.require\(category\)/);
  });

  it('keeps listening after the first answer', () => {
    // The stub <Head /> emits has no `subscribe`, and a visitor may accept a
    // moment later in the same page view. The document event covers both.
    expect(SRC).toContain("addEventListener('vitops:consent'");
  });
});
