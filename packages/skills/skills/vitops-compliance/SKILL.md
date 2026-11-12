---
name: vitops-compliance
description: Load at the start of any client engagement, when a client mentions compliance, AODA, CASL, Law 25, PIPEDA, GDPR, accessibility, privacy or French-language requirements, or when asked "what do we need to do for client X". Intake and router: asks what applies, points to the topic files, says where decisions are recorded.
---

# Compliance intake and router

We are an Ontario agency (Ottawa local, Ontario provincial, serving all of Canada). Clients differ:
some are legally bound by AODA, CASL, Quebec Law 25, PIPEDA or EU rules; some knowingly accept
risk until a complaint arrives. This skill asks the right questions and routes to the facts. It
does not contain the law, and nothing here says a site **is** compliant or is legal advice.
Counsel should confirm.

## 1. Currency: laws change

Every topic file has `verified:` and `sources:` in its frontmatter. Before a legal fact drives a
decision, a client-facing statement or a config value, re-check it against the primary source.
**Always** re-check if `verified` is more than 180 days before today. The source beats this
skill. If a source disagrees with a file, say so to the user and recommend the skill be updated.

## 2. Inform, don't enforce

Your job is to make the gap, the risk and the decision explicit, then record it. A client may
knowingly accept a lower accessibility or privacy posture. Do **not** block work, refuse a client
choice, or silently change a design or behaviour to a standard the client has not adopted.
Report gap and risk; get the decision; record who, when and why.

## 3. Intake questions

Look in `site.json` first (`organization`, `site.locales`, `site.analytics`, `site.ads`,
`site.crm`, `site.tracking`, `site.legal`, `site.accessibility`), then ask only what is missing.

1. Where is the organisation based?
2. Where are its users: Ontario, other provinces, Quebec, EU, elsewhere?
3. Size: peak number of Ontario employees in the last 12 months. Count contract workers; do not
   count independent contractors, volunteers or staff outside Ontario. Some laws have thresholds
   (AODA: 20 and 50); the topic files say which.
4. Sector: public, broader public, private, non-profit, federally regulated?
5. Does it send commercial electronic messages (newsletter, promotions, automated follow-ups)?
6. What personal information does it collect (forms, CRM, analytics, ads, call tracking)?
7. Does it serve Quebec consumers (privacy and language both)?
8. Does it publish PDFs or other documents?
9. Any contractual requirement, e.g. a public-sector customer's procurement terms?

## 4. Obligation matrix

Pointers only; the topic files hold the facts and their dates.

| Answer                                                  | Read                                                                                                                                                  |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ontario organisation or Ontario users                   | [ontario-aoda](../vitops-accessibility/ontario-aoda.md), [pipeda](../vitops-privacy/pipeda.md)                                                        |
| Federally regulated, or federal customer                | [canada-federal](../vitops-accessibility/canada-federal.md)                                                                                           |
| Quebec users or Quebec presence                         | [quebec](../vitops-accessibility/quebec.md), [quebec-law-25](../vitops-privacy/quebec-law-25.md), [quebec-french-language](quebec-french-language.md) |
| Other provinces                                         | [other-provinces (accessibility)](../vitops-accessibility/other-provinces.md), [other-provinces (privacy)](../vitops-privacy/other-provinces.md)      |
| Newsletter, promotions, any commercial email or message | [casl](../vitops-privacy/casl.md)                                                                                                                     |
| EU audience                                             | [eu-eaa](../vitops-accessibility/eu-eaa.md), [eu-gdpr](../vitops-privacy/eu-gdpr.md)                                                                  |
| Collects personal information, analytics, ads, CRM      | [pipeda](../vitops-privacy/pipeda.md) plus the province or region files above                                                                         |
| Publishes PDFs or documents                             | [documents-pdf](../vitops-accessibility/documents-pdf.md)                                                                                             |
| Contract names a standard                               | The file for that standard; the contract text governs                                                                                                 |

## 5. Where decisions are recorded

- `site.accessibility`: `standard`, `level`, `acceptedRisk` (`packages/config/src/accessibility.ts`).
- `site.legal.jurisdiction` (`ca` or `qc`) and `site.legal.privacyPolicy.processors`
  (`packages/generator/src/config.ts`); generated documents come from `vitops legal`.
- `site.analytics`, `site.ads`, `site.crm`, `site.tracking`: the facts that drive the consent gate
  and the generated cookie notice (see `vitops-consent`, `vitops-ads`).
- `site.locales` and `site.defaultLocale`: whether a French version is published.
- `vitops audit` writes an accessibility report as a build artifact only. Never publish it in the
  site.

## 6. Recording an accepted risk

1. Tell the client, in plain terms, what the target would be, what is missing and what the
   exposure is (cite the topic file and its `verified` date).
2. Ask whether they accept it. Do not assume.
3. Write who, when and why in `site.accessibility.acceptedRisk`, e.g. `"Client accepted below AA
   until rebrand, per J. Smith, 2026-11-11"`, and set `level` to what they chose (`none` only
   reports). For privacy or language there is no dedicated field: put the same note in the PR
   description and the client's decision log.
4. Mention the decision in the PR description. `acceptedRisk` is free text, never read for logic.

## 7. Topic index

Accessibility: [ontario-aoda](../vitops-accessibility/ontario-aoda.md),
[canada-federal](../vitops-accessibility/canada-federal.md),
[quebec](../vitops-accessibility/quebec.md),
[other-provinces](../vitops-accessibility/other-provinces.md),
[eu-eaa](../vitops-accessibility/eu-eaa.md),
[documents-pdf](../vitops-accessibility/documents-pdf.md).

Privacy: [pipeda](../vitops-privacy/pipeda.md), [quebec-law-25](../vitops-privacy/quebec-law-25.md),
[casl](../vitops-privacy/casl.md), [other-provinces](../vitops-privacy/other-provinces.md),
[eu-gdpr](../vitops-privacy/eu-gdpr.md).

Language: [quebec-french-language](quebec-french-language.md).
