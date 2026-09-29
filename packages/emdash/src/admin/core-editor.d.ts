/**
 * `@getvitops/core/editor` is a side-effect-only browser bundle (registers
 * `<wc-theme-editor>` via `customElements.define`) with no exports and, on
 * purpose, no published `.d.ts` — see that package's `exports` map. This is
 * the ambient shim so `import('@getvitops/core/editor')` type-checks here.
 */
declare module '@getvitops/core/editor' {}
