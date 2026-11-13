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

test.describe('<wc-config-form>', () => {
  test('describes the form as a config document, live', async ({ page }) => {
    await page.goto('/patterns');
    const out = page.locator('#pt-config-out');
    await expect(out).toHaveText('{}');
    await page.locator('#pt-config-form [name="organization.email"]').fill('ada@example.com');
    await expect(out).toContainText('"email": "ada@example.com"');
    await expect(out).toContainText('"organization"');
  });

  test('says an email is wrong once the field is left, and not before', async ({ page }) => {
    await page.goto('/patterns');
    const input = page.locator('#pt-config-form [name="organization.email"]');
    // `has` is matched inside the field, so it takes a selector relative to it, not `input`.
    const error = page
      .locator('#pt-config-form wc-field', { has: page.locator('[name="organization.email"]') })
      .locator('.field__error');
    await input.fill('nope');
    await expect(error).toHaveText('');
    await page.locator('#pt-config-form [name="organization.phone"]').focus();
    await expect(error).toHaveText('Must be an email address.');
    await input.fill('ada@example.com');
    await expect(error).toHaveText('');
  });

  test('stops a submit that has errors instead of navigating', async ({ page }) => {
    await page.goto('/patterns');
    await page.locator('#pt-config-form [name="organization.email"]').fill('nope');
    await page.locator('#pt-config-form').getByRole('button', { name: 'Save' }).click();
    await expect(page).not.toHaveURL(/#pt-config-form/);
    await expect(page.locator('#pt-config-form wc-field[data-invalid]').first()).toBeVisible();
  });

  test('adds and removes rows of a keyed map with buttons', async ({ page }) => {
    await page.goto('/patterns');
    // Scoped to the locations map: the services map beside it has its own rows.
    const locations = page.locator('#pt-cf-organization-locations');
    const rows = locations.locator('.field__row');
    // The blank row became a template: nothing to fill in until a row is asked for.
    await expect(rows).toHaveCount(0);
    await locations.getByRole('button', { name: 'Add location' }).click();
    await expect(rows).toHaveCount(1);
    await expect(rows.first().locator('summary')).toHaveText('New location');
    await rows.first().locator('input[name$="$key"]').fill('ottawa');
    await expect(rows.first().locator('summary')).toHaveText('ottawa');
    await locations.getByRole('button', { name: 'Add location' }).click();
    await expect(rows).toHaveCount(2);
    await rows.first().getByRole('button', { name: 'Remove' }).click();
    await expect(rows).toHaveCount(1);
    // Only the second row is left, and it kept its own name.
    await expect(rows.first().locator('input[name$="$key"]')).toHaveAttribute(
      'name',
      /\$map\.1\.\$key$/,
    );
    // The services map is untouched.
    await expect(page.locator('#pt-cf-organization-services .field__row')).toHaveCount(0);
  });

  test('a row can be folded away', async ({ page }) => {
    await page.goto('/patterns');
    const locations = page.locator('#pt-cf-organization-locations');
    await locations.getByRole('button', { name: 'Add location' }).click();
    const row = locations.locator('.field__row').first();
    await row.locator('summary').click();
    await expect(row).not.toHaveAttribute('open', '');
  });
});

test.describe('<wc-stepper>', () => {
  test('shows one step at a time and stops the way forward at a missing required field', async ({
    page,
  }) => {
    await page.goto('/patterns');
    const stepper = page.locator('wc-stepper');
    await expect(stepper.locator('section[data-step]:not([hidden])')).toHaveCount(1);
    await expect(stepper.getByRole('link', { name: 'Who' })).toHaveAttribute(
      'aria-current',
      'step',
    );

    await stepper.getByRole('button', { name: 'Next' }).click();
    // `name` is required and empty: still on the first step.
    await expect(stepper.locator('#pt-step-who')).toBeVisible();
    await expect(stepper.locator('#pt-step-where')).toBeHidden();

    await stepper.locator('[name="pt-step-name"]').fill('Ada');
    await stepper.getByRole('button', { name: 'Next' }).click();
    await expect(stepper.locator('#pt-step-where')).toBeVisible();
    await expect(stepper.getByRole('link', { name: 'Where' })).toHaveAttribute(
      'aria-current',
      'step',
    );
    await expect(stepper.getByRole('link', { name: 'Who' }).locator('..')).toHaveClass(
      /stepper__item--complete/,
    );
  });

  test('will not jump over a step through the nav, but goes back freely', async ({ page }) => {
    await page.goto('/patterns');
    const stepper = page.locator('wc-stepper');
    await stepper.getByRole('link', { name: 'Done' }).click();
    await expect(stepper.locator('#pt-step-who')).toBeVisible();
    await stepper.locator('[name="pt-step-name"]').fill('Ada');
    await stepper.getByRole('link', { name: 'Done' }).click();
    await expect(stepper.locator('#pt-step-done')).toBeVisible();
    await stepper.getByRole('link', { name: 'Who' }).click();
    await expect(stepper.locator('#pt-step-who')).toBeVisible();
  });
});

test.describe('/configure', () => {
  test('offers the colour picker beside a brand colour, fetched when it is opened', async ({
    page,
  }) => {
    await page.goto('/configure#cfg-brand');
    const field = page.locator('wc-color-field').first();
    await expect(field.locator('wc-oklch-color-picker')).toHaveCount(0);
    await field.locator('summary').click();
    await expect(field.locator('wc-oklch-color-picker')).toHaveCount(1);
    // The text input is still the one control that is submitted.
    await expect(field.locator('input[data-widget="color"]')).toHaveAttribute('name', /seed$/);
  });

  test('builds a site.json as the steps are filled in, and validates it for real', async ({
    page,
  }) => {
    await page.goto('/configure');
    const stepper = page.locator('wc-stepper');
    await expect(stepper.locator('section[data-step]:not([hidden])')).toHaveCount(1);

    await stepper.locator('#cfg-identity [name="organization.name"]').fill('Acme Roofing');

    // Jump to the review step through the nav: every step on the way is valid or optional.
    await stepper.getByRole('link', { name: /^Review/ }).click();
    await expect(stepper.locator('#cfg-review')).toBeVisible();
    const out = page.locator('#cfg-out');
    await expect(out).toContainText('"name": "Acme Roofing"');
    await expect(out).toContainText('"configVersion"');
    await expect(page.locator('#cfg-status')).toHaveText('This site.json is valid.');
  });

  test('will not move past a step with a bad email', async ({ page }) => {
    await page.goto('/configure#cfg-contact');
    const stepper = page.locator('wc-stepper');
    await stepper.locator('#cfg-contact [name="organization.email"]').fill('nope');
    await stepper.getByRole('button', { name: 'Next' }).click();
    await expect(stepper.locator('#cfg-contact')).toBeVisible();
    await expect(stepper.locator('#cfg-brand')).toBeHidden();
  });

  test('says what is wrong with a bad email on the contact step', async ({ page }) => {
    await page.goto('/configure#cfg-contact');
    const input = page.locator('#cfg-contact [name="organization.email"]');
    await input.fill('nope');
    await input.blur();
    await expect(
      page.locator('#cfg-contact wc-field', { has: page.locator('[name="organization.email"]') }),
    ).toContainText('Must be an email address.');
  });
});
