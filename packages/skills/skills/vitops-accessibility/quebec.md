---
name: quebec
description: Quebec's SGQRI 008 3.0 web accessibility standard for public bodies, and what it means (and does not) for a private client.
verified: 2026-11-11
sources:
  - https://www.quebec.ca/gouvernement/ministeres-organismes/cybersecurite-numerique/publications/standard-accessibilite-sites-web
---

# Quebec: SGQRI 008 (public bodies)

Orientation only, not legal advice. The page below is in French; paraphrased here.

## What the standard is

**Standard sur l'accessibilité des sites Web, SGQRI 008 version 3.0**, published by the ministère
de la Cybersécurité et du Numérique. Per that page: in force **29 April 2024**, page last updated
**8 June 2026**.

- **Who is bound.** The deputy minister or head of a public body covered by article 2 of the
  Loi sur la gouvernance et la gestion des ressources informationnelles des organismes publics
  et des entreprises du gouvernement (RLRQ c. G-1.03). The page ties it to the Loi assurant
  l'exercice des droits des personnes handicapées (RLRQ c. E-20.1). **It does not mention
  private-sector websites.** Whether any other Quebec instrument binds a private business was
  not researched: `unverified — check before relying`.
- **Level.** **WCAG 2.1 AA**, all A and AA criteria **except 1.2.4 (live captions) and 1.2.5
  (pre-recorded audio description)**, plus three AAA criteria (2.3.2, 3.1.4, 2.5.6). It also
  requires a **selected set of WCAG 2.2 criteria now**: 3.2.6 and 3.3.7 (A), 2.4.11, 2.5.7, 2.5.8
  and 3.3.8 (AA), and 2.4.13 (AAA). So it is stricter than WCAG 2.1 AA alone.
- **Scope.** Public, intranet and extranet sites, web forms, downloadable documents and
  multimedia. Mobile apps are not mentioned. Limited exemptions (third-party content,
  external services such as social media and live video, dynamic maps, open raw data, scanned
  images), each with a warning and an accessible version on request.
- **Timing.** No fixed conformity deadline is stated. It applies to new web content, to
  significant modifications of existing content, and non-conforming publication must be
  temporary with a corrective plan. Each page must link to an accessibility page.

## What to do with this

- Quebec public body (ministry, municipality, school service centre, hospital and similar):
  record `{ standard: 'wcag22', level: 'AA' }` as the closest `site.accessibility` target, and
  say plainly that the standard itself is a custom mix (2.1 AA minus 1.2.4/1.2.5, plus some
  2.2 and AAA criteria) that WCAG-only tooling cannot certify. Note the accessibility page.
- Private business in Ontario: this standard is not the client's rule. It can still be a
  useful reference when serving Quebec audiences, and French-language availability is a
  separate question this skill does not cover.
- Do not claim conformance from `vitops audit` output (see SKILL.md).

## How to re-check

The standard's page on quebec.ca (URL above) shows the current version, effective date and
"dernière mise à jour". The enabling statutes (E-20.1, G-1.03) are on legisquebec.gouv.qc.ca
(not readable by the research tooling at the time of writing, so not cited above).
