/**
 * `.tone--solid` sets `color-scheme` from its fill, so a native control or scrollbar inside a dark
 * fill is drawn dark whatever the page is. The value comes from the generator
 * (`--color-scheme-<role>`, read off the foreground it chose), so this checks the browser end: the
 * token resolves, and the element's computed `color-scheme` follows it.
 */
import { expect, test } from '@playwright/test';

test('a solid tone takes the scheme of its role fill', async ({ page }) => {
  await page.goto('/patterns');
  const result = await page.evaluate(() => {
    const roles = ['ui-primary', 'danger', 'success', 'neutral'];
    const out: Record<string, { token: string; computed: string }> = {};
    for (const role of roles) {
      const el = document.createElement('div');
      el.className = 'tone tone--solid';
      el.setAttribute('style', `--tone-solid-scheme: var(--color-scheme-${role})`);
      document.body.append(el);
      out[role] = {
        token: getComputedStyle(document.documentElement)
          .getPropertyValue(`--color-scheme-${role}`)
          .trim(),
        computed: getComputedStyle(el).colorScheme,
      };
      el.remove();
    }
    return out;
  });
  for (const [role, { token, computed }] of Object.entries(result)) {
    expect(['dark', 'light'], role).toContain(token);
    expect(computed, role).toBe(token);
  }
});

test('with no scheme set a solid tone leaves color-scheme to the page', async ({ page }) => {
  await page.goto('/patterns');
  const scheme = await page.evaluate(() => {
    const el = document.createElement('div');
    el.className = 'tone tone--solid';
    document.body.append(el);
    const value = getComputedStyle(el).colorScheme;
    el.remove();
    return value;
  });
  expect(scheme).toBe('normal');
});
