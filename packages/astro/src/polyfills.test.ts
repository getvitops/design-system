import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vite-plus/test';
import { POLYFILL_NAMES, resolvePolyfills } from './polyfills.ts';

const HERE = dirname(fileURLToPath(import.meta.url));

describe('resolvePolyfills', () => {
  it('is empty by default, so existing sites change nothing', () => {
    expect(resolvePolyfills()).toEqual({ enable: [], disable: [] });
    expect(resolvePolyfills({})).toEqual({ enable: [], disable: [] });
  });

  it('keeps valid names and drops duplicates', () => {
    expect(resolvePolyfills({ enable: ['temporal', 'temporal'], disable: ['popover'] })).toEqual({
      enable: ['temporal'],
      disable: ['popover'],
    });
  });

  it('rejects an unknown name and lists the valid ones', () => {
    // @ts-expect-error -- the closed union is what makes this a compile error for a typed config.
    expect(() => resolvePolyfills({ disable: ['popovr'] })).toThrow(
      /unknown polyfill "popovr".*popover/,
    );
  });

  it('rejects a name in both lists', () => {
    expect(() => resolvePolyfills({ enable: ['temporal'], disable: ['temporal'] })).toThrow(
      /both enable and disable/,
    );
  });
});

describe('POLYFILL_NAMES', () => {
  it('matches the names @getvitops/core registers, in both lists', () => {
    const src = readFileSync(join(HERE, '../../core/src/js/polyfills.ts'), 'utf8');
    // Active entries only: a commented-out polyfill (`// name: 'scroll-timeline'`) is not shipped.
    const core = src
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('//'))
      .flatMap((line) => /^\s*name: '([^']+)'/.exec(line)?.[1] ?? [])
      .sort();
    expect([...POLYFILL_NAMES].sort()).toEqual(core);
  });
});
