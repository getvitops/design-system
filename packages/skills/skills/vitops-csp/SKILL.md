---
name: vitops-csp
description: The Content Security Policy this site ships (Report-Only) and what to check before enforcing it. Use when changing `public/_headers`, adding an embed, tracking snippet or third-party script, turning the CSP on, or seeing CSP reports in the console.
---

# Content Security Policy

`public/_headers` ships a **`Content-Security-Policy-Report-Only`** header: it logs violations to
the browser console and blocks nothing, so it can't break a page. Its `script-src` is `'self'` plus
the SHA-256 of each inline script `<Head />` emits (the colour-scheme bootstrap and the
consent-gate stub) — no `'unsafe-inline'`. Hashes, not nonces, because prerendered pages have no
per-request response to put a nonce in. `contentSecurityPolicy()` and `inlineScriptHashes()` from
`@getvitops/astro` produce the same strings (`templates.test.ts` in the toolchain keeps the file in
step).

Know what it does not cover before you flip it to enforcing (rename the header to
`Content-Security-Policy`):

- **`_headers` applies to static assets only.** Worker-rendered responses — the EmDash admin
  (`/_emdash/*`), its API, anything left on-demand — don't get it. Setting a header there means
  doing it in code (e.g. Astro middleware calling `contentSecurityPolicy()`), and the admin's own
  inline scripts and editor HTML would need allowing; leave the admin out of an enforced policy.
- **Editor-authored HTML blocks are the hard limit.** Any block that lets an editor paste raw HTML
  or a `<script>` (an embed, a tracking snippet) puts arbitrary inline script on the page, which a
  hash policy cannot name ahead of time. HTML blocks created in the admin also run JavaScript in a
  sandboxed iframe, and Astro's `security.csp` blocks their styles and scripts, so don't turn that
  on without allowing for it. Enforcing a strict policy means removing such blocks or moving embeds
  to a consent-gated `data-consent` tag whose origin you allow explicitly.
- **Third-party tags** the consent gate activates need their origins in `script-src` /
  `connect-src`; anything with `frame` needs `frame-src`.
- **A server island** (`server:defer`) adds an inline loader script and a request to the Worker;
  expect a report for the loader until you hash it.

Run the site, browse the pages you ship with the console open, fix or allow what is reported, and
only then enforce.
