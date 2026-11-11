---
'@getvitops/core': minor
'@getvitops/generator': minor
'@getvitops/emdash': minor
'@getvitops/astro': minor
'@getvitops/create': patch
---

Block fixes from the vitops.ca build (findings 11–13, 15, 17, 18, 21).

- **Steps.** The marker is an outlined disc in the tone (number and ring in `--tone-solid`, falling back to `currentColor`), so a steps block with no tone no longer shows black discs with no number. Items keep `align-content: start` and no `.rhythm li + li` margin, so markers in a row line up. Two modifiers through the block's `className`: `steps--cards` (each step in a card) and `steps--animated` (the connector draws and the marker fills as each step scrolls in; static under reduced motion or without scroll-driven animations). `steps` is now a config pattern: `patterns.items.steps` in `site.json` owns the card geometry (`content` group tokens) and the marker size (`--steps-marker-size`, `--steps-line-width`); both templates and the reference config ship an entry. all formats.
- **Stats.** `<wc-counter>` leaves a figure it cannot count as authored (`"1 in 6"`, `"24/7"`, `"—"`) instead of counting down from zero to a wrong value. `animate: false` on the block still turns the count-up off for a whole block.
- **Logos.** `vitops_logos` takes an optional `kicker`, `note` and `linkLabel`/`linkHref`; with any of them set, the row is wrapped in `.logos-block`. The list keeps the block's attributes either way.
- **Pricing.** Plans take `yearly` (a second price line) and `note` (under the plan name).
- **`<SiteFooter>`** has a `brand` named slot, rendered as the first column (`.sitefooter__brand`) in the site's own markup.
