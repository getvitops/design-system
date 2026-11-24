---
'@getvitops/skills': patch
---

Fix `vitops-compliance`'s frontmatter: an unquoted `: ` in its description was invalid YAML, so `skills experimental_sync` skipped the skill with only a warning. Not CSS; no format affected.
