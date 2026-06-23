# syntax=docker/dockerfile:1.7

# -------- Stage 1: build Vite bundle --------
FROM node:20-alpine AS builder

WORKDIR /app

# Install deps with deterministic cache layer
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

# Copy source and build
COPY . .

# Build-time env vars (override via --build-arg or docker compose)
ARG VITE_API_URL=http://localhost:7860
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# -------- Stage 2: serve with nginx --------
FROM nginx:alpine AS runtime

# SPA-friendly nginx config: fallback all unknown routes to index.html
RUN printf 'server {\n\
    listen 80;\n\
    server_name _;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
    gzip on;\n\
    gzip_types text/css application/javascript application/json image/svg+xml;\n\
    location / {\n\
        try_files $uri /index.html;\n\
    }\n\
    location /assets/ {\n\
        expires 1y;\n\
        add_header Cache-Control "public, immutable";\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q -O- http://localhost/ >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]