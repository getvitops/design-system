import { describe, expect, test } from 'vite-plus/test';
import { validateConfig } from './config.ts';
import { defaultConfig } from './index.ts';

function fixture(chrome: unknown): unknown {
  return {
    designSystem: { themes: { default: defaultConfig() } },
    organization: { name: 'Acme', email: 'a@acme.example' },
    site: {
      defaultLocale: 'en',
      locales: { en: { name: 'English' } },
      environments: { production: { url: 'https://acme.example' } },
      domains: { canonical: 'https://acme.example' },
      chrome,
    },
  };
}

const errorsFor = (raw: unknown): string[] => {
  const r = validateConfig(raw);
  return r.ok ? [] : r.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
};

describe('site.chrome', () => {
  test('accepts a full masthead and nav block', () => {
    expect(
      errorsFor(
        fixture({
          masthead: {
            position: 'sticky',
            behavior: 'hide-on-scroll',
            surface: 'glass',
            layout: 'floating',
            width: 'content',
            elevation: { border: true, onScroll: true },
            height: 'clamp(3.5rem, 8cqi, 4.5rem)',
            inset: '0.75rem',
          },
          nav: { compact: 'dropdown', depth: 2, drawerSide: 'start', megaBreakpoint: 'lg' },
        }),
      ),
    ).toEqual([]);
  });

  test('rejects an unknown enum value and an unknown key', () => {
    expect(errorsFor(fixture({ masthead: { position: 'absolute' } })).join()).toMatch(/position/);
    expect(errorsFor(fixture({ masthead: { sticky: true } })).join()).toMatch(/sticky/);
    expect(errorsFor(fixture({ nav: { depth: 4 } })).join()).toMatch(/depth/);
  });

  test('rejects a tone that is not a role and a shadow that is not defined', () => {
    expect(errorsFor(fixture({ masthead: { tone: 'nope' } })).join()).toMatch(/not a colors.roles/);
    expect(errorsFor(fixture({ masthead: { elevation: { shadow: 'nope' } } })).join()).toMatch(
      /not a designSystem.shadows/,
    );
  });
});
