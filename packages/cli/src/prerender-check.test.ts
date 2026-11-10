import { describe, expect, it } from 'vitest';
import {
  h1Count,
  missingBlockComponents,
  missingTypeRoleRules,
  prerenderProblem,
} from './prerender-check.ts';

describe('prerenderProblem', () => {
  it('accepts a real page', () => {
    expect(prerenderProblem('<!doctype html><html><head><title>Home</title></head></html>')).toBe(
      undefined,
    );
  });
  it('rejects the pending-migrations body', () => {
    expect(prerenderProblem('Database migrations are required. Run emdash migrate.')).toMatch(
      /pending-migrations/,
    );
  });
  it('rejects a bare text response', () => {
    expect(prerenderProblem('Internal Server Error')).toMatch(/not an HTML document/);
  });
  it('rejects a document with no title', () => {
    expect(prerenderProblem('<html><body>hi</body></html>')).toMatch(/no <title>/);
  });
});

describe('missingTypeRoleRules', () => {
  const page = '<p class="stats__figure font-display">11</p><p class="font-heading x">a</p>';

  it('names a type role the stylesheet has no rule for', () => {
    expect(missingTypeRoleRules(page, '.font-heading{font-size:1rem}')).toEqual(['font-display']);
  });
  it('is quiet when every used role is defined, in minified css too', () => {
    expect(missingTypeRoleRules(page, '.font-display{a:b}.font-heading,.x{c:d}')).toEqual([]);
  });
  it('does not treat a longer class as the role', () => {
    expect(missingTypeRoleRules('<i class="font-display">', '.font-display-x{a:b}')).toEqual([
      'font-display',
    ]);
  });
  it('ignores classes outside the type roles', () => {
    expect(missingTypeRoleRules('<i class="font-bold">', '')).toEqual([]);
  });
});

describe('missingBlockComponents', () => {
  it('lists each missing block type once', () => {
    const log = [
      'warn PortableText [components.type] is missing "vitops_cards"',
      '\u001b[33mPortableText [components.type] is missing "vitops_cards"\u001b[39m',
      'PortableText [components.type] is missing "vitops_actionLink"',
      'something else',
    ].join('\n');
    expect(missingBlockComponents(log)).toEqual(['vitops_actionLink', 'vitops_cards']);
  });
  it('is empty for a clean build', () => {
    expect(missingBlockComponents('built 12 pages')).toEqual([]);
  });
});

describe('h1Count', () => {
  it('counts live h1s only', () => {
    expect(h1Count('<h1>a</h1><h1 class="x">b</h1>')).toBe(2);
    expect(h1Count('<p>x</p><!-- <h1>c</h1> --><template><h1>d</h1></template>')).toBe(0);
    expect(h1Count('<h1>one</h1>')).toBe(1);
  });
});
