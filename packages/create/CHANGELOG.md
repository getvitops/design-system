# @getvitops/create

## 0.9.0-alpha.4

### Minor Changes

- 99e66a2: Fixes from the vitops.ca build (alpha.3 findings 1–5, 19, 29).

  - **Scaffold patterns.** Both templates now define `cta`, `link` and `details` in `patterns.items` (a `content` group too), and a `ui-accent` role. `.cta` had no CSS at all, so every hero, card and callout button rendered as plain text; a test now fails if a template omits a pattern the blocks emit. `vitops_accordion` renders a sprite chevron like `vitops_details`, and `details.css` styles an `.accordion` group (a divider and padded summaries from the `details` pattern tokens) — all formats.
  - **Tone paints only on surfaces.** `.tone` now sets colour variables and `border-color`; the background comes from `.tone--tint` (callout, panel card, hero card, toned section/hero/nav/reviews, `theme`) or `.tone--solid`. A steps, stats or form block with a tone is no longer turned into a band. `ResolvedTone` gains `surface` (`tone tone--tint`). **If you styled `.tone` directly,** add `tone--tint` where you want the background. A `.cta` inside a tinted or filled tone takes the tone's solid. all formats.
  - **`colors.tint: { mix: "8%" }`** derives the tint from the role's solid (`--tone-tint`) instead of its `muted` step, which turns brown for amber on a dark page. Off by default; not covered by the contrast contract.
  - **Per-card backdrop.** `vitops_cards` and `vitops_hero` rows take a `theme` (tint or fill of a site colour), so one card of a pair can be tinted.
  - **`colors.roles.<r>.acknowledgeContrast`**: a number of Lc a pairing may miss its APCA bar by and still only warn (e.g. pine's solid at Lc 59.5 against 60). A larger miss still fails.
  - **Select:** where `appearance: base-select` is supported the wrapper's own chevron is hidden, so a select no longer shows two arrows, and the wrapper and control fill the field (`.custom-select` is `display: block`; add `display: inline-block` if you used it inline). all formats.

### Patch Changes

- 00a9d86: - **`vitops audit` lets the page settle before axe reads colours.** At `load` Chromium can still be running the CSS transitions every pattern declares, so axe measured a filled button mid-way from its unstyled colour and reported ten `color-contrast` failures no visitor sees. The audit now waits (up to 2 s) for CSS transitions to finish first.
  - `.carousel__hint` reads `text-surface-muted` instead of `x-muted` (the placeholder tier the contrast contract exempts), and its scroll-driven fade ends hidden instead of at 0.2 opacity (`--carousel-hint-dimmed` now defaults to 0): a hint parked at 20% was still text to an audit (1.34:1). all formats.
  - The templates' `button` pattern becomes the toolkit's `btn` affordance (`fill: false`, transparent, text colour inherited), as `defaultSiteConfig()` already shipped: the old filled entry lost its white text to the new `link` pattern on `<a class="btn">` (dark green on green, 1.36:1). A filled call to action is `.cta`.
  - The templates move the `info` and `danger` solids to step 700. Their step-600 solids (sky, rose) clear the generator's APCA bar for `text-on-<role>` (Lc 60) but not WCAG AA's 4.5:1 that axe and Lighthouse apply (4.2:1 and 4.4:1), so a `.cta-info` or a CTA inside an `info` callout failed the audit. Step 700 reads at 6.4:1 and 6.8:1 with the recomputed text. The APCA/WCAG gap in the contract itself is logged in TODO.md.
- d64fb20: Layout and spacing fixes from the vitops.ca build (findings 6–9).

  - **`vitops_section` is the page opener.** New fields `cta_label`/`cta_href`/`secondary_label`/`secondary_href` (a `.cta` and a `.link` in the head), `*accent*` runs in the heading, and `stack: rhythm`, which puts `.rhythm` on `.section__inner` so head and body use the vertical-rhythm scale. With level 1 it replaces nesting a `vitops_hero` in a section, which rendered `section > .centered > … > section > .centered`. `vitops_hero` stays for a stand-alone hero with option cards. A plain (`stack: grid`) section also puts a gap between head and body now (`--section-gap`, default 2rem) instead of sitting flush. css/bricks/tailwind.
  - **`.rhythm` spaces blocks.** A card row (`wc-cards`, classed `ul`/`ol`), accordion, `details`, form, table, figure or `.section__body` directly under a `.rhythm` is `--rhythm-block` (2) apart, not a paragraph apart; a button row (`p.cluster`) is `--rhythm-block-action` (1.6). Classless lists stay prose and a form's own field spacing is unchanged. A bare `<a>` that is a direct child of `.rhythm` is now `display: block; inline-size: fit-content`, since an inline box ignored `margin-top` and sat flush under the paragraph above (`.cta` and `.btn` are unaffected). all formats.
  - **`rhythm-flex`** utility: an opt-in flex-column stack for the case the margin stack does not suit; margins apply to any child. all formats (`@utility` in tailwind).

- 322dd6a: Block fixes from the vitops.ca build (findings 11–13, 15, 17, 18, 21).

  - **Steps.** The marker is an outlined disc in the tone (number and ring in `--tone-solid`, falling back to `currentColor`), so a steps block with no tone no longer shows black discs with no number. Items keep `align-content: start` and no `.rhythm li + li` margin, so markers in a row line up. Two modifiers through the block's `className`: `steps--cards` (each step in a card) and `steps--animated` (the connector draws and the marker fills as each step scrolls in; static under reduced motion or without scroll-driven animations). `steps` is now a config pattern: `patterns.items.steps` in `site.json` owns the card geometry (`content` group tokens) and the marker size (`--steps-marker-size`, `--steps-line-width`); both templates and the reference config ship an entry. all formats.
  - **Stats.** `<wc-counter>` leaves a figure it cannot count as authored (`"1 in 6"`, `"24/7"`, `"—"`) instead of counting down from zero to a wrong value. `animate: false` on the block still turns the count-up off for a whole block.
  - **Logos.** `vitops_logos` takes an optional `kicker`, `note` and `linkLabel`/`linkHref`; with any of them set, the row is wrapped in `.logos-block`. The list keeps the block's attributes either way.
  - **Pricing.** Plans take `yearly` (a second price line) and `note` (under the plan name).
  - **`<SiteFooter>`** has a `brand` named slot, rendered as the first column (`.sitefooter__brand`) in the site's own markup.

- 322dd6a: Tooling fixes from the vitops.ca build (findings 14, 23, 24, 25).

  - **`vitops emdash form-template --from <seed.json | export.json> [--name contact] [--site site.json] [--dry]`** copies a `vitops_form` block into `site.templates` with the renderer's own field resolver, so the generated privacy policy and `check-prerender` know what the form collects. A re-run is a no-op, and the result is validated before it is written.
  - `site.templates` form fields accept `checkboxes` (the block's spelling), and the template union now discriminates on `type`, so a bad entry is reported at its path instead of as a bare "Invalid input".
  - **`prepare-db` fails fast and says why.** It validates `site.json` before starting the dev server, writes the server's output to `.vitops/prepare-db.log`, stops waiting as soon as the log shows an error, and prints the log's tail on failure, instead of waiting out a five-minute timeout with nothing to read.
  - **`check-prerender`** skips the toolkit's own assets under `vitops/` (no more "0 h1" for the theme-editor page) and warns when the sitemap lists URLs the build produced no page for (a collection with no `urlPattern` is listed as `/<collection>/<slug>` while the site serves `/<slug>`).
  - The emdash template ignores the duplicate `pnpm-@getvitops+skills-*` links `skills experimental_sync` leaves beside each skill; the `content-and-deploys` skill explains the sitemap warning.

## 0.9.0-alpha.3

### Patch Changes

- 8543f73: `vitops agents` (also `vitops agents sync`) now keeps a short fenced block at the **top** of `AGENTS.md` instead of appending a long one. The block names the config, says to prefer the framework's classes, and links the skills linked under `.agents/skills` from installed `@getvitops/*` packages (with a one-line "use when …" from each), plus `vitops docs <topic>` for reference; the generate-command list and the topic list are gone. A later run replaces only that block in place and leaves the rest of the file alone; with no block, it is added at the top; a block from an older release is updated where it is. The command also links every skill an installed `@getvitops/skills` ships, so it works without the `skills` CLI. The templates run it from `prepare` and ship the block already in `AGENTS.md`.

## 0.9.0-alpha.2

### Minor Changes

- 0a47856: Build correctness and gaps from the second upstream round.

  - **`@getvitops/emdash`: fixes a circular import that emptied the plugin block map in the static build.** `Section.astro` and `WidgetArea.astro` imported `emdash/ui` statically, which imports `virtual:emdash/block-components`, which is `@getvitops/emdash/astro` again. Depending on import order, every `vitops_*` block inside a section body was dropped from prerendered pages with only a `PortableText [components.type] is missing …` warning. Both now import it lazily, and a test fails if any renderer imports `emdash/ui` statically. No code change needed in sites.
  - **`@getvitops/cli`: `vitops emdash build`** runs `astro build` and then `check-prerender`, and fails when the build reports a block type with no component (reported once per type). The template's `build`, `deploy` and `deploy:dev` scripts use it; existing sites replace `astro build && vitops emdash check-prerender` with `vitops emdash build`. `check-prerender` also warns (fails with `--strict`) on a page without exactly one `<h1>`.
  - **`@getvitops/emdash`: `vitops_hero` and `vitops_section` heading level** accepts `h1`–`h6` and `p` (a heading that is styled but not in the outline). The hero defaults to `h1`; set the level to `2` on a page whose layout already renders an `h1` (the template's seed does).
  - **`@getvitops/emdash`: `vitops_logos`** shows an entry's name as text (`.logos__name`) when it has no image. `@getvitops/core` adds the rule (all formats).
  - **`@getvitops/emdash`: an empty content widget** (no text, no blocks) no longer renders its title, and an area whose widgets are all empty renders nothing.
  - **`@getvitops/create`:** the template's `pages` collection gets `urlPattern: "/{slug}"` (the sitemap listed `/pages/<slug>`, which 404s; existing sites change it under Content Types), and `.gitignore` ignores only `src/styles/tailwind.css` and `tokens.json`, so site CSS kept in `src/styles/` is committed.
  - **`@getvitops/emdash`: per-item colour.** The rows of `vitops_cards`, `vitops_stats`, `vitops_steps` and the hero's `cards` take their own `tone` / `color` (blank inherits the block's), so one block can hold a pine item and an amber one. Hero cards also take an `eyebrow` and a button (`ctaLabel` / `ctaHref`; with a button the card is no longer a stretched link).
  - **`@getvitops/generator` / `@getvitops/emdash`: solid fills read.** The generator emits `--color-<hue>-<step>-on` for every step of every hue, the foreground for a fill at that step picked by the same APCA rule as `text-on-<role>` (css and tailwind formats, a plain `:root`, not `@theme`). A block fill chosen by `color` (hue and step) uses it instead of a fixed white..
  - **`@getvitops/core`: `.counter__value.sr-only`** hides itself, so a build that never emitted the `.sr-only` utility no longer shows a counting figure twice (all formats).
  - **`@getvitops/astro` / `@getvitops/core`: `SiteFooter` groups.** A top-level item of the `footer-sitemap` menu with children becomes a column (its label is the heading, its children the links, one level only); childless items stay in the flat list. Each column is a named `<nav>`.
  - **`@getvitops/astro`: planned links and header buttons.** A menu item with `draft` in its CSS classes stays in the menu but is not rendered (at every level, in the header and the footer). `<SiteNav>` has an `actions` slot for header buttons that are not menu items, and an item with `cta` in its CSS classes renders as a button.
  - **`@getvitops/cli`: `check-prerender` warnings** (fail with `--strict`): links to pages the build did not produce, a form with no delivery address (no `site.notifications.email`, location `email` or `site.crm`), and form fields missing from every `site.templates` form entry (the generated privacy policy reads those). It reads `./site.json`, or `--site=<path>`. `vitops setup … --dry-run` is accepted as `--dry`.
  - **`@getvitops/emdash` / `@getvitops/astro`: "tick any number" form field** (`vitops_form` field kind `checkboxes`): a fieldset of checkboxes sharing one name. The conversion route joins repeated values (`IT, Marketing`) instead of keeping the last. The "required" toggle is not applied to the group (HTML cannot require one of several).
  - **`@getvitops/core`: size hooks.** `.steps__title`, `.stats__figure` and `.card__title` read `--steps-title-size` (default one step below `heading`), `--stats-figure-size` and `--card-title-size`, set on the block through its `style` field. They set the `--heading-fs` / `--display-fs` properties the type-role utilities already read, so no extra class or prop is needed (all formats).
  - **`@getvitops/create`:** the template's `site.json` lists its contact form under `site.templates`, so the privacy policy inventory and the new check agree.
  - **`@getvitops/emdash`: `theme` on every block, on widget areas and on your own markup.** A `theme` select (`<role>` tinted, `<role>:solid` filled, populated from the site's roles by a new `themes/list` route) is a common field on every `vitops_*` block, applied to the block's own root with the role's computed readable text. `<VitopsWidgetArea theme="…">` takes the same, and `themeAttrs('surface')` gives `{ class, style }` for a layout `<body>`. `vitops_section`'s existing `theme` now goes through the same path.
  - **`@getvitops/cli` / `@getvitops/emdash`: pages with a dropped block fail the build.** `vitops_section` and widget areas emit an invisible `<template data-vitops-unrendered="…">` for any body block with no renderer, and `check-prerender` fails the page naming the types (nested bodies only; `vitops emdash build` also scans the build log, which covers top-level bodies). A regression test imports the plugin entry first with a mock of the real virtual module, so the old import cycle fails it.
  - **`@getvitops/emdash`: `formTemplateFromBlock(block)`** turns a saved `vitops_form` value into a `site.templates` form entry (names as submitted, a `checkboxes` field as a `checkbox` with options), to paste into `site.json` so the generated privacy policy lists what the form collects. The build cannot read the CMS database, so this is run by hand; `check-prerender` warns when fields are missing.
  - **`@getvitops/utils`: `hasFormDelivery`** (`@getvitops/utils/notify`): the one test for "has this form anywhere to go", used by `check-prerender`.
  - **`@getvitops/emdash`:** a `color` hue tint now flips with the colour scheme (`light-dark()`); hero option cards sit at `h2` under an `h1` hero; menu items also accept `hidden: true` (same as the `draft` class); `vitops docs blocks` documents `theme`, the per-row colours, the `--<role>-fs` type-size hook and the form checks.
  - **`@getvitops/create`:** the template redirects `/home` to `/`, and the guides use `vp exec` instead of `vpx`.

### Patch Changes

- 0a47856: **Breaking: every block type is now `vitops_<name>`** (`vitops_cards`, `vitops_hero`, `vitops_actionLink`, …), where the Portable Text blocks were `vitops.<name>` and the section block type was already `vitops_section`. EmDash validates a block type's slug as `[a-z][a-z0-9_]*`, so `vitops.section` was never possible and the toolkit had two styles for one kind of thing. Underscore is the one form valid everywhere, so it is now the only one.

  Migration: in stored content and in `seed/seed.json`, rename `_type` values from `vitops.<name>` to `vitops_<name>`; in `PortableText` `components`, rename the keys the same way; the `blocks: { include, exclude }` option takes full type names, so rename those too. `vt_*` names in a site are that site's own types and are unaffected. A search-and-replace of `vitops.(actionLink|imageCompare|copyButton|banner|details|carousel|gallery|cards|accordion|hero|marquee|logos|steps|stats|callout|entries|pricing|embed|form|reviews|nav|badges|widgetArea)` with `vitops_$1` covers it. `vitops emdash build` reports any block left on the old name as having no component.

- 0a47856: New package `@getvitops/skills`: agent skills for sites built with the toolchain (`custom-blocks`, `content-and-deploys`, `contact-form`, `csp`). The emdash template depends on it and runs `skills experimental_sync` on `prepare`, which links them into `.agents/skills/` and `.claude/skills/`, so they update with `vp update` instead of being copied at scaffold time. Existing sites: `vp add @getvitops/skills && vp add -D skills`, set `prepare` to `vp config && skills experimental_sync -y -a claude-code --no-frozen-lockfile`, gitignore the four linked names, and delete the site's own copies of those four skills (the sync never replaces a directory it did not create).

  The emdash template's `AGENTS.md` is shortened to the always-relevant rules. Deploy and content mechanics (where each kind of data is the truth, prerendering, publish-triggered rebuilds, refreshing dev), the contact form, and the CSP move into those skills. Corrects the nesting guidance: a block type with a `portableText` field (such as `vitops_section`) holds other blocks, while `vitops_*` Portable Text blocks do not. Adds guidance for agents to record reusable toolkit gaps in `UPSTREAM.md`. The generated stylesheet is no longer described as always `tailwind.css`.

## 0.9.0-alpha.1

### Minor Changes

- 24c568b: Escape hatches on every block, a section theme, widget areas, a badges block, Tailwind scanning of package renderers, and a sturdier `vitops audit`.

  **@getvitops/emdash**

  - Every `vitops.*` block and `vitops_section` gains three fields: `anchor` (rendered as the `id`, so `#contact` works), `className` (`class_name` on the section type: block-type slugs are lowercase) and `style`. `style` takes CSS custom properties only (`--p-card: 2rem`); any other declaration, and any value containing `url(`, `@`, `{`, `}` or a backslash, is dropped. With the `tailwind` format a class typed in the CMS only works if the site already uses it. They are applied to the block's own outermost element (the grid `<ul>` for `vitops.cards`), never an extra wrapper, so a block's markup is the same whether or not an editor fills them in.
  - `vitops_section` gains a `theme` select: a role, or `<role>:solid`, with readable text chosen by the generator's contrast rules. It overrides `tone`/`color`/`solid`, which stay for existing content. Other site roles still go through `tone`.
  - New `vitops.badges` block (a row of `.badge` or `.tag` labels, each with an optional tone, icon and link) and `vitops.widgetArea` block, plus `<VitopsWidgetArea name level />` from `@getvitops/emdash/astro`. A widget area is content defined once under Widgets and shown wherever it is placed. An area cannot hold another area, and an area containing a `core:*` component widget is rendered by EmDash's own renderer.
  - Existing sites: re-run the block-type seed only on a new database; on an existing one add the `theme`, `anchor`, `className` and `style` fields to the `vitops_section` block type in the admin.

  **@getvitops/create**: the emdash template seeds `announcement` and `pre-footer` widget areas, renders them in `Layout.astro`, and documents when to use a Section, a block or a widget area. Sites scaffolded earlier add the two `<VitopsWidgetArea>` lines and the `widgetAreas` seed entries by hand.

  **@getvitops/generator / astro / vite** (`tailwind` format only): the Astro integration now adds `@source` lines for `@getvitops/astro` and `@getvitops/emdash`, because Tailwind v4 does not scan `node_modules`; utilities used only by their renderers (`font-display`, `font-caption`, `font-footnote`) were never emitted and the page silently rendered at body size. New `sources` option on `generate()` and the Vite plugin. A site's `src/package-classes.txt` workaround can be deleted. css and bricks: no change.

  **@getvitops/cli**: `vitops emdash check-prerender` now also warns when a page uses a type-role class (`font-display`, …) the built CSS has no rule for; `--strict` makes it fail. `vitops audit` checks for its optional packages and a Chromium binary before starting the preview server (so a failed run no longer leaves port 4398 busy), stops the server on Ctrl+C and termination, and takes its page list from the built sitemap, then the menus; the guessed defaults (`/privacy`, `/contact`, …) are used only when neither exists.

  **@getvitops/utils**: the audit helpers behind the above (`preflight`, `fetchSitemapPaths`, `sitemapLocs`, `pathsFromSitemapLocs`).

  **@getvitops/core** (all formats): new `.block-anchor` rule gives an anchored block `scroll-margin-top: var(--header-offset, 5rem)`; set `--header-offset` to a sticky header's height. New `widget-area.css` partial. No other consumer-facing change.

  The other fixed-group packages: no consumer-facing change beyond the above.

  **Also fixed in the emdash template** (`site.json`): it defined only the `display`, `heading` and `body` type roles while the blocks use `title`, `eyebrow`, `lead`, `caption` and `footnote`, so those rendered at body size with no rule behind them. The roles are added with the reference design system's specs. A site scaffolded earlier adds the same five entries under `designSystem.themes.default.typography.roles`; `vitops emdash check-prerender` now names any that are missing.

## 0.9.0-alpha.0

### Minor Changes

- 161c7f3: A contact form that works end to end: `vitops setup turnstile`, `<wc-turnstile>`, the `vitops.form` EmDash block, and the route the emdash template ships to receive it.

  **CSS, all formats** (no existing class changes): `forms.css` gains `.form-notice--target:not(:target)` (a message revealed only when the URL fragment names it, which is how a prerendered page shows a no-JS form's result) and `:where(wc-turnstile) { display: block }`.

  **`@getvitops/core`:** new `<wc-turnstile sitekey="…">` in `elements.js`. It loads Cloudflare Turnstile on the first interaction with its form (no request to `challenges.cloudflare.com` for a visitor who only reads the page), holds an early submit until the token arrives, and leaves its slotted no-JS explanation in place until JS takes over. Turnstile is category `necessary`, so it is not behind the consent banner.

  **`@getvitops/utils` / `@getvitops/cli`:** new `@getvitops/utils/turnstile` and `vitops setup turnstile [--dry] [--check] [--no-write] [--no-secret]`. It plans from the site's hostnames, creates a managed widget unless one already covers them (an existing widget is adopted, never edited, rotated or deleted), writes the public key to `site.security.turnstile.siteKey`, and pipes the one-time secret to `wrangler secret put VITOPS_TURNSTILE_SECRET` without writing it to any file. Needs `CLOUDFLARE_API_TOKEN` with **Account > Turnstile > Edit** and `CLOUDFLARE_ACCOUNT_ID`.

  **`@getvitops/astro`:** `virtual:getvitops/head` gains `turnstileSiteKey` (read from `site.security.turnstile.siteKey`) so blocks can render the widget. No other change.

  **`@getvitops/generator`:** `TIERS` gains a `turnstile` entry (wc-turnstile, claimed by `vitops.form`); `wc-multi-field`'s `emdashExempt` reason is reworded now the form block exists.

  **`@getvitops/emdash`:** new `vitops.form` block: a field repeater (text, email, phone, long text, choose one, tick box), required flags, help text, success/error messages, optional Turnstile. It renders a semantic `<form method="post">` that works with no JavaScript, with a honeypot named per `createConversionRoute`'s defaults. A field named `phone` submits as `tel`, because the route reserves `phone` and `event`.

  **`@getvitops/create`:** the emdash template ships `src/pages/api/track.ts` (`prerender = false`, `createConversionRoute()`), a seeded contact form, and `challenges.cloudflare.com` in both templates' Report-Only CSP (`script-src`, `frame-src`). The route refuses a post with nowhere to deliver and fails closed when a site key exists without `VITOPS_TURNSTILE_SECRET`. SETUP.html gains the Turnstile step. Existing sites: copy the route and the CSP change, then run `vitops setup turnstile`.

- fec1b4b: The EmDash template's two build scripts are now CLI commands, so fixes reach existing sites with `vp update` instead of a re-copy.

  - `vitops emdash prepare-db` migrates and seeds the local D1 the build prerenders from (was `scripts/prepare-local-db.mjs`). The start and stop calls time out after 5 minutes and it prints progress.
  - `vitops emdash check-prerender [dir]` fails the build if a prerendered page is not a real page (was `scripts/check-prerender.mjs`).

  **Migration for a site scaffolded earlier:** delete `scripts/prepare-local-db.mjs` and `scripts/check-prerender.mjs`, then in `package.json` set `"prepare-local-db": "vitops emdash prepare-db"`, `"build": "astro build && vitops emdash check-prerender"`, and use the same two commands in place of `node scripts/…` inside `deploy` and `deploy:dev`. A site that never had the scripts needs only the `package.json` entries.

- 224a731: **`@getvitops/astro` (no CSS change; all formats unaffected)**

  - **`site.fonts` is no longer silently ignored.** `vitops()` now turns webfonts on by default when the site config (`site` option, or a `css.input` that is a site config) declares `site.fonts`, and logs that it did. Before, no `@font-face`, preload or warning was emitted unless you also passed `fonts: true`. Pass `fonts: false` to opt out. Migration: none — sites that already set `fonts` behave the same; sites that declared `site.fonts` without it will start loading those families.
  - **The icon sprite is served when the site config asks for it.** `site.icons.sprite: true` made the generator write `icons.svg`, but only the `icons` integration option copied it to `public/vitops/`, so `/vitops/icons.svg` was never served. It is now mirrored whenever the site config sets it.
  - **Strict CSP is achievable.** New build-time exports `inlineScriptHashes()`, `cspScriptHash()` and `contentSecurityPolicy()` give the SHA-256 hashes of the two inline scripts `<Head />` emits (colour-scheme bootstrap, consent-gate stub) and a starting policy built on them, with no `'unsafe-inline'` in `script-src`. The scripts moved from `Head.astro`'s frontmatter to `src/inline-scripts.ts` (shipped in the package) so the hash and the emitted bytes are the same constant; the rendered output is byte-identical.

  **`@getvitops/create` (templates; existing scaffolded sites are not changed)**

  - **emdash: every public page is prerendered.** `index.astro`, `[...slug].astro` (via `getStaticPaths` over the published `pages`) and `404.astro` set `prerender = true`. Unknown URLs now return the prerendered 404 with a real 404 status — the old `Astro.rewrite('/404')` from an on-demand route to a prerendered one was refused by Astro, so every unknown URL was a 500. `scripts/pull-content.mjs` (first step of `deploy`/`deploy:dev`) loads production's D1 into the local build database, because the Cloudflare adapter prerenders against a local D1 that is empty on CI; it fails closed. The deploy-prod workflow also runs on a `repository_dispatch` of type `emdash-publish`. Migration for an existing site: copy those pages, the script and the two `package.json` scripts, and add the trigger; previews of unpublished drafts no longer work on the public routes (see AGENTS.md).
  - **emdash: seed menus are `primary` (Contact), `footer-sitemap` (Home, Contact) and `footer-legal` (Privacy Policy, Terms & Conditions, Cookie Notice)**, replacing `primary` (Home, About) and `footer` (Terms, Privacy), with placeholder `contact` and `cookies` pages so every seeded link resolves. The template Layout still reads the old menu names until it is updated; the seed only applies to an empty database, so existing sites keep their menus.
  - **Both templates: `badge` and `tag` patterns (group `label`) are enabled, `button` carries `class: "btn"` so `<a class="btn">` is styled, and `neutral`/`surface` are declared as surface roles** (they were chromatic, which emitted no `.bg-neutral`/`text-neutral-muted`). css/bricks/tailwind output of a scaffolded site changes accordingly.
  - **Both templates ship `public/_headers` with a `Content-Security-Policy-Report-Only` default** naming `<Head />`'s inline scripts by hash. It blocks nothing. `_headers` applies to static assets only, not Worker-rendered responses; see AGENTS.md for the EmDash admin and HTML-block trade-off.
  - **Guidance is Vite+-first**: `AGENTS.md`, README, the `setup` skill, `SETUP.html` and the session hook use `vp`/`vpr`/`vp exec` instead of `pnpm`/`npx`, with one command table; `vpr dev` is documented as returning immediately. There is no `vp change`/`vp pm change` (checked against vp 1.5.0); the release flow is `dev` → promote.
  - emdash ships `.agents/skills/custom-blocks/SKILL.md` (compose, extend, site-local, upstream; naming and lifecycle rules) and the favicon `themeColor`/`name` now derive from `site.json`.
  - Label vocabulary: `badge` is a static label, `tag` is static or dynamic; `chip`/`pill` are not used.

  **`@getvitops/cli`**: the bundled `vitops-design-system` skill points at `vp exec vitops docs <topic>`.

  No consumer-facing change in `@getvitops/core`, `@getvitops/generator`, `@getvitops/utils` or `@getvitops/vite`.

- 55061e2: **Added: `<SiteNav>` and `<SiteFooter>` for Astro/EmDash sites.** Both are tier-1 markup over the existing `sitenav` pattern (no runtime JS: `<details>` accordions + Popover API drawer). Non-breaking.

  - `<SiteNav {...await loadNavMenus(getMenu)} />` renders EmDash menu `primary` (the default: depth 3, dropdowns from the `md` container width, drawer below). If a `primary-mobile` menu exists it replaces the nav below `md` (depth 1); if `primary-mega` exists it replaces it from `xl` (mega panels). Adding the menu in the admin is the whole change. Only one tier is in the accessibility tree at a time. An item's `titleAttr` is its description (EmDash has no description field yet).
  - `<SiteFooter sitemap legal name>` renders `footer-sitemap` + `footer-legal` + a copyright line.
  - `@getvitops/astro/components/sitenav.ts` exports the pure helpers (`loadNavMenus`, `selectTiers`, ...).
  - CSS (`patterns/sitenav.css`, **all formats**): tier visibility classes (`.sitenav-tier--below-*`/`--from-*`), `.sitenav--mega`, `.sitenav__desc`, `.sitefooter*`, `aria-current` styling, reduced-motion and forced-colors handling. Existing `.sitenav` rules are unchanged, so the Bricks element is unaffected.
  - `@getvitops/create` (emdash template): the layout now renders header and footer through these components, with the colour-scheme toggle in the header. It reads menus `primary`, `footer-sitemap` and `footer-legal`; a template whose seed still has the old `footer` menu renders no footer links until the seed is updated.
  - `@getvitops/generator`: `TIERS.sitenav` now lists the two Astro components.

- 7a4241e: EmDash template: make the database a build prerenders from valid before it builds, and fail the build when it isn't. The template runs `migrations: { runtime: 'check' }`, so a build against a local D1 with pending migrations prerendered EmDash's one-line "Database migrations are required" response into every page while still succeeding. A fresh CI runner, a first deploy, a `SKIP_PULL_CONTENT=1` build and an upgrade deploy all hit it.

  - **New `scripts/prepare-local-db.mjs`** (`vpr prepare-local-db`): starts `astro dev` once, calls EmDash's `dev-bypass` setup (which migrates and applies the seed's sample content), checks the home page renders, and stops it. Writes only the disposable `.wrangler/state`. Run after `pull-content` by `vpr deploy`, `vpr deploy:dev` and the reusable deploy workflow. `SKIP_PREPARE_LOCAL_DB=1` skips it.
  - **New `scripts/check-prerender.mjs`**, part of `vpr build` and both deploy scripts: fails when any prerendered page is not an HTML document with a title, or carries the pending-migrations message.
  - **Existing sites:** add the two scripts, the `prepare-local-db` script entry, and `&& node scripts/check-prerender.mjs` after `astro build`; add a "Prepare local database" step before each Build step in a copied deploy workflow. Run `vpr prepare-local-db` once before a first local `vpr build`.

  No consumer-facing change in the other toolchain packages.

### Patch Changes

- 06d6112: Fix the EmDash `/design-system` admin page erroring on a tailwind site. It fetches `/vitops/design-manifest.json`, which the `tailwind` format never emitted and the integration only mirrored under `editor: true` (which also loads `editor.js` on every public page).

  - **generator** (`tailwind` format only): `design-manifest.json` is now emitted alongside `tailwind.css`. No change to the CSS.
  - **astro**: new `vitops({ editorManifest: true })` writes everything an outside host needs into `public/vitops/` (`design-manifest.json`, `editor.js`, a standalone `editor.css`, and `design-system-editor.html`) without loading the editor on public pages. `editor: true` still loads it from `<Head />`.
  - **vite**: `editorManifestDir` also writes `vitops/editor.css`, from a throwaway `css`-format pass on tailwind sites.
  - **emdash**: the `/design-system` admin page was unstyled and overflowed the admin, because the editor borrows the framework CSS and the admin never loads it. It now embeds `/vitops/design-system-editor.html` in an iframe, so the design system can't leak into the admin's styles. **Requires `editorManifest: true`** in `vitops({ … })`.
  - **create**: the EmDash template sets `editorManifest: true`. Existing sites: add it to `vitops({ … })` in `astro.config.mjs`.

  No consumer-facing change in the other toolchain packages.

## 0.8.2

### Patch Changes

- 29fc659: EmDash template: the per-project EmDash skills install command is now `npx skills add emdash-cms/skills --skill '*' -y`. Without `-a`, the CLI writes the skills to `.agents/skills/` and symlinks them into `.claude/skills/`, so Claude Code and every other agent see the same files. The 0.8.0 notes named `-a claude-code`, which copies into `.claude/skills/` only.

## 0.8.1

### Patch Changes

- Both templates pin Node by major only (`devEngines.runtime.version: "24"`), matching `.node-version`. The exact `24.18.0` pin disagreed with the floating `.node-version`, so `vp` warned in every fresh scaffold.

## 0.8.0

### Minor Changes

- 226b1aa: **Content now lives in production; dev is a refreshed copy.** The `dev → main` flow is for code,
  pages and `site.json`. EmDash content is edited on the production site (drafts, "Publish changes"
  and preview links are the staging step), and the dev database is disposable and refreshed _from_
  prod — never promoted back. Both templates gain a hotfix path back into `dev`.

  - **New `refresh-dev.yml` (emdash template) + `scripts/refresh-dev.mjs`** — copies prod's D1
    database into `<name>-dev` (weekly and on demand), and prod's R2 bucket too when the optional
    `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` repo secrets are set. It drops every table in its
    target, so it refuses a database that isn't `*-dev`, doesn't match `DEV_D1_ID`, or is
    production's. **Overwrites everything in the dev database on each run** — content edited on dev
    is lost by design.
  - **New `backmerge.yml` (both templates)** — on every push to `main`, opens a `main → dev` PR when
    merging would change `dev`, so a prod hotfix doesn't leave `dev` behind. The PR is left for a
    human to merge unless a `BACKMERGE_TOKEN` secret (PAT / GitHub App token) is set: a merge made
    with the default token triggers no workflows, so Deploy dev would not run.
  - **Magic-link sign-in in the emdash template**: it now registers `cloudflareEmail()` and a
    `send_email` binding named `EMAIL`. A passkey only works at the origin it was registered on, so a
    refreshed dev site would otherwise lock editors out; the cloned users already exist, so the same
    email signs in on both origins. **Existing sites:** templates are copied at scaffold time, so
    nothing changes until you add both yourself, and magic link answers "Email is not configured"
    until you do. Onboard the sender first (`npx vitops email setup send.<your-domain>`) and set
    `from` to an address on that domain — the template ships a placeholder you must replace.
  - **The dev worker no longer has a cron trigger** (`build-dev-wrangler.mjs`), since a refreshed
    database carries prod's scheduled publishes and plugin jobs. Scheduled publishing can't be
    exercised on dev. Set a different `EMDASH_PREVIEW_SECRET` on the dev worker, or prod preview
    links will open drafts there.
  - `SETUP.html` and the `promote` skill describe the new model; `SETUP.html` gains four items under
    "3. Hosting resources" (the OAuth apps and preview secret are manual).

  No consumer-facing change in `@getvitops/core`, `@getvitops/generator`, `@getvitops/utils`,
  `@getvitops/cli`, `@getvitops/vite`, `@getvitops/astro` or `@getvitops/emdash`. The reusable
  workflows (`site-refresh-dev.yml`, `site-backmerge.yml`) reach existing client repos only once the
  `v1` tag is moved by `release-workflows.yml`; a client needs the new caller files above to use them.

- 0a4f64b: **EmDash template:** documents installing the EmDash agent skills per project
  (`npx skills add emdash-cms/skills --skill '*' -a claude-code -y`, so they match the pinned `emdash`) in
  the README and `AGENTS.md`, and lists the current blocks (hero, cards, accordion, gallery, marquee, …)
  with `npx vitops docs blocks` as the full reference. Raises the dependency floors (`@astrojs/react`
  7.1, `@astrojs/check` 0.9.12, React 19.3.1) and both templates now pin `pnpm@12.16.1`.
- c3c1bcb: **New: the design-system editor, mounted inside the EmDash admin.** `vitopsEmdash({
  designSystemEditor: { config } })` (`config` is your `site.json`, e.g. `import config from
  './site.json' with { type: 'json' }`) adds a `/design-system` admin page mounting
  `<wc-theme-editor>` — the same live token editor `@getvitops/vite`'s dev server has always
  offered, now usable by the client directly, no dev server required. An edit is visible
  site-wide immediately (a runtime `:root` override, served via a new plugin API route and
  `page:fragments`) and — once `site.deployment.repo`/`branch` and a `VITOPS_GITHUB_TOKEN`
  secret are set (see the scaffold's `SETUP.html`) — auto-commits to your `dev` branch, so it
  reaches the git-tracked `site.json` through your repo's normal review path rather than
  becoming a second, unreviewed source of truth. Until that's configured, the live half still
  works; only the auto-commit half is skipped (and says so in the admin page). The save route
  runs the exact same accessibility (APCA contrast) gate `generate()` enforces at build time,
  synchronously, before persisting — nothing non-compliant ever goes live even momentarily.

  Requires `@astrojs/react` + `react` + `react-dom` (already scaffold dependencies, for
  EmDash's own admin) and `@getvitops/core` (added as a new scaffold dependency this release).
  Declares two new plugin capabilities when enabled: `network:request` (for the GitHub
  auto-commit) and `hooks.page-fragments:register` (for the live override) — reviewed once at
  plugin-install time.

  **Breaking for `@getvitops/emdash`**: `vitopsEmdash()`'s `hooks.page-fragments:register`
  capability is now also granted whenever `designSystemEditor` is set, independent of the
  existing `scripts: 'fragments'` option (which governs something unrelated — web-component
  script delivery). No change if you don't use `designSystemEditor`.

  Also new, supporting the above:

  - `@getvitops/generator`: `validateColorContract()` and `buildReverseIndex()` (both
    `/tokens` subpath, Worker-safe) — the monotonicity/contrast gate and the
    `design-manifest.json` reverse-index, each extracted from `generate()`'s `build()` into
    standalone, non-throwing functions. `patchToOverrideCss()` turns a design-system patch
    into the `:root` override `<style>` block. `designSystemPath`/`getAt`/`setAt`/
    `mergePatch`/`formatConfig` moved from `@getvitops/vite` into `@getvitops/generator/config`
    (re-exported from `@getvitops/vite` unchanged) — one "patch a config file's design-system
    subtree" implementation shared by the dev endpoint and the new plugin route. New
    `site.deployment.repo`/`branch` config fields.
  - `@getvitops/utils`: new `/git` subpath — `commitFile()`, a Worker-safe (fetch-only)
    wrapper over GitHub's Contents API.
  - `@getvitops/core`: `<wc-theme-editor>` gains a `save-endpoint` attribute (default
    unchanged — `/__vitops/design-system`) so the same element can target the new plugin
    route instead of the dev-only Vite endpoint.

- 2ef2d41: **Tested against EmDash 1.4.** `emdash` and `@emdash-cms/cloudflare` are now `^1.4.0` in the
  `emdash` template, and `@getvitops/emdash`'s peer ranges for both moved from `>=1.0.0 <2` to
  `>=1.3.0 <2` — **breaking for a site still on EmDash 1.0–1.2**: upgrade `emdash` and
  `@emdash-cms/cloudflare` together (EmDash warns at build when the two differ) before upgrading
  this package. 1.4 fixes a stored XSS in the visual-editing toolbar (an author's published content
  could run script for a signed-in editor), so an existing client site should take it promptly.

  - **`vitopsHosting()` coalesces D1 reads by default** — new `cloudflare.coalesce` option
    (default `true`, passed to `d1({ coalesce })`). With `session: 'auto'`, EmDash 1.3 stops
    preloading settings/menus/widgets for logged-out visitors unless reads are coalesced, so this
    restores one round trip instead of several. It is experimental upstream: a read and a write
    started together may run write-first, so `await` a read before a write that must not affect it.
    Set `coalesce: false` to opt out. No effect without a session.
  - **Template:** `AGENTS.md` gains an "EmDash 1.x behaviours" section (passkeys are bound to a
    hostname so use _Change domain_ at cutover; admin-authored HTML blocks run JS and conflict with
    Astro CSP; link by `entry.data.slug`, not `entry.id`; submit `/sitemap.xml`; clearing a stuck D1
    lock with `emdash migrate --take-over-lock`).
  - **Upstream behaviour changes to know about (no code change here):** `cacheHint.lastModified` is
    no longer auto-populated and pages lose the implicit `Cache-Control: no-cache`; collection
    sitemaps paginate at 2,000 entries; `entry.id` is always locale-prefixed on multilingual sites.

  No consumer-facing change in `@getvitops/core`, `@getvitops/generator`, `@getvitops/utils`,
  `@getvitops/cli` or `@getvitops/vite`. `@getvitops/astro` has one — see the scaffold changeset.

- ab451ae: **Scaffolds now pin Astro `^7.4.4` and ship a `.node-version`.** Both templates (`emdash`, `static`)
  move from `astro: ^7.1.2` to `^7.4.4` — the newest release at least three days old when this was
  chosen (7.4.5 was under a day old), matching what this repo builds and tests against — and add a
  `.node-version` containing `24`, so version managers that read it (fnm, mise, asdf, Volta) agree with
  the `.nvmrc` the reusable CI workflows read and the `devEngines` pin pnpm reads. `templates.test.ts`
  now fails if those three disagree, or if a template's Astro range drifts from the repo's catalog.

  Existing projects are not changed: bump `astro` yourself, and add `.node-version` if you want it.

  Formats reached: none — no CSS change. Other packages in the `fixed` group: No consumer-facing change
  in this package.

- b70c7f0: **Scaffolded projects now hold new releases for 3 days before installing them.** Both templates set
  `minimumReleaseAge: 4320` (the `emdash` template was 1440; the `static` template had no
  `pnpm-workspace.yaml` and so used pnpm's one-day default). The `static` template now ships a
  `pnpm-workspace.yaml` carrying the cooldown, the build approvals, and the same toolchain exemptions as
  `emdash` — `@getvitops/*` and the Vite+ / Oxc tools are exempt, since they release together.

  If a fresh install in a scaffolded project is rejected for a dependency published in the last three
  days, wait for it to age or add its exact version to `minimumReleaseAgeExclude`. Existing projects are
  not changed.

  Formats reached: none — no CSS change. Other packages in the `fixed` group: No consumer-facing change
  in this package.

### Patch Changes

- 0574388: Add `vitops email setup|check` — connect `site.notifications.email.from` to whether its domain is
  actually onboarded onto an outbound email provider.

  Before this, nothing checked that. `EMAIL.send()` throws `E_SENDER_NOT_VERIFIED` at runtime with no
  build or deploy-time warning — the failure mode is silent and production-only.

  `vitops email setup [domain]` onboards a sending domain (currently Cloudflare Email Sending only)
  and polls DNS until its SPF/DKIM/DMARC records resolve or a timeout is reached; `vitops email
  check` is the non-blocking deploy guard both `@getvitops/create` templates' `deploy`/`deploy:dev`
  scripts now run first (`--strict` makes it a real gate; opt out per-site with
  `site.notifications.email.verifySender: false`, or globally with `--skip` /
  `VITOPS_SKIP_EMAIL_CHECK`).

  Two things worth knowing before running it:

  - **The onboarded entity is an exact name, and it is usually a subdomain**
    (`send.yourdomain.com`), never the apex your `from` address names. When the exact domain isn't
    onboarded but a sibling in the same zone already is, the command reports that as the fix — send
    from the onboarded subdomain — rather than silently trying to onboard the apex, which rewrites
    `_dmarc.<domain>` and can tighten DMARC policy on every other mail your domain sends.
  - Candidates come from `site.notifications.email.from` (or its derived `noreply@<domains
    .canonical>` default) first; a best-effort scan of `--src` only supplements it, and never guesses
    at a computed `from` value.

  New `@getvitops/utils/email` subpath and `site.notifications.email.verifySender` config field.
  Needs `CLOUDFLARE_API_TOKEN` with an Email Sending scope in addition to the `Zone:Read` other
  commands already use.

- 1a8231d: **EmDash blocks are now a tier of the component manifest, and there are four more of them.**

  `@getvitops/emdash` adds `vitops.gallery`, `vitops.cards`, `vitops.accordion` and `vitops.marquee`
  (each a thin adapter over the matching `@getvitops/astro` component), and `vitops.carousel` now edits
  its slides as a **Slides repeater** instead of two newline-separated fields. Blocks saved before this
  keep rendering: with no `slides`, the carousel still reads `images`/`alts`, and both legacy fields stay
  in the editor, labelled as legacy. The editor's field type now admits `repeater` and `media_picker`.

  - **New `blocks` plugin option** — `vitopsEmdash({ blocks: { include, exclude, extra } })`. `include` is
    an allowlist, `exclude` drops blocks, `extra` adds the site's own **editor** definitions (the site
    supplies their renderers via `<PortableText components={{ type }}>`, the same route that overrides a
    `vitops.*` renderer). An unknown name or a colliding `type` throws at plugin construction.
  - Link and image URLs in blocks with a scheme other than `http`, `https`, `mailto` or `tel` are
    dropped (see the security entry).

  `@getvitops/generator`: `TierEntry` gains an optional `emdash: string[]` (block `_type`s) and `Tier`
  gains `'emdash'`, so `tierPatterns('emdash')` projects it. **Breaking only for code that exhaustively
  switches on `Tier` or builds a `Record<Tier, …>`** — add an `emdash` case. The agent doc
  `vitops docs components` gains an "EmDash blocks" table and the docsite a `components/emdash` page. The
  guard that every block and every `emdash` entry agree lives in `@getvitops/emdash`'s `blocks.test.ts`,
  because the generator cannot import the plugin.

  `@getvitops/create`: the EmDash template's agent guidance explains the blocks, their limits (a block
  cannot contain blocks; `vitops.*` blocks do not render inside EmDash's built-in `columns`) and the
  `blocks` option.

  Formats reached: none — no CSS change. Other packages in the `fixed` group: No consumer-facing change
  in this package.

- 779d22e: Add a `vitops.hero` EmDash block (eyebrow, heading, text, two links, optional image; centered or split layout) built on the `.centered`/`.split` layout primitives. The EmDash template's home page now seeds one of each of hero, cards, accordion and marquee. `@getvitops/generator`: the `split` pattern lists the new block in `TIERS`.
- 0574388: Bump `emdash`/`@emdash-cms/cloudflare` peers to `>=1.0.0 <2` and `vite-plus` to `^1.0.0`, following
  both projects' GA releases.

  **Breaking for `@getvitops/emdash` consumers on EmDash 0.x**: the peer range no longer admits
  `emdash@0.31.x`/`@emdash-cms/cloudflare@0.31.x`. Upgrade `emdash` and `@emdash-cms/cloudflare` to
  `^1.0.1` first — nothing in `@getvitops/emdash`'s own plugin surface (`admin.portableTextBlocks`,
  the `hooks.page-fragments:register` capability, `definePlugin()`) changed against EmDash 1.0, so no
  code here needed to change, only the declared range.

  The `emdash` scaffold template (`vp create @getvitops:emdash`) picks up several fixes alongside
  the version bump:

  - `tailwindcss`/`@tailwindcss/vite` are now real dependencies — the template selected
    `css.format: 'tailwind'` without installing either, which threw on build.
  - `site.json` now sets `site.icons.sprite: true` plus the full `semantic` list the
    `vitops.actionLink` block's icon picker offers — previously its sprite icons pointed at a file
    the build never generated.
  - `astro.config.mjs` sets `migrations: { runtime: 'check', dev: 'auto' }`, and
    `site-deploy-emdash.yml` runs EmDash 1.0's documented `build → status → apply → deploy → check`
    migration sequence explicitly, rather than relying solely on first-request auto-migration. This
    needs a new GitHub Environment variable, `EMDASH_TARGET_FINGERPRINT` (one per environment),
    which only a human can set — run `emdash migrate --status` against the real deployed database,
    review the printed identity, then `gh variable set EMDASH_TARGET_FINGERPRINT --env <env> --body
    <value>`. Deploys fail clearly on the migration-apply step until it's set.
  - `lint.options.typeAware`/`typeCheck` in the template's own `vite.config.ts` are commented out,
    not deleted: vite-plus 1.0 only honours that option in a project's actual root config, and hard
    errors on it in a nested one (which this file is, sitting inside the `design-system` monorepo).
    Uncomment it once scaffolded into its own repo.

  No config schema changes. `@getvitops/generator` also switches from the `zod/mini` subpath import
  to the standalone `@zod/mini` package (zod 4.5+; same API) and fixes `validateConfig()` silently
  losing the offending key name on an `unrecognized_keys` error (e.g. a typo'd `site.ads` platform
  now names the bad key instead of reporting a bare "Invalid input").

  Also fixed: `vp check`'s `tsconfig-error` for `packages/create/templates/emdash/tsconfig.json`
  (`extends: "astro/tsconfigs/strict"`, unresolvable from inside this monorepo since the template
  has no `node_modules` of its own — a pre-existing, structural gap, newly surfaced as a hard error
  by oxlint 1.85's deeper config discovery, and blocking on every commit since this repo's pre-commit
  hook runs `vp check --fix`). Fixed with a new `scripts/link-template-deps.mjs`, wired as the root
  `postinstall` script: symlinks `astro`/`emdash`/`@emdash-cms/cloudflare` into the template's own
  `node_modules/` (resolved fresh from sibling packages that already depend on them for real, not a
  hardcoded `.pnpm` hash) and writes a minimal `astro:content` ambient shim at `.astro/types.d.ts`
  (the same path `astro sync` would generate for real). Both are gitignored and only ever exist
  inside this monorepo's copy of the template — a real scaffold installs its own real copies instead.
  Considered and rejected first: inlining astro's strict preset (drift risk against astro's own
  evolving default) and making the template a real pnpm workspace member (would change how its
  `@getvitops/*: "latest"` deps resolve locally, which `templates.test.ts` exists to protect).

  **Known gap, not fixed here**: `packages/astro/src/components/container.test.ts` (the
  `AstroContainer`-based render tests) fails to even load under vite-plus 1.0's Vite 8 — direct
  `.astro` imports in a Vitest file need the Astro Vite plugin registered, which nothing in this
  repo's test config actually does (Astro's own docs call for `getViteConfig()`, which doesn't
  compose with vite-plus's own `defineConfig`). A type-level shim
  (`packages/astro/src/components/astro-modules.d.ts`) fixes `vp check`'s type-aware pass, but the
  runtime `vp test` failure for this one file is still open.

- 0f8c018: **New: `resolveOrganizationName(config, locale?)`**, exported from `@getvitops/astro/routes`
  alongside `toNotifyContext`/`toCrmConfig` — the same `organization.name` → `legalName` →
  `undefined` fallback chain `toNotifyContext` already used for its `organizationName` field,
  now usable standalone anywhere a build-time-only display name is needed (favicon generation,
  a scaffold's `astro.config.mjs`, a `Layout.astro` fallback). `toNotifyContext` is unchanged —
  it now delegates to this helper internally.

  The emdash scaffold uses it to remove a three-way duplicated `'My EmDash Site'` string:
  `astro.config.mjs`'s favicon `name` and `Layout.astro`'s title fallback both previously
  hardcoded it independently of `site.json`'s `organization.name`. EmDash's own
  `getSiteSettings().title` (set in the admin) still wins at render time when it's set — it's a
  runtime-only fact that can't be read at build time at all — this only replaces the two
  hardcoded _fallback_ strings.

- 2ef2d41: **`resolveOrganizationName()` accepts a plain `import site from './site.json'`.** It was typed
  against the full `Config`, which a JSON import cannot satisfy — TypeScript widens its literals
  (`colors.utilities` becomes `string[]`, not the schema's union) — so every scaffolded site's
  `Layout.astro` failed `astro check`. It now takes `OrganizationNameSource`, the slice it actually
  reads (`organization.name` / `legalName`, `site.defaultLocale`); a resolved `Config` still
  satisfies it, so nothing that compiled before stops compiling.

  **Both templates now typecheck and lint clean on a fresh scaffold**, found by the new `scaffold`
  CI job (it installs each template against this checkout's packed packages):

  - `site.json` declares `neutral` and `surface` as `{ "hue": "ink", "kind": "surface" }`. As bare
    hue strings they were chromatic roles, which emit no bare `bg-neutral` and no
    `text-neutral-muted`, so the template's own footer class resolved to nothing and `vitops lint
    --strict` (run by the template's pre-commit hook) failed. **Existing sites are unaffected** —
    this changes only what a new scaffold starts with; if your own `site.json` has the same two
    lines and uses `text-neutral-*` or `bg-surface*`, change them the same way.
  - The `emdash` template's `index.astro` and `[...slug].astro` cast `page.data.title`, which is
    `unknown` until `emdash types` has run against a live site, so `astro check` passed only after
    the first `pnpm dev`.

  No consumer-facing change in `@getvitops/core`, `@getvitops/generator`, `@getvitops/utils`,
  `@getvitops/cli` or `@getvitops/vite`.

- 80bbef1: Both templates ship `public/_headers` with a no-break security baseline (`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options: SAMEORIGIN`), applied by Workers static assets. No CSP: `<Head />` emits inline scripts, so a policy needs per-site nonces or hashes. Note `_headers` covers static assets only; for the EmDash template's Worker-rendered pages, add headers in the Worker.

## 0.8.0-alpha.0

### Minor Changes

- c3c1bcb: **New: the design-system editor, mounted inside the EmDash admin.** `vitopsEmdash({
  designSystemEditor: { config } })` (`config` is your `site.json`, e.g. `import config from
  './site.json' with { type: 'json' }`) adds a `/design-system` admin page mounting
  `<wc-theme-editor>` — the same live token editor `@getvitops/vite`'s dev server has always
  offered, now usable by the client directly, no dev server required. An edit is visible
  site-wide immediately (a runtime `:root` override, served via a new plugin API route and
  `page:fragments`) and — once `site.deployment.repo`/`branch` and a `VITOPS_GITHUB_TOKEN`
  secret are set (see the scaffold's `SETUP.html`) — auto-commits to your `dev` branch, so it
  reaches the git-tracked `site.json` through your repo's normal review path rather than
  becoming a second, unreviewed source of truth. Until that's configured, the live half still
  works; only the auto-commit half is skipped (and says so in the admin page). The save route
  runs the exact same accessibility (APCA contrast) gate `generate()` enforces at build time,
  synchronously, before persisting — nothing non-compliant ever goes live even momentarily.

  Requires `@astrojs/react` + `react` + `react-dom` (already scaffold dependencies, for
  EmDash's own admin) and `@getvitops/core` (added as a new scaffold dependency this release).
  Declares two new plugin capabilities when enabled: `network:request` (for the GitHub
  auto-commit) and `hooks.page-fragments:register` (for the live override) — reviewed once at
  plugin-install time.

  **Breaking for `@getvitops/emdash`**: `vitopsEmdash()`'s `hooks.page-fragments:register`
  capability is now also granted whenever `designSystemEditor` is set, independent of the
  existing `scripts: 'fragments'` option (which governs something unrelated — web-component
  script delivery). No change if you don't use `designSystemEditor`.

  Also new, supporting the above:
  - `@getvitops/generator`: `validateColorContract()` and `buildReverseIndex()` (both
    `/tokens` subpath, Worker-safe) — the monotonicity/contrast gate and the
    `design-manifest.json` reverse-index, each extracted from `generate()`'s `build()` into
    standalone, non-throwing functions. `patchToOverrideCss()` turns a design-system patch
    into the `:root` override `<style>` block. `designSystemPath`/`getAt`/`setAt`/
    `mergePatch`/`formatConfig` moved from `@getvitops/vite` into `@getvitops/generator/config`
    (re-exported from `@getvitops/vite` unchanged) — one "patch a config file's design-system
    subtree" implementation shared by the dev endpoint and the new plugin route. New
    `site.deployment.repo`/`branch` config fields.
  - `@getvitops/utils`: new `/git` subpath — `commitFile()`, a Worker-safe (fetch-only)
    wrapper over GitHub's Contents API.
  - `@getvitops/core`: `<wc-theme-editor>` gains a `save-endpoint` attribute (default
    unchanged — `/__vitops/design-system`) so the same element can target the new plugin
    route instead of the dev-only Vite endpoint.

### Patch Changes

- 0574388: Add `vitops email setup|check` — connect `site.notifications.email.from` to whether its domain is
  actually onboarded onto an outbound email provider.

  Before this, nothing checked that. `EMAIL.send()` throws `E_SENDER_NOT_VERIFIED` at runtime with no
  build or deploy-time warning — the failure mode is silent and production-only.

  `vitops email setup [domain]` onboards a sending domain (currently Cloudflare Email Sending only)
  and polls DNS until its SPF/DKIM/DMARC records resolve or a timeout is reached; `vitops email
  check` is the non-blocking deploy guard both `@getvitops/create` templates' `deploy`/`deploy:dev`
  scripts now run first (`--strict` makes it a real gate; opt out per-site with
  `site.notifications.email.verifySender: false`, or globally with `--skip` /
  `VITOPS_SKIP_EMAIL_CHECK`).

  Two things worth knowing before running it:
  - **The onboarded entity is an exact name, and it is usually a subdomain**
    (`send.yourdomain.com`), never the apex your `from` address names. When the exact domain isn't
    onboarded but a sibling in the same zone already is, the command reports that as the fix — send
    from the onboarded subdomain — rather than silently trying to onboard the apex, which rewrites
    `_dmarc.<domain>` and can tighten DMARC policy on every other mail your domain sends.
  - Candidates come from `site.notifications.email.from` (or its derived `noreply@<domains
    .canonical>` default) first; a best-effort scan of `--src` only supplements it, and never guesses
    at a computed `from` value.

  New `@getvitops/utils/email` subpath and `site.notifications.email.verifySender` config field.
  Needs `CLOUDFLARE_API_TOKEN` with an Email Sending scope in addition to the `Zone:Read` other
  commands already use.

- 0574388: Bump `emdash`/`@emdash-cms/cloudflare` peers to `>=1.0.0 <2` and `vite-plus` to `^1.0.0`, following
  both projects' GA releases.

  **Breaking for `@getvitops/emdash` consumers on EmDash 0.x**: the peer range no longer admits
  `emdash@0.31.x`/`@emdash-cms/cloudflare@0.31.x`. Upgrade `emdash` and `@emdash-cms/cloudflare` to
  `^1.0.1` first — nothing in `@getvitops/emdash`'s own plugin surface (`admin.portableTextBlocks`,
  the `hooks.page-fragments:register` capability, `definePlugin()`) changed against EmDash 1.0, so no
  code here needed to change, only the declared range.

  The `emdash` scaffold template (`vp create @getvitops:emdash`) picks up several fixes alongside
  the version bump:
  - `tailwindcss`/`@tailwindcss/vite` are now real dependencies — the template selected
    `css.format: 'tailwind'` without installing either, which threw on build.
  - `site.json` now sets `site.icons.sprite: true` plus the full `semantic` list the
    `vitops.actionLink` block's icon picker offers — previously its sprite icons pointed at a file
    the build never generated.
  - `astro.config.mjs` sets `migrations: { runtime: 'check', dev: 'auto' }`, and
    `site-deploy-emdash.yml` runs EmDash 1.0's documented `build → status → apply → deploy → check`
    migration sequence explicitly, rather than relying solely on first-request auto-migration. This
    needs a new GitHub Environment variable, `EMDASH_TARGET_FINGERPRINT` (one per environment),
    which only a human can set — run `emdash migrate --status` against the real deployed database,
    review the printed identity, then `gh variable set EMDASH_TARGET_FINGERPRINT --env <env> --body
    <value>`. Deploys fail clearly on the migration-apply step until it's set.
  - `lint.options.typeAware`/`typeCheck` in the template's own `vite.config.ts` are commented out,
    not deleted: vite-plus 1.0 only honours that option in a project's actual root config, and hard
    errors on it in a nested one (which this file is, sitting inside the `design-system` monorepo).
    Uncomment it once scaffolded into its own repo.

  No config schema changes. `@getvitops/generator` also switches from the `zod/mini` subpath import
  to the standalone `@zod/mini` package (zod 4.5+; same API) and fixes `validateConfig()` silently
  losing the offending key name on an `unrecognized_keys` error (e.g. a typo'd `site.ads` platform
  now names the bad key instead of reporting a bare "Invalid input").

  Also fixed: `vp check`'s `tsconfig-error` for `packages/create/templates/emdash/tsconfig.json`
  (`extends: "astro/tsconfigs/strict"`, unresolvable from inside this monorepo since the template
  has no `node_modules` of its own — a pre-existing, structural gap, newly surfaced as a hard error
  by oxlint 1.85's deeper config discovery, and blocking on every commit since this repo's pre-commit
  hook runs `vp check --fix`). Fixed with a new `scripts/link-template-deps.mjs`, wired as the root
  `postinstall` script: symlinks `astro`/`emdash`/`@emdash-cms/cloudflare` into the template's own
  `node_modules/` (resolved fresh from sibling packages that already depend on them for real, not a
  hardcoded `.pnpm` hash) and writes a minimal `astro:content` ambient shim at `.astro/types.d.ts`
  (the same path `astro sync` would generate for real). Both are gitignored and only ever exist
  inside this monorepo's copy of the template — a real scaffold installs its own real copies instead.
  Considered and rejected first: inlining astro's strict preset (drift risk against astro's own
  evolving default) and making the template a real pnpm workspace member (would change how its
  `@getvitops/*: "latest"` deps resolve locally, which `templates.test.ts` exists to protect).

  **Known gap, not fixed here**: `packages/astro/src/components/container.test.ts` (the
  `AstroContainer`-based render tests) fails to even load under vite-plus 1.0's Vite 8 — direct
  `.astro` imports in a Vitest file need the Astro Vite plugin registered, which nothing in this
  repo's test config actually does (Astro's own docs call for `getViteConfig()`, which doesn't
  compose with vite-plus's own `defineConfig`). A type-level shim
  (`packages/astro/src/components/astro-modules.d.ts`) fixes `vp check`'s type-aware pass, but the
  runtime `vp test` failure for this one file is still open.

- 0f8c018: **New: `resolveOrganizationName(config, locale?)`**, exported from `@getvitops/astro/routes`
  alongside `toNotifyContext`/`toCrmConfig` — the same `organization.name` → `legalName` →
  `undefined` fallback chain `toNotifyContext` already used for its `organizationName` field,
  now usable standalone anywhere a build-time-only display name is needed (favicon generation,
  a scaffold's `astro.config.mjs`, a `Layout.astro` fallback). `toNotifyContext` is unchanged —
  it now delegates to this helper internally.

  The emdash scaffold uses it to remove a three-way duplicated `'My EmDash Site'` string:
  `astro.config.mjs`'s favicon `name` and `Layout.astro`'s title fallback both previously
  hardcoded it independently of `site.json`'s `organization.name`. EmDash's own
  `getSiteSettings().title` (set in the admin) still wins at render time when it's set — it's a
  runtime-only fact that can't be read at build time at all — this only replaces the two
  hardcoded _fallback_ strings.

## 0.7.0

### Minor Changes

- **Breaking (for scaffolds) — both templates now ship `site.json` instead of `design-system.json`.**

  `design-system.json` is deleted from the `static` and `emdash` templates; its contents move under
  `designSystem.themes.default` inside a new `site.json` (the umbrella `Config`), because a
  scaffolded config can't merely reference a sibling design-system file — `ConfigSchema` requires
  `designSystem` and there is no file-level `extends`. `astro.config.mjs`'s `css.input` (and
  `site.input`, for emdash) now point at `site.json`; so do the `build:css`/`lint:design` scripts.

  **Migration** for a project already scaffolded from an older version of this template: create
  `site.json` with your existing `design-system.json`'s content under
  `designSystem.themes.default`, delete `design-system.json`, and update `css.input`/`site.input` in
  `astro.config.mjs`. Not reachable by `vitops lint --fix` — this is the whole migration.

  Also new in both templates:
  - **`SETUP.html`** — a client-onboarding checklist (styled entirely with the framework's own
    classes, checkbox state in `localStorage`), generated a stylesheet for via the new
    `pnpm run sop` script.
  - **`.agents/skills/setup/SKILL.md`** — lets an AI agent work the same checklist autonomously,
    stopping only at the steps that genuinely need a human (the Cloudflare API token, the
    domain cutover, publishing generated legal documents).
  - `scripts/init-github.mjs` and `scripts/init-hosting.mjs` are deleted; `pnpm run init:github` /
    `init:hosting` / the new `setup` script now call `vitops setup repo` / `vitops setup hosting`
    (from `@getvitops/cli`, requires the `minor` release in the same batch as this one) instead of
    a template-local script, so the same capability now reaches any existing project, not just a
    fresh scaffold.

## 0.6.0

### Minor Changes

- Scaffolded `static` and `emdash` projects now ship neutral placeholder wireframe images under
  `src/assets/placeholder/` (square, portrait, landscape; SVG + PNG) for layout work before real
  imagery exists. Delete the directory once real assets land.

## 0.5.0

### Minor Changes

- **The framework now says out loud which patterns are foundational, and reports it when you
  reach past them.** From repeated downstream reports: sites were inventing a `.wrap` class and
  using it everywhere instead of `.centered`, and `.subgrid` — the class for any set of cards —
  was going essentially unused. Neither failure is visible in a build: every class involved is
  real, nothing errors, and the page renders.

  **`.subgrid` was missing from the generated class reference entirely.** So was `.cluster`, and
  so was `.region`. `vitops docs classes` is the doc an agent is told to fetch for "which class
  do I apply", and the framework's answer for a set of cards was not in it — which is most of why
  it never got used. All three are now documented, along with `grid-auto`, and the reference opens
  with a **Foundations** section that states the six substitutions as
  _temptation → what to write instead_ rather than as a vocabulary list. The same table is now in
  the shipped agent skill and in the `@getvitops/create` template's `AGENTS.md`, because a pointer
  to a doc only helps someone who already suspects there is something to look up. (`css`/`bricks`
  and `tailwind` alike — this is documentation and the `TIERS` manifest, not emitted CSS.)

  **`vitops lint` gained three reuse rules and a markup pass.** The existing `.centered` rule only
  fired when the hand-written CSS already referenced `--width-measure`, which is precisely the
  author who was never going to hand-roll a container. It now also catches a page-scale
  `max-width` (≥ 48rem, or a `ch` reading measure) with auto margins, and a
  container-shaped class name — `wrap`, `wrapper`, `container`, `inner`, `shell`, … — carrying any
  width cap at all. Reading the cap out of `min()` / `clamp()` too. New rules report a
  hand-written `repeat()` grid as `.subgrid` (or `.grid-auto`), and a new **markup** pass reports a
  repeated card set laid out without either — a loop that renders a card, or three or more cards
  written out. That last one is the only check that can see this drift at all, since a card list
  built from utility classes contains no bad class and no hand-written CSS.

  All of these are `suggestion` severity, so they do not fail your build unless you pass
  `--strict`. They found five real instances in this repo's own docs site.

  **`vitops lint [files...]`** now takes explicit paths instead of scanning `--src`, so it can be
  wired into a pre-commit hook — `vp`'s `staged` key appends the staged files to whatever it runs,
  and a command that refused positionals could not be put in the one place the feedback lands at
  the moment the code is written. Unreadable and non-source paths are skipped rather than fatal. The
  `@getvitops/create` emdash template wires it up with `--strict` and adds a `lint:design` script.

  **Two answers for "the whole card is a link", because one cannot exist.** Reported downstream:
  agents dislike the `<li>` wrapper when a card is a link and write `<li><a class="card">` instead.
  That shape is **wrong in a way that renders fine**, which is why it survives review — the `<li>`
  is the grid item, so the anchor is an ordinary block inside it and the tranches within the anchor
  never reach the parent's shared row lines. The alignment `.subgrid` exists for silently does not
  happen, and the anchor does not fill the cell either. Putting the anchor in the grid's place
  (`<ul><a></ul>`) is invalid HTML, so there was genuinely no correct shape to reach for.

  There are now two, and they trade against each other because **no CSS-only technique can make a
  whole card clickable and leave its text selectable** — a transparent overlay necessarily receives
  the pointer-drag:

  | Want                                     | Use                                         |
  | ---------------------------------------- | ------------------------------------------- |
  | zero JS, whole card clickable            | `.stretched-link` — **text not selectable** |
  | selectable text **and** a clickable card | `<Cards>` / `<wc-cards>` — needs JS         |

  `.stretched-link` goes on a link inside the card; its `::after` covers the card.
  **`<wc-cards>` is a new tier-2 element** that adds no overlay and instead tells a click apart from
  the end of a drag, so text selection survives. Its fallback is the card's own link, fully usable
  with no JS, and the pointer cursor is applied by the element — so the affordance never appears
  without the behaviour. `<Cards>` emits it for you. They are alternatives, never layered: with an
  overlay present the JS has nothing to do, and `vitops lint` reports the combination. (All formats
  — pattern partials, deliberately not `utilities.css`, which the tailwind format skips on the
  invariant that everything left in it is a name Tailwind ships itself.)

  ### Breaking
  - **`<Subgrid />` renders its slot verbatim — author the `<li>` items yourself.**

    ```diff
      <Subgrid>
    -   <article class="card">…</article>
    +   <li class="card subgrid-card">…</li>
      </Subgrid>
    ```

    It used to parse the slotted HTML and rebuild each child as an `<li>`, carrying over only
    `class` and `style`. That existed solely because a `<ul>` may contain nothing else, and it cost
    more than it bought: the child's tag was discarded, `id`/`data-*`/`aria-*` were silently
    dropped, and `href` could not survive at all. Nothing is copied now, so nothing is lost. `as`
    picks the container (`ul` by default, `ol`, `div`), and all other props are forwarded — they
    were previously discarded, including `role`.

  - **`<Subgrid />` and `<Tree />` now emit `role="list"`,** as does the Bricks `sitenav` element.
    `list-style: none` stops Safari + VoiceOver announcing a `<ul>` as a list, so every marker-less
    framework list was silently losing the semantics its `<ul>` was chosen for. If you hand-write
    `.subgrid`, `.list`, `.facet-list`, `.nav-items`, `.collapse-menu` or `.tree` markup, add
    `role="list"` yourself — the framework cannot add it to markup it does not render, and each
    partial now says so at the `list-style` reset.
  - **`<Cards />` no longer adds `class="card"` to slotted children,** because it no longer parses
    them. Write the class on the item. It now emits `<wc-cards>` around a `<Subgrid>`, which is what
    makes the whole card clickable — and like `<Tree />`, **it emits its own element, so do not wrap
    it in `<wc-cards>` yourself.** It also previously passed a `role="list"` that `<Subgrid>` silently
    discarded, so that never took effect.
  - **`.subgrid-card` now sets `position: relative`**, so `stretched-link` inside it needs no extra
    class. If you were absolutely positioning a descendant of a `.subgrid-card` against an ancestor
    _outside_ that card, it will now resolve against the card. Move the positioning context
    explicitly. (`css`/`bricks`/`tailwind` — the pattern partial is inlined into all three.) Not
    reachable by `vitops lint --fix`: the fix depends on which ancestor you meant, which the
    linter cannot know.

  ### Fixed
  - **`packages/generator/src/docs.ts` contained a literal NUL byte** (`CODE_SLOT`, written as the
    raw character rather than an escape). libmagic classified the file as `data` rather than text, so
    grep and ripgrep treated the largest doc emitter in the repo as **binary and silently skipped
    it** — every search for a string in it returned nothing, with no error. It is now written as the `\u0000` escape.
    Behaviour is identical; the file is searchable.
  - **`.grid-auto` is documented.** It was a real framework class for auto-fit card grids with no
    entry in the class reference, so the honest alternative to `subgrid` was as invisible as
    `subgrid` itself.
  - **`.raised` replaces the advice to use `.relative` above a `stretched-link` overlay**, which
    could not work: a positioned element at `z-index: auto` does not rise above an explicit
    `z-index` regardless of DOM order, so a second link or button in the card stayed underneath and
    unclickable. `.raised` sets both, against the same `--z-tier-raised` token the overlay now uses
    instead of a hard-coded `1`.

## 0.4.0

### Minor Changes

- bf453b0: Scaffolded projects now track the current toolchain instead of a version frozen at authoring time.

  The emdash template pinned `@getvitops/astro: ^0.7.0`, `@getvitops/cli: ^0.4.0` and
  `@getvitops/emdash: ^0.2.1` — ranges that were right when written and then quietly weren't. Anyone
  running `vp create @getvitops:emdash` through the whole 1.0 release got a project a full major
  behind, which looks like a working scaffold and isn't. Every `@getvitops/*` dependency is now
  `latest`, which is the correct answer here precisely because these packages move in lockstep: a
  scaffold wants the set that was released together, not whichever versions someone last remembered
  to type.

  **Also fixed: `vite` and `vite-plus` were `catalog:`.** That is a pnpm protocol which only resolves
  inside this monorepo, and the publish-time rewrite that handles it for a package's own dependencies
  does not reach inside `templates/**` — those ship as verbatim data. So the scaffold succeeded and
  the first `install` in it failed on an unresolvable specifier. Both now say `latest`.

  A test over every template's `package.json` now rejects `workspace:`/`catalog:` specifiers and
  requires `@getvitops/*` deps to be `latest`, so neither can come back silently.

## 0.3.4

### Patch Changes

- bb92a14: Update the `emdash` template for the target-prefixed colour grammar.

  The template's `design-system.json` and layout referenced tokens the generator no longer
  emits — `--surface-bg`, `--surface-bg-muted`, `--neutral-border` — so a freshly scaffolded
  project rendered a transparent card on a borderless footer. They now read
  `--color-bg-surface-muted`, `--color-bg-surface-x-muted` and `--color-border-neutral`, and
  `colors.utilities` picks up the new `icon` tier.

  Existing scaffolds are unaffected until you upgrade `@getvitops/*`; when you do, the
  [colour grammar migration table](https://www.npmjs.com/package/@getvitops/generator) applies
  to your own `design-system.json` the same way.

- bb92a14: Docs: import the Astro integration as `vitops`, and document the fourth output format.

  Every example now reads `import vitops from '@getvitops/astro'` and calls `vitops({ … })`,
  including the scaffolded `emdash` template. The default export is unchanged, so this is a
  naming convention in the docs rather than an API change — existing configs that bind it as
  `getvitops` keep working.

  The `@getvitops/generator` and `@getvitops/cli` docs also describe the `design` format, which
  was shipped without a mention in either package's output table: `--format design` writes a
  single `DESIGN.md` and no CSS, so a run that composes it with a stylesheet wants its own
  `--out` (the brief conventionally sits at a repo root, the stylesheet does not).

## 0.3.3

### Patch Changes

- **Fixed: `vitops init` and `vp create` scaffolded configs referencing tokens that no longer
  exist.** `defaultConfig()` and the EmDash template still pointed at `--color-surface-xl` and
  `--color-surface-xxl`, aliases from the named-step colour scale removed in 0.6. A scaffolded
  project therefore got a `card` with no background and an invalid default border colour, with
  nothing reporting it. Both now use `--surface-bg` / `--surface-bg-muted`. The EmDash template
  also dropped its `patterns.radii.card` key, which collided with the `card` pattern on
  `--br-card` — the collision `validate()` has been warning about (the `panel` group already
  supplies the same radius, so nothing changes visually).

  **Fixed: `.text-reveal` rendered invisible text.** Its gradient consumed
  `--text-reveal-color-from`/`-to` with no defaults, so unless a consumer set both, the `var()`
  substitution failed, `background` became invalid at computed-value time, and the accompanying
  `color: transparent` left the text with no way to render. Both tones now default to the
  functional text tokens.

  **Fixed: `.bordered` fell back to `currentColor`** via a reference to `--color-surface-xl`,
  which the generator never emitted. It now resolves `--surface-border`.

  **New: `validate()` warns when a required role is missing.** `colors.roles` is an open map —
  any name works and generates a full token set — but the shipped component CSS references
  `brand-primary`, `danger`, `neutral`, `surface`, `ui-primary` and `warning` with no fallback,
  so omitting one leaves those components uncoloured. This is a warning, not an error; the
  required list is re-derived from the CSS partials by a test so it cannot drift.

  `vitops docs` and `vitops agents` now surface config warnings (on stderr, so piping `docs` is
  unaffected). They previously discarded them, unlike `generate` and `validate`.

  Docs corrections, all in the generated bundle:
  - **Raw scale classes are frozen and do not remap in dark mode** — stated explicitly for the
    first time, with a migration table to the role equivalents. The dark-mode guarantee only ever
    applied to functional role tokens, and nothing said so.
  - **Roles are extensible over a required core** — the schema description and class reference
    read as a closed enumeration, which is why a consumer forked their own colour layer rather
    than adding a role.
  - **The `md:` / `@md:` / `md-` distinction** in the tailwind format: `@md:` uses the framework's
    breakpoints, `md:` works but uses Tailwind's (which differ — `sm:` is 40rem, `@sm:` is 30rem),
    and `md-` is silently inert. Plus a note that registering `--container-*` also re-points
    Tailwind's `max-w-*` scale.
  - The css and bricks bundles now carry a `/*!` banner pointing at `npx vitops docs classes`
    (the previous plain comment was stripped by the minifier, so it never reached the file).

  Contrast checking now covers **every** background plane a role emits (`bg`, `bg-muted`, and
  `bg-bold`), not just `bg` — body text on a `card` was previously unguaranteed.

## 0.3.2

### Patch Changes

- a334049: Make the semantic icon mapping reachable, and fail the build on unresolvable names.

  `generateIconInclude()` — declare the semantic icon names a site needs plus which sets to draw
  them from, get back the `include` map that keeps the bundle to just those glyphs — already existed
  but was unreachable: it lived in `@getvitops/core/src/utils/`, which the package doesn't export.
  It has moved to `@getvitops/utils` (a build-time concern, in the build-time utilities package),
  which `@getvitops/astro` re-exports wholesale. So from `astro.config.mjs`:

  ```js
  import { generateIconInclude } from '@getvitops/astro';
  import icon from 'astro-icon';

  integrations: [
    icon({
      include: generateIconInclude({
        ui: 'fa7-solid',
        brand: 'simple-icons',
        semantic: ['menu', 'close', 'search', 'github'],
      }),
    }),
  ];
  // → { "fa7-solid": ["bars","xmark","magnifying-glass"], "simple-icons": ["github"] }
  ```

  Swapping `ui` to `'lucide'` yields `{ lucide: ["menu","x","search"] }` from the same declaration —
  which is the point: the semantic names are what your markup commits to, and the set is a config
  choice. The output shape is the `include` both `astro-icon` and `astro-iconset` accept, so the
  mapping doesn't tie you to either.

  **Unresolvable names are now a build error.** Previously they were skipped silently, so swapping
  sets appeared to succeed and the gaps surfaced as missing glyphs in production. The error names
  every offender; an unknown set name throws too, listing the known sets.

  Also fixes `@getvitops/create`'s emdash template, which pinned `@getvitops/astro: ^0.4.0` — a range
  that stopped resolving when astro joined the fixed group at 0.7.0, so scaffolded projects were
  stuck on the old line.

## 0.3.1

### Patch Changes

- 44de07f: Shared toolchain version + changelogs that reach consumers.
  - **`@getvitops/astro` now shares the toolchain version** (`core`/`generator`/`utils`/`cli`/`vite`),
    so it moves from its own `0.4.x` line onto the group's. The number changes; the package does not —
    install it at the same version as `@getvitops/cli`. It was already being bumped on every toolchain
    release by its dependency updates, and it depends on core, generator, utils _and_ vite, so a
    separate version line cost the same churn while leaving the compatible pairing implicit. The
    lockstep is load-bearing: the generator ships a snapshot of core's CSS + web-component bundles
    while the Astro integration copies the _installed_ core's bundles, so mismatched versions can leave
    the CSS and the components disagreeing.

  - **Every package now ships its `CHANGELOG.md` in the published tarball.** npm does not include
    changelogs by default, so none of this history previously reached anyone who installed the
    packages. Per-package history now reads from `node_modules/@getvitops/<pkg>/CHANGELOG.md`;
    curated toolchain-level release notes live in the repo's root `CHANGELOG.md`.

## 0.3.0

### Minor Changes

- emdash template: hosting is now a configurable seam — astro.config resolves
  adapter + database/storage via `vitopsHosting()` from `@getvitops/emdash`
  (^0.2.0), documented in the new README "Hosting" section. New
  `pnpm run init:hosting` provisions the platform: on cloudflare it creates the
  isolated dev D1 + R2 via wrangler and sets the `DEV_D1_ID` /
  `CLOUDFLARE_ACCOUNT_ID` repo secrets via `gh` (idempotent, `--dry-run`;
  `--target node` prints the Node-host switch steps). Also preconfigures
  permission allows for the Astro/EmDash docs MCP tools in `.claude/settings.json`.

## 0.2.0

### Minor Changes

- emdash template: `pnpm run init:github` — one-time GitHub bootstrap via the
  `gh` CLI. Creates a repo named after the project, makes the initial commit if
  needed, pushes `main` + `dev`, sets `dev` as the default branch, and prints
  the remaining manual steps (dev D1/R2, secrets, branch protection).
  Idempotent, with `--dry-run` and `--public` flags.

## 0.1.0

### Minor Changes

- New `@getvitops/create` package: `vp create` org templates for the Vitops
  design system. First template: `emdash` — an EmDash CMS website on Cloudflare
  Workers (D1 + R2) with `@getvitops/astro` (design-system CSS, favicons,
  web-component runtime), `@getvitops/emdash` (editor blocks), and
  `@getvitops/cli` pre-wired, plus a seed with a `pages` collection, menus, and
  starter content — home, about, terms, privacy, 404 (published via the setup
  wizard's "include sample content" option). Ships a dev → main promotion flow
  (auto-deploying `dev`/`main` workflows, a manual promote workflow + matching
  `promote` agent skill, and an isolated dev worker config), the Astro + EmDash
  docs MCP servers in `.mcp.json`, and a Claude Code web hook that provisions
  Node 24 + pnpm. Scaffold with `vp create @getvitops:emdash`.
