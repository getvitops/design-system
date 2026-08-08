/**
 * `--help` used to work on exactly two of fifteen command surfaces.
 *
 * Every leaf subcommand parses its own argv with `node:util`'s `parseArgs`,
 * which is strict and rejects any option its `options` object doesn't declare —
 * and none declared `help`. So `vitops lint --help` exited non-zero with a bare
 * `Unknown option '--help'`: the discovery path a consumer reaches for first,
 * failing in a way that reads like the command itself is broken.
 *
 * The fix answers `--help` in `main()` before dispatch, which means the risk
 * moves from "a command forgets the option" to "a command has no section in
 * HELP to print". That is what these guard.
 */
import { describe, expect, it } from 'vitest';
import { COMMANDS, HELP, SUBCOMMANDS, helpFor, helpSection, wantsHelp } from './help.ts';

describe('every command is documented', () => {
  it.each(COMMANDS.filter((c) => !(c in SUBCOMMANDS)))('%s has a HELP section', (cmd) => {
    expect(helpSection(cmd)).toBeDefined();
  });

  it.each(Object.entries(SUBCOMMANDS).flatMap(([cmd, subs]) => subs.map((s) => [cmd, s] as const)))(
    '%s %s has a HELP section',
    (cmd, sub) => {
      expect(helpSection(cmd, sub)).toBeDefined();
    },
  );
});

describe('helpFor', () => {
  it('returns the leaf section, not the whole help', () => {
    const out = helpFor('lint', ['--help']);
    expect(out).toContain('Lint options:');
    expect(out).not.toContain('Legal options:');
  });

  it('addresses a two-word section for a grouped subcommand', () => {
    // The heading is "Search setup options:" — capitalising both words (the
    // obvious implementation) silently misses every grouped subcommand and
    // falls back to the group blurb, which lists no options at all.
    expect(helpFor('search', ['setup', '--help'])).toContain('Search setup options:');
  });

  it('falls back to the group blurb for a bare group command', () => {
    expect(helpFor('search', ['--help'])).toContain('vitops search —');
  });

  it('stops at the next heading', () => {
    const out = helpFor('init', ['--help']);
    expect(out).toContain('--force');
    expect(out).not.toContain('Favicon options:');
  });

  it('falls back to the full help for a command with no section', () => {
    expect(helpFor('nonesuch', ['--help'])).toBe(HELP);
  });
});

describe('wantsHelp', () => {
  it('accepts both spellings anywhere in argv', () => {
    expect(wantsHelp(['--input', 'x.json', '--help'])).toBe(true);
    expect(wantsHelp(['-h'])).toBe(true);
  });

  it('is false for an ordinary invocation', () => {
    expect(wantsHelp(['--input', 'x.json', '--strict'])).toBe(false);
  });
});
