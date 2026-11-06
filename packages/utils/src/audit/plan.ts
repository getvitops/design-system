/**
 * `vitops audit` — the pure half. Decides which pages to audit, whether a response
 * status means "skip" or "broken", whether a result breaches a budget, and how it
 * reads. Touches no network, no browser, no filesystem and no clock (the caller
 * passes `generatedAt`) — the same split `indexing/plan.ts` and `ads/plan.ts` make,
 * for the same reason: `plan.test.ts` can assert every consequential case, and the
 * executor (`run.ts`) decides nothing.
 */
import type {
  AuditBudgets,
  AuditReport,
  AxeImpact,
  AxeViolation,
  BudgetFailure,
  FormFactor,
  PageMetrics,
  PageResult,
} from './types.ts';

export const DEFAULT_BUDGETS: AuditBudgets = {
  lcpMs: 2500,
  cls: 0.1,
  tbtMs: 200,
  blockingImpacts: ['serious', 'critical'],
};

/**
 * `wcag2a`/`wcag2aa` are what AODA (WCAG 2.0 AA) asks for; `wcag21a`/`wcag21aa` add the
 * 2.1 criteria we target. `wcag21aa` alone covers only the *new AA* criteria, not the
 * new level-A ones, so both 2.1 tags are listed.
 */
export const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/** Pages tried on every run. `/` is required; the rest are skipped when they 404. */
export const DEFAULT_PAGES = ['/', '/privacy', '/terms', '/cookies', '/contact'];

export const DISCLAIMER =
  'A pass means no automated violations were found by axe-core and the performance budgets held. ' +
  'It is NOT an AODA / WCAG conformance certification: automated tools detect only a minority of ' +
  'WCAG failures. The manual checks below are still required.';

export const MANUAL_CHECKS = [
  'Keyboard order: tab through every page; order matches the visual and reading order, nothing is skipped or trapped.',
  'Focus visibility: a clear focus indicator on every interactive element, including in forced-colors / high-contrast mode.',
  'Screen reader pass: headings, landmarks, forms, dropdowns and the drawer menu read sensibly (NVDA or JAWS on Windows, VoiceOver on macOS/iOS).',
  'Reduced motion: with prefers-reduced-motion on, no essential information depends on animation and nothing auto-plays.',
  '200% zoom (and 400% reflow): no loss of content or function, no horizontal scrolling for text.',
  'Colour and contrast of imagery, gradients and text over images (axe cannot evaluate these).',
  'Meaningful alternative text, captions and transcripts for media.',
];

// ── Pages ───────────────────────────────────────────────────────────────────

/**
 * A menu-ish thing: EmDash seed (`items`), `getMenu()` (`items`, items with `children`),
 * or either shape nested. Only `name`, `url` and children are read.
 */
export interface MenuLike {
  name?: string;
  items?: MenuItemLike[];
}
export interface MenuItemLike {
  url?: string | null;
  children?: MenuItemLike[];
  items?: MenuItemLike[];
}

/**
 * Normalise to a site-relative path, or `undefined` for anything that is not an
 * auditable page of this site: external URLs, hash-only links, `mailto:`/`tel:`,
 * protocol-relative URLs, file downloads (anything with an extension) and the CMS
 * admin. Query and hash are dropped; a trailing slash is too (except the root).
 */
