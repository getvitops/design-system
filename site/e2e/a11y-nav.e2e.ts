/**
 * Navigation and page-level behaviour that only a real browser can show: that tabbing through the
 * site nav does not spring its submenus open, and that a visitor who asked for reduced motion still
 * lands below a pinned masthead.
 */
import { expect, test, type Page } from '@playwright/test';

const url = (variant: string) => `/demo/masthead/${variant}/`;

test.describe('site nav submenus at width', () => {
  test.use({ viewport: { width: 1400, height: 800 } });

  // `:visible`: the demo also renders the mobile-tier menu, whose branches are display:none here.
  const branch = (page: Page) => page.locator('.sitenav__item--branch:visible').first();
  const submenu = (page: Page) => branch(page).locator(':scope > .sitenav__submenu');

  test('tabbing onto a top-level link does not open its submenu', async ({ page }) => {
    await page.goto(url('mega'));
    await branch(page).locator(':scope > a').first().focus();
    // Wait out the 0.15s `visibility` transition first. It starts from `hidden`, so a poll taken
    // straight after focus sees the start value and would pass even while the menu is opening.
    await page.waitForTimeout(400);
    // `:focus-within` used to reveal it here, and every submenu link became a Tab stop.
    await expect(submenu(page)).toHaveCSS('visibility', 'hidden');
  });

  test('the caret is the keyboard path: Enter opens it, and it stays open for the links inside', async ({
    page,
  }) => {
    await page.goto(url('mega'));
    await branch(page).locator(':scope > a').first().focus();
    await page.keyboard.press('Tab'); // onto the caret disclosure
    await page.waitForTimeout(400); // see above: let the visibility transition settle
    await expect(submenu(page)).toHaveCSS('visibility', 'hidden');
    await page.keyboard.press('Enter');
    await expect(submenu(page)).toHaveCSS('visibility', 'visible');
    // Moving focus into the submenu keeps it open (it is pinned by [open], not by hover).
    await page.keyboard.press('Tab');
    await expect(submenu(page)).toHaveCSS('visibility', 'visible');
  });

  test('hover still previews the submenu', async ({ page }) => {
    await page.goto(url('mega'));
    await branch(page).locator(':scope > a').first().hover();
    await expect(submenu(page)).toHaveCSS('visibility', 'visible');
  });
});

test.describe('reduced motion', () => {
  test('anchor jumps still clear a pinned masthead', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(url('sticky-glass'));
    // The padding is what keeps the target out from under the bar. It used to live inside the
    // `no-preference` query, so a visitor who asked for less motion landed under it.
    const padding = await page.evaluate(
      () => getComputedStyle(document.documentElement).scrollPaddingBlockStart,
    );
    expect(padding).not.toBe('auto');
    expect(parseFloat(padding)).toBeGreaterThan(0);

    await page.evaluate(() => location.assign('#anchor-target'));
    await page.waitForTimeout(200);
    const [barBottom, targetTop] = await Promise.all([
      page.locator('header.masthead').evaluate((el) => el.getBoundingClientRect().bottom),
      page.locator('#anchor-target').evaluate((el) => el.getBoundingClientRect().top),
    ]);
    expect(targetTop).toBeGreaterThanOrEqual(barBottom - 1);
  });

  test('smooth scrolling is still off for those visitors', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(url('sticky-glass'));
    await expect(page.locator('html')).toHaveCSS('scroll-behavior', 'auto');
  });

  test('and on for everyone else', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto(url('sticky-glass'));
    await expect(page.locator('html')).toHaveCSS('scroll-behavior', 'smooth');
  });
});
