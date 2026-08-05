---
'@getvitops/utils': major
'@getvitops/cli': major
---

`vitops search notify` now accepts either Google credential, so most sites need only one.

The two halves of `vitops search` each demanded a different, unrelated Google setup — five environment variables between them. `search setup` requires a user OAuth credential (verifying a site makes the caller an **owner** of the property, and that should be a person, not a project robot), while `search notify` accepted only a service account. Search Console does not care which identity calls it, so a consumer who had already run `search setup` was being made to create a second credential for the other half of the same command.

`search notify` now takes whichever you have, preferring the service account when both are set — it runs on every deploy, in CI, and a service account does not expire, whereas a refresh token can be revoked and expires after 7 days for an OAuth client still in _Testing_ publishing status. `search setup` is unchanged and still requires user OAuth.

**Breaking — two renamed exports.** Both did the same job under the same name from different subpaths, which forced an alias at every call site:

- `@getvitops/utils/indexing`: `getAccessToken` → **`serviceAccountToken`**
- `@getvitops/utils/onboarding`: `getAccessToken` → **`refreshTokenGrant`**

New: `googleAccessToken(credential)` from `@getvitops/utils/indexing` takes a `GoogleCredential` union and is what both wrappers now call. If you were importing either `getAccessToken`, switch to the specific name, or to `googleAccessToken` if you want to accept either identity.

Internally the exchange is now one function. The two grants send different form bodies; everything after that — endpoint, content-type, error handling, `access_token` extraction — was duplicated verbatim in two modules. The service-account JWT signing had no test at all, because it was only reachable over the network; it now does, including the literal-`\n`-in-a-PEM case that secret stores produce.
