---
'@getvitops/config': minor
'@getvitops/utils': minor
'@getvitops/generator': minor
'@getvitops/astro': minor
'@getvitops/cli': minor
'@getvitops/emdash': minor
---

Added: `site.campaigns`, email-list signups (waitlist, blog updates, reports) subscribed through **Zoho Campaigns** or **SendFox**. It sits beside `site.crm` rather than inside it: an enquiry wants a reply, a signup wants a stream of messages, and the two carry different consent.

- `site.campaigns` takes a `provider`, named `lists` (`{ label, zohoCampaigns: { listKey } | sendfox: { listId } }`), and optional `consentField` (default `subscribe`), `listField` (default `list`) and `mirrorToCrm` (default `true`). `validateConfig` requires the provider's block and per-list id. Zoho Campaigns accepts `com`, `eu`, `in`, `com.au` and `jp` data centres; there is no Canadian one because Zoho documents no Canadian Campaigns host.
- `createConversionRoute()` takes a `campaigns: { config, credentials }` option (`toCampaignsConfig(config)` adapts it). A visitor is subscribed only when the opt-in field is ticked; the `marketing` cookie category is not the gate. Credentials come from `locals`: `VITOPS_ZOHO_CAMPAIGNS_CLIENT_ID` / `_CLIENT_SECRET` / `_REFRESH_TOKEN`, or `VITOPS_SENDFOX_TOKEN`. A failed subscribe never fails the request, and the opt-in time, page and IP go into the notification email's Delivery section as the consent record.
- When `site.crm` is also configured, the CRM contact records the opt-in as a fact ("Opted in to: Waitlist (2026-11-26)") in Bigin's Description or Jobber's note, never as subscription state. Set `mirrorToCrm: false` for clients who already sync their CRM to the campaign tool; a signup-only form then skips the CRM write. The fact is not rendered for a HubSpot CRM yet.
- New Worker-safe subpath `@getvitops/utils/campaigns` (`planCampaigns`, `deliverToCampaigns`, `describeCampaignsResult`).
- Legal documents: a configured, enabled `site.campaigns` raises the CASL paragraph without needing a newsletter-named form field, and names Zoho Campaigns or SendFox as a processor. Their operator and storage jurisdiction are left unset pending verification.

- Forms: `<ContactForm>` and the EmDash `vitops_form` block take an optional email-list opt-in (`subscribeList`, `subscribeLabel`, `subscribeOnly`). By default it is an unticked "Email me updates" checkbox plus a hidden list key; `subscribeOnly` makes a dedicated signup whose button is the opt-in, with a visible consent statement. An author's own field named `subscribe` or `list` is renamed (`subscribe_2`) rather than shadowed. `formTemplateFromBlock` adds the checkbox to the generated `site.templates` entry so the privacy policy describes it. The sample form now uses it instead of a bare `newsletter` checkbox, which was never wired to anything.
- CLI: `vitops campaigns check` fetches the account's live lists and exits non-zero when a configured `listKey`/`listId` does not exist. It needs `VITOPS_ZOHO_CAMPAIGNS_CLIENT_ID` / `_CLIENT_SECRET` / `_REFRESH_TOKEN` (a token with `ZohoCampaigns.contact.READ`) or `VITOPS_SENDFOX_TOKEN`. SendFox's API needs a paid plan and answers 402 on the Free plan.

Formats: `@getvitops/astro` (route, `<ContactForm>`), `@getvitops/emdash` (block), `@getvitops/generator` (config, legal), `@getvitops/config` (schema) and `@getvitops/cli` only; no CSS changed, so no format output differs. Not yet shipped: HubSpot and Jobber providers. No existing config or saved form needs migration.

No consumer-facing change in `@getvitops/core` or `@getvitops/vite`.
