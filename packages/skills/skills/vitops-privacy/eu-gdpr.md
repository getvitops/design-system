---
name: eu-gdpr
description: GDPR and the ePrivacy cookie rule for sites that target or monitor people in the EU, and the toolchain's gap (no EU legal templates).
verified: 2026-11-11
sources:
  - https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32016R0679
  - https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:02002L0058-20091219
  - https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-052020-consent-under-regulation-2016679_en
---

# EU GDPR and ePrivacy

Information only, not legal advice. Never say a site "is GDPR compliant". Most clients serve Ontario and
Canada only, where this does not apply by its own terms; check before raising it.

## When it can apply

GDPR (Regulation 2016/679) can reach an organization outside the EU that offers goods or services to people in
the EU, or monitors their behaviour there (Art. 3(2), with recitals 23-24). Having EU visitors alone is not the
test; targeting or tracking them is. Whether a client does is a fact question for counsel.

## What the text says (EUR-Lex, read 2026-11-11)

- **Consent (Art. 4(11), Art. 7):** freely given, specific, informed, unambiguous, by a statement or clear
  affirmative action. Silence, pre-ticked boxes and inactivity are not consent (recital 32). The controller must
  be able to demonstrate consent (7(1)); the request must be clearly distinguishable from other matters (7(2));
  withdrawal must be possible at any time (7(3)), and as easy as giving it; bundling consent with a service
  that does not need it weighs against "freely given" (7(4)).
- **Breach (Art. 33(1)):** notify the supervisory authority without undue delay and, where feasible, within 72
  hours of becoming aware, unless unlikely to risk people's rights and freedoms.
- **ePrivacy Directive Art. 5(3) (2009 consolidated text):** storing or accessing information on a user's
  device needs consent after clear and comprehensive information. Consent here is the data-subject consent
  concept (Art. 2(f)). Exceptions exist (strictly necessary); the text read does not detail them here.
  Member States transpose it, so national rules differ.
- **EDPB Guidelines 05/2020 on consent (4 May 2020):** the page lists cookie walls, scrolling not being
  consent, pre-ticked boxes, and withdrawal as easy as giving. The page did not explain them; read the PDF
  before relying on specifics.
- Fine maxima and the EU-representative duty (Art. 27): not read. Unverified. Do not quote figures.

## Pending change

The European Commission's "Digital Omnibus" (proposal of 19 November 2025, file 2025/0360 (COD)) would change
cookie and consent rules. A search showed the Council still negotiating in September 2026 with no adoption
found. Not read from a primary page, status unverified. Do not describe the rules as changed.

## Toolchain gap (be explicit)

- Generated legal documents ship only `ca` (PIPEDA) and `qc` (Quebec Law 25). There is no EU/UK
  jurisdiction, no lawful-basis, data-subject-rights, DPO, or EU-representative prose, and no international
  transfer mechanisms. Do not present `ca` output to an EU-facing client as covering EU law.
- The consent gate (`<wc-consent>`, nothing stored until choice, inert `type="text/plain"` tags) is
  structurally close to opt-in cookie consent, but whether its banner wording, equal-prominence choices and
  withdrawal path meet EU expectations has not been assessed. See the `vitops-consent` skill.
- Cookieless Plausible reduces what needs consent; it does not by itself settle GDPR questions.

## What to do

If a client targets the EU, report the gap and risk and that counsel should advise. Record the decision. Do
not add an EU jurisdiction or change consent behaviour unasked; offer it as a follow-up.

## How to re-check

- Regulation and Directive text: eur-lex.europa.eu (CELEX 32016R0679; 02002L0058).
- Guidance: edpb.europa.eu; national authority sites for each target country.
- Digital Omnibus: Council interinstitutional file 2025/0360 (COD) and eur-lex.europa.eu.
