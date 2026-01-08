FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY migrations ./migrations

RUN npm run build

ENV NODE_ENV=production
EXPOSE 3003
CMD ["npm", "start"]
