FROM node:26.13.0-alpine
WORKDIR /relay
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY server.mjs ./
USER node
CMD ["node","server.mjs"]
