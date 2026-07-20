// Minimal migrator: run the ordered plain-SQL files through a driver's raw
// `exec`. Node/vitest only (reads files from disk) — the Worker never migrates.
import { readFileSync } from 'node:fs';
import type { DbBundle } from './client.ts';

// Ordered on purpose: tables first, then roles/policies.
const MIGRATIONS = ['0000_tables.sql', '0001_rls_roles.sql'] as const;

export async function applyMigrations(bundle: Pick<DbBundle, 'exec'>): Promise<void> {
  for (const file of MIGRATIONS) {
    const sql = readFileSync(new URL(`./migrations/${file}`, import.meta.url), 'utf8');
    await bundle.exec(sql);
  }
}
