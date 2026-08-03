---
'@getvitops/generator': minor
'@getvitops/astro': minor
'@getvitops/vite': minor
'@getvitops/cli': minor
---

Anywhere the toolchain takes a config, that file may now be a `design-system.json` **or** the larger
site config that embeds one.

If you keep your tokens inside a `company.json` / `site.json`, you had to maintain a second file for
the tooling's sake — or duplicate your whole token set, because a site config must carry a complete
`designSystem`. Now you point the same option at the file you already have:

```js
// astro.config.mjs
getvitops({ css: { input: 'company.json', format: 'css' } });
```

```
vitops generate --input company.json --format css --out dist
vitops lint --input company.json --src src
```

The design system is taken from `designSystem.themes[theme]` with its `extends` chain resolved —
`defaultTheme`, else `default`, else whatever `--theme` / the `theme` option names. Nothing changes
for a plain `design-system.json`; the two are told apart by shape, not by filename, so you can call
the file anything.

**A site config also supplies the site-level facts generation reads**, so the path is declared once
rather than per option:

- `designSystem.defaultColorScheme: "system"` — emits the `prefers-color-scheme` block, which is
  what makes `<color-scheme-toggle>`'s System position do anything.
- `legal.*.enabled` — renders the documents. `legal: {}` is now the whole declaration; `legal.input`
  is optional.
- `icons.sprite` — builds `icons.svg`.
- `fonts` — `fonts: true` reads the families from it.

Each of those is already gated on a field in that config, so nothing new appears unless the config
asks for it. An explicit `site` option still wins when the two are genuinely different files.

Also:

- **`vitops validate` routes on the file's shape.** Pointed at a site config it used to report a
  single `unrecognized_keys` for `designSystem` and nothing about the file's actual contents — a
  wrong answer that reads like a right one. It now validates a site config as one, including the
  cross-field integrity JSON Schema can't express, and checks every theme resolves to a complete
  design system (`validateSite` only checked that the `extends` chain resolved, not what it resolved
  to).
- **`generate()` gained `theme` and `siteEnv`.** The A/B variant for `siteEnv` is applied before the
  theme is selected, so a variant can override tokens.
- **The theme editor's Save to source follows the design system into a site config.** Its patch is
  design-system-relative, so the dev server merges into that subtree and writes only the surrounding
  file whole. It locates the subtree in the raw on-disk object rather than the normalised one, so an
  author who wrote either `designSystem` shorthand still gets their own keys edited.
