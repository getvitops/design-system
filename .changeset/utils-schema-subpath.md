---
'@getvitops/utils': major
---

**Breaking — schema.org JSON-LD graph builders moved to `@getvitops/utils/schema`.**

`articleGraph`, `breadcrumbGraph`, `faqGraph`, `itemListGraph`, `localBusinessGraph` and
`organizationGraph` (plus their option/type exports) are no longer exported from the bare
`@getvitops/utils` entry point. Import them from `@getvitops/utils/schema` instead:

```diff
-import { articleGraph } from '@getvitops/utils';
+import { articleGraph } from '@getvitops/utils/schema';
```

The bare entry point pulls in `sharp`/`png-to-ico` for favicon generation — exactly what a
server-rendered page must not carry into its Worker bundle when it renders a `<Article />`/
`<Organization />`/etc. schema component under `output: 'server'`. This is the same split
`notify`/`tracking`/`security` already made, for the same reason.

`@getvitops/astro`'s own `<Article />`/`<Organization />`/`<Breadcrumb />`/`<FAQ />`/
`<LocalBusiness />`/`<Carousel />` schema components already import from the new subpath as of
this release, so a consumer using only those needs no change — only a consumer importing these
builders directly from `@getvitops/utils`.
