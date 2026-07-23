# Session summary — @getvitops/emdash: design system → EmDash editing portal

Handoff notes so a fresh session (any model) can continue. Supersedes the previous
Bricks/Home-migration summary (that work shipped; see git history around `2c7c050`).

## What was built (all working, all UNCOMMITTED)

The repo TODO "map Astro components + web components into EmDash's editing portal" is done at
v1 as **`packages/emdash` → `@getvitops/emdash`**, an EmDash **native plugin**:

- `src/index.ts` — descriptor factory `vitopsEmdash()` + `createPlugin` (`definePlugin`).
  Options: `scripts: 'integration' (default) | 'fragments'` (page:fragments script injection for
  `<EmDashHead/>` layouts), `wcBase` (default `/vitops`). Composes with — does not replace —
  the `getvitops()` Astro integration (CSS + WC bundles to `public/vitops/`); a plugin cannot
  run integration build-time work (no `astro:config:setup` surface).
- `src/blocks.ts` — 5 flat-field Portable Text blocks: `vitops.imageCompare`, `vitops.copyButton`,
  `vitops.banner`, `vitops.details`, `vitops.carousel`. Repeating-data patterns (Cards, wc-entries,
  FAQ, forms) deliberately excluded — EmDash Block Kit PT fields are flat; use Sections / Field Kit
  `list` on json collection fields instead (recipes in package README, backlog in TODO.md).
- `src/astro/index.ts` — `blockComponents` map (export name required by EmDash), thin `.astro`
  blocks emitting `wc-*` tags + accessible no-JS fallbacks with framework classes.
  **Key fact:** EmDash's `<PortableText>` → astro-portabletext passes the block as **`props.node`**
  (fields flat beside `_type`); `src/astro/blocks/value.ts#resolveBlockValue` normalizes.
- Tests: `src/blocks.test.ts` (12 pass) — descriptor/version/capability shape, fragments hook
  output, and field `action_id` ↔ component-prop agreement. Note `definePlugin` normalizes hooks
  to `{handler, pluginId}`.
- Wiring: `build:emdash` task in root `vite.config.ts` (+ `build:packages` chain), `emdash: ^0.31.0`
  in the pnpm catalog, changesets **independent** versioning (not in the fixed group),
  `.changeset/emdash-plugin-tier.md` covers utils minor + astro patch.

Groundwork in existing packages:

- `packages/utils/src/schema/` — pure JSON-LD builders extracted (`articleGraph`,
  `organizationGraph`, `breadcrumbGraph`, `faqGraph`), re-exported from utils index; the four
  `packages/astro/src/schemas/*.astro` are now thin wrappers. Seam for the v2 `page:metadata` hook.
  (~20 more schemas can be extracted the same way as needed.)
- `packages/astro/src/layouts/Layout.astro` — removed broken import of deleted `Polyfills.astro`.

Dogfood in `apps/portal` (per user decision):

- `astro.config.mjs`: added `react()` + `emdash({ database: sqlite('file:./emdash.db'),
storage: local('./uploads'), plugins: [vitopsEmdash()] })` alongside existing `getvitops()`.
- `src/live.config.ts` (emdashLoader), `src/pages/cms/[slug].astro` (renders `pages` entries via
  `<PortableText>`), middleware bypasses `/_emdash/*` (EmDash owns its auth) and makes `/cms/*`
  public (**policy call the user may want to revisit**), `.gitignore` for emdash.db/uploads/
  emdash-env.d.ts, portal deps: emdash/react/react-dom/@astrojs/react/better-sqlite3.

## Verified (browser + API)

- `/_emdash/api/manifest` → `data.plugins.vitops.portableTextBlocks` lists all 5 (feeds slash menu).
- Demo page "Vitops blocks demo" (id `01KY7V7PG8AQZZXZ063ZRRH6CS`, slug `vitops-demo`, published)
  contains all 5 blocks; `/cms/vitops-demo` renders correct enhanced markup + fallbacks + the 3
  `/vitops/*.js` tags from `<Head/>`.
- In-browser: editor shows the blocks, `/banner` slash command filters to Banner, Insert form shows
  Message/Tone/Dismissible. Test edits undone, page unchanged.
- Content API gotchas: create with `status:"draft"` + `slug` TOP-LEVEL; publish via
  `POST /_emdash/api/content/<coll>/<id>/publish`; non-GET needs `X-EmDash-Request: 1` + cookie.

## Two EmDash instances — do not confuse

- **:4322** = this repo, `apps/portal` dogfood (Astro daemon: `npx astro dev` in apps/portal;
  `astro dev logs|stop`). Login: `http://localhost:4322/_emdash/api/setup/dev-bypass?redirect=/_emdash/admin`.
  No email provider → magic links silently don't send; only user is the dev admin.
  Daemon does NOT pick up installs done after a config-change restart — restart manually.
- **:4321** = `/home/alex/dev/vitops-website` — the REAL site (EmDash 0.28.1, GitHub
  `authProviders`, D1/R2, Home/Pricing/Contact, consumes published `@getvitops/astro@0.1.1`).
  The plugin is NOT there yet — see the "Adopt in vitops-website" TODO in TODO.md (needs emdash
  0.31 upgrade + publishing `@getvitops/emdash`).

## Next steps

1. **Commit** — everything above is uncommitted (git status: modified TODO.md, portal files,
   Layout/schemas/utils, vite.config.ts, pnpm-workspace.yaml, lockfile; new packages/emdash/,
   packages/utils/src/schema/, portal cms page/live.config/.gitignore, changeset).
2. Optionally release (`npx vp run release`) so vitops-website can consume published packages.
3. **Adopt in vitops-website** (TODO.md entry with exact steps).
4. v2 backlog in TODO.md: page:metadata JSON-LD hook, Sections/Field-Kit recipes, widget
   components, getMenu()→Nav adapter, carousel field UX, pin emdash peer.

Plan file for the original implementation: `~/.claude/plans/on-our-todo-is-zany-cerf.md`.
Memory: `emdash-plugin-dogfood` in the project memory dir has the operational gotchas.
