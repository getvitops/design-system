---
'@getvitops/create': minor
---

**Templates move to Vite+ 1.7.** Both templates now pin `vite-plus: ^1.7.0` and `vite: npm:@voidzero-dev/vite-plus-core@^8.3.8000`. From 1.7.0 the core package is versioned on Vite's own 8.3.x line while `vite-plus` stays 1.x, so the old `^1.5.1` alias would have resolved to core 1.6.0 beside vite-plus 1.7.0. **Migration:** an existing scaffolded site changes both `vite` and `vite-plus` together (and in its `pnpm-workspace.yaml` catalog if it has one); bumping only one leaves a mismatched pair. No consumer-facing change to the toolchain packages in this release.
