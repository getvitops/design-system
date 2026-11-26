/**
 * `<wc-entries>` layout in a real browser. Its enhanced-state stylesheet was lost in the move to
 * `@getvitops/core`, so an upgraded element showed the stacked pairs AND the generated table at
 * every width: duplicate content, and a breakpoint that did nothing. happy-dom has no CSS, so this
 * is the only place the layout can be asserted.
 */
import { expect, test, type Page } from '@playwright/test';

const entries = (page: Page) => page.locator('#pt-entries');

/** Is the element on screen: takes up space and is not clipped to a 1px box. */
async function onScreen(page: Page, selector: string) {
  return entries(page)
    .locator(selector)
    .first()
    .evaluate((el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return s.display !== 'none' && r.width > 4 && r.height > 4;
    });
}

test.describe('<wc-entries>', () => {
  test('wide: the table is shown and the <dl> is visually hidden, not display:none', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto('/patterns');
    await expect(entries(page)).toHaveClass(/entries--wide/);

    expect(await onScreen(page, 'table.entries__table')).toBe(true);
    expect(await onScreen(page, ':scope > dl')).toBe(false);
    // Still in the accessibility tree: that is the one a screen reader reads.
    expect(
      await entries(page)
        .locator(':scope > dl')
        .first()
        .evaluate((el) => getComputedStyle(el).display),
    ).not.toBe('none');
    await expect(entries(page).locator('table.entries__table')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });

  test('narrow: the stacked pairs show and the table does not', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/patterns');
    await expect(entries(page)).not.toHaveClass(/entries--wide/);

    expect(await onScreen(page, ':scope > dl')).toBe(true);
    expect(await onScreen(page, 'table.entries__table')).toBe(false);
  });

  test('crossing the breakpoint switches view with no duplicate content on screen', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto('/patterns');
    await expect(entries(page)).toHaveClass(/entries--wide/);
    await page.setViewportSize({ width: 360, height: 800 });
    await expect(entries(page)).not.toHaveClass(/entries--wide/);
    const visibleViews = [
      await onScreen(page, ':scope > dl'),
      await onScreen(page, 'table.entries__table'),
    ].filter(Boolean);
    expect(visibleViews).toHaveLength(1);
  });
  test('projection: a column picked from the nav stops beside the sticky row titles, not under them', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/components/elements');
    const el = page.locator('wc-entries.entries--projection').first();
    await expect(el).not.toHaveClass(/entries--wide/);
    await el.scrollIntoViewIfNeeded();
    await el.locator('.entries__nav-btn').last().click();
    // Smooth scrolling: wait until the scroll position settles.
    await page.waitForTimeout(800);
    const { stickyRight, thLeft } = await el.evaluate((host) => {
      const ths = host.querySelectorAll<HTMLElement>('.entries__table thead th');
      return {
        stickyRight: ths[0]!.getBoundingClientRect().right,
        thLeft: ths[ths.length - 1]!.getBoundingClientRect().left,
      };
    });
    expect(thLeft).toBeGreaterThanOrEqual(stickyRight - 1);
  });
});
