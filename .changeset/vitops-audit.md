---
'@getvitops/cli': minor
'@getvitops/utils': minor
---

**Added: `vitops audit` — Lighthouse + axe budgets over a built site.** Non-breaking, opt-in.

`vitops audit [--build] [--url <base>] [--pages /a,/b] [--warn] [--out <dir>]` serves the existing build with `astro preview` on a dedicated port (4398; it aborts rather than attach to something else already there), audits `/` plus `/privacy`, `/terms`, `/cookies`, `/contact` and every link in `seed/seed.json`'s `primary*`/`footer*` menus, and skips any route that 404s (a 404 on `/` fails the run). Per page it runs axe (tags wcag2a, wcag2aa, wcag21a, wcag21aa) and Lighthouse on the same Chromium. Default budgets: LCP < 2500 ms, CLS < 0.1, TBT < 200 ms (the INP proxy), no serious or critical axe violations; override with `--lcp`, `--cls`, `--tbt`, `--impact`. Writes `report.json`, `report.md` and `pages/<page>.{json,md}` to `.vitops/audit/`; exits non-zero on failure unless `--warn`. Every report states that a pass is **not** AODA certification and lists the manual checks.

`playwright`, `@axe-core/playwright` and `lighthouse` are **optional peer dependencies** of `@getvitops/utils`, loaded lazily — nothing is installed or loaded unless you run the command, and a missing one fails with the install command. Pure planner and report rendering are `@getvitops/utils/audit` (new subpath).

CI: the reusable `site-ci.yml` gains opt-in `run-audit` (default `false`) and `audit-args` inputs; callers pinned to `@v1` that pass neither are unaffected.
