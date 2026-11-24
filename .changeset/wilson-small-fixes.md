---
'@getvitops/create': patch
'@getvitops/astro': patch
'@getvitops/emdash': patch
'@getvitops/core': patch
---

**Four small fixes from the first migration of an existing site (wilsonlandscaping.ca).**

- **`@getvitops/create` (emdash template):** `_gitignore` now ignores `src/styles/design-manifest.json`. The tailwind format has emitted it beside `tailwind.css` since the editor manifest change, and it showed up as untracked in every new site. The static template already ignores all of `src/styles/`.
- **`@getvitops/astro`:** the "emdash() is registered, and its `<EmDashHead>` emits the same tags" warning fires only when `vitops({ seo })` is passed explicitly. It used to fire on config-derived defaults too, but `site.seo` also feeds indexing and robots, so any site with a configured environment `robots` or a `site.seo` block was warned about a `<Seo />` it never rendered. The message now says how to silence it (drop the `seo` option).
- **`@getvitops/emdash`:** `vitops_embed`'s map provider accepts the classic `https://maps.google.com/maps?q=…&output=embed` address, the form Google's own embed snippet produced for years, so a migrated page's iframe URL is no longer rejected silently. It is accepted on an explicit `output=embed` and a google.com host only; the same URL without it, and any other host, are still refused. The README's tested-against note moves to `emdash@1.5.x`.
- **`@getvitops/core`:** a comment on the carousel's `::column` rules records why lightningcss warns about them on every build (it does not know the pseudo-element, through 1.33) and that the warning is harmless; `@supports selector(::column)` does not silence it. No CSS change in any format.

**Migration:** none. Other fixed-group packages: no consumer-facing change.
