/**
 * `site.chrome` in a real browser. The pure mapping (config → classes) is unit-tested in
 * `@getvitops/astro`; what only a browser can say is whether the CSS then does what the class
 * names promise: a bar that slides away on scroll down and returns on scroll up, elevation that
 * waits for the page to scroll, an offset that keeps anchors visible, panels that open.
 */
import { expect, test, type Page } from '@playwright/test';

const url = (variant: string) => `/demo/masthead/${variant}/`;
const bar = (page: Page) => page.locator('header.masthead');

async function scrollBy(page: Page, dy: number) {
  await page.mouse.move(700, 500);
  await page.mouse.wheel(0, dy);
  await page.waitForTimeout(500); // the 0.25s transition, plus a frame
}

test.describe('hide-on-scroll', () => {
  test('slides away scrolling down and returns scrolling up', async ({ page }) => {
    await page.goto(url('hide-on-scroll'));
    await expect(bar(page)).toHaveCSS('translate', 'none');

    await scrollBy(page, 700);
    await expect(bar(page)).not.toHaveCSS('translate', 'none');
    expect(await bar(page).evaluate((el) => el.getBoundingClientRect().bottom)).toBeLessThanOrEqual(
      0,
    );

    await scrollBy(page, -200);
    await expect(bar(page)).toHaveCSS('translate', 'none');
    expect(await bar(page).evaluate((el) => el.getBoundingClientRect().top)).toBeGreaterThanOrEqual(
      0,
    );
  });

  test('stays on screen while focus is inside it', async ({ page }) => {
    await page.goto(url('hide-on-scroll'));
    await page.getByRole('link', { name: 'Get in touch' }).focus();
    await scrollBy(page, 700);
    await expect(bar(page)).toHaveCSS('translate', 'none');
  });
});

test.describe('elevation and surface follow the scroll position', () => {
  test('sticky-glass has no shadow at the top and gains it once scrolled', async ({ page }) => {
    await page.goto(url('sticky-glass'));
    await expect(bar(page)).toHaveCSS('box-shadow', 'none');
    await scrollBy(page, 400);
    await expect(bar(page)).not.toHaveCSS('box-shadow', 'none');
    await scrollBy(page, -2000);
    await expect(bar(page)).toHaveCSS('box-shadow', 'none');
  });

  test('transparent-until-scrolled is clear over the hero, then solid', async ({ page }) => {
    await page.goto(url('transparent-hero'));
    await expect(bar(page)).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await scrollBy(page, 600);
    await expect(bar(page)).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  });

  test('a fixed masthead overlays the page instead of pushing it down', async ({ page }) => {
    await page.goto(url('transparent-hero'));
    await expect(bar(page)).toHaveCSS('position', 'fixed');
    const heroTop = await page
      .locator('section')
      .first()
      .evaluate((el) => el.getBoundingClientRect().top);
    expect(heroTop).toBe(0);
  });
});

test.describe('layout', () => {
  test('floating is inset from the viewport edges with a radius', async ({ page }) => {
    await page.goto(url('floating'));
    const box = await bar(page).evaluate((el) => {
      const r = el.getBoundingClientRect();
      return {
        left: r.left,
        right: document.documentElement.clientWidth - r.right,
        radius: getComputedStyle(el).borderRadius,
      };
    });
    expect(box.left).toBeGreaterThan(0);
    expect(box.right).toBeGreaterThan(0);
    expect(box.radius).not.toBe('0px');
  });
});

