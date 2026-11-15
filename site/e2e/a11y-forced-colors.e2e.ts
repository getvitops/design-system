/**
 * Mask icons in forced-colors mode. They paint with `background-color: currentColor` through a
 * `mask-image`; forced-colors forces `background-color` to Canvas where it can, so the glyph was
 * Canvas on Canvas and an icon-only button became an invisible control. The fix is
 * `forced-color-adjust: none`; what is asserted is the computed result in a real forced-colors
 * emulation, which no happy-dom test can produce.
 */
import { expect, test, type Page } from '@playwright/test';

/** The computed background of an element, against a `Canvas` probe, under forced colors. */
async function paintsAgainstCanvas(page: Page, html: string) {
  return page.evaluate((markup) => {
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;inset:0 auto auto 0;z-index:99999';
    host.innerHTML = markup;
    document.body.append(host);
    const el = host.firstElementChild as HTMLElement;
    const probe = document.createElement('span');
    probe.style.backgroundColor = 'Canvas';
    host.append(probe);
    const result = {
      adjust: getComputedStyle(el).forcedColorAdjust,
      background: getComputedStyle(el).backgroundColor,
      canvas: getComputedStyle(probe).backgroundColor,
    };
    host.remove();
    return result;
  }, html);
}

test.describe('mask icons under forced colors', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await page.goto('/patterns');
  });

  test('.icon-mask keeps its own background, and that is not the page colour', async ({ page }) => {
    const r = await paintsAgainstCanvas(
      page,
      '<span class="icon-mask" style="mask-image:url(&quot;data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27/%3E&quot;)"></span>',
    );
    expect(r.adjust).toBe('none');
    // Canvas on Canvas is exactly the invisible-icon failure.
    expect(r.background).not.toBe(r.canvas);
  });

  test('the multifield delete icon is not forced to Canvas', async ({ page }) => {
    const adjust = await page.evaluate(() => {
      const btn = document.createElement('button');
      btn.className = 'multifield__delete';
      document.body.append(btn);
      const value = getComputedStyle(btn, '::before').forcedColorAdjust;
      btn.remove();
      return value;
    });
    expect(adjust).toBe('none');
  });

  test('link icons and the external-link arrow keep their paint', async ({ page }) => {
    const adjust = await page.evaluate(() => {
      const mail = document.createElement('a');
      mail.className = 'link link--icon';
      mail.setAttribute('href', 'mailto:a@b.ca');
      const ext = document.createElement('a');
      ext.className = 'link link--external';
      ext.setAttribute('href', 'https://example.com');
      ext.setAttribute('target', '_blank');
      document.body.append(mail, ext);
      const out = [
        getComputedStyle(mail, '::before').forcedColorAdjust,
        getComputedStyle(ext, '::after').forcedColorAdjust,
      ];
      mail.remove();
      ext.remove();
      return out;
    });
    expect(adjust).toEqual(['none', 'none']);
  });

  test('outside forced colors the property is left alone', async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'none' });
    const adjust = await page.evaluate(() => {
      const span = document.createElement('span');
      span.className = 'icon-mask';
      document.body.append(span);
      const value = getComputedStyle(span).forcedColorAdjust;
      span.remove();
      return value;
    });
    expect(adjust).toBe('auto');
  });
});
