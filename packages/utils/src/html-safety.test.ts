import { describe, expect, it } from 'vite-plus/test';
import { nodesToHtml, toHtml } from './html.ts';

describe('nodesToHtml input validation', () => {
  it('rejects tag names that could break out of the tag', () => {
    expect(() => nodesToHtml([{ tag: 'img src=x onerror=alert(1)', text: 'x' }])).toThrow(
      /invalid tag name/,
    );
    expect(() => toHtml({ tag: 'b><script', text: 'x' })).toThrow(/invalid tag name/);
  });

  it('rejects attribute names that could break out of the tag, and event handlers', () => {
    expect(() => nodesToHtml([{ tag: 'p', attrs: { 'x onclick=1': 'a' }, text: 'x' }])).toThrow(
      /invalid attribute name/,
    );
    expect(() => nodesToHtml([{ tag: 'p', attrs: { onclick: 'alert(1)' }, text: 'x' }])).toThrow(
      /event-handler/,
    );
  });

  it('drops an unsafe URL value and keeps a safe one', () => {
    expect(nodesToHtml([{ tag: 'a', attrs: { href: 'javascript:alert(1)' }, text: 'x' }])).toBe(
      '<a>x</a>',
    );
    expect(nodesToHtml([{ tag: 'a', attrs: { href: '/a?b=1&c=2' }, text: 'x' }])).toBe(
      '<a href="/a?b=1&amp;c=2">x</a>',
    );
    expect(nodesToHtml([{ tag: 'img', attrs: { src: 'data:text/html,x' } }])).toBe('<img>');
  });
});

describe('nodesToHtml tag denylist and style escaping', () => {
  it.each(['script', 'style', 'iframe', 'object', 'embed', 'template', 'base', 'meta', 'link'])(
    'refuses <%s> in a data tree',
    (tag) => {
      expect(() => nodesToHtml([{ tag, text: 'x' }])).toThrow(/not allowed/);
    },
  );

  it('refuses a denied tag regardless of case, and nested inside an allowed one', () => {
    expect(() => nodesToHtml([{ tag: 'SCRIPT', text: 'x' }])).toThrow(/not allowed/);
    expect(() =>
      nodesToHtml([{ tag: 'div', children: [{ tag: 'iframe', attrs: { src: '/x' } }] }]),
    ).toThrow(/not allowed/);
    expect(() => toHtml({ tag: 'script', text: 'x' })).toThrow(/not allowed/);
  });

  it('still renders ordinary content tags', () => {
    expect(nodesToHtml([{ tag: 'p', children: ['a', { tag: 'strong', text: 'b' }] }])).toBe(
      '<p>a<strong>b</strong></p>',
    );
  });

  it('escapes a quote in an object-form style so it cannot close the attribute', () => {
    const out = nodesToHtml([
      { tag: 'p', attrs: { style: { color: 'red" onmouseover="alert(1)' } }, text: 'x' },
    ]);
    expect(out).toBe('<p style="color: red&quot; onmouseover=&quot;alert(1)">x</p>');
    expect(out.match(/"/g)).toHaveLength(2);
  });
});
