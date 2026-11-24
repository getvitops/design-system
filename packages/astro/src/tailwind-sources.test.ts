import { describe, expect, it } from 'vite-plus/test';
import { tailwindSources } from './tailwind-sources.ts';

describe('tailwindSources', () => {
  const resolve = (pkg: string) => `/site/node_modules/${pkg}/package.json`;

  it('points at each installed package, relative to the generated CSS', () => {
    expect(tailwindSources('/site/src/styles', resolve)).toEqual([
      '../../node_modules/@getvitops/astro/src/components',
      '../../node_modules/@getvitops/emdash/src/astro',
    ]);
  });

  it('skips a package that is not installed', () => {
    const only = (pkg: string) => {
      if (pkg === '@getvitops/emdash') throw new Error('not found');
      return resolve(pkg);
    };
    expect(tailwindSources('/site/src/styles', only)).toEqual([
      '../../node_modules/@getvitops/astro/src/components',
    ]);
  });
});
