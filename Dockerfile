FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY index.js ./

ENV PORT=8080
EXPOSE 8080

CMD ["node", "index.js"]
