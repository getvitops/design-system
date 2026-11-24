---
'@getvitops/create': minor
---

Scaffolded sites now format `.astro` files with Oxfmt. Both templates declare `@astrojs/compiler-rs` (Oxfmt's optional peer) as a devDependency and set `fmt.astro: true` in `vite.config.ts`; the static template gains a `vite.config.ts` it did not have, which also pins `semi`/`singleQuote` to match the emdash template. Oxfmt skips `.astro` silently unless both are present. Existing sites opt in by adding the devDependency and `fmt: { astro: true }`.
