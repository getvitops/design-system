---
'@getvitops/astro': minor
'@getvitops/cli': patch
'@getvitops/create': minor
---

**`@getvitops/astro` (no CSS change; all formats unaffected)**

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
