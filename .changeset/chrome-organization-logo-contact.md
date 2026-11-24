---
'@getvitops/astro': minor
'@getvitops/core': minor
'@getvitops/generator': patch
---

**`<SiteFooter>` and `<Masthead>` read `organization` from the site config, so a site no longer rewrites its logo and contact column by hand.** Pass `config={site}` (the same value `<Masthead>` already takes for `site.chrome`).

- **`<SiteFooter>`**: the brand column shows `organization.logo` (linked home, `loading="lazy"`) when there is no `brand` slot, and a new **contact column** follows the menus: the postal address as an `<address>`, a `tel:` link built from the phone number, a `mailto:` link, the opening hours of one location (grouped to `Mon–Fri  8 am–5 pm`), and the public profile links (`organization.links`) in a labelled `<nav>`. A column only appears for facts the config states, so a config that states none renders the footer it did before. New props: `contact` and `logo` (both default true), `location` (which `organization.locations` key supplies the hours; default the one `organization.contact` names, else the first), and `contactLabel` / `hoursLabel` / `socialLabel`.
- **`<Masthead>`**: with no `brand` slot it shows `organization.logo` as a link to `brandHref` (default `/`); `logo={false}` omits it. A logo link is named by the logo's `alt`, else the organization name, else "Home".
- **Gutter.** `.sitefooter:not(.centered)` now has `padding-inline: var(--sitefooter-gutter, 1rem)`, matching the masthead's `width: full` row, so the logo and columns no longer sit flush against the viewport edge on a wide screen. A footer with `class="centered"` is unchanged (the track is its gutter). New hooks: `--sitefooter-gutter`, `--sitefooter-logo-h` (3rem), `--masthead-logo-h` (2rem).

Every URL that reaches an `href` or `src` (the logo, the profile links) must be a same-site path or an http(s) URL; anything else (`javascript:`, `data:`, `//host`) is dropped. Affects css, bricks and tailwind alike (the partials are shared). **Migration:** none required; a site that fills the `brand` slot keeps its own markup. A site with a hand-built footer contact column can delete it. Other fixed-group packages: no consumer-facing change.
