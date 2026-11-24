/**
 * Web-component lifecycle in a real browser: autoplay that stays paused, and elements that keep
 * working after the DOM moves them (a view-transition swap, a client router, a drag-and-drop
 * reorder all disconnect and reconnect an element without re-rendering it).
 */
import { expect, test, type Locator, type Page } from '@playwright/test';

/** Remove an element and put it back where it was, as a move does. */
async function move(locator: Locator) {
  await locator.evaluate((el) => {
    const parent = el.parentElement!;
    const next = el.nextSibling;
    el.remove();
    // Some elements add siblings of their own (`<wc-marquee>`'s pause button) and remove them when
    // disconnected, so the original neighbour may be gone by now.
    parent.insertBefore(el, next && next.parentNode === parent ? next : null);
  });
}

async function open(page: Page) {
  await page.goto('/patterns');
}

test.describe('<wc-carousel> autoplay', () => {
  const carousel = (page: Page) => page.locator('#pt-autoplay');
  const toggle = (page: Page) => carousel(page).locator('.carousel__autoplay');
  /** Which real slide is nearest the track's centre: moves as autoplay advances. */
  const position = (page: Page) =>
    carousel(page)
      .locator('.carousel__track')
      .evaluate((el) => Math.round((el as HTMLElement).scrollLeft));

  test('plays on its own and offers Pause, without an aria-pressed on top of the name', async ({
    page,
  }) => {
    await open(page);
    await carousel(page).scrollIntoViewIfNeeded();
    await expect(toggle(page)).toHaveAttribute('aria-label', 'Pause');
    await expect(toggle(page)).not.toHaveAttribute('aria-pressed', /.*/);
    const before = await position(page);
    await expect.poll(() => position(page), { timeout: 6000 }).not.toBe(before);
  });

  test('Pause stays paused through the pointer leaving, and only Play resumes it', async ({
    page,
  }) => {
    await open(page);
    await carousel(page).scrollIntoViewIfNeeded();
    // Hover first, as a visitor reaching for the button does, so the pointer is "inside".
    await toggle(page).hover();
    await toggle(page).click();
    await expect(toggle(page)).toHaveAttribute('aria-label', 'Play');

    // Leaving used to restart autoplay, undoing the press.
    await page.mouse.move(5, 5);
    await expect(toggle(page)).toHaveAttribute('aria-label', 'Play');
    const held = await position(page);
    await page.waitForTimeout(3500); // more than two autoplay intervals
    expect(await position(page)).toBe(held);

    await toggle(page).click();
    await expect(toggle(page)).toHaveAttribute('aria-label', 'Pause');
    // Pressing Play with the pointer still over the carousel leaves it held (hover is a hold);
    // it runs once the pointer leaves.
    await page.mouse.move(5, 5);
    await expect.poll(() => position(page), { timeout: 6000 }).not.toBe(held);
  });

  test('hovering holds it without flipping the button', async ({ page }) => {
    await open(page);
    await carousel(page).scrollIntoViewIfNeeded();
    await carousel(page).locator('.carousel__track').hover();
    const held = await position(page);
    await page.waitForTimeout(3200);
    expect(await position(page)).toBe(held);
    await expect(toggle(page)).toHaveAttribute('aria-label', 'Pause');
  });

  test('does not run while scrolled out of view', async ({ page }) => {
    await open(page);
    await carousel(page).scrollIntoViewIfNeeded();
    await expect(toggle(page)).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(400); // the observer reports, then the timer stops
    const held = await carousel(page)
      .locator('.carousel__track')
      .evaluate((el) => (el as HTMLElement).scrollLeft);
    await page.waitForTimeout(3500);
    const after = await carousel(page)
      .locator('.carousel__track')
      .evaluate((el) => (el as HTMLElement).scrollLeft);
    expect(after).toBe(held);
  });
});

test.describe('elements keep working after a DOM move', () => {
  test('<wc-marquee> gets its Pause button back', async ({ page }) => {
    await open(page);
    const marquee = page.locator('wc-marquee').first();
    await expect(marquee.locator('xpath=following-sibling::button[1]')).toHaveClass(
      /marquee__toggle/,
    );
    await move(marquee);
    const button = marquee.locator('xpath=following-sibling::button[1]');
    await expect(button).toHaveClass(/marquee__toggle/);
    await button.click();
    await expect(marquee).toHaveAttribute('data-paused', '');
    await expect(page.locator('.marquee__toggle')).toHaveCount(1);
  });

  test('<wc-image-compare> still responds to the keyboard', async ({ page }) => {
    await open(page);
    const compare = page.locator('wc-image-compare').first();
    const handle = compare.locator('[part="handle"]');
    await handle.focus();
    await page.keyboard.press('ArrowRight');
    const first = Number(await handle.getAttribute('aria-valuenow'));

    await move(compare);
    await handle.focus();
    await page.keyboard.press('ArrowRight');
    expect(Number(await handle.getAttribute('aria-valuenow'))).toBeGreaterThan(first);
  });

  test('<wc-image-compare> still follows a pointer drag', async ({ page }) => {
    await open(page);
    const compare = page.locator('wc-image-compare').first();
    await compare.scrollIntoViewIfNeeded();
    await move(compare);
    const handle = compare.locator('[part="handle"]');
    const box = (await handle.boundingBox())!;
    const before = Number(await handle.getAttribute('aria-valuenow'));
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2, { steps: 5 });
    await page.mouse.up();
    expect(Number(await handle.getAttribute('aria-valuenow'))).not.toBe(before);
  });

  test('<wc-format> keeps the relative time current', async ({ page }) => {
    await open(page);
    const time = page.locator('#pt-format time');
    const text = await time.textContent();
    await move(page.locator('#pt-format'));
    // The text is rebuilt on reconnect; what matters is that a refresh is scheduled again.
    await expect(time).toHaveText(text!);
    const timers = await page.evaluate(() => {
      const real = window.setTimeout;
      let scheduled = 0;
      window.setTimeout = ((fn: TimerHandler, ms?: number, ...rest: unknown[]) => {
        scheduled++;
        return real(fn, ms, ...rest);
      }) as typeof window.setTimeout;
      const el = document.querySelector('#pt-format')!;
      const parent = el.parentElement!;
      const next = el.nextSibling;
      el.remove();
      parent.insertBefore(el, next && next.parentNode === parent ? next : null);
      window.setTimeout = real;
      return scheduled;
    });
    expect(timers).toBeGreaterThan(0);
  });
});
