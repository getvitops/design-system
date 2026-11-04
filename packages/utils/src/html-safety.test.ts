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
