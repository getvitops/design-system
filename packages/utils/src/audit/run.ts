/**
 * `vitops audit` — the I/O half. Starts (or attaches to) a server, drives Chromium,
 * runs axe and Lighthouse, and hands the raw numbers to `plan.ts`. It decides nothing:
 * which pages, what a status means and whether a number breaches a budget are all
 * `plan.ts`'s.
 *
 * `playwright`, `@axe-core/playwright` and `lighthouse` are OPTIONAL peer dependencies,
 * loaded lazily. They are heavy (a browser driver and ~100 MB of Lighthouse) and a
 * consumer who never runs `vitops audit` must not pay for them. A missing one fails
 * with the install command, not a bare `Cannot find package`.
 *
 * Lighthouse runs on the SAME Chromium Playwright launched — Playwright opens it with
 * `--remote-debugging-port`, axe drives it through Playwright, and Lighthouse attaches
 * over that port — so one browser binary serves both and nothing here needs Chrome
 * installed system-wide.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { AXE_TAGS, auditedPage, classifyStatus, normalizeImpact, unauditedPage } from './plan.ts';
import type { AuditBudgets, AxeViolation, FormFactor, PageMetrics, PageResult } from './types.ts';

const INSTALL =
  'npm i -D playwright @axe-core/playwright lighthouse && npx playwright install chromium';

/** Load an optional dependency or throw an error that says how to get it. */
async function loadOptional<T>(name: string): Promise<T> {
  try {
    // A variable specifier keeps bundlers and the type checker from resolving it —
    // that is the whole point of "optional".
    return (await import(/* @vite-ignore */ name)) as T;
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === 'ERR_MODULE_NOT_FOUND' || code === 'MODULE_NOT_FOUND')
      throw new Error(
        `vitops audit needs "${name}", which is an optional dependency and is not installed.\n` +
          `  Install: ${INSTALL}`,
        { cause: err },
      );
    throw err;
  }
}

/** A free TCP port, or `true` for "this specific one is free". */
export function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const s = createServer();
    s.once('error', () => resolve(false));
    s.listen(port, '127.0.0.1', () => s.close(() => resolve(true)));
  });
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address() as { port: number };
      s.close(() => resolve(port));
    });
  });
}

/** Run a command to completion, inheriting stdio. Rejects on a non-zero exit. */
export function runCommand(cmd: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
    child.once('error', reject);
    child.once('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(' ')} exited with ${code}`)),
    );
  });
}

export interface PreviewServer {
  baseUrl: string;
  stop(): void;
}

/**
 * `astro preview` on a dedicated port.
 *
 * Astro's preview server silently moves to the next port when its own is taken, and
 * a readiness probe would then happily attach to whatever owns the original one — the
 * failure `site/playwright.config.ts` documents. So the port is checked free first and
 * the run aborts if it is not.
 */
