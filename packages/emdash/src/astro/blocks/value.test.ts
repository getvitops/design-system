import { describe, expect, it } from 'vite-plus/test';
import { paragraphs, rows, text } from './value.ts';

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
