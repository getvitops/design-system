/**
 * Admin React entrypoint — mirrors `../astro/index.ts`'s "ships as raw
 * source, EmDash's own build bundles it via `adminEntry`" shape: no `pack`
 * entry for this file, `@getvitops/emdash/admin` maps straight at the
 * source in `package.json`.
 */
import type { PluginAdminExports } from 'emdash';
import { DesignSystemEditorPage } from './DesignSystemEditorPage.tsx';

export const pages: PluginAdminExports['pages'] = {
  '/design-system': DesignSystemEditorPage,
};
