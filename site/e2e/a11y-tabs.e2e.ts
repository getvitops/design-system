/**
 * `<wc-tabs>` in a real browser: the tablist has a name, inactive panels are `until-found` so
 * find-in-page still reaches them, and a find reveal brings the matching tab forward.
 */
import { expect, test } from '@playwright/test';

test.describe('<wc-tabs>', () => {
  test('the generated tablist carries the name given to <Tabs label>', async ({ page }) => {
    await page.goto('/patterns');
    await expect(page.getByRole('tablist', { name: 'About the system' })).toBeVisible();
  });

  test('inactive panels are hidden until-found, the selected one is not hidden', async ({
    page,
  }) => {
    await page.goto('/patterns');
    const hidden = await page.evaluate(() =>
      Array.from(document.querySelectorAll('#pt-tabs [role="tabpanel"]')).map((panel) =>
        panel.getAttribute('hidden'),
      ),
    );
    expect(hidden[0]).toBeNull();
    expect(hidden.slice(1)).toEqual(['until-found', 'until-found']);
  });

  test('a text-fragment find reveals a hidden panel and selects its tab', async ({ page }) => {
    // A text fragment navigates the way find-in-page does: the browser reveals `until-found`
    // content and fires `beforematch` on the panel first.
    await page.goto('/patterns#:~:text=Free%20to%20run');
    const pricing = page.getByRole('tab', { name: 'Pricing' });
    await expect(pricing).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel', { name: 'Pricing' })).toBeVisible();
  });

  test('arrow keys still move between tabs', async ({ page }) => {
    await page.goto('/patterns');
    await page.getByRole('tab', { name: 'Overview' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Pricing' })).toBeFocused();
    await expect(page.getByRole('tab', { name: 'Pricing' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });
});
