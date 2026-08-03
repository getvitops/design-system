---
'@getvitops/generator': patch
---

Fix a filled CTA's text turning dark on hover.

`<a class="cta">` and every `.cta-<role>` variant flipped from their `text-on-<role>` foreground to
the link colour while hovered — dark green text on a dark green button. The declaration was always
right; it was being out-cascaded.

Element patterns (`link`, `btn`) wrap their selector in `:where()` so any explicit class beats them
without `!important`. But the state pseudo was appended **outside** that wrapper, and a pseudo-class
outside `:where()` still carries weight — so `:where(a, .link):hover` was 0-1-0, exactly tying
`.cta-brand-primary`, and won on source order because `link` is emitted after `cta`. The pseudo now
goes inside: `:where(a:hover, .link:hover)` is a true 0-0-0 and loses to any class, which is what the
resting rule already promised.

This affects any element pattern layered under a class pattern — `<a class="cta">`, `<a class="badge">`,
`<button class="cta">` — in the `css` and `bricks` formats. Nothing else about the emitted rules
changes. If you worked around it with a hand-written `color` override on a CTA, you can drop it.
