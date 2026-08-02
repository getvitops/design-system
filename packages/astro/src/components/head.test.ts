import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The colour-scheme storage key exists twice by necessity: once in
 * `WCColorSchemeToggle` (which writes it) and once inlined into `<Head />`'s
 * pre-paint script (which reads it before the component loads). They can't share
 * an import — @getvitops/core exports only prebuilt bundles and CSS, and the Head
 * script has to be a string literal in the emitted HTML.
 *
 * If they drift, nothing throws: the toggle keeps working within a page and the
 * theme silently stops persisting across navigations. Hence this guard.
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(join(HERE, rel), 'utf8');

const head = read('./Head.astro');
const toggle = read('../../../core/src/web-components/WCColorSchemeToggle.ts');

describe('<Head /> pre-paint colour-scheme script', () => {
  it('uses the same storage key as WCColorSchemeToggle', () => {
    const declared = /STORAGE_KEY\s*=\s*'([^']+)'/.exec(toggle)?.[1];
    expect(declared, 'WCColorSchemeToggle must declare STORAGE_KEY').toBeTruthy();
    expect(head, `Head.astro must inline the key '${declared}'`).toContain(`'${declared}'`);
  });

  it('applies the scheme before the deferred element bundle', () => {
    // Order matters: if the element script came first the page could paint light.
    expect(head.indexOf('localStorage.getItem')).toBeLessThan(head.indexOf('elements.js'));
  });

  it('sets the attribute the generated dark block actually matches', () => {
    // The dark flip keys off [data-theme="dark"]; writing any other attribute
    // would leave the page light (this was a real bug — see generate.ts DARK_SEL).
    expect(head).toContain('documentElement.dataset.theme');
  });

  it('tolerates storage being unavailable', () => {
    expect(head).toMatch(/try\{[\s\S]*catch/);
  });
});

/**
 * `virtual.d.ts` hand-duplicates `HeadData` — an ambient `declare module` in a
 * standalone shipped .d.ts can't import from src. Nothing enforced agreement, and
 * the two duly drifted: `editor` was added to the runtime data and read by
 * Head.astro while the declared type never learned about it, so the field
 * type-checked as an error in consumer projects that don't set skipLibCheck.
 */
describe('virtual:getvitops/head declaration', () => {
  const keys = (src: string) => {
    const body = /interface HeadData \{([\s\S]*?)\n {0,2}\}/.exec(src)?.[1];
    expect(body, 'both files must declare an `interface HeadData`').toBeTruthy();
    return new Set(
      [...String(body).matchAll(/^\s*(\w+)\??:/gm)].map((m) => m[1]).filter((k) => k !== undefined),
    );
  };

  it('declares exactly the fields the integration serialises', () => {
    expect([...keys(read('../../virtual.d.ts'))].sort()).toEqual(
      [...keys(read('../integration.ts'))].sort(),
    );
  });
});
