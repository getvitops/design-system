---
name: other-provinces
description: Alberta PIPA, British Columbia PIPA and Ontario's position (no general private-sector privacy statute found), and how they sit beside PIPEDA.
verified: 2026-11-11
sources:
  - https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/r_o_p/
  - https://oipc.ab.ca/breach-notification/
  - https://www.alberta.ca/organization-responsibilities-for-protecting-personal-information
---

# Other provinces

Information only, not legal advice. Which statute governs a given client or data flow is for counsel.

## The map (OPC page on exemption orders)

- The OPC states the rule: wherever a substantially similar provincial law applies, it applies instead of
  PIPEDA. Exemption orders were listed for Quebec (SOR/2003-374), Alberta (SOR/2004-219) and British Columbia
  (SOR/2004-220).
- The Ontario order listed (SOR/2005-399) is for **health information custodians** only, as are New Brunswick,
  Newfoundland and Labrador, and Nova Scotia. The page does not say Ontario lacks a general private-sector
  law; a search summary of OPC annual-report appendices said it has none, so PIPEDA covers ordinary Ontario
  commercial activity. Treat as a strong working assumption, flagged for counsel. Not verified directly in a
  statute.
- The exemption is for collection, use and disclosure within the province. Cross-border and interprovincial
  flows and federal businesses stay under PIPEDA (search summary of OPC pages; unverified).

This matters for the company's footprint: most clients are Ontario businesses, so the practical default is
PIPEDA (`pipeda.md`), with Quebec (`quebec-law-25.md`) when serving Quebec, and Alberta or BC rules when the
client is based there.

## Alberta PIPA

Read on alberta.ca and oipc.ab.ca:

- Breach: notify the Commissioner without unreasonable delay where a loss of, or unauthorized access to or
  disclosure of, information under the organization's control creates a real risk of significant harm (s. 34.1).
  The Commissioner may require notice to individuals (s. 37.1); an organization may notify on its own.
- Organizations must take reasonable security measures, keep information only as long as needed, and keep
  written policies available on request.
- Service providers outside Canada: policies must name the country and purposes, and individuals must be told
  how to get that information and whom to ask.
- Fines on the alberta.ca page: up to $10,000 (individual) and $100,000 (other persons). Re-check.
- Consent rules were not on the pages read. Unverified. Consent and cookie guidance was issued jointly by the
  federal, Alberta and BC commissioners (see `pipeda.md`'s OPC links).

## British Columbia PIPA

The BC statute and OIPC pages could not be read (404, or unreadable PDF). A search summary of OIPC BC
materials said PIPA does not require private-sector breach notification and the OIPC recommends it as best
practice, with older materials urging reform. **Unverified, and possibly stale.** Check bclaws.gov.bc.ca before
relying on it.

## What to do

Ask the client where they are established and where visitors are. Report which regime probably applies and that
counsel should confirm. Do not rewrite generated documents for a province the toolchain does not template.
The generated documents ship only `ca` and `qc`, so an Alberta or BC client gets `ca` prose; say so.

## How to re-check

- Exemption orders and "provincial laws that may apply": priv.gc.ca.
- Alberta: oipc.ab.ca and kings-printer.alberta.ca (PIPA, c. P-6.5).
- BC: oipc.bc.ca and bclaws.gov.bc.ca (PIPA, SBC 2003 c. 63).
- Ontario: ontario.ca/laws for any new general private-sector statute.
