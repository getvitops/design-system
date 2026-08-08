/**
 * Cross-layer check: does every `var(--…)` a config authors resolve to a token
 * the generator actually emits?
 *
 * A `patterns` value is a string the schema deliberately does not interpret
 * (see `CssDecls` in `schema.ts`), so a reference to a token that does not exist
 * parses, generates, minifies and ships. The declaration then resolves to
 * `inherit`/`unset` in the browser and nothing anywhere says so. Downstream this
 * shipped a `.cta` whose `color` fell back to `inherit` on a brand fill —
 * unreadable text on every filled button — and two of the four dead references
 * in that config had been dead for several versions.
 *
 * **The check is anchored to namespaces the generator owns**, exactly as
 * `vitops lint` is anchored to classes derived from the consumer's own config.
 * A pattern may legitimately reference a framework token defined in
 * `@getvitops/core`'s hand-written CSS (`--icon-size`, `--animation-duration`,
 * a consumer's own hook), and `validate()` is a pure function that must not read
 * the filesystem to find out. Enumerating "every valid token" would therefore
 * turn every such reference into a false positive. Enumerating only what the
 * generator emits — the colour layer, shadows, z-tiers — is a set it can compute
 * from the config alone, and it is where the dangling references actually occur.
 *
 * `FRAMEWORK_OWNED` is the one leak in that reasoning: a token that sits inside
 * an owned prefix but is defined by core's CSS instead. `token-refs.test.ts`
 * greps the shipped partials and fails if a new one appears, so the allowlist
 * cannot silently go stale.
 *
 * A reference carrying a fallback (`var(--x, 0.25rem)`) is **never** flagged: the
 * fallback is the author stating what happens when the token is absent, which is
 * the whole difference between a considered default and an accident.
 */
import { REQUIRED_ROLES, ROLE_TOKEN_KEYS, type RoleSpec, roleHue, roleKind } from './shared.ts';
import { expandPalette, functionalRole, tokenVar } from './tokens.ts';

/**
 * Prefixes whose entire contents the generator emits. A `var()` inside one of
 * these either resolves to something the colour/shadow/z layer defines, or it
 * resolves to nothing — there is no third possibility, which is what makes an
 * error (rather than a warning) the right severity.
 */
const OWNED_PREFIXES = ['--color-', '--shadow-', '--z-tier-'] as const;

/** Singleton tokens the colour layer emits, checked by exact name. */
const OWNED_EXACT = new Set(['--surface-glass', '--overlay']);

/**
 * Tokens inside an owned prefix that `@getvitops/core`'s hand-written CSS
 * defines rather than the generator. Drift-guarded by `token-refs.test.ts`.
 */
export const FRAMEWORK_OWNED = new Set(['--color-swatch-size']);

/**
 * Roles whose name says "this is a surface" while the bare-string shorthand
 * says `chromatic`. The two kinds emit *different token sets* — a chromatic role
 * has no bare `bg`, so `--color-bg-surface` and every `.bg-surface` utility
 * simply cease to exist, taking 36 references in the framework's own CSS with
 * them. Naming one of these and getting the chromatic set is almost always a
 * mistake, and it is the exact one a downstream config made.
 */
const SURFACE_SHAPED = new Set(['surface', 'neutral', 'background', 'page', 'canvas']);

/**
 * The 1.0 colour-grammar rename, as data.
 *
 * Old suffix (on `--<role>-<suffix>`) → new token key (fed through `tokenVar`).
 * Transcribed from the migration table in the 1.0 changelog; `surface` rotates
 * separately below because its rename is value-preserving rather than
 * mechanical. `--color-<role>-<variant>` "stops" are deliberately absent — the
 * changelog says to judge those by use, and they already land in the owned
 * `--color-` namespace, so the generic check catches them with a near-miss hint.
 */
const MOVED_SUFFIXES: Record<string, string> = {
  bg: 'bg-x-muted',
  'bg-muted': 'bg-muted',
  solid: 'bg-solid',
  'solid-bold': 'bg-solid-bold',
  'solid-x-bold': 'bg-solid-x-bold',
  'on-solid': 'text-on',
  'on-solid-bold': 'text-on-bold',
  text: 'text',
  'text-muted': 'text-muted',
  'text-x-muted': 'text-x-muted',
  'text-xx-muted': 'text-xx-muted',
  'text-bold': 'text-bold',
  icon: 'icon',
  'icon-muted': 'icon-muted',
  border: 'border',
  'border-muted': 'border-muted',
  'border-bold': 'border-bold',
};

