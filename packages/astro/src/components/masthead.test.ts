import { describe, expect, it } from 'vite-plus/test';
import {
  isSafeLength,
  mastheadClass,
  mastheadRootCss,
  mastheadStyle,
  resolveMasthead,
  resolveNavOptions,
} from './masthead.ts';
import { megaAreaName, navClass, type SiteNavTier } from './sitenav.ts';

const cfg = (masthead: object, nav?: object) => ({ site: { chrome: { masthead, nav } } }) as never;

describe('resolveMasthead', () => {
  it('defaults to a static, solid, full-width bar on the content track', () => {
    const m = resolveMasthead(undefined);
    expect(mastheadClass(m)).toEqual(['masthead']);
    expect(m.width).toBe('content');
  });

  it('maps config to modifier classes', () => {
    const m = resolveMasthead(
      cfg({
        position: 'sticky',
        behavior: 'hide-on-scroll',
        surface: 'glass',
        layout: 'floating',
        elevation: { shadow: 'sm', border: true, onScroll: true },
      }),
    );
    expect(mastheadClass(m)).toEqual([
      'masthead',
      'masthead--sticky',
      'masthead--hide-on-scroll',
      'masthead--glass',
      'masthead--floating',
      'masthead--shadow',
      'masthead--shadow-on-scroll',
      'masthead--border',
      'masthead--border-on-scroll',
    ]);
    expect(mastheadStyle(m)).toBe('--masthead-shadow: var(--shadow-sm)');
  });

  it('lets a prop override the config, and merges elevation key by key', () => {
    const m = resolveMasthead(
      cfg({ position: 'sticky', surface: 'glass', elevation: { shadow: 'sm', border: true } }),
      { surface: 'transparent-until-scrolled', elevation: { border: false } },
    );
    expect(m.surface).toBe('transparent-until-scrolled');
    expect(m.shadow).toBe('sm');
    expect(m.border).toBe(false);
  });

  it('ignores hide-on-scroll for a static masthead', () => {
    const m = resolveMasthead(cfg({ position: 'static', behavior: 'hide-on-scroll' }));
    expect(mastheadClass(m)).not.toContain('masthead--hide-on-scroll');
  });

  it('writes tone chains, solid using the role fill and its computed foreground', () => {
    const tint = mastheadStyle(resolveMasthead(cfg({ tone: 'brand' })))!;
    expect(tint).toContain('--tone-bg: var(--color-bg-brand,');
    const solid = mastheadStyle(resolveMasthead(cfg({ tone: 'brand:solid' })))!;
    expect(solid).toContain('--tone-bg: var(--color-bg-brand-solid');
    expect(solid).toContain('--tone-fg: var(--color-text-on-brand');
  });

  it('rejects values that could escape into CSS', () => {
    expect(() => resolveMasthead(cfg({ height: '4rem;}body{display:none' }))).toThrow(/length/);
    expect(() => resolveMasthead(cfg({ tone: 'a;b' }))).toThrow(/role/);
    expect(() => resolveMasthead(cfg({ elevation: { shadow: 'x)' } }))).toThrow(/shadow/);
  });

  it('emits the root height rule only when a height is set', () => {
    expect(mastheadRootCss(resolveMasthead(undefined))).toBeUndefined();
    expect(mastheadRootCss(resolveMasthead(cfg({ height: '5rem' })))).toBe(
      ':root{--masthead-height:5rem}',
    );
  });

  it('writes the inset only for an inset or floating layout, defaulted to 0.75rem', () => {
    expect(mastheadRootCss(resolveMasthead(cfg({ inset: '2rem' })))).toBeUndefined();
    expect(mastheadRootCss(resolveMasthead(cfg({ layout: 'floating' })))).toBe(
      ':root{--masthead-inset:0.75rem}',
    );
    expect(
      mastheadRootCss(resolveMasthead(cfg({ layout: 'inset', height: '5rem', inset: '1rem' }))),
    ).toBe(':root{--masthead-height:5rem;--masthead-inset:1rem}');
  });

  it('merges inset from config and lets a prop override it', () => {
    const m = resolveMasthead(cfg({ layout: 'floating', inset: '1rem' }), { inset: '2rem' });
    expect(m.inset).toBe('2rem');
  });

  it('accepts fluid height and inset', () => {
    const m = resolveMasthead(
      cfg({
        layout: 'floating',
        height: 'clamp(3.5rem, 8cqi, 4.5rem)',
        inset: 'min(2cqi, 1.5rem)',
      }),
    );
    expect(mastheadRootCss(m)).toBe(
      ':root{--masthead-height:clamp(3.5rem, 8cqi, 4.5rem);--masthead-inset:min(2cqi, 1.5rem)}',
    );
    expect(() => resolveMasthead(cfg({ inset: '1rem;}' }))).toThrow(/inset/);
  });
});

