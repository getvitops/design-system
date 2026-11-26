---
'@getvitops/core': patch
'@getvitops/generator': patch
---

`.rhythm` no longer turns a paragraph's own links into blocks when the class sits on a `<p>`. A bare `<a>` that is a direct child of a non-paragraph `.rhythm` is still `display: block; inline-size: fit-content`. all formats.