export async function startPreview(opts: {
  cwd: string;
  port: number;
  timeoutMs?: number;
}): Promise<PreviewServer> {
  if (!(await isPortFree(opts.port)))
    throw new Error(
      `port ${opts.port} is already in use — refusing to audit whatever is listening there. ` +
        `Pass --port <free port>, or --url to audit a server you started yourself.`,
    );
  const baseUrl = `http://127.0.0.1:${opts.port}`;
  const child: ChildProcess = spawn(
    'npx',
    ['--no-install', 'astro', 'preview', '--host', '127.0.0.1', '--port', String(opts.port)],
    { cwd: opts.cwd, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' },
  );
  let log = '';
  child.stdout?.on('data', (d) => (log += String(d)));
  child.stderr?.on('data', (d) => (log += String(d)));
  let exited: number | null | undefined;
  child.once('exit', (code) => (exited = code));

  const stop = () => {
    try {
      if (child.pid && process.platform !== 'win32') process.kill(-child.pid, 'SIGTERM');
      else child.kill('SIGTERM');
    } catch {
      /* already gone */
    }
  };

  const deadline = Date.now() + (opts.timeoutMs ?? 60_000);
  while (Date.now() < deadline) {
    if (exited !== undefined) {
      throw new Error(
        `astro preview exited early (code ${exited}). Did you build first? Pass --build.\n${log.trim()}`,
      );
    }
    try {
      await fetch(baseUrl, { redirect: 'manual' });
      return { baseUrl, stop };
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  stop();
  throw new Error(`astro preview did not answer on ${baseUrl} within the timeout.\n${log.trim()}`);
}

// ── Browser tooling (structural types: these modules are optional) ───────────

interface AxeResult {
  violations: Array<{
    id: string;
    impact?: string | null;
    help: string;
    helpUrl: string;
    nodes: Array<{ target: unknown[] }>;
  }>;
}
interface LighthouseAudits {
  [id: string]: { numericValue?: number } | undefined;
}
interface LighthouseRun {
  lhr: {
    audits: LighthouseAudits;
    categories: Record<string, { score: number | null } | undefined>;
  };
}

function toViolations(res: AxeResult): AxeViolation[] {
  return res.violations.map((v) => ({
    id: v.id,
    impact: normalizeImpact(v.impact),
    help: v.help,
    helpUrl: v.helpUrl,
    nodeCount: v.nodes.length,
    targets: v.nodes.slice(0, 3).map((n) => String(n.target.flat().join(' '))),
  }));
}

function toMetrics(run: LighthouseRun): PageMetrics {
  const a = run.lhr.audits;
  const score = (id: string) => {
    const s = run.lhr.categories[id]?.score;
    return s == null ? undefined : Math.round(s * 100);
  };
  return {
    lcpMs: a['largest-contentful-paint']?.numericValue,
    cls: a['cumulative-layout-shift']?.numericValue,
    tbtMs: a['total-blocking-time']?.numericValue,
    scores: {
      performance: score('performance'),
      seo: score('seo'),
      bestPractices: score('best-practices'),
    },
  };
}

export interface RunOptions {
  baseUrl: string;
  paths: string[];
  budgets: AuditBudgets;
  formFactor: FormFactor;
  onProgress?: (message: string) => void;
}

/** Audit each path. Never throws for a bad PAGE — only for missing tooling/browser. */
export async function runAudit(opts: RunOptions): Promise<PageResult[]> {
  const log = opts.onProgress ?? (() => {});
  const [pw, axe, lh] = await Promise.all([
    loadOptional<{
      chromium: {
        launch(o: { headless: boolean; args: string[] }): Promise<{
          newContext(): Promise<{
            newPage(): Promise<{
              goto(u: string, o: { waitUntil: string }): Promise<unknown>;
            }>;
            close(): Promise<void>;
          }>;
          close(): Promise<void>;
        }>;
      };
    }>('playwright'),
    loadOptional<{
      AxeBuilder: new (o: { page: unknown }) => {
        withTags(t: string[]): { analyze(): Promise<AxeResult> };
      };
    }>('@axe-core/playwright'),
    loadOptional<{
      default: (
        url: string,
        flags: Record<string, unknown>,
        config?: unknown,
      ) => Promise<LighthouseRun | undefined>;
    }>('lighthouse'),
  ]);

  const debugPort = await freePort();
  let browser;
  try {
    browser = await pw.chromium.launch({
      headless: true,
      args: [`--remote-debugging-port=${debugPort}`],
    });
  } catch (err) {
    throw new Error(
      `could not launch Chromium: ${(err as Error).message}\n  Install a browser: npx playwright install chromium`,
      { cause: err },
    );
  }

  const results: PageResult[] = [];
  try {
    for (const path of opts.paths) {
      const url = new URL(path, opts.baseUrl).href;
      let httpStatus: number | undefined;
      try {
        httpStatus = (await fetch(url, { redirect: 'follow' })).status;
      } catch {
        httpStatus = undefined;
      }
      const verdict = classifyStatus(path, httpStatus);
      if (verdict.status !== 'audited') {
        log(`${path}: ${verdict.status} (${verdict.reason})`);
        results.push(unauditedPage(path, url, httpStatus, verdict as never));
        continue;
      }

      log(`${path}: axe`);
      // axe-playwright refuses a page that did not come from `newContext()`.
      const context = await browser.newContext();
      const page = await context.newPage();
      let violations: AxeViolation[];
      try {
        await page.goto(url, { waitUntil: 'load' });
        violations = toViolations(await new axe.AxeBuilder({ page }).withTags(AXE_TAGS).analyze());
      } finally {
        await context.close();
      }

      log(`${path}: lighthouse`);
      const flags: Record<string, unknown> = {
        port: debugPort,
        output: 'json',
        logLevel: 'error',
        onlyCategories: ['performance', 'seo', 'best-practices'],
        formFactor: opts.formFactor,
        ...(opts.formFactor === 'desktop'
          ? {
              screenEmulation: {
                mobile: false,
                width: 1350,
                height: 940,
                deviceScaleFactor: 1,
                disabled: false,
              },
              throttling: {
                rttMs: 40,
                throughputKbps: 10 * 1024,
                cpuSlowdownMultiplier: 1,
                requestLatencyMs: 0,
                downloadThroughputKbps: 0,
                uploadThroughputKbps: 0,
              },
            }
          : {}),
      };
      const run = await lh.default(url, flags);
      const metrics: PageMetrics = run ? toMetrics(run) : { scores: {} };
      results.push(auditedPage(path, url, httpStatus!, metrics, violations, opts.budgets));
    }
  } finally {
    await browser.close();
  }
  return results;
}
