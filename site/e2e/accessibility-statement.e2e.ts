/**
 * The generated accessibility statement, rendered with the framework's own CSS and checked in a real
 * browser against the part of WCAG 2.1 Level AAA that a stylesheet decides.
 *
 * `packages/generator/src/legal/accessibility-statement.content.test.ts` holds the *content*
 * criteria (reading level, abbreviations, link purpose, headings) over every combination of sections.
 * What it cannot see is paint and layout, which belong to the site, so this renders the document
 * through `generateLegal()` into the docs site's real stylesheet and measures:
 *
 *  - axe at Level A/AA in the standard appearance;
 *  - axe including the `wcag2aaa` tag in the high-contrast appearance. 1.4.6 (7:1) is met through the
 *    generated high-contrast layer, a sufficient technique (G174), so that is where it is asserted;
 *  - 1.4.8 Visual Presentation: line length at most 80 characters, line height at least 1.5, text not
 *    justified, and no horizontal scroll;
 *  - 1.4.4 / 1.4.10: 200% text size with no horizontal scroll;
 *  - 2.5.5 target size, for the standalone contact links.
 *
 * Nothing here is published: it is a fixture, so no conformance claim is made about the docs site.
 * Axe reaches only part of AAA; a screen reader and keyboard pass by a person is still required before
 * a client publishes (see the `vitops-accessibility` skill's checklist).
 */
import AxeBuilder from '@axe-core/playwright';
import { defaultConfig, generateLegal, type Config } from '@getvitops/generator';
import { expect, test } from '@playwright/test';

/** Every optional section on, so the page under test is the longest and most varied one. */
function statementHtml(): string {
  const cfg = {
    designSystem: { themes: { default: defaultConfig() } },
    organization: {
      name: 'Acme',
      legalName: 'Acme Widgets Inc.',
      email: 'access@acme.example',
      phone: '+1 613 555 0100',
      address: {
        streetAddress: '1 Elgin St',
        addressLocality: 'Ottawa',
        addressRegion: 'ON',
        postalCode: 'K1P 5K7',
        addressCountry: 'Canada',
      },
    },
    site: {
      defaultLocale: 'en',
      locales: { en: { name: 'English' } },
      environments: { production: { url: 'https://acme.example' } },
      domains: { canonical: 'https://acme.example' },
      accessibility: { standard: 'wcag21', level: 'AA', contrastToggle: true },
      legal: {
        accessibilityStatement: {
          enabled: true,
          law: 'aoda',
          mandatory: true,
          conformance: 'partial',
          testedOn: '2026-10-01',
          testing: ['automated', 'keyboard', 'screen-reader', 'external-audit'],
          auditor: 'Example Audit Co.',
          limitations: [
            {
              content: 'Online booking widget',
              issue: 'It cannot be used with a keyboard only',
              alternative: 'Book by phone',
              plannedFix: 'We are reviewing vendors',
            },
          ],
          formats: ['large print', 'accessible PDF'],
          supports: ['captioning'],
          inPerson: '1 Elgin St, weekdays 9 to 5',
          responseDays: 3,
          feedbackUrl: 'https://acme.example/feedback',
          feedbackOwner: 'our web manager',
          policies: [{ title: 'Accessibility policy', url: 'https://acme.example/policy' }],
          reviewCadence: 'annually',
          lastUpdated: '2026-11-01',
        },
      },
    },
  } as unknown as Config;
  return generateLegal(cfg, { docs: ['accessibility'], output: 'html' })[
    'accessibility-statement.html'
  ]!;
}

/**
 * The statement in the framework's reading layout: `.centered` is the measure track (65ch by
 * default), `.rhythm` the vertical spacing. The page keeps the docs site's stylesheet, `lang` and
 * title, and replaces only what is inside `<body>`.
 */
