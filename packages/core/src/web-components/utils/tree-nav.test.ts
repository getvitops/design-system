import { describe, expect, it } from 'vitest';
import { resolveTreeMove, siblingsOf, visibleOrder, type TreeNavNode } from './tree-nav.ts';

/**
 * Config-shaped fixture, mirroring `tree-filter.test.ts`'s convention: string
 * keys, document order (depth-first, as `querySelectorAll` would produce).
 *
 * site (open)
 *   ├─ analytics (closed)
 *   │    └─ clarityId (leaf)
 *   └─ legal (open)
 *        └─ privacyPolicy (leaf)
 * organization (leaf)
 */
function fixture(overrides: Partial<Record<string, Partial<TreeNavNode>>> = {}): TreeNavNode[] {
  const base: TreeNavNode[] = [
    { key: 'site', parent: null, label: 'site', expanded: true, hidden: false },
    { key: 'site.analytics', parent: 'site', label: 'analytics', expanded: false, hidden: false },
    {
      key: 'site.analytics.clarityId',
      parent: 'site.analytics',
      label: 'clarityId',
      expanded: null,
      hidden: false,
    },
    { key: 'site.legal', parent: 'site', label: 'legal', expanded: true, hidden: false },
    {
      key: 'site.legal.privacyPolicy',
      parent: 'site.legal',
      label: 'privacyPolicy',
      expanded: null,
      hidden: false,
    },
    { key: 'organization', parent: null, label: 'organization', expanded: null, hidden: false },
  ];
  return base.map((node) => ({ ...node, ...overrides[node.key as string] }));
}

describe('visibleOrder', () => {
  it('includes everything when nothing is hidden or collapsed', () => {
    const order = visibleOrder(fixture()).map((n) => n.key);
    expect(order).toEqual([
      'site',
      'site.analytics',
      'site.legal',
      'site.legal.privacyPolicy',
      'organization',
    ]);
  });

  it("excludes a closed branch's children but keeps the branch itself", () => {
    // site.analytics is collapsed in the fixture, so its leaf never appears.
    const order = visibleOrder(fixture()).map((n) => n.key);
    expect(order).not.toContain('site.analytics.clarityId');
    expect(order).toContain('site.analytics');
  });

  it('excludes a node hidden by filter()', () => {
    const order = visibleOrder(fixture({ organization: { hidden: true } })).map((n) => n.key);
    expect(order).not.toContain('organization');
  });

  it('excludes descendants of a hidden ancestor too, not just the ancestor', () => {
    const order = visibleOrder(fixture({ site: { hidden: true } })).map((n) => n.key);
    // `site` and everything under it are gone; `organization` is a separate root
    // and unaffected.
    expect(order).toEqual(['organization']);
  });

  it('terminates on a cyclic parent link instead of looping', () => {
    const cyclic = fixture();
    const site = cyclic.find((n) => n.key === 'site')!;
    site.parent = 'site.legal'; // site's parent is its own descendant
    expect(() => visibleOrder(cyclic)).not.toThrow();
  });

  it('is empty for an empty tree', () => {
    expect(visibleOrder([])).toEqual([]);
  });
});

