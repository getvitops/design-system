---
'@getvitops/generator': minor
---

**A pattern's fill can now be undone — flat, border-only cards.**

`background` was the only `base` property with no per-pattern override hook. Every other one had
`--p-card`, `--br-card`, `--b-card`, `--ds-card`; the background was hard-wired, so a flat card
meant an inline `style="background: transparent"` rather than the documented mechanism.

Two additions:

- **`background` and `background-color` join `BASE_HOOK`**, both mapping to `bg`, since patterns
  author either spelling. `.card` now emits
  `background: var(--bg-card, var(--surface-bg))`. This also covers the fill the generator
  _injects_ for a `default_role` pattern, so `.cta` gets `--bg-cta`.

  Role variants (`.card-danger`) are emitted as separate rules and stay unwrapped, so tuning
  `--bg-card` adjusts the default fill without silently defeating them.

- **`bg-transparent` and `bg-inherit` utilities** in the `css` and `bricks` formats. Neither is
  derived from the palette, so neither the generated scale nor Bricks' palette import produced
  them. The `tailwind` format deliberately emits neither — Tailwind ships both as built-ins, the
  same deferral it makes for the `TW_CLASH` names.

```html
<!-- via the hook — set it anywhere, including :root for every card -->
<div class="card" style="--bg-card: transparent; --ds-card: none">…</div>

<!-- or compose the utility, which is what most authors will reach for -->
<div class="card bg-transparent" style="--ds-card: none">…</div>
```

There is no utility for the shadow, so `--ds-card: none` is how you drop it in every format.

These hooks also reach the live theme editor: `--bg-card`, `--bg-btn` and `--bg-status` now
appear in `design-manifest.json`'s reverse index, so pattern backgrounds are tunable in the
browser alongside their geometry.
