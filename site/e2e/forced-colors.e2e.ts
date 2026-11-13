/**
 * The focus ring must survive Windows High Contrast Mode. As generated it
 * didn't: every pattern's `ring: true` state (`generate.ts`) draws its focus
 * indicator with `outline: none; box-shadow: 0 0 0 3px <color>;`, and
 * `forced-colors: active` forces `box-shadow` to `none` unconditionally — so a
 * keyboard user in forced-colors mode got no focus indicator at all, on any
 * `:focus-visible` element, in every format. See the `@media (forced-colors:
 * active)` rule in `packages/core/css/global.css` for the fix; this is what
 * verifies it against a real browser's forced-colors emulation and a real
 * computed style, not a guess about how the cascade resolves it.
 */
import { expect, test } from '@playwright/test';

test('a keyboard-focused button keeps a real outline under forced-colors', async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active' });
  await page.goto('/patterns');

  const button = page.getByRole('button', { name: 'Drawer left' });
  await button.focus();
  await expect(button).toBeFocused();

  const outline = await button.evaluate((el) => {
    const style = getComputedStyle(el);
    return { style: style.outlineStyle, width: style.outlineWidth };
  });
  expect(outline.style).not.toBe('none');
  expect(outline.width).not.toBe('0px');
});

test('without forced-colors, the ordinary box-shadow ring is still what renders', async ({
  page,
}) => {
  // Not a redundant check: this is the control. If it failed here too, the
  // outline in the test above could be the browser's ordinary UA default
  // rather than evidence forced-colors mode specifically needed rescuing.
  await page.goto('/patterns');
  const button = page.getByRole('button', { name: 'Drawer left' });
  await button.focus();
  const style = await button.evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(style).toBe('none');
});

test('the selected tab is still distinguishable under forced-colors', async ({ page }) => {
  // Forced colors replaces author colours, so an indicator drawn only by colour would vanish and
  // every tab would look alike. `tabs.css` switches the selected one to a system colour and
  // underlines it; this is the real computed result, not a reading of the stylesheet.
  await page.emulateMedia({ forcedColors: 'active' });
  await page.goto('/patterns');
  const tabs = page.locator('#pt-tabs');
  const selected = tabs.getByRole('tab', { selected: true });
  const other = tabs.getByRole('tab', { selected: false }).first();
  const look = (el: typeof selected) =>
    el.evaluate((node) => {
      const style = getComputedStyle(node);
      return { border: style.borderBlockEndColor, underline: style.textDecorationLine };
    });
  const a = await look(selected);
  const b = await look(other);
  expect(a.underline).toContain('underline');
  expect(b.underline).not.toContain('underline');
  expect(a.border).not.toBe(b.border);
});

test('the current step keeps a filled marker under forced-colors', async ({ page }) => {
  // The marker is a disc the author colours; forced colors would flatten it, so `stepper.css` pins
  // the current one to Highlight. The pseudo-element's computed background is the real answer.
  await page.emulateMedia({ forcedColors: 'active' });
  await page.goto('/patterns');
  const nav = page.getByRole('navigation', { name: 'Onboarding progress' });
  const marker = (el: ReturnType<typeof nav.locator>) =>
    el.evaluate((node) => getComputedStyle(node, '::before').backgroundColor);
  const current = await marker(nav.locator('[aria-current="step"]'));
  const other = await marker(nav.getByRole('link', { name: 'Identity' }));
  expect(current).not.toBe(other);
});
