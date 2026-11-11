---
'@getvitops/core': minor
'@getvitops/generator': minor
'@getvitops/emdash': minor
'@getvitops/create': patch
---

Layout and spacing fixes from the vitops.ca build (findings 6–9).

- **`vitops_section` is the page opener.** New fields `ctaLabel`/`ctaHref`/`secondaryLabel`/`secondaryHref` (a `.cta` and a `.link` in the head), `*accent*` runs in the heading, and `stack: rhythm`, which puts `.rhythm` on `.section__inner` so head and body use the vertical-rhythm scale. With level 1 it replaces nesting a `vitops_hero` in a section, which rendered `section > .centered > … > section > .centered`. `vitops_hero` stays for a stand-alone hero with option cards. A plain (`stack: grid`) section also puts a gap between head and body now (`--section-gap`, default 2rem) instead of sitting flush. css/bricks/tailwind.
- **`.rhythm` spaces blocks.** A card row (`wc-cards`, classed `ul`/`ol`), accordion, `details`, form, table, figure or `.section__body` directly under a `.rhythm` is `--rhythm-block` (2) apart, not a paragraph apart; a button row (`p.cluster`) is `--rhythm-block-action` (1.6). Classless lists stay prose and a form's own field spacing is unchanged. A bare `<a>` that is a direct child of `.rhythm` is now `display: block; inline-size: fit-content`, since an inline box ignored `margin-top` and sat flush under the paragraph above (`.cta` and `.btn` are unaffected). all formats.
- **`rhythm-flex`** utility: an opt-in flex-column stack for the case the margin stack does not suit; margins apply to any child. all formats (`@utility` in tailwind).
