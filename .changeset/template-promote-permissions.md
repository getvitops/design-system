---
'@getvitops/create': patch
---

**Scaffolded `promote.yml` now grants the permissions the reusable promote workflow needs.** A reusable workflow can only use permissions its caller grants, and a repository's default token is read-only, so "Promote dev → main" failed at startup with no logs. Both templates now give the `promote` job `contents: write` and `pull-requests: write`. Existing sites: add that `permissions:` block to the `promote` job in `.github/workflows/promote.yml`, or set the repository's workflow permissions to read and write.
