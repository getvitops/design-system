---
'@getvitops/emdash': minor
'@getvitops/create': minor
'@getvitops/generator': minor
'@getvitops/astro': minor
'@getvitops/vite': minor
'@getvitops/cli': minor
'@getvitops/utils': minor
'@getvitops/core': patch
---

Escape hatches on every block, a section theme, widget areas, a badges block, Tailwind scanning of package renderers, and a sturdier `vitops audit`.

**@getvitops/emdash**

- Every `vitops_*` block and `vitops_section` gains three fields: `anchor` (rendered as the `id`, so `#contact` works), `className` (`class_name` on the section type: block-type slugs are lowercase) and `style`. `style` takes CSS custom properties only (`--p-card: 2rem`); any other declaration, and any value containing `url(`, `@`, `{`, `}` or a backslash, is dropped. With the `tailwind` format a class typed in the CMS only works if the site already uses it. They are applied to the block's own outermost element (the grid `<ul>` for `vitops_cards`), never an extra wrapper, so a block's markup is the same whether or not an editor fills them in.
- `vitops_section` gains a `theme` select: a role, or `<role>:solid`, with readable text chosen by the generator's contrast rules. It overrides `tone`/`color`/`solid`, which stay for existing content. Other site roles still go through `tone`.
- New `vitops_badges` block (a row of `.badge` or `.tag` labels, each with an optional tone, icon and link) and `vitops_widgetArea` block, plus `<VitopsWidgetArea name level />` from `@getvitops/emdash/astro`. A widget area is content defined once under Widgets and shown wherever it is placed. An area cannot hold another area, and an area containing a `core:*` component widget is rendered by EmDash's own renderer.
- Existing sites: re-run the block-type seed only on a new database; on an existing one add the `theme`, `anchor`, `className` and `style` fields to the `vitops_section` block type in the admin.

**@getvitops/create**: the emdash template seeds `announcement` and `pre-footer` widget areas, renders them in `Layout.astro`, and documents when to use a Section, a block or a widget area. Sites scaffolded earlier add the two `<VitopsWidgetArea>` lines and the `widgetAreas` seed entries by hand.

**@getvitops/generator / astro / vite** (`tailwind` format only): the Astro integration now adds `@source` lines for `@getvitops/astro` and `@getvitops/emdash`, because Tailwind v4 does not scan `node_modules`; utilities used only by their renderers (`font-display`, `font-caption`, `font-footnote`) were never emitted and the page silently rendered at body size. New `sources` option on `generate()` and the Vite plugin. A site's `src/package-classes.txt` workaround can be deleted. css and bricks: no change.

**@getvitops/cli**: `vitops emdash check-prerender` now also warns when a page uses a type-role class (`font-display`, …) the built CSS has no rule for; `--strict` makes it fail. `vitops audit` checks for its optional packages and a Chromium binary before starting the preview server (so a failed run no longer leaves port 4398 busy), stops the server on Ctrl+C and termination, and takes its page list from the built sitemap, then the menus; the guessed defaults (`/privacy`, `/contact`, …) are used only when neither exists.

**@getvitops/utils**: the audit helpers behind the above (`preflight`, `fetchSitemapPaths`, `sitemapLocs`, `pathsFromSitemapLocs`).

**@getvitops/core** (all formats): new `.block-anchor` rule gives an anchored block `scroll-margin-top: var(--header-offset, 5rem)`; set `--header-offset` to a sticky header's height. New `widget-area.css` partial. No other consumer-facing change.

The other fixed-group packages: no consumer-facing change beyond the above.

**Also fixed in the emdash template** (`site.json`): it defined only the `display`, `heading` and `body` type roles while the blocks use `title`, `eyebrow`, `lead`, `caption` and `footnote`, so those rendered at body size with no rule behind them. The roles are added with the reference design system's specs. A site scaffolded earlier adds the same five entries under `designSystem.themes.default.typography.roles`; `vitops emdash check-prerender` now names any that are missing.