/**
 * `surface`'s background names rotate rather than map: what was `--surface-bg`
 * (the page) is now `--color-bg-surface-muted`, and what was `--surface-bg-bold`
 * (raised) is now `--color-bg-surface`. Applying the chromatic rule to it would
 * silently move the page background two rungs.
 */
const SURFACE_BG_ROTATION: Record<string, string> = {
  bg: 'bg-muted',
  'bg-bold': 'bg',
  'bg-muted': 'bg-x-muted',
};

/**
 * Old-grammar token name → its 1.0 replacement, for the roles this config
 * declares.
 *
 * Built per-config rather than as a static table because the old names embed
 * the *consumer's own* role names — there is no fixed list to hard-code, which
 * is why nothing detected these before.
 */
export function movedTokens(roles: Record<string, RoleSpec>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [role, spec] of Object.entries(roles)) {
    const rotate = roleKind(spec) === 'surface';
    for (const [old, key] of Object.entries(MOVED_SUFFIXES))
      out[`--${role}-${old}`] = tokenVar(role, (rotate && SURFACE_BG_ROTATION[old]) || key);
    if (rotate)
      for (const [old, key] of Object.entries(SURFACE_BG_ROTATION))
        out[`--${role}-${old}`] = tokenVar(role, key);
  }
  return out;
}

/** A `var()` reference found in an authored value. */
export interface VarRef {
  /** Dotted config path of the declaration holding it. */
  path: string;
  /** The custom-property name, including the leading `--`. */
  name: string;
  /** Whether the reference supplies a fallback. */
  fallback: boolean;
}

/**
 * Extract every `var(--name[, fallback])` from a CSS value.
 *
 * Hand-rolled rather than a regex because the fallback has to be detected at the
 * reference's *own* paren depth: in `var(--a, var(--b))` the outer reference has
 * a fallback and the inner one does not, and a regex that stops at the first `)`
 * gets both wrong.
 */
export function extractVarRefs(value: string, path: string): VarRef[] {
  const out: VarRef[] = [];
  for (let i = value.indexOf('var('); i !== -1; i = value.indexOf('var(', i + 1)) {
    let j = i + 4;
    while (j < value.length && /\s/.test(value[j] as string)) j++;
    const start = j;
    while (j < value.length && /[\w-]/.test(value[j] as string)) j++;
    const name = value.slice(start, j);
    if (!name.startsWith('--')) continue;
    // Walk to this reference's own closing paren, tracking nesting, and note
    // whether a comma appears at depth 0 on the way.
    let depth = 0;
    let fallback = false;
    for (let k = j; k < value.length; k++) {
      const c = value[k];
      if (c === '(') depth++;
      else if (c === ')') {
        if (depth === 0) break;
        depth--;
      } else if (c === ',' && depth === 0) fallback = true;
    }
    out.push({ path, name, fallback });
  }
  return out;
}

/** Recursively collect refs from a value that may be a string or a nested map. */
const walkValue = (value: unknown, path: string, out: VarRef[]): void => {
  if (typeof value === 'string') out.push(...extractVarRefs(value, path));
  else if (value != null && typeof value === 'object' && !Array.isArray(value))
    for (const [k, v] of Object.entries(value as Record<string, unknown>))
      walkValue(v, `${path}.${k}`, out);
};

/**
 * Every authored declaration that can hold a `var()`.
 *
 * `patterns` is where the reported failures were, but `typography.roles.*.color`
 * and a `shadows` entry are authored the same way and fail the same way, so the
 * same walk covers them. `patterns.items.*.states` is walked recursively — a
 * state's `css` shortcut is a nested declaration map.
 */
