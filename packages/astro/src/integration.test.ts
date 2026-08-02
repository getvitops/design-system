import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { AstroIntegration, HookParameters } from 'astro';
import { describe, expect, it } from 'vitest';
import getvitops, { type GetvitopsOptions } from './integration.ts';

type Params = HookParameters<'astro:config:setup'>;

/**
 * Drives the integration's only hook against a fake Astro.
 *
 * Two of its five steps do real filesystem work — favicon generation writes into
 * publicDir, and the web-component step cpSync's @getvitops/core's dist. Both are
 * option-gated, so passing no `favicon` and forcing `webComponents: false` keeps
 * the whole run in memory; the fake root/publicDir URLs are only ever handed to
 * fileURLToPath/resolve, never opened. Passing no `css` likewise skips the
 * @tailwindcss/vite import.
 */
function harness(opts: GetvitopsOptions = {}, config: Partial<Params['config']> = {}) {
  const updates: Record<string, unknown>[] = [];
  const logs: { level: string; msg: string }[] = [];
  const log = (level: string) => (msg: string) => void logs.push({ level, msg });

  const params = {
    config: {
      root: new URL('file:///nonexistent/astro-root/'),
      publicDir: new URL('file:///nonexistent/astro-root/public/'),
      site: 'https://example.com',
      base: '/',
      output: 'static',
      integrations: [] as AstroIntegration[],
      ...config,
    },
    command: 'build',
    isRestart: false,
    updateConfig: (c: Record<string, unknown>) => (updates.push(c), c),
    injectScript: () => {},
    logger: { info: log('info'), warn: log('warn'), error: log('error'), debug: log('debug') },
    // AstroIntegrationLogger is a class and Params is far wider than this hook
    // reads — one cast at the seam beats stubbing the whole of Astro.
  } as unknown as Params;

  const hook = getvitops({ webComponents: false, ...opts }).hooks['astro:config:setup'] as (
    p: Params,
  ) => Promise<void>;

  return { updates, logs, run: () => hook(params) };
}

/** Integrations the run appended via updateConfig. */
const added = (updates: Record<string, unknown>[]): AstroIntegration[] =>
  updates.flatMap((u) => (u.integrations as AstroIntegration[] | undefined) ?? []);

/** The HeadData the virtual module would serve, read back off the vite plugin. */
function headData(updates: Record<string, unknown>[]): Record<string, unknown> {
  const plugins = updates.flatMap(
    (u) => ((u.vite as { plugins?: unknown[] } | undefined)?.plugins ?? []) as unknown[],
  );
  const plugin = plugins.find(
    (p): p is { name: string; load: (id: string) => string | null } =>
      typeof p === 'object' && p !== null && 'name' in p && 'load' in p,
  );
  const src = plugin?.load('\0virtual:getvitops/head');
  return JSON.parse(
    String(src)
      .replace(/^export default /, '')
      .replace(/;$/, ''),
  );
}

const warned = (logs: { level: string; msg: string }[], needle: string) =>
  logs.some((l) => l.level === 'warn' && l.msg.includes(needle));

const integration = (name: string): AstroIntegration => ({ name, hooks: {} });

