#!/bin/bash
#
# SessionStart hook for Claude Code on the web.
#
# The web container ships Node 20/21/22, but this project pins Node 24 via
# `devEngines` in package.json. This hook installs Node 24 (via the image's
# nvm), makes it win over the baked-in Node on PATH for the whole session,
# activates the pinned pnpm, and installs dependencies so `astro check`,
# builds, and the EmDash CLI all run against the version the project expects.
set -euo pipefail

# Only relevant in the remote web container; local sessions manage their own Node.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
	exit 0
fi

# --- Node 24 (matches package.json > devEngines.runtime) ---------------------
export NVM_DIR="${NVM_DIR:-/opt/nvm}"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

nvm install 24
nvm alias default 24

# The base image prepends its own node bin dir to PATH, ahead of nvm's shims,
# so a plain `node` resolves to the baked-in version. Put Node 24's bin dir
# first for this session and persist it to every subsequent tool call via
# $CLAUDE_ENV_FILE.
NODE24_BIN="$(dirname "$(nvm which 24)")"
export PATH="$NODE24_BIN:$PATH"
echo "export PATH=\"$NODE24_BIN:\$PATH\"" >> "$CLAUDE_ENV_FILE"

# --- Dependencies (pnpm, pinned via package.json > packageManager) -----------
cd "$CLAUDE_PROJECT_DIR"
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
corepack enable
# `install` (not `--frozen-lockfile`) so the warmed container cache is reusable.
pnpm install

echo "Ready: Node $(node --version), pnpm $(pnpm --version)"
