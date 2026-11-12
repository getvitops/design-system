---
name: documents-pdf
description: PDFs and other downloadable documents: what the AODA text does and does not say, what tagged PDF / PDF/UA mean, and practical guidance including accessible formats on request.
verified: 2026-11-11
sources:
  - https://www.ontario.ca/laws/regulation/110191
  - https://www.ontario.ca/page/how-make-websites-accessible
  - https://www.w3.org/TR/2014/NOTE-WCAG20-TECHS-20140311/pdf_notes.html
---

# PDFs and downloadable documents

Orientation only, not legal advice. `vitops audit` cannot check PDFs; they need a person or a
dedicated PDF checker.

## What the law says

- **AODA s. 14 does not mention PDFs.** It applies to "websites and web content" (s. 14(5)),
  and WCAG 2.0 AA applies to web content in any format. The Ontario guidance page defines
  content broadly (text, images, forms, sounds) and links document-authoring resources; it
  gives no PDF rule. Whether a PDF hosted on a covered site is in scope, and what "published
  after 1 January 2012" means for a re-uploaded file, is a question for counsel. A cautious
  working assumption is that PDFs on a covered public site are in scope; say it is an assumption.
- **Accessible formats on request (s. 12) apply to every obligated organization, including
  small ones.** On request, provide or arrange an accessible format in a timely way, at no
  more than the regular cost, after consulting the requester, and **tell the public this is
  available** (s. 12(3)). Where conversion is not technically feasible, or the technology is
  not readily available, explain why and give a summary (s. 9).
- **Other regimes.** Quebec's SGQRI 008 3.0 explicitly includes downloadable documents
  (see `quebec.md`). The federal ICT regulations treat non-web documents separately and, per the
  text read, at the 500+ employee tier for private entities (see `canada-federal.md`). Sources for both are in those files.

## What "accessible PDF" means

- A **tagged PDF** carries a logical structure tree (headings, paragraphs, lists, tables,
  figures with alt text, reading order). The W3C note says producers must ensure all
  information is reachable through the structure hierarchy, because assistive technology reads
  by traversing it. An untagged or scanned-image PDF has no such structure.
- **PDF/UA** (ISO 14289) is the technical standard for accessible PDF. The W3C note describes
  it as defining what a file must or must not contain, not how to produce it. A newer part,
  PDF/UA-2, exists for PDF 2.0 (reported by the PDF Association; the page was not
  readable, so `unverified — check before relying`). Passing a PDF/UA checker does not prove
  the content makes sense to a reader.

## Practical guidance (no legal claim)

- **Prefer HTML.** A page is cheaper to keep accessible than a PDF, reflows, and is in the
  CMS. Use a PDF when the format is the point (print-ready forms, formal reports) and
  link the HTML equivalent alongside.
- Author accessibly at the source: real heading styles, list and table markup, alt text, document
  language and title, then export with "tag PDF" on. Do not retrofit a scan with OCR and call
  it done.
- Name the file and link text meaningfully, state file type and size in the link
  (`Annual report (PDF, 2 MB)`), and put a contact route for accessible formats next to
  document lists. `vitops media` and EmDash media handling do not tag PDFs.
- Check with a PDF checker and a screen reader, and treat results as findings, not a verdict.
  Never publish an audit report as proof.
- **Client declines** (cost, legacy archives): report the gap and risk, keep the on-request
  route working, and note the decision in `site.accessibility.acceptedRisk`.

## How to re-check

- AODA text: https://www.ontario.ca/laws/regulation/110191 (s. 9, 12, 14) and the guidance page
  https://www.ontario.ca/page/how-make-websites-accessible.
- PDF standards: PDF Association (pdfa.org) for PDF/UA; W3C WCAG techniques
  (https://www.w3.org/WAI/WCAG22/Techniques/) for current PDF techniques.
