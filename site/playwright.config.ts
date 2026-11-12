import { defineConfig, devices } from '@playwright/test';

/**
 * A deliberately narrow e2e layer — two architectural guarantees this repo
 * makes in prose and nothing previously checked in a real browser:
 *
 *   - the `no-js` project: the tier-2 promise (AGENTS.md's "Web components"
 *     section) that a `<wc-*>` element's slotted fallback markup "must be
 *     accessible and usable on its own with no JS". `packages/core/src/
 *     web-components/*.dom.test.ts` runs in happy-dom and tests
 *     *enhancement* (JS-on behaviour), never the fallback with scripting off.
 *   - the `forced-colors` project: that a keyboard focus indicator survives
 *     Windows High Contrast Mode — see the `@media (forced-colors: active)`
 *     rule in `packages/core/css/global.css` for why this was silently false
 *     for every `:focus-visible` element in the framework until that rule
 *     existed. CSS-only, so it needs JS enabled only to read
 *     `getComputedStyle` back out; the effect itself doesn't depend on it.
 *   - the `masthead` projects: that `site.chrome` produces the behaviour it claims in a real
 *     browser — hide-on-scroll, scroll-state elevation, header-offset anchoring, the dropdown
 *     and mega panels. Computed style and layout facts no happy-dom test can see; the
 *     `masthead-no-js` project proves the same page needs no script at all.
 *   - the `lightbox-fit` project: that an opened lightbox image is always
 *     scaled to fit the viewport, never cropped, never overflowing it — a
 *     computed-layout fact no `*.dom.test.ts` (happy-dom, no real layout) can
 *     see, and deliberately not folded into `no-js` since it needs
 *     `showModal()` and runs with scripting on. See `lightbox-fit.e2e.ts`.
 *
 * `site/` is the target for both because it is already the one Astro site
 * that dogfoods the framework's own CSS/web components through the real
 * Astro integration rather than a hand-maintained wireframe (see its own
 * astro.config.mjs docblock) — no docs-framework layer hides the thing under
 * test.
 */
// Astro's default dev/preview port (4321) is exactly the port a developer's
// own `astro dev` — on this repo or any other Astro project open at the same
// time — is likely already sitting on. `reuseExistingServer` below would then
// happily attach to that unrelated server and run every assertion against the
// wrong site, silently, with no error at all beyond every locator timing out
// against a page that carries none of the expected markup. A dedicated port
// makes a collision a `EADDRINUSE` a developer would get to notice.
const PORT = 4399;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  // Named `*.e2e.ts`, not Playwright's own default `*.spec.ts`/`*.test.ts` —
  // the root Vitest config (`vite.config.ts`) has no `site/**` exclusion (it
  // never needed one before this file existed) and would otherwise try to
  // load this as a Vitest test, which fails immediately: Playwright's
  // `test.describe` rejects being called from inside another test runner.
  testMatch: /.*\.e2e\.ts$/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: BASE_URL,
  },
  // `build` first: `preview` serves whatever is already in dist/, and running
  // it against a stale or absent build would test yesterday's markup, or fail
  // outright on a clean checkout.
  webServer: {
    command: `pnpm run build && pnpm exec astro preview --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  // Each project's own `testMatch` narrows it to its one file — without this,
  // every project runs every spec by default, which would run the no-JS
  // fallback checks WITH scripting on (defeating them) and the forced-colors
  // check with scripting off (harmless, but a duplicate run testing nothing
  // extra) on every invocation.
  projects: [
    {
      name: 'no-js',
      testMatch: /no-js-fallback\.e2e\.ts$/,
      use: { ...devices['Desktop Chrome'], javaScriptEnabled: false },
    },
    {
      name: 'enhanced',
      testMatch: /enhanced-components\.e2e\.ts$/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'forced-colors',
      testMatch: /forced-colors\.e2e\.ts$/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'masthead',
      testMatch: /masthead\.e2e\.ts$/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1400, height: 800 } },
    },
    {
      // Firefox has no `scroll-state()`. The masthead must degrade to a solid, elevated,
      // always-visible bar there, not to a transparent one over body text.
      name: 'masthead-firefox',
      testMatch: /masthead-fallback\.e2e\.ts$/,
      use: { ...devices['Desktop Firefox'], viewport: { width: 1400, height: 800 } },
    },
    {
      name: 'masthead-no-js',
      testMatch: /masthead-no-js\.e2e\.ts$/,
      use: { ...devices['Desktop Chrome'], javaScriptEnabled: false },
    },
    {
      name: 'lightbox-fit',
      testMatch: /lightbox-fit\.e2e\.ts$/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
