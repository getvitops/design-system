import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { CONFIG_FILENAME } from './config.ts';
import { legacyConfigHint } from './legacy-config.ts';

const dirs: string[] = [];
function project(files: Record<string, unknown>): string {
  const dir = mkdtempSync(join(tmpdir(), 'vitops-legacy-config-'));
  dirs.push(dir);
  for (const [name, body] of Object.entries(files))
    writeFileSync(join(dir, name), typeof body === 'string' ? body : JSON.stringify(body));
  return dir;
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe('legacyConfigHint', () => {
  it('names the rename when only the old file is present', () => {
    const hint = legacyConfigHint(project({ 'site.json': { designSystem: {} } }));
    expect(hint).toContain(`git mv site.json ${CONFIG_FILENAME}`);
    expect(hint).toContain('astro.config.mjs');
  });

  it('is silent once the new file exists, even beside the old one', () => {
    const cwd = project({
      'site.json': { designSystem: {} },
      [CONFIG_FILENAME]: { designSystem: {} },
    });
    expect(legacyConfigHint(cwd)).toBeUndefined();
  });

  it('is silent when there is no old file', () => {
    expect(legacyConfigHint(project({}))).toBeUndefined();
  });

  it('leaves a site.json that is not a Config alone', () => {
    expect(legacyConfigHint(project({ 'site.json': { name: 'unrelated' } }))).toBeUndefined();
    expect(legacyConfigHint(project({ 'site.json': '{ not json' }))).toBeUndefined();
  });
});
