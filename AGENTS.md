This repo is responsible for generating design systems for use in websites (primarily Astro and WordPress with Bricks Builder).

## Development

The build system uses `vite-plus` (command is `vp`), which is a wrapper for common tools for SDLC tasks:

- `vite-task` (`npx vp run ...`) - task orchestration with caching, even across monorepo packages
- `oxfmt` (`npx vp fmt`) - formatting md/css/js/ts/html
- `oxlint` (`npx vp lint`) - linting js/ts
- `vitest` (`npx vp test`) - unit/integration testing
- `vite` (`npx vp build`) - libraries/application build meta-tool for web runtimes
- `tsdown` (`npx vp pack`) - libraries/applications build meta-tool for server runtimes

It also supports:

- running pre-commit hooks on staged files using the `staged` key in `vite.config.ts`

They are all configured with their respective keys in `vite.config.ts`

Other tools used:

- `gale` - css linting
- `lightningcss` - css minification/bundling
- `playwright` - e2e testing

## Tasks

- do not run format or lint as verifications, these are done automatically on save and PostToolUse hooks.
