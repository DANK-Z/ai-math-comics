FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
ARG COMIC_ART_MODE=prepared
ENV VITE_API_MODE=live VITE_API_BASE_URL=/ VITE_COMIC_ART_MODE=$COMIC_ART_MODE
RUN npm run build

FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
