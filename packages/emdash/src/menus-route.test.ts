import { describe, expect, it } from 'vite-plus/test';
import { createMenusRoute, menuItems } from './menus-route.ts';

describe('menus/list', () => {
  it('lists each menu once, valued by the name getMenu() takes', () => {
    expect(
      menuItems([
        { name: 'primary', label: 'Primary' },
        { name: 'footer-sitemap', label: 'Site map' },
        // A menu per locale shares a name.
        { name: 'footer-sitemap', label: 'Plan du site' },
        { name: '', label: 'broken' },
      ]),
    ).toEqual([
      { id: 'primary', name: 'Primary (primary)' },
      { id: 'footer-sitemap', name: 'Site map (footer-sitemap)' },
    ]);
  });

  it('answers with the menus it was given', async () => {
    const route = createMenusRoute(async () => [{ name: 'primary', label: 'primary' }]);
    expect(route.permission).toBe('content:read');
    await expect((route.handler as (c: unknown) => Promise<unknown>)({})).resolves.toEqual({
      items: [{ id: 'primary', name: 'primary' }],
    });
  });

  it('answers with no items when the lookup cannot run, so the select keeps its static options', async () => {
    const route = createMenusRoute(async () => {
      throw new Error('no request context');
    });
    await expect((route.handler as (c: unknown) => Promise<unknown>)({})).resolves.toEqual({
      items: [],
    });
  });
});
