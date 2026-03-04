FROM node:20-slim AS builder
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci
COPY backend/tsconfig.json ./
COPY backend/src/ ./src/
RUN npx tsc

FROM node:20-slim
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY backend/src/ ./src/
RUN npm install tsx
EXPOSE 3000
CMD ["sh", "-c", "npx tsx src/migrations/run.ts && node dist/index.js"]
