# Portable artifact: a self-contained @astrojs/node server. The SAME image runs
# on Cloudflare Containers, k8s/ECS/Cloud Run, or any Canadian-sovereign VPS.
# The portal has no workspace deps, so it builds standalone from this directory.

# ── build (needs the dev toolchain: astro/vite/esbuild) ──────────────────────
FROM node:24-slim AS build
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build

# ── runtime (prebuilt dist + PRODUCTION deps only — no astro/vite/esbuild) ────
FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080
COPY package.json ./
# astro stays a dependency so every runtime external astro emits (its small
# internal helpers) resolves. Then prune the build-only binaries the built
# server never imports (esbuild/vite/rollup/lightningcss) and the npm cache —
# so the runtime image carries prebuilt dist + runtime libs, no build tooling.
RUN npm install --omit=dev --no-audit --no-fund \
  && rm -rf node_modules/esbuild node_modules/@esbuild \
            node_modules/rollup node_modules/@rollup \
            node_modules/vite node_modules/lightningcss node_modules/@img \
  && npm cache clean --force
COPY --from=build /app/dist ./dist
# src/scripts let the same image also run the worker + migrator (Node strips TS):
#   node ./src/workers/cron.ts   |   node ./scripts/migrate.ts
COPY --from=build /app/src ./src
COPY --from=build /app/scripts ./scripts
EXPOSE 8080
CMD ["node", "./dist/server/entry.mjs"]
