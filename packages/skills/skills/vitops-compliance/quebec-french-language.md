---
name: quebec-french-language
description: Quebec's French-language rules for business websites (Charter of the French Language, art. 5, 50.2, 52, 58 as amended by Bill 96), who the OQLF says they cover, and how to record the decision in `site.locales`.
verified: 2026-11-11
sources:
  - https://www.oqlf.gouv.qc.ca/francisation/droits_linguistiques/droits/langue-du-commerce-et-des-affaires.html
  - https://www.oqlf.gouv.qc.ca/office/communiques/2025/20250509_infraction_fournitures_hermes.aspx
  - https://www.oqlf.gouv.qc.ca/office/communiques/2025/20251114_infraction_waterco.aspx
  - https://www.quebec.ca/nouvelles/actualites/details/infraction-a-la-charte-de-la-langue-francaise-le-site-web-de-lentreprise-esprit-rafting-adventures-inc-72388
  - https://www.oqlf.gouv.qc.ca/francisation/entreprises/marque-commerce-produits.html
---

# Quebec: French on business websites

This is a **language** obligation. It is separate from privacy (see
[quebec-law-25](../vitops-privacy/quebec-law-25.md)) and from accessibility (see
[quebec](../vitops-accessibility/quebec.md)). A site can satisfy one and not the others. This
file informs; it is not legal advice, and counsel should confirm how it applies to a client.

## What the regulator says (as of the verified date)

Read from the Office québécois de la langue française (OQLF) and its enforcement notices:

- **Commercial publications must be in French, and that includes websites and social media**
  (Charter, art. 52). The OQLF's own enforcement releases quote it: commercial publications
  "doivent être rédigées en français", and apply it to a website.
- **A site may be bilingual.** French must be available; another language may be offered in
  addition. The Bill 96 wording of art. 52 adds that another-language version may not be offered
  unless the French version is available on terms at least as favourable. (Wording from secondary
  summaries of the amended text; the statute itself was not retrievable here.)
- **Consumers have a right to be informed and served in French** before, during and after a
  transaction (art. 5), including customer service (art. 50.2), contracts of adhesion such as
  subscriptions (art. 55), and invoices, receipts and similar documents (arts. 52, 57).
- **Advertising:** where a business advertises publicly, French must be markedly predominant over
  other languages (arts. 58, 58.1). Exceptions sit in the Regulation respecting the language of
  commerce and business.
- **Product labelling** changes took effect 2025-06-01, with a transition ending 2027-06-01. The
  OQLF page says nothing about websites there; do not extend it to web copy without checking.

## Who is covered: the unsettled part

The OQLF treats businesses that carry on activities in Quebec, with a Quebec address, as covered.
Its older website guidance (page now removed, so not verified today) limited the rule to
products and services sold to consumers in Quebec and advertised on a Quebec-based company's
site. Whether an Ontario company that markets to Quebec consumers is covered, and how far, is a
question for counsel. Do not tell a client they are in or out of scope; state the facts that
point each way and the open question.

## Enforcement seen so far

Complaint-driven. The OQLF issues a formal notice or order; failing to comply with an order is an
offence (art. 205). Published website cases are small fines: CAD 1,500 (second conviction,
Fournitures Hermes, 2025-01-21), CAD 3,000 (Waterco, 2025-10-09; Esprit Rafting, 2026-06-29), for
sites left English-only after an order. Penalty ranges were not stated in these releases.

## What to ask and report

1. Does the organisation have a Quebec address, Quebec customers, or ads/pages aimed at Quebec?
2. Does it sell goods or services to Quebec consumers online, or send them contracts or invoices?
3. Is a complete French site (not just a landing page) feasible in the client's budget?

Report the gap and the risk plainly. Do not refuse work, and do not add French copy the client has
not approved. Machine-translated legal or commercial copy is a client decision, not a default.

## Toolchain

- `site.locales` (keyed by BCP 47 tag, e.g. `"en"`, `"fr"`) and `site.defaultLocale` (must be one
  of its keys) in `packages/generator/src/config.ts` record whether a French version is published.
  `fr` listed means French is available; it does not mean the whole site is translated.
- A client who knowingly publishes without French: record who decided, when and why, as the
  accepted-risk recipe in [SKILL.md](SKILL.md) describes. There is no dedicated language field.
- Generated legal documents: `site.legal.jurisdiction: "qc"` renders the Quebec template set,
  whose own notes call out French availability for counsel review.

## How to re-check

- OQLF, "Langue du commerce et des affaires" (first source above), and its business pages on
  websites and trademarks; the page's "last updated" date is shown.
- The Charter (C-11) on Légis Québec, arts. 5, 50.2, 51, 52, 55, 57, 58, 58.1, and the Regulation
  respecting the language of commerce and business. Look for amendments since 2026-11-11.
- OQLF press releases (`oqlf.gouv.qc.ca/office/communiques`) for new website prosecutions and
  fine amounts.
