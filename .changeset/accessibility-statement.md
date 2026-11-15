---
'@getvitops/generator': minor
'@getvitops/cli': minor
'@getvitops/skills': patch
---

**Added a generated accessibility statement, the fourth legal document.** `vitops legal --doc accessibility` (and `generateLegal`, `dist/legal/accessibility-statement.html`, `[vitops_legal doc="accessibility"]`) renders it from `site.legal.accessibilityStatement` plus `site.accessibility` (standard, level, `contrastToggle`). It replaces filling in the agency's AODA template by hand.

- **It asserts only what the config declares.** No conformance sentence without `conformance` **and** `testedOn`; `conformance: "full"` cannot sit beside `limitations` (a `validateConfig` error); AODA wording needs `law: "aoda"`; the "tested with" lists appear only when `testedWith` is set (otherwise the text says what the site is built for, never what was tested); `site.accessibility.acceptedRisk` is internal and is never printed. Statute thresholds are not encoded: the headcount tiers are the facts `mandatory`, `policies` and `policiesOnRequest`, mapped in the new `accessibility-statement.md` skill topic.
- **Fields:** `enabled`, `url`, `lastUpdated`, `law`, `mandatory`, `conformance`, `testedOn`, `testing`, `auditor`, `limitations`, `testedWith`, `formats`, `supports`, `inPerson`, `responseDays`, `contact` (an `organization.locations` key or an inline contact, falling back to the organization), `feedbackUrl`, `feedbackOwner`, `policies`, `policiesOnRequest`, `reviewCadence`. `validateConfig` also requires a reachable contact, rejects a generic policy title ("click here"), and requires `level` of at least AA when `mandatory`; `vitops legal` warns when email is the only contact channel.
- **Written to the WCAG 2.1 Level AAA content criteria** (plain language at grade 9 or below, abbreviations and unusual words explained where first used, link text that names its destination, one `h1` and ordered `h2` sections, no tables). `accessibility-statement.content.test.ts` enforces that over every combination of optional sections, and a new `accessibility-statement` e2e project renders it through the docs site's CSS and runs axe including the AAA tag in the high-contrast appearance, plus line length, line height, 200% text, reflow and target size. Paint and layout are the site's: the skill lists what the page must do (footer link, `<ContrastToggle />`, `lang`, a 44px target for a stand-alone link).
- **The legal markdown subset gained `[text](url)` links**, made safe at the output (`safeHref`; Portable Text gets a link annotation). Images and tables are still rejected.

**Migration:** none for existing sites. `TEMPLATES[jurisdiction]` gains an `accessibility` entry and `LegalDoc`/`DOC_ORDER`/`DOC_SLUGS` gain `accessibility`, so code that exhaustively handles `LegalDoc` needs the new member. English only: French for all four documents is a TODO (`TODO.md`, with the Paraglide assessment), so a `qc` site gets an English statement until then.

Affects all formats equally (no CSS or token change). No consumer-facing change in `@getvitops/config`, `@getvitops/core`, `@getvitops/utils`, `@getvitops/vite` or `@getvitops/astro`.
