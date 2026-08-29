/**
 * Verifies a lightbox image always fits the viewport — scaled down, never
 * cropped, never overflowing — regardless of the source image's aspect ratio
 * or the viewport's.
 *
 * This is a computed-layout fact, not a decision any pure module makes, so it
 * is unreachable from `*.dom.test.ts` (happy-dom lays nothing out) and it
 * deliberately does NOT belong in `no-js-fallback.e2e.ts`: that file's own
 * docblock scopes it to no-JS fallback regressions and says "visual
 * regression... does not belong in this file". This file runs with
 * JavaScript on, so it also covers `showModal()` and the view-transition
 * morph landing on the correctly-sized `<img>` (see `lightbox.css`).
 */
import { expect, test } from '@playwright/test';

test.describe('lightbox: image always fits the viewport', () => {
  test('every ratio in the hand-authored gallery fits a tall viewport', async ({ page }) => {
    await page.setViewportSize({ width: 500, height: 900 });
    await page.goto('/patterns');
    const dialog = page.locator('dialog.lightbox-dialog').first();

    for (const slideId of ['pt-gal-square', 'pt-gal-wide', 'pt-gal-tall']) {
      await page.locator(`.gallery__trigger[href="#${slideId}"]`).click();
      await expect(dialog).toBeVisible();
      const box = await dialog.locator(`#${slideId} img`).boundingBox();
      expect(box).not.toBeNull();
      const viewport = page.viewportSize();
      expect(box!.width).toBeLessThanOrEqual(viewport!.width);
      expect(box!.height).toBeLessThanOrEqual(viewport!.height);
      await dialog.locator('.lightbox-dialog__close').click();
      await expect(dialog).toBeHidden();
    }
  });

  test('a portrait image fits a short, wide viewport — the case that overflows first', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1400, height: 500 });
    await page.goto('/patterns');
    const dialog = page.locator('dialog.lightbox-dialog').first();

    await page.locator('.gallery__trigger[href="#pt-gal-tall"]').click();
    await expect(dialog).toBeVisible();
    const box = await dialog.locator('#pt-gal-tall img').boundingBox();
    expect(box).not.toBeNull();
    const viewport = page.viewportSize();
    expect(box!.width).toBeLessThanOrEqual(viewport!.width);
    expect(box!.height).toBeLessThanOrEqual(viewport!.height);
  });

  test('the <Gallery /> wrapper demo fits, incl. the <picture>-wrapped image path', async ({
    page,
  }) => {
    // `<Gallery />` (unlike the hand-authored demo above) renders each slide
    // via `<ResponsiveImage />`, which emits `<picture><img></picture>` for an
    // `ImageMetadata` src — this is what exercises the fix's descendant
    // `:is(img, picture)` selector rather than a bare `> img`.
    await page.setViewportSize({ width: 500, height: 900 });
    await page.goto('/patterns');

    await page.locator('#enhanced-gallery').scrollIntoViewIfNeeded();
    const trigger = page.locator('.gallery').nth(1).locator('.gallery__trigger').last();
    const slideHref = await trigger.getAttribute('href'); // '#<uid>-img-<i>'
    await trigger.click();

    const slide = page.locator(slideHref!);
    await expect(slide).toBeVisible();
    const box = await slide.locator('img').boundingBox();
    expect(box).not.toBeNull();
    const viewport = page.viewportSize();
    expect(box!.width).toBeLessThanOrEqual(viewport!.width);
    expect(box!.height).toBeLessThanOrEqual(viewport!.height);
  });
});
