import { noChange } from 'lit';
import { BaseElement } from './BaseElement.js';
import { easingToken, formatterFor, parseFigure } from './utils/counter.js';
import { initFromLightDom } from './utils/upgrade.js';

/**
 * Extra time past the CSS `animation-duration` before the timeout fallback
 * finishes the count on its own — insurance against `prefers-reduced-motion`
 * flipping mid-flight (OS-level, can change while the page is open) after
 * `start()` already committed to animating, the one case where CSS cancels the
 * animation JS already started and `animationend` never arrives.
 */
const FINISH_TIMEOUT_SLACK_MS = 100;

/**
 * One shared observer for every `<wc-counter>` on the page — unobserve after
 * the first run, mirroring `deferred.ts`'s `triggerObserver`. `#start` is a
 * true private method, so the module-scope callback reaches it through this
 * map rather than a public entry point that would otherwise have to exist
 * only for the observer to call.
 */
const starters = new WeakMap<Element, () => void>();
let counterObserver: IntersectionObserver | undefined;
function observer(): IntersectionObserver {
  return (counterObserver ??= new IntersectionObserver((entries, obs) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      obs.unobserve(entry.target);
      starters.get(entry.target)?.();
    }
  }));
}

/**
 * Animates a number from a start value to the value already in its fallback
 * text — the stat/percentage figure in a media tile ("0 → 94%"), a KPI row, a
 * metrics band.
 *
 * **The fallback is the finished figure, not a placeholder.** With no JS,
 * `.counter__value` is the real final number in plain text — nothing is
 * missing, nothing is wrong, there is simply no count-up. The element only
 * replaces what's on screen over a duration on the way to that same value,
 * which is why the final value is **parsed out of the fallback text**, never
 * passed as a separate attribute: an attribute that disagreed with the text
 * would be a silent lie in one of the two states, and this way there is
 * exactly one source of truth for both.
 *
 * **CSS owns the interpolation and the easing curve; JS only reads it.** A
 * registered `--_n` custom property (`patterns/counter.css`) is what the
 * browser actually animates, driven by a plain CSS `@keyframes` — `data-easing`
 * therefore maps straight onto the real `--custom-ease-*`/`--ease-float-*`
 * tokens (`utils/counter.ts`'s `easingToken`) with no second, JS-side copy of
 * any curve to drift out of step with `animation.css`. JS's job is reading
 * `--_n` back each frame and rendering it through `Intl.NumberFormat`, seeded
 * from the fallback text's own separators — `counter()` cannot do that part at
 * all (no decimals, no locale grouping), which is the one thing here that
 * really does need JavaScript.
 *
 * **The accessible name stays the final value for the whole animation, not
 * just at rest.** `.counter__value` is toggled to the framework's `.sr-only`
 * utility while running rather than hidden — `display: none`/`visibility:
 * hidden` would pull it out of the accessibility tree and out of the
 * accessible-name computation along with it. The animated text lives in a
 * separate `aria-hidden` presentation span that a screen reader never reaches,
 * so nothing here ever announces ~60 intermediate numbers. `aria-live="off"`
 * on the host is additional insurance, not the mechanism.
 *
 * **Trigger on intersection, not on upgrade**, and **reduced motion means
 * don't animate at all** — a counter below the fold that finished counting
 * before the visitor scrolled to it has done nothing, and "animate faster" is
 * not what `prefers-reduced-motion: reduce` asked for. Reduced motion is
 * checked before the observer is even created, so the fallback text is simply
 * left alone; `patterns/counter.css`'s own reduced-motion query is the second
 * belt for the rarer case where the OS setting flips after `start()` already
 * committed — the completion timeout below is what unblocks that case, since
 * an animation CSS itself cancels never fires `animationend`.
 *
 * @example
 * ```html
 * <wc-counter class="counter" data-from="0" data-duration="1200">
 *   <span class="counter__value">94%</span>
 * </wc-counter>
 * ```
 */
export class WCCounter extends BaseElement {
  /** Light DOM — `.counter`/`.counter__value` CSS must style the slotted markup. */
  override createRenderRoot(): HTMLElement {
    return this;
  }

