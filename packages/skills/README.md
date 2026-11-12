# @getvitops/skills

Agent skills for sites built with the Vitops toolchain. A skill is a `skills/<name>/SKILL.md` an
agent loads when its `description` matches the task. They are knowledge about the toolkit, so they
ship here and update with the package instead of being copied into each site at scaffold time.

## Use

```bash
vp add @getvitops/skills
vp add -D skills
vp exec skills experimental_sync -y
```

`skills experimental_sync` links each skill into `.agents/skills/` (and `.claude/skills/` when
Claude Code is selected), records them in `skills-lock.json`, and relinks on every run, so
`vp update` refreshes them. Add it to `prepare` to run it after every install:

```json
{
  "scripts": {
    "prepare": "vp config && skills experimental_sync -y -a claude-code --no-frozen-lockfile"
  }
}
```

`--no-frozen-lockfile` matters on CI: `skills` defaults to a frozen lockfile there, so without it a fresh clone, or any `@getvitops/skills` update, fails the install until `skills-lock.json` is regenerated.

`experimental_sync` is a preview command and may change; pin the `skills` version.

A skill the site installed or wrote itself is never replaced, so a site can override one by name. The `vitops-` and `emdash-` prefixes are reserved for toolkit skills (the templates gitignore them by prefix), so name a site's own skill without them.

## Skills

Names carry scope: `emdash-*` only apply to an EmDash site, `vitops-*` to any site built with the toolchain. `vitops agents sync` lists only the ones that apply.

| Skill                        | Use it for                                                                                     |
| ---------------------------- | ---------------------------------------------------------------------------------------------- |
| `emdash-custom-blocks`       | Deciding whether a page section needs a new EmDash block type, and building it                 |
| `emdash-content-and-deploys` | Where content vs code is the truth, prerendering, publish-triggered rebuilds                   |
| `emdash-contact-form`        | The `/api/track` route, no-JS behaviour, spam protection, privacy inventory                    |
| `vitops-csp`                 | The Report-Only CSP and what to check before enforcing it                                      |
| `vitops-ads`                 | Ad pixels, conversions, attribution and call-tracking numbers (`site.ads`)                     |
| `vitops-see-the-page`        | Looking at a rendered page with `playwright-cli`                                               |
| `vitops-compliance`          | Intake and routing: which accessibility, privacy and language obligations a client may have    |
| `vitops-accessibility`       | Everyday accessibility practice plus dated AODA / federal / Quebec / EU topic files            |
| `vitops-privacy`             | CASL, PIPEDA, Quebec Law 25, other provinces and GDPR, tied to the consent gate and legal docs |
| `emdash-building-pages`      | Authoring pages from `vitops_*` blocks: nesting, page opener, escape hatches, `site.chrome`    |

The `vitops-design-system` skill still ships with `@getvitops/cli` and is linked by `vitops agents`.

### Law skills are dated, not authoritative

`vitops-compliance`, `vitops-accessibility` and `vitops-privacy` describe laws that change. Each topic file records `verified:` and `sources:` (primary sources only), and the skills tell an agent to re-check the source before a legal fact drives a decision, and always when `verified` is over 180 days old. They inform and never block: a client may knowingly accept a lower target, which is recorded in `site.accessibility` (`acceptedRisk`), not overridden.

`node packages/skills/scripts/stale.mjs` lists files past 180 days. Run it as part of the release runbook; it is not a CI test because a build should not fail when the calendar moves.
