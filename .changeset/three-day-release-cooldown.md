---
'@getvitops/create': minor
---

**Scaffolded projects now hold new releases for 3 days before installing them.** Both templates set
`minimumReleaseAge: 4320` (the `emdash` template was 1440; the `static` template had no
`pnpm-workspace.yaml` and so used pnpm's one-day default). The `static` template now ships a
`pnpm-workspace.yaml` carrying the cooldown, the build approvals, and the same toolchain exemptions as
`emdash` — `@getvitops/*` and the Vite+ / Oxc tools are exempt, since they release together.

If a fresh install in a scaffolded project is rejected for a dependency published in the last three
days, wait for it to age or add its exact version to `minimumReleaseAgeExclude`. Existing projects are
not changed.

Formats reached: none — no CSS change. Other packages in the `fixed` group: No consumer-facing change
in this package.
