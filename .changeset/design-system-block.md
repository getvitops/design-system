---
'@getvitops/generator': major
'@getvitops/astro': minor
'@getvitops/vite': minor
---

**Breaking (site config):** `designSystem` is now an object, and the toggle's "System" position works.

`<color-scheme-toggle>` has always shipped three segments, and "System" did nothing. It removes the
theme attribute, and with no `prefers-color-scheme` block in the generated CSS the page fell straight
through to light on every machine — so a third of the control was inert, and a no-JS page could never
follow the OS at all.

The fix is a second, opt-in copy of the dark delta under
`@media (prefers-color-scheme: dark)`, scoped to "no explicit choice has been made". An explicit
light choice still wins over a dark OS. It costs **+303 B gzipped** on the colour layer — the block
repeats only the tokens whose dark value differs, and two identical runs of text compress to almost
nothing. It is opt-in because switching it on visibly flips an existing site dark for dark-OS
visitors.

Turning it on is a site-level fact, which needed somewhere to live:

```jsonc
"designSystem": {
  "themes": { "default": { … }, "elegant": { "extends": "default", … } },
  "defaultTheme": "default",
  "defaultColorScheme": "system"   // 'light' | 'dark' | 'system'
}
```

**What changed.** `designSystem` was a bare map of themeName → design system, so _every_ key was a
theme name and there was nowhere to put a system-wide field without it colliding with a theme of that
name. The map moves under `themes`, and `defaultTheme` + `defaultColorScheme` move inside the block.
`respectSystemPreference` is gone — `defaultColorScheme: "system"` says the same thing, and the two
were always read together, so the incoherent combination is no longer expressible.

**Migration is automatic at runtime.** `resolveSiteConfig` accepts all three spellings — the
canonical shape, a bare theme map (the old schema), and a bare design system written inline. But
`site.schema.json` is published to a stable URL, so an editor pinned to `$schema` will flag the old
shape; update it when convenient.

One behavioural change worth knowing: shorthand normalisation now runs **before** the A/B variant
merge, not after. Previously an `abTesting` override's key path depended on which shorthand the base
config happened to use, so the same patch landed in different places in two otherwise-equivalent
configs. Overrides now always address `designSystem.themes.<name>`.

Also: `getvitops({ site: { input } })` gives the Astro integration one place to name the site config
— `legal`, `fonts` and the colour scheme all read from it — and `css.systemColorScheme` sets the
appearance directly for consumers who have no site config.

Light/dark remains **derived**, not a theme: `functionalRole()` builds both appearances from one ramp,
which is what lets the contrast contract check both at build time and what gives every consumer a
working dark mode without authoring one. `themes` is for authored variants.
