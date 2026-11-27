import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vite-plus/test';

const here = dirname(fileURLToPath(import.meta.url));

/** The `:is(…)` list of the "block-level children are a block gap apart" rule, as a sorted set. */
function blockGapList(source: string): string[] {
  const flat = source.replace(/\s+/g, ' ');
  const m = /\.rhythm > \* \+ :is\(\s*(wc-cards[^)]*?)\s*\) \{/.exec(flat);
  if (!m) throw new Error('block-gap rule not found');
  return m[1]!
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
    .sort();
}

describe('.rhythm block-gap selector', () => {
  it('lists the same children in the tailwind output as in the framework CSS', () => {
    // The tailwind format re-emits this rule from `generate.ts` rather than from the partial, so
    // the two copies drift: `.form-block`, `.callout` and `.logos-block` were missing from it.
    const css = readFileSync(join(here, '../../core/css/layout.css'), 'utf8');
    const generated = readFileSync(join(here, 'generate.ts'), 'utf8');
    expect(blockGapList(generated)).toEqual(blockGapList(css));
  });
});
