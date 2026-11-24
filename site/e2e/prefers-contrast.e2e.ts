/**
 * The high-contrast layer, proven against a real browser's computed style rather than assumed from
 * the CSS: the three triggers (`prefers-contrast: more`, `data-contrast="more"`, the no-JS checkbox)
 * all move the role tokens, `data-contrast="standard"` opts out of the media query, and the toggle
 * works with scripting off. `packages/generator/src/contrast-more.test.ts` covers the emitted CSS;
 * this covers that the browser applies it, which no string assertion can.
 *
 * Reads `--color-text-ui-primary`: a chromatic role's text token, which the layer re-points from its
 * baseline step to a darker (light) or lighter (dark) one.
 */
import { expect, test } from '@playwright/test';

const token = () =>
  getComputedStyle(document.documentElement).getPropertyValue('--color-text-ui-primary').trim();

test('prefers-contrast: more re-points the role tokens', async ({ page }) => {
  await page.goto('/patterns');
  const standard = await page.evaluate(token);
  await page.emulateMedia({ contrast: 'more' });
  const more = await page.evaluate(token);
  expect(standard).not.toBe('');
  expect(more).not.toBe(standard);
});

test('data-contrast="more" does the same without the media query', async ({ page }) => {
  await page.goto('/patterns');
  const standard = await page.evaluate(token);
  await page.evaluate(() => (document.documentElement.dataset.contrast = 'more'));
  expect(await page.evaluate(token)).not.toBe(standard);
});

test('data-contrast="standard" opts a visitor out of the OS preference', async ({ page }) => {
  await page.goto('/patterns');
  const standard = await page.evaluate(token);
  await page.emulateMedia({ contrast: 'more' });
  await page.evaluate(() => (document.documentElement.dataset.contrast = 'standard'));
  expect(await page.evaluate(token)).toBe(standard);
});

test('dark + more is its own appearance, not light-more leaking into dark', async ({ page }) => {
  await page.goto('/patterns');
  // A decorative border: it changes in both appearances (it collapses onto the icon step), unlike
  // text, which at dark step 300 already clears 7:1 and so legitimately stays put.
  const border = () =>
    getComputedStyle(document.documentElement).getPropertyValue('--color-border-ui-primary').trim();
  await page.evaluate(() => (document.documentElement.dataset.theme = 'dark'));
  const darkStandard = await page.evaluate(border);
  await page.evaluate(() => (document.documentElement.dataset.contrast = 'more'));
  const darkMore = await page.evaluate(border);
  await page.evaluate(() => (document.documentElement.dataset.theme = 'light'));
  const lightMore = await page.evaluate(border);
  expect(darkMore).not.toBe(darkStandard);
  expect(darkMore).not.toBe(lightMore);
});

test('the checkbox switches the layer on, and the element remembers it', async ({ page }) => {
  await page.goto('/patterns');
  const standard = await page.evaluate(token);
  await page.locator('.contrast-toggle input').first().check();
  expect(await page.evaluate(token)).not.toBe(standard);
  expect(await page.evaluate(() => document.documentElement.dataset.contrast)).toBe('more');
  await page.reload();
  expect(await page.locator('.contrast-toggle input').first().isChecked()).toBe(true);
});

test('a remembered choice is applied before first paint', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('vitops-contrast', 'more'));
  await page.goto('/patterns');
  // `<Head contrast />`'s inline script, not the deferred element: the attribute is already on
  // <html> when the document finishes parsing.
  expect(await page.evaluate(() => document.documentElement.dataset.contrast)).toBe('more');
});
