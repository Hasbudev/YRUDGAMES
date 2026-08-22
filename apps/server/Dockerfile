# Build context must be the monorepo root (not apps/server), because this
# workspace depends on packages/shared via an npm workspace link ("@yrud/shared": "*")
# and needs the root lockfile to install correctly.
FROM node:20-slim

WORKDIR /app

# Copy only manifests first so `npm ci` is cached unless a dependency changes.
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN npm ci

# Now bring in the actual source needed to build the server.
COPY packages/shared packages/shared
COPY apps/server apps/server

RUN npm run build --workspace=apps/server

ENV NODE_ENV=production
WORKDIR /app/apps/server

EXPOSE 4000
CMD ["node", "dist/index.js"]
