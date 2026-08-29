/**
 * Verifies the one thing the tier-2 architecture stakes itself on: a `<wc-*>`
 * element's slotted fallback markup renders correctly and stays usable with
 * JavaScript off (see this project's `playwright.config.ts` for how the `no-js`
 * project makes that a real test rather than an assumption).
 *
 * Deliberately narrow. This is not a general e2e suite — every test here
 * exists to catch a regression in a no-JS fallback specifically, the
 * documented-but-previously-untested promise in AGENTS.md's "Web components"
 * section. Broader coverage (JS-on behaviour, visual regression, a11y audits)
 * is tracked separately and does not belong in this file.
 */
import { expect, test } from '@playwright/test';

test.describe('no-JS fallback: elements.js never loads at all', () => {
  test('a page with webComponents on requests no script from the bundle', async ({ page }) => {
    // The strongest proof scripting is genuinely off, not merely unused: with
    // scripting disabled, the browser never processes a <script> element, so
    // it never issues the request in the first place — this would fail
    // exactly as loudly if `javaScriptEnabled: false` stopped doing what it
    // says.
    //
    // `polyfills.js` is excluded on purpose, not overlooked: `<Head />` also
    // emits `<link rel="modulepreload" href=".../polyfills.js">` beside its
    // `<script>` tag, and a modulepreload hint is a resource hint processed at
    // parse time — it still fires with scripting off, same as `<link
    // rel="stylesheet">` would. `elements.js` and `deferred.js` carry no such
    // hint, so they are the ones that prove the point.
    const scriptRequests: string[] = [];
    page.on('request', (req) => {
      if (/\.(js)(\?|$)/.test(req.url())) scriptRequests.push(req.url());
    });
    await page.goto('/patterns');
    expect(scriptRequests.filter((u) => /elements\.js|deferred\.js/.test(u))).toEqual([]);
  });
});

test.describe('<wc-carousel> fallback', () => {
  test('renders the real slides as a scrollable strip', async ({ page }) => {
    await page.goto('/patterns');
    const track = page.locator('wc-carousel .carousel__track').first();
    await expect(track).toBeVisible();
    // The SSR'd content itself, not an empty shell waiting on JS to fill it.
    await expect(track.locator('li.card')).toHaveCount(3);
    await expect(track.locator('li.card').nth(0)).toContainText('One');
  });

  test('the Astro <Carousel /> wrapper emits a track that is Tab-focusable', async ({ page }) => {
    // `Carousel.astro` puts `tabindex="0"` on its track so arrow keys scroll it
    // with no JS — the hand-authored <wc-carousel /> above this one on the page
    // doesn't set it itself, so this checks the wrapper's own contract instead.
    await page.goto('/patterns');
    const track = page.locator('wc-carousel .carousel__track[tabindex="0"]').first();
    await expect(track).toBeVisible();
    await expect(track.locator('li.carousel__slide')).toHaveCount(3);
  });
});

test.describe('<wc-gallery> fallback', () => {
  test('a thumbnail click reveals the dialog on the CORRECT slide', async ({ page }) => {
    // The whole point of the rebuild: no Invoker Commands, no polyfill — a
    // plain `<a href="#slide-id">` plus `:has(:target)` in lightbox.css. Not
    // just "the dialog opens" (which a stale `:target` from a prior state could
    // fake), but that it opens on the image that was actually clicked — the
    // previous per-dialog design's fallback had no way to express "which one"
    // at all without JS.
    await page.goto('/patterns');
    await page.locator('.gallery__trigger[href="#pt-gal-wide"]').click();
    const dialog = page.locator('dialog.lightbox-dialog').first();
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('#pt-gal-wide')).toBeInViewport();
    // Prev/next is the nested carousel's — real fallback `<button>`s only exist
    // once `WCCarousel` builds them, which needs JS; native `::scroll-button()`
    // needs none but is a pseudo-element, unqueryable here. Neither path is
    // assertable from this project without conflating the two, so what this
    // test pins is the one thing that genuinely regressed before: which slide
    // a no-JS click lands on.
  });
});

test.describe('<wc-entries> fallback', () => {
  test('renders semantic heading + definition-list pairs, not a table', async ({ page }) => {
    await page.goto('/patterns');
    const entries = page.locator('wc-entries').first();
    await expect(entries.locator('h4').first()).toHaveText('css');
    const firstDl = entries.locator('dl').first();
    await expect(firstDl.locator('dt').first()).toHaveText('Emits');
    await expect(firstDl.locator('dd').first()).toHaveText('styles.css');
    // The enhancement this element would apply with JS on. Its absence is the
    // point: this is what "the exemplar for the whole tier" means.
    await expect(page.locator('wc-entries table')).toHaveCount(0);
  });
});

test.describe('<wc-image-compare> fallback', () => {
  test('shows the "after" image, per its own documented no-JS behaviour', async ({ page }) => {
    await page.goto('/patterns');
    const compare = page.locator('wc-image-compare').first();
    await expect(compare.locator('img[slot="after"]')).toBeVisible();
  });
});

test.describe('<wc-tree> fallback', () => {
  test('a closed branch opens on a real click on its <summary> — native disclosure, no JS', async ({
    page,
  }) => {
    await page.goto('/reference/config');
    // openDepth defaults to 0 on this page, so every branch starts closed.
    const branch = page.locator('.tree__item details').first();
    expect(await branch.getAttribute('open')).toBeNull();
    await branch.locator('summary').first().click();
    expect(await branch.getAttribute('open')).not.toBeNull();
  });
});
