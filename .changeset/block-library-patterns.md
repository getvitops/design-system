---
'@getvitops/core': minor
'@getvitops/generator': minor
'@getvitops/astro': minor
---

New framework patterns and an `Entries` component for the EmDash block library.

**CSS, all formats** (css, bricks and inlined into tailwind's `components` layer; no existing class changes): `tone` (a shared tint/solid colour convention driven by `--tone-*` custom properties, plus `.accent` for a run inside a heading), `section` (head and heading-left `--split` layout), `steps` (numbered `<ol>` with a connector line), `stats` (figures and `--tiles`), `callout` (a call-to-action band), `logos` (a still partner grid) and `embed` (a consent-gated iframe frame). All are structural partials, classified `vitops.components`.

**`@getvitops/astro`:** new `Entries.astro` (`@getvitops/astro/components/Entries.astro`) emits `<wc-entries>` itself with the semantic heading + `<dl>` fallback.

**`@getvitops/generator`:** `TierEntry` gains `emdashExempt` (a reason a shipped web component has no EmDash block). `tiers.test.ts` now fails if a shipped `wc-*` has neither `emdash` nor `emdashExempt`, and the components doc and the docs site list the exemptions.

No other consumer-facing change in `@getvitops/core`, `@getvitops/utils`, `@getvitops/cli` or `@getvitops/vite` beyond the version bump.
