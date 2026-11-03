---
'@getvitops/astro': patch
'@getvitops/create': patch
---

**`resolveOrganizationName()` accepts a plain `import site from './site.json'`.** It was typed
against the full `Config`, which a JSON import cannot satisfy — TypeScript widens its literals
(`colors.utilities` becomes `string[]`, not the schema's union) — so every scaffolded site's
`Layout.astro` failed `astro check`. It now takes `OrganizationNameSource`, the slice it actually
reads (`organization.name` / `legalName`, `site.defaultLocale`); a resolved `Config` still
satisfies it, so nothing that compiled before stops compiling.

**Both templates now typecheck and lint clean on a fresh scaffold**, found by the new `scaffold`
CI job (it installs each template against this checkout's packed packages):

- `site.json` declares `neutral` and `surface` as `{ "hue": "ink", "kind": "surface" }`. As bare
  hue strings they were chromatic roles, which emit no bare `bg-neutral` and no
  `text-neutral-muted`, so the template's own footer class resolved to nothing and `vitops lint
--strict` (run by the template's pre-commit hook) failed. **Existing sites are unaffected** —
  this changes only what a new scaffold starts with; if your own `site.json` has the same two
  lines and uses `text-neutral-*` or `bg-surface*`, change them the same way.
- The `emdash` template's `index.astro` and `[...slug].astro` cast `page.data.title`, which is
  `unknown` until `emdash types` has run against a live site, so `astro check` passed only after
  the first `pnpm dev`.

No consumer-facing change in `@getvitops/core`, `@getvitops/generator`, `@getvitops/utils`,
`@getvitops/cli` or `@getvitops/vite`.