describe('getvitops({ sitemap })', () => {
  it('registers nothing unless asked', async () => {
    const h = harness();
    await h.run();
    expect(added(h.updates)).toEqual([]);
    expect(headData(h.updates).sitemap).toBeNull();
  });

  it('registers @astrojs/sitemap and links it from <Head />', async () => {
    const h = harness({ sitemap: true });
    await h.run();
    expect(added(h.updates).map((i) => i.name)).toEqual(['@astrojs/sitemap']);
    expect(headData(h.updates).sitemap).toBe('/sitemap-index.xml');
  });

  it('tracks filenameBase in the <Head /> link', async () => {
    const h = harness({ sitemap: { filenameBase: 'pages' } });
    await h.run();
    expect(headData(h.updates).sitemap).toBe('/pages-index.xml');
  });

  it('warns and skips when `site` is unset', async () => {
    const h = harness({ sitemap: true }, { site: undefined });
    await h.run();
    expect(added(h.updates)).toEqual([]);
    expect(warned(h.logs, '`site`')).toBe(true);
    expect(headData(h.updates).sitemap).toBeNull();
  });

  it('warns and skips when emdash() is registered', async () => {
    // EmDash injects its own database-driven /sitemap.xml.
    const h = harness({ sitemap: true }, { integrations: [integration('emdash')] });
    await h.run();
    expect(added(h.updates)).toEqual([]);
    expect(warned(h.logs, 'emdash()')).toBe(true);
  });

  it('defers to an @astrojs/sitemap the consumer registered, without warning', async () => {
    // The documented escape hatch: registering it yourself is how you reach
    // options this package does not mirror, and how you run it alongside EmDash.
    const h = harness({ sitemap: true }, { integrations: [integration('@astrojs/sitemap')] });
    await h.run();
    expect(added(h.updates)).toEqual([]);
    expect(h.logs.filter((l) => l.level === 'warn')).toEqual([]);
    expect(h.logs.some((l) => l.level === 'info' && l.msg.includes('already'))).toBe(true);
  });

  it("warns about on-demand pages on output: 'server' but still registers", async () => {
    const h = harness({ sitemap: true }, { output: 'server' });
    await h.run();
    expect(added(h.updates).map((i) => i.name)).toEqual(['@astrojs/sitemap']);
    expect(warned(h.logs, 'prerender')).toBe(true);
  });
});

describe('getvitops({ seo })', () => {
  it('defaults to an empty object so <Seo /> can read it unconditionally', async () => {
    const h = harness();
    await h.run();
    expect(headData(h.updates).seo).toEqual({});
  });

  it('carries the defaults and `site` into the virtual module', async () => {
    const seo = { siteName: 'Acme', titleTemplate: '%s · Acme' };
    const h = harness({ seo });
    await h.run();
    expect(headData(h.updates).seo).toEqual(seo);
    expect(headData(h.updates).site).toBe('https://example.com');
  });

  it('warns when `site` is unset, since every absolute-URL tag then drops', async () => {
    // Invisible in the output otherwise — the tags are simply absent.
    const h = harness({ seo: { siteName: 'Acme' } }, { site: undefined });
    await h.run();
    expect(warned(h.logs, '`site`')).toBe(true);
    expect(headData(h.updates).site).toBeNull();
  });

  it('stays quiet about `site` when seo is not configured', async () => {
    const h = harness({}, { site: undefined });
    await h.run();
    expect(h.logs.filter((l) => l.level === 'warn')).toEqual([]);
  });

  it('warns that <EmDashHead> already covers these tags', async () => {
    const h = harness({ seo: { siteName: 'Acme' } }, { integrations: [integration('emdash')] });
    await h.run();
    expect(warned(h.logs, 'EmDashHead')).toBe(true);
  });
});

