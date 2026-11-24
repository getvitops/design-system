/**
 * Form feedback in a real browser, with a real keyboard. Speech itself cannot be asserted here (that
 * wants a screen reader), but everything a screen reader reads from can: the accessibility tree's
 * `aria-invalid` and `aria-describedby`, and the single polite live region the page announces
 * through. The defects were timing ones, so the tests are about when things change.
 */
import { expect, test, type Page } from '@playwright/test';

const FIELD = '#pt-field-form';

async function open(page: Page) {
  await page.goto('/patterns');
  await expect(page.locator(`${FIELD} wc-field.field--enhanced`).first()).toBeAttached();
}

const email = (page: Page) => page.locator(`${FIELD} input[name="email"]`);
const emailError = (page: Page) => page.locator('#pt-field-email .field__error');
const announcer = (page: Page) => page.locator('[data-wc-announcer]');

test.describe('<wc-field> error timing', () => {
  test('a required field the visitor only tabs past reports nothing', async ({ page }) => {
    await open(page);
    await email(page).focus();
    await page.keyboard.press('Tab');
    await expect(emailError(page)).toHaveText('');
    // `false`, not absent: Firefox and Safari expose an empty required control as invalid from page
    // load when the attribute is merely unset.
    await expect(email(page)).toHaveAttribute('aria-invalid', 'false');
    await page.waitForTimeout(700); // longer than the announce delay
    await expect(announcer(page)).toHaveText('');
  });

  test('after an edit and a blur the error appears, is linked, and is spoken once', async ({
    page,
  }) => {
    await open(page);
    await email(page).focus();
    await page.keyboard.type('not-an-email');
    await page.keyboard.press('Tab');

    await expect(emailError(page)).not.toHaveText('');
    await expect(email(page)).toHaveAttribute('aria-invalid', 'true');
    const describedby = await email(page).getAttribute('aria-describedby');
    const errorId = await emailError(page).getAttribute('id');
    expect(describedby).toContain(errorId!);

    // Not at once (the field that gets focus next is announced first), then through ONE region.
    await expect(announcer(page)).toHaveText('');
    await expect(announcer(page)).toContainText('Email:', { timeout: 2000 });
    await expect(page.locator('[data-wc-announcer]')).toHaveCount(1);
    // The error node is no longer a live region of its own.
    await expect(page.locator('#pt-field-email .field__error')).not.toHaveAttribute(
      'aria-live',
      /.*/,
    );
  });

  test('typing in a field that already has an error does not rewrite the message', async ({
    page,
  }) => {
    await open(page);
    await email(page).focus();
    await page.keyboard.type('not-an-email');
    await page.keyboard.press('Tab');
    await expect(emailError(page)).not.toHaveText('');

    // Count text mutations on the error node while the visitor keeps typing in the field.
    await page.evaluate(() => {
      const node = document.querySelector('#pt-field-email .field__error')!;
      (window as unknown as { __mutations: number }).__mutations = 0;
      new MutationObserver((records) => {
        (window as unknown as { __mutations: number }).__mutations += records.length;
      }).observe(node, { childList: true, characterData: true, subtree: true });
    });
    await email(page).focus();
    await page.keyboard.press('End');
    await page.keyboard.type('xyz', { delay: 40 });
    await page.waitForTimeout(200);
    // A blank-and-restore on each key is what a live region reads as a new error every keystroke.
    expect(
      await page.evaluate(() => (window as unknown as { __mutations: number }).__mutations),
    ).toBe(0);
  });

  test('fixing the value clears the message and the invalid state', async ({ page }) => {
    await open(page);
    await email(page).focus();
    await page.keyboard.type('nope');
    await page.keyboard.press('Tab');
    await expect(emailError(page)).not.toHaveText('');
    await email(page).fill('ada@example.com');
    await expect(emailError(page)).toHaveText('');
    await expect(email(page)).toHaveAttribute('aria-invalid', 'false');
  });
});
