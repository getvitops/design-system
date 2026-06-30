# ACTIVE PLAN: Get the design system working in Bricks (manager-owned, local WPLocal)

## Context

The deploy bundle is built in `--bricks` mode, where `color.css` and `type-tokens.css` are **stubs** —
Bricks is expected to provide `--color-*`, `--font-*`, and `--text-*` live from its managers. Colours
already have palette JSON (`dist/bricks-colors-{named,semantic}.json`, best-effort). But **fonts + the
fluid type scale have no manager import at all**, so in a real Bricks site the always-emitted
`typography.css` (`.font-*` → `var(--…-fs, var(--text-N))`) and `patterns.css`
(`var(--color-<role>-d)`) reference **undefined** variables → type and component colours don't render.
Goal: close that gap so the system actually renders in Bricks.

**User decisions:** manager-owned (Bricks managers own the tokens; the CSS bundle stays a stub for
them); deploy target is a **local WPLocal** site via `lib/deploy.ts` symlink mode; the type scale
**adopts Bricks' t-shirt naming** (`text-2xs..2xl`) so it's a native, GUI-selectable scale; **emit a
Spacing scale too** but keep it **additive** (leave `layout.css`'s static spacing alone); colour
import stays **best-effort** (the Global Variables schema for fonts/scale is now confirmed — see
below — so only the colour JSON is a guess; tweak in Bricks if a field is off).

**⚠️ Sandbox caveat:** this session runs in a remote container; the WPLocal site is on the user's
machine. So we **build + self-verify artifacts here**, and the **Bricks-side steps (symlink deploy,
Manager imports, visual check) run on the user's machine** per the runbook below.

## Bricks 2.2 findings

- **Color Manager** (best-effort, docs bot-blocked): import/export palettes as JSON; each colour has a
  custom CSS-variable name + light/dark values; on save Bricks generates the `--var: value`
  declarations **and** utility classes. Blocks duplicate variable names across managers.
- **Global Variables Manager (CONFIRMED schema, captured from a real UI export):** variables grouped
  into categories. A category carrying a `scale` object —
  `{scaleScope:"typography"|"spacing", scaleType:"tshirt", scaleNames:[…], prefix:"text-"|"space-",
minFontSize, maxFontSize, minScaleRatio(+Select), maxScaleRatio(+Select), baseline:"m", utilityClasses:[]}`
  — becomes a **GUI-selectable** Typography/Spacing scale (the user picks `text-l`, `space-m`, … from a
  dropdown). Its variables carry `{id, name, value:<clamp()>, category:<catId>, scale:<int offset>,
scaleName}`. Uncategorized variables (e.g. fonts) need only `{id, name, value}`. Import merges by
  name and stores each `value` **verbatim**, so our emitted `clamp()`s survive even if the scale
  metadata isn't a byte-perfect match for Bricks' own generator.

Implication: the **JSON import is now the primary, GUI-integrated path** for fonts + the type/space
scales (it supersedes the earlier guessed-JSON-as-secondary framing). A semicolon CSS-list paste
remains a no-scale manual fallback. **IDs must be deterministic** (a stable hash of the variable name,
not random) so vp's cache and the git diff stay clean across rebuilds.

## Plan (reordered — each step ends green so regressions stay localized)

> **STATUS: EXECUTED** (steps 1–5 here-side; step 6 is the user-machine runbook). Two deviations from
> the written plan, both verified: (a) step 4's dark-remap "fix" was dropped — the emitter was already
> correct (see step 4). (b) An **unplanned** `vite.config.ts` fix was required: `build:docs` tracked
> `src/css/generated/**` as inputs, but the command mutates those files itself (non-bricks → bricks),
> so vp cached the docs bundle against a stale state and served a 0-utility build. Re-keyed its `input`
> to the true sources only (`src/css/*.css`, not `**`). Also note: the `lightningcss-cli` binary ships
> as a Windows stub here — `node node_modules/lightningcss-cli/postinstall.js` materialises the real
> ELF binary (one-time; tied to the in-progress `allowBuilds: lightningcss` change).

1. **Adopt the t-shirt scale in the framework** (`src/design-system.json` + `lib/generate-design-system.ts`).
   Foundational and therefore **first**: the variable _names_ change everywhere downstream.
   - `typeScale` → t-shirt: `names: ["2xs","xs","s","m","l","xl","2xl","3xl"]`, `baseStep: 4`,
     `baseline: "m"`, `base: "1rem"`. `fluidScale` emits `--text-<name>`. **`m` is the conventional
     1rem (16px) base** and the value anchor == GUI baseline, so they agree (no metadata caveat). Body
     is `m`; the 8th step (`3xl`) gives `display` headroom above. (Superseded the initial
     value-preserving 7-step map per user: "m should be 1rem like most design systems".)
   - Rewrite each `typography.roles[*].size` one step up from the 7-step map: display→`3xl`,
     title→`2xl`, heading→`xl`, lead→`l`, body→`m`(1rem), quote→`xl`, caption/eyebrow→`s`,
     footnote→`xs`; `code`/`tag` stay literal.
   - Rebuild standalone (`vp run build:docs`) and confirm the docsite still renders — the `.font-*` →
     `--text-*` chain now resolves under the renamed vars.
2. **Graceful literal fallback in the typography emit** (so the bundle isn't broken pre-import in
   Bricks): emit each size as `var(--<role>-fs, var(--text-<name>, <maxrem>))`, where `<maxrem>` is the
   step's max from `fluidScale`. The typography emitter currently passes the size string through
   verbatim, so this needs `fluidScale` to **surface the per-step max rem** to the typography emit —
   a real wiring change, not a one-liner.
3. **New `bricks-variables.json` emitter** (`lib/generate-design-system.ts`, **always emitted** like
   `bricks-colors-*.json`), using the confirmed schema above:
   - `categories`: **Typography** (`scaleScope:"typography"`, `prefix:"text-"`) + **Spacing**
     (`scaleScope:"spacing"`, `prefix:"space-"`), each `scaleType:"tshirt"`, with `scaleNames`,
     `min/maxFontSize`, `min/maxScaleRatio(+Select)`, `baseline:"m"`, `utilityClasses:[]`. Derive the
     scale params from each scale's config (best-effort).
   - `variables`: `text-*` + `space-*`, each `{id,name,value:<clamp()>,category,scale:<offset from m>,
scaleName}`; plus **fonts** as uncategorized `{id,name,value}` (`--font-display/sans/mono`).
   - **Deterministic ids** = stable hash of the name (not random — `Math.random` is unavailable in the
     generator anyway and would break vp caching / git cleanliness).
   - Add a `spaceScale` to `design-system.json` (same shape as `typeScale`). Per the **additive**
     decision: also emit `--space-*` into the standalone scale-token CSS (non-bricks) / stub (bricks),
     but **leave `layout.css`'s `--gutter`/`--rhythm-*`/`--width-*` untouched**.
   - _(Optional secondary)_ `dist/bricks-variables.css` semicolon paste-list — manual fallback, no GUI
     scale integration.
4. **Colour palette JSON — verify only (no code change).** Re-check on execution: the emitter is
   already correct — it emits `darkModeEnabled:true` + the real dark ref for every role whose dark step
   differs (surface/success/neutral via `invert`/`dark`; 19 such entries in the shipped JSON). The
   `darkModeEnabled:false` rows are roles with no dark difference (brand-primary/info/danger/warning) —
   correct by design, **not** a bug. The earlier "dark is a no-op" finding was wrong. The only real
   caveat stays: light/dark/raw are `var()` **references**, not literals — keep the runbook check that
   imported swatches resolve to real colours (the likeliest silent-import failure).
5. **Verify here** (artifacts + headless proxy test — see Verification).
6. **Theme enqueue + deploy + runbook (user machine):**
   - `bricks-child` `functions.php` snippet enqueuing `get_stylesheet_directory_uri().'/dist/styles.min.css'`
     (confirm whether the child theme already enqueues; add a minimal scaffold in-repo or document).
   - `DEPLOY_LOCAL_PATH=<WPLocal>/…/themes/bricks-child/dist` in `.env`; `vp run deploy` builds then
     symlinks repo `dist/` → theme `dist/`.
   - Runbook: (a) `vp run deploy` once to symlink; (b) Color Manager → import `bricks-colors-named.json`
     then `bricks-colors-semantic.json`, **confirm swatches resolve**; (c) Global Variables → **drag
     `bricks-variables.json`** → Typography + Spacing appear as GUI-selectable scales, fonts land
     uncategorized; (d) save builder; (e) enqueue the stylesheet if not already; (f) open a page and
     confirm type + colours + dark flip.
   - **No `vite.config.ts` change:** `generate:theme` `output` already globs `dist/bricks*` (covers the
     new JSON) and `src/css/generated/**` (covers the scale CSS).

## Verification

- **Here (artifacts):** `bricks-variables.json` parses; has `Typography` + `Spacing` categories
  carrying `scaleScope`/`prefix`/`baseline`, `text-2xs..2xl` + `space-2xs..2xl` variables with
  `scale`/`scaleName`/`clamp()` values, and uncategorized `--font-*`; **ids byte-identical across two
  runs** (deterministic). `type-tokens.css` (non-bricks) emits `--text-2xs..2xl` + `--space-2xs..2xl`;
  `--bricks` → stub. `typography.css` sizes read `var(--<role>-fs, var(--text-<name>, <maxrem>))`.
  Colour JSONs emit with `darkModeEnabled:true` + a distinct dark ref.
- **Headless Chromium proxy test:** (a) load `dist/styles.docs.css` → `.font-display` computes a real
  `font-size` (renamed vars resolve). (b) Load bricks `dist/styles.min.css` + inject the
  `bricks-variables.json` values as a `:root` block + Bricks-like markup → `.font-display` sizes and a
  `<button>` gets a non-empty `background-color`. (c) **Without** the injected vars, the step-2 literal
  fallback still yields a real `font-size` (graceful degradation).
- **User machine (end-to-end):** runbook → a Bricks page shows correct fonts, fluid sizes, and semantic
  colours; Typography/Spacing scales are selectable in the GUI; dark mode flips via the Color Manager.

## Critical files

- `src/design-system.json` — `typeScale` → t-shirt (`names`/`baseline`); new `spaceScale`; rewritten
  `typography.roles[*].size` refs.
- `lib/generate-design-system.ts` — `fluidScale` t-shirt names + surface per-step max rem; typography
  literal fallback; new `bricks-variables.json` emitter (deterministic ids; Typography + Spacing +
  uncategorized fonts); colour-JSON dark-remap fix.
- `bricks-child/functions.php` (snippet/doc) — enqueue `dist/styles.min.css`.
- `.env` — `DEPLOY_LOCAL_PATH` (user machine).
- _(vite.config.ts — **no change**; `dist/bricks*` + `src/css/generated/**` already cover the new outputs.)_

---

---

# (DEFERRED) Adopt DESIGN.md + W3C DTCG + OKF (per-client tokens, agent-legible)

## Context

`design-system.json` → `lib/generate-design-system.ts` already fans one source of truth
out to multiple consumer formats (standalone CSS, Bricks stub + palette JSON). Two emerging
Google specs now matter for this engine:

- **DESIGN.md** (`google-labs-code/design.md`, alpha) — a single file: YAML front-matter tokens
  (`colors`, `typography`, `rounded`, `spacing`, `components`; refs via `{group.token}`) + a
  markdown prose body explaining _why_. It is meant to give AI coding agents a persistent,
  structured understanding of a visual identity. Ships a CLI: `lint` (validate + WCAG contrast +
  broken-ref checks → JSON), `diff`, and `export --format {json-tailwind|css-tailwind|dtcg}`.
- **W3C DTCG `tokens.json`** — the standards-compliant machine token format (`$type`/`$value`,
  `{path.to.token}` refs). DESIGN.md exports to it; it unlocks Tailwind and the wider tooling
  ecosystem. The repo emits **no** standard token format today (only Bricks JSON).
- **OKF** (`GoogleCloudPlatform/knowledge-catalog`, v0.1) — a _directory_ of markdown "concept"
  files with YAML front-matter (only `type` required; `title`/`description`/`resource`/`tags`/
  `timestamp` optional), cross-linked by ordinary markdown links into a knowledge graph. Vendor-
  neutral curated context for agents. No schema registry, no required tooling.

**The framing that drives the design:** this repo is _the schema + build_; **each client has
different token _values_**. That splits cleanly into three layers:

| Layer                                                                                                                                              | Lives in                                       | Per-client?   | Standard that fits                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ------------- | ------------------------------------------------------------ |
| **Behaviour/structure** — ramp step names, invert/dark resolution rules, fluid clamp math, pattern cascade, role→token definitions, utilities list | the build (framework config)                   | shared        | (none — stays our schema)                                    |
| **Token _values_** — ramp hexes, font stacks, type base/ratio, shadow/radius values, semantic→ramp mapping                                         | per-client tokens file                         | **yes**       | **DTCG tokens.json** (precise) + **DESIGN.md** (agent brief) |
| **Knowledge** — how the vocabulary works                                                                                                           | `AGENTS.md`/`CLAUDE.md`/`README` (prose today) | mostly shared | **OKF bundle** (+ per-client DESIGN.md as one concept)       |

Outcome: every client build becomes standards-interoperable (W3C/Tailwind), legible to AI agents
(DESIGN.md + OKF), and the per-client values are cleanly separated from the shared build.

## Decision points (assumed defaults — confirm/redirect on approval; AskUserQuestion was unavailable)

1. **Direction = Emit** (generator _produces_ DESIGN.md + DTCG alongside CSS/Bricks; `design-system.json`
   stays the rich source of truth). A DESIGN.md→seed importer is deferred to Phase 4.
2. **Scope = Factor out a per-client token layer** (Phase 2), but only _after_ the zero-refactor
   emit (Phase 1) is working. No build-time client _selection_ yet (that's a later, larger step).
3. **Formats = all three**, phased: DTCG + DESIGN.md first (Phase 1), OKF bundle next (Phase 3).

If you'd rather stay single-client / formats-only, drop Phase 2. If DESIGN.md-as-input matters
more than emit, we'd swap Phases 1 and 4.

---

## Impedance mismatch (decided handling)

DESIGN.md/DTCG are flat-ish; our schema is not. Resolutions baked into the plan:

- **Fluid type sizes are `clamp()`** — not a DTCG `dimension` nor a DESIGN.md size. → Emit the
  **max** rem as the canonical `$value`/size; stash the full fluid spec (min, vw, ratios) under
  DTCG `$extensions.com.vitops.fluid`. DESIGN.md prose notes the scale is fluid.
- **Dark mode** — neither spec has first-class theming. → DTCG: semantic tokens reference the
  _light_ named token; per-step dark ref goes under `$extensions.com.vitops.dark`; also emit a
  resolved `tokens.dark.json` for tools that want a second file. DESIGN.md: `colors` carry light
  values; the prose body explains the invert/remap model.
- **Pattern _behaviour_** (states: step/scale/lift/ring) is not tokens → excluded from DTCG.
  Only the static cascade _values_ (radius/padding/border from `patterns.defaults`+`groups`) and
  the role→colour bindings surface, the latter as DESIGN.md `components`.
- **Semantic per-step** (`--color-success-d`, …) → emitted as a DTCG `color.<role>.<step>` group
  of refs to the named ramp.

---

## Phase 1 — Emit DESIGN.md + DTCG tokens.json (zero refactor)

Add two emitters to `lib/generate-design-system.ts`, always emitted (like the Bricks JSON), reusing
the existing `named`/`semantic`/`normalize`/`darkStep`/`fluidScale`/`typography` machinery.

- **`dist/tokens.json` (W3C DTCG)** — groups: `color` (named ramps + `semantic` refs, dark under
  `$extensions`), `fontFamily`, `typography` (composite per role: family/size(max)/weight/
  lineHeight/letterSpacing, fluid under `$extensions`), `shadow`, `radius` (from pattern `br`
  tokens), `zIndex` (number). Optionally also `dist/tokens.dark.json` (resolved dark).
- **`DESIGN.md`** (repo root or `dist/`) — YAML front-matter: `name`, `description`, `colors`
  (flattened named + semantic, light hex), `typography` (roles → DESIGN.md typography objects,
  size = max rem), `rounded` (from `br` cascade), `spacing` (from pattern padding + gutter; minimal
  until a spacing layer exists), `components` (button/link/badge/card → backgroundColor/textColor/
  typography/rounded/padding refs). Then a generated **prose body** (templated shared sections +
  client specifics): colour philosophy (named ramps + semantic + invert/dark), fluid typography,
  layout vocabulary, patterns, animation. Source the brand `name`/`description` from a new optional
  `meta` key in `design-system.json`.
- **`vite.config.ts`**: add `DESIGN.md`/`dist/tokens*.json` to `generate:theme` `output`.
- **Optional CLI hook**: a `lint:design` task running design.md's CLI
  (`bunx @design.md/cli lint DESIGN.md`) for contrast/ref validation. Their CLI can also produce
  Tailwind output for free, so we needn't reimplement that.

Representative emitter shape (mirrors the existing `namedColors`/`semanticColors` builders at
`lib/generate-design-system.ts:433-471`):

```
const dtcgColor = { $type: 'color', /* named ramps + semantic refs */ };
const dtcgType  = { $type: 'typography', /* per role, fluid in $extensions */ };
writeFileSync(join(distPath,'tokens.json'), JSON.stringify({color:dtcgColor, typography:dtcgType, ...}, null, 2));
```

## Phase 2 — Factor out the per-client token layer

Split `src/design-system.json` along the table above:

- **`src/framework.config.json`** (shared, client-invariant): step names/order, `colors.utilities`,
  `typeScale` _math_ (ratio/steps/baseStep/fluid), `patterns` (defaults/groups/z/items behaviour),
  `typography.roles`+`families`+`headings` _definitions_ (which token each role consumes).
- **`src/client.tokens.json`** (per client, the part DESIGN.md/DTCG occupy): named ramp hexes,
  `colors.semantic` mapping (name/invert/dark — per-client because it's that brand's roles),
  `fonts` stacks, `typeScale.base`, `shadows` values, `meta` (name/description).
- Generator deep-merges `framework.config` + `client.tokens` into today's in-memory shape; the rest
  of the pipeline is unchanged. This makes Phase 1's DTCG emit ≈ a re-serialisation of
  `client.tokens.json`, and sets up a future world where the per-client file _is_ DTCG.

(No client _selection_ logic yet — still one client per repo/`.env`. Full multi-client — a
`clients/<name>/` dir chosen at build/deploy — is a later, explicitly-scoped step touching
`generate-design-system.ts` + `lib/deploy.ts`.)

## Phase 3 — OKF knowledge bundle

Author `knowledge/` as an OKF v0.1 bundle: one concept md per framework area, each with `type:`
front-matter, cross-linked by markdown links. Concepts (shared, hand-authored once, migrating
content from `AGENTS.md`/`CLAUDE.md`): `color.md`, `typography.md`, `layout.md`, `rhythm.md`,
`patterns.md`, `animation.md`, `bricks-output.md`, `build.md`, plus `design-system.md`
(type: design-system) that links to the **generated per-client `DESIGN.md`**. Verify OKF's small set
of reserved filenames against `knowledge-catalog/okf/SPEC.md` before naming the index file.
`AGENTS.md`/`CLAUDE.md` link into the bundle rather than duplicating it.

## Phase 4 — (deferred) Import / round-trip

A `DESIGN.md`→`client.tokens.json` seeder so a new client can start from a standard brief, and a
`diff` gate so token changes are reviewable. Optional parity with design.md's own `lint`/`diff` in
CI.

---

## Critical files

- `lib/generate-design-system.ts` — two new emitters (DTCG + DESIGN.md); reuse `named`/`semantic`/
  `normalize`/`darkStep`/`fluidScale`/`typography` builders.
- `src/design-system.json` — add optional `meta` (name/description) now; split into
  `framework.config.json` + `client.tokens.json` in Phase 2.
- `vite.config.ts` — extend `generate:theme` outputs; optional `lint:design` task.
- `knowledge/*.md` (new, Phase 3) — OKF bundle; `AGENTS.md`/`CLAUDE.md` link in.
- `index.html` / docs — optionally surface a "Tokens & agent formats" section linking the emitted files.

## Verification

- `node lib/generate-design-system.ts` emits `dist/tokens.json` (+ `tokens.dark.json`) and `DESIGN.md`.
- DTCG validity: round-trip through a DTCG validator or `bunx @design.md/cli export --format dtcg`
  parity; confirm `{path.to.token}` refs resolve and `$extensions.com.vitops.fluid/dark` carry the
  clamp/dark data.
- DESIGN.md validity: `bunx @design.md/cli lint DESIGN.md` → no broken refs, contrast findings
  reviewed; front-matter parses; prose sections render.
- Token fidelity: spot-check that `color.pine.base`, `color.brand-primary.d`, a fluid `typography.*`
  max size, and `radius.*` match `src/css/generated/*` and the Bricks JSON for the same client.
- Phase 2: `framework.config.json` + `client.tokens.json` merged → byte-identical generated CSS /
  Bricks JSON vs the pre-split baseline (pure refactor, no output change).
- Phase 3: OKF bundle passes a front-matter `type` check on every file; markdown cross-links resolve;
  `design-system.md` points at the generated `DESIGN.md`.

---

---

# (COMPLETED) Dogfood the docsite (own fonts + fluid type scale; non-bricks docs build)

> Prior phases (gale removal, token cascade + `.font-*` typography) are **DONE & pushed** (commit `c864585`). That earlier plan is retained below for reference.

## Context

The user wants `index.html` to actually **show the design system** and to **dogfood** it (use real framework classes; avoid doc-specific styles unless necessary). Investigation found the docsite barely renders standalone:

- `index.html` has **no `<style>` block and no token definitions**; every doc-local class (`.why`, `.diagram`, `.controls`, `.cards`, `.note`, galleries) is undefined, and it inline-references `--color-*`.
- The shipped bundle is built in **`--bricks` mode**, so `color.css` is a stub → no `--color-*` tokens / `.bg-*`/`.text-*` utilities standalone.
- **`--font-display/sans/mono` and `--text-1..7` are defined nowhere** in the framework (typography.css and the old layout type classes both referenced them, expecting Bricks). So type doesn't render in any mode standalone.

**User decisions:**

1. View the docsite **standalone/static** (must be self-sufficient).
2. Extend the **dual-output model** (already used for colors) to **fonts + fluid typography** (and, by the same mechanism later, spacing): _outside Bricks the generator emits all the CSS using the same variable names; in Bricks it emits JSON for the managers and only the CSS the managers don't auto-generate._
3. The docsite consumes a **non-`--bricks` standalone build**.

Outcome: a self-sufficient, dogfooded docsite, and a framework whose type system renders standalone (not only under Bricks).

## Scope decisions (flagged for approval)

- **Fonts + fluid type scale now**; **spacing** deferred to a follow-up using the identical mechanism (layout already defines its own `--gutter`/`--rhythm-*`/`--width-*`, so spacing isn't blocking the docsite).
- **Bricks Font/Typography manager JSON is deferred** (needs Bricks' exact manager import schema, which we don't have — guessing risks a wrong format). For now, bricks mode **stubs** the font/type tokens (status quo: Bricks provides them); non-bricks emits the full CSS, which is all the docsite needs. The JSON emitters can be added once the manager format is confirmed.

---

## Part A — Framework owns fonts + fluid type scale (dual output, mirrors colors)

### A1. Schema (`src/design-system.json`)

Add two top-level keys:

```jsonc
"fonts": {                         // → --font-<name>
  "display": "'Mulish', system-ui, sans-serif",
  "sans": "system-ui, -apple-system, 'Segoe UI', sans-serif",
  "mono": "ui-monospace, 'Cascadia Code', monospace"
},
"typeScale": {                     // → --text-1 .. --text-<steps>, fluid clamp()
  "base": "1.125rem",              // --text-3 (body) anchor
  "ratio": 1.2,                    // modular ratio between steps
  "steps": 7,
  "fluid": { "minVw": "22.5rem", "maxVw": "80rem", "minRatio": 1.12 }  // ratio shrinks on small screens
}
```

Family names map to the existing `typography.families` (`var(--font-display)` etc.), which now resolve.

### A2. Generator (`lib/generate-design-system.ts`)

New **bricks-gated** emitter (parallel to `color.css`) → `src/css/generated/type-tokens.css`:

- **non-bricks:** `:root { --font-display/sans/mono; --text-1..7; }`. Emit `--text-n` as fluid `clamp(min, preferred, max)` computed from `base`/`ratio`/`fluid` (port the modular approach from `old-css-lib/typography.css:18-55`, expressed as clamp per step so it's fluid without a container-query `@property` dependency).
- **bricks:** one-line stub (Bricks Font + Fluid Typography managers provide these), matching the `color.css` stub pattern.
- Reuse the existing `decls()` helper. Add `✓` log.
- The **`.font-*` role classes (`typography.css`) keep always-emitting** (Bricks doesn't auto-generate role classes) — unchanged.
- Extend the `DesignSystem` interface with `fonts?` and `typeScale?`.

### A3. Manifest (`src/css/index.css`)

Import `./generated/type-tokens.css` **before** `./generated/typography.css` (and before `tokens.css`, since group defaults may reference type later). New order:
`animation → color → shadows → type-tokens → tokens → typography → layout → patterns`.

### A4. Optional: enable bare-heading roles

Set `typography.headings` (e.g. `h1→display, h2→title, h3→heading, h4→heading, h5→body, h6→eyebrow`) so the docsite's `<h2>/<h4>` render without per-element classes (the generator already supports `headings`). This is a framework feature, not doc-specific.

---

## Part B — Non-bricks docs build (`vite.config.ts`)

Add a `build:docs` task producing a standalone bundle the docsite links, **without disturbing** the bricks deploy bundle (`dist/styles.min.css`):

```
"build:docs": {
  command:
    "node lib/generate-design-system.ts && lightningcss --minify --bundle -o dist/styles.docs.css ./src/css/index.css && node lib/generate-design-system.ts --bricks",
  input: ["lib/generate-design-system.ts", "src/design-system.json", "src/css/**/*.css"],
  output: ["dist/styles.docs.css*"],
}
```

- Runs the generator **non-bricks** (full color + type-token CSS), bundles to `dist/styles.docs.css`, then **regenerates bricks** so the working tree's `src/css/generated/*` ends in canonical (committed) bricks state. The `&&` chain guarantees ordering; keep it a plain command (don't rely on a cached `generate:theme`).
- `index.html` links `./dist/styles.docs.css` (deploy keeps shipping `styles.min.css`).

---

## Part C — Rewrite `index.html` to dogfood

Replace doc-local classes with framework classes wherever an equivalent exists; keep a **minimal `<style>` block only for genuine scaffolding** with no framework analogue. Representative replacements:

| Doc-local now                                             | Dogfood with                                                            |
| --------------------------------------------------------- | ----------------------------------------------------------------------- |
| `.eyebrow-doc`                                            | `.font-eyebrow`                                                         |
| `.why`, `.preview-box`, `.comp-cards` cells               | `.card`                                                                 |
| `.cards`, `.comp-row`, `.comp-links`                      | `.flex` (+ `.align-*`/`.justify-*`) or `.split-*`                       |
| `.note`                                                   | `.font-caption` / `.font-footnote`                                      |
| section bodies (prose)                                    | wrap in `.rhythm`; paragraphs `.font-body`; headings auto-styled via A4 |
| color swatches inline `style="background:var(--color-…)"` | `.bg-*` / `.text-*` utilities (now present in the non-bricks bundle)    |
| buttons / links / badges / cards                          | already framework — keep                                                |

Genuinely doc-only scaffolding to KEEP (in one small `<style>`, built from framework tokens — `--shadow-*`, `--br-*`, `--color-*`, `--text-*` — for consistency): the interactive **grid diagram**, **range-slider control** layout, **animation/float gallery** grids, **swatch-grid** layout. Plus dial/gallery `<script>` (largely unchanged; works once tokens exist).

Other fixes:

- **Add a typography section** showcasing every `.font-*` role (display/title/heading/lead/body/quote/caption/eyebrow/footnote/code/tag).
- **Dark-mode toggle:** switch the JS attribute from `data-theme` to **`data-brx-theme="dark"`** to match the generated dark selector (`:root[data-brx-theme="dark"]`).
- Remove demos for not-yet-ported patterns (dialog/drawer/etc. are Part 6, deferred) — keep button/link/badge/card.
- Set a real `<title>`.

---

## Sequencing

1. Schema: add `fonts` + `typeScale` (+ optional `headings`).
2. Generator: add `type-tokens.css` emitter (bricks-gated) + interface fields.
3. `index.css`: import `type-tokens.css`.
4. `vite.config.ts`: add `build:docs`.
5. Run `vp run build` (bricks, canonical) **and** `vp run build:docs` (produces `dist/styles.docs.css`); verify both.
6. Rewrite `index.html` markup to dogfood; minimal scaffolding `<style>`; fix dark toggle + title.
7. Rebuild docs; visually verify; commit + push.

## Verification

- `node lib/generate-design-system.ts` (non-bricks) → `type-tokens.css` has `--font-*` + `--text-1..7`; `--bricks` → stub. `color.css`/`type-tokens.css` byte-identical to bricks except the gated blocks; **tokens.css/typography.css identical across modes**.
- `vp run build:docs` exits 0; `dist/styles.docs.css` contains `--color-*`, `--font-*`, `--text-*`, `.bg-*`/`.text-*`, `.font-*`; `vp run build` still emits the bricks stub bundle; `src/css/generated/*` ends in bricks state (clean `git diff` there).
- Open `index.html` (links `styles.docs.css`) in a browser: type roles render with real fonts/scale; color ramps + semantic swatches + dark toggle work; buttons/links/badges/cards colored; layout/rhythm/animations demos work. Grep the page for leftover undefined doc-local classes (should be only the kept scaffolding).
- `vp check` passes (pre-existing `baseDelay` warning aside).

## Critical files

- `src/design-system.json` — `fonts`, `typeScale` (+ `headings`)
- `lib/generate-design-system.ts` — `type-tokens.css` emitter (bricks-gated, reuse `decls()`)
- `src/css/index.css` — import `type-tokens.css`
- `vite.config.ts` — `build:docs` task
- `index.html` — dogfooded rewrite + minimal scaffolding `<style>` + JS dark-attr/title fixes

---

---

# (COMPLETED) Plan: Remove `gale` dep + fold `old-css-lib` into the schema-driven framework

## Context

Two requests:

1. **Remove the wrong `gale` dependency.** `package.json` lists both `gale@^0.0.0` (a placeholder/squatted `0.0.0` package) and `@lyricalstring/gale@^0.1.5`. The latter is the real CSS linter; `gale` is bogus and must go.

2. **Fold the legacy `old-css-lib/` into the new framework, de-Tailwinded.** `old-css-lib/` is the previous generator's output: a Tailwind-based library that leaned on Tailwind's compiler to tree-shake thousands of `@utility` classes. The new framework is token + codegen driven (`src/design-system.json` → `lib/generate-design-system.ts` → `src/css/generated/*`, bundled by lightningcss). The goal is a Tailwind-free framework built on **sane defaults** (element/pattern styling) rather than thousands of utility classes. The high-value asset in the legacy lib is `patterns/*` — UI patterns Bricks Builder doesn't supply (dialog, drawer, carousel, etc.), which are ~88% plain modern CSS already.

User decisions driving this plan:

- **Pattern token-cascade folds INTO the schema** (generator emits it), patterns stay as static partials that consume it.
- **Typography is schema-driven**: generate `.font-*` role classes; retire the hand-written type classes in `layout.css`.
- **Curated pattern subset**, not all 42.
- This document is **plan-only**; implementation happens in a follow-up.

## ⚠️ Prerequisite: sync the working branch

All the pushed changes (`old-css-lib/`, `src/css/generated/`, pnpm migration, `index.html`) are on **`origin/main`**. The working branch `claude/relaxed-goldberg-9198o8` is still at the old commit `3213f2a` and does NOT contain them. **Before any implementation**, sync the branch with `origin/main` (merge or reset-to-main + rebranch). Every file reference below is to the `origin/main` state.

---

## Part 1 — Remove `gale` (trivial, do first)

- `package.json`: delete the `"gale": "^0.0.0"` line from `devDependencies`. Keep `@lyricalstring/gale`.
- Run `pnpm install` to regenerate `pnpm-lock.yaml` (drops the `gale@0.0.0` entries at lockfile lines ~17, ~717, ~1549).
- `pnpm-workspace.yaml`: no change needed — only `@lyricalstring/gale` is in `allowBuilds`, not `gale`.
- `AGENTS.md:30` ("`gale` - css linting"): leave as-is — it refers to the linter concept, satisfied by `@lyricalstring/gale`.
- No source/config imports reference `gale` directly (verified via `git grep`), so nothing else to change.

---

## Part 2 — Schema additions to `src/design-system.json`

The pattern token cascade goes under the **existing top-level `patterns`** key (per user). Since `patterns` already holds the interaction definitions (button/link/badge/card), **restructure `patterns` to unify both concerns**:

```
patterns: { groups, defaults, z, items }
```

`groups`/`defaults`/`z` are the cascade config; `items` is the per-pattern map (the current button/link/badge/card move here, each optionally gaining a `group`; new structural patterns are `items` entries carrying just a `group`). Also add a separate top-level `typography` key. Extend the interfaces in `lib/generate-design-system.ts`: add `group?: string` to `Pattern` (L32-39), change `patterns?` on `DesignSystem` (L48) to the new `PatternsConfig` shape `{ groups, defaults, z, items: Record<string, Pattern> }`, and add `typography?`.

### 2a. `patterns` — token cascade + interaction items (unified)

Recovers the legacy cascade from `old-css-lib/patterns/defaults.css` + `pattern-mapping.css`. Model: **global defaults** + **group defaults** + **per-pattern→group aliases**; partials consume the live 3-level chain `var(--p-dialog, var(--p-dialog-group, var(--p-default)))`. Groups: `tag, control, panel, area, content, pull`. Properties: `ds`(drop-shadow/box-shadow), `b`(border), `br`(border-radius), `p`(padding), `fs`(font-size). Plus z-tiers.

> **Fix a legacy bug while folding:** `defaults.css` defines `--br-*` (border-radius) but `pattern-mapping.css` emitted `--r-*-group`. Standardize on **`--br-*`** everywhere so the alias actually resolves.

Use the **real legacy values** (these can reference new `--color-*`/`--shadow-*` tokens; recommended rewires noted in comments):

```jsonc
"patterns": {
  "defaults": {
    "ds": "none",
    "b":  "1px solid var(--color-surface-xl)",   // legacy: 1px solid oklch(0.85 0 0)
    "br": "0.375rem",
    "p":  "1rem",
    "fs": "1rem"
  },
  "groups": {
    "tag":     { "ds": "var(--ds-default)", "b": "none",             "br": "0.25rem", "p": "0.25em 0.5em", "fs": "0.75rem" },
    "control": { "ds": "var(--ds-default)", "b": "var(--b-default)", "br": "var(--br-default)", "p": "0.5em 1em", "fs": "var(--fs-default)" },
    "panel":   { "ds": "var(--shadow-md)",  "b": "var(--b-default)", "br": "0.5rem",  "p": "1rem",   "fs": "var(--fs-default)" }, // legacy ds: 0 4px 12px oklch(0 0 0/.15)
    "area":    { "ds": "var(--ds-default)", "b": "var(--b-default)", "br": "0",       "p": "1.5rem", "fs": "var(--fs-default)" },
    "content": { "ds": "var(--ds-default)", "b": "var(--b-default)", "br": "0.5rem",  "p": "1rem",   "fs": "var(--fs-default)" },
    "pull":    { "ds": "var(--ds-default)", "b": "none",             "br": "0",       "p": "1.5rem", "fs": "1.25rem" }
  },
  "z": { "raised": 1, "sticky": 100, "overlay": 200, "top": 1000 },  // emits --z-tier-raised etc.
  "items": {
    // existing interaction patterns — moved here, each gains an optional "group"
    "button": { "group": "control", "element": "button", "default_role": "brand-primary", "base": { /* …unchanged… */ }, "states": { /* … */ }, "roles": ["success","danger","warning","info"] },
    "link":   { "group": "control", "element": "a", "default_role": "brand-primary", "base": { /* … */ }, "states": { /* … */ }, "roles": [] },
    "badge":  { "group": "tag", "class": "badge", "default_role": "neutral", "base": { /* … */ }, "states": {}, "roles": ["success","danger","warning","info"] },
    "card":   { "group": "panel", "class": "card", "base": { /* … */ }, "states": {}, "roles": [] },
    // new structural patterns — token-group assignment only; styled by static partials (Part 6)
    "tag":          { "group": "tag" },
    "tooltip":      { "group": "tag" },
    "dialog":       { "group": "panel" },
    "popover":      { "group": "panel" },
    "notification": { "group": "panel" },
    "lightbox":     { "group": "panel" },
    "tabs":         { "group": "panel" },
    "drawer":       { "group": "area", "overrides": { "br": "0" } },
    "carousel":     { "group": "area" },
    "details":      { "group": "content" },
    "table":        { "group": "content" },
    "forms":        { "group": "control" }
  }
}
```

Per-pattern token overrides via the optional `overrides` map (e.g. drawer's `br`).

### 2b. `typography` — schema-driven `.font-*` roles

Recovers roles from `old-css-lib/utilities-font-roles.css` and reconciles with `layout.css:8-67`. Required classes (from AGENTS.md + user): `.font-display/.font-title/.font-heading/.font-body/.font-quote/.font-caption/.font-eyebrow/.font-code/.font-lead/.font-footnote/.font-tag`. Each role declares the props it needs; generator emits each as a directly-overridable var so per-instance tweaks (`--display-fw: 800`) keep working without the legacy fragile `[class^='font-']` shared-applier selector:

```jsonc
"typography": {
  "families": {
    "display": "var(--font-display)",
    "sans":    "var(--font-sans)",
    "code":    "var(--font-mono, ui-monospace, monospace)"
  },
  "roles": {
    "display":  { "family": "display", "size": "var(--text-7)", "weight": 700, "line-height": "1.0",  "tracking": "-0.035em", "text-wrap": "balance" },
    "title":    { "family": "display", "size": "var(--text-6)", "weight": 600, "line-height": "1.12", "tracking": "-0.025em", "text-wrap": "balance" },
    "heading":  { "family": "display", "size": "var(--text-5)", "weight": 600, "line-height": "1.3",  "tracking": "-0.025em", "text-wrap": "balance" },
    "lead":     { "family": "sans",    "size": "var(--text-4)", "weight": 400, "line-height": "1.5",  "text-wrap": "pretty" },
    "body":     { "family": "sans",    "size": "var(--text-3)", "weight": 400, "line-height": "1.55", "text-wrap": "pretty" },
    "quote":    { "family": "display", "size": "var(--text-5)", "weight": 400, "line-height": "1.3",  "style": "italic", "text-wrap": "balance" },
    "caption":  { "family": "sans",    "size": "var(--text-2)", "weight": 400, "line-height": "1.3",  "color": "var(--color-neutral-l)" },
    "eyebrow":  { "family": "sans",    "size": "var(--text-2)", "weight": 600, "line-height": "1.3",  "tracking": "0.08em", "text-transform": "uppercase", "color": "var(--color-brand-primary-l)" },
    "footnote": { "family": "sans",    "size": "var(--text-1)", "weight": 400, "line-height": "1.4",  "color": "var(--color-neutral-l)" },
    "code":     { "family": "code",    "size": "0.9em", "weight": 400, "line-height": "1.5" },
    "tag":      { "family": "sans",    "size": "0.8rem", "weight": 600, "line-height": "1", "tracking": "0.02em", "text-transform": "uppercase" }
  }
  // Optional, default OFF: "headings": { "h1":"display", ... } to style bare h1-h6.
  // Leave off initially to avoid surprising global heading changes; revisit later.
}
```

Schema-key → CSS-prop map applied by the generator: `family`→`font-family` (resolved via `families`), `size`→`font-size`, `weight`→`font-weight`, `style`→`font-style`, `line-height`→`line-height`, `tracking`→`letter-spacing`, `text-decoration`/`text-transform`/`text-wrap`/`color` verbatim. Each emitted decl wraps an override hook: e.g. `font-weight: var(--display-fw, 700);`.

> `.font-body` replaces the old `.copy`. `.display/.title/.heading/.eyebrow/.caption/.quote` become `.font-*` (renamed, not kept).

---

## Part 3 — Generator changes (`lib/generate-design-system.ts`)

**First, adapt to the restructured `patterns` key.** The generator currently does `const { patterns, shadows } = ds;` (L80) and iterates `Object.entries(patterns ?? {})` in the patterns.css emit (L245). Change the interaction emit to iterate **`ds.patterns?.items ?? {}`**. Update the `Pattern` interface (add `group?`, `overrides?`) and replace the `DesignSystem.patterns` type with the `{ groups, defaults, z, items }` shape.

Two new emit sections, both **always emitted regardless of `--bricks`** (structural, not palette — same rationale as the existing `shadows.css` block). Insert after the shadows block (~L181), before the patterns block. Reuse the existing `decls()` helper (L194) for all block bodies. The existing color/shadow emitters and `normalize/shiftStep/stateRules/darkStep` are unchanged.

- **Section A → `src/css/generated/tokens.css`**: emit `:root` with (1) `--<prop>-default` from `patterns.defaults`, (2) `--<prop>-<group>` from `patterns.groups`, (3) `--z-tier-<name>` from `patterns.z`, (4) per-item aliases `--<prop>-<item>-group: var(--<prop>-<group>)` from each `patterns.items[name].group`, with `patterns.items[name].overrides` writing the alias directly. (Alias block only emits props the assigned group actually defines.)
- **Section B → `src/css/generated/typography.css`**: for each `typography.roles` entry, emit `.font-<role> { ... }` using the key→prop map above, each value wrapped as `var(--<role>-<shorthand>, <value>)`. If `headings` present, also emit bare `h1..h6` rules.

Both land in `cssPath` (`src/css/generated/`, already `mkdirSync`-ed at L100). Add `✓` console logs to match existing style.

Emit matrix after change: `color.css` (bricks-gated), `shadows.css` (always), **`tokens.css` (always, new)**, **`typography.css` (always, new)**, `patterns.css` (always).

---

## Part 4 — `index.css` manifest + `layout.css` cleanup

`src/css/index.css` new order (tokens before consuming partials; typography where the layout type classes were):

```css
@import './animation.css';
@import './generated/color.css';
@import './generated/shadows.css';
@import './generated/tokens.css'; /* NEW */
@import './generated/typography.css'; /* NEW */
@import './layout.css'; /* type classes removed */
@import './generated/patterns.css';
/* curated static pattern partials (Part 6) */
@import './patterns/dialog.css';
@import './patterns/drawer.css';
@import './patterns/popover.css';
@import './patterns/tooltip.css';
@import './patterns/details.css';
@import './patterns/tabs.css';
@import './patterns/table.css';
@import './patterns/forms.css';
@import './patterns/carousel.css';
@import './patterns/lightbox.css';
@import './patterns/notification.css';
@import './patterns/tag.css';
```

Order rationale: `color`/`shadows` define vars that `tokens.css` group defaults reference (e.g. `--ds-panel: var(--shadow-md)`); `tokens` must precede `patterns/*` consumers.

`src/css/layout.css`: **delete the TYPOGRAPHY piece-class block (`.display/.title/.heading/.eyebrow/.copy/.caption/.quote`, lines ~8-67)**. Keep RHYTHM (L69+) and everything below.

---

## Part 5 — `vite.config.ts`

- `generate:theme` `output: ['dist/bricks*', 'src/css/generated/**']` already covers the two new generated files — **no change**.
- `generate:theme` `input` already lists `lib/generate-design-system.ts` + `src/design-system.json`; the new emitters read nothing new — **no change**.
- **Add `input: ['src/css/**/_.css']`to the`build:css`task** so edits to the new static`src/css/patterns/_.css`partials bust its cache (lightningcss`--bundle` inlines them, but vp's auto-tracker should be told explicitly).

---

## Part 6 — Port curated pattern partials (de-Tailwind)

Subset: **dialog, drawer, popover, tooltip, details, tabs, table, forms, carousel, lightbox, notification, tag**. Sources in `old-css-lib/patterns/` are ~88% plain modern CSS (native `<dialog>`/Popover/anchor positioning/scroll timelines/`:has()`). Destination: new dir **`src/css/patterns/`**, one file per pattern, imported by `index.css` (Part 4).

Per-file de-Tailwind checklist:

1. Remove `@apply`/`@utility`/`@theme`/`@plugin`/`@tailwind`/`@variant` at-rules and `--tw-*`/`theme(...)` refs. (Only `entries.css` used `@apply sr-only` and it's NOT in the subset — expect zero `@apply` in the curated set; verify by grep.)
2. Rewire structural values to the cascade vars, e.g. `padding: var(--p-dialog, var(--p-dialog-group, var(--p-default)));`, `border-radius: var(--br-dialog, ...);`, `box-shadow`/`filter` → `var(--ds-panel)` chain, `z-index: var(--z-tier-overlay)`.
3. Colors → `--color-*` semantic tokens.
4. Typography inside patterns → compose `.font-*` in markup or reference the same `--text-*` values.

Acceptance grep over `src/css/patterns/`: `@apply|@utility|@theme|@plugin|@tailwind|@variant|--tw-|theme\(` → **zero hits**.

Drop entirely (do NOT port — replaced by the schema-driven framework): `utilities-colors.css`, `utilities-*.css`, `colors.css`, `daisyui-theme.css`, `tailwind-space-plugin.ts` and all Tailwind plumbing. `old-css-lib/` stays in the tree as reference until migration is complete, then can be removed.

---

## Part 7 — Migrate consumers

Renaming type classes to `.font-*` breaks existing markup. Update:

- `index.html` docsite: `class="title"` → `font-title`, `class="lead"` → `font-lead`, etc. (`eyebrow-doc` is a doc-local class in index.html's own `<style>` — leave it). Per AGENTS.md, keep `index.html` current and add demos for the newly-ported patterns.
- Any Bricks theme markup using bare `.display/.title/.copy/...` (out of this repo) — note in the deploy hand-off.

---

## Sequencing

1. Sync branch with `origin/main` (prerequisite).
2. Part 1: remove `gale`, `pnpm install`, confirm lockfile clean.
3. Part 2: add `tokens` + `typography` to `design-system.json` (inert until generator updated).
4. Part 3 Section B (typography emitter) → build → verify `typography.css`.
5. Part 3 Section A (tokens emitter) → build → verify `tokens.css`.
6. Part 4: wire `index.css`, remove `layout.css` type block → build.
7. Part 5: `build:css` input glob.
8. Part 6: port partials one at a time, adding each `@import`, building after each.
9. Part 7: migrate `index.html` + add pattern demos.
10. Full build + verification.

Each step ends green, so regressions stay localized.

## Verification

- `npx vp run build` exits 0 and prints `✓` for `tokens.css` and `typography.css`.
- `src/css/generated/{tokens,typography}.css` exist with expected `:root` vars / `.font-*` rules.
- Grep `dist/styles.min.css`: present → `--p-control`, `--br-tag`, `--ds-panel`, `--z-tier-overlay`, `--br-dialog-group`, `.font-display`, `.font-body`, `.font-tag`; absent → `.copy`, the old literal `.display{...}` block, and any `@apply|@theme|@utility|@plugin|@tailwind|--tw-`.
- Bricks-neutrality: `node lib/generate-design-system.ts` vs `--bricks` → `color.css` differs (full vs stub) but `tokens.css`/`typography.css` are byte-identical.
- Open `index.html` against built `dist/styles.min.css`; confirm type roles and each ported pattern render.
- `npx vp check` (format + lint + typecheck) passes on the modified generator.

## Critical files

- `src/design-system.json` — schema additions
- `lib/generate-design-system.ts` — two new emit sections (reuse `decls()`)
- `src/css/index.css` — manifest order + new imports
- `src/css/layout.css` — remove type-class block
- `vite.config.ts` — `build:css` input glob
- `package.json` / `pnpm-lock.yaml` — drop `gale`
- `src/css/patterns/*` (new) — ported partials; `index.html` — consumer migration
