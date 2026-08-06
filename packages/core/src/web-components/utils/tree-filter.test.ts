import { describe, expect, it } from 'vitest';
import { matchTree, type TreeNode } from './tree-filter.ts';

/**
 * A small config-shaped tree, since that is the first consumer:
 *
 *   site
 *     analytics
 *       clarityId
 *     legal
 *   organization
 *     name
 */
const NODES: TreeNode[] = [
  { key: 'site', own: 'site one published presentation', parent: null },
  { key: 'analytics', own: 'analytics provider ids', parent: 'site' },
  { key: 'clarityId', own: 'clarityid microsoft clarity', parent: 'analytics' },
  { key: 'legal', own: 'legal generated policy documents', parent: 'site' },
  { key: 'organization', own: 'organization the company', parent: null },
  { key: 'name', own: 'name legal name of the company', parent: 'organization' },
];

const keys = (q: string) => [...matchTree(NODES, q).keep].sort();

describe('matchTree', () => {
  it('keeps a hit, its ancestors and its descendants', () => {
    // `analytics` hits: `site` is needed to reach it, `clarityId` so the matched
    // subtree can still be explored.
    expect(keys('analytics')).toEqual(['analytics', 'clarityId', 'site']);
  });

  it('keeps the whole ancestor chain, not just the parent', () => {
    const { keep, hits } = matchTree(NODES, 'microsoft');
    expect(hits).toBe(1);
    expect([...keep].sort()).toEqual(['analytics', 'clarityId', 'site']);
  });

  /**
   * The bug the `own` field exists to prevent. If a node matched on its subtree's
   * text, `site` would match "microsoft" (via clarityId) and `organization` would
   * match anything under it — so every root stays visible for every query and the
   * filter does nothing while appearing to work.
   */
  it('matches a node on its OWN text, never its descendants text', () => {
    expect(matchTree(NODES, 'microsoft').hits).toBe(1);
    expect(keys('microsoft')).not.toContain('organization');
  });

  it('counts hits, not kept nodes', () => {
    // One hit that drags in two relatives.
    const { keep, hits } = matchTree(NODES, 'clarityid');
    expect(hits).toBe(1);
    expect(keep.size).toBe(3);
  });

  it('finds several hits in unrelated branches', () => {
    // "legal" is a field under `site` AND a word in organization.name's description.
    const { keep, hits } = matchTree(NODES, 'legal');
    expect(hits).toBe(2);
    expect([...keep].sort()).toEqual(['legal', 'name', 'organization', 'site']);
  });

  it('is case- and whitespace-insensitive', () => {
    expect(keys('  ANALYTICS  ')).toEqual(['analytics', 'clarityId', 'site']);
  });

  /**
   * Empty means "restore the unfiltered view", which the caller implements by
   * un-hiding everything — deliberately NOT the same as "keep nothing", which is
   * what an empty `keep` would mean if the caller applied it.
   */
  it('reports nothing for an empty or whitespace query', () => {
    for (const q of ['', '   ']) {
      const { keep, hits } = matchTree(NODES, q);
      expect(keep.size).toBe(0);
      expect(hits).toBe(0);
    }
  });

  it('reports nothing for a query that matches nothing', () => {
    expect(matchTree(NODES, 'kubernetes')).toEqual({ keep: new Set(), hits: 0 });
  });

  it('terminates on a cyclic parent link rather than hanging', () => {
    const cyclic: TreeNode[] = [
      { key: 'a', own: 'alpha', parent: 'b' },
      { key: 'b', own: 'beta', parent: 'a' },
    ];
    expect([...matchTree(cyclic, 'alpha').keep].sort()).toEqual(['a', 'b']);
  });

  it('handles a node whose parent is not in the list', () => {
    const orphan: TreeNode[] = [{ key: 'x', own: 'xylophone', parent: 'missing' }];
    expect([...matchTree(orphan, 'xylo').keep]).toEqual(['x']);
  });
});
