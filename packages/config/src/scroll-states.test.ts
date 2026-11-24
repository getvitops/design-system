import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SCROLL_STATES, scrollStateQuery, scrollStateSlug } from './scroll-states.ts';

const CSS = join(import.meta.dirname, '..', '..', 'core', 'css', 'patterns');
const css = (f: string) => readFileSync(join(CSS, f), 'utf8');

describe('scroll states', () => {
  it('spells states in kebab-case for custom-property names', () => {
    expect(SCROLL_STATES.map(scrollStateSlug)).toEqual([
      'at-start',
      'at-end',
      'scrolling-to-end',
      'scrolling-to-start',
    ]);
  });

  it('maps each state to one query, per axis', () => {
    expect(scrollStateQuery('atStart')).toBe('not scroll-state(scrollable: block-start)');
    expect(scrollStateQuery('scrollingToEnd', 'inline')).toBe('scroll-state(scrolled: inline-end)');
  });

  // A pattern uses the states that mean something for it; `.scroll-edges` has no "last scroll
  // direction" look, only whether there is more to scroll each way.
  it.each([
    ['masthead.css', 'block', SCROLL_STATES],
    ['scroll-edges.css', 'inline', ['atStart', 'atEnd'] as const],
  ] as const)('%s uses the query each state names', (file, axis, states) => {
    const source = css(file);
    for (const state of states) {
      expect(source, `${file} ${state}`).toContain(scrollStateQuery(state, axis));
    }
  });
});
