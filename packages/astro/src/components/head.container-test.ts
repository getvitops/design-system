/**
 * Render `<Head />` for real (Astro's container API) and prove the CSP hashes
 * name the exact bytes of every executable inline script it emits.
 *
 * A source-text test can't show this: the page serves whatever the component
 * rendered, and a hash of a slightly different string is a script the browser
 * silently refuses once the policy is enforced. Same setup and run command as
 * `container.test.ts`: it needs Astro's Vite plugin, so it runs only under
 * `vitest run -c vitest.container.config.ts` (from packages/astro). The file is
 * deliberately NOT named `*.test.ts`, so the root `vp test` doesn't pick it up and
 * fail to parse `.astro` — which is what the existing `container.test.ts` does there.
 */
import { createHash } from 'node:crypto';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it, vi } from 'vitest';
import { inlineScriptHashes } from '../csp.ts';
// @ts-ignore — `.astro` modules have no declaration under the plain tsconfig; the
// container vitest config (via Astro's Vite plugin) is what resolves them.
import Head from './Head.astro';

// `<Head />` reads its config from this virtual module; `Font` comes from Astro's
// Fonts API, which a plain container run does not provide. No families are
// declared, so it is never rendered.
vi.mock('virtual:getvitops/head', () => ({
  default: {
    favicons: false,
    faviconLinks: [],
    themeColor: null,
    webComponents: true,
    editor: false,
    consent: true,
    consentRuntime: true,
    fonts: [],
    sitemap: null,
    wcBase: '/vitops',
  },
}));
vi.mock('astro:assets', () => ({ Font: () => null }));

const hash = (s: string) => `'sha256-${createHash('sha256').update(s, 'utf8').digest('base64')}'`;

/** Bodies of every executable inline <script> (no src, not a JSON-LD / inert data block). */
const inlineScripts = (html: string) =>
  [...html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)]
    .filter(([, attrs]) => !/type="(?:application\/ld\+json|text\/plain)"/.test(attrs ?? ''))
    .map(([, , body]) => body ?? '');

describe('<Head /> inline scripts and CSP', () => {
  it('emits exactly the bytes whose hashes csp.ts lists', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(Head);

    const bodies = inlineScripts(html);
    // Theme bootstrap + consent stub, nothing else sneaks an unhashed script in.
    expect(bodies).toHaveLength(2);

    const allowed = new Set(inlineScriptHashes());
    for (const body of bodies)
      expect(allowed.has(hash(body)), `no CSP hash for: ${body.slice(0, 60)}…`).toBe(true);
  });
});