export function normalizePath(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const u = url.trim();
  if (!u.startsWith('/') || u.startsWith('//')) return undefined;
  const bare = u.split(/[?#]/)[0] ?? '';
  const path = bare.length > 1 ? bare.replace(/\/+$/, '') : bare;
  if (!path) return undefined;
  if (/\.[a-z0-9]{1,6}$/i.test(path)) return undefined;
  if (path === '/_emdash' || path.startsWith('/_emdash/')) return undefined;
  return path;
}

function walk(items: MenuItemLike[] | undefined, out: string[]): void {
  for (const item of items ?? []) {
    const p = normalizePath(item.url);
    if (p) out.push(p);
    walk(item.children, out);
    walk(item.items, out);
  }
}

/** Is this one of the menus whose links are pages worth auditing? */
export function isAuditMenu(name: string | undefined): boolean {
  return !!name && (name.startsWith('primary') || name.startsWith('footer'));
}

/** Paths from the `primary*` / `footer*` menus (`footer-legal`, `primary-mobile`, …). */
export function pathsFromMenus(menus: MenuLike[]): string[] {
  const out: string[] = [];
  for (const m of menus) if (isAuditMenu(m.name)) walk(m.items, out);
  return out;
}

/** Same, from an EmDash seed file's parsed JSON (`{ menus: [...] }`). */
export function pathsFromSeed(seed: unknown): string[] {
  const menus = (seed as { menus?: unknown } | null)?.menus;
  return Array.isArray(menus) ? pathsFromMenus(menus as MenuLike[]) : [];
}

export interface PagePlanInput {
  /** Paths found in menus. */
  menuPaths?: string[];
  /** Paths from `--pages`. */
  extra?: string[];
  /** Default true. `--no-defaults` for a site that wants an exact list. */
  includeDefaults?: boolean;
}

/** The pages to try, `/` always first, unique, in a stable order. */
export function planPages(input: PagePlanInput = {}): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (p: string | undefined) => {
    if (p && !seen.has(p)) {
      seen.add(p);
      out.push(p);
    }
  };
  add('/');
  if (input.includeDefaults !== false) for (const p of DEFAULT_PAGES) add(p);
  for (const p of input.menuPaths ?? []) add(p);
  for (const p of input.extra ?? []) add(normalizePath(p));
  return out;
}

/**
 * What an HTTP status means for a candidate page. 404/410 → skipped (a single-page
 * site has no `/contact`, and that is fine) — except `/`, which must exist. Any other
 * non-2xx is an error: a 500 on `/privacy` is a defect, not an absent page.
 */
export function classifyStatus(
  path: string,
  httpStatus: number | undefined,
): { status: 'audited' | 'skipped' | 'error'; reason?: string } {
  if (httpStatus === undefined) return { status: 'error', reason: 'no response' };
  if (httpStatus >= 200 && httpStatus < 300) return { status: 'audited' };
  if (httpStatus === 404 || httpStatus === 410) {
    return path === '/'
      ? { status: 'error', reason: `/ returned ${httpStatus} — the home page must exist` }
      : { status: 'skipped', reason: `${httpStatus} — page does not exist on this site` };
  }
  return { status: 'error', reason: `HTTP ${httpStatus}` };
}

// ── Budgets ─────────────────────────────────────────────────────────────────

const IMPACT_RANK: Record<AxeImpact, number> = { minor: 0, moderate: 1, serious: 2, critical: 3 };

/** axe can report a null impact; treat it as `moderate`, never silently drop it. */
export function normalizeImpact(impact: string | null | undefined): AxeImpact {
  return impact && impact in IMPACT_RANK ? (impact as AxeImpact) : 'moderate';
}

/** `serious,critical` → impacts, rejecting typos so a budget cannot silently be empty. */
export function parseImpacts(list: string): AxeImpact[] {
  const parts = list
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const p of parts)
    if (!(p in IMPACT_RANK))
      throw new Error(
        `unknown axe impact "${p}" (expected: minor | moderate | serious | critical)`,
      );
  if (parts.length === 0) throw new Error('at least one axe impact is required');
  return parts as AxeImpact[];
}

/** Everything that makes one audited page fail. Empty = the page passes. */
export function evaluatePage(
  metrics: PageMetrics | undefined,
  violations: AxeViolation[] | undefined,
  budgets: AuditBudgets,
): BudgetFailure[] {
  const failures: BudgetFailure[] = [];

  const check = (
    kind: 'lcp' | 'cls' | 'tbt',
    value: number | undefined,
    limit: number,
    label: string,
    unit: string,
  ) => {
    if (value === undefined || Number.isNaN(value)) {
      // A metric Lighthouse could not compute must not pass by default.
      failures.push({ kind: 'metric-missing', message: `${label} could not be measured` });
    } else if (value > limit) {
      failures.push({
        kind,
        message: `${label} ${fmt(value, unit)} exceeds the budget of ${fmt(limit, unit)}`,
      });
    }
  };
  check('lcp', metrics?.lcpMs, budgets.lcpMs, 'LCP', 'ms');
  check('cls', metrics?.cls, budgets.cls, 'CLS', '');
  check('tbt', metrics?.tbtMs, budgets.tbtMs, 'TBT', 'ms');

  for (const v of violations ?? []) {
    if (budgets.blockingImpacts.includes(v.impact)) {
      failures.push({
        kind: 'axe',
        message: `axe ${v.impact}: ${v.id} — ${v.help} (${v.nodeCount} node${v.nodeCount === 1 ? '' : 's'})`,
      });
    }
  }
  return failures;
}

