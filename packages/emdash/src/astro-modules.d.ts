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
