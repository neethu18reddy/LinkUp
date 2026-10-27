FROM node:24-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
RUN HUSKY=0 npm ci --ignore-scripts
COPY tsconfig.base.json ./
COPY backend ./backend
COPY frontend ./frontend
RUN npm run build

FROM build AS migrations
CMD ["npm", "run", "db:deploy"]

FROM node:24-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production SERVE_WEB=true
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
RUN npm ci --omit=dev --workspace backend --include-workspace-root --ignore-scripts && npm cache clean --force
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/prisma/data ./backend/prisma/data
COPY --from=build /app/frontend/dist ./frontend/dist
USER node
WORKDIR /app/backend
EXPOSE 4000
CMD ["node", "dist/server.js"]
