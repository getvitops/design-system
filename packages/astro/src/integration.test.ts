import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

/**
 * Read a virtual module's payload back off the vite plugin that serves it.
 *
 * Selected by plugin NAME, not "the first one with a load hook" — the run
 * registers more than one virtual module now, and picking positionally silently
 * read the wrong plugin's `load` (which returns null for an id it doesn't own).
 */
function virtualData(
  updates: Record<string, unknown>[],
  pluginName: string,
  id: string,
): Record<string, unknown> {
  const plugins = updates.flatMap(
    (u) => ((u.vite as { plugins?: unknown[] } | undefined)?.plugins ?? []) as unknown[],
  );
  const plugin = plugins.find(
    (p): p is { name: string; load: (id: string) => string | null } =>
      typeof p === 'object' && p !== null && (p as { name?: string }).name === pluginName,
  );
  const src = plugin?.load(id);
  return JSON.parse(
    String(src)
      .replace(/^export default /, '')
      .replace(/;$/, ''),
  );
}

/** The HeadData the virtual module would serve. */
const headData = (updates: Record<string, unknown>[]) =>
  virtualData(updates, '@getvitops/astro:virtual-head', '\0virtual:getvitops/head');

/** The IconsData `<Icon />` would read. */
const iconsData = (updates: Record<string, unknown>[]) =>
  virtualData(updates, '@getvitops/astro:virtual-icons', '\0virtual:getvitops/icons');

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

describe('getvitops({ icons })', () => {
  it('registers nothing and serves an inert module unless asked', async () => {
    const h = harness();
    await h.run();
    expect(added(h.updates)).toHaveLength(0);
    // The module is always served so <Icon /> can import it unconditionally;
    // `engine: 'none'` is what makes it warn instead of rendering nothing silently.
    expect(iconsData(h.updates).engine).toBe('none');
  });

  it('passes NO include on a static build', async () => {
    // The whole point of the option is trimming a server bundle. astro-icon is
    // zero-config on static, so an include there trims nothing and can only drop
    // a glyph the scan could not see.
    const h = harness({ icons: { engine: 'sprite', scan: false } }, { output: 'static' });
    await h.run();
    expect(iconsData(h.updates).engine).toBe('sprite');
  });

  it('carries the configured sets, weight and overrides into the module', async () => {
    const h = harness({
      icons: {
        ui: 'ph',
        brand: 'simple-icons',
        weight: 'bold',
        engine: 'sprite',
        scan: false,
        overrides: { zap: 'lightbulb' },
      },
    });
    await h.run();
    expect(iconsData(h.updates)).toMatchObject({
      ui: 'ph',
      brand: 'simple-icons',
      weight: 'bold',
      overrides: { zap: 'lightbulb' },
    });
  });

  it('leaves a consumer-registered icon integration in charge, but still resolves', async () => {
    const h = harness(
      { icons: { engine: 'sprite', scan: false } },
      { integrations: [integration('astro-icon')] },
    );
    await h.run();
    expect(added(h.updates)).toHaveLength(0);
    expect(h.logs.some((l) => l.msg.includes('already in your integrations'))).toBe(true);
    // Registration is skipped; naming is not astro-icon's job, so it still runs.
    expect(iconsData(h.updates).engine).toBe('sprite');
  });

  it('warns that a sprite without `css` writes no file', async () => {
    const h = harness({ icons: { engine: 'sprite', sprite: '/x/icons.svg', scan: false } });
    await h.run();
    expect(warned(h.logs, 'sprite')).toBe(true);
  });

  it('defaults to inlining the glyph, which needs no icon integration', async () => {
    const h = harness({ icons: { scan: false } });
    await h.run();
    expect(iconsData(h.updates).engine).toBe('inline');
  });

  it('still registers an installed icon integration for the consumer’s own use', async () => {
    // Separate concern from how <Icon /> renders: registering astro-icon is what
    // makes the consumer's own <Icon> work and hands it the derived include.
    // astro-icon is a devDependency here, so this is the real path.
    const h = harness({ icons: { scan: false } });
    await h.run();
    expect(added(h.updates).map((i) => i.name)).toContain('astro-icon');
  });

  it('keeps IconsData JSON-serialisable', async () => {
    // The module is JSON.stringify'd, so a function crossing it would be
    // silently dropped rather than fail — hence no resolver field.
    const h = harness({ icons: { engine: 'sprite', scan: false } });
    await h.run();
    const data = iconsData(h.updates);
    expect(Object.values(data).every((v) => typeof v !== 'function')).toBe(true);
    expect(new Set(Object.keys(data))).toEqual(
      new Set(['engine', 'root', 'ui', 'brand', 'weight', 'overrides', 'sprite']),
    );
  });
});

/**
 * Once a consumer keeps their tokens inside `company.json`, `css.input` IS the
 * site config — and every other option that wants one should stop asking for the
 * path again. This is the whole point of the change; without it the config file
 * moved but the number of times you name it did not.
 */
describe('a site config at css.input', () => {
  const root = mkdtempSync(join(tmpdir(), 'vitops-astro-'));
  const rootUrl = new URL(`file://${root}/`);
  writeFileSync(
    join(root, 'company.json'),
    JSON.stringify({
      defaultLocale: 'en',
      locales: { en: { name: 'English' } },
      environments: { production: { url: 'https://acme.example' } },
      organization: { name: 'Acme' },
      designSystem: { themes: { default: {} } },
      fonts: [{ name: 'Inter', provider: 'google', cssVariable: '--font-inter' }],
    }),
  );
  writeFileSync(join(root, 'design-system.json'), JSON.stringify({ colors: { palette: {} } }));

  const at = (opts: GetvitopsOptions) => harness(opts, { root: rootUrl });

  it('lets `legal` default its input to it, so `legal: {}` is the whole declaration', async () => {
    await expect(
      at({ css: { input: 'company.json', format: 'css' }, legal: {} }).run(),
    ).resolves.toBeUndefined();
  });

  it('lets `fonts: true` read the families from it', async () => {
    const h = at({ css: { input: 'company.json', format: 'css' }, fonts: true });
    await h.run();
    // The warning fires only when nothing was declared anywhere — its absence is
    // the evidence the site config was found and read.
    expect(h.logs.filter((l) => l.msg.startsWith('fonts: nothing declared'))).toHaveLength(0);
  });

  it('still demands a path when css.input is a plain design system', async () => {
    // The fallback is not "guess"; a design-system.json holds no legal facts, so
    // asking is the only correct answer.
    await expect(
      at({ css: { input: 'design-system.json', format: 'css' }, legal: {} }).run(),
    ).rejects.toThrow(/legal: needs/);
  });
});
