/**
 * The `/design-system` admin page — embeds `<wc-theme-editor>` (a Lit web
 * component, `@getvitops/core/editor`) in an iframe onto the site's own
 * `/vitops/design-system-editor.html`, which the Astro integration writes under
 * `vitops({ editorManifest: true })` (see `../design-system-route.ts` and AGENTS.md's
 * "EmDash plugin as the design-system editing surface" section).
 *
 * An iframe, not a mounted element, because the editor renders in light DOM and
 * borrows the framework's own CSS (drawer, details, forms, buttons). Loading that
 * into the admin restyles EmDash's own UI; scoped to a frame it can't reach it, and
 * the admin's styles can't reach the editor. The save endpoint is passed as `?save=`.
 */
import * as React from 'react';

const EDITOR_URL = '/vitops/design-system-editor.html';
const SAVE_ENDPOINT = '/_emdash/api/plugins/vitops/design-system';

export function DesignSystemEditorPage(): React.ReactElement {
  return React.createElement('iframe', {
    title: 'Design system editor',
    src: `${EDITOR_URL}?save=${encodeURIComponent(SAVE_ENDPOINT)}`,
    style: { width: '100%', height: 'calc(100vh - 8rem)', border: 0 },
  });
}
