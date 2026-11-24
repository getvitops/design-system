import { describe, expect, test } from 'vite-plus/test';
import { mergeOwned } from './merge.ts';

describe('mergeOwned', () => {
  test('touches only the paths the form owns', () => {
    const current = { organization: { name: 'Acme', email: 'old@acme.ca', phone: '123' } };
    const patch = { organization: { name: 'Acme Inc', email: 'new@acme.ca' } };
    // The contact step owns email only; the patch's name is outside it.
    expect(mergeOwned(current, patch, [{ path: 'organization.email' }])).toEqual({
      organization: { name: 'Acme', email: 'new@acme.ca', phone: '123' },
    });
  });

  test('a step does not erase the answers of the other steps', () => {
    const current = {
      organization: { name: 'Acme', legalName: 'Acme Inc.' },
      site: { defaultLocale: 'en' },
    };
    const patch = { organization: { email: 'hello@acme.ca' } };
    expect(mergeOwned(current, patch, [{ path: 'organization.email' }])).toEqual({
      organization: { name: 'Acme', legalName: 'Acme Inc.', email: 'hello@acme.ca' },
      site: { defaultLocale: 'en' },
    });
  });

  test('an owned field the patch lacks is cleared — and an emptied parent goes with it', () => {
    const current = { organization: { name: 'Acme', address: { postalCode: 'K1P 1J1' } } };
    expect(mergeOwned(current, { organization: {} }, [{ path: 'organization.address' }])).toEqual({
      organization: { name: 'Acme' },
    });
    expect(
      mergeOwned({ site: { notifications: { email: 'a@b.ca' } } }, {}, [
        { path: 'site.notifications' },
      ]),
    ).toEqual({});
  });

  test('an owned map is replaced wholesale', () => {
    const current = { site: { ads: { google: { enabled: true }, meta: { enabled: true } } } };
    const patch = { site: { ads: { google: { enabled: false } } } };
    expect(mergeOwned(current, patch, [{ path: 'site.ads' }])).toEqual({
      site: { ads: { google: { enabled: false } } },
    });
  });

  test('a narrowed map keeps the fields the form never shows', () => {
    const current = {
      organization: {
        locations: {
          ottawa: { name: 'Ottawa', phone: '1', hours: [{ day: 'mon' }] },
          gone: { name: 'Closed', hours: [{ day: 'tue' }] },
          bare: { name: 'No extras' },
        },
      },
    };
    const patch = {
      organization: { locations: { ottawa: { name: 'Ottawa HQ' }, fresh: { name: 'New' } } },
    };
    const merged = mergeOwned(current, patch, [
      { path: 'organization.locations', fields: ['name', 'phone'] },
    ]);
    expect(merged.organization.locations).toEqual({
      // owned `phone` was cleared (absent from the patch), unowned `hours` stayed
      ottawa: { name: 'Ottawa HQ', hours: [{ day: 'mon' }] },
      // a removed row loses its owned fields but keeps what only it holds
      gone: { hours: [{ day: 'tue' }] },
      fresh: { name: 'New' },
    });
  });

  test('a palette edit keeps the anchors the brand step never shows', () => {
    const palette = 'designSystem.themes.default.colors.palette';
    const current = {
      designSystem: {
        themes: {
          default: { colors: { palette: { brand: { seed: '#111', anchors: { 500: '#222' } } } } },
        },
      },
    };
    const patch = {
      designSystem: { themes: { default: { colors: { palette: { brand: { seed: '#333' } } } } } },
    };
    expect(mergeOwned(current, patch, [{ path: palette, fields: ['seed'] }])).toEqual({
      designSystem: {
        themes: {
          default: { colors: { palette: { brand: { seed: '#333', anchors: { 500: '#222' } } } } },
        },
      },
    });
  });

  test('does not mutate its inputs', () => {
    const current = { organization: { name: 'Acme' } };
    const snapshot = structuredClone(current);
    mergeOwned(current, { organization: { name: 'Other' } }, [{ path: 'organization.name' }]);
    expect(current).toEqual(snapshot);
  });
});

describe('ownedFromProjections', () => {
  test('lists paths, keeps a narrowed map’s fields, and skips notices', async () => {
    const { projectionById } = await import('./projections.ts');
    const { ownedFromProjections } = await import('./merge.ts');
    const brand = projectionById('brand.basics')!;
    const owned = ownedFromProjections([brand]);
    expect(owned.length).toBeGreaterThan(0);
    expect(owned.every((o) => typeof o.path === 'string')).toBe(true);
    expect(owned.some((o) => o.fields?.includes('seed'))).toBe(true);
    expect(
      ownedFromProjections([{ id: 'x', title: 'x', items: [{ kind: 'notice', id: 'n' }] }]),
    ).toEqual([]);
  });
});
