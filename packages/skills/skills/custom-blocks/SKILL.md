---
name: custom-blocks
description: Decide whether a page section needs a new EmDash block type, and if so how to name, build, version and retire it. Use before creating, renaming or deleting any block type, any `src/components/blocks/*` renderer, or when asked to "add a block", "make an editable section" or "add a component the editors can place".
---

# Custom blocks

Pages are composed from **blocks** so non-technical editors can rearrange and edit
them in the CMS. A new block type is the most expensive way to get a section onto a
page: it adds a content-model entry, a renderer, a field schema and a migration
burden, and **a block type cannot be renamed or deleted** once pages use it (see
"Lifecycle"). So work down this list and stop at the first rung that fits.

## 1. Decision rule

1. **Compose what exists.** The `vitops_*` blocks from `@getvitops/emdash` (cards,
   carousel, gallery, accordion, details, banner, hero, marquee, image-compare,
   copy button, action link, …) resolve inside any block type's `portableText` field,
   so "a section with a heading, intro and then a row of cards" is a section block
   whose body holds `vitops_cards` — not a new "cards section" type. Check what is
   installed first: `vp exec vitops docs components` lists every block the toolchain
   ships and which tier provides it.
2. **Extend an existing block** if one is close. An extra option (a `variant`
   select, an optional slot) on a block that already exists is a version bump on that
   block, not a new type. Prefer this when the new thing is a variation of the same
   content shape.
3. **Site-local block type** only when the content shape is specific to this site
   (a bespoke dashboard mock, an A-versus-B argument with hard-coded figures). Keep
   the renderer in `src/components/blocks/` and the type name prefixed for the site
   (see "Naming"). Code-owned widgets expose only a caption field; the numbers live in
   code, not in the CMS.
4. **Upstream it** when a second site would plausibly want it. Don't build a
   generic block here and quietly fork it: raise it against the toolchain
   (`getvitops/design-system`) with the shape you used, so every site gets it. Until
   it ships, keep the local version and mark it `local (watch)` in a comment, so it
   is easy to retire when the real one lands.

A form, a section container, a stats row, a logo grid, a CTA band and a steps list
are all _generic_ — expect to find them upstream or to upstream them, not to keep
them local.

## 2. Naming: check the framework's vocabulary first

Block types are permanent, so the name has to be right the first time. Before you
name one:

- Run `vp exec vitops docs components` and `vp exec vitops docs classes`. If the
  framework already has a pattern by that name, **use its meaning**: `badge` is a
  _static_ label; `tag` is a label that may be static or dynamic (editable,
  dismissable). Never `chip` or `pill`. A block called `chips` that renders badges
  cost one site a new type, a content migration and a permanently retired type.
- Prefix site-local types with a short site code (`acme_section`), never `vitops.`
  — that namespace belongs to the toolchain.
- Name the thing, not its look: `section`, `steps`, `logos`; not `green-box`.

## 3. Field and renderer conventions

- **Colour: `tone` plus optional `color`.** `tone` takes a **role** name from
  `site.json`'s `colors.roles` (preferred), falling back to a semantic name
  (`info` `success` `warning` `danger`); `color` is the escape hatch for a palette
  hue/step and should be rare — a site that sets it on every item is telling you a
  role is missing. A select field can only list static options, so either list the
  roles you actually use or take a validated string. Resolve it in one shared helper
  (`src/components/blocks/tone.ts`) rather than per block.
- **Class names cannot be built from field values.** Tailwind only emits classes it
  can read in source, so `` `bg-${tone}` `` produces nothing. Resolve a tone to CSS
  custom properties (or a lookup table of whole class names) instead.
- **Links are `url` fields**, not `string`: EmDash's `url` type accepts site-relative
  paths. (`string` is a mistake that needs a breaking version to undo.)
- **Repeater sub-fields are scalar-only** (no `portableText`, no links inside text),
  so a checklist is one newline-separated `text` field. Don't fight it; rich item
  bodies need EmDash to lift that limit.
- **Nesting needs a `portableText` field.** A `vitops_*` Portable Text block holds
  only scalars and repeaters, so it can't contain blocks. A block _type_ with a
  `portableText` field can (`vitops_section`'s `body` holds any blocks), so "a
  section containing stats" is a section whose body holds `vitops_stats`. A flat
  sequence of siblings works too, but per-section backdrops don't carry across them.
- **Reach for framework classes** (`centered`, `region`, `rhythm`, `subgrid`,
  `cluster`, `font-*`, `card`, `badge`, `tag`) in the renderer; run
  `vpr lint:design` — hand-written layout CSS in a block is the signal that the
  framework is missing a pattern worth upstreaming.
- A card title is a heading: render a real `<h2>`–`<h4>` with a level prop, not a
  styled `<p>`.

## 4. Lifecycle

- **Create** with the schema tools (the `schema_*` actions on the site's MCP server,
  `/_emdash/api/mcp`) or the admin; commit the matching renderer and the
  `emdash export-seed` output so a fresh environment gets the same model.
- **A breaking change is a new version**, not an edit: add the version, migrate the
  entries that use the old one, then activate it. Two things the tooling does not say:
  `schema_activate_block_type_version`'s `expectedFingerprint` is the fingerprint of
  the **currently active** version, not the one you are activating (a mismatch is a
  `CONFLICT`), and `schema_update_block_type` **replaces the whole `fields` list**, so
  send every field, not just the changed one.
- **Migrating content:** `emdash content update` has no `--migrate-blocks` flag; the
  REST route `PUT /_emdash/api/content/<collection>/<id>` with
  `{ data, _rev, migrateBlocks: true }` does (it takes Portable Text arrays; the CLI
  and MCP take Markdown). Updating a published entry stages a **draft** — a separate
  `content publish` is needed before the live page changes, and (because pages are
  prerendered) a rebuild after that.
- **Retiring is not deleting.** A type that was renamed or superseded stays in the
  database and the seed permanently; keep its renderer mapping old values so existing
  content still renders, mark it retired, and stop offering it to editors.
- **Typed fields:** `emdash types` does not type `blocks` fields (they come out as
  `unknown[]`); hand-write a value type per renderer until EmDash generates it.
