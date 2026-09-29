/**
 * The `/design-system` admin page — mounts `<wc-theme-editor>` (a Lit web
 * component, `@getvitops/core/editor`) pointed at this site's own
 * `design-manifest.json` and the `vitops.design-system` plugin route (see
 * `../design-system-route.ts` and AGENTS.md's "EmDash plugin as the
 * design-system editing surface" section).
 *
 * `React.createElement` rather than JSX for the custom element: React's JSX
 * typing for an unknown tag name needs an `IntrinsicElements` augmentation,
 * and this ships as raw source into a consumer's own build (whatever React/
 * JSX-runtime version and config they have) — `createElement('wc-theme-
 * editor', props)` needs no such augmentation and works identically.
 *
 * The editor itself needs no rework: it already reads the `manifest`
 * attribute and (as of this release) a `save-endpoint` attribute for where
 * to probe/POST — this page only has to supply both and load the module
 * that registers the custom element.
 */
import * as React from 'react';

const MANIFEST_URL = '/vitops/design-manifest.json';
const SAVE_ENDPOINT = '/_emdash/api/plugins/vitops/design-system';

export function DesignSystemEditorPage(): React.ReactElement {
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    // Side-effect import: @getvitops/core/editor calls customElements.define
    // on load. Dynamic, and guarded against a fast unmount, since this runs
    // in a browser-only admin page with no SSR concern.
    void import('@getvitops/core/editor').then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return React.createElement(
    'section',
    { className: 'space-y-4' },
    React.createElement('h1', { className: 'text-2xl font-semibold' }, 'Design System'),
    ready
      ? React.createElement('wc-theme-editor', {
          manifest: MANIFEST_URL,
          'save-endpoint': SAVE_ENDPOINT,
        })
      : React.createElement('p', null, 'Loading editor…'),
  );
}
