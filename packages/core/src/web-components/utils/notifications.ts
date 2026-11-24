/**
 * The decisions `<wc-notifications>` makes, as functions over plain values so they can be tested
 * without a DOM: which tone a string means, what is spoken for a notification, whether one may be
 * shown now, and how long is left on a countdown that was paused.
 */

/** The tones the stylesheet has a rule for. Each is a role every generated config defines. */
export const TONES = ['neutral', 'info', 'success', 'warning', 'danger'] as const;
export type NotificationTone = (typeof TONES)[number];

/** A tone name the stylesheet knows, else `neutral`. Never a value an author can inject. */
export function normalizeTone(value: unknown): NotificationTone {
  return typeof value === 'string' && (TONES as readonly string[]).includes(value)
    ? (value as NotificationTone)
    : 'neutral';
}

/** A usable auto-dismiss time in ms: a positive finite number, else 0 (persistent). */
export function normalizeDuration(value: unknown): number {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

export interface Announceable {
  title?: string | undefined;
  message: string;
  /** Controls other than Close. */
  actions?: readonly unknown[] | undefined;
}

/**
 * What a screen reader is told: the visible text only, never the names of its controls. When the
 * notification offers actions besides Close, say so, because the text alone would hide that they
 * exist.
 */
export function announcementText({ title, message, actions }: Announceable): string {
  const text = [title, message]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join('. ');
  return actions && actions.length > 0 ? `${text}. Actions available` : text;
}

/**
 * Whether a notification may appear now. Not while a modal dialog is open: everything outside it is
 * inert, so the notification would be missed, and putting it inside the dialog would make it hard
 * to find. It waits, and is released when the dialog closes.
 */
export function canShowNow(modalOpen: boolean): boolean {
  return !modalOpen;
}

/** Milliseconds still to run on a countdown of `total` ms that has been running since `startedAt`. */
export function remainingAfterPause(total: number, startedAt: number, now: number): number {
  return Math.max(0, total - Math.max(0, now - startedAt));
}

/** True when the countdown should be held: the pointer is over it or focus is inside it. */
export function shouldHold(hovered: boolean, focusWithin: boolean): boolean {
  return hovered || focusWithin;
}
