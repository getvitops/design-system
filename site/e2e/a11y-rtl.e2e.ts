/**
 * Right-to-left in a real browser. Logical properties (`inset-inline-end`) flip on their own, but a
 * `translate` does not: a panel pinned to the inline end that slid in with `translate: 100% 0` still
 * came from the physical right in an RTL page. Measured as geometry, which is what a visitor sees.
 */
import { expect, test, type Page } from '@playwright/test';

const sign = (page: Page, selector = ':root') =>
  page.evaluate(
    (sel) => getComputedStyle(document.querySelector(sel)!).getPropertyValue('--dir-sign').trim(),
    selector,
  );

test.describe('direction sign', () => {
  test('is +1 for LTR and -1 for RTL', async ({ page }) => {
    await page.goto('/patterns');
    expect(await sign(page)).toBe('1');
    await page.evaluate(() => document.documentElement.setAttribute('dir', 'rtl'));
    expect(await sign(page)).toBe('-1');
  });

  test('follows an element with its own dir, in both directions', async ({ page }) => {
    await page.goto('/patterns');
    await page.evaluate(() => {
      document.documentElement.setAttribute('dir', 'rtl');
      document.body.insertAdjacentHTML(
        'beforeend',
        '<div id="ltr-island" dir="ltr"><span id="inner">x</span></div>',
      );
    });
    // An LTR island inside an RTL page is LTR again, and inherits it.
    expect(await sign(page, '#ltr-island')).toBe('1');
    expect(await sign(page, '#inner')).toBe('1');
    await page.evaluate(() => {
      document.documentElement.setAttribute('dir', 'ltr');
      document.getElementById('ltr-island')!.setAttribute('dir', 'rtl');
    });
    expect(await sign(page, '#ltr-island')).toBe('-1');
  });
});

test.describe('site nav drawer enters from the inline end', () => {
  test.use({ viewport: { width: 700, height: 800 } });

  /** Open the panel and read where its entry animation STARTS: the transition frozen at time 0. */
  async function startPosition(page: Page) {
    return page.evaluate(async () => {
      const panel = document.querySelector<HTMLElement>('.sitenav__panel')!;
      panel.showPopover();
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
      const transition = panel
        .getAnimations()
        .find((a) => a instanceof CSSTransition && a.transitionProperty === 'translate');
      if (!transition) throw new Error('the panel has no translate transition to inspect');
      transition.pause();
      transition.currentTime = 0;
      const rect = panel.getBoundingClientRect();
      transition.cancel();
      panel.hidePopover();
      return { left: rect.left, right: rect.right };
    });
  }

  test('LTR: it starts past the right edge', async ({ page }) => {
    await page.goto('/demo/masthead/mega/');
    const start = await startPosition(page);
    expect(start.left).toBeGreaterThanOrEqual(600);
  });

  test('RTL: the inline end is the left, so it starts past the LEFT edge', async ({ page }) => {
    await page.goto('/demo/masthead/mega/');
    await page.evaluate(() => document.documentElement.setAttribute('dir', 'rtl'));
    const start = await startPosition(page);
    // Used to start past the right edge too (physical `translate: 100%`), sliding in from the wrong
    // side of an RTL page.
    expect(start.right).toBeLessThanOrEqual(100);
  });
});
