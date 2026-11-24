/**
 * Framework-agnostic HTML/markup helpers (parse5-based). Extracted from
 * @getvitops/astro — no Astro runtime dependency; the Astro-typed `HTMLTag` /
 * `HTMLAttributes` are generalized to `string` / `Record<string, unknown>`.
 */
import { parseFragment, serialize as s, type DefaultTreeAdapterTypes } from 'parse5';

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

export * from './html-render.ts';
