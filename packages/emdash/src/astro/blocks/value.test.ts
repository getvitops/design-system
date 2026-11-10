import { describe, expect, it } from 'vite-plus/test';
import {
  accentRuns,
  headingTag,
  outlineTag,
  lines,
  linkRuns,
  pairs,
  paragraphs,
  rows,
  text,
} from './value.ts';

describe('editor-text helpers', () => {
  it('headingTag clamps to h2-h6 and falls back', () => {
    expect(headingTag('3')).toBe('h3');
    expect(headingTag(1)).toBe('h2');
    expect(headingTag(9, 4)).toBe('h4');
    expect(headingTag(undefined)).toBe('h2');
  });

  it('linkRuns makes links, drops unsafe hrefs and leaves HTML literal', () => {
    expect(linkRuns('pay [less](/a) for <b>x</b>')).toEqual([
      { text: 'pay ' },
      { text: 'less', href: '/a' },
      { text: ' for <b>x</b>' },
    ]);
    expect(linkRuns('[x](javascript:alert)')).toEqual([{ text: 'x' }]);
  });

  it('accentRuns marks starred runs', () => {
    expect(accentRuns('Two. *One team.*')).toEqual([
      { text: 'Two. ', accent: false },
      { text: 'One team.', accent: true },
    ]);
    expect(accentRuns('lone * star')).toEqual([{ text: 'lone * star', accent: false }]);
  });

  it('pairs and lines split editor fields', () => {
    expect(pairs('Mon | 9-5\n\nTue|closed\nnote')).toEqual([
      { term: 'Mon', value: '9-5' },
      { term: 'Tue', value: 'closed' },
      { term: 'note', value: '' },
    ]);
    expect(lines(' a \n\nb')).toEqual(['a', 'b']);
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

describe('outlineTag', () => {
  it('allows h1 through h6', () => {
    expect(outlineTag('1')).toBe('h1');
    expect(outlineTag(6)).toBe('h6');
  });
  it('returns p for a heading that is not in the outline', () => {
    expect(outlineTag('p')).toBe('p');
    expect(outlineTag(' P ')).toBe('p');
  });
  it('falls back for anything else', () => {
    expect(outlineTag(undefined, 1)).toBe('h1');
    expect(outlineTag(9)).toBe('h2');
    expect(outlineTag('x', 3)).toBe('h3');
  });
});
