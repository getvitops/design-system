/**
 * `vitops lint` — find framework classes in consumer source that resolve to
 * nothing in the format being built.
 *
 * The problem this exists for: an unknown utility class is indistinguishable
 * from a working one. Nothing errors, nothing warns, the element just doesn't
 * get the style. Two shapes of that were found in a real consumer site:
 *
 *   • `bg-navy-d` — a leftover from the named-step scale (`d`/`xd`/`xxd`)
 *     deleted in favour of numeric steps. The hue is real, the step is not.
 *     It appeared ~10× and looked fine only because the `.card` it sat on
 *     supplied its own background.
 *   • `md-flex-row` — the css/bricks spelling of a responsive variant, used in
 *     a `tailwind`-format project where that class is never emitted (Tailwind
 *     regenerates those on demand as `@md:`). Silently inert.
 *
 * DESIGN: this deliberately only inspects classes ANCHORED TO THE CONSUMER'S
 * OWN CONFIG — a hue name, a role name, a type role, a shadow, a pattern. It
 * never tries to enumerate "all valid classes", because in the tailwind format
 * that would mean knowing Tailwind's entire built-in vocabulary, and every
 * unknown would be a false positive. Anchoring means a finding is always
 * actionable: you named something from your design system, and it doesn't
 * resolve.
 */
import { NUMERIC_STEPS, type DesignSystem, type Format } from '@getvitops/generator';

/**
 * `error` — you named something from your design system and it resolves to
 * nothing. Always actionable, and fails the command.
 *
 * `suggestion` — the code works, but the framework already has a primitive for
 * it. Advisory by design: these are judgement calls, and a new rule that failed
 * CI on first run would be a worse defect than the drift it reports. `--strict`
 * promotes them for consumers who want the ratchet.
 */
export type LintSeverity = 'error' | 'suggestion';

export interface LintFinding {
  file: string;
  line: number;
  /** The class token, or for a CSS rule the declaration that triggered it. */
  cls: string;
  reason: string;
  suggestion?: string;
  severity: LintSeverity;
}

const UTIL_FAMILIES = ['bg', 'text', 'icon', 'border', 'outline', 'fill', 'stroke'];
const BREAKPOINTS = ['sm', 'md', 'lg', 'xl'];

/**
 * The modifiers actually emitted for one family + role, read back out of the
 * generator's own class list.
 *
 * This used to be a hand-maintained array, which is the wrong shape for a
 * suggestion: the two role kinds emit different modifiers (a chromatic role has
 * `solid` and no bare form; a surface role the reverse), so a single list was
 * wrong for one of them no matter what it said.
 */
const emittedModifiers = (roleClasses: Set<string>, fam: string, role: string): string[] => {
  const prefix = `${fam}-${role}`;
  return [...roleClasses]
    .filter((c) => c === prefix || c.startsWith(`${prefix}-`))
    .map((c) => c.slice(prefix.length + 1))
    .filter(Boolean)
    .sort();
};

/** Everything the config makes namable, so we only judge classes we can judge. */
interface Vocabulary {
  roles: string[];
  hues: string[];
  steps: string[];
  typeRoles: string[];
  shadows: string[];
  patterns: string[];
  /** Every role utility the generator actually emits, e.g. `bg-surface-x-muted`. */
  roleClasses: Set<string>;
}

export function vocabulary(ds: DesignSystem, roleClasses: Iterable<string>): Vocabulary {
  return {
    roles: Object.keys(ds.colors?.roles ?? {}),
    hues: Object.keys(ds.colors?.palette ?? {}),
    steps: [...NUMERIC_STEPS],
    typeRoles: Object.keys(ds.typography?.roles ?? {}),
    shadows: Object.keys(ds.shadows ?? {}),
    patterns: Object.keys(ds.patterns?.items ?? {}),
    roleClasses: new Set(roleClasses),
  };
}

/**
 * Strip variant prefixes (`@md:`, `hover:`, `dark:`) from a candidate.
 *
 * Format-aware, because the container-query spelling only exists in tailwind.
 * Stripping `@md:` unconditionally made the check asymmetric: `md-split-1-2` in a
 * tailwind project was caught, but `@md:split-1-2` in a css/bricks project became
 * a bare `split-1-2` that matched nothing and returned null — the same silent
 * no-op, in the other direction, unreported.
 */
const stripVariants = (cls: string, format: Format): string => {
  let out = cls;
  while (/^@?[a-zA-Z0-9_-]+:/.test(out)) {
    if (format !== 'tailwind' && out.startsWith('@')) break;
    out = out.slice(out.indexOf(':') + 1);
  }
  return out;
};

const nearest = (want: string, pool: string[]): string | undefined =>
  pool.find((p) => p.startsWith(want) || want.startsWith(p));

/**
 * Judge one class token. Returns null when the class is none of our business —
 * which is the common case and the whole reason this is low-noise.
 */
