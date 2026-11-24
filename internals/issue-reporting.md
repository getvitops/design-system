# Issue reporting and triage

Moved out of AGENTS.md so the root file stays small. Read this before changing the area; the root file keeps only the cross-package rules.

Agents in downstream sites report toolchain bugs, deprecations and missing patterns to this repo's
**public** tracker with `vitops report` (`packages/cli/src/report.ts` pure, `commands/report.ts` I/O),
taught by the `vitops-report-issue` skill. Four rules carry the design:

- **The tracker is public and the client repo is not, so the agent drafts and the person confirms.**
  The default run files nothing: it prints a redacted draft and a prefilled new-issue URL.
  `--submit` still asks on a TTY, and `--yes` exists only for an agent the person has already said
  yes to. Redaction (`redact()`, terms read loosely from the raw `site.json` so it works when the
  config is the broken thing) is a net, not a guarantee, which is why the draft is shown first.
- **One body shape, two producers.** `FORM_FIELDS` in `report.ts` mirrors the labels in
  `.github/ISSUE_TEMPLATE/*.yml`; `report.test.ts` reads the forms and fails on drift, so the bot parses
  the same `### <label>` headings whether an issue came from the web form or the CLI.
- **The bot triages and nothing else.** `.github/workflows/issue-triage.yml` runs
  `claude-code-action` (pinned to a commit: it holds `CLAUDE_CODE_OAUTH_TOKEN`) with read-only repo
  access and an allowlisted tool set, against `dev`, where fixes land. Its instructions live in
  `.github/triage/prompt.md`: classify, label from a fixed list, find duplicates, check whether `dev`
  already fixed it, locate code, ask for what is missing, one comment. It never closes, assigns or
  edits, and the prompt treats the issue text as data. The tool allowlist can restrict `gh issue edit`
  to the command but not to particular labels, so the label allowlist is the prompt's, not the
  sandbox's.
- **Only trusted authors trigger it automatically.** An issue body is untrusted input and a run costs
  money, so it runs for authors with triage/write/maintain/admin access; anyone else's waits as
  `triage:new` until a maintainer adds `triage:run`. The gate reads the collaborator-permission API,
  not `author_association`, which reports a private org member as a contributor.

Labels the forms, CLI and prompt rely on must exist (`agent-report`, `deprecation`, `triage:new`,
`triage:run`, `triage:needs-info`, `triage:ready`, `triage:duplicate`, `pkg:<name>` per package);
`gh issue create --label` fails on a missing one.
