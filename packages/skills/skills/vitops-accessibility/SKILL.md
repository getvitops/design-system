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

- Unset, `AA` and `AAA`: a WCAG 2 contrast-ratio miss **fails the generator build**; at `A`/`none` it only warns.
- `vitops audit` reads it for the axe tags and for gating. At `none` findings are reported and never gate.
- `acceptedRisk` is free text: who accepted a lower target, when and why. It prints in the audit
  report header and is never read for logic. Fill it when the client chooses below what applies.
- Which `standard`/`level` a client needs is in the topic files. Start with `ontario-aoda.md`.

## Contrast: WCAG 2 AA is the standard

Rely on the **WCAG 2 contrast ratio**: 4.5:1 for text (3:1 for large text) under 1.4.3, and 3:1
for non-text under 1.4.11 (added in WCAG 2.1; not in 2.0). APCA is perceptually better, but it is
**no longer on the W3C standards track**, so it is not what any law or conformance claim tests.
Do not cite an APCA result as evidence of accessibility.

**What the toolchain does:** the generator checks only the WCAG 2 ratio (text, including muted
text, 4.5:1; icons and guaranteed boundaries 3:1; `text-on-<role>` 4.5:1) in both appearances. A
miss **fails the build** unless `level` is explicitly `A` or `none`, where it warns; unset is held
to AA. A passing build still says nothing about the rest of WCAG, and it never means "conformant".
Earlier versions enforced APCA instead and let a ratio miss through (this repo's own `neutral`
role passed at 4.33:1); if a client is on an older toolchain, treat ratio warnings as real.

## High contrast

Meeting 4.5:1 / 3:1 by default is the baseline. Beyond it, in order:

1. **`prefers-contrast: more`** for users who opt in: aim for AAA (7:1), make borders solid, use
   heavier outlines and remove transparency. This goes beyond the requirement, so it is an extra.
2. **`forced-colors: active`** (Windows High Contrast) done properly: real borders and outlines
   instead of `box-shadow` for boundaries and focus, because shadows vanish in forced colours; do
   not rely on background images or colour alone for meaning; use system keywords (`CanvasText`,
   `LinkText`, `ButtonText`); use `forced-color-adjust: none` sparingly, e.g. colour swatches.
3. **If brand colours cannot pass by default**, WCAG technique **G174**: a clearly visible control
   on the page that switches to a conforming version. The control must itself meet contrast, and it
   can start on when `prefers-contrast: more` matches. A browser's or OS's own high-contrast mode is
   not something the site provides, so it is not a substitute for G174 (our reading of the
   technique; confirm with an accessibility specialist).

**What the toolchain provides** (css and tailwind formats; the Bricks format supplies its own colour
tokens, so there is nothing for the layer to re-point and the toggle is inert there):

- **A generated high-contrast layer** answering `@media (prefers-contrast: more)`,
  `:root[data-contrast="more"]` and the toggle's checkbox. It is a third appearance axis, not a
  theme: text walks to 7:1, borders become as firm as icons, solids walk until `text-on-<role>`
  clears 7:1, glass goes opaque. `data-contrast="standard"` opts a visitor out of the media query.
  The layer must itself clear 4.5:1 / 3:1 or `generate` fails; missing 7:1 only warns.
- **`<ContrastToggle />`** (`@getvitops/astro/components/ContrastToggle.astro`) is the G174 control: a
  plain checkbox that works with no JavaScript, enhanced by `<wc-contrast-toggle>` to start checked
  under `prefers-contrast: more` and to remember the choice (behind the `preferences` consent
  category). Put it on **every page** (masthead or footer); add `<Head contrast />` to restore a
  remembered choice before first paint, and `inline: { contrast: true }` to a hash-pinned CSP.
- **`site.accessibility.contrastToggle: true`** says the site ships the toggle. A baseline contrast
  miss then only warns, and only for a role whose high-contrast layer conforms. `vitops audit` runs
  axe a second time with the layer on, reports "conforming only with the high-contrast layer on",
  and **fails a page that has no toggle** or where a contrast failure survives the layer. Do not set
  it for a site that does not render the toggle everywhere: that would downgrade a real failure.
- **Forced colours:** the focus ring, masthead, sitenav, floating surfaces (an outline) and the
  switch are covered and tested (`site/e2e/forced-colors.e2e.ts`). Other patterns that mark a
  boundary with `box-shadow` alone have not been individually checked; say so rather than implying
  every pattern is covered.

## Everyday practice

Use the existing mechanisms; do not restate them here.

- **Markup first.** Prefer native HTML and platform features. Tier-2 web components must have
  an accessible no-JS fallback (see AGENTS.md "Component architecture"); `site/e2e/no-js-fallback.e2e.ts`
  and `site/e2e/forced-colors.e2e.ts` prove it for focus rings and fallbacks.
- **Run `vitops audit`** (axe + Lighthouse; a second axe pass when `contrastToggle` is set) on a built site. Reports go to `.vitops/audit/`
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

| File                         | Load when                                                                                          |
| ---------------------------- | -------------------------------------------------------------------------------------------------- |
| `ontario-aoda.md`            | Ontario client; AODA, IASR s. 14, headcount, 20/50 thresholds                                      |
| `canada-federal.md`          | Federally regulated client; Accessible Canada Act, EN 301 549                                      |
| `quebec.md`                  | Quebec public body or Quebec audience; SGQRI 008                                                   |
| `other-provinces.md`         | Manitoba, Nova Scotia, BC or other provinces                                                       |
| `eu-eaa.md`                  | Client sells to EU consumers; European Accessibility Act                                           |
| `documents-pdf.md`           | PDFs, downloads, accessible formats on request                                                     |
| `accessibility-statement.md` | Generating a client's accessibility statement; its fields by headcount tier; what the page must do |

If a question falls outside these, say it is not covered and has not been researched.
