---
'@getvitops/utils': minor
'@getvitops/generator': minor
'@getvitops/cli': minor
---

`vitops search` now works from a `gcloud` login, and attributes API usage per site.

**Being logged in is enough.** With no `VITOPS_GOOGLE_*` set, an Application Default Credentials
login is used — the credential `gcloud auth application-default login` already wrote. It needs the
Search Console scopes, which are not in the default ADC set:

```
gcloud auth application-default login \
  --scopes=openid,https://www.googleapis.com/auth/siteverification,\
https://www.googleapis.com/auth/webmasters,https://www.googleapis.com/auth/cloud-platform
```

Explicit `VITOPS_GOOGLE_*` vars still win. Ambient credentials are only a fallback, because a stale
local login silently overriding a deliberate CI secret is the worst available precedence.

Beyond convenience, this removes a documented footgun: an OAuth client you create yourself sits in
_Testing_ publishing status, where Google **expires the refresh token after 7 days**. The Cloud SDK
client is published, so an ADC credential doesn't rot between onboarding runs.

**New: `site.google.project`** — the Google Cloud project API usage is attributed to, sent as
`x-goog-user-project`. One project per site is what keeps each site's usage and billing separate,
and it is the same field Maps or anything else will read later, rather than a `quotaProject` here
and a `mapsProject` there.

It is **required for a user credential and wrong for a service account**, which is why it is not
sent unconditionally. A user credential authenticates through a shared OAuth client that owns no
project, so Google refuses the call outright — measured: `403 "requires a quota project, which is
not set by default"`. A service account already belongs to a project, and pointing it at a
different one would newly require `serviceusage.services.use` there, turning a working CI
credential into a 403 for no benefit.

Using it needs both APIs (`searchconsole.googleapis.com`, `siteverification.googleapis.com`)
enabled on that project, and `serviceusage.services.use` for the identity — one grant per site,
which suits an agency administering many sites from one admin identity.

**Fixed: an ADC file in `GOOGLE_APPLICATION_CREDENTIALS` no longer hard-exits.** That variable is
Google's own convention _and_ where gcloud writes ADC, so the same variable carries two kinds of
credential. Parsing an `authorized_user` file as a service account failed with `service account
JSON is missing client_email or private_key` — while holding a credential the command already knew
how to use. It is now discriminated on `type`, the field Google's own libraries switch on.

**Also fixed — `search setup --dry` and `--check` are not offline.** The docs implied otherwise. The
state gather runs before the planner, so both read from Cloudflare and Google and both need
credentials. They still create and change nothing; `notify --dry` remains genuinely request-free.

New in `@getvitops/utils/indexing`: `parseAdcUser`, `adcQuotaProject`, `adcCredentialsPath` (pure,
so what is decidable is asserted without a filesystem), plus `googleHeaders` and the `GoogleAuth` /
`GoogleAuthLike` types. The seven exported Google request functions now take a token **or** a
`{ token, quotaProject }` — a bare string still works everywhere, so nothing needs changing.
