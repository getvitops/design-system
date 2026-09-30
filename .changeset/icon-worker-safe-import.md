---
'@getvitops/generator': patch
'@getvitops/astro': patch
---

**Fixed: `<Icon />` no longer crashes a Cloudflare Workers SSR page.** It statically imported
`loadIconSvg`/`spriteId` from `@getvitops/generator`'s root entry, which also re-exports
`generate.ts` — reaching lightningcss, whose native binary Workers cannot `require()`.
Rendering `<Icon>` anywhere in an SSR project 500'd every request, regardless of
`icons.engine`, since the import itself (not just calling the function) pulled lightningcss
into the bundle. Fixed by publishing a new Worker-safe `@getvitops/generator/icons-sprite`
subpath (`buildIconSprite`/`loadIconSvg`/`spriteId`, no lightningcss in its import graph) and
switching `<Icon />` to import from there.
