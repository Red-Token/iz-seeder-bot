FROM node:latest
WORKDIR /app

RUN apt update && apt install -y --no-install-recommends ffmpeg && \
    rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm install --production

COPY ./dist /app

CMD ["node", "--require", "mock-local-storage", "/app/index.mjs"]
