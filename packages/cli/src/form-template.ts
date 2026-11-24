/**
 * `vitops emdash form-template`: copy a saved `vitops_form` block into `site.templates` so the
 * generated privacy policy and `check-prerender` know what the form collects. The block → entry
 * conversion is `@getvitops/emdash`'s `formTemplateFromBlock` (the same resolver the renderer
 * uses, so names match what is submitted); this module is the part that finds blocks and edits
 * the config, kept pure so it is testable without a project.
 */

/** Every `vitops_form` block anywhere in a JSON document (a seed, a content export). */
export function findFormBlocks(doc: unknown): Record<string, unknown>[] {
  const found: Record<string, unknown>[] = [];
  const walk = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== 'object') return;
    const obj = node as Record<string, unknown>;
    if (obj['_type'] === 'vitops_form') found.push(obj);
    Object.values(obj).forEach(walk);
  };
  walk(doc);
  return found;
}

/**
 * Set `site.templates[name]` on the RAW on-disk config, leaving everything else as it was (the
 * rule `designSystemPath()` follows: never normalise the file into a copy nothing builds from).
 * Returns the updated object and whether it changed, so a re-run is a no-op.
 */
export function withTemplate(
  config: unknown,
  name: string,
  template: unknown,
): { config: Record<string, unknown>; changed: boolean } {
  const root = (config && typeof config === 'object' ? config : {}) as Record<string, unknown>;
  const site = (root['site'] && typeof root['site'] === 'object' ? root['site'] : {}) as Record<
    string,
    unknown
  >;
  const templates = (
    site['templates'] && typeof site['templates'] === 'object' ? site['templates'] : {}
  ) as Record<string, unknown>;
  const changed = JSON.stringify(templates[name]) !== JSON.stringify(template);
  return {
    config: { ...root, site: { ...site, templates: { ...templates, [name]: template } } },
    changed,
  };
}
