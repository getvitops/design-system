---
name: ontario-aoda
description: What Ontario's AODA website rules (O. Reg. 191/11, s. 14) actually require, of whom, and what they do not say.
verified: 2026-11-11
sources:
  - https://www.ontario.ca/laws/regulation/110191
  - https://www.ontario.ca/page/how-make-websites-accessible
  - https://www.ontario.ca/page/accessibility-rules-businesses-and-non-profits
  - https://www.w3.org/TR/WCAG22/
---

# Ontario: AODA and the Integrated Accessibility Standards Regulation

The website rule is **section 14 of O. Reg. 191/11** (the IASR, made under the Accessibility
for Ontarians with Disabilities Act, 2005). Read from the e-Laws text (current version dated
2026-03-30, checked 2026-11-11). This is orientation, not legal advice: a lawyer or accessibility
specialist should confirm how it applies to a given client.

## The short version is a simplification

"Any public web content after 2012-01-01 must be WCAG 2.0 AA" gets several things wrong:

- **Who.** Section 14 binds the Government of Ontario and the Legislative Assembly (s. 14(1)),
  **designated public sector organizations** (municipalities, hospitals, school boards,
  colleges and so on, per s. 2 and Schedule 1) and **large organizations** (s. 14(2)). A large
  organization is one with **50 or more employees in Ontario** that is not government or a
  designated public sector body. This covers private businesses and non-profits.
- **Small organizations are outside s. 14.** One to 49 Ontario employees means no WCAG
  obligation from the IASR. They are still "obligated organizations", so s. 12 applies (below).
- **Level and date.** Designated public sector and large organizations: new internet sites at
  WCAG 2.0 **Level A** from 2014-01-01, and **all** internet sites at **Level AA by 2021-01-01**
  (s. 14(4)). Both dates have passed, so AA is the live target for them.
- **Two criteria are carved out.** For those organizations the AA requirement is "other than"
  **1.2.4 Captions (Live)** and **1.2.5 Audio Descriptions (Pre-recorded)** (s. 14(4)). The
  Government of Ontario and Legislative Assembly had the same carve-out until 2020, then lost it
  (s. 14(3)). Do not tell a client they may skip captions or audio description entirely:
  1.2.2 (captions, pre-recorded) and 1.2.3 (audio description or media alternative) are
  still in WCAG 2.0 A/AA and are not carved out.
- **Which content.** Only web content **published after 2012-01-01**, and only sites and
  applications the organization **controls directly or through a contract that allows it to
  modify the product** (s. 14(5)), "except where meeting the requirement is not practicable".
  Third-party platforms the client cannot modify are arguably outside it. Ask counsel.
- **Internet vs intranet.** For large and public sector organizations only the **public
  (internet)** site is covered. Intranets and extranets are not, except for the Government of Ontario
  and Legislative Assembly.
- **Version.** The regulation names **WCAG 2.0** (December 2008). It has not been updated to
  2.1 or 2.2. Conforming to a later version is generally understood to cover the 2.0 criteria
  (they are a superset, apart from 4.1.1 Parsing, which 2.2 removes), but that is interpretation,
  not regulatory text.

## Counting employees, and what each threshold triggers

The thresholds depend on the number of **employees in Ontario**. The Ontario "Accessibility rules
for businesses and non-profits" page (updated 2026-06-16, checked 2026-11-11) says:

- **Count:** full-time, part-time and seasonal employees, and **contract workers**.
- **Do not count:** employees outside Ontario, volunteers and **independent contractors**. The
  page frames the difference as control: with an employee you pay wages or salary, assign the
  work and have a right to control how it is done. An organization with no employees in Ontario is
  exempt. Volunteers and independent contractors do not count toward the headcount, but the
  organization stays responsible for them following the rules when they provide services on its behalf.
  Treating a worker as an independent contractor to stay under a threshold is a risk in itself:
  a misclassification changes the count.
- **Which moment is counted:** industry guidance (law-firm and HR sources) uses the **peak
  headcount at any one time in the previous 12 months**, so a seasonal peak above a threshold puts
  the organization over it. The Ontario page above does **not** state this rule, so treat it as
  unverified: confirm it against the regulation or with counsel before telling a client they are
  under a threshold.

What each size triggers:

| Ontario employees | Obligations relevant here                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------ |
| 1 to 19           | Obligated, but no compliance report. Accessible formats on request (s. 12), accessible feedback (s. 11).           |
| 20 or more        | Also an **accessibility compliance report every three years**. The current deadline is **2026-12-31**.             |
| 50 or more        | Also the section 14 website rule: WCAG 2.0 **AA** for public websites the organization controls (see "Who" above). |

The Ontario page does not say when the cycle after 2026 falls due, and it does not itself name WCAG
(that comes from s. 14 of the regulation, linked above). Re-check both before relying on them.

## PDFs and documents

Section 14 does not mention PDFs. The Ontario guidance page defines "content" broadly (text,
images, forms, sounds), so documents published on a covered site are commonly treated as web
content. Whether a particular PDF is in scope is a question for counsel. See `documents-pdf.md`.

## Accessible formats on request (applies to small organizations too)

Under **s. 12**, every obligated organization (including small ones) must, on request, provide or
arrange accessible formats and communication supports in a timely way, at no more than the
regular cost, after consulting the requester, and must **notify the public** that this is
available. Under **s. 9** content that is "unconvertible" (not technically feasible, or technology
not readily available) is handled by explaining why and giving a summary. Feedback processes
(s. 11) must also be accessible.

## What to do with this

- Ask the client: organization type, **peak Ontario headcount over the last 12 months** (count
  contract workers, not independent contractors; see above), and whether the site is public.
  Also tell a client at 20 or more employees about the compliance report.
- Large or public-sector client: record `site.accessibility` as `{ standard: 'wcag20', level: 'AA' }`
  at minimum (`wcag21`/`wcag22` is acceptable and stricter). The generator's contrast gate then
  uses the WCAG 2 ratio, which is the legal test.
- Small client: AA is not a legal requirement from this regulation, but it is still good
  practice and other law may apply (see `canada-federal.md`, `eu-eaa.md`, human-rights
  accommodation duties, which this skill has not researched). Offer an accessible-formats
  notice and contact route (s. 12(3)).
- Client wants less than the above: report the gap and risk, record the decision in
  `acceptedRisk`, and carry on. See SKILL.md.

## How to re-check

- Regulation text and consolidation date: https://www.ontario.ca/laws/regulation/110191 (see
  s. 2, 9, 10, 12, 14 and the "Currency" and amendment history).
- Government guidance, updated independently: https://www.ontario.ca/page/how-make-websites-accessible
- Penalties are in Part V and Schedules 2 and 3 of the same regulation (not summarised here).
