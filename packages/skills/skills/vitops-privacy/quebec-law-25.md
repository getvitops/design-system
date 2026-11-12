---
name: quebec-law-25
description: Quebec's private-sector privacy statute as amended by Law 25, for sites collecting personal information from people in Quebec.
verified: 2026-11-11
sources:
  - https://www.cai.gouv.qc.ca/protection-renseignements-personnels/sujets-et-domaines-dinteret/principaux-changements-loi-25
  - https://www.cai.gouv.qc.ca/protection-renseignements-personnels/information-entreprises-privees/collecte-renseignements-personnels_entreprises
---

# Quebec Law 25

Information only, not legal advice. Never say a site "is Law 25 compliant". Whether a client is caught
(for example an Ontario business serving Quebec residents) is a question for counsel; the CAI summary read for
this skill does not address out-of-province businesses.

This file rests on the CAI's plain-language pages, which say the statute prevails. Article numbers below are
the ones those pages or the CAI search snippets gave; the statute text itself (legisquebec.gouv.qc.ca) returned
403 and was not read. Re-check articles there before quoting.

## What the CAI says private-sector enterprises must do

- **Person in charge:** the head of the enterprise by default, delegable in writing; publish their title and
  contact details on the website (or by another suitable means).
- **Governance policies and practices:** retention and destruction, roles, complaints process; publish
  information about them on the website.
- **Privacy policy:** plain-language policy published on the website where information is collected by
  technology; notify people of changes.
- **Technology that can identify, locate or profile (art. 8.1):** tell people beforehand that it is used and how
  to activate it. Those functions cannot be on by default, so this is opt-in. The CAI page's own words:
  functions cannot be activated by default.
- **Privacy by default (art. 9.1):** for a public technology product or service with privacy settings, defaults
  must be the highest level of privacy. The CAI states this does not cover cookie settings. Cookies are still
  to be disclosed in the policy.
- **Consent (since September 2023):** per specific purpose, in plain language, requested separately from other
  information when written; a new purpose needs new consent; sensitive information used for a new purpose
  needs express consent.
- **Information at collection:** purposes, means, access/correction rights, right to withdraw consent, third
  parties involved, possible transfer outside Quebec, and any identify/locate/profile technology.
- **Privacy impact assessment:** before transferring information outside Quebec (adequate protection and a
  written agreement), and before acquiring, developing or redesigning systems or electronic services that
  involve personal information.
- **Confidentiality incidents:** notify the Commission and affected people when there is a risk of serious
  harm; keep an incident register and give it to the Commission on request. Retention period: unverified.
- **Minors under 14:** parental or guardian consent, unless collection clearly benefits the child.
- **Penalties per the CAI page:** administrative penalties up to 2% of worldwide turnover or $10 million, and
  penal prosecution by the Commission. Re-check before quoting.

## French-language aspects (unverified)

The CAI page sets plain-language standards ("simple and clear") but states no language rule for notices. The
Charter of the French Language may bear on websites aimed at Quebec; the OQLF page was not reachable.
Unverified. Ask counsel; do not translate or skip translation on your own initiative. The toolchain's `qc`
templates carry a review banner that names French availability.

## Where the toolchain touches it

- `qc` jurisdiction in `packages/generator/src/legal/templates/*.qc.ts`: opt-in wording only under an opt-in
  consent model, the person in charge named only when configured, and the transfer-outside-Quebec assurance
  only when `impactAssessments` is attested in config (the config docs cite it as s. 17; the CAI pages read here
  say the same duty without a number). Never attest something the client has not done.
- The `<wc-consent>` gate defaults to nothing stored until the visitor chooses, which lines up with opt-in for
  profiling tracking. See the `vitops-consent` skill. Plausible (no cookies) sidesteps most of this.
- Form templates drive the policy's list of information collected.

## What to do

If a client serves Quebec and the config says `ca`, or tracking is on by default, report it and the risk.
Record the decision. Do not flip the jurisdiction, add French copy or change consent defaults unasked.

## How to re-check

- Statute: legisquebec.gouv.qc.ca (chapter P-39.1) and the Charter of the French Language (C-11).
- Guidance and changes: cai.gouv.qc.ca; OQLF at oqlf.gouv.qc.ca for French on websites.
