# Design-system TODO

Context: one shared design-system schema (`src/design-system.json`) drives every site we
build — WordPress/Bricks **and** Cloudflare EmDash (Astro/Tailwind). Keep tokens and pattern
names platform-agnostic so the same schema round-trips through both the Bricks generators and
the Tailwind (`--format=tailwind`) output.

## Patterns: `badge` + `tag` only — ✅ done

Superseded an earlier plan that kept `badge` + `chip` and dropped `tag`. The split is now by
**behaviour**, not by size:

- **`badge`** — a **static** label (status, count, category). Not interactive.
- **`tag`** — an **editable and/or dismissable** label or item (e.g. entries in a filter list),
  with `.tag__remove` / `.tag__icon` sub-parts.
- **`chip` is retired** as vocabulary. `.chip-list` became `.tag-list`, and its bespoke
  `__chip` / `__chip-remove` sub-parts were deleted in favour of the existing `.tag` /
  `.tag__remove` — a tag list is a list of tags. The redundant `radii.chip` primitive (which
  was only ever an alias of `--br-tag`) is gone.

Still open:

- **Remove `pill`-specific tokens** (`--br-pill`, the `radii.pill` primitive). Badge should
  reference its own radius (`--br-badge`) rather than a standalone `pill`. Note `--br-pill` is
  still referenced by `forms.css` (switch track), `list.css` (count) and `tag.css`
  (badge-indicator), and the `, 999px` fallbacks are **live in the bricks format**, where
  `patterns.radii` is not emitted (`generate.ts:367`).
- `typography.roles` has a `tag` type role, unrelated to the `tag` pattern — worth
  disambiguating.

Resolved along the way: the `tag` **group** was renamed to **`label`**. Previously the `tag`
pattern and the `tag` group both compiled to `--{p,br,b,ds,fs}-tag`, so the pattern's override
hook and the group token were the same variable and the pattern's `-group` alias was
unreachable. Group tokens are now `--<prop>-label`, leaving `--<prop>-tag` free as the `tag`
pattern's own hook. Members: `badge`, `tag`, `status`, `tooltip`.

## Typography: fully fluid, Utopia-style

- Move the type scale to a proper **Utopia** (utopia.fyi) fluid model: a min type scale +
  ratio at a min viewport and a max type scale + ratio at a max viewport, interpolated with
  `clamp()` per step. (Today `typeScale` has `ratio` + `fluid.minRatio` but not a clean
  min/max-ratio-per-viewport Utopia pair.)
- Do the same for **space** (Utopia fluid space) so type and spacing share one fluid system.
- Constraint: the Bricks side generates these as **Variables** (via the Scale Generator /
  `generate-scale-variables`), and the Tailwind side emits `@theme` `--text-*`/`--spacing-*`.
  The Utopia model must express cleanly in both — verify the clamp math matches what Bricks'
  Scale Generator produces so imports round-trip.

## Astro integration (`@getvitops/astro`)

- ~~**Semantic icon mapping → the integration.**~~ Done — the `icons` option on `getvitops()`
  configures the set once per site and `<Icon />` resolves against it via
  `virtual:getvitops/icons`; `iconResolver` stays as a deprecated prop. The same pass derives
  astro-icon's `include` by scanning source (only under `output: 'server'`, where the bundle is
  actually at stake) and can emit an SVG sprite for non-Astro consumers.
- ~~**Ship the generic component tier.**~~ Done — the framework-agnostic content/HTML helpers moved
  to `@getvitops/utils`, and the generic primitives export at `@getvitops/astro/components/*`:
  `Subgrid`, `Cards`, `NodeRenderer`, `WebComponentLoader`, plus `Popover`/`Details`/`Drawer`
  (optional `astro-icon` peer). Config-bound chrome (`Template`/`SEO`/`ContentInfo`/`FormRenderer`)
  stays out of the generic library.
