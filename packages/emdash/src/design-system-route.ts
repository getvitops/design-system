/**
 * The `vitops.design-system` plugin route — what `<wc-theme-editor>` probes
 * and POSTs its patch to when mounted inside the EmDash admin (see this
 * package's README and AGENTS.md's "EmDash plugin as the design-system
 * editing surface" section). Mounted at
 * `/_emdash/api/plugins/vitops/design-system`.
 *
 * Two responsibilities, matching the dev-only `@getvitops/vite` endpoint's
 * contract byte-for-byte (`GET → { writable }`, `POST { patch } → { ok } |
 * { errors }`) so `<wc-theme-editor>` needs no branch for which one it's
 * talking to:
 *
 * 1. **Immediate**: persist the patch to `ctx.settings` — read back by the
 *    `page:fragments` hook in `index.ts`, which turns it into a site-wide
 *    `:root` override `<style>` on every public page. This is what makes an
 *    edit visible without a rebuild.
 * 2. **Canonical**: auto-commit the merged file to `site.deployment.branch`
 *    (default `dev`) via `@getvitops/utils/git`'s `commitFile()`, so the edit
 *    reaches the git-tracked `site.json` through this repo's own normal
 *    `dev → promote → main` review path — never a silent second source of
 *    truth. A commit failure (missing token, misconfigured repo, a transient
 *    GitHub error) is logged and surfaces as a warning, but never fails the
 *    save: the immediate override already works regardless.
 *
 * **Assumes `config` is a full site `Config`** (has `organization`/`site`),
 * not a bare `design-system.json` — true for any real EmDash site (it always
 * has a `site.json`), and the only case this plugin already handles anywhere
 * else (`vitopsHosting()`, `BLOCKS`).
 *
 * The GitHub token is read as `process.env.VITOPS_GITHUB_TOKEN` — matching
 * `hosting.ts`'s own `process.env.HOSTING` read in this same package, rather
 * than a `cloudflare:workers`-specific import: a native EmDash plugin runs
 * in-process with no isolation boundary (EmDash's own docs say plugins "can
 * access environment variables" directly), and this package already targets
 * both the Cloudflare and Node hosting targets through one `process.env`
 * convention (`nodejs_compat` on Workers maps bindings into `process.env`).
 */
import { pluginResponse } from 'emdash';
import type { PageFragmentContribution, PluginContext, PluginRoute, RouteContext } from 'emdash';
import {
  designSystemPath,
  formatConfig,
  getAt,
  isConfig,
  mergePatch,
  resolveInput,
  setAt,
} from '@getvitops/generator/config';
import {
  buildReverseIndex,
  patchToOverrideCss,
  validateColorContract,
} from '@getvitops/generator/tokens';
import { commitFile } from '@getvitops/utils/git';

export interface DesignSystemEditorOptions {
  /**
   * The site's own config, typically `import config from '../../site.json'
   * with { type: 'json' }`. A static, build-time-bundled value — this plugin
   * never reads it from disk at runtime (a deployed Worker has no
   * filesystem), so an edit doesn't take effect here until the *next*
   * deploy; that's exactly the point of the auto-commit half.
   */
  config: unknown;
  /** Which `designSystem.themes` entry this edits. Default: `'default'`. */
  theme?: string;
}

const SETTINGS_KEY = 'designSystemPatch';

interface StoredPatch {
  patch: Record<string, unknown>;
  at: number;
}

function json(status: number, body: unknown) {
  return pluginResponse({
    status,
    headers: { 'content-type': 'application/json' },
    body: { kind: 'text', value: JSON.stringify(body) },
  });
}

/** Fetches the currently-stored patch, clearing it if the bundled `config`
 * (the last real build) already reflects every value in it — see the
 * module docblock's "self-clearing" note in AGENTS.md. */
async function currentPatch(
  ctx: Pick<RouteContext, 'settings'>,
  ds: { colors: Record<string, unknown> },
): Promise<StoredPatch | null> {
  const stored = await ctx.settings.get<StoredPatch>(SETTINGS_KEY);
  if (!stored) return null;
  const patchedColors = stored.patch['colors'];
  if (
    patchedColors != null &&
    JSON.stringify(mergePatch(ds.colors, patchedColors)) === JSON.stringify(ds.colors)
  ) {
    await ctx.settings.delete(SETTINGS_KEY);
    return null;
  }
  return stored;
}

