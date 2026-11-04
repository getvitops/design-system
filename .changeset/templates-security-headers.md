---
'@getvitops/create': patch
---

Both templates ship `public/_headers` with a no-break security baseline (`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options: SAMEORIGIN`), applied by Workers static assets. No CSP: `<Head />` emits inline scripts, so a policy needs per-site nonces or hashes. Note `_headers` covers static assets only; for the EmDash template's Worker-rendered pages, add headers in the Worker.
