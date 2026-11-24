import { describe, expect, it } from 'vite-plus/test';
import {
  accentRuns,
  headingTag,
  outlineTag,
  lines,
  linkRuns,
  outline,
  OUTLINE_MAX_DEPTH,
  OUTLINE_MAX_NODES,
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

describe('outline', () => {
  const labels = (nodes: ReturnType<typeof outline>): unknown[] =>
    nodes.map((n) => (n.children ? [n.label, labels(n.children)] : n.label));

  it('nests by indentation and ignores bullets', () => {
    expect(labels(outline('- src\n  - index.ts\n  - util\n    - a.ts\n- package.json'))).toEqual([
      ['src', ['index.ts', ['util', ['a.ts']]]],
      'package.json',
    ]);
  });

  it('only cares that a line is deeper than the one above, not by how much', () => {
    expect(labels(outline('a\n  b\n      c\n    d\ne'))).toEqual([['a', [['b', ['c', 'd']]]], 'e']);
  });

  it('treats a tab as indentation', () => {
    expect(labels(outline('a\n\tb'))).toEqual([['a', ['b']]]);
  });

  it('splits a badge off with the first |', () => {
    expect(outline('index.ts | entry | main')).toEqual([
      { label: 'index.ts', badge: 'entry | main' },
    ]);
    expect(outline('plain')).toEqual([{ label: 'plain' }]);
  });

  it('skips blank lines and lines with no label', () => {
    expect(labels(outline('a\n\n   \n| only a badge\nb'))).toEqual(['a', 'b']);
  });

  it('is empty for nothing', () => {
    expect(outline('')).toEqual([]);
    expect(outline(undefined)).toEqual([]);
  });

  it('derives unique ids from a prefix, and none without one', () => {
    const tree = outline('Docs\nDocs\nA & B', { idPrefix: 't1' });
    expect(tree.map((n) => n.id)).toEqual(['t1-docs', 't1-docs-2', 't1-a-b']);
    expect(outline('Docs')[0]).not.toHaveProperty('id');
  });

  it('never produces raw HTML, whatever is typed', () => {
    const [node] = outline('<img src=x onerror=alert(1)> | <b>x</b>');
    expect(Object.keys(node!).sort()).toEqual(['badge', 'label']);
    expect(node).not.toHaveProperty('descriptionHtml');
  });

  it('caps the node count and the depth instead of failing', () => {
    const many = Array.from({ length: OUTLINE_MAX_NODES + 50 }, (_, i) => `n${i}`).join('\n');
    const count = (nodes: ReturnType<typeof outline>): number =>
      nodes.reduce((n, x) => n + 1 + count(x.children ?? []), 0);
    expect(count(outline(many))).toBe(OUTLINE_MAX_NODES);

    const deep = Array.from({ length: 12 }, (_, i) => `${'  '.repeat(i)}l${i}`).join('\n');
    const depth = (nodes: ReturnType<typeof outline>): number =>
      nodes.length ? 1 + Math.max(...nodes.map((n) => depth(n.children ?? []))) : 0;
    expect(depth(outline(deep))).toBeLessThanOrEqual(OUTLINE_MAX_DEPTH);
    expect(count(outline(deep))).toBe(12);
  });
});
