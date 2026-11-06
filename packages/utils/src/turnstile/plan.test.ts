import { describe, expect, it } from 'vite-plus/test';
import { createWidget, deriveDomains, hasDrift, listWidgets, patchSiteKey, plan } from './index.ts';
import { resolveAccountId } from './cloudflare.ts';

const setup = { name: 'Example', domains: ['example.com'] };
const widget = {
  sitekey: '0xKEY12345',
  name: 'Example',
  domains: ['example.com'],
  mode: 'managed',
};

describe('plan', () => {
  it('creates a widget and writes the key when none exists', () => {
    const p = plan(setup, { accountId: 'a', widgets: [] });
    expect(p.widget.action).toBe('create');
    expect(p.config.action).toBe('create');
    expect(hasDrift(p)).toBe(true);
  });

  it('is a no-op once the widget exists and the key is in the config', () => {
    const p = plan({ ...setup, siteKey: '0xKEY12345' }, { accountId: 'a', widgets: [widget] });
    expect(p.widget.action).toBe('skip');
    expect(p.config.action).toBe('skip');
    expect(hasDrift(p)).toBe(false);
  });

  it('adopts an existing widget by domain instead of creating a second one', () => {
    const p = plan(setup, { accountId: 'a', widgets: [widget] });
    expect(p.widget.action).toBe('skip');
    expect(p.config).toMatchObject({ action: 'create' });
    expect(p.adopt?.sitekey).toBe('0xKEY12345');
  });

  it('treats a subdomain as covered by its parent widget', () => {
    const p = plan(
      { ...setup, domains: ['dev.example.com'] },
      { accountId: 'a', widgets: [widget] },
    );
    expect(p.widget.action).toBe('skip');
  });

  it('blocks on a configured key that no widget in the account owns', () => {
    const p = plan({ ...setup, siteKey: '0xOTHER000' }, { accountId: 'a', widgets: [widget] });
    expect(p.widget.action).toBe('blocked');
    expect(p.widget.detail).toContain('0xOTHER000');
  });

  it('blocks with no hostnames, too many hostnames, or no account', () => {
    expect(plan({ ...setup, domains: [] }, { accountId: 'a', widgets: [] }).widget.action).toBe(
      'blocked',
    );
    const many = Array.from({ length: 11 }, (_, i) => `d${i}.example.com`);
    expect(plan({ ...setup, domains: many }, { accountId: 'a', widgets: [] }).widget.action).toBe(
      'blocked',
    );
    expect(plan(setup, { widgets: [] }).widget.action).toBe('blocked');
  });

  it('says where the secret goes, and never claims to write it', () => {
    const p = plan(setup, { accountId: 'a', widgets: [] });
    expect(p.reminders.join(' ')).toContain('wrangler secret put VITOPS_TURNSTILE_SECRET');
    expect(p.reminders.join(' ')).toContain('never written to site.json');
  });
});

describe('deriveDomains', () => {
  it('collapses subdomains under a parent and skips localhost', () => {
    expect(
      deriveDomains({
        domains: { canonical: 'https://Example.com/' },
        environments: {
          production: { url: 'https://example.com' },
          dev: { url: 'https://dev.example.com' },
          local: { url: 'http://localhost:4321' },
        },
      }),
    ).toEqual(['example.com']);
  });
});

describe('patchSiteKey', () => {
  it('merges only site.security.turnstile.siteKey', () => {
    const raw = { organization: { name: 'x' }, site: { security: { other: 1 }, seo: {} } };
    expect(patchSiteKey(raw, '0xK')).toEqual({
      organization: { name: 'x' },
      site: { security: { other: 1, turnstile: { siteKey: '0xK' } }, seo: {} },
    });
  });
});

describe('executor request shapes', () => {
  const ok = (result: unknown, info?: object) =>
    new Response(JSON.stringify({ success: true, result, ...(info ? { result_info: info } : {}) }));

  it('creates a managed widget and returns the one-time secret', async () => {
    let seen: { url: string; init: RequestInit } | undefined;
    const fetchImpl = (async (url: string, init: RequestInit) => {
      seen = { url, init };
      return ok({ sitekey: '0xNEW', secret: 'sek' });
    }) as unknown as typeof fetch;
    const r = await createWidget('tok', 'acct', { name: 'N', domains: ['example.com'] }, fetchImpl);
    expect(r).toEqual({ ok: true, sitekey: '0xNEW', secret: 'sek' });
    expect(seen!.url).toBe('https://api.cloudflare.com/client/v4/accounts/acct/challenges/widgets');
    expect(JSON.parse(seen!.init.body as string)).toEqual({
      name: 'N',
      domains: ['example.com'],
      mode: 'managed',
    });
  });

  it('names the missing permission on a 403', async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ success: false, errors: [{ code: 10000, message: 'Auth' }] }), {
        status: 403,
      })) as unknown as typeof fetch;
    const r = await listWidgets('tok', 'acct', fetchImpl);
    expect(r.ok).toBe(false);
    expect(r.message).toContain('Account > Turnstile > Edit');
  });

  it('follows pagination', async () => {
    const pages: string[] = [];
    const fetchImpl = (async (url: string) => {
      pages.push(url);
      return url.includes('?page=1&')
        ? ok([widget], { page: 1, per_page: 1, total_count: 2 })
        : ok([{ ...widget, sitekey: '0xTWO' }], { page: 2, per_page: 1, total_count: 2 });
    }) as unknown as typeof fetch;
    const r = await listWidgets('tok', 'acct', fetchImpl);
    expect(r.widgets.map((w) => w.sitekey)).toEqual(['0xKEY12345', '0xTWO']);
  });

  it('prefers an explicit account id and refuses to guess among several', async () => {
    expect(await resolveAccountId('t', 'given')).toEqual({ ok: true, accountId: 'given' });
    const fetchImpl = (async () =>
      ok([
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
      ])) as unknown as typeof fetch;
    const r = await resolveAccountId('t', undefined, fetchImpl);
    expect(r.ok).toBe(false);
    expect(r.message).toContain('CLOUDFLARE_ACCOUNT_ID');
  });
});
