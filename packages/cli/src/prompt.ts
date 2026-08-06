/**
 * Asking for the config values `vitops ads setup` cannot derive, and writing the
 * answers back.
 *
 * The realistic first run has no verification token in the config, because the
 * token does not exist until someone opens the platform UI and asks for one. That
 * makes a missing token a **question**, not an error — but only when there is
 * somebody there to answer it, which is why every decision about *whether* to ask
 * is made here and the planner stays pure.
 *
 * The split mirrors the rest of the toolchain: `questionFor` and `patchRaw` are
 * pure and tested; `ask` and `writeConfigPatch` are the I/O, and they decide
 * nothing.
 *
 * Two rules hold the whole file together:
 *
 *  - **A prompt must never hang a CI run.** Asking requires a TTY and an explicit
 *    absence of `--dry` / `--check` / `--no-prompt`; otherwise the caller gets the
 *    same named error it would have got before this file existed.
 *  - **A fact about the site goes in the config; a credential stays in the
 *    environment.** A verification token is published in DNS — the platform
 *    fetching it back is the ownership proof — so persisting it is right, and it is
 *    the only thing here that gets written. `CLOUDFLARE_API_TOKEN` may be typed at
 *    a prompt and lives only in the process.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { AD_PLATFORMS, type AdProvider, type MissingField } from '@getvitops/utils/ads';

export interface Question {
  provider: AdProvider;
  needs: MissingField;
  /** One line naming what is being asked for. */
  title: string;
  /** Where to get it — UI path first, then the URL. */
  hints: string[];
  /** The inline label the answer is typed after. */
  label: string;
}

/**
 * What to ask for one gap, and where the operator finds it.
 *
 * The hints are the point. "meta.domainVerification is missing" is true and
 * useless; the UI path plus the console URL is the difference between a prompt
 * someone can answer now and one they abandon to go searching.
 */
export function questionFor(provider: AdProvider, needs: MissingField): Question {
  const platform = AD_PLATFORMS[provider];
  if (needs === 'domainVerification') {
    return {
      provider,
      needs,
      title: `${platform.name} — domain verification token`,
      hints: [
        ...(platform.verification.where ? [platform.verification.where] : []),
        platform.consoleUrl,
      ],
      // The prefix is shown as part of the prompt so it is obvious the platform's
      // bare token is what goes here, not the whole record. `txtRecord` accepts
      // either, but showing the prefix stops the ambiguity arising at all.
      label: platform.verification.txtPrefix ?? 'token',
    };
  }
  const what =
    needs === 'pixelId'
      ? provider === 'google'
        ? 'conversion ID (AW-…, not the customer ID)'
        : 'pixel / tag ID'
      : 'advertising account ID';
  return {
    provider,
    needs,
    title: `${platform.name} — ${what}`,
    hints: [platform.consoleUrl],
    label: needs,
  };
}

/** The error a non-interactive run gets instead of a prompt. */
export function missingFieldMessage(provider: AdProvider, needs: MissingField): string {
  const q = questionFor(provider, needs);
  return (
    `site.ads.${provider}.${needs} is not set — ${q.title}.\n` +
    q.hints.map((h) => `  ${h}`).join('\n') +
    `\n  Run this interactively to be prompted for it, or add it to the config yourself.`
  );
}

/** Whether this run is allowed to ask. Everything that would hang CI is checked here. */
export function canPrompt(opts: {
  dry: boolean;
  check: boolean;
  noPrompt: boolean;
  isTty?: boolean | undefined;
}): boolean {
  if (opts.dry || opts.check || opts.noPrompt) return false;
  return opts.isTty ?? Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

/**
 * Ask one question. An empty answer means "skip this one" — reported as still
 * blocked rather than treated as a value, so nothing is written and nothing is
 * created on the strength of a stray Enter.
 */
export async function ask(q: Question): Promise<string | undefined> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    console.log(`\n${q.title}`);
    for (const hint of q.hints) console.log(`  ${hint}`);
    const answer = (await rl.question(`  ${q.label} `)).trim();
    return answer || undefined;
  } finally {
    rl.close();
  }
}

/**
 * Merge one ad-property field into a **raw, on-disk** config object.
 *
 * Raw is load-bearing, and it is the rule `@getvitops/vite`'s `designSystemPath()`
 * already follows for the theme editor's save: `resolveConfig` normalises shorthand
 * shapes and resolves `extends` in memory, so writing from the resolved object
 * would grow keys beside the author's and silently edit a copy nothing builds from.
 * Everything outside `site.ads.<provider>.<field>` is left exactly as it was.
 */
export function patchRaw(
  raw: unknown,
  provider: AdProvider,
  field: MissingField,
  value: string,
): unknown {
  if (typeof raw !== 'object' || raw == null || Array.isArray(raw))
    throw new Error('config is not an object');
  const root = raw as Record<string, unknown>;
  const site = (root['site'] ?? {}) as Record<string, unknown>;
  const ads = (site['ads'] ?? {}) as Record<string, unknown>;
  const entry = (ads[provider] ?? {}) as Record<string, unknown>;
  return {
    ...root,
    site: { ...site, ads: { ...ads, [provider]: { ...entry, [field]: value } } },
  };
}

/** Indentation the file already uses, so a patch doesn't reformat the whole document. */
function detectIndent(source: string): string | number {
  const match = /\n([ \t]+)"/.exec(source);
  if (!match?.[1]) return 2;
  return match[1].includes('\t') ? '\t' : match[1].length;
}

/**
 * Persist one answered field into the config file.
 *
 * JSON only: a `.js`/`.ts` config is code, and rewriting code to insert a value is
 * a different (and much worse) problem than merging an object — so the caller is
 * told to paste it instead. Returns whether it wrote.
 */
export function writeConfigPatch(
  path: string,
  provider: AdProvider,
  field: MissingField,
  value: string,
): { written: boolean; reason?: string } {
  if (!path.endsWith('.json'))
    return {
      written: false,
      reason: `${path} is a module, not JSON — add "${field}": "${value}" to site.ads.${provider} yourself`,
    };
  if (!existsSync(path)) return { written: false, reason: `${path} no longer exists` };
  const source = readFileSync(path, 'utf8');
  const raw: unknown = JSON.parse(source);
  const next = patchRaw(raw, provider, field, value);
  const trailingNewline = source.endsWith('\n') ? '\n' : '';
  writeFileSync(path, JSON.stringify(next, null, detectIndent(source)) + trailingNewline);
  return { written: true };
}
