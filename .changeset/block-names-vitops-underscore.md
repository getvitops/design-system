---
'@getvitops/emdash': major
'@getvitops/create': patch
'@getvitops/generator': patch
'@getvitops/cli': patch
---

**Breaking: every block type is now `vitops_<name>`** (`vitops_cards`, `vitops_hero`, `vitops_actionLink`, …), where the Portable Text blocks were `vitops.<name>` and the section block type was already `vitops_section`. EmDash validates a block type's slug as `[a-z][a-z0-9_]*`, so `vitops.section` was never possible and the toolkit had two styles for one kind of thing. Underscore is the one form valid everywhere, so it is now the only one.

Migration: in stored content and in `seed/seed.json`, rename `_type` values from `vitops.<name>` to `vitops_<name>`; in `PortableText` `components`, rename the keys the same way; the `blocks: { include, exclude }` option takes full type names, so rename those too. `vt_*` names in a site are that site's own types and are unaffected. A search-and-replace of `vitops.(actionLink|imageCompare|copyButton|banner|details|carousel|gallery|cards|accordion|hero|marquee|logos|steps|stats|callout|entries|pricing|embed|form|reviews|nav|badges|widgetArea)` with `vitops_$1` covers it. `vitops emdash build` reports any block left on the old name as having no component.
