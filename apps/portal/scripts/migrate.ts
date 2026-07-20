// CLI migrator: `node ./scripts/migrate.ts` (via `vp run portal:migrate`).
// Targets DATABASE_URL if set, else a file-backed PGlite dev DB (./.pglite).
import { createDb } from '../src/lib/db/client.ts';
import { applyMigrations } from '../src/lib/db/migrate.ts';

const url = process.env.DATABASE_URL;
const bundle = createDb(url ? { url } : { pglite: './.pglite' });

console.log(`[migrate] applying migrations to ${bundle.kind}${url ? ` (${url.split('@').at(-1)})` : ' (./.pglite)'}`);
try {
  await applyMigrations(bundle);
  console.log('[migrate] done');
} catch (err) {
  console.error('[migrate] failed:', err);
  process.exitCode = 1;
} finally {
  await bundle.close();
}
