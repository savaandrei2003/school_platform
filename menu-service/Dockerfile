# ---------- BUILD ----------
FROM node:20.12-bullseye AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install

# copiem și prisma + restul codului
COPY prisma ./prisma
COPY tsconfig*.json ./
COPY src ./src

# GENEREAZĂ clientul înainte de build
RUN npx prisma generate

RUN npm run build

# ---------- RUNTIME ----------
FROM node:20.12-bullseye
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY package*.json ./

# (opțional) regen și aici, dar nu e obligatoriu dacă ai copiat node_modules generat
# RUN npx prisma generate

EXPOSE 3001
CMD ["node", "dist/main.js"]
