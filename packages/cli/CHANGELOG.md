# @getvitops/cli

## 8.3.0-alpha.5

### Minor Changes

- 6b5ea17: **Leaner scaffolded `AGENTS.md`, and skills named by scope.** The EmDash template's `AGENTS.md` went from 212 to about 70 lines and the static one from 141 to about 50: only always-true rules stay (source of truth, generated CSS, branches, `vp`/`vpr`, where to look), and task-specific guidance moved into skills loaded when the task matches.

  - **Breaking, `@getvitops/skills`: skills are renamed by scope.** `custom-blocks` → `emdash-custom-blocks`, `content-and-deploys` → `emdash-content-and-deploys`, `contact-form` → `emdash-contact-form`, `csp` → `vitops-csp`, `see-the-page` → `vitops-see-the-page`, `ads` → `vitops-ads`. `emdash-*` skills only apply to an EmDash site; `vitops-*` apply anywhere, and both prefixes are reserved for toolkit skills. New: `emdash-building-pages` (blocks, nesting, page opener, widget areas, escape hatches, layout primitives, `site.chrome`) and `vitops-consent` (split out of `vitops-design-system`, whose description and body now cover styling and tokens only). Existing sites: run `vp install` so `skills experimental_sync` relinks, and replace the per-skill `.agents/skills/<name>` / `.claude/skills/<name>` lines in `.gitignore` with `.agents/skills/vitops-*`, `.agents/skills/emdash-*` and the same two under `.claude/skills/`. A site's own skill must not use those prefixes.
  - **`vitops agents sync`:** the block lists only skills that apply (a project without `emdash` in its dependencies gets no `emdash-*` ones, and they are not linked), summaries are cut at a clause rather than with an ellipsis, the pointer says `vp exec vitops docs`, and the version stamp is gone so the file no longer changes on every CLI bump.
  - **`@getvitops/create`:** both templates ship the trimmed `AGENTS.md`; the project-naming steps moved into the `setup` skill and EmDash 1.x behaviours, legal-page replacement and the audit prerequisites into `emdash-content-and-deploys`. Existing sites: nothing to change beyond the skill rename; delete the sections you no longer need.

