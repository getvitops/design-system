/**
 * The filtering decision behind `<wc-tree>`, as a pure function over a flat node
 * list.
 *
 * `@getvitops/core` has no DOM test environment, and the rule the consent store
 * sets is to keep what is *decidable* out of the DOM wiring rather than reach for
 * one. Everything subtle about tree filtering is decidable — which text a node
 * matches on, and which of its relatives a hit drags into view — so it lives here
 * and is asserted in `tree-filter.test.ts`. The element only reads the DOM into
 * `TreeNode`s and applies the answer.
 */

export interface TreeNode {
  /** Stable handle — the element itself in the DOM, an id in a test. */
  key: unknown;
  /** The node's OWN searchable text (label + description), already lowercased. */
  own: string;
  /** Key of the enclosing node, or null at the root. */
  parent: unknown;
}

export interface TreeMatch {
  /** Keys to show. Everything else is hidden. */
  keep: Set<unknown>;
  /** Nodes that matched on their own text — not the size of `keep`. */
  hits: number;
}

/**
 * Which nodes survive `query`.
 *
 * A node matches on its **own** text only. Matching on subtree text instead is
 * the obvious implementation (`element.textContent`) and it is useless: every
 * ancestor of a hit contains that hit's text, so the root matches any query that
 * matches anything and the filter never narrows.
 *
 * A hit then keeps two families for two different reasons:
 *
 * - its **ancestors**, or the hit is inside something hidden and unreachable;
 * - its **descendants**, so a matched subtree can still be explored — searching
 *   `colors` should show you what is under `colors`, not just the word.
 *
 * An empty or whitespace query keeps nothing and reports no hits; the caller
 * treats that as "restore the unfiltered view", which is a different act from
 * hiding everything.
 */
export function matchTree(nodes: readonly TreeNode[], query: string): TreeMatch {
  const q = query.trim().toLowerCase();
  if (!q) return { keep: new Set(), hits: 0 };

  const byKey = new Map<unknown, TreeNode>();
  const children = new Map<unknown, TreeNode[]>();
  for (const node of nodes) {
    byKey.set(node.key, node);
    const siblings = children.get(node.parent);
    if (siblings) siblings.push(node);
    else children.set(node.parent, [node]);
  }

  const keep = new Set<unknown>();
  let hits = 0;

  const keepDescendants = (key: unknown): void => {
    for (const child of children.get(key) ?? []) {
      if (keep.has(child.key)) continue;
      keep.add(child.key);
      keepDescendants(child.key);
    }
  };

  for (const node of nodes) {
    if (!node.own.includes(q)) continue;
    hits++;
    keep.add(node.key);
    keepDescendants(node.key);
    // Walk up by key rather than by reference so a malformed parent link
    // terminates instead of looping.
    const seen = new Set<unknown>([node.key]);
    let parent = byKey.get(node.parent);
    while (parent && !seen.has(parent.key)) {
      keep.add(parent.key);
      seen.add(parent.key);
      parent = byKey.get(parent.parent);
    }
  }

  return { keep, hits };
}
