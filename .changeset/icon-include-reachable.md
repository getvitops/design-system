---
'@getvitops/cli': minor
'@getvitops/astro': minor
'@getvitops/create': patch
---

Make the semantic icon mapping reachable, and fail the build on unresolvable names.

`generateIconInclude()` — declare the semantic icon names a site needs plus which sets to draw
them from, get back the `include` map that keeps the bundle to just those glyphs — already existed
but was unreachable: it lived in `@getvitops/core/src/utils/`, which the package doesn't export.
It has moved to `@getvitops/utils` (a build-time concern, in the build-time utilities package),
which `@getvitops/astro` re-exports wholesale. So from `astro.config.mjs`:

```js
import { generateIconInclude } from '@getvitops/astro';
import icon from 'astro-icon';

integrations: [
  icon({
    include: generateIconInclude({
      ui: 'fa7-solid',
      brand: 'simple-icons',
      semantic: ['menu', 'close', 'search', 'github'],
    }),
  }),
];
// → { "fa7-solid": ["bars","xmark","magnifying-glass"], "simple-icons": ["github"] }
```

Swapping `ui` to `'lucide'` yields `{ lucide: ["menu","x","search"] }` from the same declaration —
which is the point: the semantic names are what your markup commits to, and the set is a config
choice. The output shape is the `include` both `astro-icon` and `astro-iconset` accept, so the
mapping doesn't tie you to either.

**Unresolvable names are now a build error.** Previously they were skipped silently, so swapping
sets appeared to succeed and the gaps surfaced as missing glyphs in production. The error names
every offender; an unknown set name throws too, listing the known sets.

Also fixes `@getvitops/create`'s emdash template, which pinned `@getvitops/astro: ^0.4.0` — a range
that stopped resolving when astro joined the fixed group at 0.7.0, so scaffolded projects were
stuck on the old line.
