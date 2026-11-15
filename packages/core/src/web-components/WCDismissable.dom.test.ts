/**
 * @vitest-environment happy-dom
 *
 * `<wc-dismissable>` hands focus to a neighbour instead of dropping it to <body>.
 * `exit="0"` skips the fade so removal is synchronous; the fade path shares `#detach()`.
 */
import { beforeAll, beforeEach, describe, expect, it } from 'vite-plus/test';

beforeAll(async () => {
  await import('./WCDismissable.ts');
});

beforeEach(() => {
  document.body.innerHTML = '';
});

const mount = (html: string): void => {
  document.body.innerHTML = html;
};

describe('<wc-dismissable> focus return', () => {
  it('moves focus to the next focusable after the dismissed element', () => {
    mount(`
      <a id="before" href="#a">before</a>
      <wc-dismissable exit="0"><div><button id="close" data-dismiss>x</button></div></wc-dismissable>
      <a id="after" href="#b">after</a>`);
    (document.getElementById('close') as HTMLElement).focus();
    expect(document.activeElement?.id).toBe('close');
    (document.getElementById('close') as HTMLElement).click();
    expect(document.querySelector('wc-dismissable')).toBeNull();
    expect(document.activeElement?.id).toBe('after');
  });

  it('falls back to the nearest focusable before it when nothing follows', () => {
    mount(`
      <a id="first" href="#a">first</a>
      <a id="before" href="#b">before</a>
      <wc-dismissable exit="0"><button id="close" data-dismiss>x</button></wc-dismissable>`);
    (document.getElementById('close') as HTMLElement).focus();
    (document.getElementById('close') as HTMLElement).click();
    expect(document.activeElement?.id).toBe('before');
  });

  it('does not touch focus when focus was elsewhere', () => {
    mount(`
      <a id="elsewhere" href="#a">elsewhere</a>
      <wc-dismissable exit="0"><button id="close" data-dismiss>x</button></wc-dismissable>
      <a id="after" href="#b">after</a>`);
    (document.getElementById('elsewhere') as HTMLElement).focus();
    (document.getElementById('close') as HTMLElement).click();
    expect(document.activeElement?.id).toBe('elsewhere');
  });

  it('skips inert and hidden candidates', () => {
    mount(`
      <wc-dismissable exit="0"><button id="close" data-dismiss>x</button></wc-dismissable>
      <div inert><a id="inert" href="#a">inert</a></div>
      <a id="hidden" href="#b" hidden>hidden</a>
      <a id="real" href="#c">real</a>`);
    (document.getElementById('close') as HTMLElement).focus();
    (document.getElementById('close') as HTMLElement).click();
    expect(document.activeElement?.id).toBe('real');
  });

  it('removes cleanly with no candidates at all', () => {
    mount(`<wc-dismissable exit="0"><button id="close" data-dismiss>x</button></wc-dismissable>`);
    (document.getElementById('close') as HTMLElement).focus();
    (document.getElementById('close') as HTMLElement).click();
    expect(document.querySelector('wc-dismissable')).toBeNull();
  });
});
