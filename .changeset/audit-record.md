---
'@getvitops/cli': minor
---

**Added: `vitops audit --record`.** Opt-in. On a run with no failing pages it writes `site.legal.accessibilityStatement.testedOn` (today, `YYYY-MM-DD`) and adds `automated` to `testing` in the `--input` config, so the statement's "last tested" date no longer goes stale by hand. It **never sets `conformance`**: an automated pass is not a conformance claim (axe and Lighthouse detect only a minority of WCAG failures, and the audit report says so), so a person still sets `conformance` and adds `keyboard` / `screen-reader` after the manual checks.

It patches the raw file, preserving its indentation, and validates the result first. It skips with a message on a failing run, when `site.accessibility.level` is `none`, when `accessibilityStatement` is not set (it will not guess `enabled`), when the config is a `.js`/`.ts` module, or when the date and method are already recorded. Without `--record`, nothing changes.

`@getvitops/utils` and the other toolchain packages: no consumer-facing change.
