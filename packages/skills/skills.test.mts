import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vite-plus/test';

/**
 * Law topic files carry `verified:` + `sources:` frontmatter so an agent can tell how old a legal
 * fact is and where to re-check it. This guard checks the SHAPE only. It deliberately does not
 * compare `verified` with today's date: a test that fails because time passed would break
 * unrelated builds — `scripts/stale.mjs` reports age instead.
 */
const SKILLS = join(dirname(fileURLToPath(import.meta.url)), 'skills');
const LAW_SKILLS = ['vitops-compliance', 'vitops-accessibility', 'vitops-privacy'];

const frontmatter = (text: string) => /^---\n([\s\S]*?)\n---/.exec(text)?.[1] ?? '';

describe('law skills', () => {
  for (const skill of LAW_SKILLS) {
    const dir = join(SKILLS, skill);
    const files = (() => {
      try {
        return readdirSync(dir).filter((f) => f.endsWith('.md'));
      } catch {
        return [];
      }
    })();

    it(`${skill} has a SKILL.md`, () => {
      expect(files).toContain('SKILL.md');
    });

    for (const file of files.filter((f) => f !== 'SKILL.md')) {
      it(`${skill}/${file} is dated and sourced`, () => {
        const fm = frontmatter(readFileSync(join(dir, file), 'utf8'));
        expect(fm, 'verified: YYYY-MM-DD').toMatch(/^verified:\s*\d{4}-\d{2}-\d{2}\s*$/m);
        const urls = fm.match(/^\s+-\s+https:\/\/\S+/gm) ?? [];
        expect(urls.length, 'at least one https source').toBeGreaterThan(0);
      });
    }

    it(`${skill}/SKILL.md carries the currency and no-enforcement rules`, () => {
      const text = readFileSync(join(dir, 'SKILL.md'), 'utf8');
      expect(text).toMatch(/180 days/);
      expect(text).toMatch(/primary source/i);
      expect(text).toMatch(/enforce/i);
    });
  }
});
