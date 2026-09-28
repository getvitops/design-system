/**
 * Ambient shim for `container.test.ts`'s direct `.astro` imports.
 *
 * TypeScript has no built-in resolution for `.astro` modules — an Astro
 * *project* gets one via `astro/client`'s triple-slash reference in its own
 * `env.d.ts`, but this package is a library, not an Astro project, so
 * nothing pulls that in. Scoped to a local ambient declaration (this file is
 * never imported, only ever picked up by this package's own `tsconfig.json`
 * `include`) rather than something published-facing: a blanket `*.astro`
 * shim in `virtual.d.ts` would ship to every consumer and quietly swallow a
 * *real* missing-module error in their own project.
 *
 * `AstroComponentFactory` (what `AstroContainer.renderToString()` actually
 * wants) is a specific, non-trivial function shape defined in astro's own
 * internal `runtime/server` module, not re-exported from a public entry
 * point this package can import cleanly — the standard fallback for an
 * unresolvable custom-extension import (Vite's own docs do the same for
 * `.vue`/other asset-like modules) is a loosely-typed default export;
 * `container.test.ts` never inspects the import itself, only the rendered
 * HTML string, so nothing here needs to be more precise than that.
 */
declare module '*.astro' {
  const Component: any;
  export default Component;
}
