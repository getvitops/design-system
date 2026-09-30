# Design-system TODO

Context: one shared design-system schema (`src/design-system.json`) drives every site we
build — WordPress/Bricks **and** Cloudflare EmDash (Astro/Tailwind). Keep tokens and pattern
names platform-agnostic so the same schema round-trips through both the Bricks generators and
the Tailwind (`--format=tailwind`) output.

## vNext release scope

Full design detail lives in the vNext release plan
(`~/.claude/plans/both-emdash-https-emdashcms-com-and-piped-hoare.md`, plus
`vnext-backlog.md` in the same directory for what's still open — copy the relevant section
into this repo's own docs if that plan file location is ephemeral).

Plans/entitlements (`site.plan`), runtime A/B traffic-splitting (`vitopsAbTesting()`), and
server-side ad-platform conversion reporting items 1–3 (per-action `conversionLabel`,
`vitopsFormConversion()`, the conversion-email action link, the rate-limit-key fix) are all
built — see `vnext-backlog.md` for the build record. What's left, in priority order:

1. **Server-side ad-platform conversion reporting, items 4–6** — a
   Google-Ads-offline-conversion-upload sender, the client/server reporting on/off switch, and
   a `vitops ads provision` command. Blocked on obtaining a Google Ads developer token + MCC
   OAuth access — the credential acquisition, not the engineering, is the critical path.

## Unrelated backlog (not part of the vNext release)

### Location and service page generation

Demoted out of the vNext release entirely on 2026-09-29 (explicit instruction) — decision-complete,
not built, pick up whenever, no release urgency. Expanded from a sketch into a decision-complete
sub-plan on 2026-09-29, grounded in three parallel research passes (not guessed): a full read of
every JSON-LD builder in `packages/utils/src/schema/` and the "no site-model layer" rules in
`packages/astro/AGENTS.md`; a full read of `organization.locations`/`.services`' exact zod shapes in
`packages/generator/src/config.ts`, cross-checked against two real client configs
(`~/dev/jblsigns/config.json`, `~/dev/metrovantis/company.json`) that already populate `locations`;
and a full read of how EmDash 1.0 actually defines collections. That third pass overturned the
original sketch's EmDash-routing idea (item 4 below) — worth stating up front because it's the one
thing that changed the shape of this plan the most.

**Corrected assumption: a plugin cannot register an EmDash collection, at all.** Checked against
EmDash 1.0's real types (`PluginDescriptor`, `PluginAdminConfig`, `PluginDefinition.storage` — none
expose a collection/content-type registration surface; confirmed via `ctx.schema` being read-only,
gated by `schema:read`). A collection can only be created two ways: (a) `seed/seed.json`, applied
**once, at a site's first boot only** — no effect on an already-scaffolded site; or (b) `emdash
schema create`/`add-field` run against a **live instance** (CLI, REST API, or the admin UI/MCP) —
an operator step, the same class of thing as the design-system editor's `VITOPS_GITHUB_TOKEN`. The
original sketch's "seed a `locations` collection, sync it with config" idea is real but **not
something this toolchain can ship as a zero-operator-step feature** the way the design-system-editor
plugin was. Given that, and given the org's actual near-term need (Ottawa/Ontario local + provincial
SEO — real pages with correct JSON-LD, not a second editorial surface), this plan **narrows scope
deliberately**: ship the config-driven page + JSON-LD generation now, defer the
EmDash-editorial-body overlay to its own later pass. See "What's deferred" at the end.

**What's already confirmed to line up cleanly** (from the schema research — this is why the mapping
work is smaller than the original sketch assumed):

- `location.address` (`streetAddress`/`addressLocality`/`addressRegion`/`postalCode`/
  `addressCountry`) is **field-for-field identical** to `LocalBusinessGraphOptions.address` —
  direct pass-through, no mapper needed.
- `location.geo` (`{latitude, longitude}`) matches `LocalBusinessGraphOptions.geo` exactly —
  direct pass-through.
- `location.hours` (`{dayOfWeek: DayOfWeek[]; opens; closes}[]`) matches
  `openingHoursSpecification`'s shape exactly, and `location.hoursSpecial`
  (`{validFrom; validThrough?; opens?; closes?}[]`) matches `specialOpeningHoursSpecification`
  exactly — both direct pass-through, no day-of-week URL-mapping or time reformatting needed (the
  original sketch assumed a real mapper was needed here; it isn't).
- `service.offers` (`OfferSchema`: `name?`, `price?`, `priceCurrency?`, `availability?`, `url?`,
  `validFrom?`, `priceValidUntil?`) already matches schema.org `Offer` field names directly.
- What genuinely needs resolving: `Localizable` fields (`name`, `description`, `slug` — via the
  existing `t()` from `@getvitops/utils`, same pattern `resolveOrganizationName` already
  established), `ImageRef[]` → `image: string[]` (flatten each ref's `src`, dropping `alt` since the
  builder has no per-image alt slot), and `listings` — confirmed no schema.org equivalent, correctly
  dropped from JSON-LD (unchanged from the original sketch; `config.ts:242`'s comment already
  documents this as intentional, recorded for a future listings-push command).

**Design.**

1. **New JSON-LD builder**: `serviceGraph(options: ServiceGraphOptions)` in
   `packages/utils/src/schema/service.ts` (+ export from that package's `index.ts`), matching the
   existing builders' style exactly (`localBusiness.ts`/`organization.ts`: a plain function
   returning `{'@context', '@type': 'Service', ...}`, optional fields omitted when falsy — see
   those two files for the pattern to copy). Fields: `name` (required), `description?`, `url?`,
   `provider?: string | {name; url?}` (rendered as a nested `Organization`), `areaServed?: string[]`,
   `offers?: Offer[]` (each spread with `'@type': 'Offer'`). No `Service.astro` needed as a separate
   file if `<ServicePage>` (item 4) renders the `<script>` tag itself — but for parity with
   `LocalBusiness.astro`'s existing pattern (and so `serviceGraph` is independently usable the same
   way `localBusinessGraph` is via `<LocalBusiness>`), add a thin `Service.astro` alongside it in
   `packages/astro/src/schemas/`, same three-line shape as `LocalBusiness.astro`.
2. **New adapter module**: `packages/astro/src/schemas/graph-adapters.ts` — the "no site-model
   layer" rule's requirement (take config as an argument, type against the real `Config`, never
   import consumer global state) applied here exactly the way `routes/config-adapters.ts` already
   applies it to `toNotifyContext`:
   - `resolveSlug(key: string, slug: Localizable | undefined, locale: string, defaultLocale:
string): string` — `t(slug, locale, defaultLocale) || key`. The **object key**
     (`organization.locations`'s own record key, e.g. `'ottawa'`) is the stable identity already
     used everywhere else in this codebase (`toNotifyContext`'s `primaryLocation` sort,
     `validateConfig`'s membership check) — `slug` is an optional, per-locale URL override, not a
     replacement identity.
   - `locationToLocalBusiness(location: LocationEntry, opts: {locale, defaultLocale}):
