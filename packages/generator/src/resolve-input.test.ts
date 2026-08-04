/**
 * Every entry point that takes a config — `generate()`, the Vite plugin, the
 * Astro integration, four CLI commands — now accepts either a `design-system.json`
 * or the larger site config that embeds one. That only works if the two can be
 * told apart with certainty, so most of what is pinned here is the
 * discriminator: that it is total in both directions and keyed to shape rather
 * than to a filename.
 *
 * The failure mode if it drifts is quiet and expensive. Read a site config as a
 * design system and you get one `unrecognized_keys` error naming `designSystem`
 * and nothing about the file's real contents; read a design system as a site
 * config and you get a demand for `organization` on a file that has no business
 * having one.
 */
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { generate } from './generate.ts';
import { defaultConfig } from './index.ts';
import { isConfig, resolveInput, type Config } from './config.ts';

/**
 * The smallest full config that validates, wrapping a real design system.
 *
 * A `designSystem` key in the patch replaces the top-level section; everything
 * else patches the `site` section, which is where all the rest of these fixtures
 * vary (`environments`, `abTesting`, `defaultLocale`).
 */
function site(patch: Record<string, unknown> = {}): Record<string, unknown> {
  const { designSystem, ...sitePatch } = patch;
  return {
    designSystem: designSystem ?? { themes: { default: defaultConfig() } },
    organization: { name: 'Acme' },
    site: {
      defaultLocale: 'en',
      locales: { en: { name: 'English' } },
      environments: { production: { url: 'https://acme.example' } },
      ...sitePatch,
    },
  };
}

describe('isConfig', () => {
  test('a design system is not one — it cannot carry a `designSystem` key', () => {
    // The other half of the guarantee: `DesignSystemSchema` is strict, so a
    // design system holding a `designSystem` key fails validation rather than
    // being ambiguous here.
    expect(isConfig(defaultConfig())).toBe(false);
  });

  test('a site config is one, whichever `designSystem` shorthand it uses', () => {
    expect(isConfig(site())).toBe(true);
    expect(isConfig(site({ designSystem: { default: defaultConfig() } }))).toBe(true);
    expect(isConfig(site({ designSystem: defaultConfig() }))).toBe(true);
  });

  test('is not fooled by things that are not objects', () => {
    for (const v of [null, undefined, 'design-system.json', 42, [{ designSystem: {} }]])
      expect(isConfig(v)).toBe(false);
  });
});

