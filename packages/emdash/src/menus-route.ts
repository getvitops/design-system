/**
 * The `menus/list` plugin route: what fills `vitops_nav`'s `menu` select with the site's own
 * EmDash menus, so an editor picks from what exists instead of typing a name that may not.
 *
 * Same mechanism as `tones-route.ts` and the same failure rule: Block Kit's `select` falls
 * back to its static options if the route throws or answers with no `items`, so a lookup that
 * cannot run (no request context, no database) degrades to the conventional menu names rather
 * than breaking the block editor. The lister is injected so the route is testable without a
 * database; `index.ts` passes EmDash's own `getMenus`.
 */
import type { PluginRoute } from 'emdash';

export interface MenuSummary {
  name: string;
  label: string;
}

export interface MenuItemOption {
  id: string;
  name: string;
}

/** The items the select shows: one per menu, valued by its `name` (what `getMenu()` takes). */
export function menuItems(menus: readonly MenuSummary[]): MenuItemOption[] {
  const seen = new Set<string>();
  const out: MenuItemOption[] = [];
  for (const { name, label } of menus) {
    // A menu per locale shares one name; the select needs it once.
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push({ id: name, name: label && label !== name ? `${label} (${name})` : name });
  }
  return out;
}

export function createMenusRoute(list: () => Promise<readonly MenuSummary[]>): PluginRoute {
  return {
    // An editor opening the block needs this; it reads menu names, never their content.
    permission: 'content:read',
    handler: async () => {
      try {
        return { items: menuItems(await list()) };
      } catch {
        // No `items` => the select keeps its static options.
        return { items: [] };
      }
    },
  };
}
