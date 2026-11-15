import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vite-plus/test';

/**
 * An engine without `:popover-open` (Safari below 17, Firefox below 125, exactly the engines that
 * load the Popover polyfill) drops any rule whose selector contains it: not just that term but the
 * whole rule, or the whole selector LIST. So every open-state rule the framework writes was lost
 * there, and the narrow site-nav drawer opened and stayed invisible.
 *
 * The polyfill cannot define the pseudo-class; it marks an open popover with the class
 * `.\:popover-open` instead. Pairing the two inside `:is()` (which parses forgivingly, so the
 * unknown half is dropped on its own) is what makes one rule work everywhere.
 */
const PAIRED = ':is(:popover-open, .\\:popover-open)';
const CSS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'css');

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'generated' ? [] : files(path);
    return entry.name.endsWith('.css') ? [path] : [];
  });
}

/** Source with comments removed, so prose that mentions the selector is not a violation. */
const code = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, '');

describe('popover pseudo-class pairing', () => {
  it('scans the partials (not vacuous)', () => {
    const all = files(CSS_DIR).map((f) => code(readFileSync(f, 'utf8')));
    expect(all.filter((text) => text.includes(':popover-open')).length).toBeGreaterThan(5);
  });

  it('never writes a bare :popover-open outside the paired form', () => {
    const offenders: string[] = [];
    for (const file of files(CSS_DIR)) {
      const text = code(readFileSync(file, 'utf8')).split(PAIRED).join('');
      if (text.includes(':popover-open')) offenders.push(file.slice(CSS_DIR.length + 1));
    }
    expect(offenders).toEqual([]);
  });
});
