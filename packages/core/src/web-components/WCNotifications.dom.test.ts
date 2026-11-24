/**
 * @vitest-environment happy-dom
 *
 * `<wc-notifications>`: that server-rendered messages are adopted, that `show()` and the DOM event
 * build and stack notifications, that a countdown pauses and resumes, that nothing appears over an
 * open modal until it closes, that closing the one with focus hands focus on, and that what is
 * announced is only the visible text. happy-dom has no Popover API or `:modal`, so a stand-in
 * provides `showPopover`/`hidePopover` and the `:popover-open` and `:modal` matches.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { ensureAnnouncer, resetAnnouncer } from './utils/announcer.ts';
import type { WCNotifications } from './WCNotifications.ts';

const open = new WeakSet<Element>();
const modals = new WeakSet<Element>();
const realMatches = Element.prototype.matches as (this: Element, selector: string) => boolean;

beforeAll(async () => {
  (Element.prototype as { matches: unknown }).matches = function (
    this: Element,
    selector: string,
  ): boolean {
    if (selector === ':popover-open') return open.has(this);
    if (selector === ':modal') return modals.has(this);
    return realMatches.call(this, selector);
  };
  HTMLElement.prototype.showPopover = function (this: HTMLElement) {
    open.add(this);
  };
  HTMLElement.prototype.hidePopover = function (this: HTMLElement) {
    open.delete(this);
  };
  await import('./WCNotifications.ts');
});

let el: WCNotifications;
const flush = async (ms = 0) => {
  await vi.advanceTimersByTimeAsync(ms);
};
const items = () => Array.from(el.querySelectorAll<HTMLElement>(':scope > .notification'));

async function mount(inner = '', attrs = ''): Promise<void> {
  document.body.innerHTML = `<button id="before">before</button><wc-notifications ${attrs}>${inner}</wc-notifications><button id="after">after</button>`;
  el = document.querySelector('wc-notifications') as WCNotifications;
  await flush();
}

beforeEach(() => {
  vi.useFakeTimers();
  resetAnnouncer();
});

afterEach(() => {
  el?.remove();
  vi.useRealTimers();
});

describe('upgrade and the server fallback', () => {
  it('becomes a labelled region in the top layer once it holds something', async () => {
    await mount('<div class="notification" role="status">Draft saved.</div>', 'label="Messages"');
    expect(el.getAttribute('role')).toBe('region');
    expect(el.getAttribute('aria-label')).toBe('Messages');
    expect(el.getAttribute('popover')).toBe('manual');
    expect(open.has(el)).toBe(true);
  });

  it('adopts a server-rendered message: it gets a Close button and keeps its text', async () => {
    await mount('<div class="notification" role="status">Draft saved.</div>');
    const [item] = items();
    expect(item!.textContent).toContain('Draft saved.');
    expect(item!.querySelector('[data-notification-close]')).not.toBeNull();
    expect(el.count).toBe(1);
  });

  it('dismisses an adopted message after its data-duration', async () => {
    await mount('<div class="notification" role="status" data-duration="2000">Hi</div>');
    await flush(1999);
    expect(items()).toHaveLength(1);
    await flush(1);
    await flush(400);
    expect(items()).toHaveLength(0);
  });

  it('does not announce what the server already put on the page', async () => {
    await mount('<div class="notification" role="status">Draft saved.</div>');
    await flush(1000);
    expect(ensureAnnouncer().textContent).toBe('');
  });

  it('hides the region when it is empty', async () => {
    await mount();
    expect(open.has(el)).toBe(false);
  });
});

describe('show()', () => {
  it('builds a notification, with the tone only if the stylesheet knows it', async () => {
    await mount();
    el.show({ title: 'Saved', message: 'Your draft is safe.', tone: 'success' });
    el.show({ message: 'Odd', tone: 'x" onclick="boom' });
    const [a, b] = items();
    expect(a!.dataset.tone).toBe('success');
    expect(a!.querySelector('.notification__title')!.textContent).toBe('Saved');
    expect(b!.dataset.tone).toBe('neutral');
    expect(open.has(el)).toBe(true);
    expect(el.count).toBe(2);
  });

  it('puts text in as text, never as markup', async () => {
    await mount();
    el.show({ message: '<img src=x onerror=boom()>' });
    expect(items()[0]!.querySelector('img')).toBeNull();
    expect(items()[0]!.textContent).toContain('<img');
  });

  it('is reachable with no reference to the element, through the document event', async () => {
    await mount();
    document.dispatchEvent(new CustomEvent('vitops:notify', { detail: { message: 'From afar' } }));
    expect(items()).toHaveLength(1);
    document.dispatchEvent(new CustomEvent('vitops:notify', { detail: { nope: true } }));
    expect(items()).toHaveLength(1);
  });

  it('persists with no duration, and closes itself with one', async () => {
    await mount();
    el.show({ message: 'Stays' });
    el.show({ message: 'Goes', duration: 1000 });
    await flush(5000);
    expect(items().map((i) => i.textContent)).toEqual([expect.stringContaining('Stays')]);
  });

  it('closes when its Close button is pressed, and fires notification-dismiss', async () => {
    await mount();
    const dismissed = vi.fn();
    el.addEventListener('notification-dismiss', dismissed);
    const id = el.show({ message: 'Bye' });
    items()[0]!.querySelector<HTMLElement>('[data-notification-close]')!.click();
    await flush(400);
    expect(items()).toHaveLength(0);
    expect(dismissed).toHaveBeenCalledOnce();
    expect(dismissed.mock.calls[0]![0].detail.id).toBe(id);
    expect(open.has(el)).toBe(false);
  });

  it('dismiss(id) and clear() remove them', async () => {
    await mount();
    const a = el.show({ message: 'a' });
    el.show({ message: 'b' });
    el.dismiss(a);
    await flush(400);
    expect(items()).toHaveLength(1);
    el.clear();
    await flush(400);
    expect(items()).toHaveLength(0);
  });

  it('actions: a link where there is an href, a button that fires notification-action', async () => {
    await mount();
    const fired = vi.fn();
    el.addEventListener('notification-action', fired);
    el.show({
      message: 'Moved to trash',
      actions: [{ label: 'Undo' }, { label: 'View', href: '/trash' }],
    });
    const actions = items()[0]!.querySelector('.notification__actions')!;
    expect(actions.querySelector('a')!.getAttribute('href')).toBe('/trash');
    actions.querySelector<HTMLElement>('button')!.click();
    expect(fired.mock.calls[0]![0].detail).toMatchObject({ index: 0, label: 'Undo' });
  });
});

describe('the countdown', () => {
  it('pauses while the pointer is over it and resumes with the time that was left', async () => {
    await mount();
    el.show({ message: 'Timed', duration: 4000 });
    const item = items()[0]!;
    await flush(3000);
    item.dispatchEvent(new Event('pointerenter'));
    await flush(60_000);
    expect(items()).toHaveLength(1);
    item.dispatchEvent(new Event('pointerleave'));
    await flush(999);
    expect(items()).toHaveLength(1);
    await flush(1);
    await flush(400);
    expect(items()).toHaveLength(0);
  });

  it('pauses while focus is inside it, and not when focus moves between its own controls', async () => {
    await mount();
    el.show({ message: 'Timed', duration: 2000, actions: [{ label: 'Undo' }] });
    const item = items()[0]!;
    const close = item.querySelector<HTMLElement>('[data-notification-close]')!;
    const undo = item.querySelector<HTMLElement>('button:not([data-notification-close])')!;
    item.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    await flush(10_000);
    expect(items()).toHaveLength(1);
    item.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: undo }));
    await flush(10_000);
    expect(items()).toHaveLength(1);
    item.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: close }));
    item.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
    await flush(2000);
    await flush(400);
    expect(items()).toHaveLength(0);
  });
});

describe('announcements', () => {
  it('speaks the visible text through the shared live region when ariaNotify is absent', async () => {
    await mount();
    el.show({ title: 'Saved', message: 'Your draft is safe.' });
    await flush(0);
    expect(ensureAnnouncer().textContent).toBe('Saved. Your draft is safe.');
  });

  it('adds "Actions available" when there are controls besides Close, and no control names', async () => {
    await mount();
    el.show({ message: 'Moved to trash', actions: [{ label: 'Undo' }] });
    await flush(0);
    expect(ensureAnnouncer().textContent).toBe('Moved to trash. Actions available');
  });

  it('uses ariaNotify() where the browser has it, and not the live region', async () => {
    await mount();
    const notify = vi.fn();
    (el as unknown as { ariaNotify: unknown }).ariaNotify = notify;
    el.show({ message: 'Native' });
    await flush(0);
    expect(notify).toHaveBeenCalledWith('Native');
    expect(ensureAnnouncer().textContent).toBe('');
  });
});

describe('modal dialogs', () => {
  it('holds a notification while a modal dialog is open and shows it when the dialog closes', async () => {
    await mount();
    const dialog = document.createElement('dialog');
    dialog.setAttribute('open', '');
    modals.add(dialog);
    document.body.append(dialog);
    el.show({ message: 'Later' });
    expect(items()).toHaveLength(0);
    expect(el.count).toBe(0);

    dialog.removeAttribute('open');
    modals.delete(dialog);
    dialog.dispatchEvent(new Event('close'));
    await flush(0);
    expect(items()).toHaveLength(1);
    dialog.remove();
  });

  it('a non-modal open dialog does not hold anything back', async () => {
    await mount();
    const dialog = document.createElement('dialog');
    dialog.setAttribute('open', '');
    document.body.append(dialog);
    el.show({ message: 'Now' });
    expect(items()).toHaveLength(1);
    dialog.remove();
  });
});

describe('focus', () => {
  it('moves focus to the next notification when the focused one is closed', async () => {
    await mount();
    el.show({ message: 'one' });
    el.show({ message: 'two' });
    const [first, second] = items();
    const firstClose = first!.querySelector<HTMLElement>('[data-notification-close]')!;
    firstClose.focus();
    firstClose.click();
    expect(document.activeElement).toBe(
      second!.querySelector<HTMLElement>('[data-notification-close]'),
    );
  });

  it('never takes focus when one appears', async () => {
    await mount();
    document.getElementById('before')!.focus();
    el.show({ message: 'quiet' });
    expect(document.activeElement).toBe(document.getElementById('before'));
  });
});