export function collectVarRefs(ds: {
  patterns?: unknown;
  typography?: unknown;
  shadows?: unknown;
}): VarRef[] {
  const out: VarRef[] = [];
  const p = (ds.patterns ?? {}) as Record<string, unknown>;
  walkValue(p['defaults'], 'patterns.defaults', out);
  walkValue(p['radii'], 'patterns.radii', out);
  walkValue(p['groups'], 'patterns.groups', out);
  for (const [name, item] of Object.entries((p['items'] ?? {}) as Record<string, unknown>)) {
    const it = (item ?? {}) as Record<string, unknown>;
    walkValue(it['base'], `patterns.items.${name}.base`, out);
    walkValue(it['overrides'], `patterns.items.${name}.overrides`, out);
    walkValue(it['states'], `patterns.items.${name}.states`, out);
  }
  walkValue((ds.typography as Record<string, unknown>)?.['roles'], 'typography.roles', out);
  walkValue(ds.shadows, 'shadows', out);
  return out;
}

/**
 * The custom properties the generator emits, as names.
 *
 * Derived from the same functions the emitter uses — `expandPalette` for the
 * ramps and `functionalRole` + `tokenVar` for the role set — so the check cannot
 * disagree with the output about what exists. Both appearances are unioned: a
 * token that only appears in the dark block is still defined.
 */
export function emittedTokens(ds: {
  colors: { palette: Record<string, unknown>; roles: Record<string, RoleSpec> };
  shadows?: Record<string, string> | undefined;
  patterns?: { z?: Record<string, number> | undefined } | undefined;
}): Set<string> {
  const defined = new Set<string>();
  const palette = expandPalette(ds.colors.palette);
  for (const [hueName, hue] of Object.entries(palette))
    for (const n of Object.keys(hue.numeric)) defined.add(`--color-${hueName}-${n}`);
  let hasSurface = false;
  for (const [role, spec] of Object.entries(ds.colors.roles)) {
    const hueName = roleHue(spec);
    const hue = palette[hueName];
    if (hue == null) continue; // reported separately, as an error
    const kind = roleKind(spec);
    if (role === 'surface' && kind === 'surface') hasSurface = true;
    const fr = functionalRole(role, hueName, hue, kind);
    for (const key of new Set([...Object.keys(fr.light), ...Object.keys(fr.dark)]))
      defined.add(tokenVar(role, key));
  }
  if (Object.keys(ds.colors.roles).length) defined.add('--color-border-focus');
  if (hasSurface) {
    defined.add('--surface-glass');
    defined.add('--overlay');
  }
  for (const name of Object.keys(ds.shadows ?? {})) defined.add(`--shadow-${name}`);
  for (const name of Object.keys(ds.patterns?.z ?? {})) defined.add(`--z-tier-${name}`);
  return defined;
}

/** Whether this check has an opinion about a given custom property. */
const isOwned = (name: string): boolean =>
  !FRAMEWORK_OWNED.has(name) &&
  (OWNED_EXACT.has(name) || OWNED_PREFIXES.some((p) => name.startsWith(p)));

/**
 * Suggest a near-miss from the emitted set, so the message names the fix rather
 * than only the failure. Cheap edit-distance-ish heuristic: same prefix, or a
 * one-segment difference.
 */
const nearest = (name: string, defined: Set<string>): string | undefined => {
  const segs = name.split('-').filter(Boolean);
  let best: string | undefined;
  let bestScore = 0;
  for (const cand of defined) {
    const cs = cand.split('-').filter(Boolean);
    const shared = cs.filter((s) => segs.includes(s)).length;
    const score = shared - Math.abs(cs.length - segs.length) * 0.5;
    if (score > bestScore) {
      bestScore = score;
      best = cand;
    }
  }
  return bestScore >= Math.max(2, segs.length - 1) ? best : undefined;
};

/** A dangling reference, with the config path that holds it. */
export interface TokenRefError {
  /** Config path, split for a `$ZodIssue.path`. */
  path: string[];
  message: string;
}

export interface TokenRefIssues {
  errors: TokenRefError[];
  warnings: string[];
}

/**
 * Check a parsed design system's authored `var()` references, plus the
 * role-kind heuristic that produces most of them.
 *
 * Returns messages rather than issues so `validate()` owns the `$ZodIssue`
 * shaping, and so the same check can be reported by `generate()` without
 * inventing a second vocabulary.
 */
