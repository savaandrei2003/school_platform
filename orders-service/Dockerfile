# ---------- BUILD ----------
FROM node:20-bullseye AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# ---------- RUNTIME ----------
FROM node:20-bullseye

WORKDIR /app

# Copiem doar ce este necesar
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY package*.json ./

RUN npx prisma generate

EXPOSE 3002
CMD ["node", "dist/main.js"]