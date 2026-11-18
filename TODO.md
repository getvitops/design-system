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
server-side ad-platform conversion reporting items 1–5 (per-action `conversionLabel`,
`vitopsFormConversion()`, the conversion-email action link, the rate-limit-key fix, the
Google-Ads offline-conversion upload in `utils/notify/google-ads.ts`, and the client/server
`reporting` switch in `site.ads`) are all built. What's left, in priority order:

1. **`vitops ads provision`** (was item 6 of server-side ad-platform conversion reporting) —
   not built. Blocked on obtaining a Google Ads developer token + MCC OAuth access — the
   credential acquisition, not the engineering, is the critical path.

## Unrelated backlog (not part of the vNext release)

### Location and service pages — built; one piece deferred

Built: `serviceGraph()` (`@getvitops/utils/schema`) and `<Service>`, the adapters in
`packages/astro/src/schemas/graph-adapters.ts` (`resolveSlug`, `locationToLocalBusiness`,
`serviceToGraph`), and the tier-3 `<LocationPage>` / `<ServicePage>`. Routing is documented in
`LocationPage.astro`'s docblock, not scaffolded: a `getStaticPaths()` over an empty record is dead weight on
every site with no locations. Bricks/WordPress is out of scope (no `@getvitops/bricks` yet). Also built:
`GBP_CATEGORY_TYPES` / `localBusinessTypeForCategory()`, a static stopgap from a Google Business Profile
category id to a `LocalBusiness` subtype.

**Left:**

- **Verify the GBP category ids and grow the table** from the Business Information API's `categories.list`.
  The ids in `gbp-categories.ts` are the ones service businesses commonly use, written from knowledge of
  Google's `gcid:` scheme and not yet checked against Google's list; the API needs the same agency-wide access
  request as `vitops reviews` (see SETUP.html). Add an entry only when a real client's category doesn't map.
- **The EmDash editorial-body overlay.** A `locations` collection holding a `slug` and a `portableText` body,
  matched to `organization.locations`' keys at render time, so a client can add prose and photos around the
  structured facts without editing `site.json`. A plugin cannot register a collection (a seed applies at first
  boot only; otherwise `emdash schema create` against a live site), so it is either a scaffold-only seed change
  or an operator step. `vitops emdash schema apply` now makes the second one scriptable across a site's
  environments. The page and its JSON-LD ship in full without it.

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
- Block images: `vitops_logos`, `vitops_marquee`, `vitops_gallery`, `vitops_carousel` still render a
  plain `<img>` (`BlockImage.astro` covers hero, cards, image compare). Cards' image field is still a URL input: EmDash 1.4.0's repeater sub-fields exclude `media_picker` (its docs say newer versions allow it), so switch it on upgrade. Local `astro build`/`astro dev` from the
  template sets no `EMDASH_SITE_URL`, so the ratio field only takes effect in the deploy workflow
  (dev already authorizes any host). The build also always uses `siteEnv: 'production'` for the
  rest of `site.json` (SEO, robots), even for the dev deploy; the URL is the only per-environment
  fact wired so far. Spike on EmDash's own `Image`: a Block Kit `media_picker` stores a URL
  string only and the admin drops the picked item's width/height/blurhash
  (`@emdash-cms/admin` `BlockKitMediaPickerField`), so `emdash/ui` `Image` cannot render a block
  field without an upstream change (object-valued media pickers; no issue exists yet). Nested PT
  `image` nodes work for schema-level block types such as `vitops_section`. A render-time lookup via
  `normalizeMediaValue(url, getMediaProvider)` from `emdash` is possible but unverified.

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
- The `CONTRAST.NON_TEXT` (3:1) check assumes a solid colour — decide whether a translucent
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

Tabs, breadcrumbs, combobox, format and range (the slider) are built. A dropdown is not a component: it is the
native Popover API plus anchor positioning, which is how it is built downstream. Not built; tracked in full in
AGENTS.md's "Component architecture" section:

- **Markdown** — render/enhance markdown content client-side. Library unchosen.
- **OTP** — segmented one-time-passcode input: auto-advance between digits, paste-splitting a full code across
  them. Fallback is a plain `<input>`.
- **QR** — QR code generation/display.

Whoever picks one of these up should give it the full treatment `<wc-counter>` originally got here before it
shipped — see its own class docblock, `WCCounter.ts`, for the shape that treatment landed in (why it clears the
tier-2 bar, shape, load-bearing details) — rather than just the one-liners here.

