# design-system.json gaps to reproduce the original Home page

Derived by diffing the original Home Code-element `<style>` (its `:root` + section rules)
against the current design system. Each item: the original's value, what the design system
does today, and the recommended `design-system.json` change. Until these land, I set the
value directly on the Bricks element (via `_cssCustom` / element settings) and mark it
`[direct-css]` on the page.

Accent green `#4a9075` already equals `--color-pine` — no change needed there.

## 1. Fonts (`fonts` + `typography.families`)

- Original: **`Geist`** for all text + **`Geist Mono`** for labels/eyebrows/timestamps
  (loaded via Google Fonts `@import`).
- Now: `display: Mulish`, `sans: system-ui`, `mono: ui-monospace…`.
- **Add:** a `Geist` family (set `sans`/body + a display role to Geist) and `Geist Mono`
  for `mono`/`eyebrow`/`code`. Also wire the webfont load (the theme must enqueue Geist,
  or self-host it) — the design system currently ships no webfont loader.

## 2. Dark palette (`colors` — the exact surface/ink ramp)

Original dark values (the page is always dark):
| role | original | closest DS token today |
| ----------- | ----------- | ----------------------------- |
| page bg | `#0d1219` | ~`navy-xxd` (not exact) |
| surface | `#141a23` | ~`navy-xd` `#0F141D` (not exact)|
| surface-2 | `#1a2230` | — |
| ink (text) | `#eef1f5` | ~`grey-xxl` (not exact) |
| ink-2 | `#b9c0cb` | — |
| dim | `#6c7689` | — |
| hairline | `rgba(255,255,255,.07)` | — (borders) |
| hairline-2 | `rgba(255,255,255,.14)` | — |
| warn | `#f5b94a` | ~`amber` (not exact) |

- **Recommend:** set the **dark-mode** values of the `surface` semantic role (and add
  `surface-2`) to these exact hexes, set `neutral`/text dark values to `#eef1f5`/`#b9c0cb`/
  `#6c7689`, and add a hairline/border token (`rgba(255,255,255,.07/.14)`). Simplest path:
  tune the `navy` ramp's dark steps to `0d1219 / 141a23 / 1a2230` and grey to the inks.

## 3. Radii (`patterns.radii`)

- Original: buttons `4px`, cards/surfaces/hero-card `8px`.
- Now: `--br-panel` = `.5rem` (8px) ✓ exists; `--br-card` resolves empty (falls back .75rem);
  no `4px` control/button radius.
- **Add:** `--br-control` / `--br-button` = `4px`; set `--br-card` = `8px` (= `--br-panel`).

## 4. Spacing scale (`spaceScale`) — needs larger steps

- Original section rhythm: gutter `32px`; hero pad `88px 0 96px`; grid gaps `64px` / `48px`;
  card pads `40px 36px` / `28px 26px`; section-head margin `56px`.
- Now: scale tops out at `2xl` ≈ `31px` — too small for section-level spacing.
- **Add:** larger steps (`3xl`,`4xl`,`5xl`…) covering ~`40 / 48 / 64 / 88 / 96px`, or a
  dedicated section-spacing scale. (Card inner padding ~`28–40px` also above current max.)

## 5. Type scale + roles (`typeScale`, `typography.roles`)

- Original sizes: eyebrow `11px` (mono, `.12em` tracking, uppercase), body `14px`,
  card h3 `17px`, lede `18px`, section h2 `clamp(32px,4vw,52px)` (`line-height 1.05`,
  `letter-spacing -.03em`), h2 `em` accent-coloured.
- Now: scale tops at `text-3xl` ≈ `33px` (max) — **too small** for the `52px` display/title;
  `font-display` currently renders ~`20px`.
- **Recommend:** extend `typeScale` with larger steps (`4xl`,`5xl`) up to ~`52px`; retune
  the `display`/`title` roles to those sizes with `line-height ~1.05` and
  `letter-spacing -.03em`; set `body`≈`14px`, `lead`≈`18px`, `heading`≈`17px`,
  `eyebrow` = mono `11px` / `.12em` / uppercase / pine.

