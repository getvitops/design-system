/**
 * Best-effort static scan for `from` addresses in consumer source.
 *
 * Config already has the primary source of truth (`site.notifications.email.from`,
 * plus `resolveSender`'s derived default) — this exists only to catch a hand-rolled
 * `EMAIL.send()` call outside `createConversionRoute()`, which the config cannot see.
 *
 * Same judgement call as `icons-scan.ts`'s `extractIconRefs`, for the same reason:
 * a computed value (`from: getSender()`, `from: { email: cfg.from }`) is REPORTED
 * as dynamic, never guessed at. Guessing would produce a candidate list that is
 * confidently wrong, which is worse than one that is honestly incomplete — and
 * it is exactly the false-positive case `--skip`/`verifySender: false` exists for.
 */

/** A statically resolvable `from` address. */
export interface FromRef {
  address: string;
  /** `bare` — `from: 'x@y.com'`. `object` — `from: { email: '…' }` / `{ address: '…' }`. */
  kind: 'bare' | 'object';
  file: string;
  line: number;
}

/** A `from` value that cannot be read statically. */
export interface DynamicFromRef {
  expr: string;
  file: string;
  line: number;
}

export interface FromScanResult {
  refs: FromRef[];
  dynamic: DynamicFromRef[];
  /** Unique addresses, in first-seen order. */
  addresses: string[];
}

/**
 * `\b` isn't enough of a left boundary: `-` is a non-word character, so a bare
 * `\bfrom` would match inside `data-from=`. Requiring the previous character be
 * neither a word character nor a hyphen keeps the match to a genuine identifier.
 */
const LEFT = String.raw`(?<![\w-])`;

/** A quoted literal, a template literal (rejected if it interpolates), an object literal, or a bare expression. */
const VALUE = String.raw`(?:"([^"]*)"|'([^']*)'|\`([^\`]*)\`|(\{[^}]*\})|([A-Za-z_$][\w$.]*(?:\([^)]*\))?))`;

const FROM = new RegExp(String.raw`${LEFT}from\s*:\s*${VALUE}`, 'g');

/** `email:`/`address:` inside an already-isolated object-literal slice. */
const KEY = /(?<![\w-])(?:email|address)\s*:\s*(?:"([^"]*)"|'([^']*)'|`([^`$]*)`)/;

const lineOf = (src: string, index: number) => src.slice(0, index).split('\n').length;

/** Extract every `from` reference from one file's text. */
export function extractFromRefs(
  src: string,
  file = '<source>',
): { refs: FromRef[]; dynamic: DynamicFromRef[] } {
  const refs: FromRef[] = [];
  const dynamic: DynamicFromRef[] = [];

  for (const m of src.matchAll(FROM)) {
    const [dq, sq, tpl, obj, ident] = m.slice(1);
    const line = lineOf(src, m.index!);

    if (obj !== undefined) {
      const hit = KEY.exec(obj);
      const literal = hit?.[1] ?? hit?.[2] ?? hit?.[3];
      if (literal !== undefined && !literal.includes('${'))
        refs.push({ address: literal, kind: 'object', file, line });
      else dynamic.push({ expr: obj, file, line });
      continue;
    }

    if (ident !== undefined) {
      dynamic.push({ expr: ident, file, line });
      continue;
    }

    const literal = dq ?? sq ?? tpl;
    if (literal === undefined) continue;
    if (literal.includes('${')) {
      dynamic.push({ expr: literal, file, line });
      continue;
    }
    // A bare `from` string that isn't an email address is very likely an
    // unrelated field (a display name, a form field) — only an '@' makes this a
    // genuine candidate.
    if (literal.includes('@')) refs.push({ address: literal, kind: 'bare', file, line });
  }

  return { refs, dynamic };
}

/** Run `extractFromRefs` across a file set and collect unique addresses. */
export function collectFromAddresses(
  files: readonly { path: string; text: string }[],
): FromScanResult {
  const refs: FromRef[] = [];
  const dynamic: DynamicFromRef[] = [];
  for (const f of files) {
    const r = extractFromRefs(f.text, f.path);
    refs.push(...r.refs);
    dynamic.push(...r.dynamic);
  }
  return { refs, dynamic, addresses: [...new Set(refs.map((r) => r.address))] };
}
