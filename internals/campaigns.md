# Email campaigns (`site.campaigns`)

Read this before changing the area. It sits beside [crm.md](crm.md): a CRM write answers "someone
wants to be contacted", a campaign signup answers "someone wants a stream of messages about one
topic". The two carry different consent, so they are different blocks.

`site.campaigns` (`@getvitops/utils/campaigns`) subscribes an opted-in visitor to a list in a
campaign tool, server-side, from the same `createConversionRoute()` every conversion reaches.
Providers today: **Zoho Campaigns** and **SendFox**. HubSpot (a subscription type on the same
Forms submission) and Jobber are open items, below.

## Why a separate block, and why routed by intent

- **Consent is per purpose.** Under CASL a contact-form enquiry gives limited implied consent for
  related replies; a list signup is express consent to a stream and needs a record and an
  unsubscribe. Whatever the topology, the toolkit has to tell the two apart.
- **Subscription state lives where the email is sent.** Confirmations, unsubscribes and bounces
  happen in the campaign tool. A CRM can record a fact ("opted in to the waitlist on 2026-11-26"),
  never reliably "is subscribed" unless a vendor sync writes state back. So this module only
  _asks_ the tool to subscribe and never mirrors state anywhere.
- **No dependence on a vendor sync.** Bigin → Zoho Campaigns exists, but it is configured in
  Zoho's UI, allows one sync per account (so separate lists become segments), and cannot be
  declared or checked from config. A client with only a newsletter should also not need a CRM.
- **Zoho clients call the Campaigns API directly**, with their own refresh token (scope
  `ZohoCampaigns.contact.CREATE`), not through Bigin.

## Load-bearing rules

- **The opt-in field is the gate**, `campaigns.consentField` (default `subscribe`), not the
  `marketing` cookie category. Ticking the box is the consent, as submitting a contact form is the
  necessary processing for an enquiry. A dedicated signup form renders the field as a hidden input:
  pressing its own "Join the waitlist" button is the express request. An unticked box submits
  nothing, so "absent" and "declined" are the same, which is the safe reading.
- **A plan is pure** (`plan.ts`): it says which lists, or why not, from config, credentials and
  the submission. An unknown list key is reported, never guessed at; with no list named, the only
  unambiguous case is exactly one configured list. `Object.hasOwn` guards the key lookup, so a
  form cannot name `constructor`.
- **A failed signup never fails the request**, and `deliverToCampaigns()` never throws. It returns
  `null` when nothing was asked for, so an ordinary enquiry adds no line to the notification email.
- **The notification email is the consent record.** `describeCampaignsResult()` puts the opt-in
  time, page and IP in the Delivery line. There is no separate store; the email is the
  durability floor, as it is for the CRM.
- **Campaigns run before the CRM**, so a configured CRM can record the opt-in as a fact on the
  contact (`CrmDeps.signup`, appended to the record's message: Bigin Description, Jobber note).
  `campaigns.mirrorToCrm: false` turns that off for clients who already sync the CRM to the
  campaign tool; a signup-only form (opted in, no message of its own) then skips the CRM write and
  the email says why. The fact is "opted in", never "subscribed".
- **Credentials are a function of `locals`**, never config:
  `VITOPS_ZOHO_CAMPAIGNS_CLIENT_ID` / `_CLIENT_SECRET` / `_REFRESH_TOKEN`, `VITOPS_SENDFOX_TOKEN`.
- **Zoho answers 200 for most failures**; success is classified on the body (`status: "success"`),
  the same lesson as `jobber.ts`. One Zoho call per list, each isolated from the others.
- **`legal/` follows the config.** A configured, enabled `site.campaigns` raises the CASL
  paragraph without needing a newsletter-named form field, and names the provider as a processor.

## Open items (each stated, none guessed)

- **Zoho Campaigns has no Canadian data centre in `ZOHO_CAMPAIGNS_DATA_CENTERS`.** Zoho's Campaigns
  docs name hosts for `com`, `eu`, `in`, `com.au` and `jp` only; a guessed `.ca` host would fail at
  the first signup instead of at validation. Verify against a live Canadian-DC account first.
- **SendFox's `lists` shape is unverified.** Its help centre shows `lists[]` as form pairs, its
  developer docs an integer array. `sendfox.ts` sends JSON with an integer array; confirm on a
  test account. Double opt-in is an account-level SendFox setting, a setup requirement rather
  than a request flag.
- **Operator and storage jurisdiction.** SendFox's `operatorCountry` is the United States (Sumo Group Inc.,
  Delaware, checked against its live policy 2026-11-27); its storage is unset because the policy names no
  hosting location. Zoho Campaigns' is unset on purpose: Zoho's policy names the whole group as joint
  controllers and hosted data centers are per entity, so no single country is true.
- **HubSpot** is not a provider yet. It should ride on the existing Forms submission with
  `legalConsentOptions` rather than a second contact write. Until then the CRM signup fact is not
  rendered for a HubSpot CRM, because `hubspot.ts` does not read `message`.
- **Jobber** is undecided. It has no list-subscription API found so far; introspect its GraphQL
  schema on a live dev app for a marketing-consent or tag field. Outcomes: add it as a provider;
  or tag the client through the existing `site.crm` Jobber path with no double opt-in; or drop it.
- **Not built yet:** the `site.campaigns` projection for the portal (`UNPROJECTED` states why).
- **`campaigns check` is unverified against live accounts**, like the executors: SendFox's `GET /lists`
  pagination keys come from a third-party mirror (it follows a `next_page_url` only when it stays on
  `api.sendfox.com`), and Zoho's `getmailinglists` response shape is from Zoho's docs. SendFox's API
  needs a paid plan (402 on Free), which both the subscribe and the check say by name.

## The form opt-in

`<ContactForm subscribeList="waitlist">` (and the `vitops_form` block's three matching fields)
renders what the route reads, decided purely by `resolveSubscribe()` in `@getvitops/utils/contact-form`:

- **`checkbox`** (default): an unticked box named `subscribe` (value `yes`) plus a hidden `list`.
- **`only`**: a dedicated signup. The consent field is a hidden input, because pressing the form's own
  button is the express request, and a visible statement says what the visitor is agreeing to (CASL
  asks that the purpose be clear). The default statement is overridden by `subscribeLabel`.
- An unsafe list key is dropped, never repaired: a silently renamed key would subscribe a visitor
  to a different list than the editor meant. The two field names default to `site.campaigns`'s and
  are overridable per form; nothing reads the config at render time.
- Rendering reserves the two names, so an author's own `subscribe`/`list` field becomes
  `subscribe_2`/`list_2` instead of shadowing the opt-in. `resolveFields`' `reserved` argument is
  optional, so a form with no opt-in is unchanged.
- `formTemplateFromBlock` adds the checkbox to the `site.templates` entry (not the hidden `only` control,
  whose email field is already there), so `vitops legal` describes it.

No retry queue, no client-side path, and no shared connector framework: two providers with
different transports (a form POST per list, one JSON POST for all lists) are evidence against a
shared abstraction, the same restraint `crm.md` records.
