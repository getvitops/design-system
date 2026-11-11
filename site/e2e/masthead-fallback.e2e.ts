/**
 * A browser without `scroll-state()` (Firefox, today) must get the *settled* masthead: solid,
 * elevated, always visible. The `*-on-scroll` modifiers used to be written base-hidden with the
 * query revealing, so an unsupporting browser kept a transparent bar over body text forever.
 * Run in Firefox (see `playwright.config.ts`); in a browser that does support the query these
 * assertions are about the settled state too, so they hold there as well.
 */
import { expect, test, type Page } from '@playwright/test';

const bar = (page: Page) => page.locator('header.masthead');

async function scrollBy(page: Page, dy: number) {
  await page.mouse.move(700, 500);
  await page.mouse.wheel(0, dy);
  await page.waitForTimeout(500);
}

test('transparent-until-scrolled is never transparent without scroll-state()', async ({ page }) => {
  await page.goto('/demo/masthead/transparent-hero/');
  const supported = await page.evaluate(() => CSS.supports('container-type', 'scroll-state'));
  test.skip(supported, 'this browser supports scroll-state(); the Chromium project covers it');
  await expect(bar(page)).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await scrollBy(page, 600);
  await expect(bar(page)).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
});

test('shadow-on-scroll keeps its shadow without scroll-state()', async ({ page }) => {
  await page.goto('/demo/masthead/sticky-glass/');
  const supported = await page.evaluate(() => CSS.supports('container-type', 'scroll-state'));
  test.skip(supported, 'this browser supports scroll-state(); the Chromium project covers it');
  await expect(bar(page)).not.toHaveCSS('box-shadow', 'none');
});

test('hide-on-scroll never hides the bar without scroll-state()', async ({ page }) => {
  await page.goto('/demo/masthead/hide-on-scroll/');
  await scrollBy(page, 700);
  await expect(bar(page)).toHaveCSS('translate', 'none');
});
