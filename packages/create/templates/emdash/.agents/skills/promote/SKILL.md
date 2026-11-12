---
name: promote
description: Promote dev → main to deploy the site to production. Use ONLY when the user explicitly asks to promote, ship, or release dev to prod (e.g. "/promote", "promote to prod", "ship dev to production"). This is a deliberate production deploy — never trigger it automatically from generic "deploy" talk or as a side effect of other work.
---

# Promote (dev → main → production)

Promotion is the **manual** step that ships reviewed `dev` code to production.
It dispatches the **"Promote dev → main"** GitHub Action
(`.github/workflows/promote.yml`), which opens a PR from `dev` into the
protected `main` branch and enables auto-merge. Merging `main` triggers
**Deploy prod** (`deploy-prod.yml`), which ships the production worker.

Deploys that are **already automatic** (do not use this skill for them):

- **dev** auto-deploys on every push/merge to `dev` (`deploy-dev.yml` → the
  `-dev` worker / `dev.<domain>`).
- **prod** auto-deploys on every push to `main` (`deploy-prod.yml`).

So this skill's only job is to kick off the `dev → main` promotion. It does
**not** promote schema/content — see below.

## Steps

1. **Confirm intent.** This ships to production. Briefly state what will happen
   ("This opens a PR from `dev` into `main`; merging deploys production.") and
   proceed — the user invoking this skill is the confirmation. Only pause to
   ask if they haven't clearly asked to go to prod.

2. **Dispatch the workflow** with the `gh` CLI (works from any checkout of this
   repo; `--ref main` picks which copy of the workflow file runs — the workflow
   itself operates on `dev` and `main` regardless):

   ```bash
   gh workflow run promote.yml --ref main
   ```

3. **Find the run and report back.** Dispatch prints no run ID, so list the
   runs to get the URL:

   ```bash
   gh run list --workflow=promote.yml --limit 1 --json databaseId,url,status,conclusion
   ```

   Give the user the run's `url`. If they want, watch it:
   `gh run watch <databaseId>`, then report the conclusion and the promotion
   PR: `gh pr view dev --base main --json url,state`.

## What to tell the user after dispatch

- The workflow opens (or reuses) a PR **dev → main** and enables auto-merge.
- **`main` should be branch-protected.** Whether the merge completes hands-off
  depends on the repo setup:
  - With **required reviews** (default), the PR waits for a human to approve —
    the default `GITHUB_TOKEN` can't approve its own PR. Point the user to the
    PR to approve it; only then does prod deploy.
  - If a `PROMOTE_TOKEN` secret (a PAT / GitHub App token allowed to bypass
    protection) is set, auto-merge completes on its own and prod deploys with
    no further action.
- Once `main` advances, **Deploy prod** runs automatically.

## Content is not promoted — it lives in prod

Content (entries, media, menus, settings) is edited on the **production** site,
using drafts, "Publish changes" and preview links as the staging step. The dev
database starts as a copy of prod and is brought level by the **Sync dev from
prod** workflow (`sync-dev.yml`), one direction only. A sync refuses when dev
content was edited since the last one, snapshots dev first, and re-adds dev's own
collections and fields afterwards. Never try to carry dev content to prod — a
sync replaces it. **Promote** rehearses the release on a throwaway copy of prod,
never on dev, so it does not disturb work on the dev site.

## Schema changes

If this release changes the content model, code promotion is **not** enough —
the schema lives in the EmDash database, not git. Rehearse it first: run
**Refresh dev from prod**, apply the change to dev, check the site. Then apply the
same change to prod (admin at `/_emdash/admin`, or the MCP server at
`/_emdash/api/mcp`). Ordering: additive changes (new collection / optional
field) **before** the code deploy that uses them; removals **after** the code
that stops using them. Mention this to the user only if the release plausibly
touched the schema.

## Hotfixing prod

A fix that can't wait for dev: branch off `main`, PR into `main`, deploy. The
**Back-merge main → dev** workflow then opens a `main → dev` PR so dev doesn't
drift (merge it — that is what triggers a dev deploy — unless
`BACKMERGE_TOKEN` is set, in which case it merges itself when clean). Conflicts
are left on the PR for a human.
