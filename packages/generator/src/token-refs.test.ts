/**
 * The cross-layer guard for authored `var()` references.
 *
 * A `patterns` value is an uninterpreted string, so a reference to a token that
 * does not exist parses, generates and ships — then resolves to nothing in the
 * browser. Downstream that shipped unreadable CTA text on every filled button,
 * and two of the four dead references in that config had been dead for versions.
 *
 * The drift guard at the bottom is the load-bearing one: the check is anchored
 * to namespaces the generator owns, and `FRAMEWORK_OWNED` is the list of
 * exceptions core's hand-written CSS defines inside those namespaces. A new one
 * appearing there would turn a legitimate reference into a build error, so this
 * greps the shipped partials rather than trusting the constant.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { defaultConfig } from './index.ts';
import { type DesignSystem, validate } from './schema.ts';
import { FRAMEWORK_OWNED, emittedTokens, extractVarRefs, movedTokens } from './token-refs.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(HERE, '..', 'assets');
const hasAssets = existsSync(join(ASSETS, 'css', 'index.css'));

/** A config whose `cta` base carries one authored declaration. */
const withCta = (prop: string, value: string): DesignSystem => {
  const ds = defaultConfig();
  const items = ds.patterns?.items as Record<string, { base?: Record<string, string> }>;
  items['cta'] = { ...items['cta'], base: { ...items['cta']?.base, [prop]: value } };
  return ds;
};

const errorsFor = (ds: DesignSystem): string => {
  const r = validate(ds);
  return r.errors.map((e) => e.message).join('\n');
};

describe('extractVarRefs', () => {
  it('reads the name and notices a fallback', () => {
    expect(extractVarRefs('var(--a)', 'p')).toEqual([{ path: 'p', name: '--a', fallback: false }]);
    expect(extractVarRefs('var(--a, 1rem)', 'p')[0]?.fallback).toBe(true);
  });

  it('scopes the fallback to each reference, not to the first close paren', () => {
    // `var(--a, var(--b))`: the outer HAS a fallback, the inner does not. A
    // regex that stops at the first `)` gets both wrong.
    const refs = extractVarRefs('var(--a, var(--b))', 'p');
    expect(refs.map((r) => [r.name, r.fallback])).toEqual([
      ['--a', true],
      ['--b', false],
    ]);
  });

  it('survives nesting that is not a var()', () => {
    const refs = extractVarRefs('color-mix(in oklch, var(--a) 70%, transparent)', 'p');
    expect(refs).toEqual([{ path: 'p', name: '--a', fallback: false }]);
  });

  it('ignores a var() with no custom property', () => {
    expect(extractVarRefs('var( 4px )', 'p')).toEqual([]);
  });
});

describe('validate: dangling token references', () => {
  it('accepts the shipped default config', () => {
    // The regression bar: this check must not flag the config we ship.
    expect(validate(defaultConfig()).ok).toBe(true);
  });

  it('rejects a reference to a token no role emits', () => {
    const msg = errorsFor(withCta('color', 'var(--color-surface-xxl)'));
    expect(msg).toContain('--color-surface-xxl');
    expect(msg).toContain('resolve to nothing');
  });

  it('names the config path that holds it', () => {
    const r = validate(withCta('color', 'var(--color-surface-xxl)'));
    expect(r.errors[0]?.path).toEqual(['patterns', 'items', 'cta', 'base', 'color']);
  });

  it('suggests a near miss from what the config does emit', () => {
    expect(errorsFor(withCta('background-color', 'var(--color-surface-muted)'))).toContain(
      '--color-bg-surface-muted',
    );
  });

  it('accepts a reference that carries a fallback', () => {
    // The fallback is the author stating what happens when the token is absent
    // — a considered default, not an accident.
    expect(validate(withCta('color', 'var(--color-nope-500, red)')).ok).toBe(true);
  });

  it('ignores tokens outside the namespaces the generator owns', () => {
    // A pattern may legitimately reference a framework token from core's CSS or
    // a consumer's own hook. Flagging those would make the check unusable.
    expect(validate(withCta('gap', 'var(--icon-size)')).ok).toBe(true);
    expect(validate(withCta('transition-duration', 'var(--animation-duration)')).ok).toBe(true);
  });

  it('checks shadows and typography by the same walk', () => {
    const ds = defaultConfig();
    ds.shadows = { ...ds.shadows, ghost: '0 1px 2px var(--color-nope-500)' };
    expect(errorsFor(ds)).toContain('--color-nope-500');
  });

  it('reports each dead token once per declaration, not once per occurrence', () => {
    const r = validate(withCta('color', 'var(--color-surface-xxl) var(--color-surface-xxl)'));
    expect(r.errors).toHaveLength(1);
  });
});