function fmt(n: number, unit: string): string {
  const v = unit === 'ms' ? Math.round(n) : Number(n.toFixed(3));
  return unit ? `${v} ${unit}` : String(v);
}

/** Build a `PageResult` for a page that was not audited (skipped or error). */
export function unauditedPage(
  path: string,
  url: string,
  httpStatus: number | undefined,
  verdict: { status: 'skipped' | 'error'; reason?: string },
): PageResult {
  return {
    path,
    url,
    status: verdict.status,
    ...(httpStatus !== undefined ? { httpStatus } : {}),
    ...(verdict.reason ? { reason: verdict.reason } : {}),
    failures:
      verdict.status === 'error'
        ? [
            {
              kind: path === '/' ? 'required-page-missing' : 'page-error',
              message: verdict.reason ?? 'page error',
            },
          ]
        : [],
  };
}

export function auditedPage(
  path: string,
  url: string,
  httpStatus: number,
  metrics: PageMetrics,
  violations: AxeViolation[],
  budgets: AuditBudgets,
): PageResult {
  return {
    path,
    url,
    status: 'audited',
    httpStatus,
    metrics,
    violations,
    failures: evaluatePage(metrics, violations, budgets),
  };
}

export function buildReport(input: {
  generatedAt: string;
  baseUrl: string;
  formFactor: FormFactor;
  budgets: AuditBudgets;
  pages: PageResult[];
}): AuditReport {
  return {
    generatedAt: input.generatedAt,
    baseUrl: input.baseUrl,
    formFactor: input.formFactor,
    budgets: input.budgets,
    axeTags: AXE_TAGS,
    pages: input.pages,
    passed: input.pages.every((p) => p.failures.length === 0),
    disclaimer: DISCLAIMER,
    manualChecks: MANUAL_CHECKS,
  };
}

// ── Rendering ───────────────────────────────────────────────────────────────

/** `/` → `home`, `/a/b` → `a-b`: a safe per-page filename. */
export function pageSlug(path: string): string {
  const s = path.replace(/^\/+|\/+$/g, '').replace(/[^a-zA-Z0-9]+/g, '-');
  return s || 'home';
}

const dash = (v: number | undefined, f: (n: number) => string) => (v === undefined ? '—' : f(v));

export function renderPageMarkdown(page: PageResult, budgets: AuditBudgets): string {
  const lines: string[] = [];
  const verdict =
    page.status === 'skipped' ? 'SKIPPED' : page.failures.length === 0 ? 'PASS' : 'FAIL';
  lines.push(`### \`${page.path}\` — ${verdict}`);
  lines.push('');
  if (page.status !== 'audited') {
    lines.push(page.reason ?? page.status);
    for (const f of page.failures) lines.push(`- ✖ ${f.message}`);
    return lines.join('\n');
  }
  const m = page.metrics;
  lines.push('| Metric | Value | Budget |', '| --- | --- | --- |');
  lines.push(
    `| LCP | ${dash(m?.lcpMs, (n) => `${Math.round(n)} ms`)} | ${budgets.lcpMs} ms |`,
    `| CLS | ${dash(m?.cls, (n) => n.toFixed(3))} | ${budgets.cls} |`,
    `| TBT | ${dash(m?.tbtMs, (n) => `${Math.round(n)} ms`)} | ${budgets.tbtMs} ms |`,
    `| Performance | ${dash(m?.scores.performance, String)} | — |`,
    `| SEO | ${dash(m?.scores.seo, String)} | — |`,
    `| Best practices | ${dash(m?.scores.bestPractices, String)} | — |`,
  );
  lines.push('');
  const v = page.violations ?? [];
  if (v.length === 0) lines.push('axe: no violations.');
  else {
    lines.push(`axe: ${v.length} violated rule${v.length === 1 ? '' : 's'}.`, '');
    for (const x of [...v].sort((a, b) => IMPACT_RANK[b.impact] - IMPACT_RANK[a.impact])) {
      const blocking = budgets.blockingImpacts.includes(x.impact) ? ' (blocking)' : '';
      lines.push(
        `- **${x.impact}**${blocking} \`${x.id}\` — ${x.help} · ${x.nodeCount} node${x.nodeCount === 1 ? '' : 's'} · [rule](${x.helpUrl})`,
      );
      for (const t of x.targets) lines.push(`  - \`${t}\``);
    }
  }
  if (page.failures.length) {
    lines.push('', 'Failures:');
    for (const f of page.failures) lines.push(`- ✖ ${f.message}`);
  }
  return lines.join('\n');
}

