import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Source-text invariants for `<Analytics />` and `<CookieConsent />`, in the style
 * of `seo.test.ts`.
 *
 * The resolution logic is unit-tested in `../analytics.test.ts`. What these guard
 * is the structural half a unit test can't reach — chiefly that the gated tags
 * really are inert, which is the one property that makes the consent gate a fact
 * about the document rather than a promise a third-party script might not keep.
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const analytics = readFileSync(join(HERE, './Analytics.astro'), 'utf8');
const consent = readFileSync(join(HERE, './CookieConsent.astro'), 'utf8');

describe('<Analytics />', () => {
  it('emits gated tags as type="text/plain"', () => {
    // Without this the browser parses and runs the body immediately and the
    // "gate" does nothing at all.
    expect(analytics).toContain('type="text/plain"');
    expect(analytics).toContain('data-vitops-tag');
    expect(analytics).toContain('data-consent={tag.category}');
  });

  it('never gives a gated tag a live `src`', () => {
    // A `src` on an inert script is still fetched by some preload scanners, and
    // the request itself is what consent is meant to prevent. The URL rides on
    // data-src and only becomes a src at activation.
    expect(analytics).toContain('data-src={tag.src}');
    // The one `src=` in the file belongs to the ungated branch.
    expect(analytics.match(/[^-]\bsrc=\{/g) ?? []).toHaveLength(1);
  });

  it('hands the runtime the cookies to clear on revoke', () => {
    // Provider cookie names live in analytics.ts, not in @getvitops/core — one
    // table, travelling with the tag that sets them.
    expect(analytics).toContain('data-consent-cookies');
  });

  it('renders every tag from the resolver, hard-coding no provider', () => {
    expect(analytics).toContain('resolveAnalytics');
    for (const provider of ['googletagmanager', 'clarity.ms', 'plausible.io', 'matomo.php']) {
      expect(analytics).not.toContain(provider);
    }
  });

  it('uses no document.write', () => {
    // Vendor snippets still ship it; it blocks the parser and is ignored outright
    // in a script injected after load, which is exactly where these end up.
    expect(analytics).not.toContain('document.write');
  });

  it('emits no preconnect', () => {
    // Warming a third-party connection during parse is the critical-path cost the
    // `idle` strategy exists to avoid.
    // Matched as markup: the header comment names both to explain why they're
    // absent, so a bare substring check would trip on its own documentation.
    expect(analytics).not.toMatch(/rel=["']?(preconnect|dns-prefetch)/);
  });

  it('takes its config from the virtual module, not a consumer global', () => {
    expect(analytics).toContain("from 'virtual:getvitops/head'");
    expect(analytics).not.toContain('#site-config');
  });
});

describe('<CookieConsent />', () => {
  it('ships hidden, because with no JS there is nothing to consent to', () => {
    expect(consent).toMatch(/<wc-consent\s+hidden/);
  });

  it('shows the banner in the top layer, and never with light dismiss', () => {
    // A plain fixed banner resolves against the nearest containing block, and any
    // ancestor with container-type/transform/filter/contain becomes one —
    // `body { container-type: inline-size }` is ordinary here, since the
    // framework's breakpoints are container queries, and it traps the banner
    // mid-page. `manual` rather than `auto`: light dismiss would let a stray click
    // anywhere on the page count as a decision.
    expect(consent).toContain('popover="manual"');
    expect(consent).not.toContain('popover="auto"');
  });

  it('renders a real form with real buttons — the element augments, never renders', () => {
    expect(consent).toContain('<form');
    expect(consent).toContain('data-consent-accept');
    expect(consent).toContain('data-consent-reject');
    expect(consent).toContain('type="checkbox"');
  });

  it('gives the form an accessible name', () => {
    expect(consent).toContain('aria-label={heading}');
  });

  it('uses only framework classes every format emits', () => {
    // A Tailwind utility here would silently never be generated: Tailwind does not
    // scan node_modules, so a class only it can emit never reaches the bundle.
    const classes = [...consent.matchAll(/class="([^"{]+)"/g)].flatMap((m) =>
      (m[1] ?? '').split(/\s+/).filter(Boolean),
    );
    expect(classes.length).toBeGreaterThan(0);
    expect(classes).toEqual(expect.arrayContaining(['consent', 'link', 'btn', 'cta']));
    // TW_CLASH names (grid, flex, hidden, …) are stripped from the tailwind bundle
    // in favour of Tailwind's own, so a component may never depend on one.
    for (const clash of ['grid', 'flex', 'hidden', 'block', 'fixed', 'sr-only']) {
      expect(classes).not.toContain(clash);
    }
  });
});
