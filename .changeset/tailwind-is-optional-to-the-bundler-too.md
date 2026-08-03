---
'@getvitops/astro': patch
---

Fixed: a site on `css.format: 'css'` failed to build because of Tailwind.

`getvitops()` loads `@tailwindcss/vite` lazily, so a project that never sets `css.format:
'tailwind'` should never touch it. But the specifier was a literal, which makes it statically
analysable — so the bundler **followed** the import regardless of the branch ever running, down
through `@tailwindcss/node` to `@tailwindcss/oxide`'s native `.node` binding, which it cannot parse.
The build died on `[UNLOADABLE_DEPENDENCY] … stream did not contain valid UTF-8`, naming a package
the project does not use and never asked for.

The specifier now goes through a constant with `/* @vite-ignore */`, matching how the other
optional peers in that file (`astro-icon`, `astro-iconset`) were already loaded. Optional has to
mean optional to the bundler too.
