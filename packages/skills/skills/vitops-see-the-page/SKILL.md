---
name: vitops-see-the-page
description: How to look at a rendered page of this site (layout, colour, dark mode, no-JS fallback, mobile width) with playwright-cli, and how to compare a page against a design mockup. Use whenever you need to see, screenshot or click through a page, verify a visual change, compare against a mock, or check how a page behaves without JavaScript.
---

# Seeing the rendered page

`playwright-cli` is the only way to look at a page here. Don't use the Claude-in-Chrome extension or a
browser MCP server; `.claude/settings.json` denies them. The full command reference is the upstream
`playwright-cli` skill (written by `prepare` into `.claude/skills/playwright-cli/`); this file only
covers what is specific to this site.

## Invocation

It **is installed**: it's the CLI bundled in the pinned `playwright` devDependency. There is no
`playwright-cli` binary on `PATH`, and that is expected. The upstream skill writes every command as
`playwright-cli <cmd>`; here always run **`vp exec playwright cli <cmd>`** instead (this project uses
`vp`, not `pnpm`/`npx`). Never `npm i -g @playwright/cli`, `vp dlx` or `npx` it: each fetches a second,
unpinned Playwright and a second browser download.

## Steps

1. **Serve the page first.** `vpr dev` for source changes, or `vpr build` then the preview command
   for exactly what ships. On EmDash, run `vpr prepare-local-db` before the first build.
2. **Open a named session:** `vp exec playwright cli -s=<task> open http://localhost:<port>/<path>`.
   One session per task; `close` it when done.
3. **`snapshot` first.** It's text, cheap, and gives element refs. `screenshot` only when the
   question is visual (spacing, colour, overflow). Output files land in `.playwright-cli/`
   (gitignored).
4. **Dark mode:** set `data-theme="dark"` on `<html>` (the attribute `<wc-color-scheme-toggle>` writes)
   rather than clicking through the toggle.
5. **Mobile width:** `open --device="iPhone 15"` or `--mobile`.
6. **No-JS fallback:** the web components must be usable without JavaScript. Open with a config
   file whose `browser.contextOptions` sets `javaScriptEnabled: false` and check the slotted markup
   is readable and operable.

## Comparing against a mockup

Mockups are made ad hoc, without this toolkit: inline styles, scattered JS, arbitrary DOM. Their
snapshot shares nothing structural with ours, so it says nothing useful. Here the rule flips from
"snapshot first" to **screenshots first**.

- **Compare visually.** Screenshot the mockup and our page, read both images, and compare layout,
  spacing, type, colour and imagery.
- **Same conditions for both:** same viewport (e.g. `resize 1440 900`, then repeat at a mobile
  width), full page, same colour scheme, scrolled to top, fonts and images loaded. Name the files so
  they pair up (`mock-home-1440.png`, `site-home-1440.png`).
- **Long pages:** also screenshot matching sections or elements, so detail isn't lost when a tall
  full-page image is downscaled.
- **Use `snapshot` only for text parity** (copy, headings, link labels). Never judge structure,
  class names or DOM shape against a mock.
- **Two pages of the same site** are the exception: their snapshots are comparable, so snapshot first
  as normal.
- **A local mockup `.html` file:** serve it with a static server already in the project, or open it as
  `file://` with `PLAYWRIGHT_MCP_ALLOW_UNRESTRICTED_FILE_ACCESS=1`.

## Don't

- Don't sign in to a production admin or paste real credentials into a session.
- Don't leave sessions running (`close-all` if unsure).
- If the browser is missing: `vp exec playwright cli install-browser chromium`.
