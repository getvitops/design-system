---
'@getvitops/astro': minor
---

Add `toNotifyContext(config, locale?)` and `toCrmConfig(config)`, exported from
`@getvitops/astro/routes` beside `createConversionRoute()`. Builds the `context`/`crm.config`
options straight from a resolved `Config` instead of hand-writing a `NotifyContext` literal —
`conversion.ts`'s own docblock used to state this helper "does not exist."

`organization.name` is localizable; `toNotifyContext` resolves it for a given locale (default
`site.defaultLocale`), falling back to `legalName` when neither locale nor default resolves to
anything. `locationEmails` is ordered primary location first, then every other location with an
`email` set, in `organization.locations`' own key order.
