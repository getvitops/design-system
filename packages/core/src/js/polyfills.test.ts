import { describe, expect, it } from 'vite-plus/test';
import {
  OPT_IN_POLYFILLS,
  prerenderPolyfills,
  readPolyfillSelection,
  selectPolyfills,
  type Polyfill,
} from './polyfills.ts';

const fake = (name: string): Polyfill => ({ name, test: () => false, load: async () => {} });
const LIST = ['webcomponents', 'temporal', 'popover'].map(fake);
const names = (list: Polyfill[]): string[] => list.map((p) => p.name);

describe('selectPolyfills', () => {
  it('turns everything on except the opt-in set by default', () => {
    expect(names(selectPolyfills(LIST))).toEqual(['webcomponents', 'popover']);
  });

  it('turns an opt-in polyfill on when asked', () => {
    expect(names(selectPolyfills(LIST, { enable: ['temporal'] }))).toEqual([
      'webcomponents',
      'temporal',
      'popover',
    ]);
  });

  it('leaves a disabled polyfill out', () => {
    expect(names(selectPolyfills(LIST, { disable: ['popover'] }))).toEqual(['webcomponents']);
  });

  it('lets disable win over enable', () => {
    expect(names(selectPolyfills(LIST, { enable: ['temporal'], disable: ['temporal'] }))).toEqual([
      'webcomponents',
      'popover',
    ]);
  });

  it('ignores names that match nothing', () => {
    expect(names(selectPolyfills(LIST, { enable: ['nope'], disable: ['nope'] }))).toEqual([
      'webcomponents',
      'popover',
    ]);
  });

  it('keeps temporal out of the shipped prerender list by default', () => {
    expect(OPT_IN_POLYFILLS).toContain('temporal');
    expect(names(selectPolyfills(prerenderPolyfills))).not.toContain('temporal');
    expect(names(selectPolyfills(prerenderPolyfills))).toContain('popover');
  });

  it('every opt-in name is a real polyfill, so a rename cannot orphan it', () => {
    for (const opt of OPT_IN_POLYFILLS) expect(names(prerenderPolyfills)).toContain(opt);
  });
});

describe('readPolyfillSelection', () => {
  const docWith = (dataset?: Record<string, string>): Pick<Document, 'querySelector'> => ({
    querySelector: (() => (dataset ? { dataset } : null)) as Document['querySelector'],
  });

  it('splits the space-separated attributes', () => {
    const doc = docWith({
      polyfillsEnable: 'temporal',
      polyfillsDisable: 'popover  invoker-commands',
    });
    expect(readPolyfillSelection(doc)).toEqual({
      enable: ['temporal'],
      disable: ['popover', 'invoker-commands'],
    });
  });

  it('means the default set when there is no tag or no attributes', () => {
    expect(readPolyfillSelection(docWith())).toEqual({ enable: [], disable: [] });
    expect(readPolyfillSelection(docWith({}))).toEqual({ enable: [], disable: [] });
  });
});
