---
name: canada-federal
description: The Accessible Canada Act and its new ICT/digital-technologies regulations: who is federally regulated, and what applies to a typical Ontario business (usually nothing).
verified: 2026-11-11
sources:
  - https://laws-lois.justice.gc.ca/eng/acts/A-0.6/FullText.html
  - https://laws-lois.justice.gc.ca/eng/regulations/SOR-2021-241/FullText.html
  - https://www.canada.ca/en/employment-social-development/programs/accessible-canada-regulations-guidance/digital-technologies-phase-1.html
  - https://accessible.canada.ca/en-301-549-accessibility-requirements-ict-products-and-services-11-software
  - https://www.w3.org/TR/WCAG22/
---

# Canada: Accessible Canada Act (federal)

Orientation only, not legal advice. Have counsel or an accessibility specialist confirm.

## Who it covers

The Accessible Canada Act (S.C. 2019, c. 10) applies to the federal government, Crown
corporations, the Canadian Forces, and persons or entities "within the legislative authority of
Parliament" (s. 7). In practice that means federally regulated sectors: banks, telecom,
broadcasting, interprovincial and international transport, and similar. A **provincially
regulated business** (a typical Ontario retailer, clinic, trades company, agency or local
non-profit) is not on the face of s. 7 covered by the Act. Its website duty, if any, comes from
the province (see `ontario-aoda.md`). Confirm a client's sector before assuming either way:
some clients are federally regulated without it being obvious.

## The ICT / digital-technologies amendments

Regulations amending the Accessible Canada Regulations (SOR/2021-241) add **Part 1.1,
Information and Communication Technologies**, built on the standard **CAN/ASC - EN 301 549**
(Accessibility Standards Canada's adoption of the European standard; the copy read
reproduces EN 301 549:2021). From the regulation text read on 2026-11-11:

- The consolidated regulations (current to 2026-10-19) listed Part 1.1 under
  **"Amendments not in force"**. Check whether that has changed.
- Federal public sector bodies have no employee threshold. For federally regulated private
  entities the thresholds in the text are: **100+ employees** for public-facing and
  employee-facing web pages (ss. 19.4, 19.5), **500+** for mobile apps, non-web documents
  (this is where PDFs land), accessibility statements and procurement conformity assessments.
  Government guidance says averages over three calendar years are used and that private
  organizations averaging 99 or fewer employees are exempt.
- Government guidance lists compliance dates of **5 December 2027** (public sector web pages)
  and **5 December 2028** (large and medium private web pages; documents and mobile apps).
  These dates were NOT found in the regulation text itself, so treat them as
  `unverified — check before relying`.
- Guidance lists exemptions: heritage content, user-generated content the entity does not
  own or contract for, and employee collaborative workspaces.

## Which WCAG

CAN/ASC - EN 301 549 incorporates WCAG success criteria by reference (the software clause read
cites WCAG 2.1 criteria). Which WCAG **level** the web clause requires was not confirmed in
what was read: `unverified — check clause 9 of the standard`. It is commonly described as WCAG
2.1 AA. WCAG 2.2 is the current W3C Recommendation (12 December 2024) and states that 2.2
conformance also implies 2.0 and 2.1 conformance, except the removed 4.1.1 Parsing.

## What to do with this

- Ask whether the client is federally regulated and, if so, its average employee count.
- If it is (or might become) covered, set `site.accessibility` to at least `wcag21`/`AA` and
  say the standard is EN 301 549, which is broader than WCAG alone (documents, apps,
  statements, training, procurement).
- Otherwise note it as "not currently applicable" and move on. Do not tell a provincially
  regulated client they are bound by this Act.

## How to re-check

- Act: https://laws-lois.justice.gc.ca/eng/acts/A-0.6/ (s. 7 and amendment history).
- Regulations: https://laws-lois.justice.gc.ca/eng/regulations/SOR-2021-241/ (Part 1.1 and the
  "in force" banner; also the Canada Gazette Part II for the amending regulation).
- Guidance and dates: ESDC "Accessible Canada Regulations guidance" pages on canada.ca.
- Standard text: https://accessible.canada.ca (Accessibility Standards Canada).
