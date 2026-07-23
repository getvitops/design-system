/**
 * Framework-agnostic HTML/markup helpers (parse5-based). Extracted from
 * @getvitops/astro — no Astro runtime dependency; the Astro-typed `HTMLTag` /
 * `HTMLAttributes` are generalized to `string` / `Record<string, unknown>`.
 */
import { parseFragment, serialize as s, type DefaultTreeAdapterTypes } from 'parse5';
import type { Localizable, ContentNode } from './content.ts';

export type ChildNode = DefaultTreeAdapterTypes.ChildNode;

export function parseRenderedSlots(html: string): ChildNode[] {
  return parseFragment(html).childNodes;
}

export function getAttribute(node: ChildNode, attrName: string): string | null {
  if ('attrs' in node) {
    const attr = node.attrs.find((a) => a.name === attrName);
    return attr ? attr.value : null;
  }
  return null;
}

export function serialize(nodes: ChildNode | ChildNode[]): string[] {
  return (Array.isArray(nodes) ? nodes : [nodes]).map((node) =>
    s(node as DefaultTreeAdapterTypes.ParentNode),
  );
}

/** Style value types that can be combined (camelCase or --custom-prop keys). */
type StyleObject = Record<string, string | number | null | undefined>;
export type StyleValue = string | StyleObject | null | undefined;
export type StyleList = StyleValue | StyleValue[];

/** camelCase → kebab-case, preserving CSS custom properties (`--var-name`). */
function toKebabCase(str: string): string {
  if (str.startsWith('--')) return str;
  return str.replace(/([A-Z])/g, '-$1').toLowerCase();
}
function styleObjectToString(obj: StyleObject): string {
  return Object.entries(obj)
    .filter(([, value]) => value != null)
    .map(([key, value]) => `${toKebabCase(key)}: ${value}`)
    .join('; ');
}

/** Combine multiple style formats into one CSS string (like `class:list` for styles). */
export function styleList(...styles: StyleList[]): string {
  const result: string[] = [];
  const process = (item: StyleList): void => {
    if (item == null) return;
    if (Array.isArray(item)) {
      item.forEach(process);
    } else if (typeof item === 'string') {
      const trimmed = item.trim();
      if (trimmed) result.push(trimmed);
    } else {
      const str = styleObjectToString(item as StyleObject);
      if (str) result.push(str);
    }
  };
  styles.forEach(process);
  return result.join('; ');
}

/** Element descriptor: a tag name, text content, and optional attributes. */
export interface El<Tag extends string = string> {
  text: string;
  tag: Tag;
  attributes?: Record<string, unknown>;
}

function isEl(value: string | El): value is El {
  return typeof value === 'object' && value !== null && 'tag' in value && 'text' in value;
}

function attributesToString(attrs: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (value === true) {
      parts.push(key);
    } else if (key === 'style' && typeof value === 'object') {
      parts.push(`style="${styleList(value as StyleValue)}"`);
    } else {
      const text = Array.isArray(value)
        ? value.filter((v): v is string => typeof v === 'string' && v !== '').join(' ')
        : typeof value === 'object'
          ? JSON.stringify(value)
          : String(value as string | number | boolean);
      parts.push(`${key}="${text.replace(/"/g, '&quot;')}"`);
    }
  }
  return parts.join(' ');
}

/** Normalize a string or `El` object into an HTML string (for `set:html`). */
export function toHtml<Tag extends string>(content: string | El<Tag>): string {
  if (!isEl(content)) return content;
  const { tag, text, attributes } = content;
  const attrStr = attributes ? attributesToString(attributes) : '';
  const t = String(tag);
  return attrStr ? `<${t} ${attrStr}>${text}</${t}>` : `<${t}>${text}</${t}>`;
}

// ── node-tree renderer — { tag, attrs, children } ────────────────────────────
const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

function defaultResolveText(value: Localizable): string {
  if (typeof value === 'string') return value;
  const values = Object.values(value);
  return values[0] ?? '';
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function nodeToHtml(node: ContentNode, resolveText: (value: Localizable) => string): string {
  if (typeof node === 'string') return escapeHtml(resolveText(node));
  const { tag, attrs, text, children } = node;
  const attrStr = attrs ? attributesToString(attrs) : '';
  const open = attrStr ? `<${tag} ${attrStr}>` : `<${tag}>`;
  if (VOID_ELEMENTS.has(tag)) return open;
  let inner = '';
  if (text != null) inner = escapeHtml(resolveText(text));
  else if (children?.length)
    inner = children.map((child) => nodeToHtml(child, resolveText)).join('');
  return `${open}${inner}</${tag}>`;
}

/** Render an array of `ContentNode`s to an HTML string. */
export function nodesToHtml(
  nodes: ContentNode[],
  resolveText: (value: Localizable) => string = defaultResolveText,
): string {
  return nodes.map((node) => nodeToHtml(node, resolveText)).join('');
}
