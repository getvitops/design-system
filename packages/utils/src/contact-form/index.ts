/**
 * The pure decisions behind a contact/enquiry form that posts to `createConversionRoute()`:
 * which field rows become controls, and under what submitted names. Worker-safe (no Node builtin),
 * and shared by `<ContactForm>` (`@getvitops/astro`), the `vitops_form` block
 * (`@getvitops/emdash`) and `formTemplateFromBlock`, so the three cannot disagree about a name.
 */
export * from './fields.ts';
export * from './subscribe.ts';
