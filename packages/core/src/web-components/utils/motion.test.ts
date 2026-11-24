import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { scrollBehavior } from './motion.ts';

afterEach(() => vi.unstubAllGlobals());

describe('scrollBehavior', () => {
  it('is smooth by default', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    expect(scrollBehavior()).toBe('smooth');
  });

  it('is instant when the visitor prefers reduced motion', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    expect(scrollBehavior()).toBe('auto');
  });

  it('reads the preference at call time, not at import', () => {
    let reduce = false;
    vi.stubGlobal('matchMedia', () => ({ matches: reduce }));
    expect(scrollBehavior()).toBe('smooth');
    reduce = true;
    expect(scrollBehavior()).toBe('auto');
  });

  it('falls back to smooth where matchMedia does not exist', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(scrollBehavior()).toBe('smooth');
  });
});
