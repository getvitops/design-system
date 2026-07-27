import { generateDocs, defaultConfig } from '@getvitops/generator';
import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
// NOTE: never import ./cli.ts here — it runs main() on import.
import { findSkillTarget, GENERATED_MARKER, linkSkill, SKILL_NAME, TOPICS } from './agents.ts';

describe('TOPICS', () => {
  it('every topic path exists in the generateDocs bundle (no-drift guard)', () => {
    const paths = new Set(Object.keys(generateDocs(defaultConfig(), '/nonexistent-assets')));
    for (const [name, t] of Object.entries(TOPICS))
      expect(paths.has(t.path), `topic "${name}" → ${t.path}`).toBe(true);
  });
});

describe('packaged SKILL.md', () => {
  const skill = readFileSync(new URL('../skill/SKILL.md', import.meta.url), 'utf8');

  it('has valid frontmatter', () => {
    expect(skill.startsWith(`---\nname: ${SKILL_NAME}\n`)).toBe(true);
    expect(skill).toMatch(/^description: >-$/m);
  });

  it('teaches every vitops docs topic', () => {
    for (const name of Object.keys(TOPICS)) expect(skill).toContain(`vitops docs ${name}`);
  });

  it('is not marked as generated (it is static, checked-in source)', () => {
    expect(skill).not.toContain(GENERATED_MARKER);
  });
});

describe('findSkillTarget', () => {
  let tmp: string;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'vitops-agents-'));
  });
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  it('finds the nearest node_modules/@getvitops/cli/skill walking up', () => {
    const skillDir = join(tmp, 'node_modules', '@getvitops', 'cli', 'skill');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), 'x');
    const nested = join(tmp, 'apps', 'web');
    mkdirSync(nested, { recursive: true });
    expect(findSkillTarget(nested)).toBe(skillDir);
    expect(findSkillTarget(tmp)).toBe(skillDir);
  });

  it('returns null when nothing is installed', () => {
    expect(findSkillTarget(tmp)).toBeNull();
  });
});

describe('linkSkill', () => {
  let tmp: string;
  let target: string;
  let linkPath: string;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'vitops-link-'));
    target = join(tmp, 'node_modules', '@getvitops', 'cli', 'skill');
    mkdirSync(target, { recursive: true });
    writeFileSync(join(target, 'SKILL.md'), 'packaged');
    linkPath = join(tmp, '.claude', 'skills', SKILL_NAME);
  });
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  it('creates a relative symlink (and is a no-op when already correct)', () => {
    expect(linkSkill(linkPath, target)).toBeNull();
    expect(readlinkSync(linkPath)).toBe(
      join('..', '..', 'node_modules', '@getvitops', 'cli', 'skill'),
    );
    expect(readFileSync(join(linkPath, 'SKILL.md'), 'utf8')).toBe('packaged');
    expect(linkSkill(linkPath, target)).toBeNull(); // idempotent
  });

  it('replaces a stale symlink', () => {
    mkdirSync(join(tmp, '.claude', 'skills'), { recursive: true });
    symlinkSync(join(tmp, 'elsewhere'), linkPath);
    expect(linkSkill(linkPath, target)).toBeNull();
    expect(readFileSync(join(linkPath, 'SKILL.md'), 'utf8')).toBe('packaged');
  });

  it('migrates an old generated-skill directory (GENERATED marker)', () => {
    mkdirSync(linkPath, { recursive: true });
    writeFileSync(join(linkPath, 'SKILL.md'), `---\nname: x\n---\n${GENERATED_MARKER} -->\nold`);
    mkdirSync(join(linkPath, 'references'), { recursive: true });
    expect(linkSkill(linkPath, target)).toBeNull();
    expect(lstatSync(linkPath).isSymbolicLink()).toBe(true);
    expect(readFileSync(join(linkPath, 'SKILL.md'), 'utf8')).toBe('packaged');
  });

  it('refuses to clobber a foreign real directory', () => {
    mkdirSync(linkPath, { recursive: true });
    writeFileSync(join(linkPath, 'SKILL.md'), 'hand-written user skill');
    const warn = linkSkill(linkPath, target);
    expect(warn).toContain('left');
    expect(lstatSync(linkPath).isSymbolicLink()).toBe(false);
    expect(readFileSync(join(linkPath, 'SKILL.md'), 'utf8')).toBe('hand-written user skill');
  });
});
