/**
 * `vitops audit` — performance + accessibility budgets over a built site.
 *
 * The planner (page discovery, status handling, budgets, report rendering) is pure and
 * lives in `@getvitops/utils/audit` beside `ads/`, `indexing/` and `onboarding/`, as
 * `plan.ts`; this file is wiring only — flags in, files + exit code out. The browser
 * tooling (Playwright, axe, Lighthouse) is lazy and optional, see `audit/run.ts`.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import {
  DEFAULT_BUDGETS,
  buildReport,
  formatSummary,
  parseImpacts,
  pathsFromSeed,
  planPages,
  reportFiles,
  runAudit,
  runCommand,
  startPreview,
  type AuditBudgets,
  type FormFactor,
} from '@getvitops/utils/audit';
import { msg, parse } from '../args.ts';
import { fail } from './shared.ts';

/** Dedicated port: not Astro's 4321, which a developer's own `astro dev` is likely on. */
const DEFAULT_PORT = 4398;

function num(flag: string, raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) fail(`audit: --${flag} must be a positive number`);
  return n;
}

export async function cmdAudit(argv: string[]): Promise<void> {
  const args = parse(argv, {
    dir: { type: 'string', default: '.' },
    url: { type: 'string' },
    build: { type: 'boolean', default: false },
    port: { type: 'string' },
    pages: { type: 'string' },
    'no-defaults': { type: 'boolean', default: false },
    seed: { type: 'string' },
    out: { type: 'string', short: 'o', default: '.vitops/audit' },
    lcp: { type: 'string' },
    cls: { type: 'string' },
    tbt: { type: 'string' },
    impact: { type: 'string' },
    'form-factor': { type: 'string', default: 'mobile' },
    warn: { type: 'boolean', default: false },
  });

  const dir = resolve(args.str('dir'));
  const formFactor = args.str('form-factor') as FormFactor;
  if (formFactor !== 'mobile' && formFactor !== 'desktop')
    fail('audit: --form-factor must be mobile or desktop');

  let impacts = DEFAULT_BUDGETS.blockingImpacts;
  const impactFlag = args.opt('impact');
  if (impactFlag) {
    try {
      impacts = parseImpacts(impactFlag);
    } catch (err) {
      fail(`audit: ${msg(err)}`);
    }
  }
  const budgets: AuditBudgets = {
    lcpMs: num('lcp', args.opt('lcp'), DEFAULT_BUDGETS.lcpMs),
    cls: num('cls', args.opt('cls'), DEFAULT_BUDGETS.cls),
    tbtMs: num('tbt', args.opt('tbt'), DEFAULT_BUDGETS.tbtMs),
    blockingImpacts: impacts,
  };

  // Menu-derived candidates: the EmDash seed, when there is one. Explicit `--seed` must
  // exist; the default location is only looked at, never required.
  const seedFlag = args.opt('seed');
  const seedPath = seedFlag ? resolve(seedFlag) : join(dir, 'seed', 'seed.json');
  let menuPaths: string[] = [];
  if (existsSync(seedPath)) {
    try {
      menuPaths = pathsFromSeed(JSON.parse(readFileSync(seedPath, 'utf8')));
    } catch (err) {
      fail(`audit: could not read menus from ${seedPath}: ${msg(err)}`);
    }
  } else if (seedFlag) fail(`audit: seed not found: ${seedPath}`);

  const paths = planPages({
    menuPaths,
    extra: (args.opt('pages') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    includeDefaults: !args.flag('no-defaults'),
  });

  if (args.flag('build') && !args.opt('url')) {
    console.log('▸ building (astro build)');
    try {
      await runCommand('npx', ['--no-install', 'astro', 'build'], dir);
    } catch (err) {
      fail(`audit: build failed: ${msg(err)}`);
    }
  }

  let server: Awaited<ReturnType<typeof startPreview>> | undefined;
  let baseUrl = args.opt('url');
  try {
    if (!baseUrl) {
      const port = num('port', args.opt('port'), DEFAULT_PORT);
      console.log(`▸ astro preview on :${port}`);
      server = await startPreview({ cwd: dir, port });
      baseUrl = server.baseUrl;
    }
    console.log(`▸ auditing ${paths.length} candidate page(s) at ${baseUrl} (${formFactor})`);
    const pages = await runAudit({
      baseUrl,
      paths,
      budgets,
      formFactor,
      onProgress: (m) => console.log(`  ${m}`),
    });
    const report = buildReport({
      generatedAt: new Date().toISOString(),
      baseUrl,
      formFactor,
      budgets,
      pages,
    });

    const out = resolve(dir, args.str('out'));
    for (const [name, contents] of Object.entries(reportFiles(report))) {
      const file = join(out, name);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, contents);
    }
    console.log(`\n${formatSummary(report)}\n\nReport: ${join(out, 'report.md')}`);

    if (!report.passed) {
      if (args.flag('warn')) console.log('(--warn: reporting only, exit 0)');
      else process.exitCode = 1;
    }
  } catch (err) {
    // `fail` exits the process, which skips `finally` — stop the server first or the
    // detached preview outlives the run.
    server?.stop();
    fail(`audit: ${msg(err)}`);
  } finally {
    server?.stop();
  }
}
