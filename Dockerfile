# PassTime — build e serve API + site na mesma porta (Socket.IO, SQLite, uploads).
FROM node:22-bookworm-slim AS build

RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY client/package.json ./client/
RUN npm ci

COPY server ./server
COPY client ./client
RUN npm run build \
  && npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && useradd --system --uid 10001 --home /app --shell /usr/sbin/nologin passtime

WORKDIR /app
ENV NODE_ENV=production \
    PORT=8080 \
    DB_PATH=/data/streamflix.db \
    UPLOADS_DIR=/data/uploads

COPY --from=build --chown=passtime:passtime /app/package.json /app/package-lock.json ./
COPY --from=build --chown=passtime:passtime /app/node_modules ./node_modules
COPY --from=build --chown=passtime:passtime /app/server ./server
COPY --from=build --chown=passtime:passtime /app/client/dist ./client/dist

RUN mkdir -p /data/uploads && chown -R passtime:passtime /data

USER passtime
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/dist/index.js"]
