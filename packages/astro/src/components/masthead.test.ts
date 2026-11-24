import { describe, expect, it } from 'vite-plus/test';
import {
  isSafeLength,
  mastheadClass,
  mastheadRootCss,
  mastheadStyle,
  resolveBackToTop,
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
        surface: 'glass',
        layout: 'floating',
        elevation: { shadow: 'sm', border: true },
        states: { scrollingToEnd: { hidden: true } },
      }),
    );
    expect(mastheadClass(m)).toEqual([
      'masthead',
      'masthead--sticky',
      'masthead--states',
      'masthead--glass',
      'masthead--floating',
      'masthead--shadow',
      'masthead--border',
    ]);
    expect(mastheadStyle(m)).toBe(
      '--masthead-shadow: var(--shadow-sm); --masthead-scrolling-to-end-hidden: 1',
    );
  });

  it('lets a prop override the config, and merges elevation and each state key by key', () => {
    const m = resolveMasthead(
      cfg({
        position: 'sticky',
        surface: 'glass',
        elevation: { shadow: 'sm', border: true },
        states: { scrollingToEnd: { hidden: true, elevation: false } },
      }),
      {
        surface: 'transparent',
        elevation: { border: false },
        states: { scrollingToEnd: { hidden: false } },
      },
    );
    expect(m.surface).toBe('transparent');
    expect(m.shadow).toBe('sm');
    expect(m.border).toBe(false);
    expect(m.states.scrollingToEnd).toEqual({ hidden: false, elevation: false });
  });

  it('drops hidden for a static masthead, which scrolls away anyway', () => {
    const m = resolveMasthead(cfg({ states: { scrollingToEnd: { hidden: true } } }));
    expect(m.position).toBe('static');
    expect(m.states).toEqual({});
    expect(mastheadClass(m)).not.toContain('masthead--states');
  });

  it('promotes a bar that hides at the start, or changes size or layout, to fixed', () => {
    const states = [
      { atStart: { hidden: true } },
      { atStart: { height: '6rem' } },
      { atStart: { layout: 'full' } },
      { atEnd: { inset: '1rem' } },
    ];
    for (const position of ['static', 'sticky'] as const)
      for (const s of states) {
        const m = resolveMasthead(cfg({ position, layout: 'inset', states: s }));
        expect(m.position).toBe('fixed');
        expect(mastheadClass(m)).toContain('masthead--states');
      }
  });

  it('does not promote a sticky bar whose states only change its look', () => {
    const m = resolveMasthead(
      cfg({ position: 'sticky', states: { atStart: { surface: 'transparent' } } }),
    );
    expect(m.position).toBe('sticky');
  });

  it('expands a state to the custom properties masthead.css reads', () => {
    const m = resolveMasthead(
      cfg({
        layout: 'inset',
        inset: '1rem',
        surface: 'glass',
        elevation: { shadow: 'sm', border: true },
        states: {
          atStart: {
            layout: 'full',
            height: '6rem',
            surface: 'transparent',
            elevation: false,
          },
          scrollingToStart: { layout: 'floating', elevation: { shadow: 'md', border: true } },
        },
      }),
    );
    const style = mastheadStyle(m)!;
    for (const decl of [
      '--masthead-at-start-height: 6rem',
      '--masthead-at-start-inset: 0px',
      '--masthead-at-start-radius: 0px',
      '--masthead-at-start-bg: transparent',
      '--masthead-at-start-blur: none',
      '--masthead-at-start-shadow: none',
      '--masthead-at-start-border-color: transparent',
      '--masthead-scrolling-to-start-inset: 1rem',
      '--masthead-scrolling-to-start-radius: var(--br-panel, 1rem)',
      '--masthead-scrolling-to-start-shadow: var(--shadow-md)',
      '--masthead-scrolling-to-start-border-color: var(--tone-border, var(--color-border-surface))',
    ])
      expect(style, decl).toContain(decl);
  });

  it('rejects an unknown state and unsafe state values', () => {
    expect(() => resolveMasthead(cfg({ states: { atMiddle: { hidden: true } } }))).toThrow(
      /atMiddle/,
    );
    expect(() => resolveMasthead(cfg({ states: { atStart: { height: '4rem;}' } } }))).toThrow(
      /plain CSS length/,
    );
    expect(() => resolveMasthead(cfg({ states: { atStart: { color: 'red' } } }))).toThrow(/color/);
    expect(() =>
      resolveMasthead(cfg({ states: { atStart: { elevation: { shadow: 'x;y' } } } })),
    ).toThrow(/shadow/);
  });

  it('names where each removed scroll-behaviour field moved', () => {
    expect(() => resolveMasthead(cfg({ behavior: 'reveal-on-scroll' }))).toThrow(
      /states\.atStart\.hidden/,
    );
    expect(() => resolveMasthead(cfg({ behavior: 'hide-on-scroll' }))).toThrow(
      /states\.scrollingToEnd\.hidden/,
    );
    expect(() => resolveMasthead(cfg({ surface: 'transparent-until-scrolled' }))).toThrow(
      /states\.atStart\.surface/,
    );
    expect(() => resolveMasthead(cfg({ elevation: { onScroll: true } }))).toThrow(
      /states\.atStart\.elevation/,
    );
    expect(() => resolveMasthead(undefined, { behavior: 'hide-on-scroll' } as never)).toThrow(
      /states/,
    );
  });

  it('resolves site.chrome.backToTop', () => {
    const c = (backToTop: unknown) => ({ site: { chrome: { backToTop } } }) as never;
    expect(resolveBackToTop(undefined)).toBeUndefined();
    expect(resolveBackToTop(c(false))).toBeUndefined();
    expect(resolveBackToTop(c(true))).toEqual({ label: 'Back to top', target: '#top' });
    expect(resolveBackToTop(c({ label: 'Up', target: '#main' }))).toEqual({
      label: 'Up',
      target: '#main',
    });
    expect(() => resolveBackToTop(c({ target: 'javascript:x' }))).toThrow(/anchor/);
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
