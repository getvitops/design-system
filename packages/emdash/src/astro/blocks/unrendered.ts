/**
 * Which `vitops_*` blocks in a Portable Text body have no renderer in the merged plugin map.
 *
 * `<PortableText>` logs `[components.type] is missing "vitops.…"` and drops the block, and the
 * build still succeeds. Renderers that nest a body (`vitops_section`, widget areas) emit a
 * `data-vitops-unrendered` marker for each such type so `vitops emdash check-prerender` can fail
 * the build instead of publishing a page with holes in it.
 *
 * The virtual module is imported lazily, for the same reason `emdash/ui` is: it imports this
 * package's `./astro` entry, so a static import closes the cycle.
 */
export async function unrenderedTypes(body: unknown): Promise<string[]> {
  if (!Array.isArray(body)) return [];
  const wanted = new Set<string>();
  for (const node of body) {
    const type = node && typeof node === 'object' ? (node as { _type?: unknown })._type : undefined;
    if (typeof type === 'string' && type.startsWith('vitops_')) wanted.add(type);
  }
  if (wanted.size === 0) return [];
  const { pluginBlockComponents } = await import('virtual:emdash/block-components');
  const map = (pluginBlockComponents ?? {}) as Record<string, unknown>;
  return [...wanted].filter((type) => !map[type]).sort();
}
