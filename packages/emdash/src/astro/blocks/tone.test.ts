import { describe, expect, it } from 'vite-plus/test';
import { joinStyle, resolveTone, toneChain } from './tone.ts';

describe('toneChain', () => {
  it('tries the role, then its relatives, then neutral', () => {
    expect(toneChain('brand-primary')).toEqual(['brand-primary', 'ui-primary', 'info', 'neutral']);
    expect(toneChain('danger')).toEqual(['danger', 'neutral']);
  });

  it('collapses anything that is not a role identifier to neutral', () => {
    expect(toneChain(undefined)).toEqual(['neutral']);
    expect(toneChain('red; background: url(x)')).toEqual(['neutral']);
    expect(toneChain('Danger')).toEqual(['danger', 'neutral']);
  });
});

describe('resolveTone', () => {
  it('is empty when nothing is set, so an unconfigured block stays transparent', () => {
    expect(resolveTone()).toEqual({ className: 'tone', style: '' });
    expect(resolveTone('', '')).toEqual({ className: 'tone', style: '' });
  });

  it('resolves a role to var() chains the framework tokens satisfy', () => {
    const { style } = resolveTone('brand-secondary');
    expect(style).toContain(
      '--tone-bg: var(--color-bg-brand-secondary-muted, var(--color-bg-ui-secondary-muted, var(--color-bg-info-muted, var(--color-bg-neutral-muted))))',
    );
    expect(style).toContain('--tone-fg: var(--color-text-brand-secondary,');
    // A solid chain falls back to the bare surface token for surface roles.
    expect(style).toMatch(
      /--tone-solid: var\(--color-bg-brand-secondary-solid,.*--color-bg-neutral\)/,
    );
  });

  it('lets color win and accepts a hue with or without a step', () => {
    expect(resolveTone('danger', 'amber').style).toContain('--tone-solid: var(--color-amber-600)');
    expect(resolveTone(undefined, 'amber-300').style).toContain(
      '--tone-solid: var(--color-amber-300)',
    );
  });

  it('never lets editor input escape the style attribute', () => {
    expect(resolveTone('x', 'amber); color: red').style).not.toContain('red');
    expect(resolveTone('a;b', undefined).style).not.toContain(';b');
  });
});

describe('joinStyle', () => {
  it('skips empties and returns undefined when nothing is left', () => {
    expect(joinStyle('', undefined, false)).toBeUndefined();
    expect(joinStyle('--a: 1', '', '--b: 2')).toBe('--a: 1; --b: 2');
  });
});

describe('solid fill from a hue and step', () => {
  it("takes its text from the site's -on token for that step", () => {
    expect(resolveTone('', 'amber-500').style).toContain(
      '--tone-on-solid: var(--color-amber-500-on)',
    );
    expect(resolveTone('', 'navy').style).toContain('--tone-on-solid: var(--color-navy-600-on)');
    expect(resolveTone('', 'navy').className).toBe('tone');
  });
});
