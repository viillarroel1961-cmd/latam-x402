FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
COPY mcp ./mcp
COPY data ./data
ENTRYPOINT ["npx", "tsx", "mcp/server.ts"]
