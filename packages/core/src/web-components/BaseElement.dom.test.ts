/**
 * @vitest-environment happy-dom
 *
 * `BaseElement.connectionSignal`: a listener on `document` that is registered through it must
 * stop firing when the element disconnects, and must work again after a reconnect — which is the
 * case an add/remove pair gets wrong when only one half is re-run.
 */
import { beforeAll, describe, expect, it } from 'vite-plus/test';

let Probe: CustomElementConstructor;

beforeAll(async () => {
  const { BaseElement } = await import('./BaseElement.ts');
  class WCConnectionProbe extends BaseElement {
    hits = 0;
    readonly seen: AbortSignal[] = [];
    override connectedCallback(): void {
      super.connectedCallback();
      this.seen.push(this.connectionSignal);
      document.addEventListener('wc-probe-ping', () => this.hits++, {
        signal: this.connectionSignal,
      });
    }
    override createRenderRoot(): HTMLElement {
      return this;
    }
  }
  Probe = WCConnectionProbe;
  customElements.define('wc-connection-probe', Probe);
});

const ping = (): void => {
  document.dispatchEvent(new Event('wc-probe-ping'));
};

type ProbeEl = HTMLElement & { hits: number; seen: AbortSignal[] };

describe('BaseElement.connectionSignal', () => {
  it('stops an external listener on disconnect', () => {
    const el = document.createElement('wc-connection-probe') as ProbeEl;
    document.body.append(el);
    ping();
    expect(el.hits).toBe(1);
    el.remove();
    ping();
    expect(el.hits).toBe(1);
    expect(el.seen[0]!.aborted).toBe(true);
  });

  it('gives a reconnected element a fresh signal, and does not double-fire', () => {
    const el = document.createElement('wc-connection-probe') as ProbeEl;
    document.body.append(el);
    el.remove();
    document.body.append(el);
    ping();
    // One live listener, not two: the first connection's was aborted.
    expect(el.hits).toBe(1);
    expect(el.seen).toHaveLength(2);
    expect(el.seen[0]).not.toBe(el.seen[1]);
    expect(el.seen[0]!.aborted).toBe(true);
    expect(el.seen[1]!.aborted).toBe(false);
    el.remove();
  });
});
