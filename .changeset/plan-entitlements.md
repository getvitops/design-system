---
'@getvitops/generator': minor
---

**New: `site.plan`** — records a commercial plan/add-on entitlement (`{ key, addons? }`),
distinct from a section's own `enabled` flag: `enabled` answers "does this site do X at all"
(a capability switch); `plan` answers "is this client entitled to turn X on" (a commercial
switch one layer above). Absence means unrestricted, matching every other opt-in block in
`Config`.

`PLAN_CAPABILITIES` (new export) is the small, hand-authored table of which add-on gates
which `Config` field — today: `ab_testing` gates `site.abTesting.enabled`, any
`environments.*.variant`, **and any enabled `site.experiments` entry** (that last one was
missed in this feature's first pass and fixed before release — found while planning this
toolchain's downstream adoption, not by a consumer hitting it), `server_side_tracking` gates
`site.tracking.enabled`. `validateConfig` now rejects a config that turns on a gated feature
without listing the owning add-on in `site.plan.addons`, naming the add-on in the error.

**Breaking**: an existing config using `site.abTesting.enabled`/`environments.*.variant` or
`site.tracking.enabled` now needs a matching `site.plan.addons` entry, or `validateConfig`
rejects it. Add `site.plan: { key: '<your-plan>', addons: ['ab_testing'] }` (and/or
`'server_side_tracking'`) to a config already using either feature.