- ~~**Decouple `Nav`/`Submenu` and ship them too.**~~ Resolved by deletion (2026-07-27). The whole
  `#site-config` subtree — `Nav`, `Submenu`, `SEO`, `Template`, `FormRenderer`, `ContentInfo`,
  `Layout`, plus `utils/{icon-resolver,env,contact,images}` — was removed: `#site-config` was
  defined nowhere, none of it was in `files`/`exports`, and it had rotted. Recover from `201bfb9`
  if a site model is wanted again, but rebuild it taking **config as an argument** (not a global
  module import) and typed against `SiteConfig` from `@getvitops/generator`.

## EmDash editing portal (`@getvitops/emdash`)

- ~~**Map the component tiers into EmDash's editor.**~~ v1 done — `@getvitops/emdash` is an EmDash
  **native plugin**: `admin.portableTextBlocks` puts 5 flat-field patterns in the editor's slash
  menu (`vitops.imageCompare`/`copyButton`/`banner`/`details`/`carousel`), and the
  `componentsEntry` (`@getvitops/emdash/astro` → `blockComponents`) renders them via `<PortableText>`
  with the `wc-*` tags + accessible fallbacks. Composes with `getvitops()` (CSS + WC bundles);
  dogfooded in `apps/portal` (`/_emdash/admin`, rendered at `/cms/[slug]`).
- ~~**Adopt in vitops-website.**~~ Done 2026-07-24: `/home/alex/dev/vitops-website` on
  `emdash@^0.31.0` + `@getvitops/astro@^0.4.0` (`css.inject: false`; PineLayout imports the
  stylesheet so `/_emdash/admin` stays unstyled) + `@getvitops/emdash@^0.1.0` registered in the
  `emdash()` plugins array; deployed to dev.vitops.ca (push to `dev` → deploy-dev workflow) and
  verified: editor loads, slash menu shows the 5 vitops blocks. Note: the deployed D1s (`vitops`,
  `vitops-dev`) had a `pages` collection with **zero field rows** — fields were added on dev via
  the admin Content Types UI (`title` string required, `content` portableText, matching
  `seed/seed.json`); prod's `vitops` D1 still lacks them (fix the same way when promoting).
- **v2 backlog:**
  - `page:metadata` hook emitting JSON-LD from the shared builders now in
    `packages/utils/src/schema/` (`articleGraph`/`organizationGraph`/`breadcrumbGraph`/`faqGraph`;
    the remaining ~20 `schemas/*.astro` can be extracted the same way as needed).
  - Repeating-data patterns (Cards/Subgrid, `wc-entries`, FAQ, forms): seeded **Sections** in a
    starter theme + documented Field Kit `list`-widget recipes rendered via
    `Cards.astro`/`NodeRenderer.astro` — flat Block Kit PT fields can't express them.
  - `widgetComponents` map + documented `WidgetRenderer` pattern for widget areas.
  - EmDash `getMenu()` → `Nav` adapter (blocked on the Nav decoupling above).
  - Carousel field UX: replace the newline-separated-URLs workaround if EmDash grows
    media-picker/repeater PT block fields.
  - Pin the `emdash` peer range per tested version (currently `>=0.31.0`, verified on 0.31.0).

---

See **`DESIGN-SYSTEM-GAPS.md`** for the token-level gaps found while reproducing the Home
page (border/hairline token, radii→token bricks-gating, button base, `.flex` fix, etc.).

- ~~Output format for Google's DESIGN.md format https://github.com/google-labs-code/design.md~~
  — done: `vitops generate --format design` (`packages/generator/src/design-md.ts`), plus the
  root `DESIGN.md` via `npx vp run build:design`. Deferred from it: a **DESIGN.md → config
  importer** (`design.md` as an _input_, seeding `design-system.json` from a brand brief) and a
  `diff` gate in CI. See the deferred DTCG/OKF plan in `PLAN.md` for the wider framing — its
  Phase 3 (OKF bundle) is already live as `docs/`.

## Component auto-loader — todo

Ship only the components a page actually uses, plus their dependencies, instead of the
whole `elements.js` bundle. Modelled on Web Awesome's autoloader.

**Why now.** `elements.js` is one eager bundle registering every element, so a page with
a single `<wc-copy>` still downloads the carousel, the split panel, the image compare,
the entries table and the marquee — and it grows with every element we add (`wc-marquee`
made it nine). The cost lands on every consumer of `@getvitops/astro`, whether or not
they use any of it.