  /** Never let lit-html touch the slotted markup. */
  protected override render(): typeof noChange {
    return noChange;
  }

  #ready = false;
  #source: HTMLElement | null = null;
  #presentation: HTMLElement | null = null;
  #formatter: Intl.NumberFormat | null = null;
  #prefix = '';
  #suffix = '';
  #finalValue = 0;
  #raf = 0;
  #timeout = 0;
  #finished = false;

  override connectedCallback(): void {
    super.connectedCallback();
    // The fallback span may not be parsed yet — see initFromLightDom.
    initFromLightDom(this, () => this.#setup());
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    observer().unobserve(this);
    starters.delete(this);
    this.#stop();
    this.#presentation?.remove();
    this.#presentation = null;
    this.#source?.classList.remove('sr-only');
    this.#source = null;
    this.#ready = false;
  }

  #setup(): boolean {
    if (this.parentElement?.closest('wc-counter')) return true;
    if (this.#ready) return true;

    const source = this.querySelector<HTMLElement>('.counter__value');
    if (!source) return false; // Retry hook — see initFromLightDom.

    this.#source = source;
    const decimalsAttr = this.getAttribute('data-decimals');
    const parsed = parseFigure(
      source.textContent ?? '',
      decimalsAttr ? Number(decimalsAttr) : undefined,
    );
    this.#prefix = parsed.prefix;
    this.#suffix = parsed.suffix;
    this.#finalValue = parsed.value;
    this.#formatter = formatterFor(parsed);
    this.#ready = true;

    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return true;

    const presentation = document.createElement('span');
    presentation.className = 'counter__presentation';
    presentation.setAttribute('aria-hidden', 'true');
    presentation.textContent = source.textContent;
    source.insertAdjacentElement('afterend', presentation);
    this.#presentation = presentation;
    this.setAttribute('aria-live', 'off');

    const from = this.getAttribute('data-from') ?? '0';
    const duration = Number(this.getAttribute('data-duration') ?? '1200');
    this.style.setProperty('--counter-from', from);
    this.style.setProperty('--counter-to', String(this.#finalValue));
    this.style.setProperty('--counter-duration', `${duration}ms`);
    const easing = easingToken(this.getAttribute('data-easing'));
    if (easing) this.style.setProperty('--counter-easing', easing);

    starters.set(this, () => this.#start(duration));
    observer().observe(this);
    return true;
  }

  #start(duration: number): void {
    if (!this.#presentation) return;
    this.#finished = false;
    this.setAttribute('running', '');
    this.#source?.classList.add('sr-only');
    this.#presentation.addEventListener('animationend', this.#onFinish, { once: true });
    this.#timeout = window.setTimeout(this.#onFinish, duration + FINISH_TIMEOUT_SLACK_MS);
    this.#raf = requestAnimationFrame(this.#tick);
  }

  #tick = (): void => {
    if (!this.#presentation || !this.#formatter) return;
    const raw = Number.parseFloat(getComputedStyle(this.#presentation).getPropertyValue('--_n'));
    this.#render(Number.isFinite(raw) ? raw : this.#finalValue);
    this.#raf = requestAnimationFrame(this.#tick);
  };

  #render(value: number): void {
    if (!this.#presentation || !this.#formatter) return;
    this.#presentation.textContent = `${this.#prefix}${this.#formatter.format(value)}${this.#suffix}`;
  }

  #onFinish = (): void => {
    if (this.#finished) return; // The animationend/timeout race settles once.
    this.#finished = true;
    this.#render(this.#finalValue);
    this.#stop();
    this.#source?.classList.remove('sr-only');
    this.removeAttribute('running');
  };

  /** Cancels in-flight work without touching what's on screen. */
  #stop(): void {
    if (this.#raf) cancelAnimationFrame(this.#raf);
    this.#raf = 0;
    if (this.#timeout) clearTimeout(this.#timeout);
    this.#timeout = 0;
    this.#presentation?.removeEventListener('animationend', this.#onFinish);
  }
}

if (!customElements.get('wc-counter')) {
  customElements.define('wc-counter', WCCounter);
}

declare global {
  interface HTMLElementTagNameMap {
    'wc-counter': WCCounter;
  }
}
