---
name: eu-eaa
description: The European Accessibility Act (Directive 2019/882): scope, application date, micro-enterprise exemption, and the open question of non-EU providers; relevant only to clients selling to EU consumers.
verified: 2026-11-11
sources:
  - https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32019L0882
---

# European Union: European Accessibility Act (EAA)

Orientation only, not legal advice. Relevant only if a client sells or provides services to
consumers in EU member states (for example an e-commerce site that ships to the EU). It is
**not** a Canadian or Ontario obligation.

## What the Directive says (read from EUR-Lex, Directive (EU) 2019/882)

- **Application date: 28 June 2025.** Member States apply their transposing measures from
  that date (Art. 31(2)).
- **Scope (Art. 2).** Listed products (consumer computers and operating systems, payment and
  some self-service terminals, e-readers and similar) and **services provided to consumers**:
  electronic communications, audiovisual media access, consumer banking, e-books and dedicated
  software, **e-commerce services**, and the websites, apps and e-ticketing of passenger
  transport. It is not a general "all websites" law: a brochure site that sells nothing
  is outside the listed services.
- **Requirements (Art. 4, Annex I).** Functional accessibility requirements, not a named WCAG
  level. Annex I text on websites was not read. Recital 47 refers to the four principles
  (perceivable, operable, understandable, robust).
- **Micro-enterprise exemption (Art. 4(5), 3(23)).** Micro-enterprises providing **services**
  are exempt. A micro-enterprise has **fewer than 10 persons and annual turnover or balance sheet
  total not exceeding EUR 2 million**. For products the recitals describe lighter, not zero,
  obligations.
- **Disproportionate burden.** Articles 13 and 14 allow it, assessed with the Annex VI criteria;
  the recitals say lack of priority, time or knowledge is not a legitimate reason, and the
  operator must notify the authority. The articles themselves were not read.
- **Transition (Art. 32).** Service providers may keep using products they lawfully used
  before 28 June 2025 until 28 June 2030; service contracts agreed before that date may run
  unchanged until they expire, for at most five years.
- **Presumption of conformity (Art. 15).** Conforming to a published harmonised standard
  gives a presumption of conformity where it covers the requirement. **EN 301 549** is the
  harmonised standard associated with EU digital accessibility law, and WCAG 2.1 AA is its web
  core, but whether a given EN 301 549 version carries the EAA presumption (as opposed to the
  Web Accessibility Directive for public bodies) was `unverified — check before relying`.

## Not established here

- **Providers outside the EU.** The text read does not say how the Directive reaches a
  Canadian business. Whether and how a non-EU seller to EU consumers is caught, and how it is
  enforced, varies by member-state transposition and needs EU-qualified counsel.
- National transpositions differ (penalties, enforcement bodies, lists of covered services).

## What to do with this

- Ask whether the client has EU customers and sells services in the Art. 2 list, and their
  headcount and turnover. If micro, note the exemption but record the facts, not a conclusion.
- If it might apply, suggest `{ standard: 'wcag21', level: 'AA' }` as the practical baseline
  and refer to counsel for the rest. Do not call a site "EAA compliant".

## How to re-check

- Directive text and amendments: https://eur-lex.europa.eu (CELEX 32019L0882, "consolidated
  versions" tab).
- Harmonised standards and Commission implementing decisions: the Official Journal and the
  European Commission's EN 301 549 / standards pages (the 2021/1339 decision concerns the
  public-sector Web Accessibility Directive).
- Member-state transposition: the national law database of each country the client sells into.
