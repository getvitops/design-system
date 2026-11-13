import { itemState, moveBy, resolveTarget, stepFromHash } from './utils/stepper.js';
import { initFromLightDom } from './utils/upgrade.js';

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

const HEADING = 'h1, h2, h3, h4, h5, h6';

/**
 * A long form shown one step at a time.
 *
 * **The fallback is the whole form.** With no JS the element is a list of `#anchor` links and a run
 * of headed `<section data-step>`s, every one visible, in order, inside one `<form>`: a long form
 * that works, with the submit button after the last section. Nothing about that markup is a
 * placeholder.
 *
 * ```html
 * <wc-stepper>
 *   <ol class="stepper">
 *     <li class="stepper__item"><a href="#identity">Identity</a></li>
 *     <li class="stepper__item"><a href="#contact">Contact</a></li>
 *   </ol>
 *   <form method="post">
 *     <section id="identity" data-step><h2>Identity</h2>…</section>
 *     <section id="contact" data-step><h2>Contact</h2>…<button>Save</button></section>
 *   </form>
 * </wc-stepper>
 * ```
 *
 * On upgrade it shows one section, marks its link `aria-current="step"`, and gives every section
 * Back and Next buttons (`back-label` / `next-label` set their text). Next, and a nav link that
 * goes forward, validate the sections they leave and stop at the first one
 * with a problem (showing its message), so a required field cannot be skipped. Going back is always
 * free. A submit the browser blocks on a field in a hidden section shows that section first. Enter
 * in a field moves to the next step instead of submitting early.
 *
 * Which step shows first: the URL fragment if it names a step (or something inside one), else the
 * first. `hash` writes the fragment as the visitor moves, so Back works and a step can be linked.
 * Focus moves to the new step's heading on a move the visitor made.
 *
 * Plain `HTMLElement`, no Lit, in its own bundle (`@getvitops/core/stepper`), so it loads with or
 * without `elements.js` and in either order with `<wc-config-form>`.
 *
 * @fires stepper-change `{ index, id }`, bubbles, when the shown step changes.
 */
export class WCStepper extends HTMLElement {
  #ready = false;
  #started = false;
  #steps: HTMLElement[] = [];
  #links: (HTMLAnchorElement | null)[] = [];
  #current = 0;
  readonly #visited = new Set<number>();

