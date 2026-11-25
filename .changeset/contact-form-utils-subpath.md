---
'@getvitops/utils': minor
'@getvitops/emdash': patch
---

**New: `@getvitops/utils/contact-form`**, the pure decisions behind a form that posts to `createConversionRoute()` (which fields become controls, and under what submitted names: a field labelled "Phone" submits as `tel`, because the route drops a field named `phone`, its tel-click payload, and a filled `website`/`honeypot`/`_honeypot` makes it answer success and deliver nothing). Worker-safe, and it exports `DEFAULT_CONTACT_ROWS` (name, email, phone, message). It moved out of `@getvitops/emdash`'s `vitops_form` block so `<ContactForm>` and the block share one implementation. **`@getvitops/emdash`:** no behaviour change; the block and `formTemplateFromBlock` now import it from utils (a hard dependency already). Other fixed-group packages: no consumer-facing change.
