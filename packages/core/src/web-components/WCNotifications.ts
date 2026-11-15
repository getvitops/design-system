import { announce } from './utils/announcer.js';
import { focusTargetAfterRemoval } from './utils/focus-return.js';
import {
  announcementText,
  canShowNow,
  normalizeDuration,
  normalizeTone,
  remainingAfterPause,
  shouldHold,
  type NotificationTone,
} from './utils/notifications.js';

/** What `show()` and a `vitops:notify` event carry. */
export interface NotificationInput {
  message: string;
  title?: string;
  tone?: NotificationTone | string;
  /** Milliseconds until it dismisses itself. Omit for one that stays until closed. */
  duration?: number;
  /** Controls besides Close. A link when `href` is set, else a button that fires `notification-action`. */
  actions?: readonly { label: string; href?: string }[];
}

interface Item {
  id: string;
  el: HTMLElement;
  total: number;
  remaining: number;
  startedAt: number;
  timer: ReturnType<typeof setTimeout> | undefined;
  hovered: boolean;
  focusWithin: boolean;
}

export const NOTIFY_EVENT = 'vitops:notify';

let serial = 0;

/**
 * The one place a page's notifications appear and stack: a labelled region in the top layer that
 * exists while it holds something. Put one on every page, in the same place in the markup, so a
 * screen reader user always knows where to look.
 *
 * ```html
 * <wc-notifications label="Notifications" position="bottom end">
 *   <div class="notification" role="status">Your draft was saved.</div>   <!-- server message -->
 * </wc-notifications>
 * ```
 *
 * **The fallback is the slot.** A `.notification` the server rendered inside it is an ordinary
 * inline message with no script (give it `role="status"`). On upgrade the element adopts each one
 * into the stack, honouring `data-duration`, and adds a Close button where there is none.
 *
 * ```js
 * const n = document.querySelector('wc-notifications');
 * n.show({ title: 'Saved', message: 'Your draft is safe.', tone: 'success', duration: 6000 });
 * // or, with no reference to the element:
 * document.dispatchEvent(new CustomEvent('vitops:notify', { detail: { message: 'Saved' } }));
 * ```
 *
 * - **They persist** until closed, unless `duration` is set. A countdown PAUSES while the pointer
 *   is over a notification or focus is inside it and resumes with the time that was left (WCAG
 *   2.2.1). Nothing here takes focus; Close is a real button a keyboard user can reach.
 * - **They are announced** with `ariaNotify()` where the browser has it, otherwise through the
 *   page's shared live region (`utils/announcer.ts`). Only the visible text is spoken, never a
 *   control's name; "Actions available" is added when there are controls besides Close.
 * - **Not over a modal.** While a modal `<dialog>` is open, new ones wait and appear when it
 *   closes: everything outside a modal is inert, so one shown behind it would be missed.
 * - **Closing the one with focus** moves focus to a neighbour instead of dropping it on `<body>`.
 * - **Reduced motion** skips the exit fade. Do not put one in a modal, and do not use this for
 *   anything the visitor must act on: that is a banner or a dialog.
 *
 * Attributes: `label` (the region's name, default "Notifications") and `position` (words from
 * `top`/`bottom` and `start`/`center`/`end`; default bottom end).
 *
 * @fires notification-dismiss `{ id }`, after one is removed.
 * @fires notification-action `{ id, index, label }`, when an action button is pressed.
 *
 * @fallback full server-rendered notifications read inline, with no script
 */
export class WCNotifications extends HTMLElement {
  #items = new Map<string, Item>();
  #queue: { id: string; input: NotificationInput }[] = [];
  #ready = false;
  #abort: AbortController | null = null;