test.describe('configured size', () => {
  const rem = (page: Page) =>
    page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));

  test('inset and height from site.chrome set the real gap and row height', async ({ page }) => {
    await page.goto(url('floating'));
    const px = await rem(page);
    const m = await bar(page).evaluate((el) => {
      const r = el.getBoundingClientRect();
      // Measured to `body`, not the viewport: `html { scrollbar-gutter: stable }` reserves the scrollbar's
      // column on the right, so the viewport edge is further away than the page edge.
      return {
        left: r.left,
        right: document.body.getBoundingClientRect().right - r.right,
        top: r.top,
      };
    });
    expect(m.left).toBeCloseTo(1.5 * px, 0); // inset: 1.5rem
    expect(m.right).toBeCloseTo(1.5 * px, 0);
    const row = await page
      .locator('.masthead__row > .navbar')
      .evaluate((el) => el.getBoundingClientRect().height);
    expect(row).toBeGreaterThanOrEqual(5 * px - 1); // height: 5rem (min-block-size)
    expect(row).toBeLessThan(5 * px + 8);
  });

  test('--header-offset counts height and inset, so an anchor clears a floating bar', async ({
    page,
  }) => {
    await page.goto(url('floating'));
    await page.evaluate(() => location.assign('#anchor-target'));
    await page.waitForTimeout(300);
    const [barBottom, targetTop] = await Promise.all([
      bar(page).evaluate((el) => el.getBoundingClientRect().bottom),
      page.locator('#anchor-target').evaluate((el) => el.getBoundingClientRect().top),
    ]);
    expect(targetTop).toBeGreaterThanOrEqual(barBottom - 1);
  });

  test('a clamp() height and inset follow the container width', async ({ page }) => {
    const measure = async (width: number) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(url('fluid'));
      return page.evaluate(() => {
        const h = document.querySelector('header.masthead')!;
        return {
          left: h.getBoundingClientRect().left,
          row: h.querySelector('.navbar')!.getBoundingClientRect().height,
          // `cqi` resolves against the nearest size container: `body`, per layout.css.
          container: document.body.getBoundingClientRect().width,
          rem: parseFloat(getComputedStyle(document.documentElement).fontSize),
        };
      });
    };
    const clamp = (lo: number, v: number, hi: number) => Math.min(hi, Math.max(lo, v));
    for (const width of [500, 900, 1600]) {
      const m = await measure(width);
      // inset: clamp(0.5rem, 3cqi, 2rem) · height: clamp(3.5rem, 8cqi, 4.5rem)
      expect(m.left).toBeCloseTo(clamp(0.5 * m.rem, 0.03 * m.container, 2 * m.rem), 0);
      expect(m.row).toBeCloseTo(clamp(3.5 * m.rem, 0.08 * m.container, 4.5 * m.rem), 0);
    }
    // The two ends are different values, so this is the container driving it, not a constant.
    const [small, large] = [await measure(500), await measure(1600)];
    expect(large.left).toBeGreaterThan(small.left);
    expect(large.row).toBeGreaterThan(small.row);
  });
});

test.describe('anchors clear a pinned masthead', () => {
  test('--header-offset is set, and a jump lands below the bar', async ({ page }) => {
    await page.goto(url('sticky-glass'));
    const offset = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--header-offset').trim(),
    );
    expect(offset).not.toBe('');
    await page.evaluate(() => location.assign('#anchor-target'));
    await page.waitForTimeout(300);
    const [barBottom, targetTop] = await Promise.all([
      bar(page).evaluate((el) => el.getBoundingClientRect().bottom),
      page.locator('#anchor-target').evaluate((el) => el.getBoundingClientRect().top),
    ]);
    expect(targetTop).toBeGreaterThanOrEqual(barBottom - 1);
  });
});

test.describe('nav variants', () => {
  test('compact: dropdown opens an anchored panel, not an edge drawer', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 700 }); // below the xl breakpoint
    await page.goto(url('dropdown'));
    const toggle = page.locator('.sitenav__toggle').first();
    await expect(toggle).toBeVisible();
    await toggle.click();
    const panel = page.locator('.sitenav__panel:popover-open');
    await expect(panel).toBeVisible();
    const [p, t] = await Promise.all([
      panel.evaluate((el) => el.getBoundingClientRect()),
      toggle.evaluate((el) => el.getBoundingClientRect()),
    ]);
    expect(p.top).toBeGreaterThanOrEqual(t.bottom - 1); // under the toggle…
    expect(p.height).toBeLessThan(700); // …not a full-height drawer
    expect(p.width).toBeLessThan(800 - 8); // inset from the edges
  });

  test('mega: wide screens show columns with headings, the toggle is gone', async ({ page }) => {
    await page.goto(url('mega'));
    await expect(page.locator('.sitenav--mega')).toBeVisible();
    await expect(page.locator('.sitenav--mega > .sitenav__toggle')).toBeHidden();
    await page.getByRole('link', { name: 'Services' }).first().hover();
    const heading = page.locator('.sitenav--mega .sitenav__submenu .sitenav__submenu').first();
    await expect(heading).toBeVisible(); // third level is a column, not a fly-out
  });

  test('only one nav landmark is exposed at a time', async ({ page }) => {
    await page.goto(url('mega'));
    await expect(page.getByRole('navigation', { name: 'Primary' })).toHaveCount(1);
  });
});

test('a masthead is a plain <header> with no explicit role', async ({ page }) => {
  await page.goto(url('sticky-glass'));
  await expect(bar(page)).not.toHaveAttribute('role', /.*/);
});
