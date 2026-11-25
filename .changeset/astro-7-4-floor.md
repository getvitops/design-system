---
'@getvitops/astro': minor
'@getvitops/emdash': minor
---

**Breaking: the `astro` peer floor is now `>=7.4` (was `>=7`).** The templates, this repo's catalog and every site onboarded so far already run Astro 7.4 or later, and the integration is built and tested only against it; the old range promised support for 7.0 through 7.3 that nothing exercised. **Migration:** a site pinned below 7.4 (`astro: ~7.1`, or a lockfile holding 7.1 to 7.3 under an exact range) raises `astro` to `^7.4.13`; a site on a caret range already resolves to 7.4 or later and changes nothing. The Astro 5 and 6 shims are already gone, so there is no code to remove. Other fixed-group packages: no consumer-facing change.