export function renderMarkdown(report: AuditReport): string {
  const lines: string[] = [];
  lines.push('# Performance and accessibility audit', '');
  lines.push(
    `**${report.passed ? 'PASS' : 'FAIL'}** · ${report.baseUrl} · ${report.formFactor} · ${report.generatedAt}`,
    '',
  );
  lines.push(`> ${report.disclaimer}`, '');
  lines.push(
    `Budgets: LCP < ${report.budgets.lcpMs} ms, CLS < ${report.budgets.cls}, TBT < ${report.budgets.tbtMs} ms, ` +
      `no axe ${report.budgets.blockingImpacts.join(' or ')} violations. axe tags: ${report.axeTags.join(', ')}.`,
    '',
  );
  lines.push(
    '| Page | Result | LCP | CLS | TBT | Perf | SEO | BP |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
  );
  for (const p of report.pages) {
    const m = p.metrics;
    const verdict = p.status === 'skipped' ? 'skipped' : p.failures.length ? 'FAIL' : 'pass';
    lines.push(
      `| \`${p.path}\` | ${verdict} | ${dash(m?.lcpMs, (n) => `${Math.round(n)} ms`)} | ${dash(m?.cls, (n) => n.toFixed(3))} | ${dash(m?.tbtMs, (n) => `${Math.round(n)} ms`)} | ${dash(m?.scores.performance, String)} | ${dash(m?.scores.seo, String)} | ${dash(m?.scores.bestPractices, String)} |`,
    );
  }
  lines.push('');
  for (const p of report.pages) lines.push(renderPageMarkdown(p, report.budgets), '');
  lines.push('## Manual checks still required', '');
  for (const c of report.manualChecks) lines.push(`- [ ] ${c}`);
  lines.push('');
  return lines.join('\n');
}

/** Files to write, relative to the output dir: JSON + markdown overall and per page. */
export function reportFiles(report: AuditReport): Record<string, string> {
  const files: Record<string, string> = {
    'report.json': `${JSON.stringify(report, null, 2)}\n`,
    'report.md': renderMarkdown(report),
  };
  for (const p of report.pages) {
    if (p.status === 'skipped') continue;
    const slug = pageSlug(p.path);
    files[`pages/${slug}.json`] = `${JSON.stringify(p, null, 2)}\n`;
    files[`pages/${slug}.md`] =
      `${renderPageMarkdown(p, report.budgets)}\n\n> ${report.disclaimer}\n`;
  }
  return files;
}

/** One-line-per-failure console summary. */
export function formatSummary(report: AuditReport): string {
  const lines: string[] = [];
  for (const p of report.pages) {
    if (p.status === 'skipped') lines.push(`  –  ${p.path}  skipped (${p.reason})`);
    else if (p.failures.length === 0) lines.push(`  ✓  ${p.path}`);
    else {
      lines.push(`  ✖  ${p.path}`);
      for (const f of p.failures) lines.push(`       ${f.message}`);
    }
  }
  lines.push('', report.passed ? '✓ no automated violations' : '✖ audit failed');
  lines.push('Note: a pass is NOT AODA certification — see the manual checks in report.md.');
  return lines.join('\n');
}
