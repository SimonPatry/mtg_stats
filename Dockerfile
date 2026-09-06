# Build front + runtime Node (API Express + dist/).
# Usage : docker compose up -d --build

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.js ./
COPY public ./public
COPY src ./src
COPY shared ./shared
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server ./server
COPY shared ./shared
COPY db ./db
COPY --from=build /app/dist ./dist
EXPOSE 3000
USER node
CMD ["node", "server/index.js"]
