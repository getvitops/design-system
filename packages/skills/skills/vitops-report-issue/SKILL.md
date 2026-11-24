---
name: vitops-report-issue
description: How to report a bug, deprecation or improvement in the Vitops toolchain itself (@getvitops/*, the vitops CLI, the framework CSS or web components) to its public issue tracker, without leaking this client's details. Use when a vitops command errors or prints wrong output, a toolchain warning says something is deprecated, a framework class or pattern you expected is missing and you are about to hand-write CSS around it, or the docs from `vitops docs` are wrong.
---

# Reporting a toolchain issue

The toolchain's tracker (`getvitops/design-system` on GitHub) is **public**; this repo is not. A
report written from inside a client site can leak the client's name, domains, contact details or a
token pasted from an error. So you **draft, the person confirms, then it is filed**: never file on
your own.

## When to report

- A `vitops` command or a `@getvitops/*` package errors, crashes, or produces output that is wrong.
- A toolchain warning says something is deprecated or removed, and the migration it names is
  missing, wrong or unclear.
- A pattern, class or token the framework should have is missing, and you are about to work around it
  with hand-written CSS. That workaround is the signal.
- `vitops docs <topic>` says something the toolchain does not do.

## When not to

- A bug in this site's own code or content.
- A bug in Astro, EmDash, Cloudflare or another upstream. Say where it belongs and stop.
- Anything `vitops docs <topic>` already answers. Read it first.

## Steps

1. **Reduce it to the toolchain.** A config fragment or markup snippet that shows the problem, with
   everything client-specific removed: names, domains, copy, images, screenshots of the site.
2. **Write the draft to a scratch file** (not in the repo). Plain prose is enough; it becomes the
   issue's main field. Add `### Expected behaviour` or `### Reproduction` sections if you have them.
3. **Check for duplicates and see the redacted draft:**

   ```
   vp exec vitops report --type bug|deprecation|improvement --title "…" \
     --body-file <draft> --package <name> --search
   ```

   This files nothing. It prints the draft with the installed versions added, what it redacted from
   `site.json` and generic secret patterns, possible duplicates, and a prefilled new-issue URL.

4. **Show the person the draft, the redactions and any duplicates.** If a duplicate matches, suggest
   adding to it rather than filing. Read the draft for anything redaction missed.
5. **On an explicit yes**, re-run the same command with `--submit --yes`. On a no, or no answer, give
   them the prefilled URL and stop. Report the issue URL it prints.

## Rules

- Never pass `--yes` before the person has seen and approved the exact draft.
- Never put credentials, tokens, customer data or unreleased business details in a draft, redacted
  or not. Redaction is a net.
- One problem per report.
- Needs `gh` signed in only for `--search` and `--submit`; the draft and URL need nothing.
