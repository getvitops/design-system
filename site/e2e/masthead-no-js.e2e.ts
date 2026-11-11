/**
 * The masthead is tier 1: scripting off must change nothing about it. The hamburger is a Popover
 * API invoker and hide-on-scroll is CSS, so both work with no script (see `playwright.config.ts`).
 */
import { expect, test } from '@playwright/test';

test('hide-on-scroll still hides with JavaScript disabled', async ({ page }) => {
  await page.goto('/demo/masthead/hide-on-scroll/');
  const bar = page.locator('header.masthead');
  await page.mouse.move(700, 500);
  await page.mouse.wheel(0, 700);
  await page.waitForTimeout(500);
  await expect(bar).not.toHaveCSS('translate', 'none');
});

test('the compact toggle opens its panel with no script', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 700 });
  await page.goto('/demo/masthead/dropdown/');
  await page.locator('.sitenav__toggle').first().click();
  await expect(page.locator('.sitenav__panel:popover-open')).toBeVisible();
});
