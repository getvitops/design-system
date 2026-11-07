/**
 * `vitops audit` — performance + accessibility budgets over a built site.
 *
 * Its own subpath (`@getvitops/utils/audit`), like `./media`: it is the only module
 * here that drives a browser. `plan.ts` is pure; `run.ts` loads `playwright`,
 * `@axe-core/playwright` and `lighthouse` lazily as optional peers.
 */
export {
  AXE_TAGS,
  DEFAULT_BUDGETS,
  DEFAULT_PAGES,
  DISCLAIMER,
  MANUAL_CHECKS,
  auditedPage,
  buildReport,
  classifyStatus,
  evaluatePage,
  formatSummary,
  isAuditMenu,
  normalizeImpact,
  normalizePath,
  pageSlug,
  parseImpacts,
  pathsFromMenus,
  pathsFromSeed,
  pathsFromSitemapLocs,
  planPages,
  renderMarkdown,
  renderPageMarkdown,
  reportFiles,
  sitemapLocs,
  unauditedPage,
} from './plan.ts';
export type { MenuItemLike, MenuLike, PagePlanInput } from './plan.ts';
export {
  fetchSitemapPaths,
  isPortFree,
  preflight,
  runAudit,
  runCommand,
  startPreview,
} from './run.ts';
export type { PreviewServer, RunOptions } from './run.ts';
export type * from './types.ts';
