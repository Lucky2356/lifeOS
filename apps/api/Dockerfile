# Собирать из корня репозитория: docker build -f apps/api/Dockerfile .
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @life-os/domain build
RUN pnpm --filter @life-os/api build
RUN pnpm --filter @life-os/api deploy --prod --legacy /out

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
ENV PORT=3011
ENV CONTENT_PACK_DIR=/app/content-packs
WORKDIR /app
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /out/package.json ./package.json
COPY --from=build /out/dist ./dist
COPY --from=build /repo/apps/api/drizzle ./drizzle
COPY --from=build /repo/content-packs ./content-packs
EXPOSE 3011
USER node
CMD ["node", "dist/main.js"]