## 6. Shadow (`shadows`)

- Original hero-card: `box-shadow: 0 40px 80px -20px rgba(0,0,0,.5)` (large soft drop).
- **Add:** an `xl`/`2xl` shadow matching this (current `sm…xl` don't go this soft/large).

## 7. Component patterns (`patterns.items`)

- **button:** original = `height 44px`, `padding 0 20px`, `radius 4px`, `font 14px/500`;
  primary = `bg pine`, `color #0a0d0c`, `weight 600`. Tune the `button` pattern to match.
  (Also: on the page, use a link + `.button`, not the Bricks Button element — its
  `.bricks-button` styles override ours.)
- **card:** two variants in the original — hero-card (`bg surface`, `1px hairline border`,
  `radius 8px`, big shadow) and flat tiers/problem-cards (`bg surface`, no border, larger
  pad). Consider a `card`/`card-flat` split; card padding `28–40px` needs the bigger space
  steps from §4.

---

### Status

**Done in `design-system.json` + deployed:**

- `shadows`: added `2xl` = `0 40px 80px -20px rgb(0 0 0 / .5)` — **resolves live** ✓
- `spaceScale.names`: added `3xl…7xl`; `typeScale.names`: added `4xl…7xl`
- `patterns.radii`: added `control` (0.25rem) + `card` (0.5rem)
- `patterns.items.button.base`: `border-radius` → `var(--br-control)`, added `box-shadow: var(--shadow-sm)`
- `typography.roles`: `display` → `--text-6xl`, `title` → `--text-5xl`
- `patterns.items.card.base`: `border-radius` → `var(--br-card-group)` (was hard-coded
  `0.75rem`, defeating the `radii.card`/`--br-panel` 8px cascade); `padding` → `1.75rem`
  (≈ original's `28px`; was `1.5rem` — the "tight" cards) — **deployed + resolves live** ✓
- **`br-card` imported into Bricks** (`set-global-variables`, id `318e59`, `0.5rem`,
  uncategorized like `br-pill`/`br-circle`/`br-chip`) — cards render 8px live ✓

**Needs a Bricks re-import to take effect** (scales are Bricks-managed variables): the new
`--text-4xl…7xl` / `--space-3xl…7xl` are in `dist/bricks-variables.json` but undefined on the
site until imported into Bricks' Variable Manager — so the bumped `display`/`title` sizes
don't resolve yet. (May be doable via `bricks/generate-scale-variables` /
`set-global-variables` instead of by hand.)

**Resolved (was "bug to fix"):** the generator's radii→token mapping is correct — radii emit
to `bricks-variables.json` in bricks mode (Variables manager owns them) and to `tokens.css`
`:root` otherwise. `--br-card` was "missing" only because the site hadn't imported it; now
set via `bricks/set-global-variables`. Note `--br-control` still resolves to
`var(--br-default)` = 0.375rem (6px) from `patterns.groups.control.br`, vs the original's
4px buttons — acceptable system default, tune `groups.control.br` if exact match wanted.

### Recommendation on "missing semantic roles"

The exact dark values are just the `navy`/`grey` ramps' dark ends, and the system already has
generic `surface` (navy, auto-invert) + `neutral` (grey, auto-invert) roles — so
`surface`/`surface-2`/`ink`/`ink-2`/`dim` map to existing surface/neutral **steps**; no new
roles needed. `warn` = the existing `warning` role. The one thing worth adding **for every
site**: a **`border`/`hairline` semantic token** (translucent divider — `rgba(255,255,255,.08)`
dark / `rgba(0,0,0,.08)` light); nearly every UI needs subtle dividers, and today the patterns
borrow `--color-surface-xl`. Don't hard-code this page's exact hexes into the shared ramp
unless you want `navy` to _be_ those shades site-wide (then tune the navy ramp values).
