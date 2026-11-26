---
name: accessibility-statement
description: How to generate a client's accessibility statement from vitops.json, which fields to set for which Ontario headcount tier, what the document will and will not claim, and what the page itself must do to be accessible (aim: WCAG 2.1 AAA).
verified: 2026-11-11
sources:
  - https://www.ontario.ca/page/accessibility-rules-businesses-and-non-profits
  - https://www.ontario.ca/page/how-make-websites-accessible
  - https://www.w3.org/WAI/WCAG21/Understanding/reading-level.html
  - https://www.w3.org/WAI/WCAG21/Understanding/link-purpose-link-only.html
  - https://www.w3.org/WAI/WCAG21/Understanding/target-size.html
  - https://www.w3.org/WAI/WCAG21/Techniques/general/G174
---

# The generated accessibility statement

`vitops legal --doc accessibility` renders a statement beside the privacy policy, terms and cookie
notice. It is the agency's AODA statement template turned into a document generated from `vitops.json`,
so it cannot drift from what the site declares and nobody fills in `[PLACEHOLDERS]`. This is
orientation, not legal advice: the client's legal or HR contact should read it before publication, and
the review banner at the top says so.

## Turning it on

```jsonc
// vitops.json
"site": {
  "accessibility": { "standard": "wcag21", "level": "AA", "contrastToggle": true },
  "legal": {
    "accessibilityStatement": {
      "enabled": true,
      "law": "aoda",
      "contact": { "email": "access@client.ca", "phone": "+1 613 555 0100" },
      "responseDays": 3,
      "lastUpdated": "2026-11-12"
    }
  }
}
```

Fields are in `config.schema.json` (`site.legal.accessibilityStatement`). The target (`standard`,
`level`) and `contrastToggle` come from `site.accessibility`, the same block the contrast gate and
`vitops audit` read, so the statement and the build always agree.

## What it will not claim

The config records facts and the template owns prose, so a sentence exists only when its fact does:

| Sentence                                                        | Printed only when                                                                                          |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| "The website fully / partly meets this standard"                | `conformance` **and** `testedOn` are set (`full` cannot sit beside `limitations`)                          |
| "We last tested the website on…, using…"                        | `testedOn` is set (methods from `testing`, auditor from `auditor`)                                         |
| AODA wording                                                    | `law: "aoda"`                                                                                              |
| "The AODA requires our organization to meet WCAG 2.0 Level AA"  | `mandatory: true` and `law: "aoda"`                                                                        |
| "We tested in…" / "We tested with these assistive technologies" | `testedWith` is set; otherwise the template says what the site is **built** for, never what was **tested** |
| The High contrast note                                          | `site.accessibility.contrastToggle: true`                                                                  |
| Policies list                                                   | `policies` (a link per `url`) or `policiesOnRequest`                                                       |

`site.accessibility.acceptedRisk` is **never printed**: it records who accepted a lower target and
why, and is internal. A client below the target they are bound to gets that gap reported to them, not
published for them.

## Which fields for which headcount

Count Ontario employees as in `ontario-aoda.md` (contract workers count; independent contractors do
not). The agency template's table, as fields. This is our reading of O. Reg. 191/11 and the Ontario
guidance, so re-check `ontario-aoda.md` and its sources before relying on a tier.

| Section                                  | 1–19                                                                               | 20–49                                                         | 50+ or public sector                                                                        |
| ---------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Commitment, accessible formats, feedback | Required notices: set `contact` (more than one channel), `responseDays`, `formats` | same                                                          | same                                                                                        |
| Standard and status                      | Best practice: `conformance`, `testedOn`                                           | same                                                          | Required to conform: also `mandatory: true` and `law: "aoda"` (level at least AA, enforced) |
| Policies and plans                       | Not required: leave unset                                                          | Customer service policy on request: `policiesOnRequest: true` | Policies and the multi-year plan posted: `policies` with `url`s                             |
| Known limitations                        | If any: `limitations`                                                              | same                                                          | same                                                                                        |

At 20 or more, the client also files an accessibility compliance report every three years. That is
not this document; see `ontario-aoda.md` for the date.

## The page itself must be accessible (aim: WCAG 2.1 AAA)

A statement that is hard to use is self-defeating. The generated **content** is held to the Level AAA
criteria that are about words, and tested over every combination of optional sections
(`accessibility-statement.content.test.ts`): reading level (Flesch-Kincaid grade 9 or below, a
heuristic and so a guard rather than proof of 3.1.5), abbreviations spelled out where first used
(3.1.4), unusual words explained inline (3.1.3), link text that names its destination (2.4.9), one `h1`
and ordered `h2` sections (2.4.10), real lists, no tables or images.

**The site owns the rest.** What the page that shows it must do:

- **Carry the high-contrast toggle** (`<ContrastToggle />`). 1.4.6 asks for 7:1; the default palette is
  the 4.5:1 floor, and the generated high-contrast layer reaches 7:1 and is a sufficient technique
  (G174). Consider defaulting the layer on for this route.
- **Set `lang`** on the page (3.1.1). The fragment cannot.
- **Use the reading measure**: `.centered` (65ch) keeps lines under 80 characters, and `.rhythm` gives
  spacing; line height at least 1.5, not justified, no horizontal scroll at 200% text or 320px width
  (1.4.8, 1.4.4, 1.4.10).
- **Give a stand-alone link a 44 by 44px target** (2.5.5). A list item that is only a link (the
  policies list) is a line tall by default. Inline links in a sentence are exempt. This is the rule
  the docs-site e2e applies:

  ```css
  main li > a:only-child {
    display: inline-block;
    padding-block: 0.65rem;
    min-inline-size: 44px;
  }
  ```

- **Link it from the footer of every page**, labelled "Accessibility".
- **The feedback form, if any, must itself be accessible** and must not be the only route. The
  statement lists other contact channels for this reason, and `vitops legal` warns when email is the
  only one.
- **Run `vitops audit` with `contrastToggle` set**: it runs axe a second time with the layer on and
  fails a page with no toggle.

`site/e2e/accessibility-statement.e2e.ts` renders the statement through the docs site's CSS and checks
axe (including the AAA tag in the high-contrast appearance), line length, line height, 200% text,
reflow and target size. Passing is **necessary, not sufficient**: axe covers only a slice of AAA.

## Before it is published

- [ ] Every fact in the config is true today (a conformance claim matches the latest test; the
      limitations list is current; the contact is monitored by a named person and the addresses work).
- [ ] The statement itself has had a screen reader pass and a keyboard-only pass by a person.
- [ ] The footer link is on every page; the page has `lang`; the toggle is on it.
- [ ] The client's legal or HR contact has read the wording.
- [ ] A recurring reminder exists to re-test and update `lastUpdated`. A stale date undermines the
      statement.

## Not covered yet

- **English only.** The privacy policy, terms and cookie notice are English only too. A Quebec client
  needs a French statement and gets an English one until translation lands (see the TODO in the repo's
  `TODO.md`). Say so rather than implying it is available.
- **AODA only.** `law` has one member. Federal (`canada-federal.md`) and Quebec (`quebec.md`) clients
  get the generic wording without a statute named.