export function judge(
  raw: string,
  v: Vocabulary,
  format: Format,
): Omit<LintFinding, 'file' | 'line'> | null {
  const cls = stripVariants(raw, format);

  // ── the `@<bp>:` container-query spelling, in a format that has none ───────
  // Tailwind's engine expands these; css/bricks ship pre-expanded `<bp>-` classes
  // instead, so this spelling resolves to nothing there.
  const cq = /^@(sm|md|lg|xl):(.+)$/.exec(cls);
  if (cq && format !== 'tailwind')
    return {
      cls: raw,
      severity: 'error' as const,
      reason: `\`@${cq[1]}:\` container-query variants are a tailwind-format spelling; the ${format} format emits pre-expanded classes`,
      suggestion: `${cq[1]}-${cq[2]}`,
    };

  // ── the `<bp>-` responsive spelling ────────────────────────────────────────
  const bp = /^(sm|md|lg|xl)-(.+)$/.exec(cls);
  if (bp && format === 'tailwind')
    return {
      cls: raw,
      severity: 'error' as const,
      reason: `\`${bp[1]}-\` responsive classes are not emitted in the tailwind format`,
      suggestion: `@${bp[1]}:${bp[2]} (framework breakpoints) or ${bp[1]}:${bp[2]} (Tailwind's)`,
    };
  // In css/bricks the bare-prefix form is real; fall through and judge the base
  // against the rest of the vocabulary.
  const base = bp && format !== 'tailwind' ? (bp[2] as string) : cls;

  // ── <util>-<hue>-<step> ────────────────────────────────────────────────────
  const util = new RegExp(`^(${UTIL_FAMILIES.join('|')})-(.+)$`).exec(base);
  if (util) {
    const [, fam, rest] = util as unknown as [string, string, string];
    // Anything the generator actually emits is valid, full stop. Checking this
    // first also settles the ambiguity below for every well-formed class.
    if (v.roleClasses.has(base)) return null;

    // Role and hue names can share a prefix — `defaultConfig()` has the hue
    // `brand` and the role `brand-primary`, so matching hues first would read
    // `bg-brand-primary-x-muted` as hue `brand` + step `primary-x-muted` and
    // report a bogus bad step. Take the LONGEST match across both vocabularies.
    const prefix = (names: string[]) =>
      names
        .filter((n) => rest === n || rest.startsWith(`${n}-`))
        .sort((a, b) => b.length - a.length)[0];
    const hue = prefix(v.hues);
    const role = prefix(v.roles);
    const useRole = role && (!hue || role.length > hue.length);

    if (useRole) {
      const mod = rest.slice((role as string).length + 1);
      const valid = emittedModifiers(v.roleClasses, fam as string, role as string);
      return {
        cls: raw,
        severity: 'error' as const,
        reason: `\`${fam}-${role}${mod ? `-${mod}` : ''}\` is not emitted for the \`${role}\` role`,
        suggestion: valid.length
          ? `valid modifiers: ${valid.join(', ')}`
          : `the \`${role}\` role emits no \`${fam}-*\` utilities`,
      };
    }
    if (hue) {
      const step = rest.slice(hue.length + 1);
      if (step === '')
        return {
          cls: raw,
          severity: 'error' as const,
          reason: `\`${fam}-${hue}\` names a palette hue with no step`,
          suggestion: `${fam}-${hue}-500, or a role such as ${fam}-${v.roles[0] ?? 'neutral'}`,
        };
      if (!v.steps.includes(step))
        return {
          cls: raw,
          severity: 'error' as const,
          reason: `\`${step}\` is not a step on the \`${hue}\` scale (steps are 50…950)`,
          suggestion: `${fam}-${hue}-500, or a role such as ${fam}-${v.roles[0] ?? 'neutral'} which also flips in dark mode`,
        };
      return null; // valid raw step
    }
    return null; // not anchored to this config — not ours to judge
  }

  // ── font-<type-role> ───────────────────────────────────────────────────────
  const font = /^font-(.+)$/.exec(base);
  if (font && v.typeRoles.length && !v.typeRoles.includes(font[1] as string)) {
    const near = nearest(font[1] as string, v.typeRoles);
    // Only complain when it looks like a type role attempt, not e.g. font-bold.
    if (near)
      return {
        cls: raw,
        severity: 'error' as const,
        reason: `\`${font[1]}\` is not a typography role`,
        suggestion: `font-${near}`,
      };
  }

  // ── drop-shadow-<name> ─────────────────────────────────────────────────────
  const ds = /^drop-shadow-(.+)$/.exec(base);
  if (ds && v.shadows.length && !v.shadows.includes(ds[1] as string))
    return {
      cls: raw,
      severity: 'error' as const,
      reason: `\`${ds[1]}\` is not a defined shadow`,
      suggestion: `drop-shadow-${v.shadows[0]}`,
    };

  return null;
}

const CLASS_ATTR = /(?:class|className|:class)\s*=\s*(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\})/g;

/** Extract class tokens from a source file, with line numbers. */
export function extractClasses(src: string): { cls: string; line: number }[] {
  const out: { cls: string; line: number }[] = [];
  for (const m of src.matchAll(CLASS_ATTR)) {
    const value = m[1] ?? m[2] ?? m[3] ?? '';
    const line = src.slice(0, m.index).split('\n').length;
    for (const tok of value.split(/\s+/))
      // Skip template holes and dynamic fragments — a partial token would be
      // judged as a typo and this must not cry wolf.
      if (tok && !tok.includes('${') && !tok.includes('{') && /^[@\w:[\]().%/-]+$/.test(tok))
        out.push({ cls: tok, line });
  }
  return out;
}

export function lintSource(
  files: { path: string; text: string }[],
  v: Vocabulary,
  format: Format,
): LintFinding[] {
  const findings: LintFinding[] = [];
  const seen = new Set<string>();
  for (const f of files)
    for (const { cls, line } of extractClasses(f.text)) {
      const verdict = judge(cls, v, format);
      if (!verdict) continue;
      const key = `${f.path}:${line}:${cls}`;
      if (seen.has(key)) continue;
      seen.add(key);
      findings.push({ file: f.path, line, ...verdict });
    }
  return findings;
}
