FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
RUN HUSKY=0 npm ci --workspace backend --include-workspace-root --ignore-scripts
COPY tsconfig.base.json ./
COPY backend ./backend
RUN npm run build --workspace backend

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
RUN npm ci --omit=dev --workspace backend --include-workspace-root --ignore-scripts && npm cache clean --force
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/prisma/data ./backend/prisma/data
USER node
WORKDIR /app/backend
EXPOSE 4000
CMD ["node", "dist/server.js"]
