/**
 * Local-only stand-in for astro/client's `*.astro` module declaration. EmDash
 * compiles the plugin's .astro components inside the consumer's Astro build
 * (where astro/client provides the real types); this repo typechecks the
 * `./astro` barrel without an astro dependency. Not shipped (see `files`).
 */
declare module '*.astro' {
  const Component: (props: Record<string, unknown>) => unknown;
  export default Component;
}

/** Supplied by the `vitops()` integration (`@getvitops/astro`); only the field the form block reads. */
declare module 'virtual:getvitops/head' {
  const head: { turnstileSiteKey: string | null } & Record<string, unknown>;
  export default head;
}
