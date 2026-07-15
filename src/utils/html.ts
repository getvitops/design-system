import {parseFragment, serialize as s, type DefaultTreeAdapterTypes} from 'parse5';
import type { HTMLTag, HTMLAttributes } from 'astro/types';
import type { Localizable, ContentNode } from '../types.js';

export type ChildNode = DefaultTreeAdapterTypes.ChildNode;

export function parseRenderedSlots(html: string): ChildNode[] {
  const document = parseFragment(html);
  return document.childNodes;
}

export function getAttribute(node: ChildNode, attrName: string): string | null {
  if ('attrs' in node) {
    const attr = node.attrs.find(a => a.name === attrName);
    return attr ? attr.value : null;
  }
  return null;
}

export function serialize(nodes: ChildNode | ChildNode[]): string[] {
  return (Array.isArray(nodes) ? nodes : [nodes]).map(node => s(node as DefaultTreeAdapterTypes.ParentNode));
}

/**
 * Style value types that can be combined
 */
export type StyleValue = string | astroHTML.JSX.CSSProperties | null | undefined;
export type StyleList = StyleValue | StyleValue[];

/**
 * Convert camelCase to kebab-case, preserving CSS custom properties (--var-name)
 */
function toKebabCase(str: string): string {
  if (str.startsWith('--')) return str;
  return str.replace(/([A-Z])/g, '-$1').toLowerCase();
}

/**
 * Convert a style object to a CSS string
 */
type StyleObject = Record<string, string | number | null | undefined>;
function styleObjectToString(obj: StyleObject): string {
  return Object.entries(obj)
    .filter(([, value]) => value != null)
    .map(([key, value]) => `${toKebabCase(key)}: ${value}`)
    .join('; ');
}

/**
 * Combine multiple style formats into a single CSS string
 * Similar to Astro's class:list but for inline styles
 */
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

/**
 * Element descriptor matching the El interface from env.d.ts
 */
export interface El<Tag extends HTMLTag = HTMLTag> {
  text: string;
  tag: Tag;
  attributes?: HTMLAttributes<Tag>;
}

/**
 * Type guard to check if a value is an El object
 */
function isEl(value: string | El): value is El {
  return typeof value === 'object' && value !== null && 'tag' in value && 'text' in value;
}

/**
 * Convert HTML attributes object to a string for use in markup
 */
function attributesToString(attrs: Record<string, unknown>): string {
  const parts: string[] = [];

  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (value === true) {
      parts.push(key);
    } else if (key === 'style' && typeof value === 'object') {
      parts.push(`style="${styleList(value as StyleValue)}"`);
    } else {
      // Escape double quotes in attribute values
      const escaped = String(value).replace(/"/g, '&quot;');
      parts.push(`${key}="${escaped}"`);
    }
  }

  return parts.join(' ');
}

/**
 * Normalize a string or El object into an HTML string for use with set:html
 */
export function toHtml<Tag extends HTMLTag>(content: string | El<Tag>): string {
  if (!isEl(content)) {
    return content;
  }

  const { tag, text, attributes } = content;
  const attrStr = attributes ? attributesToString(attributes) : '';

  return attrStr
    ? `<${tag} ${attrStr}>${text}</${tag}>`
    : `<${tag}>${text}</${tag}>`;
}

// ---------------------------------------------------------------------------
// Node tree renderer — { tag, attrs, children }
// ---------------------------------------------------------------------------

/** Void elements that must not have a closing tag */
const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

/** Default text resolver — strings pass through, locale maps return first value */
function defaultResolveText(value: Localizable): string {
  if (typeof value === 'string') return value;
  const values = Object.values(value);
  return values[0] ?? '';
}

/** Escape text content for safe HTML output */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Render a single ContentNode to an HTML string.
 */
function nodeToHtml(
  node: ContentNode,
  resolveText: (value: Localizable) => string,
): string {
  // String child → text node
  if (typeof node === 'string') {
    return escapeHtml(resolveText(node));
  }

  const { tag, attrs, text, children } = node;
  const attrStr = attrs ? attributesToString(attrs) : '';
  const open = attrStr ? `<${tag} ${attrStr}>` : `<${tag}>`;

  if (VOID_ELEMENTS.has(tag)) {
    return open;
  }

  // text is shorthand for children: ["string"]
  let inner = '';
  if (text != null) {
    inner = escapeHtml(resolveText(text));
  } else if (children?.length) {
    inner = children.map(child => nodeToHtml(child, resolveText)).join('');
  }

  return `${open}${inner}</${tag}>`;
}

/**
 * Render an array of ContentNodes to an HTML string.
 *
 * @param nodes - Array of element nodes and/or text strings
 * @param resolveText - Optional function to resolve Localizable values.
 *   Defaults to returning strings as-is and first locale value for maps.
 */
export function nodesToHtml(
  nodes: ContentNode[],
  resolveText: (value: Localizable) => string = defaultResolveText,
): string {
  return nodes.map(node => nodeToHtml(node, resolveText)).join('');
}
