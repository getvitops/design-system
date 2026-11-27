/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';
import { discover, load, scan, setImporter, start } from './loader-core.ts';

/** An importer that "loads" a tag by defining a stand-in element, and records the order. */
function fakeImporter(calls: string[], dependencies: Record<string, string[]> = {}) {
  return async (tag: string) => {
    calls.push(tag);
    if (!customElements.get(tag)) {
      const ctor = class extends HTMLElement {};
      Object.assign(ctor, { dependencies: dependencies[tag] ?? [] });
      customElements.define(tag, ctor);
    }
  };
}

// happy-dom keeps one registry per window, so each test uses tags no other test defines.
let n = 0;
const fresh = () => `x${(n += 1)}`;

beforeEach(() => {
  document.body.innerHTML = '';
});
afterEach(() => setImporter());

describe('discover', () => {
  it('finds undefined, owned tags only', () => {
    document.body.innerHTML = `<wc-copy></wc-copy><wc-consent></wc-consent><wc-site-thing></wc-site-thing><p></p>`;
    expect(discover(document)).toEqual(['wc-copy']);
  });

  it('includes the root itself', () => {
    const el = document.createElement('wc-tabs');
    expect(discover(el)).toEqual(['wc-tabs']);
  });
});

describe('load', () => {
  it('imports an owned tag once, however many times it is asked', async () => {
    const calls: string[] = [];
    setImporter(fakeImporter(calls));
    await Promise.all([load('wc-range'), load('wc-range')]);
    await load('wc-range');
    expect(calls).toEqual(['wc-range']);
  });

  it('ignores a tag it does not own', async () => {
    const calls: string[] = [];
    setImporter(fakeImporter(calls));
    await load('wc-consent');
    await load(`wc-${fresh()}`);
    expect(calls).toEqual([]);
  });

  it('loads a gallery together with its carousel dependency', async () => {
    const calls: string[] = [];
    setImporter(fakeImporter(calls, { 'wc-gallery': ['wc-carousel'] }));
    await load('wc-gallery');
    expect(calls.sort()).toEqual(['wc-carousel', 'wc-gallery']);
  });

  it('forgets a failed import so a later scan can retry', async () => {
    let attempts = 0;
    setImporter(async (tag) => {
      attempts += 1;
      if (attempts === 1) throw new Error('offline');
      customElements.define(tag, class extends HTMLElement {});
    });
    await load('wc-marquee');
    expect(customElements.get('wc-marquee')).toBeUndefined();
    await load('wc-marquee');
    expect(customElements.get('wc-marquee')).toBeDefined();
  });
});

describe('start', () => {
  it('upgrades tags that arrive after the first scan', async () => {
    const calls: string[] = [];
    setImporter(fakeImporter(calls));
    start();
    const host = document.createElement('div');
    host.innerHTML = '<wc-tree></wc-tree>';
    document.body.append(host);
    await new Promise((r) => setTimeout(r, 0));
    await scan(host);
    expect(calls).toContain('wc-tree');
  });
});
