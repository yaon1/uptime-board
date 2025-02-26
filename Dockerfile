FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npx nuxt build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production NUXT_DATABASE_PATH=/data/uptime.sqlite PORT=3000
COPY --from=build /app/.output .output
RUN mkdir /data && chown node /data
USER node
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3000/api/status >/dev/null || exit 1
CMD ["node", "--disable-warning=ExperimentalWarning", ".output/server/index.mjs"]