### Test and a11y coverage gaps — todo

From the 2026-11 architecture audit; each is a known gap, not a regression.

- **DOM tests** (`*.dom.test.ts`) missing for `wc-copy`, `wc-dismissable`, `wc-multi-field` and
  `wc-split-panel`. (`wc-consent` and `wc-image-compare` have them.)
- **e2e no-JS fallback coverage** (`site/e2e/no-js-fallback.e2e.ts`) missing for cards, consent and the other
  elements without a spec. (Tabs, combobox, range, format and breadcrumbs have one, plus a JS-on spec in
  `enhanced-components.e2e.ts`.)

### Translation (i18n): French legal documents and runtime strings — plan, not started

The privacy policy, terms, cookie notice and accessibility statement (both `ca` and `qc`) are English
only, and so is every runtime string we ship. A Quebec client needs French, and a `qc` site gets an
English statement until this lands. This is a plan to approve on its own; nothing here is built.

**Is Paraglide worth adding? For a narrow slice, yes; for the long legal prose, no.** Verified from its
own docs (Paraglide JS 2; a few mirrors disagree on Cloudflare details, so confirm in the spike): it is a
compiler that turns message files into typed, per-message, tree-shakeable functions; locale resolution is
strategy based (`url`, `cookie`, `localStorage`, `preferredLanguage`, `baseLocale`) with a server
middleware that scopes the locale per request, using `AsyncLocalStorage` unless disabled; it has an Astro
guide and a Vite plugin.

| Surface                                                                                                                                                                        | Strings                                                                                | Fit                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Visitor-facing runtime: `wc-*` labels (System/Light/Dark, carousel and lightbox controls), `<ContrastToggle />`, consent banner, Astro component defaults, EmDash block labels | short, many, parameterised                                                             | **Good.** The real need; tree-shaking matters because `consent.js` is a deliberately tiny Lit-free bundle (about 2.8 KB gzip)                                                                                                                                       |
| Legal documents                                                                                                                                                                | long prose, structure differs by jurisdiction and language, reviewed whole by a lawyer | **Poor.** Per-sentence messages fragment what a reviewer must read top to bottom, and the `qc` French is not a translation of the `ca` text. Keep per-locale template files plus a small typed `Phrases` table (`satisfies Record<Locale, Phrases>`), no dependency |
| Generator / CLI messages                                                                                                                                                       | many, developer-facing                                                                 | **Low value.** Consumers are developers and agents; revisit if a client asks                                                                                                                                                                                        |

Costs to measure rather than assume:

1. Locale state is global per request. Fine in Astro SSR, but the Worker-safe `@getvitops/utils/*`
   subpaths and the Lit-free consent bundle must not pull in a runtime they do not need. Messages compiled
   at our build with the locale passed in may be cleaner than shipping the runtime.
2. Our packages are consumed prebuilt, so a consumer cannot add a language to `wc-color-scheme-toggle`
   unless we expose an override (attribute or slot). Decide: fixed `en`/`fr` plus overrides, or ship the
   message files for consumers to compile.
3. The `cookie` and `localStorage` strategies are storage. They must go through the consent gate
   (`preferences`) like `vitops-color-scheme`, or default to `url`/`preferredLanguage` only; a silently set
   locale cookie is the undisclosed storage the gate exists to prevent, and the cookie notice would have to
   disclose it.
4. Bricks/WordPress has no Paraglide runtime; PHP fragments need strings of their own (a generated
   `strings.php` from the same message files is plausible).
5. A young, fast-moving compiler becomes a dependency of every package with messages. Pin it, and keep the
   zero-dependency typed-catalog approach as the fallback.

**Recommendation: a spike, not a commitment.** Prove Paraglide on two things: `<wc-color-scheme-toggle>`
(shadow DOM) plus the `consent` bundle for the size budget, and `ContrastToggle.astro`. Pass: gzip delta on
`consent.js` and `elements.js` within budget, works in a Cloudflare Worker, no storage without the gate, a
consumer can override a string. If it fails any, adopt the typed catalog instead.

Work, once the spike decides:

1. Spike, with a written result.
2. One `Locale` vocabulary for `legal` and runtime strings (`en`, `fr`; `fr-CA` resolves to `fr`), a
   `validateConfig` rule that `site.defaultLocale` is supported, and how `site.locales` drives output.
