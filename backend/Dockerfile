FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma/
COPY scripts/prepare-env.mjs ./scripts/prepare-env.mjs
COPY scripts/prisma-cli.mjs ./scripts/prisma-cli.mjs
RUN npm ci

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/scripts ./scripts
COPY package.json package-lock.json ./
EXPOSE 3001
CMD ["sh", "-c", "node scripts/render-boot-check.mjs; node dist/index.js"]
