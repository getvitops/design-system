/**
 * The `@source` paths a site's Tailwind needs so classes used only by installed packages'
 * renderers are generated. Tailwind v4 does not scan `node_modules`, so `font-display` (used by
 * `vitops_stats`) or a class in an `@getvitops/astro` component produced no rule and the page
 * rendered at body size with no error anywhere.
 *
 * Resolution is injected so the choice is testable; an absent package is skipped, not an error —
 * a site without `@getvitops/emdash` has nothing of its to scan.
 */
import { dirname, join, relative } from 'node:path';

/** Package → directory (relative to the package root) holding the markup that uses classes. */
export const RENDERER_DIRS: Record<string, string> = {
  '@getvitops/astro': 'src/components',
  '@getvitops/emdash': 'src/astro',
};

/**
 * @param cssDir directory of the emitted `tailwind.css`; `@source` paths are relative to it.
 * @param resolvePackageJson returns the absolute path of a package's `package.json`, or throws.
 */
export function tailwindSources(
  cssDir: string,
  resolvePackageJson: (pkg: string) => string,
): string[] {
  const out: string[] = [];
  for (const [pkg, dir] of Object.entries(RENDERER_DIRS)) {
    let manifest: string;
    try {
      manifest = resolvePackageJson(pkg);
    } catch {
      continue;
    }
    const rel = relative(cssDir, join(dirname(manifest), dir))
      .split('\\')
      .join('/');
    out.push(rel.startsWith('.') ? rel : `./${rel}`);
  }
  return out;
}
