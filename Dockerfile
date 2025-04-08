FROM node:23-bullseye
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg gpac && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* manifest_updated.mpd manifest_updated.mpd.xml .
COPY ./dist ./dist

RUN npm i -g pm2 && npm i --omit=dev

CMD ["pm2-runtime", "dist/index.js", "--name", "iz-seeder-bot"]
