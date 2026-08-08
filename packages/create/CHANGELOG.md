# @getvitops/create

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
