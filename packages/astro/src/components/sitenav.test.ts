import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  VISIBILITY_CLASSES,
  containsCurrent,
  isCurrent,
  itemDescription,
  linkRel,
  loadNavMenus,
  menuItems,
  navClass,
  selectTiers,
  tierClass,
  treeDepth,
  trimDepth,
  type NavItem,
} from './sitenav.ts';

const tree: NavItem[] = [
  { label: 'Home', url: '/' },
  {
    label: 'Services',
    url: '/services',
    children: [
      {
        label: 'Web',
        url: '/services/web',
        titleAttr: ' Sites that load fast ',
        children: [{ label: 'Astro', url: '/services/web/astro' }],
      },
    ],
  },
];

describe('trimDepth / treeDepth', () => {
  it('cuts to N levels without mutating', () => {
    expect(treeDepth(tree)).toBe(3);
    expect(treeDepth(trimDepth(tree, 2))).toBe(2);
    expect(trimDepth(tree, 1).every((i) => i.children!.length === 0)).toBe(true);
    expect(treeDepth(tree)).toBe(3);
  });
  it('treats an empty menu as depth 0', () => {
    expect(treeDepth([])).toBe(0);
  });
});

describe('menuItems', () => {
  it('accepts a getMenu() object, a bare array, or nothing', () => {
    expect(menuItems({ items: tree })).toBe(tree);
    expect(menuItems(tree)).toBe(tree);
    expect(menuItems(null)).toEqual([]);
    expect(menuItems({ items: null })).toEqual([]);
  });
});

describe('selectTiers', () => {
  it('default: one menu, one unwindowed tier, md breakpoint, depth 3', () => {
    const t = selectTiers({ primary: tree });
    expect(t).toHaveLength(1);
    expect(t[0]).toMatchObject({ kind: 'default', breakpoint: 'md', depth: 3, visibility: [] });
    expect(treeDepth(t[0]!.items)).toBe(3);
  });

  it('adding primary-mobile windows the default tier and flattens the mobile one', () => {
    const t = selectTiers({ primary: tree, mobile: tree });
    expect(t.map((x) => x.kind)).toEqual(['mobile', 'default']);
    expect(t[0]!.visibility).toEqual(['below-md']);
    expect(t[0]!.depth).toBe(1);
    expect(treeDepth(t[0]!.items)).toBe(1);
    expect(t[1]!.visibility).toEqual(['from-md']);
  });

  it('adding primary-mega windows the default below xl and starts mega at xl', () => {
    const t = selectTiers({ primary: tree, mega: tree });
    expect(t.map((x) => x.kind)).toEqual(['default', 'mega']);
    expect(t[0]!.visibility).toEqual(['below-xl']);
    expect(t[1]).toMatchObject({ breakpoint: 'xl', visibility: ['from-xl'] });
  });

  it('all three: mobile < default < mega windows tile the width range', () => {
    const t = selectTiers({
      primary: tree,
      mobile: tree,
      mega: tree,
      mobileBreakpoint: 'sm',
      megaBreakpoint: 'lg',
    });
    expect(t.map((x) => x.visibility)).toEqual([
      ['below-sm'],
      ['from-sm', 'below-lg'],
      ['from-lg'],
    ]);
    // The default nav promotes where the mobile one hands over, never earlier.
    expect(t[1]!.breakpoint).toBe('sm');
  });

  it('a lone variant with no primary is shown at every width', () => {
    expect(selectTiers({ mobile: tree })[0]!.visibility).toEqual([]);
    expect(selectTiers({ mega: tree })[0]!.visibility).toEqual([]);
  });

  it('renders nothing for no menus', () => {
    expect(selectTiers({})).toEqual([]);
  });

  it('rejects a mega breakpoint that is not wider than the mobile one', () => {
    expect(() =>
      selectTiers({
        primary: tree,
        mobile: tree,
        mega: tree,
        mobileBreakpoint: 'lg',
        megaBreakpoint: 'md',
      }),
    ).toThrow(/wider/);
  });

  it('honours a custom breakpoint and depth', () => {
    const t = selectTiers({ primary: tree, breakpoint: 'lg', depth: 2 });
    expect(t[0]).toMatchObject({ breakpoint: 'lg', depth: 2 });
    expect(treeDepth(t[0]!.items)).toBe(2);
  });
});

describe('class mapping', () => {
  it('maps a tier to wrapper and nav classes', () => {
    const [m, d, x] = selectTiers({ primary: tree, mobile: tree, mega: tree });
    expect(tierClass(m!)).toEqual([
      'sitenav-tier',
      'sitenav-tier--mobile',
      'sitenav-tier--below-md',
    ]);
    expect(tierClass(d!)).toContain('sitenav-tier--below-xl');
    expect(navClass(d!)).toEqual(['sitenav', 'sitenav--bp-md', 'sitenav--drawer-end']);
    expect(navClass(x!)).toContain('sitenav--mega');
    expect(navClass(x!)).toContain('sitenav--bp-xl');
  });

  it('every emitted visibility class and breakpoint class is defined in sitenav.css', () => {
    const css = readFileSync(
      join(import.meta.dirname, '..', '..', '..', 'core', 'css', 'patterns', 'sitenav.css'),
      'utf8',
    );
    for (const v of VISIBILITY_CLASSES)
      expect(css, `.sitenav-tier--${v}`).toContain(`.sitenav-tier--${v}`);
    for (const bp of ['sm', 'md', 'lg', 'xl']) expect(css).toContain(`.sitenav--bp-${bp}`);
  });
});

describe('isCurrent / containsCurrent', () => {
  it('matches site-relative paths ignoring trailing slash, query and hash', () => {
    expect(isCurrent('/contact', '/contact/')).toBe(true);
    expect(isCurrent('/contact#form', '/contact')).toBe(true);
    expect(isCurrent('/', '/')).toBe(true);
    expect(isCurrent('/a', '/b')).toBe(false);
  });
  it('never marks external, hash-only, protocol-relative or mailto links', () => {
    for (const u of [
      'https://x.test/contact',
      '#top',
      '//x.test/contact',
      'mailto:a@b.c',
      '',
      null,
      undefined,
    ])
      expect(isCurrent(u as string, '/contact')).toBe(false);
  });
  it('finds a current descendant', () => {
    expect(containsCurrent(tree[1]!, '/services/web/astro')).toBe(true);
    expect(containsCurrent(tree[0]!, '/')).toBe(false);
  });
});

describe('item helpers', () => {
  it('trims the titleAttr description and drops empties', () => {
    expect(itemDescription(tree[1]!.children![0]!)).toBe('Sites that load fast');
    expect(itemDescription({ label: 'x', titleAttr: '  ' })).toBeUndefined();
  });
  it('adds rel only to new-tab links', () => {
    expect(linkRel({ label: 'x', target: '_blank' })).toBe('noopener noreferrer');
    expect(linkRel({ label: 'x' })).toBeUndefined();
  });
});

describe('loadNavMenus', () => {
  it('asks for exactly the three conventional menu names', async () => {
    const asked: string[] = [];
    const r = await loadNavMenus(async (n) => {
      asked.push(n);
      return n === 'primary' ? { items: tree } : null;
    });
    expect(asked.sort()).toEqual(['primary', 'primary-mega', 'primary-mobile']);
    expect(r.primary).toEqual({ items: tree });
    expect(r.mobile).toBeNull();
  });
});
