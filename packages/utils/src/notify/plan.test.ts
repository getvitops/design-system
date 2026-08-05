/**
 * What will and won't be sent, decided without sending anything.
 *
 * The point of the pure planner: a misconfigured site can be told exactly why no
 * notification will arrive. A silently unsent conversion notification is
 * indistinguishable from no conversion, which is the failure this split exists to
 * make impossible.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_EMAIL_BINDING, normalizeEmailChannel, planNotifications } from './plan.ts';
import { describeEvent, renderEmail } from './render.ts';
import type { ConversionEvent } from '../tracking/types.ts';

const ctx = (over = {}) => ({
  notifications: { email: { provider: 'cloudflare' as const, to: 'owner@acme.ca' } },
  canonical: 'https://acme.ca',
  organizationName: 'Acme',
  ...over,
});

describe('normalizeEmailChannel', () => {
  it('reads a bare address as a Cloudflare send to it', () => {
    expect(normalizeEmailChannel('a@b.ca')).toEqual({ provider: 'cloudflare', to: 'a@b.ca' });
  });

  it('leaves undefined alone — absent is not a channel', () => {
    expect(normalizeEmailChannel(undefined)).toBeUndefined();
  });
});

describe('planNotifications', () => {
  it('plans a send when recipient and sender both resolve', () => {
    const plan = planNotifications(ctx());
    expect(plan.email.enabled).toBe(true);
    expect(plan.email.to).toBe('owner@acme.ca');
    expect(plan.email.from).toBe('noreply@acme.ca');
    expect(plan.email.binding).toBe(DEFAULT_EMAIL_BINDING);
    expect(plan.empty).toBe(false);
  });

  it('names the organization on the From header by default', () => {
    expect(planNotifications(ctx()).email.fromName).toBe('Acme');
  });

  it("falls back to the site's own location addresses", () => {
    // A site that already said where it receives mail should not say it twice.
    const plan = planNotifications(
      ctx({
        notifications: { email: { provider: 'cloudflare' as const } },
        locationEmails: ['shop@acme.ca', 'other@acme.ca'],
      }),
    );
    expect(plan.email.to).toBe('shop@acme.ca');
  });

  it('derives the sender from a bare hostname canonical', () => {
    expect(planNotifications(ctx({ canonical: 'acme.ca' })).email.from).toBe('noreply@acme.ca');
  });

  it('is off, with a reason, when nothing is configured', () => {
    const plan = planNotifications(ctx({ notifications: undefined }));
    expect(plan.email.enabled).toBe(false);
    expect(plan.email.skip).toMatch(/notifications\.email/);
    expect(plan.empty).toBe(true);
  });

  it('is off, with a reason, when no recipient resolves anywhere', () => {
    const plan = planNotifications(
      ctx({ notifications: { email: { provider: 'cloudflare' as const } }, locationEmails: [] }),
    );
    expect(plan.email.enabled).toBe(false);
    expect(plan.email.skip).toMatch(/recipient/i);
  });

  it('is off, with a reason, when no sender can be derived', () => {
    // Cloudflare only sends from a domain the site onboarded, so guessing from
    // the recipient's domain would fail every send instead of one plan.
    const plan = planNotifications(ctx({ canonical: undefined }));
    expect(plan.email.enabled).toBe(false);
    expect(plan.email.skip).toMatch(/sender|canonical/i);
  });

  it('honours a restricted binding name', () => {
    const plan = planNotifications(
      ctx({
        notifications: {
          email: { provider: 'cloudflare' as const, to: 'a@b.ca', binding: 'RESTRICTED_EMAIL' },
        },
      }),
    );
    expect(plan.email.binding).toBe('RESTRICTED_EMAIL');
  });
});

const formEvent: ConversionEvent = {
  type: 'form',
  formData: { name: 'Dana', email: 'dana@example.com', message: 'Hello', website: 'spam.biz' },
  tracking: { gclid: 'G1', utm_campaign: 'spring', landingPage: '/', ts: 1_700_000_000_000 },
  at: 1_700_000_100_000,
};

describe('renderEmail', () => {
  it('sends both text and html', () => {
    // Some clients show only plain text, and HTML-only mail scores worse for spam.
    const msg = renderEmail(formEvent);
    expect(msg.text.length).toBeGreaterThan(0);
    expect(msg.html.length).toBeGreaterThan(0);
  });

  it('omits the honeypot — it was never visitor-supplied', () => {
    const msg = renderEmail(formEvent);
    expect(msg.text).not.toContain('spam.biz');
    expect(msg.html).not.toContain('spam.biz');
  });

  it('carries the attribution a notification exists to deliver', () => {
    const msg = renderEmail(formEvent);
    expect(msg.subject).toContain('Dana');
    expect(msg.text).toContain('Google Ads');
    expect(msg.text).toContain('G1');
    expect(msg.text).toContain('spring');
  });

  it('says so positively when a visitor arrived unattributed', () => {
    // A silently missing section reads as a bug in the tool.
    const msg = renderEmail({ type: 'call', phone: '+15550100', tracking: null, at: 0 });
    expect(msg.text).toMatch(/None — visitor arrived without ad tracking/);
  });

  it('escapes submitted values into the html half', () => {
    const msg = renderEmail({
      type: 'form',
      formData: { name: '<img src=x onerror=alert(1)>' },
      tracking: null,
      at: 0,
    });
    expect(msg.html).not.toContain('<img');
    expect(msg.html).toContain('&lt;img');
  });

  it('describes a call by the number dialled', () => {
    const msg = renderEmail({ type: 'call', phone: '+15550100', tracking: null, at: 0 });
    expect(msg.subject).toContain('+15550100');
  });

  it('drops empty sections rather than printing a bare heading', () => {
    const { sections } = describeEvent({ type: 'form', formData: {}, tracking: null, at: 0 });
    expect(sections.every((s) => s.lines.length > 0)).toBe(true);
  });
});