describe('resolveTreeMove — next/prev/first/last', () => {
  it('moves to the next visible node, skipping collapsed descendants', () => {
    expect(resolveTreeMove(fixture(), 'site', 'next')).toEqual({
      type: 'to',
      key: 'site.analytics',
    });
    // analytics is collapsed, so next from it is its sibling `legal`, not its
    // (invisible) child clarityId.
    expect(resolveTreeMove(fixture(), 'site.analytics', 'next')).toEqual({
      type: 'to',
      key: 'site.legal',
    });
  });

  it('moves to the previous visible node', () => {
    expect(resolveTreeMove(fixture(), 'site.legal', 'prev')).toEqual({
      type: 'to',
      key: 'site.analytics',
    });
  });

  it('does not move past the first or last visible node', () => {
    expect(resolveTreeMove(fixture(), 'site', 'prev')).toBeNull();
    expect(resolveTreeMove(fixture(), 'organization', 'next')).toBeNull();
  });

  it('first/last jump to the ends of visible depth-first order', () => {
    expect(resolveTreeMove(fixture(), 'site.legal', 'first')).toEqual({ type: 'to', key: 'site' });
    expect(resolveTreeMove(fixture(), 'site', 'last')).toEqual({
      type: 'to',
      key: 'organization',
    });
  });

  it('"last" reaches the deepest last descendant, not just the last root', () => {
    // Deepen the fixture so the true last node is nested, not a root sibling.
    const deep = fixture({
      organization: { expanded: true },
    }).concat({
      key: 'organization.locations',
      parent: 'organization',
      label: 'locations',
      expanded: null,
      hidden: false,
    });
    expect(resolveTreeMove(deep, 'site', 'last')).toEqual({
      type: 'to',
      key: 'organization.locations',
    });
  });

  it('an unknown active key is treated as "nothing focused yet" and lands on the first node', () => {
    expect(resolveTreeMove(fixture(), 'not-a-real-key', 'next')).toEqual({
      type: 'to',
      key: 'site',
    });
  });

  it('is null for an empty tree', () => {
    expect(resolveTreeMove([], 'site', 'next')).toBeNull();
  });
});

describe('resolveTreeMove — in (Right)', () => {
  it('expands a closed branch without moving', () => {
    expect(resolveTreeMove(fixture(), 'site.analytics', 'in')).toEqual({
      type: 'expand',
      key: 'site.analytics',
    });
  });

  it("steps into an open branch's first child", () => {
    expect(resolveTreeMove(fixture(), 'site', 'in')).toEqual({
      type: 'to',
      key: 'site.analytics',
    });
  });

  it('does nothing on a leaf', () => {
    expect(resolveTreeMove(fixture(), 'organization', 'in')).toBeNull();
  });

  it('does nothing on an open branch with no children', () => {
    const empty = fixture().filter((n) => n.parent !== 'site.legal');
    expect(resolveTreeMove(empty, 'site.legal', 'in')).toBeNull();
  });
});

describe('resolveTreeMove — out (Left)', () => {
  it('collapses an open branch without moving', () => {
    expect(resolveTreeMove(fixture(), 'site.legal', 'out')).toEqual({
      type: 'collapse',
      key: 'site.legal',
    });
  });

  it('steps to the parent from a closed branch', () => {
    expect(resolveTreeMove(fixture(), 'site.analytics', 'out')).toEqual({
      type: 'to',
      key: 'site',
    });
  });

  it('steps to the parent from a leaf', () => {
    expect(resolveTreeMove(fixture(), 'site.legal.privacyPolicy', 'out')).toEqual({
      type: 'to',
      key: 'site.legal',
    });
  });

  it('collapses an open root branch rather than no-op-ing just because it has no parent', () => {
    expect(resolveTreeMove(fixture(), 'site', 'out')).toEqual({ type: 'collapse', key: 'site' });
  });

  it('does nothing at a closed-branch-or-leaf root, which truly has nowhere to go', () => {
    expect(resolveTreeMove(fixture(), 'organization', 'out')).toBeNull();
  });
});

describe('siblingsOf', () => {
  it('returns every branch sibling at the same level, excluding leaves', () => {
    const withLeafSibling = fixture().concat({
      key: 'site.other',
      parent: 'site',
      label: 'other',
      expanded: null,
      hidden: false,
    });
    const siblings = siblingsOf(withLeafSibling, 'site.analytics');
    expect(siblings).toEqual(expect.arrayContaining(['site.analytics', 'site.legal']));
    expect(siblings).not.toContain('site.other');
  });

  it('is empty for an unknown key', () => {
    expect(siblingsOf(fixture(), 'not-a-real-key')).toEqual([]);
  });
});
