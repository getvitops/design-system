import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vite-plus/test';
import { ELEMENTS } from './element-tags.ts';

const here = dirname(fileURLToPath(import.meta.url));
const components = join(here, '../web-components');

/** `customElements.define('wc-x', …)` → file, over every component source. */
function defined(): Map<string, string> {
  const out = new Map<string, string>();
  for (const file of readdirSync(components).filter((f) => /^WC\w+\.ts$/.test(f))) {
    for (const m of readFileSync(join(components, file), 'utf8').matchAll(
      /customElements\.define\(\s*['"](wc-[\w-]+)['"]/g,
    ))
      out.set(m[1]!, file.replace(/\.ts$/, ''));
  }
  return out;
}

describe('ELEMENTS', () => {
  it('points every tag at the source file that defines it', () => {
    const real = defined();
    for (const [tag, { source }] of Object.entries(ELEMENTS))
      expect(real.get(tag), tag).toBe(source);
  });

  it('names only known tags as dependencies, and none twice or on itself', () => {
    for (const [tag, { dependencies }] of Object.entries(ELEMENTS)) {
      expect(new Set(dependencies).size, tag).toBe(dependencies.length);
      for (const dep of dependencies) {
        expect(dep, tag).not.toBe(tag);
        expect(ELEMENTS, `${tag} depends on ${dep}`).toHaveProperty(dep);
      }
    }
  });

  it('mirrors each class `static dependencies` in the table', () => {
    for (const [tag, { source, dependencies }] of Object.entries(ELEMENTS)) {
      const text = readFileSync(join(components, `${source}.ts`), 'utf8');
      const m = /static override dependencies\s*=\s*\[([^\]]*)\]/.exec(text);
      const declared = m ? [...m[1]!.matchAll(/['"]([\w-]+)['"]/g)].map((x) => x[1]) : [];
      expect(declared, tag).toEqual([...dependencies]);
    }
  });
});
