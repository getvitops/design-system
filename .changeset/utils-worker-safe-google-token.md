---
'@getvitops/utils': minor
---

**`@getvitops/utils/notify` is Worker-safe again.** It re-exports the Google Ads offline-conversion
upload, which reached `google/token.ts` and its `node:crypto` import, so the subpath could not load in
a bare Worker. The service-account JWT is now signed with Web Crypto (`crypto.subtle`, RS256) — same
token, same PKCS#8 key Google issues, no Node builtin. A new `worker-safe.test.ts` walks each Worker
subpath's import graph and fails on any `node:` specifier.

**Breaking, narrow:** `@getvitops/utils/ads` no longer re-exports `createApexTxt`, `findZoneId` and
`listApexTxt`. Import them from `@getvitops/utils/onboarding`, where they were always defined. The
re-export tied the ad-platform capability table (imported by the generator and by Worker code) to the
Cloudflare network executors. `vitops` itself already imported them from `onboarding`.

Other packages in the `fixed` group: No consumer-facing change in this package.
