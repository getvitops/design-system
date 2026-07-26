# @getvitops/emdash

## 0.2.0

### Minor Changes

- New `vitopsHosting()` export — the hosting seam for EmDash sites. Resolves
  the Astro adapter + EmDash database/storage for a target: `cloudflare`
  (default — `@astrojs/cloudflare`, D1 `DB`, R2 `MEDIA`) or `node`
  (`@astrojs/node` standalone, SQLite file, local uploads). Target precedence
  `HOSTING` env > `options.target` > cloudflare; adapter packages resolve
  lazily (install per target, missing ones fail with install instructions);
  `options.node.database/storage` accept full descriptors (postgres/s3) for
  production Node hosts.
