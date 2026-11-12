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

test('an open dialog keeps a visible edge under forced-colors, whatever its border', async ({
  page,
}) => {
  await page.emulateMedia({ forcedColors: 'active' });
  await page.goto('/patterns');
  // Strip the author's border: the case where elevation (a box-shadow, which forced-colors zeroes)
  // was the only thing separating the dialog from the page.
  const outline = await page.evaluate(() => {
    const d = document.createElement('dialog');
    d.className = 'dialog';
    d.style.border = 'none';
    d.textContent = 'x';
    document.body.append(d);
    d.show();
    const s = getComputedStyle(d);
    return { style: s.outlineStyle, width: s.outlineWidth };
  });
  expect(outline.style).not.toBe('none');
  expect(outline.width).not.toBe('0px');
});

test('a switch keeps a visible track and thumb under forced-colors', async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active' });
  await page.goto('/patterns');
  const result = await page.evaluate(() => {
    const label = document.createElement('label');
    label.className = 'switch';
    label.innerHTML =
      '<input type="checkbox" checked><span class="switch__track"><span class="switch__thumb"></span></span>';
    document.body.append(label);
    const track = getComputedStyle(label.querySelector('.switch__track')!);
    return { borderStyle: track.borderStyle, borderWidth: track.borderWidth };
  });
  expect(result.borderStyle).not.toBe('none');
  expect(result.borderWidth).not.toBe('0px');
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
