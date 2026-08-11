# Design-system TODO

Context: one shared design-system schema (`src/design-system.json`) drives every site we
build — WordPress/Bricks **and** Cloudflare EmDash (Astro/Tailwind). Keep tokens and pattern
names platform-agnostic so the same schema round-trips through both the Bricks generators and
the Tailwind (`--format=tailwind`) output.

## Patterns: `badge` + `tag` — still open

The `badge`/`tag`/`chip` split (see AGENTS.md's "Small-label patterns split by behaviour") is
done. Left:

- `typography.roles` has a `tag` type role, unrelated to the `tag` pattern — worth
  disambiguating.

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

## EmDash editing portal (`@getvitops/emdash`) — v2 backlog

v1 (native plugin, `admin.portableTextBlocks`, `componentsEntry`/`blockComponents`, dogfooded in
`apps/portal`) is done. Left:

- `page:metadata` hook emitting JSON-LD from the shared builders now in
  `packages/utils/src/schema/` (`articleGraph`/`organizationGraph`/`breadcrumbGraph`/`faqGraph`;
  the remaining ~20 `schemas/*.astro` can be extracted the same way as needed).
- Repeating-data patterns (Cards/Subgrid, `wc-entries`, FAQ, forms): seeded **Sections** in a
  starter theme + documented Field Kit `list`-widget recipes rendered via
  `Cards.astro`/`NodeRenderer.astro` — flat Block Kit PT fields can't express them.
- `widgetComponents` map + documented `WidgetRenderer` pattern for widget areas.
- EmDash `getMenu()` → `Nav` adapter (blocked on rebuilding a config-bound Nav — the old one was
  deleted in `201bfb9`; `NavShell.astro` is a markup-only layout primitive, not that adapter).
- Carousel field UX: replace the newline-separated-URLs workaround if EmDash grows
  media-picker/repeater PT block fields.
- Pin the `emdash` peer range per tested version (currently `>=0.31.0`, verified on 0.31.0).

---

See **`DESIGN-SYSTEM-GAPS.md`** for the token-level gaps found while reproducing the Home
page (border/hairline token, radii→token bricks-gating, button base, `.flex` fix, etc.).

Deferred from the `--format=design` (DESIGN.md) work: a **DESIGN.md → config importer**
(`design.md` as an _input_, seeding `design-system.json` from a brand brief) and a `diff` gate
in CI. See the deferred DTCG/OKF plan in `PLAN.md` for the wider framing — its Phase 3 (OKF
bundle) is already live as `docs/`.

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

## Foundational components — todo

Not built yet; tracked in full in `elements.ts`'s docblock (`packages/core/src/js/elements.ts`),
this entry is the index into that list:

- **Combobox** — CSS shell only (`patterns/combobox.css`); the Lit component that makes it
  interactive doesn't exist.
- **Dropdown / dropdown-item** — `.dropdown` (`patterns/dropdown.css`) is CSS/Popover-only,
  hover-or-click; needs a component for the ARIA `menu`/`menuitem` pattern (roving-tabindex
  arrow keys, type-ahead, Escape-returns-focus).
- **Tabs / tab / tab-panel** — `tabs` is a generated pattern with no structural partial and
  no component (see its `tiers.ts` entry); needs the WAI-ARIA tabs pattern (roving tabindex,
  arrow keys, `aria-selected`, `aria-controls`).
- **Breadcrumbs** — no pattern at all yet. (`schemas/Breadcrumb.astro` is unrelated —
  Schema.org JSON-LD, not visual nav.) Likely CSS/astro only, no JS: a breadcrumb trail is
  `<nav aria-label="Breadcrumb"><ol>…` and needs nothing dynamic.
- **Markdown** — render/enhance markdown content client-side. Library unchosen.
- **OTP** — segmented one-time-passcode input: auto-advance between digits, paste-splitting
  a full code across them. Fallback is a plain `<input>`.
- **QR** — QR code generation/display.
- **Slider** — a range control, distinct from `<wc-split-panel>`'s drag divider (that
  resizes two panes; this picks a value).
- **Format** — reads a machine value and renders a presentation of it, e.g. a relative date
  over `<time datetime>` (`"5 minutes ago"`), re-rendering as it goes stale. Fallback is the
  value already in the markup.

Whoever picks one of these up should give it the full treatment `<wc-counter>` originally got
here before it shipped — see its own class docblock, `WCCounter.ts`, for the shape that
treatment landed in (why it clears the tier-2 bar, shape, load-bearing details) — rather than
just the one-liners here.

## GBP category → `LocalBusinessType` mapping — todo

Follows from populating JBL Signs' `organization.locations.ottawa.type` by hand: Google's GBP
category for that listing (`"Sign shop"`) has no counterpart in our `LocalBusinessType` enum
(`packages/generator/src/config.ts`), so `HomeAndConstructionBusiness` was a one-off human guess
made while wiring up `localBusinessGraph()`. That doesn't scale past a handful of clients.

**Why a lookup table, not a bigger enum.** Google's category taxonomy
(`mybusinessbusinessinformation.googleapis.com` `categories.list`) has ~4,000 entries; schema.org's
`LocalBusiness` hierarchy has nowhere near that many, and **Google publishes no mapping between
the two** — this stays a hand-curated decision regardless of data source. The right shape is a
small table (GBP `categoryId` → `LocalBusinessType`), built incrementally as real client categories
are encountered — not an attempt to pre-map all ~4,000 up front.

**Data source, in order of preference:**

1. **`categories.list`** (Business Information API) — canonical, current, `categoryId` +
   `displayName`, region/language-filterable. Gated behind the pending agency-wide GBP API access
   request (verified GBP 60+ days old, applicant email domain matching the website domain, 14-day
   review) — the same approval that gates any future listings-sync work.
2. **A static export** (the ~4,000-row CSV/gist third parties maintain, since Google itself
   publishes no downloadable list) as a stopgap while API access is pending — enough to seed the
   table now, though it can drift from Google's live list.

**Shape**, following the `AD_PLATFORMS` capability-table pattern
(`packages/utils/src/ads/providers.ts`): a `Record<string, LocalBusinessType>` keyed by GBP
`categoryId` (stable across renames), with `displayName` carried alongside for readability, not
used for matching. Lives beside `LocalBusinessType` in `packages/generator/src/config.ts`, or its
own module if it grows past a few dozen entries.

**Build it incrementally**: add an entry only when a real client's GBP category doesn't already map
cleanly, the same way `HomeAndConstructionBusiness` got picked for JBL Signs — resolve it once,
record it, move on. Don't cover categories with no client behind them yet.

**Forward-looking**: this table is also what a future listings-push command (writing our
`organization.locations.*` back out to GBP/Bing/Apple, not yet designed) needs in the other
direction — going from our `type` back to a `categoryId` when _creating_ a listing that doesn't
exist yet. Worth keying the table by `categoryId` now rather than `displayName` so that direction
doesn't require re-deriving it later.
