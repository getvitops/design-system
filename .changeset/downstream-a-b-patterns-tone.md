---
'@getvitops/core': minor
'@getvitops/generator': minor
'@getvitops/emdash': minor
'@getvitops/create': minor
---

Fixes from the vitops.ca build (alpha.3 findings 1–5, 19, 29).

- **Scaffold patterns.** Both templates now define `cta`, `link` and `details` in `patterns.items` (a `content` group too), and a `ui-accent` role. `.cta` had no CSS at all, so every hero, card and callout button rendered as plain text; a test now fails if a template omits a pattern the blocks emit. `vitops_accordion` renders a sprite chevron like `vitops_details`, and `details.css` styles an `.accordion` group (a divider and padded summaries from the `details` pattern tokens) — all formats.
- **Tone paints only on surfaces.** `.tone` now sets colour variables and `border-color`; the background comes from `.tone--tint` (callout, panel card, hero card, toned section/hero/nav/reviews, `theme`) or `.tone--solid`. A steps, stats or form block with a tone is no longer turned into a band. `ResolvedTone` gains `surface` (`tone tone--tint`). **If you styled `.tone` directly,** add `tone--tint` where you want the background. A `.cta` inside a tinted or filled tone takes the tone's solid. all formats.
- **`colors.tint: { mix: "8%" }`** derives the tint from the role's solid (`--tone-tint`) instead of its `muted` step, which turns brown for amber on a dark page. Off by default; not covered by the contrast contract.
- **Per-card backdrop.** `vitops_cards` and `vitops_hero` rows take a `theme` (tint or fill of a site colour), so one card of a pair can be tinted.
- **`colors.roles.<r>.acknowledgeContrast`**: a number of Lc a pairing may miss its APCA bar by and still only warn (e.g. pine's solid at Lc 59.5 against 60). A larger miss still fails.
- **Select:** where `appearance: base-select` is supported the wrapper's own chevron is hidden, so a select no longer shows two arrows, and the wrapper and control fill the field (`.custom-select` is `display: block`; add `display: inline-block` if you used it inline). all formats.