**Shape.** A `MutationObserver` over the document that, on seeing an unregistered
`<wc-*>` tag, dynamically imports that element's chunk and lets `customElements.define`
upgrade it in place. The observer stays live so elements added later (a popover's
contents, an EmDash block, a Bricks builder preview) resolve too.

Notes for whoever picks this up:

- It suits this framework unusually well, because **tier 2 already guarantees a usable
  no-JS fallback**. The window before a chunk lands is the same state a
  scripting-disabled visitor gets permanently, which is exactly the state we already
  commit to — so late upgrade is not a new failure mode, and there is no flash of
  nothing to design around.
- Needs per-element chunks from the build. `packages/core` currently emits one
  `elements.js`; splitting it changes what `@getvitops/astro` copies into `public/`
  and what `<Head />` references. Keep the eager bundle as an opt-in for consumers who
  would rather have one request.
- The dependency edge is real: several elements extend `BaseElement` and
  `WCImageCompare`/`WCSplitPanel` share `DragController`. Those must land in a shared
  chunk, not be duplicated per element.
- `<wc-consent>` must stay out of it. It ships in its own Lit-free bundle on purpose:
  it gates every third-party tag on the page, so it has to be free to load _ahead_ of
  anything else rather than behind an observer.
- Check it against the Bricks builder, where markup is injected and re-rendered
  constantly — that is the hardest case for an observer-driven loader.

## `SiteConfig` → `Config`, with three sections — todo

Restructure the top-level config from a flat `SiteConfig` into:

```jsonc
{
  "designSystem": {
    /* … or a path/shorthand, as today */
  },
  "organization": {
    /* the company: name, address, contact, areaServed, … */
  },
  "site": {
    /* analytics, deployment, dns, api, hosting, seo, icons,
                       legal, templates, basePath, defaultLocale, security, … */
  },
}
```

**Why.** The current name is the smaller half of the argument. `SiteConfig` today holds
`organization` (company data) _and_ `analytics`/`deployment`/`basePath`/`designSystem`
(site and deployment data) as flat peers, so no single noun describes it —
"CompanyConfig" would be narrower than its contents and "SiteConfig" buries the company
inside a site. Three named sections under a neutral `Config` says what is actually
there, and it makes the multi-site case expressible: several sites can `extends` one
file and override only `site`.

**What it touches.** This is the value of writing it down — it is not a rename:

- `packages/generator/src/site.ts` — the schema, `SITE_SCHEMA_URL`, `siteJsonSchema`,
  and the emitted `site.schema.json` (probably `config.schema.json`).
- `resolveInput` keeps working unchanged: it discriminates on the presence of a
  `designSystem` key, which is still true and still unambiguous against a bare
  `DesignSystem` (which is strict, so the key is an `unrecognized_keys` error there).
- `packages/generator/src/legal/` — `derive.ts` and `providers.ts` read `legal.*`,
  `organization`, `analytics`, `deployment` and `security.turnstile`. Every one of those
  paths moves except `organization`.
- `@getvitops/astro` — the `site` option, analytics resolution, the analytics/legal
  agreement warning.
- `@getvitops/vite` — `designSystemPath()` walks the RAW on-disk object, so it must
  learn the new shape; getting this wrong grows a key beside the author's and silently
  edits a copy nothing builds from.
- `@getvitops/cli` — `vitops legal`, the only command that reads this config.
- `@getvitops/create` — every scaffolded template ships one.

**Do it in one major**, alongside the other breaking changes, and give it a real
migration: `validate` should detect the old flat shape and name the moves rather than
emitting `unrecognized_keys` for a dozen fields at once. A config that fails with
"unknown key: analytics" teaches nobody where it went.

**Also blocked on this:** the site-config authoring reference. `site.ts` already carries
95 `desc()` calls and exports `siteJsonSchema`, so the reference is the existing
`authoring.md` walker (`docs.ts:822-913`) pointed at a second schema, plus a
`docs/index.md` entry and a topic mapping in `packages/cli/src/agents.ts`
(drift-guarded by `agents.test.ts`). Write it AFTER the restructure so it documents the
shape consumers will actually have.
