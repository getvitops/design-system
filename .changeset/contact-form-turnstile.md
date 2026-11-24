---
'@getvitops/core': minor
'@getvitops/generator': minor
'@getvitops/utils': minor
'@getvitops/cli': minor
'@getvitops/astro': minor
'@getvitops/emdash': minor
'@getvitops/create': minor
---

A contact form that works end to end: `vitops setup turnstile`, `<wc-turnstile>`, the `vitops_form` EmDash block, and the route the emdash template ships to receive it.

**CSS, all formats** (no existing class changes): `forms.css` gains `.form-notice--target:not(:target)` (a message revealed only when the URL fragment names it, which is how a prerendered page shows a no-JS form's result) and `:where(wc-turnstile) { display: block }`.

**`@getvitops/core`:** new `<wc-turnstile sitekey="…">` in `elements.js`. It loads Cloudflare Turnstile on the first interaction with its form (no request to `challenges.cloudflare.com` for a visitor who only reads the page), holds an early submit until the token arrives, and leaves its slotted no-JS explanation in place until JS takes over. Turnstile is category `necessary`, so it is not behind the consent banner.

**`@getvitops/utils` / `@getvitops/cli`:** new `@getvitops/utils/turnstile` and `vitops setup turnstile [--dry] [--check] [--no-write] [--no-secret]`. It plans from the site's hostnames, creates a managed widget unless one already covers them (an existing widget is adopted, never edited, rotated or deleted), writes the public key to `site.security.turnstile.siteKey`, and pipes the one-time secret to `wrangler secret put VITOPS_TURNSTILE_SECRET` without writing it to any file. Needs `CLOUDFLARE_API_TOKEN` with **Account > Turnstile > Edit** and `CLOUDFLARE_ACCOUNT_ID`.

**`@getvitops/astro`:** `virtual:getvitops/head` gains `turnstileSiteKey` (read from `site.security.turnstile.siteKey`) so blocks can render the widget. No other change.

**`@getvitops/generator`:** `TIERS` gains a `turnstile` entry (wc-turnstile, claimed by `vitops_form`); `wc-multi-field`'s `emdashExempt` reason is reworded now the form block exists.

**`@getvitops/emdash`:** new `vitops_form` block: a field repeater (text, email, phone, long text, choose one, tick box), required flags, help text, success/error messages, optional Turnstile. It renders a semantic `<form method="post">` that works with no JavaScript, with a honeypot named per `createConversionRoute`'s defaults. A field named `phone` submits as `tel`, because the route reserves `phone` and `event`.

**`@getvitops/create`:** the emdash template ships `src/pages/api/track.ts` (`prerender = false`, `createConversionRoute()`), a seeded contact form, and `challenges.cloudflare.com` in both templates' Report-Only CSP (`script-src`, `frame-src`). The route refuses a post with nowhere to deliver and fails closed when a site key exists without `VITOPS_TURNSTILE_SECRET`. SETUP.html gains the Turnstile step. Existing sites: copy the route and the CSP change, then run `vitops setup turnstile`.
