/**
 * Tooltips in a real browser (WCAG 1.4.13): opens on hover and on keyboard focus, closes on
 * Escape without moving, stays open while the pointer is on the tooltip itself, and each trigger
 * has its own anchor so two tooltips do not stack on one trigger.
 */
import { expect, test } from '@playwright/test';

const open = (page: import('@playwright/test').Page, id: string) =>
  page.evaluate((i) => document.getElementById(i)!.matches(':popover-open'), id);

test.describe('tooltip', () => {
  test('opens on hover and closes when the pointer leaves', async ({ page }) => {
    await page.goto('/patterns');
    const trigger = page.locator('#pt-tip-trigger');
    await trigger.scrollIntoViewIfNeeded();
    await trigger.hover();
    await expect.poll(() => open(page, 'pt-tip')).toBe(true);
    await page.mouse.move(0, 0);
    await expect.poll(() => open(page, 'pt-tip')).toBe(false);
  });

  test('is described by its text and has the tooltip role', async ({ page }) => {
    await page.goto('/patterns');
    await page.locator('#pt-tip-trigger').hover();
    await expect(page.locator('#pt-tip')).toHaveAttribute('role', 'tooltip');
    await expect(page.locator('#pt-tip-trigger')).toHaveAttribute('aria-describedby', 'pt-tip');
  });

  test('opens on keyboard focus and Escape closes it while focus stays put', async ({ page }) => {
    await page.goto('/patterns');
    const trigger = page.locator('#pt-tip-trigger');
    await trigger.scrollIntoViewIfNeeded();
    await page.keyboard.press('Tab'); // enter the document so :focus-visible applies
    await trigger.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect.poll(() => open(page, 'pt-tip')).toBe(true);
    await page.keyboard.press('Escape');
    await expect.poll(() => open(page, 'pt-tip')).toBe(false);
    await expect(trigger).toBeFocused();
  });

  test('stays open while the pointer travels onto the tooltip', async ({ page }) => {
    await page.goto('/patterns');
    const trigger = page.locator('#pt-tip-trigger');
    await trigger.scrollIntoViewIfNeeded();
    await trigger.hover();
    await expect.poll(() => open(page, 'pt-tip')).toBe(true);
    const box = (await page.locator('#pt-tip').boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 8 });
    await page.waitForTimeout(400);
    expect(await open(page, 'pt-tip')).toBe(true);
  });

  test('two tooltips use two anchors', async ({ page }) => {
    await page.goto('/patterns');
    await page.locator('#pt-tip-trigger').hover();
    await page.mouse.move(0, 0);
    await page.locator('#pt-tip2-trigger').hover();
    const names = await page.evaluate(() => [
      document.getElementById('pt-tip-trigger')!.style.getPropertyValue('anchor-name'),
      document.getElementById('pt-tip2-trigger')!.style.getPropertyValue('anchor-name'),
    ]);
    expect(names[0]).not.toBe('');
    expect(names[1]).not.toBe('');
    expect(names[0]).not.toBe(names[1]);
  });
});
