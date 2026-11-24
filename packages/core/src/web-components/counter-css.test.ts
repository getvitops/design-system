import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../../css/patterns/counter.css', import.meta.url), 'utf8');

describe('counter.css', () => {
  it('hides the real value while running without relying on the .sr-only utility', () => {
    const rule = /\.counter__value\.sr-only\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(rule).toContain('clip-path: inset(50%)');
    expect(rule).toContain('position: absolute');
    expect(rule).not.toMatch(/display:\s*none|visibility:\s*hidden/);
  });
});
