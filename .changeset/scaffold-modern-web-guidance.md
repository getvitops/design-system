---
'@getvitops/create': minor
---

Scaffolded sites install the `modern-web-guidance` agent skill. Both templates ship a `skills-lock.json` naming it (`GoogleChrome/modern-web-guidance`, a GitHub-sourced skill rather than an npm dependency) and run `skills experimental_install -y -a claude-code --no-frozen-lockfile` on `prepare`, before the existing `experimental_sync` of `@getvitops/skills`, so one lock file holds both. The install is not frozen because the skill is Google's: a change upstream would otherwise fail every site's install in CI until its lock was updated. `skills` moves to `^1.8.1` (lock version 2), and `_gitignore` ignores the installed copy and its `.claude` link. Not CSS; no format affected. Other fixed-group packages: no consumer-facing change.
