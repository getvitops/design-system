import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import {
  canPrompt,
  missingFieldMessage,
  patchRaw,
  questionFor,
  writeConfigPatch,
} from './prompt.ts';

describe('questionFor', () => {
  test('a token question names the UI path and the console, not just the field', () => {
    // "meta.domainVerification is missing" is true and useless. Where to get it is
    // the difference between a prompt someone answers now and one they abandon.
    const q = questionFor('meta', 'domainVerification');
    expect(q.hints[0]).toMatch(/Business settings/);
    expect(q.hints).toContain('https://business.facebook.com/settings/owned-domains');
    expect(q.label).toBe('facebook-domain-verification=');
  });

  test("Google's tag id question says it is not the customer id", () => {
    expect(questionFor('google', 'pixelId').title).toMatch(/AW-…, not the customer ID/);
  });

  test('the non-interactive message names the config path', () => {
    expect(missingFieldMessage('tiktok', 'domainVerification')).toMatch(
      /site\.ads\.tiktok\.domainVerification/,
    );
  });
});

describe('canPrompt', () => {
  test('never asks in a mode that has nobody to answer', () => {
    // A CI run must fail with a named field, not hang on a question.
    expect(canPrompt({ dry: false, check: false, noPrompt: false, isTty: false })).toBe(false);
    expect(canPrompt({ dry: true, check: false, noPrompt: false, isTty: true })).toBe(false);
    expect(canPrompt({ dry: false, check: true, noPrompt: false, isTty: true })).toBe(false);
    expect(canPrompt({ dry: false, check: false, noPrompt: true, isTty: true })).toBe(false);
  });

  test('asks when interactive and mutating', () => {
    expect(canPrompt({ dry: false, check: false, noPrompt: false, isTty: true })).toBe(true);
  });
});

describe('patchRaw', () => {
  const raw = {
    designSystem: { themes: { default: {} } },
    site: { defaultLocale: 'en', ads: { meta: { pixelId: '1' } } },
  };

  test('lands the value at site.ads.<provider>.<field>', () => {
    const next = patchRaw(raw, 'meta', 'domainVerification', 'tok') as typeof raw;
    expect((next.site.ads.meta as Record<string, string>).domainVerification).toBe('tok');
  });

  test('leaves every sibling untouched', () => {
    // The write merges into the RAW on-disk object, never the resolved one: a
    // config using shorthand or `extends` must not be normalised into a rewritten
    // copy nothing builds from.
    const next = patchRaw(raw, 'meta', 'domainVerification', 'tok') as typeof raw;
    expect(next.designSystem).toEqual(raw.designSystem);
    expect(next.site.defaultLocale).toBe('en');
    expect((next.site.ads.meta as Record<string, string>).pixelId).toBe('1');
  });

  test('creates the ads block when the config has none', () => {
    const next = patchRaw({ site: {} }, 'tiktok', 'domainVerification', 'x') as {
      site: { ads: Record<string, Record<string, string>> };
    };
    expect(next.site.ads.tiktok?.domainVerification).toBe('x');
  });
});

describe('writeConfigPatch', () => {
  test('writes JSON in place, keeping the file’s own indentation', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vitops-ads-'));
    const file = join(dir, 'site.json');
    writeFileSync(file, JSON.stringify({ site: { ads: { meta: {} } } }, null, 4) + '\n');

    expect(writeConfigPatch(file, 'meta', 'domainVerification', 'tok').written).toBe(true);
    const source = readFileSync(file, 'utf8');
    expect(source).toContain('    "site"');
    expect(source.endsWith('\n')).toBe(true);
    expect(JSON.parse(source).site.ads.meta.domainVerification).toBe('tok');
  });

  test('refuses a module config and says what to paste', () => {
    // Rewriting code to insert a value is a different (and worse) problem than
    // merging an object.
    const res = writeConfigPatch('/nope/site.ts', 'meta', 'domainVerification', 'tok');
    expect(res.written).toBe(false);
    expect(res.reason).toMatch(/site\.ads\.meta/);
  });
});