describe('resolveInput', () => {
  test('passes a design system through untouched, with no site config', () => {
    const ds = defaultConfig();
    const out = resolveInput(ds);
    expect(out.designSystem).toBe(ds);
    expect(out.config).toBeUndefined();
    expect(out.theme).toBeUndefined();
  });

  test('unwraps the default theme of a config, and hands back the config', () => {
    const out = resolveInput(site());
    expect(out.theme).toBe('default');
    expect(out.designSystem.colors).toBeTruthy();
    expect((out.config as Config).organization?.name).toBe('Acme');
  });

  test('honours `defaultTheme`, and an explicit override of it', () => {
    const raw = site({
      designSystem: {
        themes: {
          default: defaultConfig(),
          elegant: { extends: 'default', meta: { name: 'Elegant' } },
        },
        defaultTheme: 'elegant',
      },
    });
    expect(resolveInput(raw).theme).toBe('elegant');
    expect(resolveInput(raw, { theme: 'default' }).theme).toBe('default');
  });

  test('resolves the `extends` chain rather than returning the partial', () => {
    const raw = site({
      designSystem: {
        themes: {
          default: defaultConfig(),
          elegant: { extends: 'default', meta: { name: 'Elegant' } },
        },
      },
    });
    const { designSystem } = resolveInput(raw, { theme: 'elegant' });
    // The child declares only `meta`; everything else has to come from the base,
    // or the theme is not a design system at all.
    expect(designSystem.meta?.name).toBe('Elegant');
    expect(Object.keys(designSystem.colors.palette).length).toBeGreaterThan(0);
  });

  test('names the themes it has when asked for one it does not', () => {
    expect(() => resolveInput(site(), { theme: 'elegant' })).toThrow(/no "elegant" entry/);
  });

  test('rejects `theme` against a design system instead of ignoring it', () => {
    // Silently ignoring it would mean a `--theme` typo, or a path that points at
    // the wrong file, builds the right-looking output from the wrong config.
    expect(() => resolveInput(defaultConfig(), { theme: 'elegant' })).toThrow(
      /design-system\.json/,
    );
  });

  test('applies the A/B variant for `siteEnv` before selecting the theme', () => {
    const raw = site({
      environments: {
        production: { url: 'https://acme.example' },
        staging: { url: 'https://staging.acme.example', variant: 'b' },
      },
      abTesting: {
        enabled: true,
        variants: {
          b: {
            environment: 'staging',
            overrides: { designSystem: { themes: { default: { meta: { name: 'Variant B' } } } } },
          },
        },
      },
    });
    expect(resolveInput(raw).designSystem.meta?.name).not.toBe('Variant B');
    expect(resolveInput(raw, { siteEnv: 'staging' }).designSystem.meta?.name).toBe('Variant B');
  });

  test('surfaces a site config that does not validate, rather than a design-system error', () => {
    // Pointed at a broken site config, the useful message is about the site
    // config. Reporting `colors: required` on a file full of company facts sends
    // the reader to the wrong document.
    expect(() => resolveInput(site({ defaultLocale: 'fr' }))).toThrow(/Invalid config/);
  });
});

/**
 * The payoff, end to end: a consumer whose tokens live inside `company.json`
 * points `input` at that file and gets the same stylesheet — plus the site-level
 * facts that used to need the path declared a second time.
 */
describe('generate() with a site config as input', () => {
  const assetsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets');
  const tmp = () => mkdtempSync(join(tmpdir(), 'vitops-input-'));

  test('emits byte-identical CSS to the equivalent design-system.json', async () => {
    const ds = defaultConfig();
    const a = tmp();
    const b = tmp();
    const dsPath = join(a, 'design-system.json');
    const sitePath = join(a, 'company.json');
    writeFileSync(dsPath, JSON.stringify(ds));
    writeFileSync(sitePath, JSON.stringify(site({ designSystem: { themes: { default: ds } } })));

    await generate({ input: dsPath, format: 'css', outDir: a, assetsDir });
    await generate({ input: sitePath, format: 'css', outDir: b, assetsDir });
    expect(readFileSync(join(b, 'styles.css'), 'utf8')).toBe(
      readFileSync(join(a, 'styles.css'), 'utf8'),
    );
  });

  test('reads the site-level facts from it — no second `site` option needed', async () => {
    // `defaultColorScheme` is the one that changes the stylesheet, so it is the
    // one worth pinning: reaching it used to require passing the same file twice.
    const out = tmp();
    const path = join(out, 'company.json');
    writeFileSync(
      path,
      JSON.stringify(
        site({
          designSystem: { themes: { default: defaultConfig() }, defaultColorScheme: 'system' },
        }),
      ),
    );
    await generate({ input: path, format: 'css', outDir: out, assetsDir });
    expect(readFileSync(join(out, 'styles.css'), 'utf8')).toContain('prefers-color-scheme:dark');
  });

  test('an explicit `site` still wins over the one embedded in `input`', async () => {
    const out = tmp();
    const path = join(out, 'company.json');
    writeFileSync(path, JSON.stringify(site()));
    await generate({
      input: path,
      site: site({
        designSystem: { themes: { default: defaultConfig() }, defaultColorScheme: 'system' },
      }) as unknown as Config,
      format: 'css',
      outDir: out,
      assetsDir,
    });
    expect(readFileSync(join(out, 'styles.css'), 'utf8')).toContain('prefers-color-scheme:dark');
  });
});
