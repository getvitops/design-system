/**
 * `@getvitops/astro/tracking` — the attribution vocabulary, re-exported.
 *
 * The documented conversion flow spans two packages: `<Tracking />` captures the
 * click ID from `@getvitops/astro`, and the route reads it back with
 * `parseTrackingCookie` from `@getvitops/utils/tracking`. Under strict pnpm a
 * consumer cannot resolve the second from app code without adding
 * `@getvitops/utils` as a direct dependency — so the flow as written in the
 * changelog needed two installs, and the obvious workaround (importing the same
 * symbols from `@getvitops/astro`'s index) is the one that drags the whole
 * integration, and its Node builtins, toward a Worker bundle.
 *
 * This entry is the third option and the correct one: one install, and a module
 * graph that reaches only `@getvitops/utils/tracking` — no `sharp`, no
 * `node:child_process`, nothing that cannot run in a Worker. It is a separate
 * build entry for exactly the reason `./routes` is.
 */
export * from '@getvitops/utils/tracking';

/**
 * Where the capture script beacons `tel:` conversions.
 *
 * Re-exported here so a consumer writing the route can assert against the same
 * constant the script uses, rather than retyping the path.
 */
export { TRACKING_ENDPOINT } from '../tracking.ts';
