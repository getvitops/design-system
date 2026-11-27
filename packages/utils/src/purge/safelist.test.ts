import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vite-plus/test';
import { DYNAMIC_ATTRIBUTES, purgeStylesheet } from './index.ts';

const coreCss = join(dirname(fileURLToPath(import.meta.url)), '../../../core/css');

function cssFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? cssFiles(join(dir, entry.name))
      : entry.name.endsWith('.css')
        ? [join(dir, entry.name)]
        : [],
  );
}

describe('purge safelist', () => {
  it('lists every data-* / aria-* attribute the core CSS selects on', () => {
    const used = new Set<string>();
    for (const file of cssFiles(coreCss))
      for (const m of readFileSync(file, 'utf8').matchAll(/\[((?:data|aria)-[a-z][a-z-]*)/g))
        used.add(m[1]!);
    const missing = [...used].filter((a) => !(DYNAMIC_ATTRIBUTES as readonly string[]).includes(a));
    expect(missing).toEqual([]);
  });
});

describe('purgeStylesheet', () => {
  const css = `
    .used { color: red }
    .unused { color: blue }
    :root[data-contrast=more] .used { color: black }
    .drawer:is(:popover-open, .\\:popover-open) { display: block }
    a[href=\\#anchor] { color: green }
    .combobox--enhanced { display: grid }
    .is-active { outline: 1px solid }
    @keyframes spin { to { opacity: 1 } }
  `;
  const html = ['<main class="used drawer"><a href="#anchor">x</a></main>'];

  it('drops unused rules and keeps state rules a page cannot show at build time', async () => {
    const out = await purgeStylesheet({
      css,
      html,
      js: ['el.classList.add("combobox--enhanced")'],
    });
    expect(out).not.toContain('.unused');
    expect(out).toContain('.used');
    expect(out).toContain('data-contrast');
    expect(out).toContain('popover-open');
    expect(out).toContain('anchor');
    expect(out).toContain('.combobox--enhanced');
    expect(out).toContain('.is-active');
    expect(out).toContain('@keyframes spin');
  });

  it('drops a runtime class when no script mentions it', async () => {
    const out = await purgeStylesheet({ css, html, js: [] });
    expect(out).not.toContain('.combobox--enhanced');
  });
});
