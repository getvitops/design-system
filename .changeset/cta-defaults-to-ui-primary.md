---
'@getvitops/cli': patch
---

`.cta` now defaults to the `ui-primary` role instead of `brand-primary`.

The three tiers of one interaction family had split colour lineage: `:where(button, .btn)` and
`:where(a, .link)` resolved to `ui-primary` while `.cta` alone used `brand-primary`. For a project
whose brand and UI hues differ, that meant the focus ring changed colour depending on which tier
you tabbed onto.

Semantically the ui role is also the better fit — `brand-*` is identity, `ui-*` is the interface
responding to you, and a CTA's prominence already comes from its fill, weight and padding rather
than from borrowing the brand hue. Keeping brand as an explicit opt-in means a genuine brand moment
still carries signal, and a rebrand restyles brand surfaces instead of silently restyling every
form's submit button.

**Migration:** none if `brand-primary` and `ui-primary` map to the same hue (the common case, and
true of the example config). If they differ and you want the previous colour, add the new
`.cta-brand-primary` variant — `brand-primary` has been added to `cta.roles`, so a brand-coloured
CTA is reachable as a class rather than being unavailable.
