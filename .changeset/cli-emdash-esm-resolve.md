---
'@getvitops/cli': patch
---

**Fix: `vitops emdash check-seed` and `form-template` reported `@getvitops/emdash is not installed` when it was.** Both resolved the package with `require.resolve`, which throws for a package whose `exports` carry only an `import` condition, as `@getvitops/emdash` does. They now resolve its `package.json` and import its ESM entry. No change to what either command checks. Other fixed-group packages: no consumer-facing change.
