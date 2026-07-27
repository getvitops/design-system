import { glob } from 'astro/loaders';
import { defineCollection, z } from 'astro:content';

/**
 * One flat `docs` collection. Section + ordering come from frontmatter rather
 * than a framework convention, so the generated reference pages (written by
 * scripts/sync-reference.mjs) and the hand-written guides share one shape.
 */
const docs = defineCollection({
  loader: glob({ base: './src/content/docs', pattern: '**/*.{md,mdx}' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    /** Sidebar group. */
    section: z.enum(['Start here', 'Packages', 'Reference', 'Releases']),
    /** Sort key within the section. */
    order: z.number().default(50),
    /** Marks pages emitted by the generator — surfaced as a callout. */
    generated: z.boolean().default(false),
  }),
});

export const collections = { docs };
