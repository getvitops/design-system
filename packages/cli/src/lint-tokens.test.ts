/**
 * The codemod half of `vitops lint`.
 *
 * The property worth protecting is **simultaneity**. The 1.0 rename table
 * contains a cycle — a surface role's backgrounds rotate — so applying the
 * entries one at a time walks a value through two renames and lands somewhere
 * the table never names. A downstream consumer got this right by hand and said
 * so; the tool should not require anyone to notice it again.
 */
import { defaultConfig, movedTokens } from '@getvitops/generator';
import { describe, expect, it } from 'vitest';
import { applyRenames, lintTokens } from './lint-tokens.ts';

const renames = movedTokens(defaultConfig().colors.roles);

describe('applyRenames', () => {
  it('rewrites in one pass, so a rotating rename cannot compound', () => {
    // Sequentially: `--surface-bg` → `--color-bg-surface-muted`, and then a
    // later pass over `--surface-bg-bold` → `--color-bg-surface` would be fine,
    // but the reverse order rewrites `--surface-bg-bold`'s prefix first. One
    // pass makes the order irrelevant.
    const out = applyRenames('a: var(--surface-bg); b: var(--surface-bg-bold);', renames);
    expect(out).toBe('a: var(--color-bg-surface-muted); b: var(--color-bg-surface);');
  });

  it('matches the longest name first', () => {
    expect(applyRenames('var(--surface-bg-bold)', renames)).toBe('var(--color-bg-surface)');
  });

  it('does not match a listed name inside a longer unlisted one', () => {
    // `--surface-text` is in the table; `--surface-text-scale` is not, and must
    // survive untouched rather than becoming `--color-text-surface-scale`.
    expect(applyRenames('var(--surface-text-scale)', renames)).toBe('var(--surface-text-scale)');
  });

  it('leaves everything else alone', () => {
    const src = '.keep { gap: var(--icon-size); color: var(--color-text-surface); }';
    expect(applyRenames(src, renames)).toBe(src);
  });

  it('is a no-op with an empty table', () => {
    expect(applyRenames('var(--surface-bg)', {})).toBe('var(--surface-bg)');
  });

  it('is idempotent', () => {
    const once = applyRenames('var(--surface-bg)', renames);
    expect(applyRenames(once, renames)).toBe(once);
  });
});

describe('lintTokens', () => {
  const scan = (text: string) => lintTokens([{ path: 'a.css', text }], renames);

  it('reports an old-grammar reference with its replacement', () => {
    const [f] = scan('.a { color: var(--brand-primary-on-solid); }');
    expect(f?.severity).toBe('error');
    expect(f?.fix).toEqual({
      from: '--brand-primary-on-solid',
      to: '--color-text-on-brand-primary',
    });
  });

  it('reports the line it is on', () => {
    expect(scan('.a {}\n.b { color: var(--surface-text); }')[0]?.line).toBe(2);
  });

  it('ignores current-grammar and non-design-system tokens', () => {
    expect(scan('.a { color: var(--color-text-surface); gap: var(--icon-size); }')).toEqual([]);
  });

  it('reports one finding per line, not per occurrence', () => {
    expect(scan('.a { a: var(--surface-text); b: var(--surface-text); }')).toHaveLength(1);
  });
});
