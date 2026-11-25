---
'@getvitops/emdash': minor
---

`vitops_accordion` and `vitops_details` bodies take lists and bold, not just paragraphs and links.

In the body field, a blank line starts a paragraph, lines starting `- ` make a bullet list, lines starting `1.` make a numbered list, and `**bold**` and `[text](url)` work inside any of them. Everything is rendered as elements, never as HTML, so editor text cannot inject markup. `**bold**` now also works anywhere a block already read `[text](url)` links (cards, hero cards, callouts). A body that contained literal `**` text will now show it as bold; unbalanced stars stay literal. When an accordion's FAQ markup is on, a list answer is flattened into the `Answer` text. Reaches the EmDash renderer only; no CSS change.