- bb61a35: **Call tracking numbers: show an ad visitor a number that attributes the phone call.** Two additive config blocks, no CSS, no breaking change — all formats unaffected.

  - **`site.ads.google.callTracking`** — Google Ads _website call conversions_. `{ label, number, cache? }` makes the consent-gated Google tag fetch a Google forwarding number (Canada supported) and swap it in for visitors who arrived from a Google ad. Google replaces text only, so the capture script also rewrites the matching `tel:` href. Needs `pixelId` and `site.tracking.enabled`; rejected on any other platform (only Google can put a number on the website — Microsoft's exist only inside the ad, in the US/UK/AU).
  - **`site.tracking.phoneNumbers`** — per-platform numbers for every other platform: the real `number`, `sources` keyed by `site.ads` platform (plus `default-paid`), and an informational `provider`. You provision the numbers with a call-tracking service (Twilio, CallRail, …). The landing URL decides first, then the `_ac` cookie, so a visitor who declines `marketing` sees a tracking number on the landing page only. An organic visitor is never swapped, and the server-rendered HTML always carries the real number.
  - The `tel:` tap beacon now carries which number was shown (`phoneSource`), and the conversion notification says so.
  - `vitops ads lint` flags a call-tracking provider that is not in `site.legal.privacyPolicy.processors`, and notes that `callTracking` plus `conversionLabel.call` can count one call twice (make one secondary in Google Ads).
  - `@getvitops/utils/tracking` exports the pure `selectPhoneNumber()` and helpers; the capture script mirrors it and `tracking.test.ts` pins the two.
  - `@getvitops/skills` gains a **`vitops-ads`** skill (overview plus a `call-tracking.md` topic). The templates gitignore synced skills by prefix (`vitops-*`, `emdash-*`), so it needs no `.gitignore` line of its own.

  `@getvitops/core`, `@getvitops/vite` and `@getvitops/emdash` — no consumer-facing change in these packages.

### Patch Changes

- Updated dependencies [785b8b3]
- Updated dependencies [bb61a35]
- Updated dependencies [4d94c8b]
  - @getvitops/utils@8.3.0-alpha.5
  - @getvitops/generator@8.3.0-alpha.5

## 8.3.0-alpha.4

### Minor Changes

- 322dd6a: Tooling fixes from the vitops.ca build (findings 14, 23, 24, 25).

  - **`vitops emdash form-template --from <seed.json | export.json> [--name contact] [--site site.json] [--dry]`** copies a `vitops_form` block into `site.templates` with the renderer's own field resolver, so the generated privacy policy and `check-prerender` know what the form collects. A re-run is a no-op, and the result is validated before it is written.
  - `site.templates` form fields accept `checkboxes` (the block's spelling), and the template union now discriminates on `type`, so a bad entry is reported at its path instead of as a bare "Invalid input".
  - **`prepare-db` fails fast and says why.** It validates `site.json` before starting the dev server, writes the server's output to `.vitops/prepare-db.log`, stops waiting as soon as the log shows an error, and prints the log's tail on failure, instead of waiting out a five-minute timeout with nothing to read.
  - **`check-prerender`** skips the toolkit's own assets under `vitops/` (no more "0 h1" for the theme-editor page) and warns when the sitemap lists URLs the build produced no page for (a collection with no `urlPattern` is listed as `/<collection>/<slug>` while the site serves `/<slug>`).
  - The emdash template ignores the duplicate `pnpm-@getvitops+skills-*` links `skills experimental_sync` leaves beside each skill; the `content-and-deploys` skill explains the sitemap warning.

### Patch Changes

- Updated dependencies [99e66a2]
- Updated dependencies [00a9d86]
- Updated dependencies [d64fb20]
- Updated dependencies [322dd6a]
- Updated dependencies [322dd6a]
  - @getvitops/generator@8.3.0-alpha.4
  - @getvitops/utils@8.3.0-alpha.4

## 8.3.0-alpha.3

### Minor Changes

- 8543f73: `vitops agents` (also `vitops agents sync`) now keeps a short fenced block at the **top** of `AGENTS.md` instead of appending a long one. The block names the config, says to prefer the framework's classes, and links the skills linked under `.agents/skills` from installed `@getvitops/*` packages (with a one-line "use when …" from each), plus `vitops docs <topic>` for reference; the generate-command list and the topic list are gone. A later run replaces only that block in place and leaves the rest of the file alone; with no block, it is added at the top; a block from an older release is updated where it is. The command also links every skill an installed `@getvitops/skills` ships, so it works without the `skills` CLI. The templates run it from `prepare` and ship the block already in `AGENTS.md`.

### Patch Changes

- @getvitops/generator@8.3.0-alpha.3
- @getvitops/utils@8.3.0-alpha.3

## 8.3.0-alpha.2

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

- Updated dependencies [0a47856]
- Updated dependencies [0a47856]
  - @getvitops/generator@8.3.0-alpha.2
  - @getvitops/utils@8.3.0-alpha.2

## 8.3.0-alpha.1

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

### Patch Changes

- Updated dependencies [24c568b]
  - @getvitops/generator@8.3.0-alpha.1
  - @getvitops/utils@8.3.0-alpha.1

## 8.3.0-alpha.0

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

- b47df4d: **Added: `vitops audit` — Lighthouse + axe budgets over a built site.** Non-breaking, opt-in.

  `vitops audit [--build] [--url <base>] [--pages /a,/b] [--warn] [--out <dir>]` serves the existing build with `astro preview` on a dedicated port (4398; it aborts rather than attach to something else already there), audits `/` plus `/privacy`, `/terms`, `/cookies`, `/contact` and every link in `seed/seed.json`'s `primary*`/`footer*` menus, and skips any route that 404s (a 404 on `/` fails the run). Per page it runs axe (tags wcag2a, wcag2aa, wcag21a, wcag21aa) and Lighthouse on the same Chromium. Default budgets: LCP < 2500 ms, CLS < 0.1, TBT < 200 ms (the INP proxy), no serious or critical axe violations; override with `--lcp`, `--cls`, `--tbt`, `--impact`. Writes `report.json`, `report.md` and `pages/<page>.{json,md}` to `.vitops/audit/`; exits non-zero on failure unless `--warn`. Every report states that a pass is **not** AODA certification and lists the manual checks.

  `playwright`, `@axe-core/playwright` and `lighthouse` are **optional peer dependencies** of `@getvitops/utils`, loaded lazily — nothing is installed or loaded unless you run the command, and a missing one fails with the install command. Pure planner and report rendering are `@getvitops/utils/audit` (new subpath).

  CI: the reusable `site-ci.yml` gains opt-in `run-audit` (default `false`) and `audit-args` inputs; callers pinned to `@v1` that pass neither are unaffected.

### Patch Changes

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

- Updated dependencies [93d2067]
- Updated dependencies [161c7f3]
- Updated dependencies [175d16e]
- Updated dependencies [83d6f3c]
- Updated dependencies [892b204]
- Updated dependencies [06d6112]
- Updated dependencies [6297337]
- Updated dependencies [55061e2]
- Updated dependencies [b47df4d]
  - @getvitops/generator@8.3.0-alpha.0
  - @getvitops/utils@8.3.0-alpha.0

## 8.2.0

### Minor Changes

- 0574388: Add `site.crm` — push form submissions into HubSpot, Zoho Bigin, or Jobber.

  Client sites need form submissions to land in the client's CRM. The options available before this
  — a HubSpot/Bigin/Jobber iframe or JS embed — fail on three counts: the markup can't be
  white-labelled against this design system, nothing can operate on the submission before it leaves
  the page, and the submission never touched `createConversionRoute()`, so `_ac` ad-click attribution
  was lost and no conversion notification was planned.

  This adds one server-side path for all three CRMs, hung off the conversion route that already
  exists. `createConversionRoute()` gets a new `crm` option (`{ config, credentials, fetch?,
  timeoutMs? }`); credentials arrive as a function of `locals`, exactly like the existing `binding`
  option, and are never config. A failed CRM write never fails the request and is folded into the
  notification email's new "Delivery" section, so a broken CRM token is never silent.

  New `@getvitops/utils/crm` subpath: `deliverToCrm()`, `mapSubmission()`, `deriveLastName()` (Bigin
  requires a last name; this derives one from an explicit field, a full name, or an email address,
  refusing rather than fabricating one), `submitToHubSpot()`, `submitToBigin()`, `submitToJobber()`.
  `identifySubmitter()` was promoted out of `notify`'s private name-guessing cascade into
  `@getvitops/utils/tracking`, since the CRM mapper needed the whole identity (first/last name,
  email, phone, company), not just a display name.

  Jobber is GraphQL, not REST, and answers `200 OK` for failures — a rejected `clientCreate` returns
  `userErrors[]`, a malformed request returns top-level `errors[]`. `submitToJobber()` classifies on
  the response body, not just the status. Its refresh tokens also rotate by default: **Refresh Token
  Rotation must be turned off** in the app's Developer Center settings, since a Worker reading a
  static `VITOPS_JOBBER_REFRESH_TOKEN` cannot persist a rotated one — a rotated token is detected at
  exchange time and reported with the fix, rather than surfacing an hour later as an opaque 401.
  Attribution and unmapped extra fields render into a best-effort note by default (works on every
  Jobber plan); a resubmitting visitor creates a second Jobber client unless `crm.jobber.dedupe: true`
  is set once its lookup query has been verified against a live account (defaults `false` pending
  that verification — see `jobber.ts`'s docblock).

  New `site.crm` config block (`provider`, `hubspot`/`bigin`/`jobber`, `fieldMap`, `trackingFields`)
  and two CLI commands: `vitops crm check` (fetches the live HubSpot property list or Bigin field
  list and reports every mapped name that doesn't exist there — HubSpot rejects an unknown field
  outright, Bigin silently drops it; Jobber has nothing live to check yet, since its mapped values
  currently render as note text) and `vitops crm setup` (creates missing HubSpot properties; Bigin
  and Jobber have no such API, so both always print a manual reminder).

  The generated privacy policy now names HubSpot, Zoho Bigin, or Jobber when `site.crm` configures
  one. Bigin gets the same cross-border-transfer derivation Matomo Cloud already gets: a
  `dataCenter: 'ca'` asserts no transfer outside Canada, any other data centre does. Jobber's
  operator (Octopusapp Inc. d/b/a Jobber) is Canadian, but its own privacy policy names the United
  States as a processing location too, so the policy always asserts a cross-border transfer for
  Jobber regardless of config — a Canadian operator is not read as Canadian-only storage.

  Credentials: `VITOPS_HUBSPOT_ACCESS_TOKEN` for HubSpot; `VITOPS_ZOHO_CLIENT_ID` /
  `VITOPS_ZOHO_CLIENT_SECRET` / `VITOPS_ZOHO_REFRESH_TOKEN` for Bigin; `VITOPS_JOBBER_CLIENT_ID` /
  `VITOPS_JOBBER_CLIENT_SECRET` / `VITOPS_JOBBER_REFRESH_TOKEN` for Jobber. Never config.

  No consumer-facing change in `@getvitops/astro` beyond the new `crm` route option and a build
  warning when `site.crm` is configured with no route answering `TRACKING_ENDPOINT` — CSS/Bricks/
  tailwind outputs are unaffected.

- b3d9c07: `vitops docs blocks` prints every EmDash block type and its fields, so an agent can write valid Portable Text without reading the plugin source. It reads `@getvitops/emdash` from the project (and says so if it isn't installed); `@getvitops/emdash` exports `renderBlocksDoc()` for it.
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

- 8d8aad7: **New: server-side Google Ads offline conversion upload.** Set
  `site.ads.google.reporting: "server"` and a matching
  `conversionActionId` (a numeric id or full
  `customers/…/conversionActions/…` resource name — **not** the same value
  as `conversionLabel`, which is the opaque label the web tag uses and
  which the Ads API's upload endpoint doesn't accept) and
  `createConversionRoute`'s new `googleAdsOffline` option uploads the
  conversion via `ConversionUploadService.UploadClickConversions` instead
  of relying on the visitor's browser to fire `gtag.js`. An action with no
  matching `conversionActionId` keeps firing client-side regardless of
  `reporting`, so turning it on before the id is filled in never silently
  drops a conversion. `@getvitops/astro/routes` exports a matching
  `toGoogleAdsConfig(config)` adapter, alongside `toCrmConfig`.

  Structurally typed against Google's documented REST shape, not verified
  against a live Ads account — no developer-token/MCC access exists
  anywhere in this toolchain's own setup to test against. Wrapped so a
  wrong guess degrades to a stated failure reason (folded into the
  conversion email's "Delivery" section, same as a failed CRM write) rather
  than breaking, the same caveat `@getvitops/utils/crm`'s Jobber executor
  already carries for its own unverified surfaces.

  `vitops ads lint` now flags a `reporting: "server"` property whose
  configured actions have no matching `conversionActionId` — not a
  failure, since that action keeps firing client-side, but worth surfacing
  rather than leaving someone to wonder why nothing changed.

  Not built: `vitops ads provision` (upserting conversion actions via
  `ConversionActionService` and printing back both the label and the
  resource id) — same credential blocker, and deliberately left unscoped
  until there's a live account to verify the request/response shape
  against.

### Patch Changes

- 89265af: **New package: `@getvitops/config`** — the site-config provider blocks (`site.crm`, `site.ads`,
  `site.reviews`, `site.seo.indexing`, `site.searchConsole`, `site.notifications`, `site.tracking`,
  `site.security`, `site.deployment`) as zod schemas and inferred types, with the closed provider lists
  (`AD_PROVIDERS`, `CRM_PROVIDERS`, `BIGIN_DATA_CENTERS`) on a zod-free `./providers` entry. It joins the
  `fixed` group.

  Why: `@getvitops/utils` holds the provider code but could not import its configuration types — the schema
  lived in `@getvitops/generator`, a layer above — so it kept a hand-copied mirror beside each module,
  an adapter converting into it, and a test holding the copy to the schema. The mirrors are gone.

  - **`@getvitops/generator`**: `AD_PROVIDERS`, `CRM_PROVIDERS`, `BIGIN_DATA_CENTERS`, `AdProvider` and
    `CrmProviderConfig` are re-exported unchanged. No import path changes.
  - **`@getvitops/utils`**: the config types in `./crm`, `./ads`, `./indexing`, `./onboarding`, `./reviews`,
    `./tracking` and `./notify` (`CrmConfig`, `HubSpotConfig`, `BiginConfig`, `JobberConfig`,
    `IndexNowConfig`, `SearchConsoleConfig`, `ReviewsConfig`, `ReviewLocationConfig`, `TrackingConfig`,
    `NotificationsConfig`, `EmailChannelConfig`, `DomainSetup`, `AdPropertySetup`) are now inferred from the
    schema. Same names, same fields, but **optional fields now follow zod's inference**, so a hand-written
    object literal typed against them may need `| undefined` handled. `AdPropertySetup` gains the fields the
    schema always had (`conversionActionId`, `reporting`).
  - **`@getvitops/astro`**: `GetvitopsAdProperty` and `GetvitopsTrackingOptions` are aliases of the schema
    types. `toCrmConfig()` and `toGoogleAdsConfig()` are **deprecated** — they returned their argument's
    field unchanged; pass `config.site.crm` / `config.site.ads?.google` directly.
  - **`@getvitops/cli`**: `vitops ads` now passes `conversionActionId` and `reporting` through to the planner;
    it previously copied a hand-picked subset of the block and dropped them.

  Formats reached: none — no CSS change.

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

- Updated dependencies [65a13cc]
- Updated dependencies [67e2088]
- Updated dependencies [89265af]
- Updated dependencies [0574388]
- Updated dependencies [c3c1bcb]
- Updated dependencies [0574388]
- Updated dependencies [1a8231d]
- Updated dependencies [779d22e]
- Updated dependencies [0574388]
- Updated dependencies [8d8aad7]
- Updated dependencies [0574388]
- Updated dependencies [1a3e811]
- Updated dependencies [0574388]
- Updated dependencies [dde3df3]
- Updated dependencies [d9f213b]
- Updated dependencies [7f4f50e]
- Updated dependencies [7fd5f8f]
- Updated dependencies [ceb8310]
  - @getvitops/generator@8.2.0
  - @getvitops/utils@8.2.0

## 8.2.0-alpha.0

### Minor Changes

- 0574388: Add `site.crm` — push form submissions into HubSpot, Zoho Bigin, or Jobber.

  Client sites need form submissions to land in the client's CRM. The options available before this
  — a HubSpot/Bigin/Jobber iframe or JS embed — fail on three counts: the markup can't be
  white-labelled against this design system, nothing can operate on the submission before it leaves
  the page, and the submission never touched `createConversionRoute()`, so `_ac` ad-click attribution
  was lost and no conversion notification was planned.

  This adds one server-side path for all three CRMs, hung off the conversion route that already
  exists. `createConversionRoute()` gets a new `crm` option (`{ config, credentials, fetch?,
  timeoutMs? }`); credentials arrive as a function of `locals`, exactly like the existing `binding`
  option, and are never config. A failed CRM write never fails the request and is folded into the
  notification email's new "Delivery" section, so a broken CRM token is never silent.

  New `@getvitops/utils/crm` subpath: `deliverToCrm()`, `mapSubmission()`, `deriveLastName()` (Bigin
  requires a last name; this derives one from an explicit field, a full name, or an email address,
  refusing rather than fabricating one), `submitToHubSpot()`, `submitToBigin()`, `submitToJobber()`.
  `identifySubmitter()` was promoted out of `notify`'s private name-guessing cascade into
  `@getvitops/utils/tracking`, since the CRM mapper needed the whole identity (first/last name,
  email, phone, company), not just a display name.

  Jobber is GraphQL, not REST, and answers `200 OK` for failures — a rejected `clientCreate` returns
  `userErrors[]`, a malformed request returns top-level `errors[]`. `submitToJobber()` classifies on
  the response body, not just the status. Its refresh tokens also rotate by default: **Refresh Token
  Rotation must be turned off** in the app's Developer Center settings, since a Worker reading a
  static `VITOPS_JOBBER_REFRESH_TOKEN` cannot persist a rotated one — a rotated token is detected at
  exchange time and reported with the fix, rather than surfacing an hour later as an opaque 401.
  Attribution and unmapped extra fields render into a best-effort note by default (works on every
  Jobber plan); a resubmitting visitor creates a second Jobber client unless `crm.jobber.dedupe: true`
  is set once its lookup query has been verified against a live account (defaults `false` pending
  that verification — see `jobber.ts`'s docblock).

  New `site.crm` config block (`provider`, `hubspot`/`bigin`/`jobber`, `fieldMap`, `trackingFields`)
  and two CLI commands: `vitops crm check` (fetches the live HubSpot property list or Bigin field
  list and reports every mapped name that doesn't exist there — HubSpot rejects an unknown field
  outright, Bigin silently drops it; Jobber has nothing live to check yet, since its mapped values
  currently render as note text) and `vitops crm setup` (creates missing HubSpot properties; Bigin
  and Jobber have no such API, so both always print a manual reminder).

  The generated privacy policy now names HubSpot, Zoho Bigin, or Jobber when `site.crm` configures
  one. Bigin gets the same cross-border-transfer derivation Matomo Cloud already gets: a
  `dataCenter: 'ca'` asserts no transfer outside Canada, any other data centre does. Jobber's
  operator (Octopusapp Inc. d/b/a Jobber) is Canadian, but its own privacy policy names the United
  States as a processing location too, so the policy always asserts a cross-border transfer for
  Jobber regardless of config — a Canadian operator is not read as Canadian-only storage.

  Credentials: `VITOPS_HUBSPOT_ACCESS_TOKEN` for HubSpot; `VITOPS_ZOHO_CLIENT_ID` /
  `VITOPS_ZOHO_CLIENT_SECRET` / `VITOPS_ZOHO_REFRESH_TOKEN` for Bigin; `VITOPS_JOBBER_CLIENT_ID` /
  `VITOPS_JOBBER_CLIENT_SECRET` / `VITOPS_JOBBER_REFRESH_TOKEN` for Jobber. Never config.

  No consumer-facing change in `@getvitops/astro` beyond the new `crm` route option and a build
  warning when `site.crm` is configured with no route answering `TRACKING_ENDPOINT` — CSS/Bricks/
  tailwind outputs are unaffected.

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

### Patch Changes

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

- Updated dependencies [65a13cc]
- Updated dependencies [67e2088]
- Updated dependencies [0574388]
- Updated dependencies [c3c1bcb]
- Updated dependencies [0574388]
- Updated dependencies [0574388]
- Updated dependencies [0574388]
- Updated dependencies [1a3e811]
- Updated dependencies [0574388]
- Updated dependencies [dde3df3]
- Updated dependencies [d9f213b]
  - @getvitops/generator@8.2.0-alpha.0
  - @getvitops/utils@8.2.0-alpha.0

## 8.1.0

### Minor Changes

- **Added — `vitops init --site` and `vitops setup`, the scripted client-onboarding path.**

  `vitops init --site [--name] [--url]` scaffolds a starter `site.json` (the umbrella `Config`,
  embedding a starter design system at `designSystem.themes.default`) instead of a bare
  `design-system.json` — exported as `defaultSiteConfig()` from `@getvitops/generator`, alongside a
  new `CONFIG_SCHEMA_LOCAL_PATH` and an optional `$schema` field on `ConfigSchema` so a scaffolded
  config gets editor autocomplete the same way `design-system.json` already does.

  `vitops setup <repo|hosting|domain|search|ads|all>` (new `@getvitops/utils/hosting` subpath: a
  pure planner + `wrangler`/`gh`-shelling executors, following the same idempotent
  plan/observe/apply split as `onboarding`/`ads`) automates GitHub repo + branch policy and
  Cloudflare dev D1/R2 + repo secrets, and plans/checks the workers.dev-vs-custom-domain
  consistency without ever applying the cutover itself — see AGENTS.md's new "Client onboarding"
  section for the full design rationale. `search`/`ads` forward to the existing `search setup`/
  `ads setup` subcommands rather than reimplementing them.

  No consumer-facing change in `@getvitops/vite` or `@getvitops/astro` in this release — bumped
  only because they are in the `fixed` release group with `generator`/`utils`/`cli`.
  `@getvitops/core` does have a real fix in this release; see the separate `banner-hidden-fix`
  changeset.

### Patch Changes

- Updated dependencies
  - @getvitops/generator@8.1.0
  - @getvitops/utils@8.1.0

## 8.0.1

### Patch Changes

- `vitops icons`'s `--site` flag is renamed to `--input`, matching `legal`/`robots`/`reviews` and
  every other `Config`-anchored command. Same default (`./site.json`) and the same short flag
  (`-i`); only the long name changes.

  **Migration:** replace `vitops icons --site <path>` with `vitops icons --input <path>` (or `-i`).
  Deferred out of 8.0.0 as a rename not worth a major bump on its own; landing now as a patch since
  8.0.0 has no adopters yet to carry the deprecated name for.
  - @getvitops/generator@8.0.1
  - @getvitops/utils@8.0.1

## 8.0.0

### Major Changes

- Rebuild the lightbox on one dialog + the existing carousel, fixing the flicker on
  prev/next and the stutter on open.

  **Breaking (`css`/`bricks` and `tailwind` formats — `.lightbox-dialog`'s markup
  contract changed):**
  - `<Gallery />` now emits ONE `<dialog class="lightbox-dialog">` per gallery,
    wrapping a `<Carousel />`, instead of one dialog per image. A `.gallery__trigger`
    is now a plain `<a href="#slide-id">`, not a `command="show-modal"` button.
  - `.lightbox-dialog__content` / `__image` / `__nav` / `__nav-button` /
    `__caption` are gone. The dialog's child is `.lightbox-dialog__track` (a
    `.carousel`) — prev/next, dots, arrow keys and swipe are the carousel's,
    reused rather than reimplemented. `.lightbox-dialog__close` is unchanged.
  - `<wc-gallery>` no longer builds nav buttons or steps between images — the
    nested `<wc-carousel>` does. It fires `gallery-open` (unchanged shape) and
    re-emits the carousel's own stepping as `gallery-change`.
  - `packages/core/src/web-components/utils/gallery.ts` dropped `keyToAction` and
    `swipeAction` (the carousel's own key/swipe handling covers both now).
    `stepIndex`/`preloadTargets` are unchanged.

  **Why:** stepping used to close one `<dialog>` and open another, which made
  `animation.css`'s top-layer driver play a full exit-then-entry transition on
  every step — visible as a flicker on prev/next, by construction, not a bug to
  tune away. Opening also awaited the full image's `decode()` before starting the
  view-transition morph, so the dialog visibly stalled on a slow network. One
  dialog containing one carousel makes the first failure mode unrepresentable
  (stepping is a scroll, not a close/open pair) and removes the wait for the
  second (the morph starts immediately, painting the thumbnail as a CSS
  background placeholder until the full image arrives).

  **Also improved, not just fixed:** the no-JS fallback is no longer a _stripped_
  lightbox — it's a genuine one. Each trigger is ordinary fragment navigation
  (`:has(:target)` in `lightbox.css` reveals the dialog), which needs no Invoker
  Commands polyfill in any engine, and it now has working prev/next with no
  JavaScript at all — the previous per-dialog fallback had no way to express that.

  **Migration:** a consumer using `<Gallery />` needs no changes — the component's
  props are unchanged. Anyone who hand-authored `.lightbox-dialog` markup (per
  `docs/concepts/patterns.md` / `docs/css/classes.md`) must move to the new single-
  dialog-wrapping-a-carousel shape; see `patterns.astro`'s "Gallery, hand-authored"
  demo for the reference markup. `<wc-gallery>` consumers listening for
  `gallery-change` keep the same event shape (`{ index, total }`).

### Minor Changes

- Add Google Business Profile reviews: fetch, cache, render.
  - **`vitops reviews`** (new CLI command) fetches a client's GBP reviews (legacy v4 API — the only
    one that has them) and writes them to `.vitops/reviews.json`, meant to be committed so a build
    never needs a live Google credential. `--dry` prints the plan; `--check` diffs against the cache
    without writing. Requires the same `VITOPS_GOOGLE_CLIENT_ID`/`_CLIENT_SECRET`/`_REFRESH_TOKEN` (or
    ADC login) `search setup` uses, scoped to `business.manage` — **and the calling GCP project must
    be allowlisted by Google first**, a separate one-time approval from every other Google API here.
  - **`site.reviews`** (config): which `organization.locations` to fetch, and per-location
    `featured`/`minRating`/`sort`/`limit` selection. `schema` (JSON-LD) and `avatars` both default to
    **off** — see the migration notes below.
  - **`@getvitops/utils/reviews`** (new subpath): the pure plan/select/merge functions plus the GBP
    fetcher and cache reader/writer, mirroring `./indexing`'s pure/IO split.
  - **`<ReviewCard>`** (new Astro component, `@getvitops/astro`): one review card from a cache entry.
    No web component — nothing here needs progressive enhancement. Composes the existing
    `schemas/Review.astro` for JSON-LD only when both `schema` and `itemReviewed` are passed.
  - **`<Marquee>`** (new Astro component): the tier-3 wrapper `wc-marquee`/`marquee.css` was missing.
  - **`.review` pattern** (`css`/`bricks` and `tailwind` formats): a new config-generated
    `patterns.items.review` entry plus `packages/core/css/patterns/review.css` for the structural
    parts (rating, identity, body, reply, source link). Two new semantic icon names, `star` and
    `star-half`, across every icon set.

  **Migration:** no breaking change. A site adding `site.reviews` should read the "Google reviews"
  section in AGENTS.md before enabling `schema` — Google's structured-data policy treats a business
  marking up reviews of itself as ineligible for review rich results and risks a manual action, which
  is why it defaults off.

- Repo-wide simplification pass: de-boilerplate the CLI, dedupe shared cache/plan
  primitives in `@getvitops/utils`, drop dead code, and tighten dependency hygiene.

  No breaking changes. (`vitops icons`'s `--site` flag was briefly going to be renamed to
  `--input` for consistency with the other `Config`-anchored commands — deferred rather than
  spending a major bump on a rename with no other breaking change riding along; it stays
  `--site` for now.)

  **Fixed:**
  - `@getvitops/core`'s 12 runtime deps (`lit`, both `@oddbird` polyfills, both
    `@webcomponents` packages, `colorjs.io`, etc.) were listed as `dependencies` despite
    being bundled into `dist/elements.js`/`dist/polyfills.js`/`dist/deferred.js` — a
    consumer installed them twice for nothing. Moved to `devDependencies`; no change to
    what ships.
  - Deleted `old-css-lib/` (59 files), superseded by `packages/core/css/` since the
    in-memory bundling change — no consumer-facing effect, it was not part of any
    published output.
  - Deleted a dead Astro module (`packages/astro/src/scripts/deferred.ts`) that had
    silently diverged from `packages/core/src/js/deferred.ts` and had zero importers.

  **No consumer-facing change in `@getvitops/vite`** beyond the fixed-group version bump —
  task-graph and caching fixes internal to this repo's own build.

  Everything else (the `cli.ts` file split into `commands/{search,ads}.ts`, shared
  `json-store.ts`/`plan-format.ts` helpers in `@getvitops/utils`, a `.github/actions/setup`
  composite action, restatement-comment cleanup) is internal refactoring with no change to
  any published API, CLI flag, or generated output.

### Patch Changes

- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies [a84839b]
  - @getvitops/generator@8.0.0
  - @getvitops/utils@8.0.0

## 7.0.0

### Minor Changes

- c0c092b: `vitops search` now works from a `gcloud` login, and attributes API usage per site.

  **Being logged in is enough.** With no `VITOPS_GOOGLE_*` set, an Application Default Credentials
  login is used — the credential `gcloud auth application-default login` already wrote. It needs the
  Search Console scopes, which are not in the default ADC set:

  ```
  gcloud auth application-default login \
    --scopes=openid,https://www.googleapis.com/auth/siteverification,\
  https://www.googleapis.com/auth/webmasters,https://www.googleapis.com/auth/cloud-platform
  ```

  Explicit `VITOPS_GOOGLE_*` vars still win. Ambient credentials are only a fallback, because a stale
  local login silently overriding a deliberate CI secret is the worst available precedence.

  Beyond convenience, this removes a documented footgun: an OAuth client you create yourself sits in
  _Testing_ publishing status, where Google **expires the refresh token after 7 days**. The Cloud SDK
  client is published, so an ADC credential doesn't rot between onboarding runs.

  **New: `site.google.project`** — the Google Cloud project API usage is attributed to, sent as
  `x-goog-user-project`. One project per site is what keeps each site's usage and billing separate,
  and it is the same field Maps or anything else will read later, rather than a `quotaProject` here
  and a `mapsProject` there.

  It is **required for a user credential and wrong for a service account**, which is why it is not
  sent unconditionally. A user credential authenticates through a shared OAuth client that owns no
  project, so Google refuses the call outright — measured: `403 "requires a quota project, which is
  not set by default"`. A service account already belongs to a project, and pointing it at a
  different one would newly require `serviceusage.services.use` there, turning a working CI
  credential into a 403 for no benefit.

  Using it needs both APIs (`searchconsole.googleapis.com`, `siteverification.googleapis.com`)
  enabled on that project, and `serviceusage.services.use` for the identity — one grant per site,
  which suits an agency administering many sites from one admin identity.

  An ADC credential with no `site.google.project` is now **refused before any request is made**,
  naming the file the credential came from and the project gcloud recorded with it:

  ```
  ✖ this Google credential comes from ~/.config/gcloud/application_default_credentials.json,
    which authenticates through a shared OAuth client that owns no project — so it needs
    "site.google.project" in site.json to say which project the API usage belongs to.
    gcloud recorded "acme-web" as the quota project for that login, so that is probably the value.
  ```

  That is the mistake waiting for the _second_ site: the command gets copied from whatever
  onboarded the first one, the field is left out, and Google's own answer names neither the config
  field nor the credential.

  **Fixed: an ADC file in `GOOGLE_APPLICATION_CREDENTIALS` no longer hard-exits.** That variable is
  Google's own convention _and_ where gcloud writes ADC, so the same variable carries two kinds of
  credential. Parsing an `authorized_user` file as a service account failed with `service account
  JSON is missing client_email or private_key` — while holding a credential the command already knew
  how to use. It is now discriminated on `type`, the field Google's own libraries switch on.

  **Also fixed — `search setup --dry` and `--check` are not offline.** The docs implied otherwise. The
  state gather runs before the planner, so both read from Cloudflare and Google and both need
  credentials. They still create and change nothing; `notify --dry` remains genuinely request-free.

  New in `@getvitops/utils/indexing`: `parseAdcUser`, `adcQuotaProject`, `adcCredentialsPath` (pure,
  so what is decidable is asserted without a filesystem), plus `googleHeaders` and the `GoogleAuth` /
  `GoogleAuthLike` types. The seven exported Google request functions now take a token **or** a
  `{ token, quotaProject }` — a bare string still works everywhere, so nothing needs changing.

### Patch Changes

- **Added — `utils`.** `itemListGraph()`, a pure schema.org `ItemList` JSON-LD builder — a sibling
  of `breadcrumbGraph()`/`localBusinessGraph()`. Extracted from `@getvitops/astro`'s `<Carousel />`
  so any consumer can build a valid `ItemList` (Google's "all-in-one page" carousel format:
  `ListItem.item` carrying `@type`/`name`/`url`) for content that isn't one of the six Google
  carousel rich-result types (`Article`/`Recipe`/`Movie`/`Course`/`Restaurant`/`Product`) — the
  entity type is no longer constrained to that set.

  **Changed — `astro`.** `<Carousel />`'s `CarouselItem['type']` now accepts any string, not just
  the six carousel rich-result types — non-breaking, the union only widens. It's a thin wrapper
  over `itemListGraph()` now; behaviour for existing callers is unchanged.

  No consumer-facing change in this release outside `utils` and `astro` — `generator`, `cli` and
  `vite` still ship in this release only because the six share one version.

  **Fixed — `core` (`css`/`bricks`/`tailwind` build output, all formats).** The CSS and HTML
  authored inside Lit's `css`/`html` tagged templates in `<wc-*>` component sources previously
  survived JS minification verbatim — a JS minifier treats a template literal's cooked text as
  opaque, so `elements.js` shipped ~690 lines of indented, unminified CSS (and the equivalent in
  HTML) inside an otherwise-minified 886-line file. Two source-level build transforms now collapse
  both before bundling: `postcss` + `postcss-lit` + `cssnano` for `css` templates, `minify-html-literals`
  (`conservativeCollapse: true`, so whitespace between inline elements in light-DOM components never
  collapses to zero) for `html` templates. `elements.js` drops from 886 lines / ~101 KB to 49 lines /
  ~96 KB. A second build step deduplicates the 17 `@license` comment blocks (only 6 are textually
  distinct) down to one verbatim copy of each — required by BSD-3/MIT/Apache-2.0's notice-retention
  terms either way, just no longer repeated once per source file that carries it. No API change;
  build-time only, and none of the added tooling (`postcss`, `postcss-lit`, `cssnano`,
  `minify-html-literals`) is a runtime or published dependency.

- Updated dependencies [c0c092b]
- Updated dependencies
- Updated dependencies [aad43b7]
- Updated dependencies [2b50f9e]
- Updated dependencies [a6a8b39]
- Updated dependencies [7b391b3]
- Updated dependencies [eb9ac79]
  - @getvitops/utils@7.0.0
  - @getvitops/generator@7.0.0

## 6.0.0

**No consumer-facing change in this package.** The major is the toolchain's shared version, bumped
in lockstep for the carousel rework in `@getvitops/core` / `generator` / `astro`. Every command
behaves as it did in 5.0.0; `vitops docs components` and `vitops docs css` will report the new
carousel vocabulary, because they render live from the generator.

### Patch Changes

- Updated dependencies
  - @getvitops/generator@6.0.0
  - @getvitops/utils@6.0.0

## 5.0.0

### Major Changes

- **Dangling token references are now a build failure.** `validate()` resolves every `var(--…)` a
  config authors — in `patterns.defaults` / `radii` / `groups` / `items.*.{base,overrides,states}`,
  `typography.roles` and `shadows` — against the tokens that config actually emits. A reference to a
  token that does not exist used to validate, generate, minify and ship, then resolve to nothing in
  the browser: one downstream config shipped a `.cta` whose `color` fell back to `inherit` on a brand
  fill (unreadable text on every filled button), and two of its four dead references had been dead for
  several releases with nothing ever reporting them.

  The check is deliberately anchored to the namespaces the generator owns — `--color-*`, `--shadow-*`,
  `--z-tier-*`, `--surface-glass`, `--overlay` — the same discipline `vitops lint` follows. A pattern
  may legitimately reference a framework token from `@getvitops/core` or a hook of your own, and
  enumerating "every valid token" would make those false positives. A reference carrying a fallback
  (`var(--x, 0.25rem)`) is never flagged: that is you saying what happens when the token is absent.
  Errors name the config path and suggest the nearest token that does exist.

  Two related diagnostics ship with it:
  - **Pre-1.0 colour-grammar references are reported as one rename table**, not as a dozen separate
    "no such token" errors — the shape the 3.0 flat-config detector uses, applied to the 1.0 colour
    change. It is built from your own role names, and it says to apply the renames _simultaneously_,
    because several of them rotate (`--surface-bg` → `--color-bg-surface-muted`,
    `--surface-bg-bold` → `--color-bg-surface`) and sequential replacement compounds them.
  - **A surface-shaped role declared chromatic now warns.** A bare hue string is shorthand for
    `kind: "chromatic"`, which emits no bare `--color-bg-<role>` and no `.bg-<role>` — so writing
    `"surface": "ink"` silently removed `--color-bg-surface` and the 36 references the framework's own
    CSS makes to it. Relatedly, `--surface-glass`, `--overlay` and `.glass` are no longer emitted when
    `surface` is chromatic: they read `--color-bg-surface`, so emitting them pointed at nothing.

  **`vitops lint --fix` is now the migration tool.** It reads `var(--…)` out of CSS and `<style>`
  blocks (not just `class` attributes) and rewrites pre-1.0 token references in a **single pass**, so
  the rotating renames cannot compound. Nothing else is rewritten — every other finding it reports is
  a judgement call. Run it after a major bump.

  **`--help` works on every subcommand.** `vitops lint --help` used to exit non-zero with
  `Unknown option '--help'`; every leaf subcommand parsed its own argv strictly and none declared the
  option. It is now answered before dispatch, so no command can forget it, and a drift guard fails the
  build if a command has no documented options. (`validate`'s options were genuinely undocumented and
  now are.)

  **The Astro integration reads `site.tracking` and `site.legal.cookieConsent`.** These drive the
  generated cookie notice, while `vitops({ consent, tracking })` drove the runtime — two hand-synced
  declarations of the same fact with nothing comparing them, so a site could ship a notice naming
  categories its banner never offered, or disclosing an `_ac` cookie no capture script ever wrote, and
  the build was clean. The config blocks are now defaults (as `css` / `fonts` / `favicon` / `ads`
  already were) and a genuine contradiction — `true` against `false` on the same fact — **fails the
  build**, naming both sides. An absent option is not a contradiction; it just takes the config's
  value.

  Also fixed, each from a downstream report:
  - **`@getvitops/astro/tracking`** re-exports `@getvitops/utils/tracking` (plus `TRACKING_ENDPOINT`),
    so the documented conversion flow works with one install. Under strict pnpm app code cannot
    resolve a transitive dependency, and the obvious workaround — importing the same symbols from the
    package index — is the one that drags the integration's Node builtins toward a Worker bundle. This
    entry and `./routes` are both clean.
  - **`createConversionRoute`'s example was broken on every supported Astro.** It read the binding off
    `locals.runtime.env`, removed in Astro v6, while the package peers on `>= 7` — and because the
    throw precedes the response, Astro re-reads the request and reports a misleading "Body has already
    been used". It also called a `toNotifyContext()` helper that does not exist. The example now uses
    `import { env } from 'cloudflare:workers'` and a plain `NotifyContext`.
  - **`/api/track` is exported as `TRACKING_ENDPOINT`**, and the integration warns at build when
    tracking is on and no route answers it. It was a bare literal inside the inlined capture script:
    name the route file anything else and every `tel:` beacon 404s, conversions vanish, and nothing
    errors anywhere.
  - **`describeEvent` no longer reports "from Unknown"** for forms that don't have a field literally
    named `name`. It now falls back through `first_name`/`last_name`, `full_name`, and finally the
    email address.
  - **`sendEmail` takes `timeoutMs` (default 10s).** `binding.send()` had no deadline, so one hung
    attempt hung the request that produced it — indefinitely, in the one module otherwise built on
    always saying why. A timeout is retried, like any other transient failure.
  - **`vitops search notify` warns when the sitemap's URLs aren't on the configured origin.** A 404
    fails loudly; a well-formed sitemap belonging to someone else did not — a route collision served a
    valid document listing another site's pages and the run reported a healthy submission. Surfaces at
    `--dry`.
  - **`require()` warns when the page has no `<wc-consent>`.** The demand can never be granted, so
    whatever waited on it never runs — silently. Hit by rendering `<Tracking />` on pages where
    `<CookieConsent />` wasn't.
  - **`vitops agents` no longer writes a path it guessed.** It used to warn and then write "tokens
    live in `design-system.json`" into a project whose tokens are in `company.json`, with the four
    emitted `vitops generate` commands hard-coded to match — copy-paste-broken in exactly the projects
    that most need the block to be right. It now finds the config by shape, interpolates the resolved
    path into every emitted command, and fails rather than guessing when there is nothing to name.
  - **`vitops search setup --dry` and `vitops ads setup --dry` run without credentials.** A dry run
    that mutates nothing should not demand the token to mutate; with none set it plans from scratch
    and says so. (`--check` still needs them — drift is a comparison against live state.) Both now
    also mention that the Cloudflare token needs `Zone:Read` alongside `Zone:DNS:Edit` — the
    zone-by-name lookup uses it, and its absence read as "the zone isn't in this account".
  - **`vitops legal` names the files it wrote and flags new ones.** Enabling `cookieConsent` silently
    produced a `cookie-notice` document that then needs a page, a route, a link and a `policyUrl`; the
    command said only "3 files". The review reminder is also printed on the stdout path, where it was
    missing entirely.
  - **`vitops init` writes a versioned `$schema`** — `./node_modules/@getvitops/generator/schema.json`,
    following wrangler — instead of an unpinned unpkg URL that resolved to whatever was newest, so an
    editor validated a pinned project against a schema it wasn't built with.
  - **`favicon.backgroundColor` and `favicon.name` are described accurately.** `backgroundColor` is
    not manifest-only: it fills the opaque `apple-touch-icon.png` and `icon-mask.png`, which are
    written whether or not a manifest is. `name` documents that it and `themeColor` **together** are
    what make a site installable. The missing-background warning now also fires for a dark opaque mark,
    not only a transparent source — `apple-touch-icon` insets the logo and fills the surround either
    way.

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

### Patch Changes

- **Astro and Bricks are documented as the same tier, because they are.** Both are platform
  wrappers that generate HTML from the classes and elements of tiers 1 and 2 — siblings chosen by
  which platform you are on, not steps in a ladder. No project uses both, and neither outranks the
  other.

  They were published as tier 3 and **tier 4**, in `vitops docs components`, the shipped agent
  skill and the docs site. The cause was a projection axis being read as a hierarchy: `Tier` has
  four keys (`css` `wc` `astro` `bricks`) because there are four tables to render, and the tier
  number was being derived from that key order — so the last key became "tier 4". The advice next
  to it inherited the error, telling readers to "use the highest-**numbered** tier your stack has",
  which reads as Bricks outranking Astro.

  Nothing about which patterns each tier provides has changed; this is the numbering and the prose
  around it. `Tier` keeps its four keys — that part was never wrong — and now says in its own type
  docs why four keys are three levels, so the next renderer cannot repeat the derivation.

- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @getvitops/generator@5.0.0
  - @getvitops/utils@5.0.0

## 4.1.0

### Minor Changes

- 2c890c0: Link a site to its ad properties: `site.ads`, `vitops ads`, and `<Ads />`.

  `vitops search` covers the whole Search Console relationship. Nothing covered the equivalent one
  with ad platforms, and a site's ad accounts had nowhere to live — so a Meta pixel pasted into a
  template was invisible to the rest of the toolchain. It set `_fbp` on a site whose generated cookie
  notice never mentioned it, whose consent gate never cleared it on revoke, and — for LinkedIn and
  Pinterest — whose attribution never captured the click ID at all, so every conversion from those
  platforms arrived indistinguishable from organic traffic.

  **New `site.ads` block**, keyed by platform (`google`, `meta`, `linkedin`, `reddit`, `tiktok`,
  `microsoft`, `pinterest`, `snapchat`):

  ```jsonc
  {
    "site": {
      "ads": {
        "meta": { "pixelId": "123456789", "domainVerification": "abc123" },
        "google": {
          "accountId": "123-456-7890",
          "pixelId": "AW-987654321",
          "conversionLabel": "xyz",
        },
      },
    },
  }
  ```

  **`vitops ads setup`** ensures each platform's domain-verification DNS record. Only four platforms
  verify a domain at all — Meta, TikTok, Pinterest and Snapchat, by apex DNS TXT — and that record is
  the one thing created for you (in Cloudflare, via `CLOUDFLARE_API_TOKEN`; created only, never edited
  or deleted). Google Ads, LinkedIn, Reddit and Microsoft Ads have no domain verification: linking
  there is the tag and the account id, and the run says so rather than skipping in silence. No
  platform Marketing API is called — Meta's needs a system-user token and Google's an approved
  developer token with your own account on the line — so the final "Verify" click is surfaced as a
  reminder. `--dry` prints the plan, `--check` reports drift and exits non-zero.

  **It asks for what the config is missing.** A verification token does not exist until someone
  fetches it from the platform UI, so a first run prompts for it, naming the exact UI path, folds the
  answer into the plan and writes it to your config. The token is not a secret — it is published in
  DNS, and the platform fetching it back is the ownership proof, exactly like the IndexNow key.
  Prompting requires a TTY: with `--dry`, `--check`, `--no-prompt`, or in CI, you get a named error
  instead and the run never hangs. `--no-write` keeps the answer out of the config.

  **`vitops ads tags`** prints each pixel as an inert, consent-gated `<script>` — `type="text/plain"`
  with the library URL on `data-src`, so an undecided visitor's page issues no third-party request.
  For Bricks, WordPress, Eleventy: any stack without the Astro integration.

  **`vitops ads lint`** reports the gaps that are invisible at runtime: a click ID the platform stamps
  that attribution does not capture, a pixel while `site.tracking` is off, a property with no tag id.

  **`<Ads />` in `@getvitops/astro`**, a sibling of `<Analytics />` rather than part of it — ad
  properties come from the site config, state their own consent category (`marketing` by default,
  rather than being derived), and switch per environment on their own
  (`environments.<env>.ads`, defaulting to `analytics`, then true, so a preview deployment can send
  pageviews without firing conversion pixels). Both components now render through one `<GatedTags />`,
  so the inert markup has a single implementation.

  **Your cookie notice now discloses every configured pixel** — name, cookies and opt-out — from the
  same table that writes `data-consent-cookies`, so the notice and the revoke cannot disagree. If you
  add `site.ads` to a config whose privacy policy or cookie notice you have already published,
  re-generate and re-read them.

  `li_fat_id` (LinkedIn) and `epik` (Pinterest) join the click-ID capture vocabulary; a site running
  either platform starts attributing conversions it previously recorded as organic.

- e764090: Separate where a processor stores information from whose law can reach it.

  A processor carried one optional `country`, and the privacy policy flat-deduped it into a single
  sentence. That conflated two facts a disclosure has to keep apart — **where the data rests** and
  **which jurisdiction can compel access** — and privacy law turns on the second: the OPC's concern
  is foreign _access_, not merely foreign storage.

  Ordinary arrangements were inexpressible. Azure is data-resident in Canada and US-controlled;
  Zoho can serve mail from a Canadian datacentre and telemetry from the US while being headquartered
  in India; a Microsoft 365 tenant can be Canadian with its identity data in the US. For all of
  them every available option was wrong: `country: "Canada"` rendered the incoherent _"outside of
  Canada, including Canada"_, naming the operator's country asserted storage that wasn't happening,
  and omitting it dropped the processor from the disclosure **silently**.

  **New on a processor:**

  ```jsonc
  {
    "name": "Zoho",
    "purpose": "receiving and storing email sent to us",
    "storage": [
      { "country": "Canada", "scope": "mail and productivity data" },
      { "country": "the United States", "scope": "analytics and telemetry" },
    ],
    "operatorCountry": "India",
  }
  ```

  - `storage[]` — where information rests, each entry optionally `scope`d to a category. The scope
    is what makes "Canadian tenant, identity data in the US" sayable.
  - `operatorCountry` — the jurisdiction that can compel the provider to produce it. Gets its own
    sentence: _"…established in, or controlled from, jurisdictions outside of Canada, including
    India. Personal information those providers handle on our behalf may be subject to the laws of
    those jurisdictions even when it is stored in Canada."_
  - `country` still works, as shorthand asserting **both** facts — which is what it always
    asserted, since the sentence it fed claimed storage and legal reach in one breath.

  **Combining `country` with either explicit field is rejected** by `vitops validate`. Whether the
  shorthand narrows the explicit fact or adds to it are two readings that make contradictory legal
  claims, so neither is guessed.

  A country in the policy's own jurisdiction is no longer treated as a transfer, which is the
  `country: "Canada"` fix. Comparison ignores case and a leading "the".

  ### This changes text you have already published

  **Cloudflare, Cloudflare Turnstile, Vercel and Netlify now assert operator jurisdiction and no
  storage.** They previously claimed `the United States` into a sentence saying "stored or processed
  in" — a claim about the wrong fact. Cloudflare is anycast: a request from Toronto is answered from
  a Toronto PoP, and Workers/R2 have residency controls the config cannot see.

  So a site whose only foreign element is its host or Turnstile **stops claiming foreign storage**
  and instead discloses foreign legal reach. That is a retraction in the direction of accuracy, and
  it deserves a re-read. **If you pin a US region, say so** — declare a processor with
  `storage: [{ country: "the United States" }]`. This generalises the rule the provider table
  already applied to Matomo: "we don't know" is a fact.

  **Everything else renders identically.** Google Analytics, Tag Manager, Clarity, Plausible,
  Matomo Cloud and any processor you declared with `country` produce the same words as before,
  because the shorthand expands to both facts and the operator sentence is suppressed when it would
  only restate a country already disclosed as storage. The one cosmetic change: the closing
  "subject to access requests…" sentence is now its own paragraph, since it is shared by both
  clauses.

  **A processor with no location at all is now reported** on stderr by `vitops legal`, naming the
  document it will be missing from. It cannot appear in a transfer disclosure — there is nothing
  true to say — but it used to vanish in silence, which is the failure that looks tidy. It is not a
  validation error: a bare `{ name, purpose }` is still valid.

  New exports from `@getvitops/generator`: `processorsMissingLocation`, `JURISDICTION_COUNTRIES`,
  and the `ProcessorStorage` type. `PolicyVars` gains `jurisdictionCountry`, `storageCountries`,
  `scopedStorage` and `operatorCountries`; `countries` is **deprecated but retained**, and still
  names every country it ever named, so a custom template keeps rendering what it rendered.

### Patch Changes

- Updated dependencies [2c890c0]
- Updated dependencies [e764090]
  - @getvitops/generator@4.1.0
  - @getvitops/utils@4.1.0

## 4.0.0

### Major Changes

- f7bc0a0: Add `vitops search setup` — onboard domains into Google Search Console as domain properties.

  **Breaking:** the `vitops indexing` command has been renamed to **`vitops search notify`**. There is
  no alias — update any scripts or CI that call `vitops indexing` to `vitops search notify` (same flags,
  same behaviour).

  **New: `vitops search setup`.** For each domain in a site config's new `site.searchConsole` block
  (a record keyed by bare hostname), it:
  - ensures the apex verification TXT record in Cloudflare,
  - verifies ownership via the Site Verification API (DNS_TXT), retried with exponential backoff while
    DNS propagates — a still-unverified domain is reported **PENDING**, not failed,
  - adds the `sc-domain:` property via the Search Console API,
  - adds any `delegatedOwners` to the verified Site Verification web resource.

  It is idempotent (a re-run of an onboarded domain is a no-op), supports `--check` (report drift, exit
  non-zero, mutate nothing) and `--dry` (print the plan, change nothing), and `--domain <name>` to
  scope to one entry. DNS records are only ever created, never edited or deleted.

  Credentials come from the environment, never the config: `CLOUDFLARE_API_TOKEN` (a `Zone:DNS:Edit`
  token) and a Google **user OAuth refresh token** as `VITOPS_GOOGLE_CLIENT_ID` /
  `VITOPS_GOOGLE_CLIENT_SECRET` / `VITOPS_GOOGLE_REFRESH_TOKEN` (scoped to `siteverification` +
  `webmasters`). Granting a Google Group **Full-User** access has no Search Console API and is surfaced
  as a reminder in the summary rather than automated.

- ceed51f: `vitops search notify` now accepts either Google credential, so most sites need only one.

  The two halves of `vitops search` each demanded a different, unrelated Google setup — five environment variables between them. `search setup` requires a user OAuth credential (verifying a site makes the caller an **owner** of the property, and that should be a person, not a project robot), while `search notify` accepted only a service account. Search Console does not care which identity calls it, so a consumer who had already run `search setup` was being made to create a second credential for the other half of the same command.

  `search notify` now takes whichever you have, preferring the service account when both are set — it runs on every deploy, in CI, and a service account does not expire, whereas a refresh token can be revoked and expires after 7 days for an OAuth client still in _Testing_ publishing status. `search setup` is unchanged and still requires user OAuth.

  **Breaking — two renamed exports.** Both did the same job under the same name from different subpaths, which forced an alias at every call site:
  - `@getvitops/utils/indexing`: `getAccessToken` → **`serviceAccountToken`**
  - `@getvitops/utils/onboarding`: `getAccessToken` → **`refreshTokenGrant`**

  New: `googleAccessToken(credential)` from `@getvitops/utils/indexing` takes a `GoogleCredential` union and is what both wrappers now call. If you were importing either `getAccessToken`, switch to the specific name, or to `googleAccessToken` if you want to accept either identity.

  Internally the exchange is now one function. The two grants send different form bodies; everything after that — endpoint, content-type, error handling, `access_token` extraction — was duplicated verbatim in two modules. The service-account JWT signing had no test at all, because it was only reachable over the network; it now does, including the literal-`\n`-in-a-PEM case that secret stores produce.

### Minor Changes

- 14813fa: Document which tier provides each pattern — `vitops docs components`.

  The toolkit ships four tiers that compose: CSS framework classes, `<wc-*>` web components, Astro
  components, Bricks elements. Nothing said so. The class reference listed pattern names, the
  elements reference listed Bricks controls, and the fact that `tree` is _also_ a web component
  _and_ an Astro component existed only in the source layout. The cost is silent: you hand-write
  the markup a component already emits, or you wrap a component that already emits its own tag.

  `TIERS` in `@getvitops/generator` is the new manifest — per pattern, its CSS partial and
  representative classes, its `wc-*` tag and which bundle that ships in, its Astro component(s),
  its Bricks element, and one line saying what to actually write. `tierPatterns(tier)` projects one
  tier. `vitops docs components` renders all four in one document, and the reference sections it
  feeds render the same data per tier.

  It is **authored rather than derived, and drift-guarded** instead. Naming convention carries most
  of it and breaks exactly where it matters — `splitter.css` hosts two components, `tag.css` serves
  three config patterns, `anchor-link.css` provides `.link`, `layout.css` provides `.split` and
  `.centered` — so a derivation would need an exceptions table longer than the rule, and a rename
  would silently drop a link. Instead, tests fail the build when a hand-written CSS partial, a
  `customElements.define`, an exported Astro component or a Bricks element isn't accounted for.

  Four things the manifest records that cannot be inferred, each a real failure mode:
  - **Whether an Astro component wraps a web component.** `Tree` and `CookieConsent` emit the
    `<wc-*>` tag with the fallback inside; `Details`, `Drawer`, `Popover`, `NavShell` and `Subgrid`
    emit tier-1 markup with no web component at all. Reading the first group as the second gives
    `<wc-tree><Tree /></wc-tree>` — two elements on one tree, which renders and misbehaves.
  - **Where each element ships.** `elements.js` for the registered set, its own bundle for
    `<wc-consent>` and `<wc-theme-editor>`, and **no bundle at all** for the four editor-v2 tags —
    which are registered, importable-looking and inert in a consumer project. The guard checks this
    against what `js/elements.ts` imports, so it can't claim an element ships when it doesn't.
  - **Whether a pattern is config-authored.** `patterns.items` patterns get the token cascade,
    states, role variants and override hooks; a structural partial gets none of them. The docs also
    now say when a config-authored pattern is **absent from your config**, because naming its
    classes while your build emits none of them is worse than omitting it.
  - **The import specifier, verbatim.** These are published as the line to copy, so they are checked
    against `@getvitops/astro`'s `exports`. That guard immediately caught
    `@getvitops/astro/components/../CookieConsent.astro` — plausible-looking, right basename, not an
    importable path (`CookieConsent.astro` ships from the package root).

- 14813fa: Document the consent, conversion-tracking, search and legal subsystems for agents.

  `vitops docs` gains four topics — `consent`, `tracking`, `search`, `legal` — and the docs
  bundle gains the matching concept docs under `concepts/`. Until now these subsystems were
  described only by their generated config-schema field descriptions, so an agent working in a
  consumer project had no account of the rules that make them work, and every one of those rules
  fails **silently** when broken:
  - a gated tag given a live `src` instead of `type="text/plain"` fetches the third party anyway,
    so the gate becomes decorative;
  - a caller using `granted()` instead of `require()` never raises the banner, so on a site where
    nothing else demands that category the permission is never offered, never granted, and the
    write never happens;
  - an absent `window.vitopsConsent` read as "denied" rather than "this site has no gate";
  - a consent patch widened to every category records consent nobody gave;
  - a sitemap with no `<lastmod>` makes edited pages undetectable, so `search notify` looks
    healthy while never resubmitting anything;
  - a stale IndexNow key file returns `202` and is then discarded;
  - Google's Indexing API accepts ordinary URLs, discards them, and violates its own terms.

  The packaged agent skill now covers consent and conversion tracking, and its description names
  these subsystems so it is actually surfaced when they are the task.

  Also fixed: the icons concept doc still called the Astro integration `getvitops()`, renamed to
  `vitops()` in 3.0.

### Patch Changes

- Updated dependencies [14813fa]
- Updated dependencies [c6b99e7]
- Updated dependencies [c6b99e7]
- Updated dependencies [f7bc0a0]
- Updated dependencies [ceed51f]
- Updated dependencies [14813fa]
- Updated dependencies [14813fa]
  - @getvitops/generator@4.0.0
  - @getvitops/utils@4.0.0

## 3.0.0

### Major Changes

- 6e68ace: **Breaking:** the site config is now a three-section `Config` — `designSystem`,
  `organization`, `site`.

  The flat `SiteConfig` held the company (`organization`, `contact`, `locations`) and the
  deployment (`analytics`, `environments`, `seo`, `legal`) as peers, so no single noun
  described it, and a second site sharing the same company had no way to say so. The three
  sections split those apart: several sites can now carry one `organization` and differ only
  in `site`.

  **Migrating.** `designSystem` stays at the root, and the fields already under
  `organization` stay where they are. Everything else moves into one of two sections:
  - → `site`: `defaultLocale`, `locales`, `domains`, `dns`, `cloudflare`, `environments`,
    `abTesting`, `fonts`, `tags`, `postTypes`, `galleries`, `testimonials`, `templates`,
    `navigation`, `seo`, `analytics`, `notifications`, `tracking`, `security`, `legal`,
    `icons`, `favicon`, `deployment`
  - → `organization`: `contact`, `primaryLocation`, `locations`, `services`, `links`

  You do not have to work this out from the list: `vitops validate` detects a pre-3.0 flat
  config and prints every move by name, rather than reporting a dozen unknown keys.

  ```jsonc
  {
    "designSystem": {
      "themes": {
        "default": {/* … */},
      },
    },
    "organization": {
      "name": "Acme",
      "contact": "hq",
      "locations": {
        "hq": {/* … */},
      },
    },
    "site": {
      "defaultLocale": "en",
      "domains": {/* … */},
      "analytics": {/* … */},
    },
  }
  ```

  **Renamed exports** (`@getvitops/generator`): `SiteConfigSchema` → `ConfigSchema`,
  `SiteConfig` → `Config`, `validateSite` → `validateConfig`, `resolveSiteConfig` →
  `resolveConfig`, `isSiteConfig` → `isConfig`, `siteJsonSchema` → `configJsonSchema`,
  `SITE_SCHEMA_URL` → `CONFIG_SCHEMA_URL`, `SiteValidationResult` →
  `ConfigValidationResult`. `ResolvedInput.site` is now `ResolvedInput.config`. New:
  `OrganizationConfig` and `SiteSection` for the two sections.

  **Renamed schema file:** `@getvitops/generator/site.schema.json` →
  `@getvitops/generator/config.schema.json`. Update the `$schema` key in your config.

  Option names are unchanged — `vitops({ site: { input } })`, the Vite plugin's `site`,
  and `generate({ site })` still point at the config file.

  **The Astro integration is now `vitops()`, not `getvitops()`.** It is a default export,
  so the name is yours and nothing breaks on upgrade, but every example now reads
  `import vitops from '@getvitops/astro'` — matching the Vite plugin, which has always been
  `vitops`. The `@getvitops/*` package scope and the internal `virtual:getvitops/*` module
  ids are unchanged; neither is an import name.

  **Added:** a generated config authoring reference — `vitops docs config`, `docs/config.md`
  in the OKF bundle, and _Config reference_ on the docs site. It is walked from the published
  JSON Schema by the same helper that renders the `design-system.json` reference, so it
  cannot describe a field validation does not accept.

### Patch Changes

- Updated dependencies [6e68ace]
- Updated dependencies [b115993]
  - @getvitops/generator@3.0.0
  - @getvitops/utils@3.0.0

## 2.1.0

### Minor Changes

- 20e518e: Add `vitops indexing` — tell search engines about a deploy, instead of opening Search Console by hand.

  Configure it in your site config under `seo.indexing`, then run it after deploying:

  ```jsonc
  "seo": {
    "indexing": {
      "indexNow": { "key": "…" },
      "searchConsole": { "siteUrl": "sc-domain:acme.ca" },
      "priorityUrls": ["https://acme.ca/", "https://acme.ca/services"]
    }
  }
  ```

  ```
  vitops indexing --dry     # print the plan, make no requests
  vitops indexing           # submit
  vitops indexing --check   # a day or two later: did Google actually index them?
  ```

  It reads your sitemap, diffs it against the previous run, and submits only what changed —
  pinging **IndexNow** and re-submitting your sitemap through the **Search Console API**.
  `--check` inspects `priorityUrls` and exits non-zero on a page Google hasn't indexed, so a
  scheduled CI job can catch a page that quietly fell out of the index.

  **Be clear-eyed about what this can do.** Google exposes no API that requests indexing — the
  button in Search Console isn't available anywhere, URL Inspection is read-only, and the sitemap
  ping endpoint was removed in 2023. IndexNow reaches Bing, Yandex, Naver, Seznam and Yep; Google
  doesn't participate. So this automates every sanctioned step and then verifies the outcome; it
  does not make Google re-index on demand, and nothing can. Google's Indexing API is deliberately
  not wired: it's scoped to job postings and livestreams, and using it for ordinary pages violates
  its terms.

  Also new, and worth wiring at the same time — **`gitLastmod()` for real sitemap dates**:

  ```js
  import vitops, { gitLastmod } from '@getvitops/astro';
  vitops({ sitemap: { serialize: await gitLastmod() } });
  ```

  `@astrojs/sitemap` emits no `<lastmod>` by default, which means a crawler is told your pages
  exist but never that one changed — and it's what lets `vitops indexing` submit a handful of URLs instead
  of all of them. `gitLastmod()` derives each date from the source file's last commit, and leaves a
  page alone rather than guessing (dynamic routes, ambiguous slugs, shallow clones): an inaccurate
  `lastmod` is worse than none, because Google stops trusting the field site-wide.

  Requires `fetch-depth: 0` in CI — the default shallow clone has no history to read, and it warns
  when that's the case.

  **Credentials.** IndexNow's key is public by design (it's served at `/<key>.txt` as the ownership
  proof), so it lives in your config, and the Astro integration writes the file into `public/` for
  you — `vitops indexing --new-key` generates one, `--write-key <dir>` writes it for non-Astro stacks.
  Search Console needs a service account in `VITOPS_GSC_SERVICE_ACCOUNT` or
  `GOOGLE_APPLICATION_CREDENTIALS`, added as an owner of the property; it's never read from the
  config file.

  Persist `.vitops/` between runs (a CI cache) — that's the changed-URL state, and without it every
  run submits everything.

  An environment whose `robots` policy says `noindex` is refused outright, so pointing this at
  staging can't publish it to a search engine.

- 9bf975a: Add `vitops media` — encode raw video into web-ready outputs, instead of hand-rolling an ffmpeg
  script per project.

  Keep unprocessed video in a `raw/` directory and run:

  ```
  vitops media --raw raw --out src/assets/processed
  ```

  Each source becomes three files: **VP9/WebM**, an **H.264/MP4** fallback, and a **JPG poster**.
  Import them like any other asset, so your bundler content-hashes them:

  ```astro
  ---
  import hero from '../assets/processed/hero.webm';
  import poster from '../assets/processed/hero.jpg';
  ---
  <video poster={poster.src} autoplay muted loop playsinline>
    <source src={hero} type="video/webm" />
  </video>
  ```

  In Astro it's an integration option — `vitops({ css, media: { raw: 'raw', out: 'src/assets/processed' } })`
  — and it runs in the same pass that generates your CSS. `@getvitops/vite` gains a matching `media`
  option, and `@getvitops/utils/media` exports `processMedia()` for anything else.

  Defaults: capped at 1920px wide, CRF 32, audio dropped (the common case is a muted autoplay loop),
  poster from frame 0. All of them are flags. `--dry` prints exactly what a run would do.

  **Runs are cached**, on source content plus encode settings, in `.vitops/media-manifest.json` — a
  24 MB clip that took 88 seconds the first time takes 0.14 seconds the second. A missing output
  re-encodes; a corrupt manifest re-encodes everything. Neither ever reads as "already done", because
  that failure is silent and no rebuild would fix it.

  **Commit the outputs and the manifest.** A fresh CI clone has neither and would re-encode from
  scratch; committing both means CI never needs ffmpeg. It also keeps your history clean — ffmpeg
  output isn't byte-reproducible across versions, so a CI re-encode would rewrite every video on any
  toolchain bump. Use `--force` when you mean to re-encode.

  **`ffmpeg` is an external tool, not an npm dependency** — install it yourself (`brew install
  ffmpeg`, `apt install ffmpeg`, `winget install Gyan.FFmpeg`). The command fails without it rather
  than skipping: a page referencing a video that was never encoded is broken, not degraded.

  Two defaults worth knowing about. The MP4 exists because older iOS and the in-app webviews inside
  social apps still don't decode VP9, and it's written with `+faststart` — without which a browser
  downloads the whole file before showing frame one. And a poster taken from frame 0 is often black
  on a clip that fades in; that's `--poster-time`, not a bug.

### Patch Changes

- Updated dependencies [20e518e]
- Updated dependencies [9bf975a]
  - @getvitops/generator@2.1.0
  - @getvitops/utils@2.1.0

## 2.0.0

### Minor Changes

- bf453b0: Anywhere the toolchain takes a config, that file may now be a `design-system.json` **or** the larger
  site config that embeds one.

  If you keep your tokens inside a `company.json` / `site.json`, you had to maintain a second file for
  the tooling's sake — or duplicate your whole token set, because a site config must carry a complete
  `designSystem`. Now you point the same option at the file you already have:

  ```js
  // astro.config.mjs
  getvitops({ css: { input: 'company.json', format: 'css' } });
  ```

  ```
  vitops generate --input company.json --format css --out dist
  vitops lint --input company.json --src src
  ```

  The design system is taken from `designSystem.themes[theme]` with its `extends` chain resolved —
  `defaultTheme`, else `default`, else whatever `--theme` / the `theme` option names. Nothing changes
  for a plain `design-system.json`; the two are told apart by shape, not by filename, so you can call
  the file anything.

  **A site config also supplies the site-level facts generation reads**, so the path is declared once
  rather than per option:
  - `designSystem.defaultColorScheme: "system"` — emits the `prefers-color-scheme` block, which is
    what makes `<color-scheme-toggle>`'s System position do anything.
  - `legal.*.enabled` — renders the documents. `legal: {}` is now the whole declaration; `legal.input`
    is optional.
  - `icons.sprite` — builds `icons.svg`.
  - `fonts` — `fonts: true` reads the families from it.

  Each of those is already gated on a field in that config, so nothing new appears unless the config
  asks for it. An explicit `site` option still wins when the two are genuinely different files.

  Also:
  - **`vitops validate` routes on the file's shape.** Pointed at a site config it used to report a
    single `unrecognized_keys` for `designSystem` and nothing about the file's actual contents — a
    wrong answer that reads like a right one. It now validates a site config as one, including the
    cross-field integrity JSON Schema can't express, and checks every theme resolves to a complete
    design system (`validateSite` only checked that the `extends` chain resolved, not what it resolved
    to).
  - **`generate()` gained `theme` and `siteEnv`.** The A/B variant for `siteEnv` is applied before the
    theme is selected, so a variant can override tokens.
  - **The theme editor's Save to source follows the design system into a site config.** Its patch is
    design-system-relative, so the dev server merges into that subtree and writes only the surrounding
    file whole. It locates the subtree in the raw on-disk object rather than the normalised one, so an
    author who wrote either `designSystem` shorthand still gets their own keys edited.

- 04a51d8: Icons: one semantic vocabulary across icon sets, with the bundle derived from your source.

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

  **Renamed, and completed to all four directions.** Chevrons and arrows are the
  one family whose _meaning is_ its direction, and that direction is physical, not
  logical — a chevron in a details marker points down in every writing mode. So they
  are named for where they point: `expand-more`/`expand-less` →
  `chevron-down`/`chevron-up`, and `arrow-forward`/`arrow-back` →
  `arrow-right`/`arrow-left`. `chevron-left`/`chevron-right` keep their names.
  `arrow-up`/`arrow-down` are new, so both families now cover all four directions.
  `lightning` is new.

  If you passed any of the old names to `<Icon />`, `resolveIcon` or an `icons`
  config, update them. They fail loudly rather than silently: an unresolvable
  declared name throws, and `vitops icons` reports scanned ones.

  **Fixed three Font Awesome mappings that named no real glyph** and so rendered an
  empty box: `login`/`logout` were mapped to `login`/`logout` (Font Awesome calls
  them `right-to-bracket`/`right-from-bracket`) and `backup` to `backup`
  (`cloud-arrow-up`). Every value in all four UI sets is now checked against the
  installed collection.

  **Phosphor (`ph`) joins the semantic map**, with all 83 names verified against the real icon set.
  Phosphor keeps every weight in one collection and varies the name (`list`, `list-bold`), unlike Font
  Awesome's per-weight collections, so `resolveIcon` and `generateIconInclude` gained a `weight`
  option for sets shaped that way.

  Fixes: `site.icons` was a closed object, so any icon collection not in its hand-written key list was
  silently dropped during validation — your config passed and the icons never bundled. It accepts any
  collection name now.

- bf453b0: `vitops lint` now catches hand-written CSS that re-implements a framework primitive.

  The existing linter finds classes that resolve to nothing — you named something and it isn't there.
  This is the costlier inverse, where the code **works**: a centred container written by hand, a
  two-column split behind a media query, a flex row. Nothing is broken, so nothing ever surfaces it,
  and the design system quietly stops being where those decisions live.

  Three rules to start, each requiring the combination that makes the intent unambiguous
  (`margin-inline: auto` alone is not a centred track):

  | Found                                                       | Suggested                                                                 |
  | ----------------------------------------------------------- | ------------------------------------------------------------------------- |
  | `max-inline-size: var(--width-*)` + `margin-inline: auto`   | `.centered`, widening a child with `breakout` / `spotlight` / `fullbleed` |
  | `grid-template-columns: 1fr 2fr` inside a `min-width` query | `md-split-1-2` — or `@md:split-1-2` in the tailwind format                |
  | `display: flex` + `align-items: center`                     | `flex items-center`, or `.cluster-start`                                  |

  **Findings now carry a severity, and suggestions do not fail the command.** These are judgement
  calls, and a reuse hint that broke CI on the day it shipped would be a worse defect than the drift it
  reports. `--strict` promotes them for anyone who wants the ratchet. Everything the linter reported
  before is an `error` and still exits 1.

  `.css` files and `<style>` blocks are now read (the class linter only ever looked at markup). The
  generated stylesheet is skipped by its `GENERATED … do not edit by hand` banner rather than by path —
  the `css` format writes `styles.css` into `src/styles`, squarely inside what `--src` scans, and
  linting it made the framework report `.split` as reinventing `.split`.

  Two other gaps closed:
  - **The format-spelling check ran in one direction only.** `md-split-1-2` in a tailwind project was
    caught; `@md:split-1-2` in a css/bricks project was not, because variant stripping removed the
    `@md:` regardless of format and left a bare class that matched nothing. The same silent no-op, in
    the other direction, unreported. Stripping is format-aware now.
  - **`grid-auto` and the whole `m-*` rhythm family were missing from the tailwind format entirely** —
    not dropped via `TW_CLASH`, just never re-emitted when `layout.css` is skipped and a subset
    re-emitted in its place. Unlike the `<bp>-` classes they have no Tailwind equivalent, and unlike a
    misspelt class the linter cannot flag them, because they aren't anchored to your config. They emit
    as `@utility` definitions now, keyed to the same `--rhythm-*` variables as the css format.

  Run against this repo's own docs site, the rules found one real instance on the first pass; it is
  fixed in the same change.

- bf453b0: Maskable favicons are now opaque, so they stop rendering as a logo in a black box.

  `icon-mask.png` is declared `purpose: "maskable"` and `apple-touch-icon.png` is linked on every
  page. Both sit a deliberately-inset logo on a larger canvas — that inset **is** the maskable safe
  zone and was always correct — but the canvas was filled with `alpha: 0`. From any transparent
  source that left 36% of `icon-mask.png` and 40% of `apple-touch-icon.png` transparent, on two files
  whose entire contract is full bleed: the OS crops them to its own shape and composites the rest onto
  whatever it likes, usually black. iOS discards alpha on the apple-touch-icon outright.

  `backgroundColor` was already the obvious input for this and already plumbed — as far as the web
  manifest, and no further. So the raster and the manifest disagreed about the very colour meant to
  sit behind the icon.

  Now:
  - those two outputs are composited onto `backgroundColor`, defaulting to `#ffffff` — the same
    default the manifest's `background_color` already used;
  - `favicon.svg`, `icon-{16,32,192,512}.png` and `favicon.ico` keep the source's transparency, since
    none of them is maskable;
  - a transparent source with no `backgroundColor` set now warns, rather than silently inheriting
    white — a dark logo would lose against it;
  - `icon-192`/`icon-512` declare `purpose: "any"` explicitly. Omitting it was legal (unset means
    "any"), but with a maskable present and nothing claiming "any", some launchers picked the maskable
    — the one with the safe-zone inset — for slots that wanted a plain icon.

  `vitops favicon` gained `--background <hex>`; it previously had no way to set this at all.
  `getvitops({ favicon })` and the Vite plugin now forward the option they were already accepting.

### Patch Changes

- bf453b0: Say plainly that `fonts` in `design-system.json` is stacks only and loads nothing.

  The field's description was complete and self-consistent — "raw font stacks by name, emitted as
  `--font-<name>` tokens" — and told you nothing about where the `@font-face` comes from. Following
  it literally leads to installing a `@fontsource*` package and importing its CSS in a layout, which
  renders correctly and silently gives up subsetting, preload, and the `size-adjust` /
  `ascent-override` fallback metrics: a CLS regression that looks like a working setup.

  The field is unchanged. What changed is that four surfaces now name the boundary and point at the
  fix — declare the family in Astro's `fonts:` config and point the token at its `cssVariable`:
  - the `fonts` description in the JSON Schema, and therefore `vitops docs authoring`
  - `SKILL.md`, which previously never mentioned fonts at all
  - the generated `tailwind.css` header and its `@theme` fonts comment
  - the generated `type-tokens.css` header (css format)

- Updated dependencies [4756788]
- Updated dependencies [bf453b0]
- Updated dependencies [bf453b0]
- Updated dependencies [bf453b0]
- Updated dependencies [bf453b0]
- Updated dependencies [bf453b0]
- Updated dependencies [bf453b0]
- Updated dependencies [bf453b0]
- Updated dependencies [bf453b0]
- Updated dependencies [04a51d8]
- Updated dependencies [bf453b0]
- Updated dependencies [bf453b0]
- Updated dependencies [bf453b0]
- Updated dependencies [bf453b0]
- Updated dependencies [bf453b0]
- Updated dependencies [bf453b0]
- Updated dependencies [bf453b0]
- Updated dependencies [bf453b0]
- Updated dependencies [bf453b0]
  - @getvitops/generator@2.0.0
  - @getvitops/utils@2.0.0

## 1.0.0

### Major Changes

- bb92a14: **The colour system is rebuilt on a target-prefixed grammar and a shared lightness ladder.**
  This is a breaking change to every colour token and utility class.

  ## Why

  Two axes shared one class namespace — functional _planes_ (`--<role>-bg-muted`) and
  appearance-relative _stops_ (`--color-<role>-muted`) — arbitrated by a "plane wins" rule. The
  result was not a scale. On the shipped palette, light mode:

  | class                              | resolved to  | step                                          |
  | ---------------------------------- | ------------ | --------------------------------------------- |
  | `bg-ui-accent-x-muted`             | stop         | 100                                           |
  | `bg-ui-accent-muted`               | plane        | 100 — identical, so `x-muted` was a dead rung |
  | `bg-ui-accent`                     | plane        | 50 — _lighter_ than both its "muted" rungs    |
  | `border-ui-accent-muted` / `-bold` | stop / plane | 300 / 300 — identical                         |
  | `text-ui-accent-bold`              | stop         | 700 — _lighter_ than `text-…-muted` (800)     |

  Every family was non-monotonic, two had duplicate rungs, and `--color-<role>-muted` was
  unreachable through any `bg-` class.

  ## The new grammar

  ```
  --color-<target>-<role>[-<variant>]        target ∈ bg | text | icon | border
  ```

  The target is **inside** the name, so `bg-danger-muted` and `text-danger-muted` are different
  tokens and there is nothing left to arbitrate. **The class name is the token name minus
  `--color-`** — one vocabulary instead of two.

  Variants are ordinal (`xx-muted` < `x-muted` < `muted` < bare < `bold` < `x-bold`) and the
  tables are sparse: only cells that hold their contrast target exist.

  ## Role kinds

  `colors.roles` values may now be `{ hue, kind }` as well as a bare hue string:

  ```jsonc
  "roles": {
    "danger":  "rust",                             // shorthand => chromatic
    "surface": { "hue": "navy", "kind": "surface" }
  }
  ```

  - **`surface`** — a page/panel colour: `bg-<role>` is the card, `bg-<role>-muted` the page
    behind it, `bg-<role>-x-muted` a well, `bg-<role>-bold` the inverse surface. Full text scale.
  - **`chromatic`** (default) — a signal colour: tints (`bg-<role>-x-muted`/`-muted`) and solids
    (`bg-<role>-solid[-bold|-x-bold]`), with **no bare `bg-<role>`** — say how loud you mean.
    `text-on-<role>` is the guaranteed foreground for the solid family.

  ## Palette generation

  Every ramp now sits on one **fixed lightness ladder** (50 → L 0.98 … 950 → L 0.21); only chroma
  and hue vary. That is what makes a step mean the same lightness in every hue. Previously each
  seed transposed the curve, so relative luminance at step 300 ranged from 0.253 to 0.384 across
  the shipped palette — the same variant read differently depending on the role.

  Authored colours are still reproduced **exactly**. A `seed`, an `anchors` entry or a `tones`
  value is pinned verbatim at its nearest step; every other step takes the ladder. Snapping brand
  colours to the ladder was measured and rejected: 11 of 18 real brand hexes moved beyond a
  just-noticeable difference (worst ΔE-OK 0.050 — Facebook's `#1877F2` → `#0067e1`) and six left
  sRGB gamut. Deviation is now bounded and local to pinned steps, and warns past ~0.03 L.

  Two tones that claim the same step now **error** instead of one silently overwriting the other;
  the record form (`tones: { "600": "…", "700": "…" }`) is how you resolve it.

  ## New
  - **`icon-<role>`** — a non-text tier, so a glyph may run more vivid than text. `icon` is now a
    default utility family alongside `bg`/`text`/`border`.
  - **`--color-border-focus`** — the focus-ring tone, taken from `ui-primary`'s solid.
  - **Contrast is enforced at build time**, not only in tests: text ≥ APCA Lc 75 on its primary
    background, ≥ 60 on secondary planes, icons and surface boundaries ≥ 45, both appearances.
    A violation now fails `generate`. Chromatic text is checked against the _surface_ planes it
    actually sits on, not only its own tints. `text-<role>-x-muted` (placeholder) and `-xx-muted`
    (disabled) are explicitly exempt; nothing else is.

  ## Migrating

  Rename `--<role>-<suffix>` → `--color-<target>-<role>[-<variant>]`, and the same for classes:

  | before                                  | after                                                            |
  | --------------------------------------- | ---------------------------------------------------------------- |
  | `--<role>-bg` / `bg-<role>` (chromatic) | `--color-bg-<role>-x-muted` / `bg-<role>-x-muted`                |
  | `--<role>-bg-muted`                     | `--color-bg-<role>-muted`                                        |
  | `--<role>-solid` / `-solid-bold`        | `--color-bg-<role>-solid` / `-solid-bold`                        |
  | `--<role>-on-solid` / `text-on-<role>`  | `--color-text-on-<role>` (class unchanged)                       |
  | `--<role>-text` / `-text-muted`         | `--color-text-<role>` / `-muted`                                 |
  | `--<role>-border` / `-border-bold`      | `--color-border-<role>` / `-bold`                                |
  | `--color-<role>-muted` (stop)           | judge by use: `--color-bg-<role>-muted` or `--color-text-<role>` |

  **`surface` background names rotate**, value-preserving: what was `--surface-bg` (the page) is
  now `--color-bg-surface-muted`; what was `--surface-bg-bold` (raised) is now
  `--color-bg-surface`. Elevation is expressed by which token you reach for — page `bg-muted`,
  card `bg` — rather than a raised/sunken pair, which is what lets a future surfaces axis flatten
  it without touching markup.

  `vitops lint` reports role classes that no longer resolve, and now derives its suggestions from
  what the generator actually emits rather than a hand-maintained list.

### Minor Changes

- bb92a14: Add a fourth output format, `design`, that emits `DESIGN.md` — the agent-facing brief in
  [google-labs-code/design.md](https://github.com/google-labs-code/design.md) format.

  ```sh
  vitops generate --format design --out .     # DESIGN.md, and nothing else
  vitops generate --format css,design         # compose it with a stylesheet
  ```

  The file is YAML front matter carrying the tokens (`colors`, `typography`, `rounded`,
  `spacing`, `components`, cross-referenced with `{group.token}`) followed by a prose body
  carrying the rationale — colour model, fluid scales, layout vocabulary, elevation, shape
  cascade, component tiers, do's and don'ts. Every section is rendered from your config, so
  it cannot describe a system the other formats don't build. Point a coding agent, a Figma
  import, or a designer at this one file when they don't have the toolchain; `vitops docs`
  remains the richer reference for those who do.

  It is emitted with `--out .` in mind: DESIGN.md conventionally lives at a repo root beside
  `AGENTS.md`, not in a build directory.

  Three things the spec cannot express, handled the same way every time and explained in the
  emitted prose so the file is self-describing:
  - **Fluid `clamp()` sizes** → the maximum (desktop) value, since a spec `Dimension` is a
    bare number plus px/em/rem.
  - **Dark mode** → light values only, with the automatic functional flip explained. Role
    tokens are emitted as `{colors.<hue>-<step>}` references into the raw ramps rather than
    flattened hexes, so the role → ramp lineage survives the export — flattening them is
    exactly what breaks dark mode downstream.
  - **A `50%` radius** → dropped from `rounded` (it is not a `Dimension`) and named in the
    Shapes prose instead, so nothing is silently lost.

  **New:** an optional `meta` key in `design-system.json` (`{ name, description }`) supplies
  the brand name and the Overview paragraph. It affects no other format.

  **New:** `StylesheetFormat` (`Exclude<Format, 'design'>`), exported from
  `@getvitops/generator`. `@getvitops/astro`'s `css.format` now takes that narrower type —
  `design` produces no stylesheet to inject, so passing it there is a type error rather than
  a missing-file failure at build time. `vitops lint --format` is likewise restricted to the
  three CSS formats. No change for anyone already passing `tailwind`, `css` or `bricks`.

- bb92a14: Generate legal documents from your site config

  `vitops legal` renders a privacy policy, terms of service and cookie notice from a site
  config, in markdown, HTML or EmDash Portable Text:

  ```sh
  vitops legal --out ./content                 # every enabled document, as markdown
  vitops legal --doc privacy --format html     # one document, as an HTML fragment
  ```

  The documents are **derived from your config**, not filled into a form. The analytics
  provider they name is the one whose ID you set; the personal information they list is what
  your configured forms actually collect; the countries they name come from the providers you
  use. So a provider swap updates the policy on the next build, and the fix for a wrong policy
  is a corrected config — hand-editing the output is overwritten.

  Enable documents under `legal`, which gains the facts the prose asserts:

  ```jsonc
  {
    "legal": {
      "jurisdiction": "ca", // only 'ca' (PIPEDA) ships today
      "privacyPolicy": {
        "enabled": true,
        "lastUpdated": "2026-08-01",
        "retention": "24 months after our last contact with you",
        // Third parties the config cannot imply. Analytics, Turnstile and your
        // deploy platform are detected automatically — list only the rest.
        "processors": [
          {
            "name": "Stripe",
            "purpose": "payment processing",
            "country": "the United States",
          },
        ],
      },
      "termsOfService": { "enabled": true },
      "cookieConsent": {
        "enabled": true,
        "type": "opt-in",
        "categories": ["Essential", "Analytics"],
      },
    },
  }
  ```

  Delivery, by stack:
  - **Any stack** — `vitops legal`. No integration code; prints to stdout without `--out`.
  - **WordPress/Bricks** — `vitops generate --site <path>` also writes `dist/legal/*.html`, and
    the theme loader now registers `[vitops_legal doc="privacy"]` to render one in a page. The
    document updates on the next deploy with no action in WordPress.
  - **Astro** — `getvitops({ legal: { input: 'site.json', out: 'src/content/legal' } })` writes
    markdown into a content collection and re-renders when the site config changes. It needs a
    `css` config (that is what registers the Vite plugin); without one, use the CLI.
  - **EmDash** — `--format portable-text`, pasted into the admin.

  Also new on the public API: `generateLegal()`, `renderMarkdown()`, `renderNodes()`,
  `derivePolicyVars()`, `parseMarkdown()` / `toHtmlFragment()` / `toPortableText()`, and
  `resolvePrivacyContact()`.

  Two things to know before you publish anything this produces:
  - **It is not legal advice.** Every document opens with a review banner saying so. The
    bundled terms-of-service prose in particular is generic website boilerplate and
    deliberately does not cover sales, refunds, subscriptions, accounts or user-generated
    content — a site doing any of those needs clauses drafted for it.
  - **It is only as true as your config.** A policy asserting things your site does not do is
    worse than no policy. Check that the config describes reality before you ship the output.

  `validateSite` now rejects a config that enables a privacy policy without a contact for
  privacy requests or a `domains.canonical`, since both are interpolated into sentences that
  would otherwise render blank.

### Patch Changes

- Updated dependencies [bb92a14]
- Updated dependencies [bb92a14]
- Updated dependencies [bb92a14]
- Updated dependencies [bb92a14]
- Updated dependencies [eeb059f]
  - @getvitops/generator@1.0.0
  - @getvitops/utils@1.0.0

## 0.9.0

### Minor Changes

- **The `tailwind` format now emits the full role colour vocabulary.** It previously emitted only
  the functional role utilities, so 87 classes — `bg-<role>-x-muted`, `bg-<role>-bold`,
  `bg-<role>-x-bold`, `text-<role>-bold`, `text-<role>-x-bold`,
  `border-<role>-{muted,x-muted,x-bold}`, for every role — existed in the `css` and `bricks`
  outputs and silently did nothing in `tailwind`. Nothing in the test suite built the tailwind
  format, so the divergence was invisible; it was found by a consumer who hand-forked four
  background planes into their own stylesheet to work around the absence.

  All three formats now render from one emitter (`roleColorUtilities()`), which resolves the
  plane-vs-stop namespace collision explicitly instead of relying on the CSS minifier dropping a
  shadowed rule. No class changes meaning, and the `css`/`bricks` output is unchanged.

  Also fixed in the tailwind format:
  - `colors.utilities` is now honoured. It was hardcoded to `bg`/`text`/`border`, so enabling
    `outline`/`fill`/`stroke` worked in `css`/`bricks` and was ignored here. (For raw hue scales
    it remains a floor rather than a ceiling — those are `@theme` colours, and Tailwind derives
    every colour family from them on demand.)
  - **Component container queries are no longer stripped.** The pass that drops the framework's
    pre-expanded `md-*` breakpoint utilities (Tailwind regenerates those as `@md:`) matched every
    `@container (min-width: …)` block, including component behaviour — most visibly the
    sitenav's, so `.sitenav--bp-{sm,md,lg,xl}` were removed and the nav stayed in its mobile
    layout at every width.

  New: **`vitops lint`** reports framework classes in your source that resolve to nothing — the
  failure mode where an unknown utility looks exactly like a working one. It is format-aware
  (`md-flex-row` is a real class in `css`/`bricks` and inert in `tailwind`) and only judges
  classes anchored to your own config, so it stays quiet on Tailwind's utilities and your own.

  ```
  vitops lint --format tailwind --src src
  ```

### Patch Changes

- Updated dependencies
- Updated dependencies
- Updated dependencies [c949cae]
- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @getvitops/generator@0.9.0
  - @getvitops/utils@0.9.0

## 0.8.0

### Minor Changes

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

- 58cb3d7: Fix two wrong paths in the live-editor manifest, and surface token-namespace collisions.

  **`validate()` now returns `warnings: string[]`** alongside `ok`/`data`/`errors`, for configs that
  parse and generate but won't behave as authored. `vitops validate` prints them. The field is always
  present, so existing code reading `ok`/`errors` is unaffected.

  The first warning covers a collision the flat `--<prop>-<name>` grammar allows: a `patterns.radii`
  key named after a pattern claims the same variable. The example config hits it —
  `patterns.radii.card` and the `card` pattern both want `--br-card`:

  ```
  ! patterns.radii.card collides with the "card" pattern on --br-card;
    the pattern's override hook wins — rename the radius
  ```

  **`design-manifest.json` reverse-index fixes** (affects the live editor's edit-to-config mapping):
  - Numeric colour steps mapped to `colors.palette.<hue>.seed`. The seed regenerates the whole ramp,
    so every step of a hue collapsed onto one path and editing two steps would silently keep one.
    They now map to `colors.palette.<hue>.anchors.<n>` — the schema's step → colour override.
  - `--br-<name>` resolved to `patterns.radii.<name>` even when a pattern owned the variable. Radii
    are now applied last and only where a pattern hasn't claimed it, matching what the CSS actually
    does.

### Patch Changes

- 611f340: `.cta` now defaults to the `ui-primary` role instead of `brand-primary`.

  The three tiers of one interaction family had split colour lineage: `:where(button, .btn)` and
  `:where(a, .link)` resolved to `ui-primary` while `.cta` alone used `brand-primary`. For a project
  whose brand and UI hues differ, that meant the focus ring changed colour depending on which tier
  you tabbed onto.

  Semantically the ui role is also the better fit — `brand-*` is identity, `ui-*` is the interface
  responding to you, and a CTA's prominence already comes from its fill, weight and padding rather
  than from borrowing the brand hue. Keeping brand as an explicit opt-in means a genuine brand moment
  still carries signal, and a rebrand restyles brand surfaces instead of silently restyling every
  form's submit button.

  **Migration:** none if `brand-primary` and `ui-primary` map to the same hue (the common case, and
  true of the example config). If they differ and you want the previous colour, add the new
  `.cta-brand-primary` variant — `brand-primary` has been added to `cta.roles`, so a brand-coloured
  CTA is reachable as a class rather than being unavailable.

- 46b129d: Make the dark-mode flip reachable outside Bricks.

  The dark functional-token block was emitted under `:root[data-brx-theme="dark"]` only.
  `data-brx-theme` is Bricks' own attribute — Bricks sets it, nothing else does — so on every other
  target the dark flip was unreachable. In particular the shipped `<color-scheme-toggle>` web
  component writes `documentElement.dataset.theme` (i.e. `data-theme`), so clicking "Dark" set an
  attribute no rule matched and the page stayed light.

  The block now matches `:root[data-brx-theme="dark"], :root[data-theme="dark"]`, which fixes the
  component everywhere without changing what Bricks already does. No migration needed.

  Note this covers the _explicit_ choice only. There is still no `prefers-color-scheme` block, so the
  toggle's "System" position resolves to light. Adding one would flip every existing consumer site
  dark for dark-OS users, which is a product decision rather than a bug fix.

- aa2863d: Persist the colour scheme across navigations, and drop the UA body margin.

  **The colour scheme now sticks.** `<color-scheme-toggle>` records the explicit choice in
  `localStorage` (`vitops-color-scheme`) and restores it on load. Previously every navigation reset
  to System — the component defaulted to `system` on each page and its `disconnectedCallback` even
  deleted the attribute on unmount, so the scheme was per-page state rather than a user preference.
  Choosing System clears the key, so a visitor can go back to following their OS.

  `<Head />` from `@getvitops/astro` now also emits a tiny synchronous script that applies the stored
  value **before first paint**. Without it the persisted choice would still work, but every page
  would render light and flip once the deferred element bundle upgraded. A test asserts the storage
  key stays in step between the two (they can't share an import: core exports only prebuilt bundles,
  and the Head script must be a literal in the emitted HTML).

  **`body { margin: 0 }`** is now part of the framework. The UA's 8px margin offset every full-bleed
  surface — sticky headers and `bg-*` bands rendered inset with a sliver of canvas around them, since
  the framework owns page gutters through `.centered`'s `--gutter`. This is the only UA reset the
  framework makes; it deliberately still ships no general reset (no global `box-sizing` change),
  which would silently reflow existing layouts.

  **Migration:** if you were compensating for the body margin with a negative offset or your own
  `body { margin: 0 }`, you can drop it. Sites relying on the 8px inset will need to add their own
  padding.

- Updated dependencies
  - @getvitops/generator@0.8.0
  - @getvitops/utils@0.8.0

## 0.7.0

### Minor Changes

- 44de07f: Split the button pattern into two tiers named by intent: `.cta` (persuasion) and `.btn`
  (affordance).

  **Breaking: a bare `<button>` is no longer a filled brand-primary button.** It now renders as a
  quiet interactive control — geometry, cursor, subtle hover, focus ring — with no fill, no
  `font-weight: 600`, and no shadow.

  **Migration:** add `class="cta"` to any button that should stay prominent. Submit buttons, hero
  actions, and anything driving a conversion are the usual candidates; dialog closes, toolbar
  buttons, icon buttons and toggles should keep the new default. If you want the old behaviour
  globally, set `patterns.items.btn` in your `design-system.json` back to the previous filled base.

  New in this release:
  - **`.cta`** — filled, bolder, roomier, lifts on hover. It is a class, not an element rule, so it
    finally works on `<a>` — which is what a call to action usually is, since it navigates. Role
    variants: `.cta-{success,danger,warning,info}`.
  - **`.btn`** — the affordance tier. Emitted as one zero-specificity `:where(button, .btn)` rule, so
    a bare `<button>` gets it with no class, `.btn` carries it to any other tag, and any explicit
    class (including `.cta`, or a component's own class) overrides it without `!important`.
  - **`:where(a, .link)`** — the link pattern now pairs its element with a class the same way.
  - A pattern may now set **both `element` and `class`**, emitting one combined
    `:where(<element>, .<class>)` rule. This is the general mechanism behind the above.
  - A pattern may declare **`fill: true|false`** to state whether states and role variants drive
    `background-color` (plus `on-solid` text) or `color`, instead of relying on the previous
    inference from the pattern's name and base declarations. Existing configs are unaffected — the
    old inference is still the fallback.

  **Breaking: `chip` is retired as vocabulary.** The two small-label patterns are now split by
  behaviour, not size: **`badge`** is a _static_ label (status, count, category) and **`tag`** is an
  _editable and/or dismissable_ one (e.g. entries in a filter list).
  - `.chip-list` → **`.tag-list`**, and its `--*-chip-list` / `--chip-list-focus-color` tokens →
    `--*-tag-list` / `--tag-list-focus-color`.
  - `.chip-list__chip` and `.chip-list__chip-remove` are **removed**. A tag list is a list of tags, so
    its items are now the existing `.tag` / `.tag__remove` — which also means they pick up tag role
    variants. **Migration:** replace `<span class="chip-list__chip">x <button
    class="chip-list__chip-remove">` with `<span class="tag">x <button class="tag__remove">`. Note the
    items change appearance: `.tag` is outlined (border + neutral text) where the old chip was filled
    with `--color-surface-muted`.
  - The `radii.chip` primitive is **removed** from the example config; it was only ever an alias of
    `--br-tag`. Consumers who set `--br-chip` should use `--br-tag`.

  **Pattern geometry now resolves through the group alias layer.** Every grouped pattern already
  emitted `--<prop>-<name>-group` aliases (e.g. `--br-btn-group: var(--br-control)`), but most
  patterns bypassed them and hard-coded `var(--br-control, …)` into the rule. `btn`, `cta`, `badge`,
  `tag`, `card` and `status` now reference the alias and restate only their deviations via
  `overrides`, so the whole chain — `--p-btn` → `--p-btn-group` → `--p-control` → `--p-default` — is
  live CSS custom properties, inspectable and editable in the browser. Computed values are unchanged.

  Also fixed:
  - Role variants on element patterns were emitted at specificity 0-1-1 (`button.danger`), which
    outranked any plain class. They now emit as `:where(button, .btn).danger, .btn-danger` — both at
    class specificity, and reachable from a non-`<button>` host.
  - The `link` pattern declared `default_role: "brand-primary"` while hard-coding a `ui-primary` base
    colour, so hovering shifted hue instead of intensifying. Its `default_role` is now `ui-primary`.
  - `@getvitops/astro`'s `FormRenderer` defaulted its submit button to `class="btn btn-primary"`, a
    class that never existed and a role that is not emitted; it now defaults to `.cta`.
  - The Tailwind bundle is no longer assembled during `css` / `bricks` builds, where it was computed
    and discarded (it also read every framework partial off disk).

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

### Patch Changes

- @getvitops/generator@0.7.0
- @getvitops/utils@0.7.0

## 0.6.0

### Minor Changes

- 2cc847d: Package-resident agent skill + `vitops docs`:
  - `@getvitops/cli` now ships the `vitops-design-system` agent skill inside the package
    (`skill/SKILL.md`). `vitops agents` no longer emits a generated skill into the repo — it
    symlinks `.agents/skills/` and `.claude/skills/` entries to the installed package (logical
    `node_modules/@getvitops/cli/skill` target, surviving version bumps) and writes the
    AGENTS.md pointer block. Old generated-skill directories are migrated automatically;
    `--docs-dir` keeps the emit-files layout.
  - New `vitops docs [topic]` command prints reference docs to stdout, rendered live from the
    project's `design-system.json` (topics: classes, authoring, formats, color, scales,
    patterns, elements; `--all` concatenates).
  - `renderSkill()` removed from `@getvitops/generator` (superseded by the packaged skill).

### Patch Changes

- Updated dependencies [2cc847d]
  - @getvitops/generator@0.6.0
  - @getvitops/utils@0.6.0

## 0.5.0

### Minor Changes

- Ship design-system context to downstream agents:
  - JSON Schema descriptions: every `design-system.json` and site-config field now carries a
    `description` (authored in the zod schemas via `desc()`), emitted into `schema.json` /
    `site.schema.json` for editor hovers and agent consumption.
  - New generated OKF docs: `authoring.md` (field reference walked from the JSON Schema),
    `formats.md` (tailwind vs css vs bricks, including the TW_CLASH utilities Tailwind
    provides natively), and `concepts/{color,scales,patterns}.md` (seeded OKLCH colour
    system, fluid modular scales, pattern token cascade + override hooks).
  - `vitops agents` now emits a generated `vitops-design-system` agent skill into
    `.agents/skills/vitops-design-system/` (SKILL.md + the docs bundle as `references/`,
    with an idempotent `.claude/skills/` symlink) and writes a compact pointer block into
    `AGENTS.md`. Pass `--docs-dir` for the legacy docs-only layout.
  - `TW_CLASH` and `BASE_HOOK` are exported from `@getvitops/generator`.

### Patch Changes

- Updated dependencies
  - @getvitops/generator@0.5.0
  - @getvitops/utils@0.5.0

## 0.4.0

### Patch Changes

- Updated dependencies [d7e6491]
  - @getvitops/utils@0.4.0
  - @getvitops/generator@0.4.0

## 0.3.0

### Patch Changes

- Updated dependencies
  - @getvitops/utils@0.3.0
  - @getvitops/generator@0.3.0

## 0.2.1

### Patch Changes

- Updated dependencies [d28aae7]
  - @getvitops/generator@0.2.1
  - @getvitops/utils@0.2.1

## 0.2.0

### Minor Changes

- d35515e: Add `vitops agents` — writes a managed, marker-delimited block into a consumer's `AGENTS.md`
  (or `--out CLAUDE.md`) so AI coding agents can discover the CLI and the design-system class/element
  vocabulary. Idempotent (re-run to update between the `<!-- vitops:start -->`/`<!-- vitops:end -->`
  markers) and also emits the OKF docs bundle it points at (`--docs-dir`, default `.vitops/docs`).

### Patch Changes

- Updated dependencies
  - @getvitops/generator@0.2.0
  - @getvitops/utils@0.2.0
