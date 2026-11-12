---
name: vitops-accessibility
description: Load when building or reviewing pages, components, colour, forms, media or PDFs; when a client asks about AODA, WCAG or accessibility law; when setting `site.accessibility`; or when interpreting `vitops audit` or a contrast failure. Informs about accessibility targets and the law; never enforces them.
---

# Accessibility

This skill helps you tell a client what accessibility law may apply to them and what the
toolchain can and cannot check. It **informs**. It does not decide for the client.

## The law changes: check the source

The topic files hold legal facts, each with a `verified` date and primary-source URLs. They are a
starting point, not an authority.

- Before a legal fact drives a decision, a client-facing statement or a `site.accessibility`
  value, **re-check the primary source** named in that file's "How to re-check".
- **Always re-check** when `verified` is more than **180 days** before today.
- If the source disagrees with the skill, the **source wins**. Tell the user the skill needs
  updating, and say which file and fact.
- Anything marked `unverified — check before relying` is a lead, not a fact.
- Never give legal advice. Say that counsel or an accessibility specialist should confirm.

## Inform, do not enforce

Clients differ. Some are legally bound to WCAG; some knowingly accept a lower target (for
example a designer's mocks miss contrast). Either can be a legitimate decision.

- Never block work, refuse a client choice, or silently "fix" a design to a standard the client
  did not adopt.
- Do report the gap, who it may affect and the risk (legal, and the people who cannot use it).
- Record the client's decision in `site.accessibility` (see below), then carry on.
- Never state or imply a site **is** compliant or conformant. Automated checks see only part of
  WCAG; keyboard flows, alt-text quality, caption accuracy, reading order and PDF tagging need a person.

## `site.accessibility`

In `site.json`: `{ standard: 'wcag20' | 'wcag21' | 'wcag22', level: 'none' | 'A' | 'AA' | 'AAA', acceptedRisk?: string }`
(schema: `packages/config/src/accessibility.ts`). It records the client's **target**, not a
conformance claim. New scaffolds default to `wcag21` / `AA`.

- At `AA`/`AAA` a WCAG 2 contrast-ratio miss **fails the generator build**; at `A`/`none` it only warns.
- `vitops audit` reads it for the axe tags and for gating. At `none` findings are reported and never gate.
- `acceptedRisk` is free text: who accepted a lower target, when and why. It prints in the audit
  report header and is never read for logic. Fill it when the client chooses below what applies.
- Which `standard`/`level` a client needs is in the topic files. Start with `ontario-aoda.md`.

## APCA is not the legal test

The generator enforces **APCA** (Lc 75 text, 60 secondary, 45 non-text). Laws such as the AODA
use the **WCAG 2 contrast ratio** (1.4.3: 4.5:1, or 3:1 for large text; 1.4.11 non-text 3:1 is
not in WCAG 2.0). The two disagree. A palette can pass APCA and miss 4.5:1: this repo's own
`neutral` role did, at 4.33:1. So an APCA pass says nothing about legal contrast, and a ratio
fail is real even when the build looked healthy. Set `level` honestly and let the ratio gate speak.

## Everyday practice

Use the existing mechanisms; do not restate them here.

- **Markup first.** Prefer native HTML and platform features. Tier-2 web components must have
  an accessible no-JS fallback (see AGENTS.md "Component architecture"); `site/e2e/no-js-fallback.e2e.ts`
  and `site/e2e/forced-colors.e2e.ts` prove it for focus rings and fallbacks.
- **Run `vitops audit`** (axe + Lighthouse) on a built site. Reports go to `.vitops/audit/`
  (`report.json`, `report.md`, `report.html`). **They are build artifacts only: never publish them
  in the site**, because they list every violation. The report's `MANUAL_CHECKS` list is what
  automation cannot do (keyboard order, focus visibility, screen reader pass, reduced motion,
  200% zoom and 400% reflow, imagery contrast, alt text and captions): do or hand those over.
- **Media.** `vitops media` encodes video and a poster; it does not write captions, transcripts or
  audio description. Provide them or tell the client they are missing (WCAG 2.0 AA still needs 1.2.2
  captions and 1.2.3 audio description or alternative, even where Ontario carves out 1.2.4 and 1.2.5).
- **Motion.** `<wc-marquee>` and animations should respect `prefers-reduced-motion`.
- **PDFs and documents:** see `documents-pdf.md`.

## Topics

| File                 | Load when                                                     |
| -------------------- | ------------------------------------------------------------- |
| `ontario-aoda.md`    | Ontario client; AODA, IASR s. 14, 50-employee threshold       |
| `canada-federal.md`  | Federally regulated client; Accessible Canada Act, EN 301 549 |
| `quebec.md`          | Quebec public body or Quebec audience; SGQRI 008              |
| `other-provinces.md` | Manitoba, Nova Scotia, BC or other provinces                  |
| `eu-eaa.md`          | Client sells to EU consumers; European Accessibility Act      |
| `documents-pdf.md`   | PDFs, downloads, accessible formats on request                |

If a question falls outside these, say it is not covered and has not been researched.
