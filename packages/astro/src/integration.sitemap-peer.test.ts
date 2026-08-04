/**
 * The two `sitemap` behaviours the plain harness in integration.test.ts cannot
 * observe, both needing a module mock — and `vi.mock` hoists file-wide, so they
 * live here rather than fighting the un-mocked tests next door.
 *
 *  1. Option forwarding. The integration closes over its options; you cannot read
 *     them back off the returned object, so the mock echoes what it was called with.
 *  2. The missing-package throw. @astrojs/sitemap is a devDependency here, so the
 *     real import always succeeds in-repo — the one path a consumer hits in anger
 *     is otherwise never exercised.
 */
import type { AstroIntegration, HookParameters } from 'astro';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GetvitopsOptions } from './integration.ts';

type Params = HookParameters<'astro:config:setup'>;

vi.mock('@astrojs/sitemap', () => ({
  default: (o?: unknown) => ({ name: '@astrojs/sitemap', hooks: {}, __opts: o }),
}));

/** Same shape as integration.test.ts's harness; see its comment for the I/O gating. */
function harness(vitops: (o?: GetvitopsOptions) => AstroIntegration, opts: GetvitopsOptions) {
  const updates: Record<string, unknown>[] = [];
  const params = {
    config: {
      root: new URL('file:///nonexistent/astro-root/'),
      publicDir: new URL('file:///nonexistent/astro-root/public/'),
      site: 'https://example.com',
      base: '/',
      output: 'static',
      integrations: [] as AstroIntegration[],
    },
    command: 'build',
    isRestart: false,
    updateConfig: (c: Record<string, unknown>) => (updates.push(c), c),
    injectScript: () => {},
    logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
  } as unknown as Params;

  const hook = vitops({ webComponents: false, ...opts }).hooks['astro:config:setup'] as (
    p: Params,
  ) => Promise<void>;
  return { updates, run: () => hook(params) };
}

const forwarded = (updates: Record<string, unknown>[]) =>
  (updates.flatMap((u) => (u.integrations as { __opts?: unknown }[] | undefined) ?? [])[0] ?? {})
    .__opts;

beforeEach(() => {
  vi.resetModules();
});

describe('sitemap option forwarding', () => {
  it('forwards an options object verbatim', async () => {
    const { default: vitops } = await import('./integration.ts');
    const h = harness(vitops, { sitemap: { changefreq: 'weekly', entryLimit: 100 } });
    await h.run();
    expect(forwarded(h.updates)).toEqual({ changefreq: 'weekly', entryLimit: 100 });
  });

  it('forwards undefined — not `true` — for sitemap: true', async () => {
    // Passing `true` through would reach @astrojs/sitemap as a non-object and
    // blow up inside its own option parsing rather than using its defaults.
    const { default: vitops } = await import('./integration.ts');
    const h = harness(vitops, { sitemap: true });
    await h.run();
    expect(forwarded(h.updates)).toBeUndefined();
  });
});

describe('sitemap without @astrojs/sitemap installed', () => {
  it('throws a message naming the package to install', async () => {
    vi.doMock('@astrojs/sitemap', () => {
      throw new Error("Cannot find package '@astrojs/sitemap'");
    });
    const { default: vitops } = await import('./integration.ts');
    const h = harness(vitops, { sitemap: true });
    await expect(h.run()).rejects.toThrow('[vitops] sitemap requires `@astrojs/sitemap`');
    vi.doUnmock('@astrojs/sitemap');
  });
});