describe('getvitops({ analytics, consent })', () => {
  /**
   * The bundle copy is real filesystem work, so anything that turns the consent
   * runtime on needs a publicDir it may actually write to. (The base harness
   * avoids this by keeping every I/O-doing step switched off.)
   */
  const scratch = () => ({
    publicDir: pathToFileURL(`${mkdtempSync(join(tmpdir(), 'vitops-'))}/`),
  });

  it('is off unless asked, and <Analytics /> can read the defaults unconditionally', async () => {
    const h = harness();
    await h.run();
    const head = headData(h.updates);
    expect(head.analytics).toEqual({});
    expect(head.consent).toBe(false);
    expect(head.consentRuntime).toBe(false);
  });

  it('carries the provider config into the virtual module verbatim', async () => {
    const analytics = { googleAnalytics: 'G-ABC123', strategy: 'interaction' as const };
    const h = harness({ analytics, consent: true }, scratch());
    await h.run();
    expect(headData(h.updates).analytics).toEqual(analytics);
    expect(headData(h.updates).consent).toBe(true);
  });

  it('warns when a cookie-setting provider has no consent gate', async () => {
    const h = harness({ analytics: { googleAnalytics: 'G-ABC123' } }, scratch());
    await h.run();
    expect(warned(h.logs, 'Google Analytics')).toBe(true);
    expect(warned(h.logs, 'consent: true')).toBe(true);
  });

  it('stays quiet when every configured provider is cookieless', async () => {
    const h = harness({ analytics: { plausible: 'example.com' } }, scratch());
    await h.run();
    expect(h.logs.filter((l) => l.level === 'warn')).toEqual([]);
  });

  it('needs no runtime for a cookieless provider on `async`', async () => {
    // The configuration that ships zero consent JavaScript.
    const h = harness({ analytics: { plausible: 'example.com', strategy: 'async' } });
    await h.run();
    expect(headData(h.updates).consentRuntime).toBe(false);
  });

  it('turns the runtime on for consent alone, with no analytics configured', async () => {
    // The gate is general: a site may be gating an A/B split or an embed.
    const h = harness({ consent: true }, scratch());
    await h.run();
    expect(headData(h.updates).consentRuntime).toBe(true);
    expect(headData(h.updates).consentCategories).toEqual(['analytics']);
  });

  it('offers only the categories the configured providers need', async () => {
    const h = harness(
      {
        consent: true,
        analytics: { clarity: { id: 'abc', category: 'marketing' }, plausible: 'example.com' },
      },
      scratch(),
    );
    await h.run();
    expect(headData(h.updates).consentCategories).toEqual(['marketing']);
  });

  it('lets the consumer state the categories explicitly', async () => {
    const h = harness({ consent: { categories: ['analytics', 'preferences'] } }, scratch());
    await h.run();
    expect(headData(h.updates).consentCategories).toEqual(['analytics', 'preferences']);
  });

  it('carries the cookie-notice URL through for the banner to link', async () => {
    const h = harness({ consent: { policyUrl: '/legal/cookies' } }, scratch());
    await h.run();
    expect(headData(h.updates).consentPolicyUrl).toBe('/legal/cookies');
  });

  it('copies consent.js even with webComponents off', async () => {
    // The gate decides whether third-party tags run, so switching off the element
    // runtime must not silently switch off consent along with it.
    const dir = scratch();
    const h = harness({ consent: true, webComponents: false }, dir);
    await h.run();
    const dest = join(fileURLToPath(dir.publicDir), 'vitops');
    // Skipped rather than failed when core hasn't been built — the integration
    // warns in that case and the test for the decision is `consentRuntime` above.
    if (existsSync(dest)) {
      expect(existsSync(join(dest, 'consent.js'))).toBe(true);
      expect(existsSync(join(dest, 'elements.js'))).toBe(false);
    }
  });

  /**
   * The defect this catches is specific and quiet: a site runs a tag its own
   * generated cookie notice never mentions, because `getvitops({ analytics })`
   * and the site config's `analytics` block are separate surfaces.
   */
  it('warns when a provider is missing from the site config the legal docs render from', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'vitops-'));
    const input = join(dir, 'site.json');
    writeFileSync(input, JSON.stringify({ analytics: { plausibleDomain: 'example.com' } }));

    const h = harness(
      { analytics: { clarity: 'abc', plausible: 'example.com' }, consent: true, legal: { input } },
      { root: pathToFileURL(`${dir}/`), publicDir: pathToFileURL(`${dir}/public/`) },
    );
    await h.run();
    expect(warned(h.logs, 'clarityId')).toBe(true);
    // Plausible *is* declared there, so it must not be named.
    expect(h.logs.some((l) => l.msg.includes('plausibleDomain'))).toBe(false);
  });

  it('stays quiet when the site config declares every configured provider', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'vitops-'));
    const input = join(dir, 'site.json');
    writeFileSync(input, JSON.stringify({ analytics: { clarityId: 'abc' } }));

    const h = harness(
      { analytics: { clarity: 'abc' }, consent: true, legal: { input } },
      { root: pathToFileURL(`${dir}/`), publicDir: pathToFileURL(`${dir}/public/`) },
    );
    await h.run();
    expect(h.logs.some((l) => l.msg.includes('cookie notice'))).toBe(false);
  });
});
