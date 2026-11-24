/**
 * Notifications in a real browser: they stack in one labelled top-layer region, announce through a
 * live region, pause while hovered, wait behind a modal dialog, never take focus, close with the
 * keyboard, and stay readable at 320 px and 200% text.
 */
import { expect, test } from '@playwright/test';

const region = (page: import('@playwright/test').Page) => page.locator('wc-notifications');

test.describe('notifications', () => {
  test('a server message is adopted into a labelled region in the top layer', async ({ page }) => {
    await page.goto('/patterns');
    await expect(region(page)).toHaveAttribute('role', 'region');
    await expect(region(page)).toHaveAttribute('aria-label', 'Notifications');
    await expect(region(page).locator('.notification')).toHaveCount(1);
    await expect(region(page).locator('[data-notification-close]')).toHaveCount(1);
    expect(await region(page).evaluate((el) => el.matches(':popover-open'))).toBe(true);
  });

  test('show() stacks and does not take focus', async ({ page }) => {
    await page.goto('/patterns');
    const trigger = page.locator('#pt-notify-persist');
    await trigger.scrollIntoViewIfNeeded();
    await trigger.focus();
    await trigger.click();
    await expect(region(page).locator('.notification')).toHaveCount(2);
    await expect(trigger).toBeFocused();
  });

  test('announces the visible text through the shared live region where ariaNotify is absent', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(Element.prototype, 'ariaNotify', {
        value: undefined,
        configurable: true,
      });
    });
    await page.goto('/patterns');
    await page.locator('#pt-notify-persist').click();
    await expect(page.locator('[data-wc-announcer]')).toHaveText('Saved. Your draft is safe.');
  });

  test('uses ariaNotify() where the browser has it', async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __said: string[] }).__said = [];
      Object.defineProperty(Element.prototype, 'ariaNotify', {
        value(message: string) {
          (window as unknown as { __said: string[] }).__said.push(message);
        },
        configurable: true,
      });
    });
    await page.goto('/patterns');
    await page.locator('#pt-notify-persist').click();
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __said: string[] }).__said))
      .toEqual(['Saved. Your draft is safe.']);
  });

  test('a timed one closes itself, and holds while the pointer is on it', async ({ page }) => {
    await page.goto('/patterns');
    await page.locator('#pt-notify-timed').scrollIntoViewIfNeeded();
    // Shorten the wait: ask for a 1.5 s one through the document event.
    await page.evaluate(() =>
      document.dispatchEvent(
        new CustomEvent('vitops:notify', { detail: { message: 'Quick', duration: 1500 } }),
      ),
    );
    const quick = region(page).locator('.notification', { hasText: 'Quick' });
    await expect(quick).toHaveCount(1);
    await quick.hover();
    await page.waitForTimeout(2500);
    await expect(quick).toHaveCount(1);
    await page.mouse.move(0, 0);
    await expect(quick).toHaveCount(0, { timeout: 4000 });
  });

  test('Close removes it with the keyboard, and focus moves on rather than to the page', async ({
    page,
  }) => {
    await page.goto('/patterns');
    await page.evaluate(() => {
      for (const message of ['First', 'Second']) {
        document.dispatchEvent(new CustomEvent('vitops:notify', { detail: { message } }));
      }
    });
    const first = region(page).locator('.notification', { hasText: 'First' });
    await first.locator('[data-notification-close]').focus();
    await page.keyboard.press('Enter');
    await expect(first).toHaveCount(0);
    const focusedInside = await page.evaluate(() =>
      document.querySelector('wc-notifications')?.contains(document.activeElement),
    );
    expect(focusedInside).toBe(true);
  });

  test('waits behind a modal dialog and appears when it closes', async ({ page }) => {
    await page.goto('/patterns');
    const before = await region(page).locator('.notification').count();
    await page.locator('#pt-notify-modal').scrollIntoViewIfNeeded();
    await page.locator('#pt-notify-modal').click();
    await expect(page.locator('#pt-notify-dialog')).toBeVisible();
    await expect(region(page).locator('.notification')).toHaveCount(before);
    await page.locator('#pt-notify-dialog-close').click();
    await expect(region(page).locator('.notification')).toHaveCount(before + 1);
  });

  test('a tone sets the surface and keeps it readable', async ({ page }) => {
    await page.goto('/patterns');
    await page.locator('#pt-notify-persist').click();
    const colours = await region(page)
      .locator('.notification[data-tone="success"]')
      .evaluate((el) => {
        const cs = getComputedStyle(el);
        return { bg: cs.backgroundColor, fg: cs.color, border: cs.borderInlineStartWidth };
      });
    expect(colours.bg).not.toBe('rgba(0, 0, 0, 0)');
    expect(colours.bg).not.toBe(colours.fg);
    expect(colours.border).toBe('4px');
  });
});

test.describe('notifications at small sizes and with less motion', () => {
  test('reflow at 320 px with the text zoomed to 200%, with nothing clipped', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 256 });
    await page.goto('/patterns');
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    await page.evaluate(() =>
      document.dispatchEvent(
        new CustomEvent('vitops:notify', {
          detail: {
            title: 'A title long enough to wrap',
            message: 'And a message that is long enough that it has to wrap at this width too.',
            actions: [{ label: 'Undo' }],
          },
        }),
      ),
    );
    const box = await region(page).evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right, width: r.width, vw: innerWidth };
    });
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(box.vw);
    const overflow = await region(page)
      .locator('.notification__content')
      .last()
      .evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('with reduced motion, there is no entry animation and it goes at once', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/patterns');
    await page.evaluate(() =>
      document.dispatchEvent(new CustomEvent('vitops:notify', { detail: { message: 'Calm' } })),
    );
    const item = region(page).locator('.notification', { hasText: 'Calm' });
    expect(await item.evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
    await item.locator('[data-notification-close]').click();
    await expect(item).toHaveCount(0, { timeout: 500 });
  });
});
