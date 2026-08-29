/**
 * A typed wrapper around `node:util`'s `parseArgs`, used by every `vitops` subcommand.
 *
 * `parseArgs` types every value as `string | boolean | string[] | undefined` regardless
 * of the `type`/`default` declared for it, so every call site otherwise repeats its own
 * `values.x as string` / `as boolean` cast. The accessors below carry that cast once,
 * at the point where the option's actual shape (has a default vs. optional vs. a flag)
 * is known.
 */
import { parseArgs, type ParseArgsOptionsConfig } from 'node:util';
import { resolve } from 'node:path';

export function parse<T extends ParseArgsOptionsConfig>(
  argv: string[],
  options: T,
  allowPositionals = false,
) {
  const { values, positionals } = parseArgs({
    args: argv,
    options,
    allowPositionals,
    strict: true,
  });
  // `values`'s type is a mapped type keyed by literal option names, which TS
  // cannot index with a generic `keyof T` — the runtime shape is exactly
  // `Record<string, string | boolean | string[] | undefined>` regardless, so the
  // accessors below read through that instead of fighting the mapped type.
  const raw = values as Record<string, string | boolean | string[] | undefined>;
  return {
    /** An option with a `default` — always a string. */
    str: (k: keyof T & string): string => raw[k] as string,
    /** An option with no `default` — may be absent. */
    opt: (k: keyof T & string): string | undefined => raw[k] as string | undefined,
    /** A `type: 'boolean'` option. */
    flag: (k: keyof T & string): boolean => raw[k] === true,
    /** A `multiple: true` string option. */
    list: (k: keyof T & string): string[] => (raw[k] as string[] | undefined) ?? [],
    /** A path option, resolved against the cwd — folds in `resolve(values.x as string)`. */
    path: (k: keyof T & string): string => resolve(raw[k] as string),
    /** Raw `parseArgs` output, for the rare case none of the above fit. */
    values,
    positionals,
  };
}

/** `(err as Error).message`, named — every `catch` block wants this. */
export function msg(err: unknown): string {
  return (err as Error).message;
}
