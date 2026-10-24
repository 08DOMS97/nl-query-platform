# Backend de NLQP (Express + TypeScript). Se construye desde docker-compose.yml (carpeta nlqp).
# No lleva secretos: la credencial de Google Cloud se monta al correr (secreto de compose) y
# las contraseñas de las bases están en Secret Manager.
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim
ENV NODE_ENV=production PORT=8080
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/lib ./lib
COPY --chown=node:node package.json ./
# Sin root dentro del contenedor.
USER node
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:8080/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "lib/index.js"]
