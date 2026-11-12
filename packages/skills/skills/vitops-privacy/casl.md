---
name: casl
description: Canada's Anti-Spam Legislation (CASL) for email, SMS and other commercial electronic messages sent because of a website sign-up or form.
verified: 2026-11-11
sources:
  - https://laws-lois.justice.gc.ca/eng/acts/E-1.6/page-1.html
  - https://laws-lois.justice.gc.ca/eng/acts/E-1.6/page-2.html
  - https://laws-lois.justice.gc.ca/eng/acts/E-1.6/page-4.html
  - https://laws-lois.justice.gc.ca/eng/acts/E-1.6/FullText.html
  - https://fightspam-combattrelepourriel.ised-isde.canada.ca/site/canada-anti-spam-legislation/en
---

# CASL

Information only, not legal advice. Never say a client's newsletter or CRM follow-up "is CASL compliant".
CASL is federal and applies to messages sent to or from Canada, so Ontario clients are covered. A client
may knowingly accept risk; that is their call.

## What the Act says (Justice Laws, current to 2026-10-19, last amended 2026-01-01)

- **Commercial electronic message (CEM), s. 1(2):** a message where it is reasonable to conclude one purpose is
  to encourage participation in a commercial activity (offers, advertising, promoting a person who does these).
- **Rule, s. 6(1):** do not send a CEM unless the recipient consented (express or implied) and the message
  complies with s. 6(2): it identifies the sender, gives contact information, and has an unsubscribe mechanism.
- **Express consent request, s. 10(1):** must clearly and simply state the purpose(s), prescribed identifying
  information about the requester, and other prescribed information. The prescribed detail is in
  regulations; this skill did not read them. Unverified. Check before specifying form wording.
- **Implied consent, s. 10(9):** only in listed cases, such as an existing business or non-business
  relationship (generally the two years before the message, s. 10(10)), or an address conspicuously published
  or disclosed where the message is relevant to the recipient's role.
- **Unsubscribe, s. 11:** free, by the same or another practical electronic means, giving an address or web
  link, valid at least 60 days after sending; honour it within 10 business days.
- **Burden of proof, s. 13:** whoever claims consent has the onus of proving it. Keep records of who consented,
  when, to what, and how.
- **Penalties, s. 20(4):** administrative monetary penalties up to $1,000,000 (individual) or $10,000,000 (any
  other person) per the text read. Re-check before quoting.
- **Private right of action:** the consolidation shows ss. 47 to 51 as "Repealed before coming into force,
  2008, c. 20, s. 3". This skill could not reconcile that with other published accounts of a suspended right
  of action. Unverified. Do not tell a client either way.

## Pre-checked boxes (secondary source)

A search summary of CRTC bulletins 2012-548/549 said express consent must be opt-in (an unchecked box the
person ticks), not pre-ticked, and not bundled with terms of use. The CRTC pages returned 403 to fetch, so this
is unverified. Check on crtc.gc.ca.

## Status of change

No CASL amending bill turned up in a 2026 search, and the fightspam overview (last modified 2024-07-15) lists
none. Could not determine more than that. Bill C-36 (see `pipeda.md`) is a privacy bill, not a CASL one.

## Where the toolchain touches it

- Newsletter or marketing sign-up forms and any `site.crm` push (HubSpot, Bigin, Jobber) that later leads to
  marketing messages. Collecting an email on a contact form is not, by itself, consent to marketing email.
- Transactional notifications to the site owner (`site.notifications`) are the client's own business messages;
  whether any given message is a CEM is a legal question.
- The toolchain stores no consent record for email marketing. If a client sends marketing email, ask where the
  proof of consent (date, wording, source) will live. Report the gap; do not build one unasked.

## What to do

Flag: pre-ticked marketing boxes, sign-ups with no stated purpose, no unsubscribe path, no record of consent.
Tell the user the risk, record the client's decision, and carry on.

## How to re-check

- Act and regulations: laws-lois.justice.gc.ca (S.C. 2010, c. 23 / E-1.6), "current to" date.
- Guidance and news: fightspam-combattrelepourriel.ised-isde.canada.ca ("Spam news"); crtc.gc.ca CASL pages.
- Bills: parl.ca/legisinfo.
