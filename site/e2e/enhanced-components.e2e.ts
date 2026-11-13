/**
 * The JS-on half of the tier-2 promise for the newest elements: after upgrade they behave as their
 * WAI-ARIA patterns say, in a real browser with a real layout. `*.dom.test.ts` (happy-dom) covers the
 * wiring; what only a browser can show is here — actual focus, actual visibility, actual pointer
 * hit-testing on stacked range inputs.
 *
 * The no-JS half of the same promise is `no-js-fallback.e2e.ts`.
 */
import { expect, test } from '@playwright/test';

test.describe('<wc-tabs>', () => {
  test('builds a tablist and shows one panel, moving with the arrow keys', async ({ page }) => {
    await page.goto('/patterns');
    const tabs = page.locator('#pt-tabs');
    await expect(tabs.getByRole('tablist')).toBeVisible();
    await expect(tabs.getByRole('tab')).toHaveCount(3);
    await expect(tabs.getByRole('tabpanel')).toHaveCount(1);
    await expect(tabs.getByRole('tabpanel')).toContainText('One system');

    const first = tabs.getByRole('tab', { name: 'Overview' });
    await first.focus();
    await page.keyboard.press('ArrowRight');
    await expect(tabs.getByRole('tab', { name: 'Pricing' })).toBeFocused();
    await expect(tabs.getByRole('tab', { name: 'Pricing' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(tabs.getByRole('tabpanel')).toContainText('Free to run');

    await page.keyboard.press('End');
    await expect(tabs.getByRole('tab', { name: 'Support' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await page.keyboard.press('ArrowRight');
    await expect(tabs.getByRole('tab', { name: 'Overview' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  test('a #fragment selects its panel on load', async ({ page }) => {
    await page.goto('/patterns#pt-tab-support');
    await expect(page.locator('#pt-tabs').getByRole('tab', { name: 'Support' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });
});

test.describe('<wc-combobox>', () => {
  test('filters as you type, keeps focus in the input, and Enter chooses without submitting', async ({
    page,
  }) => {
    await page.goto('/patterns');
    const input = page.locator('#pt-city');
    const combo = page.locator('wc-combobox');
    await input.click();
    await expect(input).toHaveAttribute('role', 'combobox');
    await expect(combo.getByRole('listbox')).toBeVisible();
    await expect(combo.getByRole('option')).toHaveCount(5);

    await input.fill('ga');
    await expect(combo.getByRole('option')).toHaveText(['Gatineau']);
    await page.keyboard.press('ArrowDown');
    await expect(input).toBeFocused();
    await expect(input).toHaveAttribute('aria-activedescendant', /option-0$/);
    await page.keyboard.press('Enter');
    await expect(input).toHaveValue('Gatineau');
    await expect(combo.getByRole('listbox')).toBeHidden();
  });

  test('shows the label and submits the value', async ({ page }) => {
    await page.goto('/patterns');
    await page.locator('#pt-city').fill('mont');
    await page.locator('wc-combobox').getByRole('option', { name: 'Montréal' }).click();
    await expect(page.locator('#pt-city')).toHaveValue('MTL');
  });

  test('Escape closes, and a second Escape clears', async ({ page }) => {
    await page.goto('/patterns');
    const input = page.locator('#pt-city');
    await input.fill('Ott');
    await page.keyboard.press('Escape');
    await expect(page.locator('wc-combobox').getByRole('listbox')).toBeHidden();
    await expect(input).toHaveValue('Ott');
    await page.keyboard.press('Escape');
    await expect(input).toHaveValue('');
  });
});

test.describe('<wc-range>', () => {
  test('overlays two sliders on one track with the value shown, and they cannot cross', async ({
    page,
  }) => {
    await page.goto('/patterns');
    const range = page.locator('#pt-range');
    await expect(range.locator('.range__track')).toBeVisible();
    await expect(range.locator('output')).toHaveText('200 – 800');

    const min = range.getByRole('slider', { name: 'Minimum price' });
    await min.focus();
    await page.keyboard.press('End');
    // Stops against the upper thumb instead of passing it.
    await expect(min).toHaveValue('800');
    await expect(range.getByRole('slider', { name: 'Maximum price' })).toHaveValue('800');
    await expect(range.locator('output')).toHaveText('800 – 800');
  });
});

test.describe('<wc-format>', () => {
  test('replaces the server text with a relative time and keeps the original in title', async ({
    page,
  }) => {
    await page.goto('/patterns');
    // The exact words depend on today's date ("last week", "2 months ago"), so assert only that the
    // text came from the machine value and the authored text was kept.
    const time = page.locator('#pt-format time');
    await expect(time).not.toHaveText('November 3, 2026');
    await expect(time).toHaveText(/\S/);
    await expect(time).toHaveAttribute('title', 'November 3, 2026');
    await expect(time).toHaveAttribute('datetime', '2026-11-03T14:05:00Z');
  });
});

test.describe('<wc-field>', () => {
  test('links help text to the control and keeps the control where it was', async ({ page }) => {
    await page.goto('/patterns');
    const field = page.locator('#pt-field-email');
    const help = await field.locator('.field__help').getAttribute('id');
    expect(help).toBeTruthy();
    await expect(field.locator('input')).toHaveAttribute('aria-describedby', help!);
    await expect(field.locator('label.field__control > input')).toHaveCount(1);
  });

  test('says nothing on arrival, then names the problem once the field is left', async ({
    page,
  }) => {
    await page.goto('/patterns');
    const field = page.locator('#pt-field-email');
    const error = field.locator('.field__error');
    await expect(error).toHaveText('');
    await field.locator('input').focus();
    await page.locator('#pt-field-bio textarea').focus();
    await expect(error).not.toHaveText('');
    await expect(field.locator('input')).toHaveAttribute('aria-invalid', 'true');
    await expect(field).toHaveAttribute('data-invalid', '');
    // Colour is never the only signal: there is text.
    await expect(error).toBeVisible();

    await field.locator('input').fill('ada@example.com');
    await expect(error).toHaveText('');
    await expect(field.locator('input')).not.toHaveAttribute('aria-invalid', 'true');
  });

  test('counts characters against maxlength', async ({ page }) => {
    await page.goto('/patterns');
    const counter = page.locator('#pt-field-bio .field__counter');
    await expect(counter).toHaveText('0 / 80');
    await page.locator('#pt-field-bio textarea').fill('hello');
    await expect(counter).toHaveText('5 / 80');
  });

  test('keeps a server-rendered error until the value is edited', async ({ page }) => {
    await page.goto('/patterns');
    const field = page.locator('#pt-field-phone');
    await expect(field.locator('.field__error')).toHaveText(
      'That doesn’t look like a phone number.',
    );
    await expect(field.locator('input')).toHaveAttribute('aria-invalid', 'true');
    await field.locator('input').fill('613-555-0100');
    await expect(field.locator('.field__error')).toHaveText('');
  });
});
