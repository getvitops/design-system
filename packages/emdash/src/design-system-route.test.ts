/**
 * `createDesignSystemRoute()`'s handler and `designSystemOverrideFragment()`
 * — the two halves AGENTS.md's "EmDash plugin as the design-system editing
 * surface" section describes: persist + self-clear (`ctx.settings`), the
 * contrast gate at save time, and the best-effort commit (mocked here —
 * `@getvitops/utils/git` is never hit over the network).
 */
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { defaultSiteConfig } from '@getvitops/generator';
import type { Config } from '@getvitops/generator';
import { commitFile } from '@getvitops/utils/git';
import { validateColorContract } from '@getvitops/generator/tokens';
import { createDesignSystemRoute, designSystemOverrideFragment } from './design-system-route.ts';

vi.mock('@getvitops/utils/git', () => ({ commitFile: vi.fn() }));
vi.mock('@getvitops/generator/tokens', async () => {
  const actual = await vi.importActual<typeof import('@getvitops/generator/tokens')>(
    '@getvitops/generator/tokens',
  );
  return { ...actual, validateColorContract: vi.fn(actual.validateColorContract) };
});

function parse(res: unknown): { status: number; body: unknown } {
  const r = res as { status: number; body: { kind: 'text'; value: string } };
  return { status: r.status, body: JSON.parse(r.body.value) };
}

/**
 * Returns the fake `RouteContext` *and* its `settings` mocks as standalone
 * references — assertions read `settingsSet`/`settingsDelete` directly
 * rather than `ctx.settings.set`, which oxlint's `unbound-method` rule
 * otherwise flags (it can't tell a `vi.fn()` sitting on a plain object
 * literal from a real `this`-bound method).
 */
function fakeCtx(opts: { method: string; input?: unknown; http?: boolean }) {
  const store = new Map<string, unknown>();
  const settingsGet = vi.fn(async (key: string) => (store.has(key) ? store.get(key) : null));
  const settingsSet = vi.fn(async (key: string, value: unknown) => {
    store.set(key, value);
  });
  const settingsDelete = vi.fn(async (key: string) => store.delete(key));
  const ctx = {
    request: new Request('https://acme.ca/_emdash/api/plugins/vitops/design-system', {
      method: opts.method,
    }),
    input: opts.input,
    settings: { get: settingsGet, set: settingsSet, delete: settingsDelete },
    ...(opts.http
      ? { http: { fetch: vi.fn(async () => new Response('{}', { status: 200 })) } }
      : {}),
    log: { warn: vi.fn(), debug: vi.fn(), info: vi.fn(), error: vi.fn() },
    // Unused by this route, present only for structural completeness.
    plugin: { id: 'vitops', version: '0.0.0' },
    storage: {},
    kv: {},
    site: {},
    url: (p: string) => p,
    requestMeta: { ip: null, userAgent: null, referer: null, geo: null },
  } as unknown as Parameters<ReturnType<typeof createDesignSystemRoute>['handler']>[0];
  return { ctx, settingsGet, settingsSet, settingsDelete };
}

const config: Config = {
  ...defaultSiteConfig({ name: 'Acme' }),
  site: {
    ...defaultSiteConfig().site,
    deployment: { repo: 'getvitops/acme-site', branch: 'dev' },
  },
} as Config;

beforeEach(() => {
  vi.mocked(commitFile).mockReset();
});

describe('GET (probe)', () => {
  it('reports writable with nothing stored', async () => {
    const route = createDesignSystemRoute({ config });
    const { ctx } = fakeCtx({ method: 'GET' });
    const res = parse(await route.handler(ctx));
    expect(res).toEqual({ status: 200, body: { writable: true } });
  });

  it('self-clears a stored patch already reflected in the bundled config', async () => {
    const route = createDesignSystemRoute({ config });
    const { ctx, settingsSet, settingsDelete } = fakeCtx({ method: 'GET' });
    // Already true of the shipped default palette — merging it into itself
    // changes nothing, so this should read as "already baked in".
    const seed = (
      defaultSiteConfig().designSystem.themes as Record<string, { colors: { palette: unknown } }>
    )['default']!.colors.palette;
    await settingsSet('designSystemPatch', {
      patch: { colors: { palette: seed } },
      at: Date.now(),
    });
    await route.handler(ctx);
    expect(settingsDelete).toHaveBeenCalledWith('designSystemPatch');
  });

  it('keeps an unsynced patch that is not yet reflected', async () => {
    const route = createDesignSystemRoute({ config });
    const { ctx, settingsSet, settingsDelete } = fakeCtx({ method: 'GET' });
    await settingsSet('designSystemPatch', {
      patch: { colors: { palette: { pine: { seed: '#000000' } } } },
      at: Date.now(),
    });
    await route.handler(ctx);
    expect(settingsDelete).not.toHaveBeenCalled();
  });
});