  connectedCallback(): void {
    initFromLightDom(this, () => this.#setup());
    // A reconnect (the element moved): `setup` ran once and does not run again.
    if (this.#ready) this.#listen();
  }

  disconnectedCallback(): void {
    window.removeEventListener('hashchange', this.#onHashChange);
  }

  /** The index of the step shown. */
  get current(): number {
    return this.#current;
  }

  /** Move to step `index` as the visitor would (validating what it leaves). Returns where it landed. */
  go(index: number): number {
    return this.#move(index, true);
  }

  #setup(): boolean {
    if (this.#ready) return true;
    const steps = Array.from(this.querySelectorAll<HTMLElement>('section[data-step]'));
    if (steps.length === 0) return false;
    this.#steps = steps;
    const anchors = Array.from(this.querySelectorAll<HTMLAnchorElement>('.stepper a[href^="#"]'));
    this.#links = steps.map(
      (step) => anchors.find((a) => a.getAttribute('href') === `#${step.id}`) ?? null,
    );

    steps.forEach((step, index) => this.#addActions(step, index));

    const form = this.querySelector('form');
    // `invalid` does not bubble: capture it, and bring forward the step a blocked submit is about.
    form?.addEventListener('invalid', this.#onInvalid, true);
    form?.addEventListener('keydown', this.#onKeydown);
    this.addEventListener('click', this.#onClick);
    this.#listen();

    this.#ready = true;
    const ids = steps.map((s) => s.id);
    const fromHash = stepFromHash(ids, location.hash);
    this.#show(fromHash >= 0 ? fromHash : this.#fromInside(location.hash), false);
    return true;
  }

  #listen(): void {
    window.removeEventListener('hashchange', this.#onHashChange);
    window.addEventListener('hashchange', this.#onHashChange);
  }

  /** A fragment naming something inside a step shows that step. */
  #fromInside(hash: string): number {
    const id = hash.replace(/^#/, '');
    const target = id ? document.getElementById(id) : null;
    const index = target ? this.#steps.findIndex((step) => step.contains(target)) : -1;
    return index >= 0 ? index : 0;
  }

  #addActions(step: HTMLElement, index: number): void {
    const last = index === this.#steps.length - 1;
    const actions = document.createElement('div');
    actions.className = 'stepper__actions';
    if (index > 0) actions.append(this.#button('back', this.getAttribute('back-label') ?? 'Back'));
    if (!last) actions.append(this.#button('next', this.getAttribute('next-label') ?? 'Next'));
    if (actions.childElementCount > 0) step.append(actions);
    // The heading takes focus when the step is shown; it is not otherwise a tab stop.
    const heading = step.querySelector<HTMLElement>(HEADING);
    if (heading && !heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
  }

  #button(kind: 'back' | 'next', label: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = kind === 'next' ? 'cta' : 'btn';
    button.dataset.stepperAction = kind;
    button.textContent = label;
    return button;
  }

  /* ── Events ──────────────────────────────────────────────────────────────── */

  #onClick = (event: Event): void => {
    const target = event.target as Element | null;
    const action = target?.closest<HTMLElement>('[data-stepper-action]');
    if (action && this.contains(action)) {
      event.preventDefault();
      this.#move(this.#current + (action.dataset.stepperAction === 'next' ? 1 : -1), true);
      return;
    }
    const link = target?.closest<HTMLAnchorElement>('.stepper a[href^="#"]');
    const index = link ? this.#links.indexOf(link) : -1;
    if (index >= 0) {
      event.preventDefault();
      this.#move(index, true);
    }
  };

  #onKeydown = (event: KeyboardEvent): void => {
    if (event.key !== 'Enter' || event.defaultPrevented) return;
    const target = event.target;
    // Implicit submission is from a text-like input; a textarea's Enter is a newline.
    if (!(target instanceof HTMLInputElement) || ['submit', 'button'].includes(target.type)) return;
    if (this.#current >= this.#steps.length - 1) return;
    event.preventDefault();
    this.#move(this.#current + 1, true);
  };

  #onInvalid = (event: Event): void => {
    const index = this.#steps.findIndex((step) => step.contains(event.target as Node));
    if (index >= 0 && index !== this.#current) this.#show(index, false);
  };

  #onHashChange = (): void => {
    const index = stepFromHash(
      this.#steps.map((s) => s.id),
      location.hash,
    );
    if (index >= 0 && index !== this.#current) this.#show(index, false);
  };

  /* ── Moving ──────────────────────────────────────────────────────────────── */

  #controls(step: HTMLElement): Control[] {
    return Array.from(step.querySelectorAll<Control>('input, select, textarea')).filter(
      (c) => c.type !== 'hidden' && !c.disabled,
    );
  }

  /** `validity.valid`, not `checkValidity()`: that fires `invalid`, which this element listens for. */
  #isValid(index: number): boolean {
    return this.#controls(this.#steps[index]!).every((c) => c.validity.valid);
  }

  #move(index: number, byVisitor: boolean): number {
    const wanted = moveBy(0, index, this.#steps.length);
    // Only the steps being passed need checking.
    const valid = this.#steps.map(() => true);
    for (let i = this.#current; i < wanted; i++) valid[i] = this.#isValid(i);
    const landed = resolveTarget(this.#current, wanted, valid);
    this.#show(landed, byVisitor);
    if (landed < wanted) {
      this.#controls(this.#steps[landed]!)
        .find((c) => !c.validity.valid)
        ?.reportValidity();
    }
    return landed;
  }

  #show(index: number, byVisitor: boolean): void {
    const previous = this.#current;
    if (this.#started) this.#visited.add(previous);
    this.#started = true;
    this.#current = index;
    this.#visited.add(index);
    // Visited steps are re-checked on every move: a field edited since changes the state.
    const valid = this.#steps.map((_, i) => (this.#visited.has(i) ? this.#isValid(i) : true));

    this.#steps.forEach((step, i) => {
      step.hidden = i !== index;
      const state = itemState(i, index, this.#visited, valid);
      const link = this.#links[i];
      if (link) {
        if (state === 'current') link.setAttribute('aria-current', 'step');
        else link.removeAttribute('aria-current');
        const item = link.closest('li');
        item?.classList.toggle('stepper__item--complete', state === 'complete');
        item?.classList.toggle('stepper__item--invalid', state === 'invalid');
      }
    });

    if (index === previous) return;
    const step = this.#steps[index]!;
    if (this.hasAttribute('hash') && byVisitor && location.hash !== `#${step.id}`) {
      history.pushState(null, '', `#${step.id}`);
    }
    if (byVisitor) (step.querySelector<HTMLElement>(HEADING) ?? step).focus();
    this.dispatchEvent(
      new CustomEvent('stepper-change', { detail: { index, id: step.id }, bubbles: true }),
    );
  }
}

if (!customElements.get('wc-stepper')) {
  customElements.define('wc-stepper', WCStepper);
}

declare global {
  interface HTMLElementTagNameMap {
    'wc-stepper': WCStepper;
  }
}
