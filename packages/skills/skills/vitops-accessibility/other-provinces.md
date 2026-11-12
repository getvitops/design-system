---
name: other-provinces
description: Provincial accessibility law outside Ontario and Quebec: Manitoba (private-sector web rule in force), Nova Scotia and British Columbia (no web standard confirmed), others not researched.
verified: 2026-11-11
sources:
  - https://web2.gov.mb.ca/laws/regs/current/047-2022.php?lang=en
  - https://novascotia.ca/accessibility/information-communication/
  - https://www2.gov.bc.ca/gov/content/governments/about-the-bc-government/initiatives/accessibility/legislation
---

# Other provinces

Orientation only, not legal advice. The Ontario agency's clients are mostly Ontario-based, but a
client with staff or customers elsewhere may be caught. Ask where the client has employees.

## Manitoba: web rule in force, including private sector

**Accessible Information and Communication Standard Regulation, M.R. 47/2022** under the
Accessibility for Manitobans Act (the page read states it is the current version as of
2026-11-11, last amended by M.R. 123/2023).

- **Level: WCAG 2.1 AA** (s. 1), not 2.0. Stricter than Ontario's text.
- **Who.** Government departments, agencies, health authorities, cities, educational
  institutions and libraries, and "any other organization subject to The Accessibility for
  Manitobans Act that has **one or more employees in Manitoba**" (s. 2(c)). That includes
  private businesses and non-profits, with **no 50-employee threshold** for the web rule.
- **When.** Phased from coming into force: one, two and three years. The page does not state
  dates; the reading is **1 May 2023 / 2024 / 2025**, which makes 1 May 2025 the date for
  the "any other organization" group. The 1 May 2022 base date is inferred from s. 15 and
  `unverified — check before relying`.
- **What.** Web content published on or after the applicable date, **or** needed to access
  the organization's goods or services (s. 7(1)). Web applications that are new or
  significantly updated after that date (s. 8). Intranets: not for the private sector.
- **Exceptions** (ss. 7(2), 8(2)): not technically feasible, technology not readily
  available, undue hardship, no direct control, product labels. Document the reason if relied on.

## Nova Scotia: standard not yet made

The province's own page says the Information and Communication Accessibility Standard is
still in development, "expected in 2028-29", and does not mention WCAG. So no Nova Scotia web
requirement is confirmed in force. Do not cite a WCAG version for it from third-party blogs.

## British Columbia: public sector only on what was verified

The Accessible British Columbia Act applies to the province and prescribed organizations
(over 750 public bodies per the province's page: local governments, school districts, health
authorities, libraries). The page does not mention private businesses and does not name an
information-and-communication or web standard in force. Provincial government web content
has its own policy, which was not verified here. Treat BC private-sector web duty as
`unverified — check before relying`; the first standards drafted were service delivery and
employment (govTogetherBC, not primary law).

## Not researched

Saskatchewan, Newfoundland and Labrador, New Brunswick, Prince Edward Island, Alberta, the
territories: **no verification was done**. Say so to the user rather than guessing. Federal
law is in `canada-federal.md`.

## What to do with this

- Manitoba presence (even one employee): flag WCAG 2.1 AA as the relevant legal target and
  record it in `site.accessibility` (`wcag21`, `AA`). Tell the user it is a legal-risk
  question for counsel, including how "subject to the Act" applies to an out-of-province firm.
- Otherwise note the gap in coverage and move on; do not invent obligations.

## How to re-check

- Manitoba regulation and amendments: https://web2.gov.mb.ca/laws/regs/current/047-2022.php,
  and https://accessibilitymb.ca for guidance.
- Nova Scotia: https://novascotia.ca/accessibility/ (standards timeline).
- British Columbia: Accessible B.C. Act and regulation on bclaws.gov.bc.ca, and
  https://www2.gov.bc.ca (accessibility standards pages).