3. **Legal documents in French**: 4 documents × `ca`/`qc` = 8 new templates plus `casl`.
   - `TEMPLATES[jurisdiction][locale][doc]` with a `satisfies` guard, so a missing translation is a compile
     error.
   - `legal/phrases/{en,fr}.ts` replacing the English literals in `derive.ts` (about 45 sentences), the
     list connective ("and" / "et"), province and jurisdiction names.
   - Consumer prose (`retention`, `privacyOfficerTitle`, `governingLaw`, processor `purpose`) becomes
     `Localizable`; a plain string still validates and is used verbatim, and `validateConfig` warns when a
     French document will print one. `KNOWN_PROCESSORS` purposes and countries get `fr`. The accessibility
     statement's free-text fields (`limitations`, `formats`, …) need the same treatment.
   - Output naming: the default locale stays unsuffixed so nothing changes for existing consumers; others
     are suffixed (`privacy-policy.fr.md`); Bricks shortcode `lang`; CLI `--lang`; Portable Text keys carry
     the locale.
   - Drift guards: identical heading sequence between `en` and `fr`, no unreplaced `${…}`, no English
     sentinel strings, `Phrases` completeness as a type error. The accessibility statement's AAA content
     tests (reading level, abbreviations) need French equivalents.
   - Terminology (Quebec French, **flagged for review by a qualified legal translator**):
     `responsable de la protection des renseignements personnels`, `Loi 25`, `Commission d'accès à
     l'information`, `évaluation des facteurs relatifs à la vie privée`; for `ca`, the `Commissariat à la
     protection de la vie privée du Canada`; for the statement, the `LAPHO`.
4. Runtime strings per the spike: `wc-*` labels first, then Astro components, EmDash blocks, the consent
   banner (whose wording is also a legal artifact).
5. Skills and docs: update `quebec-french-language.md` (French templates now ship), add a translation topic,
   document how a consumer overrides a string.

French drafting parallelizes well: one agent per document family, with the English template and phrases
table as the contract and the drift guards as the acceptance test.

Not decided: whether `fr` also covers the CLI's own output; whether consumers get a way to add a third
language; who reviews the French (required before any client relies on it).

### Cloudflare `cf` CLI — evaluate when its beta ends

`cf` has been in open beta since 2026-09-28 and is Wrangler's successor (typed `cloudflare.config.ts`, `cf migrate`
from `wrangler.jsonc`). Wrangler gets a final major pointing at `cf` only when the beta ends, then 18 months of
maintenance; Cloudflare's own agent docs still say to use Wrangler for local dev, deploys and `d1 migrations`.
Everything here depends on Wrangler today (`@astrojs/cloudflare`, `emdash migrate --wrangler-config`, the hosting
executors, both templates' `wrangler.jsonc`). Before migrating, check adapter and EmDash support for
`cloudflare.config.ts`. Stay on Wrangler until then.

### Scheduled publishes vs prerendered pages — review the cron

The emdash template's `triggers.crons` (`* * * * *`, `wrangler.jsonc`) runs the Worker every minute so content
scheduled in the admin publishes, and plugin cron and maintenance run. Pages are prerendered, so a scheduled publish
changes the database but the live HTML stays stale until a rebuild. Decide how it should trigger one, and confirm
whether `content:afterPublish` fires for scheduled publishes (the `emdash-publish` dispatch hook in
`emdash-content-and-deploys` assumes it does; unverified). Also check whether every-minute is the right cadence.

### Block ideas from the vitops.ca build (UPSTREAM finding 20)

No table or comparison block, no role-setup diagram, no timeline: the licence tracker, the ads comparison and the
joining-and-leaving diagram became checklists in panel cards. `table.css` and `vitops_entries` are a start for a
comparison block; a timeline could reuse the steps connector. Needs a second consumer before designing.

### CSS transitions run at page load

Measured on the e2e `/blocks` page (Chromium, Playwright): at `load`, ~150 `CSSTransition`s are running, every pattern
with `transition-property: … background-color, color` animating from its unstyled value. It happens with every script
removed from the page when the stylesheet arrives after parsing, and with the scripts in place even when it does not, and
it stops when the bundle `<script>` tags sit after the `<link rel="stylesheet">`s (1 transition). The effect is a 200 ms
colour flash on every button at first paint. `vitops audit` now waits for transitions before axe, which removes the false
contrast failures; the flash itself is open. Candidates: emit the pattern transition only under a class set after first
paint, or have `<Head />` place the bundle tags after Astro's stylesheet links (Astro appends them after the component).
