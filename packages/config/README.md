# @getvitops/config

The site-config blocks the Vitops toolchain's provider integrations read — CRM, ads, reviews,
indexing, notifications, tracking — as [`@zod/mini`](https://zod.dev) schemas and inferred types.

```ts
import { CrmSchema, type CrmConfig } from '@getvitops/config';
import { AD_PROVIDERS } from '@getvitops/config/providers'; // bare literals, no zod
```

A leaf package: it imports `@zod/mini` and nothing else in the workspace. The umbrella `Config`
(`designSystem` / `organization` / `site`) lives in `@getvitops/generator`, which composes these blocks.
See the repo's `adr/0001-site-config-and-providers-packages.md`.
