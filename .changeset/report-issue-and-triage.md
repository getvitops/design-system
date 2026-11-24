---
'@getvitops/cli': minor
'@getvitops/skills': minor
---

**Downstream agents can report toolchain issues, and a bot triages them.**

- **`@getvitops/cli`: new `vitops report`** drafts an issue against the toolchain's public tracker. It adds the installed `@getvitops/*` versions and detected platform, redacts the site config's organization name, domains, environment URLs and contact details plus generic secrets (tokens, emails, home paths, IPs), and prints the draft, what it redacted and a prefilled new-issue URL. It files nothing by default; `--submit` files it after a TTY confirmation (`--yes` skips that and is for an agent whose user has approved the draft), and `--search` lists possible duplicates first. Needs `gh` only for `--search` and `--submit`.
- **`@getvitops/skills`: new `vitops-report-issue` skill** says when to report, when not to, and the draft → show the person → file-on-yes sequence. Existing sites: `vp install` links it; nothing to change.

No consumer-facing change in the other packages of the fixed group. Repo-side (not shipped): issue forms under `.github/ISSUE_TEMPLATE/` and a read-only triage workflow, `.github/workflows/issue-triage.yml`.
