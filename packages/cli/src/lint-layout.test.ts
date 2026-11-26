import { describe, expect, it } from 'vite-plus/test';
import { fixMainLayout, lintFooterLayout, lintMainLayout } from './lint-layout.ts';

const at = (path: string, text: string) => [{ path, text }];

describe('main.centered', () => {
  it('flags a centered main as an error, with its line', () => {
    const [f] = lintMainLayout(
      at('Layout.astro', '<body>\n<main id="main" class="centered rhythm">\n</main>'),
    );
    expect(f?.severity).toBe('error');
    expect(f?.line).toBe(2);
    expect(f?.suggestion).toContain('--fix');
  });

  it('is quiet on a plain main and on centered used elsewhere', () => {
    expect(
      lintMainLayout(at('a.astro', '<main id="main"><div class="centered"></div></main>')),
    ).toEqual([]);
    expect(lintMainLayout(at('a.astro', '<main class="rhythm"></main>'))).toEqual([]);
  });

  it('ignores non-markup files', () => {
    expect(lintMainLayout(at('notes.md', '<main class="centered">'))).toEqual([]);
  });

  it('removes only the centered token', () => {
    expect(fixMainLayout('<main id="main" class="centered rhythm">x</main>')).toBe(
      '<main id="main" class="rhythm">x</main>',
    );
  });

  it('drops the class attribute when centered was the only class', () => {
    expect(fixMainLayout('<main id="main" class="centered">x</main>')).toBe(
      '<main id="main">x</main>',
    );
    expect(fixMainLayout('<main class="centered">x</main>')).toBe('<main>x</main>');
  });

  it('leaves other elements and mains without it alone', () => {
    const src = '<div class="centered"></div><main class="rhythm"></main>';
    expect(fixMainLayout(src)).toBe(src);
  });
});

describe('SiteFooter.centered', () => {
  it('flags a centered footer, even across lines', () => {
    const [f] = lintFooterLayout(
      at('Layout.astro', '<SiteFooter\n  class="centered"\n  name={n}\n/>'),
    );
    expect(f?.cls).toBe('SiteFooter.centered');
    expect(f?.severity).toBe('error');
    expect(f?.line).toBe(1);
  });

  it('is quiet without the token', () => {
    expect(lintFooterLayout(at('a.astro', '<SiteFooter class="spotlight" name={n} />'))).toEqual(
      [],
    );
    expect(lintFooterLayout(at('a.astro', '<SiteFooter name={n} />'))).toEqual([]);
  });

  it('--fix removes only the token', () => {
    expect(fixMainLayout('<SiteFooter class="centered x" name={n} />')).toBe(
      '<SiteFooter class="x" name={n} />',
    );
    expect(fixMainLayout('<SiteFooter class="centered" name={n} />')).toBe(
      '<SiteFooter name={n} />',
    );
  });
});