export function tokenRefIssues(ds: {
  colors: { palette: Record<string, unknown>; roles: Record<string, RoleSpec> };
  patterns?: unknown;
  typography?: unknown;
  shadows?: unknown;
}): TokenRefIssues {
  const errors: TokenRefError[] = [];
  const warnings: string[] = [];

  // A role whose NAME says surface while its authoring says chromatic. Warn
  // before the ref check, because it is usually the cause of what follows.
  for (const [role, spec] of Object.entries(ds.colors.roles))
    if (SURFACE_SHAPED.has(role) && roleKind(spec) === 'chromatic')
      warnings.push(
        `colors.roles.${role} is declared chromatic (a bare hue string is shorthand for ` +
          `\`kind: "chromatic"\`), but the name reads as a surface. A chromatic role emits no ` +
          `bare \`--color-bg-${role}\` and no \`.bg-${role}\` utility` +
          (REQUIRED_ROLES.includes(role)
            ? `, and the framework's own component CSS references those with no fallback`
            : '') +
          `. Write \`"${role}": { "hue": "${roleHue(spec)}", "kind": "surface" }\` if you meant a surface.`,
      );

  let defined: Set<string>;
  try {
    defined = emittedTokens(
      ds as Parameters<typeof emittedTokens>[0] & {
        colors: { palette: Record<string, unknown>; roles: Record<string, RoleSpec> };
      },
    );
  } catch {
    // A palette this malformed fails with a better message elsewhere; a
    // half-built token set would only produce noise on top of it.
    return { errors, warnings };
  }

  // Dedupe by (name, path) — the same dead token in ten declarations is one
  // mistake, and ten copies of the message buries the other nine findings.
  const seen = new Set<string>();
  // Old-grammar references are collected separately and reported as ONE
  // enumerated rename table, following `migrationIssues()` in `config.ts`. A
  // config written against the pre-1.0 grammar carries dozens, and a dozen
  // individual "no such token" errors teaches nobody that a rename happened —
  // which is precisely the feedback that made that detector worth copying.
  const renames = movedTokens(ds.colors.roles);
  const moved = new Map<string, string>();

  // Dropping a required role is a WARNING by long-standing contract (the tokens
  // for the roles you do define are all emitted fine, and roles are extensible),
  // and that warning already names the role above. Every reference to the
  // dropped role's tokens is a consequence of it, so re-reporting them here as
  // errors would escalate a documented warning into a build failure and bury
  // the one message that explains it. `ROLE_TOKEN_KEYS` is exactly "every token
  // key a role can resolve to", which is what makes this excusal total.
  const excused = new Set<string>();
  for (const role of REQUIRED_ROLES)
    if (ds.colors.roles[role] == null)
      for (const key of ROLE_TOKEN_KEYS) excused.add(tokenVar(role, key));
  for (const ref of collectVarRefs(ds)) {
    if (ref.fallback || defined.has(ref.name) || excused.has(ref.name)) continue;
    const moveTo = renames[ref.name];
    if (moveTo != null) {
      moved.set(ref.name, moveTo);
      continue;
    }
    if (!isOwned(ref.name)) continue;
    const key = `${ref.name} ${ref.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const hint = nearest(ref.name, defined);
    errors.push({
      path: ref.path.split('.'),
      message:
        `${ref.path} references \`var(${ref.name})\`, which this config emits no token for — ` +
        `the declaration will resolve to nothing at runtime.` +
        (hint ? ` Did you mean \`var(${hint})\`?` : '') +
        ` (Give it a fallback — \`var(${ref.name}, <value>)\` — if the absence is intentional.)`,
    });
  }

  if (moved.size)
    errors.unshift({
      path: ['colors'],
      message:
        `${moved.size} token reference${moved.size === 1 ? ' uses' : 's use'} the pre-1.0 colour ` +
        `grammar. The role moved into the middle of the property name, after its target ` +
        `(\`--color-<target>-<role>[-<variant>]\`):\n` +
        [...moved].map(([old, next]) => `  ${old} → ${next}`).join('\n') +
        `\n\nApply these simultaneously, not one at a time — several renames are cyclic ` +
        `(a surface role's backgrounds rotate), so sequential replacement compounds them. ` +
        `\`vitops lint <src> --fix\` does this for markup and CSS.`,
    });

  return { errors, warnings };
}
