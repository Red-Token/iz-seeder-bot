FROM node:22
RUN apt update && apt install -y --no-install-recommends ffmpeg gpac &&
    rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./

RUN npm i --omit=dev
RUN mkdir -p /tmp/iz-seeder-bot/{seeding, transcoding, upload}
RUN mkdir -p /var/tmp/iz-seeder-bot/seeding
COPY ./dist /dist

CMD ["node", "--require", "./dist/preload.cjs", "/dist/index.js"]
#CMD ["npm", "run", "serve"]
