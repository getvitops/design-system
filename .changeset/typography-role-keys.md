---
'@getvitops/generator': patch
---

Warn on unrecognised `typography.roles` keys, and stop the schema documenting two that never worked.

The role key set is closed, and an unrecognised key is **dropped** — the role still renders, just
without the declaration you asked for. The schema description made that worse in two directions at
once: it advertised `transform` and `decoration`, when the generator only accepts `text-transform`
and `text-decoration`, and it claimed unknown keys were "passed through" when they are discarded. So
the two documented short forms were exactly the two that silently did nothing. In one case that
shipped title-case navigation to production across two deploys.

The behaviour is unchanged — unknown keys are still ignored, because `transform` is a real CSS
property and emitting it would break layout rather than do nothing. What changed:

- the generator now warns per role and key, naming the intended spelling where there is an obvious
  one (`transform` → `text-transform`, `letter-spacing` → `tracking`, `font-size` → `size`, …) and
  otherwise listing the recognised set;
- the schema description names the real keys and says unrecognised ones are ignored, which
  propagates to `vitops docs authoring` and to editor hovers.

Recognised keys, for reference: `family`, `size`, `weight`, `style`, `line-height`, `tracking`,
`text-transform`, `text-decoration`, `text-wrap`, `color`.
