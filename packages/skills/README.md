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

A skill the site installed or wrote itself is never replaced, so a site can override one by name.

## Skills

| Skill                 | Use it for                                                                     |
| --------------------- | ------------------------------------------------------------------------------ |
| `custom-blocks`       | Deciding whether a page section needs a new EmDash block type, and building it |
| `content-and-deploys` | Where content vs code is the truth, prerendering, publish-triggered rebuilds   |
| `contact-form`        | The `/api/track` route, no-JS behaviour, spam protection, privacy inventory    |
| `csp`                 | The Report-Only CSP and what to check before enforcing it                      |

The `vitops-design-system` skill still ships with `@getvitops/cli` and is linked by `vitops agents`.
