---
'@getvitops/generator': minor
'@getvitops/core': minor
'@getvitops/utils': minor
'@getvitops/astro': minor
'@getvitops/vite': minor
'@getvitops/cli': minor
---

Icons: one semantic vocabulary across icon sets, with the bundle derived from your source.

Name icons by meaning — `<Icon name="menu" />` resolves to `fa7-solid:bars`, `ph:list` or
`lucide:menu` depending on the set you configure, so swapping sets is a config edit rather than a
find-and-replace. A name containing `:` still passes through untouched, which is the escape hatch
for a set-specific glyph.

**New `icons` option on `getvitops()`.** Configures the sets once per site and, under
`output: 'server'`, derives astro-icon's `include` map by scanning your source — the list most
projects end up maintaining by hand. On a static build no `include` is passed at all, because
astro-icon is already zero-config there and a list could only drop a glyph the scan couldn't see.
Names you declare that don't resolve fail the build; names only the scan found just warn; names
computed at runtime are reported with file and line so you can declare them.

**New `<Icon />` component**, and a real fix with it: `Popover`, `Details` and `Drawer` imported
`astro-icon/components` at module scope, so the _optional_ peer was resolved whether or not an icon
ever rendered — hard-failing anyone who hadn't installed it. Engines now load dynamically. The
per-component `iconResolver` prop still works but is deprecated in favour of the integration option.

**New SVG sprite** (`icons.sprite: true` in your site config) for consumers that can't run an icon
integration — Bricks/WordPress, EmDash renderers, plain HTML. `<use href="…/icons.svg#ph--list">`,
no JavaScript and no icon-API request. Every semantic name also gets a set-independent `icon-<name>`
alias, so sprite markup survives an icon-set change. WordPress gets `vitops_icon()`, a
`[vitops_icon]` shortcode and a **Vitops → Icon** Bricks element.

**New `vitops icons`** command: reports which icons your source uses, which names couldn't be
resolved, and which are computed at runtime; `--sprite` builds the sprite, `--json` for CI.

**Renamed, for a vocabulary that reads as one system.** The chevron family now
says what it does rather than which way it points — `expand-more`/`expand-less` →
`expand-vert`/`collapse-vert`, `chevron-right`/`chevron-left` →
`expand-horiz`/`collapse-horiz` — and the arrows drop their prefix:
`arrow-forward`/`arrow-back` → `forward`/`back`. `lightning` is new.

If you passed any of the old names to `<Icon />`, `resolveIcon` or an `icons`
config, update them. They fail loudly rather than silently: an unresolvable
declared name throws, and `vitops icons` reports scanned ones.

**Phosphor (`ph`) joins the semantic map**, with all 83 names verified against the real icon set.
Phosphor keeps every weight in one collection and varies the name (`list`, `list-bold`), unlike Font
Awesome's per-weight collections, so `resolveIcon` and `generateIconInclude` gained a `weight`
option for sets shaped that way.

Fixes: `site.icons` was a closed object, so any icon collection not in its hand-written key list was
silently dropped during validation — your config passed and the icons never bundled. It accepts any
collection name now.