  connectedCallback(): void {
    if (this.#ready) return;
    // Adopt after the parser has given this element its children.
    const start = (): void => {
      if (!this.isConnected || this.#ready) return;
      this.#setup();
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
      queueMicrotask(start);
    }
  }

  disconnectedCallback(): void {
    this.#abort?.abort();
    this.#abort = null;
    for (const item of this.#items.values()) clearTimeout(item.timer);
    this.#ready = false;
  }

  /* ── Public API ──────────────────────────────────────────────────────────── */

  /** Show a notification (or queue it behind an open modal). Returns its id. */
  show(input: NotificationInput): string {
    if (!this.#ready && this.isConnected) this.#setup();
    const id = `notification-${++serial}`;
    if (!canShowNow(this.#modalOpen())) {
      this.#queue.push({ id, input });
      return id;
    }
    this.#add(id, input);
    return id;
  }

  /** Remove one. */
  dismiss(id: string): void {
    const queued = this.#queue.findIndex((q) => q.id === id);
    if (queued >= 0) {
      this.#queue.splice(queued, 1);
      return;
    }
    const item = this.#items.get(id);
    if (item) this.#remove(item);
  }

  /** Remove every notification, shown or waiting. */
  clear(): void {
    this.#queue = [];
    for (const item of [...this.#items.values()]) this.#remove(item);
  }

  /** How many are on screen. */
  get count(): number {
    return this.#items.size;
  }

  /* ── Setup ───────────────────────────────────────────────────────────────── */

  #setup(): void {
    this.#ready = true;
    this.setAttribute('role', 'region');
    this.setAttribute('aria-label', this.getAttribute('label') ?? 'Notifications');
    if (!this.hasAttribute('popover')) this.setAttribute('popover', 'manual');

    this.#abort = new AbortController();
    const { signal } = this.#abort;
    document.addEventListener(
      NOTIFY_EVENT,
      (event) => {
        const detail = (event as CustomEvent<NotificationInput>).detail;
        if (detail && typeof detail.message === 'string') this.show(detail);
      },
      { signal },
    );
    // `close` and `cancel` do not bubble; a capturing listener on the document hears every dialog.
    const release = (): void => {
      queueMicrotask(() => this.#releaseQueue());
    };
    document.addEventListener('close', release, { capture: true, signal });
    document.addEventListener('cancel', release, { capture: true, signal });

    // The server's own messages become part of the stack. A message the server rendered is read at
    // load like any page text, so it is not announced again.
    for (const el of Array.from(this.querySelectorAll<HTMLElement>(':scope > .notification'))) {
      this.#register(`notification-${++serial}`, el, normalizeDuration(el.dataset.duration));
    }
    this.#sync();
  }

  /* ── Adding and removing ─────────────────────────────────────────────────── */

  #modalOpen(): boolean {
    for (const dialog of Array.from(document.querySelectorAll('dialog[open]'))) {
      try {
        if (dialog.matches(':modal')) return true;
      } catch {
        // No `:modal` in this engine: any open dialog is treated as one, which only delays.
        return true;
      }
    }
    return false;
  }

  #releaseQueue(): void {
    while (this.#queue.length > 0 && canShowNow(this.#modalOpen())) {
      const next = this.#queue.shift()!;
      this.#add(next.id, next.input);
    }
  }

  #add(id: string, input: NotificationInput): void {
    const duration = normalizeDuration(input.duration);
    const el = this.#build(input, duration);
    this.append(el);
    this.#register(id, el, duration);
    this.#sync();
    this.#announce(input);
  }

  #build(input: NotificationInput, duration: number): HTMLElement {
    const el = document.createElement('div');
    el.className = 'notification';
    el.dataset.tone = normalizeTone(input.tone);

    const content = document.createElement('div');
    content.className = 'notification__content';
    if (input.title) {
      const title = document.createElement('p');
      title.className = 'notification__title';
      title.textContent = input.title;
      content.append(title);
    }
    const message = document.createElement('p');
    message.className = 'notification__message';
    message.textContent = input.message;
    content.append(message);

    if (input.actions?.length) {
      const actions = document.createElement('div');
      actions.className = 'notification__actions';
      input.actions.forEach((action, index) => {
        const control = action.href
          ? Object.assign(document.createElement('a'), {
              href: action.href,
              className: 'link',
            })
          : Object.assign(document.createElement('button'), { type: 'button', className: 'btn' });
        control.textContent = action.label;
        if (!action.href) control.dataset.notificationAction = String(index);
        actions.append(control);
      });
      content.append(actions);
    }
    el.append(content);
    if (duration > 0) el.append(this.#progress(duration));
    return el;
  }

  #progress(duration: number): HTMLElement {
    const bar = document.createElement('div');
    bar.className = 'notification__progress';
    bar.setAttribute('aria-hidden', 'true');
    bar.style.setProperty('--notification-duration', `${duration}ms`);
    return bar;
  }

  /** Wire an element (built here or adopted) into the stack. */
  #register(id: string, el: HTMLElement, duration: number): void {
    if (!el.querySelector('[data-notification-close]')) {
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'notification__close';
      close.dataset.notificationClose = '';
      close.setAttribute('aria-label', 'Close');
      close.textContent = '×';
      el.append(close);
    }
    if (duration > 0 && !el.querySelector('.notification__progress')) {
      el.append(this.#progress(duration));
    }

    const item: Item = {
      id,
      el,
      total: duration,
      remaining: duration,
      startedAt: 0,
      timer: undefined,
      hovered: false,
      focusWithin: false,
    };
    this.#items.set(id, item);

    el.addEventListener('pointerenter', () => this.#hold(item, { hovered: true }));
    el.addEventListener('pointerleave', () => this.#hold(item, { hovered: false }));
    el.addEventListener('focusin', () => this.#hold(item, { focusWithin: true }));
    el.addEventListener('focusout', (event) => {
      const next = (event as FocusEvent).relatedTarget as Node | null;
      if (!next || !el.contains(next)) this.#hold(item, { focusWithin: false });
    });
    el.addEventListener('click', (event) => {
      const target = event.target as Element | null;
      if (target?.closest('[data-notification-close]')) this.#remove(item);
      const action = target?.closest<HTMLElement>('[data-notification-action]');
      if (action) {
        this.dispatchEvent(
          new CustomEvent('notification-action', {
            detail: {
              id,
              index: Number(action.dataset.notificationAction),
              label: action.textContent ?? '',
            },
            bubbles: true,
          }),
        );
      }
    });

    this.#run(item);
  }

  #announce(input: NotificationInput): void {
    const text = announcementText(input);
    if (!text) return;
    const native = (this as unknown as { ariaNotify?: (message: string) => void }).ariaNotify;
    // TODO(support): drop the fallback once `ariaNotify()` meets the support threshold in AGENTS.md.
    if (typeof native === 'function') native.call(this, text);
    else announce(text, { delay: 0 });
  }

  /* ── The countdown ───────────────────────────────────────────────────────── */

  #hold(item: Item, change: Partial<Pick<Item, 'hovered' | 'focusWithin'>>): void {
    Object.assign(item, change);
    if (shouldHold(item.hovered, item.focusWithin)) this.#pause(item);
    else this.#run(item);
  }

  #run(item: Item): void {
    if (item.total <= 0 || item.timer !== undefined) return;
    if (shouldHold(item.hovered, item.focusWithin)) return;
    item.startedAt = Date.now();
    item.el.style.removeProperty('--notification-play-state');
    item.timer = setTimeout(() => this.#remove(item), item.remaining);
  }

  #pause(item: Item): void {
    if (item.timer === undefined) return;
    clearTimeout(item.timer);
    item.timer = undefined;
    item.remaining = remainingAfterPause(item.remaining, item.startedAt, Date.now());
    item.el.style.setProperty('--notification-play-state', 'paused');
  }

  #remove(item: Item): void {
    if (!this.#items.delete(item.id)) return;
    clearTimeout(item.timer);
    const el = item.el;
    // Hand focus to a neighbour before the node goes, while document order can still be read.
    if (el.contains(document.activeElement)) {
      const next = [...this.#items.values()].find(
        (other) => other.el.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING,
      );
      (
        next?.el.querySelector<HTMLElement>('[data-notification-close]') ??
        focusTargetAfterRemoval(el)
      )?.focus();
    }
    const done = (): void => {
      el.remove();
      this.dispatchEvent(
        new CustomEvent('notification-dismiss', { detail: { id: item.id }, bubbles: true }),
      );
      this.#sync();
    };
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      done();
      return;
    }
    el.classList.add('notification--exiting');
    let finished = false;
    const once = (): void => {
      if (finished) return;
      finished = true;
      done();
    };
    el.addEventListener('animationend', once, { once: true });
    // An engine that never fires the event (no animation support) must not strand the node.
    setTimeout(once, 400);
  }

  /** Show the top-layer box while it holds something, hide it when empty. */
  #sync(): void {
    // Counted in the DOM, not the map: a notification that is fading out still occupies the box.
    const holds = this.querySelector(':scope > .notification') !== null;
    try {
      if (holds && !this.matches(':popover-open')) this.showPopover();
      else if (!holds && this.matches(':popover-open')) this.hidePopover();
    } catch {
      // No Popover API: the region stays where it is in the flow, which is still readable.
    }
  }
}

if (!customElements.get('wc-notifications')) {
  customElements.define('wc-notifications', WCNotifications);
}

declare global {
  interface HTMLElementTagNameMap {
    'wc-notifications': WCNotifications;
  }
}
