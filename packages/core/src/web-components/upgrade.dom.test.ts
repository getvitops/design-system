/**
 * @vitest-environment happy-dom
 *
 * Every light-DOM component initialises when upgraded MID-INSERTION.
 *
 * This is one bug in four places. Each of these elements parses its slotted markup
 * in `connectedCallback` and early-returns when it finds nothing — which is exactly
 * what happens when the element is upgraded during an `innerHTML` write, because
 * children do not exist yet. The first assertion below pins that premise, so if a
 * future DOM implementation changes the timing this file explains itself rather
 * than looking like a pointless retry.
 *
 * The failure mode is silent in all four: the fallback markup stays on screen
 * un-enhanced, with no error. So what is asserted is not "setup was called" but
 * the observable enhancement each component exists to produce.
 */
import { beforeAll, describe, expect, it } from 'vitest';

/** Insert markup the way a view-transition swap or client-side nav does. */
async function mount(html: string): Promise<HTMLElement> {
  document.body.innerHTML = html;
  // The retry is a microtask; ResizeObserver-driven work lands a frame later.
  await new Promise((r) => requestAnimationFrame(r));
  return document.body.firstElementChild as HTMLElement;
}

beforeAll(async () => {
  // Side-effectful imports: they must run after happy-dom installs its globals.
  await Promise.all([
    import('./WCEntries.ts'),
    import('./WCMarquee.ts'),
    import('./WCCarousel.ts'),
    import('./WCTree.ts'),
  ]);
});

describe('the premise', () => {
  it('connectedCallback fires with no children during innerHTML insertion', () => {
    const seen: number[] = [];
    class Probe extends HTMLElement {
      connectedCallback(): void {
        seen.push(this.children.length);
      }
    }
    customElements.define('wc-upgrade-probe', Probe);
    document.body.innerHTML = '<wc-upgrade-probe><span>a</span><span>b</span></wc-upgrade-probe>';
    // Zero at connect, two once the insertion finished. This is the whole bug.
    expect(seen).toEqual([0]);
    expect(document.querySelector('wc-upgrade-probe')!.children.length).toBe(2);
  });
});

describe('<wc-entries>', () => {
  const MARKUP = `
    <wc-entries breakpoint="40rem">
      <h3>Alice</h3><dl><dt>Email</dt><dd>alice@example.com</dd></dl>
      <h3>Bob</h3><dl><dt>Email</dt><dd>bob@example.com</dd></dl>
    </wc-entries>`;

  it('builds its table', async () => {
    const el = await mount(MARKUP);
    const table = el.querySelector('table.entries__table');
    expect(table).toBeTruthy();
    // Two entries + a header row, and the parsed values carried across.
    expect(table!.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(table!.textContent).toContain('alice@example.com');
  });

  it('builds it exactly once', async () => {
    const el = await mount(MARKUP);
    // The retry must not re-run a successful setup, or the table is duplicated.
    await new Promise((r) => requestAnimationFrame(r));
    expect(el.querySelectorAll('table.entries__table')).toHaveLength(1);
  });

  it('does nothing for genuinely empty content', async () => {
    const el = await mount('<wc-entries></wc-entries>');
    expect(el.querySelector('table')).toBeNull();
  });
});

describe('<wc-marquee>', () => {
  it('takes over from the CSS-only path', async () => {
    const el = await mount(
      '<wc-marquee><div class="marquee__content"><span>ticker</span></div></wc-marquee>',
    );
    // The tell that JS took over: the 100% floor the CSS-only path needs is released.
    expect(el.style.getPropertyValue('--_marquee-min')).toBe('auto');
  });

  it('leaves markup without a content track alone', async () => {
    const el = await mount('<wc-marquee><span>no track</span></wc-marquee>');
    expect(el.style.getPropertyValue('--_marquee-min')).toBe('');
  });
});

describe('<wc-carousel>', () => {
  it('sets its a11y roles and picks up its slides', async () => {
    const el = await mount(
      '<wc-carousel><div>one</div><div>two</div><div>three</div></wc-carousel>',
    );
    expect(el.getAttribute('role')).toBe('region');
    expect(el.getAttribute('aria-roledescription')).toBe('carousel');
    // Clones are the observable result of having read the slides.
    expect(el.children.length).toBeGreaterThan(3);
  });

  it('leaves a single-slide carousel unenhanced', async () => {
    const el = await mount('<wc-carousel><div>only</div></wc-carousel>');
    expect(el.children.length).toBe(1);
  });
});

describe('<wc-tree>', () => {
  it('generates its toolbar', async () => {
    const el = await mount(`
      <wc-tree>
        <ul class="tree">
          <li class="tree__item" id="a">
            <span class="tree__content"><span class="tree__label">alpha</span></span>
          </li>
        </ul>
      </wc-tree>`);
    expect(el.querySelector('.tree__toolbar')).toBeTruthy();
    expect(el.querySelector('.tree__filter')).toBeTruthy();
  });

  it('leaves a tree-less body alone', async () => {
    const el = await mount('<wc-tree><p>nothing to enhance</p></wc-tree>');
    expect(el.querySelector('.tree__toolbar')).toBeNull();
  });
});
