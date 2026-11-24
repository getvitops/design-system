/**
 * Hover, keyboard-focus and Escape behaviour for `.tooltip-trigger` + `[popover].tooltip`.
 *
 * Markup (the no-JS fallback is the `popovertarget` click toggle; this only adds the rest):
 *
 *   <button class="tooltip-trigger" popovertarget="tip">Save</button>
 *   <div id="tip" class="tooltip" popover="manual">Saves the draft</div>
 *
 * WCAG 1.4.13 (Content on Hover or Focus) asks for three things, and each is here on purpose:
 * dismissable without moving the pointer (Escape), hoverable (the pointer can travel onto the
 * tooltip without it closing, hence the short close delay and no `pointer-events: none`), and
 * persistent (it stays until the pointer or focus leaves both).
 *
 * A TOGGLETIP is the same pair with `.tooltip--toggle` on the popover: a "?" or "i" button that
 * reveals more than a phrase, for touch and screen-reader users who never hover. It is opened by
 * click or Enter as well (`popovertarget` with `popovertargetaction="show"`, so a click after the
 * hover that already opened it does not close it again), it is `popover="auto"` so a click outside
 * or Escape dismisses it natively, and once clicked it stays open until dismissed, however the
 * pointer or focus moves. Its trigger reports `aria-expanded` instead of `aria-describedby`: a
 * description read right after "button" would suggest further actions, and the expanded state
 * says there is content to reveal and whether it is open.
 *
 * TODO(support): replace all of this with `interestfor` + `popover="hint"` once `interestfor`
 * meets the support threshold in AGENTS.md. It is Chromium-only today, and a polyfill does not
 * make a feature safe to depend on, so the handler below is the working fallback.
 */

const CLOSE_DELAY_MS = 120;

let anchors = 0;

function tooltipFor(trigger: Element): HTMLElement | null {
  const id = trigger.getAttribute('popovertarget');
  const el = id ? document.getElementById(id) : null;
  return el?.matches('[popover].tooltip') ? el : null;
}

/** Idempotent: each tooltip gets its own anchor name, its role, and the trigger's description. */
function prepare(trigger: HTMLElement, tip: HTMLElement): void {
  if (!tip.hasAttribute('role')) tip.setAttribute('role', 'tooltip');
  if (isToggletip(tip)) {
    if (!trigger.hasAttribute('aria-expanded')) {
      trigger.setAttribute('aria-expanded', String(tip.matches(':popover-open')));
    }
  } else if (!trigger.hasAttribute('aria-describedby')) {
    trigger.setAttribute('aria-describedby', tip.id);
  }
  if (!trigger.style.getPropertyValue('anchor-name')) {
    const name = `--tooltip-${(anchors += 1)}`;
    trigger.style.setProperty('anchor-name', name);
    tip.style.setProperty('position-anchor', name);
  }
}

/** A toggletip stays open once it has been clicked open (see the header). */
const isToggletip = (tip: HTMLElement): boolean => tip.classList.contains('tooltip--toggle');
const pinned = (tip: HTMLElement): boolean => tip.hasAttribute('data-pinned');

const timers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

function show(tip: HTMLElement): void {
  clearTimeout(timers.get(tip));
  try {
    tip.showPopover();
  } catch {
    /* already open, or not connected */
  }
}

/** Close now, or after `delay` unless the pointer or focus is back by then. */
function hide(tip: HTMLElement, trigger: HTMLElement | null, delay = 0, force = false): void {
  clearTimeout(timers.get(tip));
  // Losing the pointer or focus does not close a toggletip that was clicked open.
  if (!force && pinned(tip)) return;
  const run = () => {
    if (delay && trigger && held(trigger, tip)) return;
    try {
      tip.hidePopover();
    } catch {
      /* already closed */
    }
  };
  if (delay) timers.set(tip, setTimeout(run, delay));
  else run();
}

/** True when the pointer or keyboard focus is still on the trigger or the tooltip. */
function held(trigger: HTMLElement, tip: HTMLElement): boolean {
  return (
    trigger.matches(':hover') ||
    tip.matches(':hover') ||
    (trigger.matches(':focus') && focusVisible(trigger)) ||
    tip.contains(document.activeElement)
  );
}

function focusVisible(el: Element): boolean {
  try {
    return el.matches(':focus-visible');
  } catch {
    return true;
  }
}

export function initTooltips(root: Document = document): void {
  const triggerOf = (target: EventTarget | null) => {
    const trigger = (target as Element | null)?.closest?.<HTMLElement>('.tooltip-trigger');
    if (!trigger) return null;
    const tip = tooltipFor(trigger);
    return tip ? { trigger, tip } : null;
  };

  root.addEventListener('pointerover', (event) => {
    if ((event as PointerEvent).pointerType === 'touch') return;
    const hit = triggerOf(event.target);
    if (hit) {
      prepare(hit.trigger, hit.tip);
      show(hit.tip);
      return;
    }
    // The pointer moved onto the tooltip itself: keep it open.
    const tip = (event.target as Element | null)?.closest?.<HTMLElement>('[popover].tooltip');
    if (tip) clearTimeout(timers.get(tip));
  });

  root.addEventListener('pointerout', (event) => {
    const from = event.target as Element | null;
    const hit = triggerOf(from);
    const tip = hit?.tip ?? from?.closest?.<HTMLElement>('[popover].tooltip') ?? null;
    if (!tip) return;
    const trigger =
      hit?.trigger ??
      root.querySelector<HTMLElement>(`.tooltip-trigger[popovertarget="${tip.id}"]`);
    if (!trigger) return;
    // Leaving to somewhere inside the same pair is not leaving.
    const to = (event as PointerEvent).relatedTarget as Node | null;
    if (to && (trigger.contains(to) || tip.contains(to))) return;
    hide(tip, trigger, CLOSE_DELAY_MS);
  });

  root.addEventListener('focusin', (event) => {
    const hit = triggerOf(event.target);
    if (!hit || !focusVisible(hit.trigger)) return;
    prepare(hit.trigger, hit.tip);
    show(hit.tip);
  });

  root.addEventListener('focusout', (event) => {
    const hit = triggerOf(event.target);
    if (hit) hide(hit.tip, hit.trigger);
  });

  root.addEventListener('keydown', (event) => {
    if ((event as KeyboardEvent).key !== 'Escape') return;
    root
      .querySelectorAll<HTMLElement>('[popover].tooltip')
      .forEach((tip) => hide(tip, null, 0, true));
  });

  // A click on a toggletip's trigger pins it open. (`popovertargetaction="show"` is what keeps the
  // click from closing the popover that hover opened; the pin is what keeps hover-out from doing so.)
  root.addEventListener('click', (event) => {
    const hit = triggerOf(event.target);
    if (!hit || !isToggletip(hit.tip)) return;
    prepare(hit.trigger, hit.tip);
    hit.tip.setAttribute('data-pinned', '');
  });

  // `toggle` does not bubble, so listen in the capture phase. The popover is the source of truth for
  // `aria-expanded`: Escape, light dismiss or another invoker can close it.
  root.addEventListener(
    'toggle',
    (event) => {
      const tip = event.target as HTMLElement | null;
      if (!tip?.matches?.('[popover].tooltip.tooltip--toggle')) return;
      const open = tip.matches(':popover-open');
      if (!open) tip.removeAttribute('data-pinned');
      for (const trigger of root.querySelectorAll<HTMLElement>(
        `.tooltip-trigger[popovertarget="${CSS.escape(tip.id)}"]`,
      )) {
        trigger.setAttribute('aria-expanded', String(open));
      }
    },
    true,
  );
}
