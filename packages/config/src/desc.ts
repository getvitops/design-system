import * as z from '@zod/mini';

/** Attach a human description to a schema; it becomes the JSON Schema `description` editors show as a hover. */
export const desc = <T extends { check(...checks: never[]): T }>(schema: T, text: string): T =>
  schema.check(z.describe(text) as never);
