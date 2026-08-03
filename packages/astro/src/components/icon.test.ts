import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(join(HERE, rel), 'utf8');

const icon = read('./Icon.astro');

/**
 * Same hand-duplication hazard as `HeadData`: an ambient `declare module` in a
 * standalone shipped .d.ts can't import from src, so the type and the runtime
 * payload are written twice and nothing but this test makes them agree.
 */
describe('virtual:getvitops/icons declaration', () => {
  const keys = (src: string, name: string) => {
    const body = new RegExp(`interface ${name} \\{([\\s\\S]*?)\\n {0,2}\\}`).exec(src)?.[1];
    expect(body, `both files must declare an \`interface ${name}\``).toBeTruthy();
    return new Set(
      [...String(body).matchAll(/^\s*(\w+)\??:/gm)].map((m) => m[1]).filter((k) => k !== undefined),
    );
  };

  it('declares exactly the fields the integration serialises', () => {
    expect([...keys(read('../../virtual.d.ts'), 'IconsData')].sort()).toEqual(
      [...keys(read('../integration.ts'), 'IconsData')].sort(),
    );
  });
});

/**
 * The static-import trap, which is the reason this component exists at all.
 *
 * `astro-icon` is an OPTIONAL peer. Popover/Details/Drawer imported
 * `astro-icon/components` at module scope, so the module was resolved whether or
 * not an icon ever rendered — which made all three hard-fail for any consumer
 * who hadn't installed it. Every engine load must stay dynamic.
 */
describe('optional-peer safety', () => {
  it('does not reference an icon integration at all', () => {
    // Stronger than "no static import": <Icon /> reads the collection directly,
    // so neither astro-icon nor astro-iconset is in its module graph. It can't
    // be, either — astro-icon's ./components entry is a .ts file Vite must
    // transform, so a *dynamic* import compiles nothing and hands Node raw TS,
    // which fails silently and renders an empty box. That was a real bug.
    // Checked against code only — the docblock above deliberately spells out the
    // failed dynamic-import approach, and matching that would be a false alarm.
    const code = icon.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(code).not.toMatch(/from\s+'astro-icons?(et)?/);
    expect(code).not.toMatch(/import\(\s*'astro-icons?(et)?/);
  });

  it('holds for the three components that previously did', () => {
    for (const name of ['Popover', 'Details', 'Drawer']) {
      const src = read(`./${name}.astro`);
      expect(src, `${name}.astro must not statically import an icon engine`).not.toMatch(
        /from\s+'astro-icons?(et)?\/components'/,
      );
      expect(src).toContain("from './Icon.astro'");
    }
  });
});

describe('rendering contract', () => {
  it('wraps every icon in the framework .icon box', () => {
    // .icon is what sizes the glyph in `em` and stretches the child svg; a start
    // or end adornment on .cta/.btn is then child order, not a new class.
    expect(icon).toMatch(/class:list=\{\['icon'/);
  });

  it('hides decorative icons and names labelled ones', () => {
    expect(icon).toContain("'aria-hidden': 'true'");
    expect(icon).toContain("role: 'img'");
  });

  it('warns rather than throwing on an unresolvable name', () => {
    // A missing glyph must never 500 an SSR page — `vitops icons` is where a
    // bad name fails the build instead.
    expect(icon).toMatch(/catch\s*\{/);
    expect(icon).not.toMatch(/throw new Error/);
  });

  it('imports the sprite id grammar rather than restating it', () => {
    // `ph:caret-down` → `ph--caret-down`. Sharing the generator's spriteId()
    // removes the drift entirely; a local copy would resolve <use> to nothing
    // the moment the grammar moved, and render as an empty box, not an error.
    expect(icon).toMatch(/import \{[^}]*spriteId[^}]*\} from '@getvitops\/generator'/);
    expect(icon).toContain('spriteId(qualified)');
  });
});
