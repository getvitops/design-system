---
'@getvitops/astro': minor
'@getvitops/generator': minor
---

`getvitops({ fonts })` — load webfonts through Astro's Fonts API instead of hand-rolling it.

The design system names fonts and loads none of them, and there was no seam for the loading half —
so the only available path was installing a `@fontsource*` package and importing its CSS, which
renders correctly while silently giving up subsetting, preload, and the `size-adjust` /
`ascent-override` fallback metrics. That is a CLS regression that looks like a working setup. This
is the counterpart to `vitopsHosting()`: declare the family, let the integration wire it.

```js
getvitops({
  fonts: [
    {
      name: 'League Spartan',
      provider: 'fontsource',
      cssVariable: '--font-league-spartan',
      weights: ['100 900'],
      subsets: ['latin'],
      preload: true,
    },
  ],
});
```

```jsonc
// design-system.json — the token points at the variable, not at a literal stack
"fonts": { "display": "var(--font-league-spartan), sans-serif" }
```

`fonts` also takes a **string**: the path to a site config, whose `fonts` array has carried exactly
these declarations (provider / weights / subsets / preload) since it was written — nothing had ever
read it. Or `{ input, families, siteEnv }` for both.

`<Head />` now emits `<Font />` for each declared family, with `preload` driven by the declaration.
That half is not optional: Astro's `fonts:` config resolves the files, but `<Font />` is what puts
the `@font-face` on the page, so a declaration without `<Head />` in your layout loads nothing.

Notes:

- Independent of `css` — the wiring runs in `astro:config:setup`, not the Vite plugin.
- Only families declared here get a `<Font />`. One from your own `astro:config` `fonts:` array or
  from another integration is left alone, because `<Font />` throws on a `cssVariable` Astro cannot
  resolve. Astro concatenates the arrays, so the three coexist; two entries claiming one variable
  is the collision that matters, and it now throws (within our set) or warns (against yours)
  instead of silently dropping a family.
- `provider: 'adobe'` throws with instructions: `fontProviders.adobe({ id })` needs a key from the
  environment, and a JSON declaration has nowhere to hold one.
- New exports from `@getvitops/generator`: `SiteFontSchema` and the `SiteFont` type.
