## What & why

<!-- The "why" matters more than the "what" here — see AGENTS.md's own changelog
     guidance: name the change in consumer-facing terms, not just what moved. -->

## Checklist

- [ ] `npx changeset` added, if this touches a published package (`core`, `generator`, `utils`,
      `cli`, `vite`, `astro`, `emdash`, `create`) — see AGENTS.md's "Release runbook"
- [ ] `docs/` and `DESIGN.md` regenerated (`vp run build:theme` / `vp run build:design`) if this
      changed the schema, the CSS framework, or anything else they derive from — CI's `generated`
      job fails the diff otherwise
- [ ] Tests added or updated for the behaviour this changes
