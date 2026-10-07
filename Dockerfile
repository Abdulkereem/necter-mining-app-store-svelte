# Web store for testnet.necter.network: static SPA served by nginx (DockHive app hosting or any container host).
FROM node:24-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
ARG PUBLIC_RPC_URL=https://testnet-rpc.necter.network
ARG PUBLIC_WALLETCONNECT_PROJECT_ID=
ENV PUBLIC_RPC_URL=$PUBLIC_RPC_URL PUBLIC_WALLETCONNECT_PROJECT_ID=$PUBLIC_WALLETCONNECT_PROJECT_ID
RUN pnpm build:web

FROM nginx:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build/web /usr/share/nginx/html
EXPOSE 8080
