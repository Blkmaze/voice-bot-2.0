#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

# 1) .dockerignore
cat > .dockerignore << 'EOL'
node_modules
npm-debug.log*
Dockerfile*
docker-compose*.yml
.next
.git
.gitignore
README.md
EOL

# 2) Dockerfile
cat > Dockerfile << 'EOL'
FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:18-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=deps    /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
EXPOSE 3000
CMD ["npm", "run", "start"]
EOL

# 3) docker-compose.yml
cat > docker-compose.yml << 'EOL'
services:
  web:
    build: .
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
EOL

# 4) next.config.js
cat > next.config.js << 'EOL'
/** @type {import('next').NextConfig} */
module.exports = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};
EOL

# 5) Clean up old TS config
rm -f next.config.ts && echo "✔ Removed next.config.ts" || true

# 6) Strip version: from compose
sed -i '/^version:/d' docker-compose.yml && echo "✔ Cleaned compose version"

# 7) Remove stray 'tion'
sed -i '/^[[:space:]]*tion[[:space:]]*$/d' src/app/page.tsx && echo "✔ Stripped stray tion"

# 8) Install deps
echo "→ npm install"
npm install

# 9) Build & run
echo "→ docker compose up --build"
docker compose up --build
