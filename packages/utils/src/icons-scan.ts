/**
 * Find the icons a consumer's source actually uses.
 *
 * This exists for one reason: bundle size under `output: 'server'`. astro-icon
 * is zero-config for static builds, but on a server/hybrid build it bundles
 * EVERY icon in a set unless given an `include` map — so consumers hand-maintain
 * a list, and hand-maintained lists rot. Scanning derives it instead.
 *
 * The judgement call throughout is the same one `vitops lint`'s `extractClasses`
 * makes, and for the same reason: a template hole (`name={expr}`) is not a typo
 * and must not be guessed at. An unresolvable reference is REPORTED, never
 * invented — the caller warns and asks the author to declare it. Quietly
 * inferring would produce an `include` that is confidently wrong, which is worse
 * than one that is honestly incomplete.
 */

/** How an icon reference was written. Useful for phrasing the warning. */
export type IconRefKind = 'component' | 'prop' | 'object' | 'sprite';

/** A statically resolvable icon name. */
export interface IconRef {
  name: string;
  kind: IconRefKind;
  attr: string;
  file: string;
  line: number;
}

/** A reference whose name is computed at runtime and cannot be read statically. */
export interface DynamicIconRef {
  expr: string;
  attr: string;
  file: string;
  line: number;
}

export interface IconScanResult {
  refs: IconRef[];
  dynamic: DynamicIconRef[];
  /** Unique static names, in first-seen order. */
  names: string[];
}

export interface IconScanOptions {
  /** Extra prop names to treat as icon-bearing, beyond the defaults. */
  props?: string[];
}

/**
 * Props that carry an icon name. `icon` covers the component convention
 * (`Popover`/`Drawer`/`Details` triggers); the start/end pair covers adornments
 * on links and buttons.
 */
const DEFAULT_PROPS = ['icon', 'startIcon', 'endIcon', 'leadingIcon', 'trailingIcon'];

/**
 * `<Icon …>` and any capitalised component whose name ends in `Icon`.
 * Requires a capital or the literal `Icon`, so `<iconButton>` and plain HTML
 * never match.
 */
const COMPONENT = /<([A-Z][\w.]*Icon|Icon)\b([^>]*?)\/?>/g;

/** Sprite references: `<use href="…/icons.svg#menu">`, incl. legacy `xlink:href`. */
const SPRITE_USE = /<use\b[^>]*?\b(?:xlink:)?href\s*=\s*(?:"([^"#]*)#([^"]*)"|'([^'#]*)#([^']*)')/g;

/**
 * An attribute value: a quoted literal, a braced single literal, or a braced
 * expression. The final alternative is what marks a value as dynamic — it is
 * matched on purpose so the reference can be REPORTED rather than skipped.
 *
 * That last alternative stops at the first `}`, so a reported expression
 * containing its own braces (`{\`a:${b}\`}`) is truncated in the warning text.
 * Deliberate: balancing braces with a regex buys nothing here, because the
 * actionable part of the report is the file and line, not the expression.
 */
const VALUE = String.raw`(?:"([^"]*)"|'([^']*)'|\{\s*(?:"([^"]*)"|'([^']*)'|\`([^\`$]*)\`)\s*\}|(\{[^}]*\}))`;

/**
 * `\b` is not enough of a left boundary here: `-` is a non-word character, so
 * `\bicon` happily matches inside `data-icon=` and `aria-icon=`. Requiring that
 * the previous character be neither a word character nor a hyphen keeps the
 * match to a genuine standalone prop.
 */
const LEFT = String.raw`(?<![\w-])`;

const nameAttr = () => new RegExp(String.raw`${LEFT}name\s*=\s*${VALUE}`);
const iconProp = (props: string[]) =>
  new RegExp(String.raw`${LEFT}(${props.join('|')})\s*=\s*${VALUE}`, 'g');
/** Object-literal form: `trigger={{ icon: 'bars' }}`, or a data array of `{ icon: '…' }`. */
const iconKey = (props: string[]) =>
  new RegExp(
    String.raw`${LEFT}(${props.join('|')})\s*:\s*(?:"([^"]*)"|'([^']*)'|\`([^\`$]*)\`)`,
    'g',
  );

const lineOf = (src: string, index: number) => src.slice(0, index).split('\n').length;

/**
 * Pull the literal out of a VALUE match, or report it as dynamic.
 * Groups run: "double", 'single', {"double"}, {'single'}, {`template`}, {expr}.
 */
function readValue(groups: (string | undefined)[]): { literal?: string; expr?: string } {
  const [dq, sq, bdq, bsq, btpl, expr] = groups;
  if (expr !== undefined) return { expr };
  const literal = dq ?? sq ?? bdq ?? bsq ?? btpl;
  if (literal === undefined) return {};
  // A template literal with an interpolation is dynamic even inside quotes.
  if (literal.includes('${')) return { expr: literal };
  return { literal };
}

/** Extract every icon reference from one file's text. */
export function extractIconRefs(
  src: string,
  file = '<source>',
  opts?: IconScanOptions,
): { refs: IconRef[]; dynamic: DynamicIconRef[] } {
  const props = [...new Set([...DEFAULT_PROPS, ...(opts?.props ?? [])])];
  const refs: IconRef[] = [];
  const dynamic: DynamicIconRef[] = [];

  // 1. <Icon name="…" /> — the name attribute inside an icon component tag.
  const NAME = nameAttr();
  for (const m of src.matchAll(COMPONENT)) {
    const attrs = m[2] ?? '';
    const hit = NAME.exec(attrs);
    if (!hit) continue;
    const line = lineOf(src, m.index!);
    const { literal, expr } = readValue(hit.slice(1));
    if (literal) refs.push({ name: literal, kind: 'component', attr: 'name', file, line });
    else if (expr) dynamic.push({ expr, attr: 'name', file, line });
  }

  // 2. icon= / startIcon= / endIcon= on any tag.
  for (const m of src.matchAll(iconProp(props))) {
    const line = lineOf(src, m.index!);
    const { literal, expr } = readValue(m.slice(2));
    if (literal) refs.push({ name: literal, kind: 'prop', attr: m[1]!, file, line });
    else if (expr) dynamic.push({ expr, attr: m[1]!, file, line });
  }

  // 3. `icon: '…'` inside an object literal or data array.
  for (const m of src.matchAll(iconKey(props))) {
    const literal = m[2] ?? m[3] ?? m[4];
    if (!literal || literal.includes('${')) continue;
    refs.push({ name: literal, kind: 'object', attr: m[1]!, file, line: lineOf(src, m.index!) });
  }

  // 4. Sprite <use href="…#id">.
  for (const m of src.matchAll(SPRITE_USE)) {
    const id = m[2] ?? m[4];
    if (!id) continue;
    refs.push({ name: id, kind: 'sprite', attr: 'href', file, line: lineOf(src, m.index!) });
  }

  return { refs, dynamic };
}

/** Run `extractIconRefs` across a file set and collect unique names. */
export function collectIconRefs(
  files: readonly { path: string; text: string }[],
  opts?: IconScanOptions,
): IconScanResult {
  const refs: IconRef[] = [];
  const dynamic: DynamicIconRef[] = [];
  for (const f of files) {
    const r = extractIconRefs(f.text, f.path, opts);
    refs.push(...r.refs);
    dynamic.push(...r.dynamic);
  }
  return { refs, dynamic, names: [...new Set(refs.map((r) => r.name))] };
}
