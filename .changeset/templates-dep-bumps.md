---
'@getvitops/create': minor
---

**Templates move to current dependency ranges.** Both templates now float `astro ^7.4.13`, `wrangler ^4.166.0`, `playwright ^1.65.1`, `skills ^1.9.0` and `@astrojs/compiler-rs ^0.5.3`; the EmDash template also moves to `emdash` and `@emdash-cms/cloudflare ^1.5.0`, `@astrojs/cloudflare ^14.4.9`, `@astrojs/react ^7.1.9`, `tailwindcss` and `@tailwindcss/vite ^4.3.5`, and `@cloudflare/workers-types ^5.20260722.1` (the range `wrangler` now peers on). **Migration:** an existing scaffolded site raises the same ranges, and moves `@cloudflare/workers-types` from 4.x to 5.x together with `wrangler`. No consumer-facing change to the toolchain packages in this release: the repo's own catalog moved to the same patch levels, including `zod` and `@zod/mini` at 4.6.7 (one copy, so the generator's declaration emit stays clean).
