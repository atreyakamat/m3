FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 8081

ENV CI=1

CMD ["npx", "expo", "start", "--web", "--port", "8081"]
