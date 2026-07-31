FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

ARG NEXT_PUBLIC_ESTIMATOR_API_URL=http://localhost:8001
ARG NEXT_PUBLIC_ANALYTICS_API_URL=http://localhost:8002
# Server-side env vars consumed by next.config.ts rewrites() at build time.
# Must use Docker network hostnames so SSR proxy can reach backends in-container.
ARG ESTIMATOR_API_URL=http://estimator-api:8001
ARG ANALYTICS_API_URL=http://analytics-api:8002

ENV NEXT_PUBLIC_ESTIMATOR_API_URL=$NEXT_PUBLIC_ESTIMATOR_API_URL
ENV NEXT_PUBLIC_ANALYTICS_API_URL=$NEXT_PUBLIC_ANALYTICS_API_URL
ENV ESTIMATOR_API_URL=$ESTIMATOR_API_URL
ENV ANALYTICS_API_URL=$ANALYTICS_API_URL

RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000 \
    HOSTNAME=0.0.0.0

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD wget -qO- http://127.0.0.1:3000/ > /dev/null 2>&1 || exit 1

CMD ["node", "server.js"]
