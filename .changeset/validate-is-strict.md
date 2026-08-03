---
'@getvitops/generator': minor
---

`validate()` now rejects what the published JSON Schema already rejected.

Runtime validation and `schema.json` derive from the same zod schema, but they disagreed:
`toJSONSchema` emits `additionalProperties: false` in 16 places, while a plain `z.object` _strips_
unknown keys at runtime. An editor honouring `$schema` therefore flagged configs that
`vitops validate` called `✓ valid` — and the keys it waved through were being silently discarded at
generate time, which is exactly when you want to hear about them.

The worst case was a palette hue carrying both `seed` and `tones`: it validated, and the `tones`
were then ignored, so the authored brand colours simply never appeared.

**This is a breaking change for configs that were already wrong.** A config with a stray or
misspelled key now fails instead of silently dropping it. Both design systems this was tested
against (a live client site and the vitops site itself) validate unchanged.

Error messages got the attention too — a failed union previously reported a bare `Invalid input`
that named neither key:

```
colors.palette.brand: a hue is either seeded (`seed`, with optional `anchors`) or fixed
  (`tones`) — not both. Drop one: with both present the `tones` are ignored at generate time.
colors.palette.brand: unknown key "anchor". A hue takes `seed` + optional `anchors`, or `tones`.
spaceScale: unknown key "nope" — not part of the schema, so ignored at generate time.
```

Note the site config (`resolveSiteConfig`) still strips unknown keys; aligning it is tracked
separately.
