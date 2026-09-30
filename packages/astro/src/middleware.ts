/**
 * `vitopsAbTesting()` — the assignment half of runtime A/B experiments (see
 * `site.experiments` in `@getvitops/generator`). A consumer wires this into
 * their own `src/middleware.ts`:
 *
 * ```ts
 * import { defineConfig } from 'astro:config';
 * import { vitopsAbTesting } from '@getvitops/astro/middleware';
 * import config from '../site.json' with { type: 'json' };
 *
 * export const onRequest = vitopsAbTesting({ experiments: config.site.experiments ?? {} });
 * ```
 *
 * The first Astro middleware this toolchain ships, and the first place it
 * calls `Astro.cookies.set()` — every existing cookie write elsewhere is
 * client-side `document.cookie`. Both are deliberate: assigning a visitor a
 * variant, once, before the page renders, is exactly what a middleware is for.
 *
 * **What this does NOT do**: check consent before setting the assignment
 * cookie. Every other demand in this toolchain (`_ac`, the ad-click
 * attribution cookie) is raised by a client-side `require()` call — a
 * concept that doesn't have a server-side equivalent here yet. The
 * *reporting* half (`@getvitops/astro/analytics`'s per-provider bootstrap
 * extensions) already piggybacks on each provider's own existing consent
 * gate, so nothing about this ships ungated data to a third party — but the
 * cookie itself is set unconditionally on first visit. `experiment.category`
 * is validated and carried through the config for when this gets a real
 * answer; treat its absence here as a known, stated gap, not an oversight.
 */
import type { MiddlewareHandler } from 'astro';

// `astro:middleware`'s `defineMiddleware()` is an identity helper meant for
// inference inside a real Astro project's own `src/middleware.ts` — that
// virtual module isn't resolvable from a library package's own build. Typing
// the returned function directly against the real `MiddlewareHandler` type
// (imported from `astro` itself, not the virtual module) does the same job.

export interface AbTestingExperiment {
  /** The cookie this experiment is assigned/pinned through. */
  cookieName: string;
  /** Seconds. Omitted means a session cookie. */
  cookieMaxAge?: number;
  /** Fraction of new visitors auto-assigned to `variants[1]` (default 0.5). */
  splitRatio?: number;
  /** Exactly two variant names — `variants[0]` is the default/control. */
  variants: readonly [string, string];
}

export interface VitopsAbTestingOptions {
  /** Keyed the same way as `site.experiments` — pass only the enabled entries. */
  experiments: Record<string, AbTestingExperiment>;
}

/**
 * Picks `variants[1]` with probability `splitRatio`, else `variants[0]`.
 * Exported so the assignment policy itself — not just its wiring — is
 * directly testable without going through a request.
 */
export function assignVariant(
  experiment: Pick<AbTestingExperiment, 'splitRatio' | 'variants'>,
  random = Math.random,
): string {
  return random() < (experiment.splitRatio ?? 0.5)
    ? experiment.variants[1]
    : experiment.variants[0];
}

export function vitopsAbTesting(opts: VitopsAbTestingOptions): MiddlewareHandler {
  const handler: MiddlewareHandler = (context, next) => {
    const secure = context.url.protocol === 'https:';

    for (const experiment of Object.values(opts.experiments)) {
      const cookieOpts = {
        path: '/',
        sameSite: 'lax' as const,
        secure,
        ...(experiment.cookieMaxAge != null ? { maxAge: experiment.cookieMaxAge } : {}),
      };

      // A recognized query param (named after the cookie itself) is checked
      // FIRST, regardless of whether a cookie already exists — this is what
      // makes a shared preview link ("?<cookieName>=<variant>") reliably force
      // that variant, even for a visitor already pinned to the other one.
      // Combined with `splitRatio: 0` (nobody auto-assigned), this is the
      // blue/green-style "100% on control, but a manual link reveals the
      // other variant" mode with no special-cased logic of its own.
      const queryValue = context.url.searchParams.get(experiment.cookieName);
      if (queryValue && (experiment.variants as readonly string[]).includes(queryValue)) {
        context.cookies.set(experiment.cookieName, queryValue, cookieOpts);
        continue;
      }

      // Otherwise: assign only when nothing is set yet. Never inspect or
      // "correct" an existing value against the current splitRatio — that's
      // what keeps an existing assignment (manual or random) pinned.
      if (context.cookies.get(experiment.cookieName)?.value) continue;
      context.cookies.set(experiment.cookieName, assignVariant(experiment), cookieOpts);
    }

    return next();
  };
  return handler;
}
