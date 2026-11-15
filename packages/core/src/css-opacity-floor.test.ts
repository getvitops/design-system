import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vite-plus/test';

/**
 * Dimming with `opacity` is a way to make secondary text and icons, and it quietly sidesteps the
 * build-time contrast gate: the gate checks a token against its surface, not the blend.
 *
 * Measured for the shipped palette (`--color-text-surface` on `--color-bg-surface`), the blend
 * keeps WCAG 2 text contrast (4.5:1) from about 0.7 up (5.7:1 light, 7.4:1 dark) and fails below
 * 0.6 (4.2:1 light), and keeps the 3:1 UI-component bar from about 0.5 up. So the floor here is
 * 0.7 for anything informational. Opacity is used rather than a fixed muted token on purpose: a
 * token such as `--color-text-surface-muted` would be unreadable inside a `.tone--solid` band,
 * while a blend over `currentColor` follows whatever colour the block is.
 *
 * A declaration below the floor must be one of the things the rule does not apply to, named here
 * with the reason. Adding to this list is the point at which someone has to say why.
 */
const FLOOR = 0.7;

/** A selector that is allowed to sit below the floor, and why. */
const EXEMPT: { match: RegExp; why: string }[] = [
  {
    match: /:disabled|\[aria-disabled|\[disabled/,
    why: 'disabled controls are exempt from contrast',
  },
  {
    match: /::before|::after|::scroll-marker|::column/,
    why: 'generated decoration, not information',
  },
  { match: /__icon\b|__chevron|search-icon/, why: 'decorative adornment (aria-hidden)' },
  { match: /--dragging/, why: 'transient drag state' },
  { match: /star--empty/, why: 'the complement of a rating, repeated as text' },
  { match: /text-scramble__char/, why: 'a visual effect over text that is also in the DOM' },
  { match: /splitter__handle|&:focus-visible/, why: 'handle grip decoration' },
];

const CSS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'css');

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'generated' ? [] : files(path);
    return entry.name.endsWith('.css') ? [path] : [];
  });
}

interface Hit {
  file: string;
  line: number;
  value: number;
  selectors: string;
}

function lowOpacities(): Hit[] {
  const hits: Hit[] = [];
  for (const file of files(CSS_DIR)) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((text, index) => {
      const m = /^\s*opacity:\s*(0?\.\d+)\s*;/.exec(text);
      if (!m) return;
      const value = Number(m[1]);
      if (value >= FLOOR) return;
      // The two nearest enclosing rule heads, which names nested selectors (`&:disabled`).
      const heads: string[] = [];
      for (let i = index - 1; i >= 0 && heads.length < 3; i--) {
        const line = lines[i]!.trim();
        if (line.endsWith('{') && !line.startsWith('/*') && !line.startsWith('*')) heads.push(line);
      }
      // Keyframe steps (`50% {`) are animation frames, not a resting colour.
      if (heads[0] && /^\d+%\s*\{$|^(from|to)\s*\{$/.test(heads[0])) return;
      hits.push({
        file: file.slice(CSS_DIR.length + 1),
        line: index + 1,
        value,
        selectors: heads.join(' | '),
      });
    });
  }
  return hits;
}

describe('opacity floor for informational dimming', () => {
  it('finds the declarations at all (the scan is not vacuous)', () => {
    expect(files(CSS_DIR).length).toBeGreaterThan(20);
    expect(lowOpacities().length).toBeGreaterThan(5);
  });

  it(`keeps every non-exempt opacity at or above ${FLOOR}`, () => {
    const offenders = lowOpacities().filter(
      (hit) => !EXEMPT.some((rule) => rule.match.test(hit.selectors)),
    );
    expect(
      offenders.map((h) => `${h.file}:${h.line} opacity ${h.value} <- ${h.selectors}`),
    ).toEqual([]);
  });
});