describe('validate: pre-1.0 colour grammar', () => {
  it('reports old-grammar references as one enumerated rename table', () => {
    const ds = withCta('color', 'var(--brand-primary-on-solid)');
    const items = ds.patterns?.items as Record<string, { base?: Record<string, string> }>;
    items['card'] = {
      ...items['card'],
      base: { ...items['card']?.base, 'border-color': 'var(--neutral-border-bold)' },
    };
    const r = validate(ds);
    expect(r.ok).toBe(false);
    // One issue, not two — the dozen-unknown-keys failure mode the flat-config
    // detector exists to avoid.
    const migration = r.errors.filter((e) => e.message.includes('pre-1.0'));
    expect(migration).toHaveLength(1);
    expect(migration[0]?.message).toContain(
      '--brand-primary-on-solid → --color-text-on-brand-primary',
    );
    expect(migration[0]?.message).toContain('--neutral-border-bold → --color-border-neutral-bold');
  });

  it("rotates a surface role's backgrounds rather than mapping them", () => {
    // Value-preserving: what was `--surface-bg` (the page) is now
    // `--color-bg-surface-muted`. Applying the chromatic rule would move the
    // page background two rungs and look like a design change.
    const moved = movedTokens(defaultConfig().colors.roles);
    expect(moved['--surface-bg']).toBe('--color-bg-surface-muted');
    expect(moved['--surface-bg-bold']).toBe('--color-bg-surface');
  });

  it('says to apply the renames simultaneously', () => {
    // Sequential replacement compounds a cyclic rename — the specific mistake
    // a downstream consumer had to work around by hand.
    expect(errorsFor(withCta('color', 'var(--brand-primary-on-solid)'))).toContain(
      'simultaneously',
    );
  });
});

describe('validate: surface-shaped role declared chromatic', () => {
  it('warns, naming the authoring fix', () => {
    const ds = defaultConfig();
    // The bare-string shorthand means chromatic — which emits no bare `bg`.
    (ds.colors.roles as Record<string, unknown>)['surface'] = 'ink';
    const r = validate(ds);
    const w = r.warnings.join('\n');
    expect(w).toContain('colors.roles.surface is declared chromatic');
    expect(w).toContain('"kind": "surface"');
  });

  it('does not warn for a role that is genuinely chromatic', () => {
    expect(validate(defaultConfig()).warnings.join('\n')).not.toContain('declared chromatic');
  });
});

describe('emittedTokens', () => {
  it('covers both appearances', () => {
    // A token that only appears in the dark block is still defined; unioning
    // the two is what stops the check flagging it.
    const defined = emittedTokens(defaultConfig());
    expect(defined.has('--color-bg-surface')).toBe(true);
    expect(defined.has('--color-text-on-brand-primary')).toBe(true);
  });

  it('omits the bare bg of a chromatic role', () => {
    expect(emittedTokens(defaultConfig()).has('--color-bg-danger')).toBe(false);
  });
});

describe.skipIf(!hasAssets)('FRAMEWORK_OWNED drift guard', () => {
  it('lists every generator-namespace token that core CSS defines itself', () => {
    // If core adds a `--color-*` / `--shadow-*` / `--z-tier-*` of its own and it
    // is not listed here, the check turns a legitimate reference into a build
    // error. Grep rather than trust the constant.
    const dir = join(ASSETS, 'css');
    const files = [
      ...readdirSync(dir)
        .filter((f) => f.endsWith('.css'))
        .map((f) => join(dir, f)),
      ...(existsSync(join(dir, 'patterns'))
        ? readdirSync(join(dir, 'patterns')).map((f) => join(dir, 'patterns', f))
        : []),
    ];
    const found = new Set<string>();
    for (const f of files)
      for (const m of readFileSync(f, 'utf8').matchAll(
        /(--(?:color|shadow|z-tier)-[\w-]+|--surface-glass|--overlay)\s*:/g,
      ))
        found.add(m[1] as string);
    expect([...found].filter((t) => !FRAMEWORK_OWNED.has(t)).sort()).toEqual([]);
  });
});
