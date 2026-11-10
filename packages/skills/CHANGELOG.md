# @getvitops/skills

## 0.1.0-alpha.0

### Minor Changes

- 0a47856: New package `@getvitops/skills`: agent skills for sites built with the toolchain (`custom-blocks`, `content-and-deploys`, `contact-form`, `csp`). The emdash template depends on it and runs `skills experimental_sync` on `prepare`, which links them into `.agents/skills/` and `.claude/skills/`, so they update with `vp update` instead of being copied at scaffold time. Existing sites: `vp add @getvitops/skills && vp add -D skills`, set `prepare` to `vp config && skills experimental_sync -y -a claude-code --no-frozen-lockfile`, gitignore the four linked names, and delete the site's own copies of those four skills (the sync never replaces a directory it did not create).

  The emdash template's `AGENTS.md` is shortened to the always-relevant rules. Deploy and content mechanics (where each kind of data is the truth, prerendering, publish-triggered rebuilds, refreshing dev), the contact form, and the CSP move into those skills. Corrects the nesting guidance: a block type with a `portableText` field (such as `vitops_section`) holds other blocks, while `vitops_*` Portable Text blocks do not. Adds guidance for agents to record reusable toolkit gaps in `UPSTREAM.md`. The generated stylesheet is no longer described as always `tailwind.css`.