describe('POST (save)', () => {
  it('rejects a missing/malformed patch', async () => {
    const route = createDesignSystemRoute({ config });
    const { ctx } = fakeCtx({ method: 'POST', input: {} });
    const res = parse(await route.handler(ctx));
    expect(res.status).toBe(400);
    expect((res.body as { errors: string[] }).errors[0]).toMatch(/patch: object/);
  });

  it('rejects a patch that breaks the contrast contract', async () => {
    // validateColorContract's own thin-kit/monotonicity cases are covered in
    // tokens.test.ts; what this route needs proven is the wiring — a
    // returned error list becomes a 400, and the save never reaches
    // ctx.settings.set.
    vi.mocked(validateColorContract).mockReturnValueOnce(['danger/light: text Lc 12.0 < 60 on bg']);
    const route = createDesignSystemRoute({ config });
    const { ctx, settingsSet } = fakeCtx({ method: 'POST', input: { patch: { colors: {} } } });
    const res = parse(await route.handler(ctx));
    expect(res.status).toBe(400);
    expect((res.body as { errors: string[] }).errors).toEqual([
      'danger/light: text Lc 12.0 < 60 on bg',
    ]);
    expect(settingsSet).not.toHaveBeenCalled();
  });

  it('accepts a valid patch, stores it, and reports the sync outcome', async () => {
    vi.stubEnv('VITOPS_GITHUB_TOKEN', 'gh-test-token');
    vi.mocked(commitFile).mockResolvedValue({ ok: true, status: 200, commitSha: 'abc123' });
    const route = createDesignSystemRoute({ config });
    const { ctx, settingsSet } = fakeCtx({ method: 'POST', input: { patch: { colors: {} } } });
    const res = parse(await route.handler(ctx));
    expect(res).toEqual({ status: 200, body: { ok: true, warnings: [] } });
    expect(settingsSet).toHaveBeenCalledWith(
      'designSystemPatch',
      expect.objectContaining({ patch: { colors: {} } }),
    );
    expect(commitFile).toHaveBeenCalledWith(
      expect.objectContaining({ owner: 'getvitops', repo: 'acme-site', branch: 'dev' }),
    );
    vi.unstubAllEnvs();
  });

  it('still saves (and warns) when site.deployment.repo is unset', async () => {
    const route = createDesignSystemRoute({ config: defaultSiteConfig({ name: 'Acme' }) });
    const { ctx } = fakeCtx({ method: 'POST', input: { patch: { colors: {} } } });
    const res = parse(await route.handler(ctx));
    expect(res.status).toBe(200);
    expect((res.body as { warnings: string[] }).warnings[0]).toMatch(/site\.deployment\.repo/);
    expect(commitFile).not.toHaveBeenCalled();
  });

  it('still saves (and warns) when no GitHub token is configured', async () => {
    const route = createDesignSystemRoute({ config });
    const { ctx } = fakeCtx({ method: 'POST', input: { patch: { colors: {} } } });
    const res = parse(await route.handler(ctx));
    expect(res.status).toBe(200);
    expect((res.body as { warnings: string[] }).warnings[0]).toMatch(/GitHub token/);
    expect(commitFile).not.toHaveBeenCalled();
  });

  it('never fails the save when the commit itself fails', async () => {
    vi.stubEnv('VITOPS_GITHUB_TOKEN', 'gh-test-token');
    vi.mocked(commitFile).mockResolvedValue({ ok: false, status: 422, message: 'boom' });
    const route = createDesignSystemRoute({ config });
    const { ctx } = fakeCtx({ method: 'POST', input: { patch: { colors: {} } } });
    const res = parse(await route.handler(ctx));
    expect(res.status).toBe(200);
    expect((res.body as { warnings: string[] }).warnings[0]).toContain('boom');
    vi.unstubAllEnvs();
  });
});

describe('designSystemOverrideFragment', () => {
  it('returns null when nothing is stored', async () => {
    const { ctx } = fakeCtx({ method: 'GET' });
    expect(await designSystemOverrideFragment(ctx, { config })).toBeNull();
  });

  it('renders the stored patch as a :root override <style> fragment', async () => {
    const { ctx, settingsSet } = fakeCtx({ method: 'GET' });
    await settingsSet('designSystemPatch', {
      patch: { colors: { palette: { brand: { anchors: { 500: '#123456' } } } } },
      at: Date.now(),
    });
    const fragment = await designSystemOverrideFragment(ctx, { config });
    expect(fragment?.kind).toBe('html');
    expect(fragment?.placement).toBe('head');
    expect(fragment && 'html' in fragment ? fragment.html : '').toContain(
      '--color-brand-500: #123456',
    );
  });
});
