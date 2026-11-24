/**
 * Overlays, in a real browser: the keyboard path through `<Drawer>`, and what its dialog
 * announces. Screen-reader speech itself cannot be asserted here; what can be is the accessibility
 * tree a screen reader reads from (role and name), which is where the unnamed-dialog defect lived.
 */
import { expect, test } from '@playwright/test';

test.describe('<Drawer> component', () => {
  test('opens by keyboard, is a named modal dialog, and closes from its own button', async ({
    page,
  }) => {
    await page.goto('/patterns');
    const trigger = page.getByRole('button', { name: 'Drawer component' });
    await trigger.focus();
    await page.keyboard.press('Enter');

    // Named by `label`, not left as an anonymous "dialog".
    const dialog = page.getByRole('dialog', { name: 'Example drawer' });
    await expect(dialog).toBeVisible();

    // The built-in close control exists, has a name, is a real target size, and holds focus first.
    const close = dialog.getByRole('button', { name: 'Close' });
    await expect(close).toBeVisible();
    await expect(close).toBeFocused();
    const box = await close.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);

    await page.keyboard.press('Enter');
    await expect(dialog).toBeHidden();
    // Focus returns to the trigger that opened it.
    await expect(trigger).toBeFocused();
  });

  test('still closes with Escape', async ({ page }) => {
    await page.goto('/patterns');
    await page.getByRole('button', { name: 'Drawer component' }).click();
    const dialog = page.getByRole('dialog', { name: 'Example drawer' });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });
});

test.describe('popover polyfill class', () => {
  test.use({ viewport: { width: 700, height: 800 } });

  test('a popover marked with the polyfill class takes its open-state styling', async ({
    page,
  }) => {
    // The Popover polyfill cannot define `:popover-open`; it marks an open popover with the class
    // `.\:popover-open`. An engine without the pseudo-class drops any rule that names it bare, so
    // every open-state rule is written `:is(:popover-open, .\:popover-open)`. Chromium has the
    // pseudo-class, so the class path is the half to prove here: apply it by hand to a CLOSED
    // popover and the open-state rule must win.
    await page.goto('/demo/masthead/mega/');
    const panel = page.locator('.sitenav__panel').first();
    await expect(panel).toHaveCSS('opacity', '0');
    await panel.evaluate((el) => el.classList.add(':popover-open'));
    // Past the 0.15s transition: it starts from the closed value.
    await expect(panel).toHaveCSS('opacity', '1');
    await expect(panel).toHaveCSS('translate', /^(0px|0px 0px|none)$/);
  });
});
