/**
 * The `icons` behaviours the plain harness can't observe, because they depend on
 * whether an optional peer resolves — and astro-icon IS a devDependency of this
 * package (its components import it), so the "not installed" path never happens
 * in-repo without a mock. `vi.mock` hoists file-wide, hence a separate file.
 *
 *  1. The include map forwarded to the icon integration — the integration closes
 *     over its options, so the mock echoes what it was called with.
 *  2. The 'auto' fallthrough when neither icon package is installed.
 */
import type { AstroIntegration, HookParameters } from 'astro';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GetvitopsOptions } from './integration.ts';

type Params = HookParameters<'astro:config:setup'>;

vi.mock('astro-icon', () => ({
  default: (o?: unknown) => ({ name: 'astro-icon', hooks: {}, __opts: o }),
}));

/** Same shape as integration.test.ts's harness; see its comment for the I/O gating. */
function harness(
  vitops: (o?: GetvitopsOptions) => AstroIntegration,
  opts: GetvitopsOptions,
  config: Partial<Params['config']> = {},
) {
  const updates: Record<string, unknown>[] = [];
  const logs: string[] = [];
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
    logger: {
      info: (m: string) => void logs.push(m),
      warn: (m: string) => void logs.push(m),
      error: () => {},
      debug: () => {},
    },
  } as unknown as Params;

  const hook = vitops({ webComponents: false, ...opts }).hooks['astro:config:setup'] as (
    p: Params,
  ) => Promise<void>;
  return { updates, logs, run: () => hook(params) };
}

const forwarded = (updates: Record<string, unknown>[]) =>
  (updates.flatMap((u) => (u.integrations as { __opts?: unknown }[] | undefined) ?? [])[0] ?? {})
    .__opts;

beforeEach(() => {
  vi.resetModules();
});

describe('the include map handed to the icon integration', () => {
  it('passes an empty object on a static build — nothing to trim', async () => {
    // The single most misreadable part of the feature: astro-icon is zero-config
    // on static, so an `include` there can only drop glyphs the scan missed.
    const { default: vitops } = await import('./integration.ts');
    const h = harness(vitops, { icons: { scan: false } });
    await h.run();
    expect(forwarded(h.updates)).toEqual({});
  });

  it('passes declared icons through on a server build', async () => {
    const { default: vitops } = await import('./integration.ts');
    const h = harness(
      vitops,
      { icons: { ui: 'ph', scan: false, include: { semantic: ['menu'] } } },
      { output: 'server' },
    );
    await h.run();
    // 'menu' resolves through the ph map to 'list'.
    expect(forwarded(h.updates)).toEqual({ include: { ph: ['list'] } });
  });

  it('carries the weight into the bundled name', async () => {
    const { default: vitops } = await import('./integration.ts');
    const h = harness(
      vitops,
      {
        icons: {
          ui: 'ph',
          weight: 'bold',
          scan: false,
          include: { semantic: ['menu'] },
        },
      },
      { output: 'server' },
    );
    await h.run();
    expect(forwarded(h.updates)).toEqual({ include: { ph: ['list-bold'] } });
  });

  it('throws on a declared name that does not resolve', async () => {
    // Declared names are a config error and stay loud, unlike scanned ones.
    const { default: vitops } = await import('./integration.ts');
    const h = harness(vitops, {
      icons: { ui: 'ph', scan: false, include: { semantic: ['nonsense'] } },
    });
    await expect(h.run()).rejects.toThrow(/not found/);
  });
});

describe('with neither icon package installed', () => {
  it('registers nothing, and rendering is unaffected', async () => {
    // The whole point of inlining: no icon integration is required for <Icon />
    // to draw. A missing package means there is simply nothing to register —
    // not a warning, and certainly not an error.
    vi.doMock('astro-icon', () => {
      throw new Error("Cannot find package 'astro-icon'");
    });
    vi.doMock('astro-iconset', () => {
      throw new Error("Cannot find package 'astro-iconset'");
    });
    const { default: vitops } = await import('./integration.ts');
    const h = harness(vitops, { icons: { scan: false } });
    await h.run();
    expect(h.updates.flatMap((u) => (u.integrations as unknown[]) ?? [])).toEqual([]);
  });
});
