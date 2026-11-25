---
'@getvitops/astro': minor
'@getvitops/generator': patch
'@getvitops/skills': patch
---

**New: `<ContactForm />`**, a contact / enquiry form for a page written in code. `<ContactForm />` renders name, email, phone and message; `fields={[{ label, type, required, name, options }]}` replaces them. It is a real `<form method="post">` that works with no JavaScript and posts to `createConversionRoute()` (`/api/track`), with the honeypot the route recognises, the `_next` return path, both result notices (revealed by the URL fragment after a no-JS submit) and `<wc-turnstile>` when `site.security.turnstile.siteKey` is set (`turnstileSiteKey` overrides it, `null` turns it off). A slot takes a heading and intro.

Use it instead of a hand-written form. The route reserves four names, and a form that trips one fails silently: an input named `phone` is dropped (it is the `tel:` click payload), so the number never reaches the notification or CRM; a filled `website` / `honeypot` / `_honeypot` makes the route answer success and deliver nothing. `<ContactForm />` submits a phone as `tel` and keeps every field clear of the reserved names. It is also what the `vitops_form` block renders, so a form in code and one in the CMS cannot differ.

**Migration:** none required. A site with its own `api/contact.ts` and `<form>` (jblsigns, vitops-website) can replace both with `<ContactForm />` and `createConversionRoute()`; the `emdash-contact-form` skill and the `forms` entry of the components reference say how. Affects the Astro component and the generated components reference; no CSS changes in any format. Other fixed-group packages: no consumer-facing change.
