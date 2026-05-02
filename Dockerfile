FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

# Ensure dist exists (it should if we built it)
# If not, we might need to build it here, but we already built it locally.

EXPOSE 3001

CMD ["node", "server/index.js"]
