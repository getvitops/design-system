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

test.describe('<wc-tabs> fallback', () => {
  test('every panel is readable, in order, under its own heading, with no tablist', async ({
    page,
  }) => {
    await page.goto('/patterns');
    const tabs = page.locator('#pt-tabs');
    await expect(tabs.locator('[role="tablist"]')).toHaveCount(0);
    const sections = tabs.locator(':scope > section');
    await expect(sections).toHaveCount(3);
    for (let i = 0; i < 3; i++) {
      await expect(sections.nth(i)).toBeVisible();
      await expect(sections.nth(i).locator('h3')).toBeVisible();
    }
    await expect(sections.nth(1)).toContainText('Free to run');
  });

  test('a #fragment still lands on its panel', async ({ page }) => {
    await page.goto('/patterns#pt-tab-support');
    await expect(page.locator('#pt-tab-support')).toBeInViewport();
  });
});

test.describe('<wc-combobox> fallback', () => {
  test('is a native input with a datalist the browser can suggest from', async ({ page }) => {
    await page.goto('/patterns');
    const input = page.locator('#pt-city');
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute('list', 'pt-city-options');
    await expect(page.locator('#pt-city-options option')).toHaveCount(5);
    await expect(page.locator('#pt-city-options option[value="MTL"]')).toHaveAttribute(
      'label',
      'Montréal',
    );
    await expect(input).not.toHaveAttribute('role', 'combobox');
  });

  test('typed text is what is submitted, matching an option or not', async ({ page }) => {
    await page.goto('/patterns');
    await page.locator('#pt-city').fill('Peterborough');
    await expect(page.locator('#pt-city')).toHaveValue('Peterborough');
  });
});

test.describe('<wc-range> fallback', () => {
  test('two real, labelled sliders that both submit, with no track overlay', async ({ page }) => {
    await page.goto('/patterns');
    const range = page.locator('#pt-range');
    await expect(range.locator('input[type="range"]')).toHaveCount(2);
    await expect(range.getByRole('slider', { name: 'Minimum price' })).toBeVisible();
    await expect(range.getByRole('slider', { name: 'Maximum price' })).toBeVisible();
    await expect(range.locator('.range__track')).toHaveCount(0);
    await expect(range.locator('input[name="min"]')).toHaveValue('200');
    await expect(range.locator('input[name="max"]')).toHaveValue('800');
  });
});

test.describe('<wc-field> fallback', () => {
  test('a nested label names its control and focuses it on click, with no id/for', async ({
    page,
  }) => {
    await page.goto('/patterns');
    const input = page.locator('#pt-field-email input');
    await expect(page.locator('#pt-field-email').getByLabel('Email')).toHaveAttribute(
      'name',
      'email',
    );
    await expect(page.locator('#pt-field-email label[for]')).toHaveCount(0);
    await page.locator('#pt-field-email .field__label').click();
    await expect(input).toBeFocused();
  });

  test('adds nothing the markup did not carry: no counter, no wiring, no error text', async ({
    page,
  }) => {
    await page.goto('/patterns');
    await expect(page.locator('#pt-field-bio .field__counter')).toHaveCount(0);
    await expect(page.locator('#pt-field-email input')).not.toHaveAttribute(
      'aria-describedby',
      /.+/,
    );
    await expect(page.locator('#pt-field-email .field__error')).toHaveText('');
    await expect(page.locator('#pt-field-email .field__error')).toBeHidden();
  });

  test('a server-rendered error is on the page, directly under its control', async ({ page }) => {
    await page.goto('/patterns');
    const error = page.locator('#pt-field-phone .field__error');
    await expect(error).toBeVisible();
    await expect(error).toHaveText('That doesn’t look like a phone number.');
  });

  test('the browser still validates a required field on submit', async ({ page }) => {
    await page.goto('/patterns');
    const valid = await page
      .locator('#pt-field-email input')
      .evaluate((el) => (el as HTMLInputElement).checkValidity());
    expect(valid).toBe(false);
  });
});

test.describe('<wc-config-form> fallback', () => {
  test('is a complete form of named, labelled controls the server can parse', async ({ page }) => {
    await page.goto('/patterns');
    const form = page.locator('#pt-config-form');
    // Scoped by name: the locations rows have an Email and a Phone of their own.
    await expect(form.locator('[name="organization.email"]')).toBeVisible();
    await expect(form.getByLabel('Email').first()).toHaveAttribute('name', 'organization.email');
    await expect(form.getByLabel('Phone').first()).toHaveAttribute('name', 'organization.phone');
    await expect(form.locator('[name="organization.address.addressLocality"]')).toBeVisible();
    await expect(form.getByRole('button', { name: 'Save' })).toBeVisible();
  });

  test('offers one blank keyed row per map, and nothing that needs script to appear', async ({
    page,
  }) => {
    await page.goto('/patterns');
    // The locations step has two keyed maps: locations and services.
    await expect(page.locator('#pt-config-form .field__row')).toHaveCount(2);
    await expect(page.locator('#pt-config-form .field__row[data-blank]')).toHaveCount(2);
    // No script: the output stays empty and no field shows an error.
    await expect(page.locator('#pt-config-out')).toHaveText('');
    await expect(page.locator('#pt-config-form wc-field[data-invalid]')).toHaveCount(0);
  });

  test('loads no config-form bundle', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (req) => requests.push(req.url()));
    await page.goto('/patterns');
    expect(requests.filter((url) => /config-form/.test(url))).toEqual([]);
  });
});

test.describe('<wc-stepper> fallback', () => {
  test('is the whole form: every section visible, in order, with working anchors', async ({
    page,
  }) => {
    await page.goto('/patterns');
    const stepper = page.locator('wc-stepper');
    for (const id of ['pt-step-who', 'pt-step-where', 'pt-step-done']) {
      await expect(stepper.locator(`#${id}`)).toBeVisible();
    }
    // No script, so no Back/Next buttons and no current step: the links just jump down the form.
    await expect(stepper.getByRole('button', { name: 'Next' })).toHaveCount(0);
    await expect(stepper.locator('[aria-current]')).toHaveCount(0);
    await stepper.getByRole('link', { name: 'Done' }).click();
    await expect(page).toHaveURL(/#pt-step-done$/);
    await expect(stepper.getByRole('button', { name: 'Finish' })).toBeVisible();
  });

  test('loads no stepper bundle', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (req) => requests.push(req.url()));
    await page.goto('/patterns');
    expect(requests.filter((url) => /stepper/.test(url))).toEqual([]);
  });
});

test.describe('<wc-format> fallback', () => {
  test('shows the text the server wrote, over a real machine-readable <time>', async ({ page }) => {
    await page.goto('/patterns');
    const time = page.locator('#pt-format time');
    await expect(time).toHaveText('November 3, 2026');
    await expect(time).toHaveAttribute('datetime', '2026-11-03T14:05:00Z');
  });
});

test.describe('<Breadcrumbs>', () => {
  test('is a labelled list whose last item is the current page, not a link', async ({ page }) => {
    await page.goto('/patterns');
    const nav = page.locator('#pt-breadcrumbs');
    await expect(nav).toHaveAttribute('aria-label', 'Breadcrumb');
    await expect(nav.locator('li')).toHaveCount(3);
    await expect(nav.locator('li').last().locator('[aria-current="page"]')).toHaveText('Patterns');
    await expect(nav.locator('li').last().locator('a')).toHaveCount(0);
    await expect(nav.locator('li').first().locator('a')).toHaveAttribute('href', '/');
  });
});
