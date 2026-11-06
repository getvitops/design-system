import { describe, expect, it } from 'vitest';
import { prerenderProblem } from './prerender-check.ts';

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
