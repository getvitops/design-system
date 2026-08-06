---
'@getvitops/generator': minor
'@getvitops/cli': minor
---

Separate where a processor stores information from whose law can reach it.

A processor carried one optional `country`, and the privacy policy flat-deduped it into a single
sentence. That conflated two facts a disclosure has to keep apart — **where the data rests** and
**which jurisdiction can compel access** — and privacy law turns on the second: the OPC's concern
is foreign _access_, not merely foreign storage.

Ordinary arrangements were inexpressible. Azure is data-resident in Canada and US-controlled;
Zoho can serve mail from a Canadian datacentre and telemetry from the US while being headquartered
in India; a Microsoft 365 tenant can be Canadian with its identity data in the US. For all of
them every available option was wrong: `country: "Canada"` rendered the incoherent _"outside of
Canada, including Canada"_, naming the operator's country asserted storage that wasn't happening,
and omitting it dropped the processor from the disclosure **silently**.

**New on a processor:**

```jsonc
{
  "name": "Zoho",
  "purpose": "receiving and storing email sent to us",
  "storage": [
    { "country": "Canada", "scope": "mail and productivity data" },
    { "country": "the United States", "scope": "analytics and telemetry" },
  ],
  "operatorCountry": "India",
}
```

- `storage[]` — where information rests, each entry optionally `scope`d to a category. The scope
  is what makes "Canadian tenant, identity data in the US" sayable.
- `operatorCountry` — the jurisdiction that can compel the provider to produce it. Gets its own
  sentence: _"…established in, or controlled from, jurisdictions outside of Canada, including
  India. Personal information those providers handle on our behalf may be subject to the laws of
  those jurisdictions even when it is stored in Canada."_
- `country` still works, as shorthand asserting **both** facts — which is what it always
  asserted, since the sentence it fed claimed storage and legal reach in one breath.

**Combining `country` with either explicit field is rejected** by `vitops validate`. Whether the
shorthand narrows the explicit fact or adds to it are two readings that make contradictory legal
claims, so neither is guessed.

A country in the policy's own jurisdiction is no longer treated as a transfer, which is the
`country: "Canada"` fix. Comparison ignores case and a leading "the".

### This changes text you have already published

**Cloudflare, Cloudflare Turnstile, Vercel and Netlify now assert operator jurisdiction and no
storage.** They previously claimed `the United States` into a sentence saying "stored or processed
in" — a claim about the wrong fact. Cloudflare is anycast: a request from Toronto is answered from
a Toronto PoP, and Workers/R2 have residency controls the config cannot see.

So a site whose only foreign element is its host or Turnstile **stops claiming foreign storage**
and instead discloses foreign legal reach. That is a retraction in the direction of accuracy, and
it deserves a re-read. **If you pin a US region, say so** — declare a processor with
`storage: [{ country: "the United States" }]`. This generalises the rule the provider table
already applied to Matomo: "we don't know" is a fact.

**Everything else renders identically.** Google Analytics, Tag Manager, Clarity, Plausible,
Matomo Cloud and any processor you declared with `country` produce the same words as before,
because the shorthand expands to both facts and the operator sentence is suppressed when it would
only restate a country already disclosed as storage. The one cosmetic change: the closing
"subject to access requests…" sentence is now its own paragraph, since it is shared by both
clauses.

**A processor with no location at all is now reported** on stderr by `vitops legal`, naming the
document it will be missing from. It cannot appear in a transfer disclosure — there is nothing
true to say — but it used to vanish in silence, which is the failure that looks tidy. It is not a
validation error: a bare `{ name, purpose }` is still valid.

New exports from `@getvitops/generator`: `processorsMissingLocation`, `JURISDICTION_COUNTRIES`,
and the `ProcessorStorage` type. `PolicyVars` gains `jurisdictionCountry`, `storageCountries`,
`scopedStorage` and `operatorCountries`; `countries` is **deprecated but retained**, and still
names every country it ever named, so a custom template keeps rendering what it rendered.
