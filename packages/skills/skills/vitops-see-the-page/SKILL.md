---
name: vitops-see-the-page
description: How to look at a rendered page of this site (layout, colour, dark mode, no-JS fallback, mobile width) with playwright-cli. Use whenever you need to see, screenshot or click through a page, verify a visual change, or check how a page behaves without JavaScript.
---

# Seeing the rendered page

`playwright-cli` is the only way to look at a page here. Don't use the Claude-in-Chrome extension or a
browser MCP server; `.claude/settings.json` denies them. The full command reference is the upstream
`playwright-cli` skill (written by `prepare` into `.claude/skills/playwright-cli/`); this file only
covers what is specific to this site.

## Steps

1. **Serve the page first.** `vpr dev` for source changes, or `vpr build` then the preview command
   for exactly what ships. On EmDash, run `vpr prepare-local-db` before the first build.
2. **Open a named session:** `pnpm exec playwright cli -s=<task> open http://localhost:<port>/<path>`.
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

## Don't

- Don't sign in to a production admin or paste real credentials into a session.
- Don't leave sessions running (`close-all` if unsure).
- If the browser is missing: `pnpm exec playwright cli install-browser chromium`.
