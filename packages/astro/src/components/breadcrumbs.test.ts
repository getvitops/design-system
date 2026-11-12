import { describe, expect, it } from 'vite-plus/test';
import { resolveCrumbs, schemaCrumbs } from './breadcrumbs.ts';

const trail = [
  { label: 'Home', href: '/' },
  { label: 'Services', href: '/services' },
  { label: 'Roofing' },
];

describe('resolveCrumbs', () => {
  it('marks only the last item current and drops its link', () => {
    const out = resolveCrumbs([
      ...trail.slice(0, 2),
      { label: 'Roofing', href: '/services/roofing' },
    ]);
    expect(out.map((c) => c.current)).toEqual([false, false, true]);
    expect(out[2]).toEqual({ label: 'Roofing', current: true });
    expect(out[0]).toEqual({ label: 'Home', href: '/', current: false });
  });
  it('renders an ancestor with no page as text', () => {
    const out = resolveCrumbs([{ label: 'Home', href: '/' }, { label: 'Area' }, { label: 'Page' }]);
    expect(out[1]).toEqual({ label: 'Area', current: false });
  });
  it('is empty for an empty trail and current for a single item', () => {
    expect(resolveCrumbs([])).toEqual([]);
    expect(resolveCrumbs([{ label: 'Home', href: '/' }])).toEqual([
      { label: 'Home', current: true },
    ]);
  });
});

describe('schemaCrumbs', () => {
  const page = new URL('https://example.com/services/roofing?x=1');
  it('resolves hrefs against the page and takes the page URL for the last item', () => {
    expect(schemaCrumbs(trail, page)).toEqual([
      { name: 'Home', url: 'https://example.com/' },
      { name: 'Services', url: 'https://example.com/services' },
      { name: 'Roofing', url: 'https://example.com/services/roofing?x=1' },
    ]);
  });
  it('leaves out an ancestor that is not a page', () => {
    const out = schemaCrumbs(
      [{ label: 'Home', href: '/' }, { label: 'Area' }, { label: 'Page' }],
      page,
    );
    expect(out.map((o) => o.name)).toEqual(['Home', 'Page']);
  });
  it('uses the last item’s own href when it has one', () => {
    expect(
      schemaCrumbs(
        [
          { label: 'A', href: '/a' },
          { label: 'B', href: '/b' },
        ],
        page,
      ).at(-1)?.url,
    ).toBe('https://example.com/b');
  });
});
