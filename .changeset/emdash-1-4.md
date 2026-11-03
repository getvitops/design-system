---
'@getvitops/emdash': minor
'@getvitops/create': minor
---

**Tested against EmDash 1.4.** `emdash` and `@emdash-cms/cloudflare` are now `^1.4.0` in the
`emdash` template, and `@getvitops/emdash`'s peer ranges for both moved from `>=1.0.0 <2` to
`>=1.3.0 <2` — **breaking for a site still on EmDash 1.0–1.2**: upgrade `emdash` and
`@emdash-cms/cloudflare` together (EmDash warns at build when the two differ) before upgrading
this package. 1.4 fixes a stored XSS in the visual-editing toolbar (an author's published content
could run script for a signed-in editor), so an existing client site should take it promptly.

- **`vitopsHosting()` coalesces D1 reads by default** — new `cloudflare.coalesce` option
  (default `true`, passed to `d1({ coalesce })`). With `session: 'auto'`, EmDash 1.3 stops
  preloading settings/menus/widgets for logged-out visitors unless reads are coalesced, so this
  restores one round trip instead of several. It is experimental upstream: a read and a write
  started together may run write-first, so `await` a read before a write that must not affect it.
  Set `coalesce: false` to opt out. No effect without a session.
- **Template:** `AGENTS.md` gains an "EmDash 1.x behaviours" section (passkeys are bound to a
  hostname so use _Change domain_ at cutover; admin-authored HTML blocks run JS and conflict with
  Astro CSP; link by `entry.data.slug`, not `entry.id`; submit `/sitemap.xml`; clearing a stuck D1
  lock with `emdash migrate --take-over-lock`).
- **Upstream behaviour changes to know about (no code change here):** `cacheHint.lastModified` is
  no longer auto-populated and pages lose the implicit `Cache-Control: no-cache`; collection
  sitemaps paginate at 2,000 entries; `entry.id` is always locale-prefixed on multilingual sites.

No consumer-facing change in `@getvitops/core`, `@getvitops/generator`, `@getvitops/utils`,
`@getvitops/cli` or `@getvitops/vite`. `@getvitops/astro` has one — see the scaffold changeset.
