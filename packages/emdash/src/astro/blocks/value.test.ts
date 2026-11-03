import { describe, expect, it } from 'vite-plus/test';
import { paragraphs, rows, safeHref, text } from './value.ts';

describe('safeHref', () => {
  it.each([
    'https://example.com/a?b=1',
    'http://example.com',
    'mailto:hi@example.com',
    'tel:+16135550100',
    '/contact',
    './x',
    '../x',
    '#top',
    '?q=1',
    '//cdn.example.com/x',
  ])('allows %s', (href) => {
    expect(safeHref(href)).toBe(href);
  });

  it.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    ' javascript:alert(1)',
    'java\tscript:alert(1)',
    'java\nscript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:x',
  ])('rejects %j', (href) => {
    expect(safeHref(href)).toBeUndefined();
  });

  it('treats empty and non-string values as absent', () => {
    expect(safeHref('')).toBeUndefined();
    expect(safeHref('   ')).toBeUndefined();
    expect(safeHref(undefined)).toBeUndefined();
    expect(safeHref(42)).toBeUndefined();
  });
});

describe('repeater helpers', () => {
  it('rows keeps object rows and drops everything else', () => {
    expect(rows([{ a: 1 }, null, 'x', [1], { b: 2 }])).toEqual([{ a: 1 }, { b: 2 }]);
    expect(rows(undefined)).toEqual([]);
    expect(rows('not an array')).toEqual([]);
  });

  it('text trims strings and treats other values as empty', () => {
    expect(text('  hi ')).toBe('hi');
    expect(text(5)).toBe('');
    expect(text(undefined)).toBe('');
  });

  it('paragraphs splits on blank lines only', () => {
    expect(paragraphs('one\ntwo\n\n three \n\n\n')).toEqual(['one\ntwo', 'three']);
    expect(paragraphs('')).toEqual([]);
  });
});
