---
name: pipeda
description: Federal private-sector privacy law (PIPEDA) as it touches client websites, plus the status of the proposed replacement bill.
verified: 2026-11-11
sources:
  - https://laws-lois.justice.gc.ca/eng/acts/P-8.6/FullText.html
  - https://laws-lois.justice.gc.ca/eng/regulations/SOR-2018-64/FullText.html
  - https://www.priv.gc.ca/en/privacy-topics/technology/online-privacy-tracking-cookies/tracking-and-ads/gl_ba_1112/
  - https://www.parl.ca/legisinfo/en/bill/45-1/c-36
  - https://justice.gc.ca/eng/csj-sjc/pl/charter-charte/c36_1.html
---

# PIPEDA

This is information, not legal advice. Whether a client is covered, and how, is for their counsel. Never tell
a client their site "is PIPEDA compliant".

## What it is, as read on 2026-11-11

- The Personal Information Protection and Electronic Documents Act. The Justice Laws page was "current to
  2026-10-19", last amended 2025-03-04.
- Applies to organizations collecting, using or disclosing personal information in the course of commercial
  activity (and to federal works). Provinces with their own substantially similar law are largely exempted
  for in-province activity (see `other-provinces.md`, `quebec-law-25.md`). Applicability to a given client is
  a question for counsel.
- Organizations must follow the Schedule 1 principles (s. 5(1)), and may only collect, use or disclose for
  purposes a reasonable person would consider appropriate (s. 5(3)).
- Consent is only valid if it is reasonable to expect the individual understands the nature, purpose and
  consequences of what they are agreeing to (s. 6.1).

## What it means for a website (facts to check against the client's setup)

- **Tracking and ads.** The OPC treats online behavioural advertising data as generally personal information
  and says tracking needs the person's knowledge and consent. Its policy position accepts opt-out consent only
  when, among other things, purposes are clearly disclosed up front, opt-out is easy, immediate and persistent,
  and the data is non-sensitive. It names tracking that people cannot decline (fingerprinting, zombie cookies)
  and tracking of children as problems.
- **Forms and CRM.** Every form field is collection. Collect what the stated purpose needs. The form
  templates are the toolchain's PII inventory, so what is on the form is what the policy will say.
- **Breach.** Report to the Commissioner and notify individuals when a breach creates a real risk of
  significant harm (s. 10.1). Keep a record of every breach (s. 10.3); the regulation sets 24 months from
  the day the organization determined the breach occurred (SOR/2018-64, s. 6).
- **Penalties.** Offence fines in s. 28 are up to $10,000 (summary) or $100,000 (indictable) as of the text
  read. Do not quote figures to a client without re-checking.

## Pending change: Bill C-36

- C-36, "An Act to enact the Protecting Privacy and Consumer Data Act ...", would repeal Part 1 of PIPEDA and
  re-enact it, adding administrative monetary penalties and a new oversight body.
- LEGISinfo showed first reading on 2026-06-15 and no later activity. LEGISinfo's own status line was
  "At second reading", with no recorded progress, so treat the stage as unclear. The Justice Canada page gives
  a tabling date of 2026-08-19, which conflicts with LEGISinfo; unresolved.
- It is a bill, not law. Do not describe it to a client as in force. It could change the generated
  documents' prose later.

## In the toolchain

- `ca` jurisdiction templates (`packages/generator/src/legal/templates/*.ca.ts`) are the PIPEDA-oriented set.
  They carry a review banner; keep it.
- Consent mechanics: `vitops-consent` skill. Plausible (cookieless) is the company default analytics.
- Third-party processors that are not derivable go in `site.legal.privacyPolicy.processors`.

## What to do

Report gaps and risk plainly (for example, an ad pixel with no marketing consent row, a form collecting more
than its stated purpose). Record the client's decision in the project notes. Do not silently change behaviour.

## How to re-check

- Act and regulations: laws-lois.justice.gc.ca (P-8.6, SOR-2018-64), "current to" date at the top.
- Bill status: parl.ca/legisinfo (search "C-36").
- OPC guidance and decisions: priv.gc.ca.
