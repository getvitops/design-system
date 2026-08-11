/**
 * The keyboard-navigation decisions behind `<wc-tree>`'s roving tabindex, as pure
 * functions over a flat node list — the same split `tree-filter.ts` makes for
 * filtering. Not `import`ed from `tree-filter.ts` and doesn't import it either:
 * `WCTree.ts`'s `#collect()` builds ONE list of plain objects whose fields satisfy
 * both modules' node shapes structurally, so the two pure modules stay
 * independent siblings, same as `gallery.ts`/`carousel.ts`/`card-click.ts` are.
 *
 * Deliberately does NOT compute `aria-level`/`aria-posinset`/`aria-setsize`. With
 * a real `role="group"` nested inside `role="treeitem"` (true DOM containment,
 * not an attribute-only overlay), the browser computes all three from structure
 * for free — setting them here would only be a second source of truth to keep in
 * sync with every `filter()` keystroke, for no benefit.
 */

export interface TreeNavNode {
  /** Stable handle — the element itself in the DOM, a string in a test. */
  key: unknown;
  /** Key of the enclosing node, or null/undefined at the root. */
  parent: unknown;
  /** Row-only searchable text (label, no description) — used for type-ahead. */
  label: string;
  /** `null` for a leaf; `true`/`false` for a branch's current expand state. */
  expanded: boolean | null;
  /** Filtered out by `filter()` — distinct from a collapsed branch. */
  hidden: boolean;
}

/**
 * Depth-first **visible** order: skips a node that is itself `hidden`, or has any
 * ancestor that is `hidden` or collapsed (`expanded === false`).
 *
 * Assumes `nodes` already arrives in document order — true of `#collect()`, which
 * builds it from `querySelectorAll`, so filtering here preserves depth-first order
 * without re-deriving it.
 */
export function visibleOrder(nodes: readonly TreeNavNode[]): TreeNavNode[] {
  const byKey = new Map<unknown, TreeNavNode>();
  for (const node of nodes) byKey.set(node.key, node);

  const isVisible = (node: TreeNavNode): boolean => {
    if (node.hidden) return false;
    // Walk by key rather than by reference so a malformed parent link
    // terminates instead of looping — same defence `matchTree` uses.
    const seen = new Set<unknown>([node.key]);
    let parent =
      node.parent === null || node.parent === undefined ? undefined : byKey.get(node.parent);
    while (parent) {
      if (parent.hidden || parent.expanded === false) return false;
      if (seen.has(parent.key)) break;
      seen.add(parent.key);
      parent =
        parent.parent === null || parent.parent === undefined
          ? undefined
          : byKey.get(parent.parent);
    }
    return true;
  };

  return nodes.filter(isVisible);
}

export type TreeMove =
  | { type: 'to'; key: unknown }
  | { type: 'expand'; key: unknown }
  | { type: 'collapse'; key: unknown };

/** The four directional keys a tree responds to, already decoded from a keydown. */
export type TreeDirection = 'next' | 'prev' | 'first' | 'last' | 'in' | 'out';

/**
 * Resolve one directional key against the tree's current visible order.
 *
 * `in` (Right, or its RTL-flipped counterpart) is three different things
 * depending on the active node: expand a closed branch, step into an open
 * branch's first child (its immediate successor in visible order once open), or
 * do nothing on a leaf. `out` (Left) mirrors it: collapse an open branch, or step
 * to the parent.
 */
export function resolveTreeMove(
  nodes: readonly TreeNavNode[],
  activeKey: unknown,
  direction: TreeDirection,
): TreeMove | null {
  const order = visibleOrder(nodes);
  if (!order.length) return null;

  const index = order.findIndex((n) => n.key === activeKey);
  const active = index >= 0 ? order[index] : undefined;

  switch (direction) {
    case 'first':
      return { type: 'to', key: order[0]!.key };
    case 'last':
      return { type: 'to', key: order[order.length - 1]!.key };
    case 'next':
      if (index < 0) return { type: 'to', key: order[0]!.key };
      return index < order.length - 1 ? { type: 'to', key: order[index + 1]!.key } : null;
    case 'prev':
      if (index < 0) return { type: 'to', key: order[0]!.key };
      return index > 0 ? { type: 'to', key: order[index - 1]!.key } : null;
    case 'in': {
      if (!active || active.expanded === null) return null;
      if (active.expanded === false) return { type: 'expand', key: active.key };
      const next = order[index + 1];
      return next && next.parent === active.key ? { type: 'to', key: next.key } : null;
    }
    case 'out': {
      if (!active) return null;
      if (active.expanded === true) return { type: 'collapse', key: active.key };
      return active.parent === null || active.parent === undefined
        ? null
        : { type: 'to', key: active.parent };
    }
  }
}

/** Every branch sibling of `key` (same parent), for the `*`-expand-all-at-level key. */
export function siblingsOf(nodes: readonly TreeNavNode[], key: unknown): unknown[] {
  const node = nodes.find((n) => n.key === key);
  if (!node) return [];
  return nodes.filter((n) => n.parent === node.parent && n.expanded !== null).map((n) => n.key);
}
