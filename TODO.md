# Design-system TODO

Context: one shared design-system schema (`src/design-system.json`) drives every site we
build — WordPress/Bricks **and** Cloudflare EmDash (Astro/Tailwind). Keep tokens and pattern
names platform-agnostic so the same schema round-trips through both the Bricks generators and
the Tailwind (`--format=tailwind`) output.

## vNext release scope

Full design detail for each of these lives in the vNext release plan
(`~/.claude/plans/both-emdash-https-emdashcms-com-and-piped-hoare.md` as of 2026-09-28 — copy
the relevant section into this repo's own docs if that plan file location is ephemeral).
Everything below is scoped, not built.

1. **Location and service page generation** — render `organization.locations`/`services` into
   real pages (JSON-LD + routes), for both static/Bricks sites (a new `@getvitops/astro`
   `<LocationPage>`/`<ServicePage>` wrapper) and EmDash sites (a seeded `locations` collection +
   template route). Includes the GBP category → `LocalBusinessType` lookup table (see the old
   "GBP category mapping" entry this absorbs — a `Record<categoryId, LocalBusinessType>`, seeded
   incrementally as real client categories are hit).
2. **Plans, add-ons, and entitlements schema** — a `site.plan` section in `Config` plus a
   `PLAN_CAPABILITIES` table so an add-on (e.g. `ab_testing`, `server_side_tracking`) actually
   gates the `Config` fields it's supposed to unlock, closing the gap where the Portal's plan
   catalogue has nothing real to enforce.
3. **Runtime A/B traffic-splitting** — an Astro middleware (`vitopsAbTesting()`) that actually
   assigns and pins a variant per visitor, replacing today's "one deploy per variant" build-time-
   only model and the nonexistent "router Worker" the current code comments assume.
4. **Server-side ad-platform conversion reporting** — widen `conversionLabel` to a per-action map,
   fire conversions on form submit, add an action link to the conversion-notification email, and
   build a Google-Ads-offline-conversion-upload sender (blocked on obtaining a developer token +
   MCC OAuth access — the credential acquisition, not the engineering, is the critical path). This
   absorbs the old "ad conversion tracking" entry in full — see git history for that entry's
   already-shipped half (`mailto:` click tracking, `conversionLabel` wiring, the `ip:event`
   rate-limit key).

Also not yet scoped in detail: the organization-name/tagline single-source-of-truth decision
(EmDash's own `getSiteSettings()` vs `Config`'s `organization.name`/`site.seo.*`) — unblocked now
that the EmDash design-system-editor plugin (item that used to be "§12") exists, but needs its
own short design pass (which EmDash-side hook exposes site settings to a build-time read, whether
`organization.name` becomes a read-only mirror for non-EmDash sites only or all sites) before
picking it up.

## Unrelated backlog (not part of the vNext release)

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