LocalBusinessGraphOptions` — resolves `name`/`description` via `t()`, flattens `photos`
     (`ImageRef[]`) to `image: string[]` (`typeof ref === 'string' ? ref : ref.src`), passes
     `address`/`geo`/`hours`/`hoursSpecial`/`type`/`areaServed`/`priceRange`/`paymentAccepted`/
     `currenciesAccepted`/`knowsLanguage`/`sameAs` straight through (confirmed shape-identical
     above), drops `listings`.
   - `serviceToGraph(service: ServiceEntry, opts: {locale, defaultLocale, providerName?}):
ServiceGraphOptions` — resolves `name`/`description` via `t()`, passes `offers` straight
     through, sets `provider: providerName` when given (the caller passes
     `resolveOrganizationName(config)` — direct reuse of the existing helper).
   - Unit-tested in `graph-adapters.test.ts` the same way `config-adapters.test.ts` already tests
     `toNotifyContext` — pure functions, no Astro rendering needed to verify them.
3. **New tier-3 wrappers**: `packages/astro/src/components/LocationPage.astro` and
   `ServicePage.astro`. Deliberately **thin** per AGENTS.md's tier-3 rule and the "no site-model
   layer" scar tissue (`Seo.astro`'s own docblock: folding a schema concern into a do-everything
   component is exactly how the deleted `SEO.astro` reached 276 lines) — this stays orthogonal to
   `<Seo />`, same as the existing schema components:
   - Props: `location: LocationEntry` (or `service: ServiceEntry`), `locale?: string`,
     `defaultLocale: string` — explicit arguments only, matching the rule verbatim ("a generic
     package must take config as an argument rather than importing consumer global state"). The
     caller (a real Astro page) does the `Object.entries(config.organization.locations)` lookup
     and passes one resolved entry in, exactly the idiom `toNotifyContext` already uses.
   - Renders: an `<address>` block, an hours table (from `hours`/`hoursSpecial`), a
     `<slot name="photos">` defaulting to a plain `<ul class="gallery">` of `<img>`s (not a new
     gallery component — a consumer who wants `<Carousel>`/`<Gallery>` overrides the slot; inventing
     photo-display logic here would be scope creep this plan doesn't need), a `<LocalBusiness
{...locationToLocalBusiness(location, {locale, defaultLocale})} />` (or `<Service
{...serviceToGraph(...)} />`) schema island, and a bare `<slot />` for the surrounding page
     copy the content author still writes.
   - Registered in `packages/astro/package.json`'s `exports` + `files` the same way
     `Head.astro`/`Subgrid.astro` already are (mirror the existing entry shape — don't invent a new
     export convention).
4. **Routing — deliberately just documented, not scaffolded into either template.**
   `organization.locations`/`.services` are optional and empty by default in both scaffolds; a
   `getStaticPaths()` page iterating an empty record is dead weight shipped to every client who
   isn't using this yet. Instead, `<LocationPage>`'s own docblock states the idiom directly
   (verified working with the schema above — no toolchain change needed beyond the two components):

   ```astro
   ---
   // src/pages/locations/[slug].astro
   import config from '../../../site.json' with { type: 'json' };
   import LocationPage from '@getvitops/astro/LocationPage.astro';
   import { resolveSlug } from '@getvitops/astro/schemas/graph-adapters';

   export function getStaticPaths() {
     const { defaultLocale } = config.site;
     return Object.entries(config.organization?.locations ?? {}).map(([key, location]) => ({
       params: { slug: resolveSlug(key, location.slug, defaultLocale, defaultLocale) },
       props: { location, locale: defaultLocale },
     }));
   }
   const { location, locale } = Astro.props;
   ---
   <Layout><LocationPage location={location} locale={locale} defaultLocale={config.site.defaultLocale}>
     <!-- author's own page copy -->
   </LocationPage></Layout>
   ```

   This applies identically to a static/Bricks-adjacent Astro site and to an EmDash site's own
   `src/pages/` tree (EmDash's catch-all `[...slug].astro` only intercepts what it doesn't already
   match, and a concrete `locations/[slug].astro` route takes precedence in Astro's own router) —
   **no EmDash dependency at all** for this half of the feature, which is what makes it shippable
   without an operator step. Per-locale route generation (one path per location **per locale**, for
   a site with real i18n routing) is explicitly out of scope here — that's an Astro `i18n` routing
   concern orthogonal to this wrapper, left to whoever wires up real multi-locale routing.

5. **Bricks/WordPress**: explicitly out of scope for this plan. `@getvitops/astro`'s tier-3
   components have no Bricks-side counterpart yet (`@getvitops/bricks` doesn't exist — AGENTS.md
   already calls this out as "future"), so a Bricks-rendered location/service page with JSON-LD is
   a separate, unscoped effort, not silently dropped.
6. **GBP category → `LocalBusinessType` mapping**: a small, incrementally-grown
   `Record<gbpCategoryId, LocalBusinessType>` lookup table, keyed by `categoryId` (stable across
   renames, unlike `displayName`), living beside `LocalBusinessType` in `config.ts` (or its own
   module past a few dozen entries), following the `AD_PLATFORMS` capability-table pattern. Seed
   source, in order of preference: (a) the Business Information API's `categories.list`, gated
   behind the same pending agency-wide GBP API access request the reviews feature already needs;
   (b) a static third-party export of the ~4,000-row category list as a stopgap. Add an entry only
   when a real client's category doesn't already map cleanly.

**What's deferred (not part of this plan, stated so it isn't silently lost):** the
EmDash-editorial-body overlay — a `locations` collection (via `seed/seed.json` for fresh scaffolds,
or `emdash schema add-field`/the admin UI/MCP for an existing site) holding just a `slug` +
a `portableText` body field, matched against `organization.locations`' key at render time, so a
client can add prose/photos around the structured facts without touching `site.json`. Left for its
own pass because it requires either a scaffold-time-only seed change (no help to already-live
sites) or a live operator step, and because the core SEO/JSON-LD value ships in full without it.

**Sequencing note.** Doesn't depend on anything else in this file — buildable independently
whenever picked up.

### Patterns: `badge` + `tag` — still open

The `badge`/`tag`/`chip` split (see AGENTS.md's "Small-label patterns split by behaviour") is
done. Left:

- `typography.roles` has a `tag` type role, unrelated to the `tag` pattern — worth
  disambiguating.

### Typography: fully fluid, Utopia-style

- Move the type scale to a proper **Utopia** (utopia.fyi) fluid model: a min type scale +
  ratio at a min viewport and a max type scale + ratio at a max viewport, interpolated with
  `clamp()` per step. (Today `typeScale` has `ratio` + `fluid.minRatio` but not a clean
  min/max-ratio-per-viewport Utopia pair.)
- Do the same for **space** (Utopia fluid space) so type and spacing share one fluid system.
- Constraint: the Bricks side generates these as **Variables** (via the Scale Generator /
  `generate-scale-variables`), and the Tailwind side emits `@theme` `--text-*`/`--spacing-*`.
  The Utopia model must express cleanly in both — verify the clamp math matches what Bricks'
  Scale Generator produces so imports round-trip.

### EmDash editing portal (`@getvitops/emdash`) — v2 backlog

v1 (native plugin, `admin.portableTextBlocks`, `componentsEntry`/`blockComponents`, dogfooded in
`apps/portal`) is done, and the `emdash`/`@emdash-cms/cloudflare` peer range is now pinned to the
tested `>=1.0.0 <2` line. Left:

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

---

Deferred from the `--format=design` (DESIGN.md) work: a **DESIGN.md → config importer**
(`design.md` as an _input_, seeding `design-system.json` from a brand brief) and a `diff` gate
in CI.

### DTCG (`tokens.json`) export — todo

No standards-format token export exists — what ships as `tokens.json`
(`packages/generator/src/generate.ts`) is a bespoke flat mirror (six keys, no `$` metadata).
Adding a **W3C DTCG** (`$type`/`$value`) export is the whole Figma / Tokens Studio / Style
Dictionary interop story, and most of the hard design decisions were already made when this was
scoped as a Google DESIGN.md/DTCG/OKF adoption (the OKF half of that plan already shipped as
`docs/`; the per-client/framework config split it also proposed is superseded by
`Config.designSystem` + `themes`/`extends`, which solve the same problem — don't re-propose it):

- **Fluid `clamp()` sizes** have no DTCG `dimension` — emit the **max** rem as the canonical
  `$value`, and stash the full fluid spec (min, vw, ratios) under
  `$extensions.com.vitops.fluid`. Same resolution `design-md.ts` already uses for `--format=design`.
- **Dark mode** has no first-class DTCG theming — put the per-step dark ref under
  `$extensions.com.vitops.dark`, and also emit a resolved `tokens.dark.json` for tools that want
  a second file rather than reading extensions.
- **Pattern _behaviour_** (`step`/`scale`/`lift`/`ring` state shortcuts) isn't tokens — exclude
  it. Only the static cascade values (radius/padding/border) and the role→colour bindings surface.
- **Role steps** (`--color-<role>-<step>`) emit as refs (`{color.<hue>.<step>}`) into the named
  ramp, preserving the role→ramp lineage — the same choice `design-md.ts` makes for
  `--format=design`'s `{colors.<hue>-<step>}` refs.
- **`text-on-<role>`** is a computed contrast literal with no ramp to reference — carry the same
  exception `design-md.ts` already documents for it, rather than inventing a second one.
- **`tokens.json` is a published output today**, so this can't just change its shape in place —
  decide between a new `tokens.dtcg.json` file alongside it, or a new `Format` member (which
  would also need excluding from `StylesheetFormat = Exclude<Format,'design'>`, same as
  `'design'` is).

### Translucent hairline/border token — todo

There's a `border` colour target, but every value on it is an opaque ramp step. Most UI needs a
subtle divider that composites over whatever surface it lands on (e.g.
`rgba(255,255,255,.08)` dark / `rgba(0,0,0,.08)` light) rather than a flat colour — today patterns
borrow `--color-surface-xl` as a stand-in. Two things to resolve when building it:

- It must survive **`forced-colors` mode** (Windows High Contrast flattens `background-color`,
  so a translucent divider needs a fallback there too).
- APCA's `CONTRAST.NON_TEXT ≥ 45` check assumes a solid colour — decide whether a translucent
  token is exempt from that gate or gets checked against a worst-case backdrop.

### Webfont loading outside Astro — todo

`site.fonts` delegates to Astro's Fonts API for loading; Bricks/WordPress and plain-HTML
consumers only get the `--font-*` tokens and must hand-wire `@font-face`/preload themselves.
Needs a loading path (self-hosted `@font-face` emission, or a documented preload snippet) for
non-Astro consumers.

### Component auto-loader — todo

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

### Foundational components — todo

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
