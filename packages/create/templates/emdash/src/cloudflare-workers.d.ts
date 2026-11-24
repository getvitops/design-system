/**
 * The Worker's bindings, as `src/pages/api/track.ts` reads them. Deliberately loose: the route
 * looks each secret up by name and checks it is a string, so the real binding types (which depend
 * on what `wrangler.jsonc` declares) are not needed to typecheck it. Replace with the output of
 * `wrangler types` if you want them.
 */
declare module 'cloudflare:workers' {
  export const env: Record<string, unknown>;
}
