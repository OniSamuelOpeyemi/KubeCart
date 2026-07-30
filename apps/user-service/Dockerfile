FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
# If you have package-lock.json, this ensures it's copied:
COPY package-lock.json ./  
RUN npm ci --legacy-peer-deps
# RUN npm ci
# RUN npm install --legacy-peer-deps
COPY . .
RUN npm run build

FROM node:20-slim

# RUN addgroup -g 1001 -S nodejs && \
#    adduser -S nodejs -u 1001
    
RUN groupadd -g 1001 nodejs && \
    useradd -u 1001 -g nodejs -s /sbin/nologin -M nodejs


WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./

RUN chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "dist/main"]