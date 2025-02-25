FROM node:22
#WORKDIR /app

RUN apt update && apt install -y --no-install-recommends ffmpeg && \
    rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./

RUN npm i --omit=dev

COPY ./dist /dist

CMD ["node", "--require", "$PWD/dist/preload.cjs", "/dist/index.js"]
#CMD ["npm", "run", "serve"]
