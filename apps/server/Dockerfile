# Build context must be the monorepo root (not apps/server), because this
# workspace depends on packages/shared via an npm workspace link ("@yrud/shared": "*")
# and needs the root lockfile to install correctly.
FROM node:20-slim

# Prisma's query engine needs OpenSSL to be present at install time to
# detect the right engine binary for this image.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy manifests (for npm ci caching) plus the prisma schema, which the
# apps/server "postinstall" script (prisma generate) needs during `npm ci`
# below — before the rest of the source is copied in.
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/server/prisma apps/server/prisma
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
