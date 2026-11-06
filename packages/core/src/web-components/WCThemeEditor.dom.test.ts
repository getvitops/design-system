/**
 * @vitest-environment happy-dom
 *
 * Only the `save-endpoint` attribute's wiring — everything else about this
 * element is exercised manually (see AGENTS.md's "The live theme editor";
 * this is deliberately quarantined tooling, not a tier-2 component). What's
 * worth pinning: the probe/save requests target `save-endpoint` when set
 * (so mounting this inside an EmDash admin page instead of a `vite dev`
 * server needs no other change), and fall back to the historical
 * `/__vitops/design-system` when it's absent.
 */
import { beforeAll, describe, expect, it, vi } from 'vite-plus/test';

/** Every field `boot()`/`build()` touches, all empty — enough to complete
 * without needing to assert on rendered content. */
const MANIFEST = {
  colors: { ramps: [], steps: [], palette: {}, roles: [], roleTokens: {} },
  typography: { roles: [], hooks: {}, families: {}, specs: {} },
  scales: { text: [], space: [] },
  fonts: {},
  patterns: { defaults: {}, radii: {}, groups: {}, items: [] },
  shadows: {},
  reverseIndex: {},
};

function stubFetch(writable: boolean): { fetchImpl: typeof fetch; urls: string[] } {
  const urls: string[] = [];
  const fetchImpl = (async (url: string) => {
    urls.push(url);
    if (url.endsWith('.json')) return { ok: true, json: async () => MANIFEST } as Response;
    return { ok: true, json: async () => ({ writable }) } as Response;
  }) as unknown as typeof fetch;
  return { fetchImpl, urls };
}

beforeAll(async () => {
  await import('./WCThemeEditor.ts');
});

describe('<wc-theme-editor> save-endpoint', () => {
  it('probes the custom save-endpoint, not the default, when set', async () => {
    const { fetchImpl, urls } = stubFetch(true);
    vi.stubGlobal('fetch', fetchImpl);
    document.body.innerHTML =
      '<wc-theme-editor manifest="/vitops/design-manifest.json" save-endpoint="/_emdash/api/plugins/vitops/design-system"></wc-theme-editor>';
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    expect(urls).toContain('/_emdash/api/plugins/vitops/design-system');
    expect(urls).not.toContain('/__vitops/design-system');
    vi.unstubAllGlobals();
  });

  it('falls back to /__vitops/design-system when save-endpoint is absent', async () => {
    const { fetchImpl, urls } = stubFetch(false);
    vi.stubGlobal('fetch', fetchImpl);
    document.body.innerHTML =
      '<wc-theme-editor manifest="/vitops/design-manifest.json"></wc-theme-editor>';
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    expect(urls).toContain('/__vitops/design-system');
    vi.unstubAllGlobals();
  });
});