describe('isSafeLength', () => {
  it.each([
    '4rem',
    '0',
    '64px',
    '0.75rem',
    'calc(3rem + 8px)',
    'calc(100% - 2rem)',
    'clamp(3.5rem, 8cqi, 4.5rem)',
    'clamp(0.5rem, 2vw, 1.5rem)',
    'min(100%, 80rem)',
    'max(3rem, 5svh)',
    'clamp(1rem, calc(1rem + 1cqi), 2rem)',
  ])('accepts %s', (v) => expect(isSafeLength(v)).toBe(true));

  it.each([
    '',
    '5',
    '4rem;}body{display:none',
    'var(--x)',
    'url(x)',
    'expression(1)',
    'clamp(1rem, 2cqi, 3rem',
    'clamp(1rem, 2cqi, 3rem))',
    '4rems',
    '4 rem',
    'red',
    '"4rem"',
    '4rem /* x */',
    'calc(1rem + attr(x))',
  ])('rejects %j', (v) => expect(isSafeLength(v)).toBe(false));
});

describe('resolveNavOptions', () => {
  it('reads site.chrome.nav and lets an override win', () => {
    const c = cfg({}, { compact: 'dropdown', depth: 2, drawerSide: 'start' });
    expect(resolveNavOptions(c)).toEqual({ compact: 'dropdown', depth: 2, drawerSide: 'start' });
    expect(resolveNavOptions(c, { depth: 1 }).depth).toBe(1);
  });
});

describe('navClass', () => {
  const tier = { kind: 'default', breakpoint: 'md' } as SiteNavTier;
  it('defaults to an end drawer', () => {
    expect(navClass(tier)).toContain('sitenav--drawer-end');
  });
  it('honours the drawer side', () => {
    expect(navClass(tier, { drawerSide: 'start' })).toContain('sitenav--drawer-start');
  });
  it('emits no drawer class for a dropdown', () => {
    const c = navClass(tier, { compact: 'dropdown', drawerSide: 'start' });
    expect(c).toContain('sitenav--panel-dropdown');
    expect(c.some((x) => x.startsWith('sitenav--drawer-'))).toBe(false);
  });
});

describe('megaAreaName', () => {
  it('uses the last URL path segment', () => {
    expect(megaAreaName({ label: 'S', url: '/services/' })).toBe('mega-services');
    expect(megaAreaName({ label: 'S', url: '/en/Our Work?x=1' })).toBe('mega-our-work');
  });
  it('prefers an explicit mega-area class', () => {
    expect(megaAreaName({ label: 'S', url: '/x', cssClasses: 'foo mega-area:products' })).toBe(
      'products',
    );
  });
  it('has none for external, hash or root URLs', () => {
    expect(megaAreaName({ label: 'S', url: 'https://a.b/c' })).toBeUndefined();
    expect(megaAreaName({ label: 'S', url: '#x' })).toBeUndefined();
    expect(megaAreaName({ label: 'S', url: '/' })).toBeUndefined();
  });
});