export function createDesignSystemRoute(opts: DesignSystemEditorOptions): PluginRoute {
  const theme = opts.theme ?? 'default';

  return {
    methods: ['GET', 'POST'],
    response: 'raw',
    permission: 'plugins:manage',
    handler: async (ctx: RouteContext) => {
      // `resolveInput` handles both a bare design-system.json and a full site
      // Config (following `extends`, resolving `themes[theme]`), the same
      // entry point every other consumer of a config goes through.
      const { designSystem: ds, config } = resolveInput(opts.config, {
        theme,
        siteEnv: 'production',
      });

      if (ctx.request.method === 'GET') {
        await currentPatch(ctx, ds);
        return json(200, { writable: true });
      }

      const body = ctx.input as { patch?: unknown } | undefined;
      const patch = body?.patch;
      if (patch == null || typeof patch !== 'object' || Array.isArray(patch))
        return json(400, { errors: ['body must be { patch: object }'] });

      const mergedColors = mergePatch(
        ds.colors,
        (patch as Record<string, unknown>)['colors'] ?? {},
      );
      const contrastErrors = validateColorContract(
        mergedColors as Parameters<typeof validateColorContract>[0],
      );
      if (contrastErrors.length) return json(400, { errors: contrastErrors });

      await ctx.settings.set(SETTINGS_KEY, {
        patch: patch as Record<string, unknown>,
        at: Date.now(),
      } satisfies StoredPatch);

      const warnings: string[] = [];
      const repoSpec = config?.site.deployment?.repo;
      const token = process.env['VITOPS_GITHUB_TOKEN'];
      if (!repoSpec || !token) {
        warnings.push(
          !repoSpec
            ? 'design-system sync skipped: site.deployment.repo is not set — the change is live but not yet synced to source.'
            : 'design-system sync skipped: no GitHub token configured — the change is live but not yet synced to source.',
        );
      } else {
        const [owner, repo] = repoSpec.split('/');
        if (!owner || !repo) {
          warnings.push(
            `design-system sync skipped: site.deployment.repo "${repoSpec}" isn't "owner/name".`,
          );
        } else if (!isConfig(opts.config)) {
          warnings.push('design-system sync skipped: config is not a recognised site Config.');
        } else {
          const at = designSystemPath(opts.config, theme);
          const mergedSubtree = mergePatch(getAt(opts.config, at), patch);
          const content = `${formatConfig(setAt(opts.config, at, mergedSubtree))}\n`;
          const result = await commitFile({
            owner,
            repo,
            branch: config.site.deployment?.branch ?? 'dev',
            path: 'site.json',
            content,
            message: 'Sync design-system edit from EmDash admin',
            token,
            fetchImpl:
              ctx.http && ((url: string, init?: RequestInit) => ctx.http!.fetch(url, init)),
          });
          if (!result.ok) {
            ctx.log.warn('design-system sync commit failed', { message: result.message });
            warnings.push(`design-system sync failed (change is still live): ${result.message}`);
          }
        }
      }

      return json(200, { ok: true, warnings });
    },
  };
}

/**
 * The `page:fragments` contribution serving the stored patch's override
 * CSS site-wide. Returns `null` (no fragment) when there's nothing unsynced
 * — the same "no gated tag, no cost" discipline `@getvitops/astro`'s consent
 * gate already follows.
 */
export async function designSystemOverrideFragment(
  ctx: Pick<PluginContext, 'settings'>,
  opts: DesignSystemEditorOptions,
): Promise<PageFragmentContribution | null> {
  const { designSystem: ds } = resolveInput(opts.config, { theme: opts.theme ?? 'default' });
  const stored = await currentPatch(ctx, ds);
  if (!stored) return null;

  const css = patchToOverrideCss(stored.patch, buildReverseIndex(ds));
  if (!css) return null;
  return {
    kind: 'html',
    placement: 'head',
    html: `<style id="ds-overrides">${css}</style>`,
    key: 'vitops-ds-overrides',
  };
}