async function open(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/patterns');
  await page.evaluate((html) => {
    document.title = 'Accessibility Statement';
    document.body.innerHTML = `<main id="content" class="centered rhythm">${html}</main>`;
  }, statementHtml());
  await page.addStyleTag({ content: TARGET_SIZE_CSS });
}

/**
 * The one rule a page needs beyond the framework's defaults to meet 2.5.5 (Target Size, AAA): a link
 * that IS its whole list item (the policy list) is a standalone target, and the default link is a
 * line tall, about 22px. The `vitops-accessibility` skill gives this same snippet to consumers, so
 * what is asserted here is what is documented. Inline links ("Email: <link>") are exempt and left
 * alone. TODO: a framework wrapper class for generated documents would make this unnecessary.
 */
const TARGET_SIZE_CSS =
  'main li > a:only-child { display: inline-block; padding-block: 0.65rem; min-inline-size: 44px; }';

const STANDARD = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

test('has no automated violations at Level A or AA in the standard appearance', async ({
  page,
}) => {
  await open(page);
  const { violations } = await new AxeBuilder({ page }).withTags(STANDARD).analyze();
  expect(
    violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
});

test('has no automated violations including AAA in the high-contrast appearance (1.4.6, 7:1)', async ({
  page,
}) => {
  await open(page);
  await page.evaluate(() => (document.documentElement.dataset.contrast = 'more'));
  const { violations } = await new AxeBuilder({ page })
    .withTags([...STANDARD, 'wcag2aaa'])
    .analyze();
  expect(
    violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
});

test('1.4.8: at most 80 characters per line, line height at least 1.5, not justified', async ({
  page,
}) => {
  await open(page);
  const m = await page.evaluate(() => {
    const ch = (() => {
      const probe = document.createElement('span');
      probe.style.cssText = 'position:absolute;visibility:hidden;inline-size:1ch;block-size:1px';
      document.body.append(probe);
      const w = probe.getBoundingClientRect().width;
      probe.remove();
      return w;
    })();
    return [...document.querySelectorAll('main p, main li')].map((el) => {
      const s = getComputedStyle(el);
      const lh =
        s.lineHeight === 'normal' ? 1.2 : parseFloat(s.lineHeight) / parseFloat(s.fontSize);
      return {
        text: (el.textContent ?? '').slice(0, 30),
        widthCh: el.getBoundingClientRect().width / ch,
        lineHeight: lh,
        align: s.textAlign,
      };
    });
  });
  expect(m.length).toBeGreaterThan(10);
  for (const p of m) {
    expect(p.widthCh, p.text).toBeLessThanOrEqual(80);
    expect(p.lineHeight, p.text).toBeGreaterThanOrEqual(1.5);
    expect(p.align, p.text).not.toBe('justify');
  }
});

test('1.4.4 / 1.4.10: still readable at 200% text size, with no horizontal scroll', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page);
  await page.evaluate(() => (document.documentElement.style.fontSize = '200%'));
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  // And at a 320 CSS pixel width (400% zoom on a desktop), the reflow criterion.
  await page.setViewportSize({ width: 320, height: 800 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(0);
});

test('2.5.5: a link that stands alone on its line is at least 44 by 44 CSS pixels', async ({
  page,
}) => {
  await open(page);
  // The exception for inline targets covers a link inside a sentence or beside other text on its
  // line ("Email: <link>"), so only a list item that IS the link has to meet the size.
  const boxes = await page.evaluate(() =>
    [...document.querySelectorAll('main li > a')]
      .filter((a) => a.parentElement?.textContent?.trim() === a.textContent?.trim())
      .map((a) => {
        const r = a.getBoundingClientRect();
        return { text: a.textContent, w: r.width, h: r.height };
      }),
  );
  expect(boxes.length).toBeGreaterThan(0);
  for (const b of boxes) {
    expect(b.w, b.text ?? '').toBeGreaterThanOrEqual(44);
    expect(b.h, b.text ?? '').toBeGreaterThanOrEqual(44);
  }
});
