import { describe, expect, it } from 'vitest';
import { missingTypeRoleRules, prerenderProblem } from './prerender-check.ts';

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
