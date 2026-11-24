/**
 * Loading behaviour that only a real browser, with a real network, can show: content that is hidden
 * until script says otherwise must not wait for the slowest resource on the page.
 */
import { expect, test } from '@playwright/test';

test.describe('.animate-trigger', () => {
  test('activates as soon as the script runs, not after window.load', async ({ page }) => {
    // Hold `load` open: an image added at DOMContentLoaded delays it until the request finishes, and
    // the route below keeps that request pending for several seconds.
    await page.route('**/__slow.png', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 6000));
      await route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
          'base64',
        ),
      });
    });
    await page.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => {
        const img = new Image();
        img.src = '/__slow.png';
        img.alt = '';
        document.body.append(img);
      });
    });
    await page.setViewportSize({ width: 1200, height: 3000 }); // everything above the fold
    await page.goto('/animation', { waitUntil: 'domcontentloaded' });

    const trigger = page.locator('#at-trigger-demo');
    await expect(trigger).toHaveClass(/is-active/, { timeout: 2500 });
    // And `load` really had not fired yet, so this is the early path and not a coincidence.
    expect(await page.evaluate(() => document.readyState)).not.toBe('complete');
  });
});

test.describe('image priority', () => {
  test('a carousel or gallery does not boost its first image unless asked', async ({ page }) => {
    await page.goto('/patterns');
    // Priority is zero-sum: only the page's LCP image should carry a boost, and these demos sit
    // far down the page.
    const boosted = await page
      .locator('wc-carousel img, wc-gallery img, .carousel img, .gallery img')
      .evaluateAll(
        (imgs) => imgs.filter((img) => img.getAttribute('fetchpriority') === 'high').length,
      );
    expect(boosted).toBe(0);
    const eager = await page
      .locator('wc-gallery img, .gallery img')
      .evaluateAll((imgs) => imgs.filter((img) => img.getAttribute('loading') === 'eager').length);
    expect(eager).toBe(0);
  });
});
