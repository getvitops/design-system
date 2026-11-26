// @vitest-environment happy-dom
import { describe, expect, it } from 'vite-plus/test';

/**
 * `window.vitopsAds.ready` — the signal that replaces a consumer's poll-for-`gtag` loop. The
 * script is a plain module with top-level side effects, so it is imported once and driven through
 * the same document event the consent runtime fires when a gated tag activates.
 */
describe('window.vitopsAds.ready', () => {
  it('stays pending until a Google tag defines gtag, then resolves on the tag event', async () => {
    const w = window as unknown as {
      gtag?: (...a: unknown[]) => void;
      vitopsAds?: { ready: Promise<void> };
    };
    delete w.gtag;
    await import('./scripts/tracking.ts');
    expect(w.vitopsAds?.ready).toBeInstanceOf(Promise);

    let resolved = false;
    void w.vitopsAds!.ready.then(() => (resolved = true));
    document.dispatchEvent(new CustomEvent('vitops:tag'));
    await Promise.resolve();
    expect(resolved, 'no gtag yet, so a tag event alone must not resolve it').toBe(false);

    w.gtag = () => {};
    document.dispatchEvent(new CustomEvent('vitops:tag'));
    await w.vitopsAds!.ready;
    expect(resolved).toBe(true);
  });
});
